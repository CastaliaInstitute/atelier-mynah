import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const encoder = new TextEncoder();
const MAX_INPUT = 4000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function baseURL(): string {
  return (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/u, "");
}

function serviceHeaders(): Record<string, string> {
  const key = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  return { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
}

async function userID(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const response = await fetch(`${baseURL()}/auth/v1/user`, {
    headers: {
      apikey: (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim(),
      authorization: auth,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user.id : null;
}

function relayAuthorized(request: Request): boolean {
  const secret = (Deno.env.get("ALPHEUS_WATCH_RELAY_KEY") ?? "").trim();
  return secret.length >= 32 && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function rest(path: string, init: RequestInit): Promise<Response> {
  return await fetch(`${baseURL()}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

async function enqueue(user: string, input: string): Promise<Response> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const rateCheck = await rest(
    `mynah_watch_al_requests?user_id=eq.${encodeURIComponent(user)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
    { method: "GET", headers: { Prefer: "count=exact", Range: "0-0" } },
  );
  if (!rateCheck.ok) return json({ error: "Could not queue request." }, 503);
  const count = Number((rateCheck.headers.get("content-range") ?? "/0").split("/").at(-1));
  if (Number.isFinite(count) && count >= 5) return json({ error: "Please wait before sending another Al request." }, 429);

  const response = await rest("mynah_watch_al_requests?select=id,status,created_at,expires_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: user, input }),
  });
  if (!response.ok) return json({ error: "Could not queue request." }, 503);
  const rows = await response.json();
  return json(rows[0], 201);
}

async function status(user: string, id: string): Promise<Response> {
  const response = await rest(
    `mynah_watch_al_requests?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user)}&select=id,status,result,error,created_at,completed_at&limit=1`,
    { method: "GET" },
  );
  if (!response.ok) return json({ error: "Could not read request status." }, 503);
  const rows = await response.json();
  return rows.length ? json(rows[0]) : json({ error: "Request not found." }, 404);
}

async function claim(): Promise<Response> {
  const response = await fetch(`${baseURL()}/rest/v1/rpc/claim_mynah_watch_al_request`, {
    method: "POST",
    headers: serviceHeaders(),
    body: "{}",
  });
  if (!response.ok) return json({ error: "Queue unavailable." }, 503);
  const rows = await response.json();
  const row = rows[0];
  return json(row ? { id: row.id, input: row.input } : null);
}

async function complete(id: string, body: Record<string, unknown>): Promise<Response> {
  const text = typeof body.result === "string" ? body.result.trim() : "";
  const message = typeof body.error === "string" ? body.error.trim().slice(0, 300) : "";
  if (!text && !message) return json({ error: "A result or error is required." }, 400);
  const patch = text
    ? { status: "complete", result: text.slice(0, 12000), completed_at: new Date().toISOString() }
    : { status: "failed", error: message, completed_at: new Date().toISOString() };
  const response = await rest(
    `mynah_watch_al_requests?id=eq.${encodeURIComponent(id)}&status=eq.processing`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) },
  );
  if (!response.ok) return json({ error: "Could not save result." }, 503);
  return json({ accepted: (await response.json()).length === 1 });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "POST required." }, 405);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "A JSON object is required." }, 400);
  }
  const action = body.action;
  if (action === "next" || action === "complete") {
    if (!relayAuthorized(request)) return json({ error: "Relay authentication failed." }, 401);
    if (action === "next") return await claim();
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/iu.test(id)) return json({ error: "Invalid request id." }, 400);
    return await complete(id, body);
  }

  const user = await userID(request);
  if (!user) return json({ error: "Castalia sign-in required." }, 401);
  if (action === "request") {
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input || encoder.encode(input).length > MAX_INPUT) return json({ error: "Message must be 1–4000 characters." }, 400);
    return await enqueue(user, input);
  }
  if (action === "status") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/iu.test(id)) return json({ error: "Invalid request id." }, 400);
    return await status(user, id);
  }
  return json({ error: "Unknown action." }, 400);
});
