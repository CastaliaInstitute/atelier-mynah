import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/googleVoice.ts";
import { requirePaidReliquary } from "../_shared/reliquaryMembership.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const membershipError = await requirePaidReliquary(req);
  if (membershipError) return membershipError;

  const url = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!url || !anonKey || !serviceRole) {
    return jsonResponse(503, { error: "Reliquary voice service is not configured" });
  }

  const upstreamHeaders = new Headers({
    "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    "Accept": req.headers.get("Accept") ?? "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${serviceRole}`,
  });
  const deviceToken = req.headers.get("X-Reliquary-Device-Token");
  if (deviceToken) upstreamHeaders.set("X-Reliquary-Device-Token", deviceToken);

  const upstream = await fetch(`${url.replace(/\/$/, "")}/functions/v1/voice-pipeline`, {
    method: "POST",
    headers: upstreamHeaders,
    body: await req.arrayBuffer(),
    signal: AbortSignal.timeout(660_000),
  });
  const headers = new Headers(upstream.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(upstream.body, { status: upstream.status, headers });
});
