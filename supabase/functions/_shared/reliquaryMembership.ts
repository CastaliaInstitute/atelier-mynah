import { createClient } from "npm:@supabase/supabase-js@2.49.8";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A faculty-face Reliquary request must come from a paired, currently paid member. */
export async function requirePaidReliquary(req: Request): Promise<Response | null> {
  const token = (req.headers.get("X-Reliquary-Device-Token") ?? "").trim();
  if (!token) return new Response(JSON.stringify({ error: "Castalia membership pairing required" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !serviceRole) return new Response(JSON.stringify({ error: "Membership verification is unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });

  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: device, error: deviceError } = await admin.from("reliquary_devices")
    .select("owner_user_id").eq("device_token_hash", await sha256(token))
    .is("revoked_at", null).maybeSingle<{ owner_user_id: string }>();
  if (deviceError || !device?.owner_user_id) return new Response(JSON.stringify({ error: "Reliquary pairing is invalid" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  const { data: account } = await admin.auth.admin.getUserById(device.owner_user_id);
  if (!account.user) return new Response(JSON.stringify({ error: "Castalia account is unavailable" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  const activeWindow = `current_period_end.is.null,current_period_end.gte.${new Date().toISOString()}`;
  const byUser = await admin.from("memberships").select("id").eq("user_id", account.user.id)
    .eq("status", "active").or(activeWindow).limit(1).maybeSingle();
  let active = Boolean(byUser.data);
  if (!active && account.user.email) {
    const byEmail = await admin.from("memberships").select("id").ilike("email", account.user.email)
      .eq("status", "active").or(activeWindow).limit(1).maybeSingle();
    active = Boolean(byEmail.data);
  }
  if (!active) return new Response(JSON.stringify({ error: "An active paid Castalia membership is required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  void admin.from("reliquary_devices").update({ last_seen_at: new Date().toISOString() })
    .eq("device_token_hash", await sha256(token)).is("revoked_at", null);
  return null;
}
