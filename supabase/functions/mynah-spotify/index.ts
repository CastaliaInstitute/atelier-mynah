import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/googleVoice.ts";

type Action =
  | "status"
  | "toggle"
  | "next"
  | "previous"
  | "play"
  | "pause"
  /** Same as pause — stops playback on the active Connect device. */
  | "stop";

type ReqBody = {
  action?: Action;
};

type TokenCache = {
  key: string;
  access_token: string;
  expires_at_ms: number;
};

let tokenCache: TokenCache | null = null;

const SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state";

function spotifyEnv(): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")?.trim() ?? "";
  const refreshToken = Deno.env.get("SPOTIFY_REFRESH_TOKEN")?.trim() ?? "";
  return { clientId, clientSecret, refreshToken };
}

function supabaseUrl(): string {
  return (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
}

function serviceRoleKey(): string {
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

function anonKey(): string {
  return (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
}

function restHeaders(service: boolean): Record<string, string> {
  const key = service ? serviceRoleKey() : anonKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function functionPathSuffix(url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("mynah-spotify");
  if (i < 0) return "";
  return parts.slice(i + 1).join("/");
}

function functionBaseUrl(req: Request): string {
  const base = supabaseUrl();
  if (base) {
    return `${base}/functions/v1/mynah-spotify`;
  }
  const u = new URL(req.url);
  return `${u.origin}/functions/v1/mynah-spotify`;
}

function spotifyRedirectUri(req: Request): string {
  return `${functionBaseUrl(req)}/callback`;
}

function redirectResponse(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      ...corsHeaders,
      Location: url,
      "Cache-Control": "no-store",
    },
  });
}

function spotifyConnectPageUrl(req: Request, result?: Record<string, string>): string {
  const base = supabaseUrl();
  const anon = anonKey();
  const functionBase = functionBaseUrl(req);
  const origin = (Deno.env.get("MYNAH_SPOTIFY_CONNECT_ORIGIN")?.trim() || "https://music.castalia.institute")
    .replace(/\/+$/, "");
  const url = new URL("/spotify-connect.html", `${origin}/`);
  if (base) url.searchParams.set("supabase", base);
  if (anon) url.searchParams.set("anon", anon);
  url.searchParams.set("function", functionBase);
  for (const [key, value] of Object.entries(result ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function defaultSpotifyUserId(): string {
  return (
    Deno.env.get("MYNAH_SPOTIFY_DEFAULT_USER_ID")?.trim() ||
    "20b89826-c35a-42eb-bb4d-c20108a3e54e"
  );
}

async function connectPage(req: Request): Promise<Response> {
  const { clientId } = spotifyEnv();
  const userId = defaultSpotifyUserId();
  if (!clientId) {
    return jsonResponse(500, { error: "SPOTIFY_CLIENT_ID is not configured" });
  }
  if (!userId) {
    return jsonResponse(500, { error: "MYNAH_SPOTIFY_DEFAULT_USER_ID is not configured" });
  }
  const state = await createOAuthState(userId);
  await spotifyDebugEvent("direct_oauth_state_created", undefined, userId);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(req),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return redirectResponse(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

async function authUserId(req: Request): Promise<string | null> {
  const base = supabaseUrl();
  const anon = anonKey();
  const auth = req.headers.get("authorization") ?? "";
  if (!base || !anon || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: anon,
      Authorization: auth,
    },
  });
  if (!res.ok) return null;
  const user = await res.json() as { id?: string };
  return user.id ?? null;
}

async function spotifyDebugEvent(event: string, detail?: string, userId?: string | null): Promise<void> {
  const base = supabaseUrl();
  if (!base || !serviceRoleKey()) return;
  try {
    await fetch(`${base}/rest/v1/mynah_spotify_debug_events`, {
      method: "POST",
      headers: { ...restHeaders(true), Prefer: "return=minimal" },
      body: JSON.stringify({
        event,
        user_id: userId ?? null,
        detail: detail ? detail.slice(0, 480) : null,
      }),
    });
  } catch {
    // Best-effort diagnostics only.
  }
}

async function userSpotifyRefreshToken(userId: string): Promise<string | null> {
  const base = supabaseUrl();
  const service = serviceRoleKey();
  if (!base || !service) return null;
  const res = await fetch(
    `${base}/rest/v1/mynah_spotify_connections?user_id=eq.${encodeURIComponent(userId)}&select=refresh_token`,
    {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ refresh_token?: string }>;
  return rows[0]?.refresh_token?.trim() || null;
}

async function latestSpotifyRefreshToken(): Promise<string | null> {
  const base = supabaseUrl();
  const service = serviceRoleKey();
  if (!base || !service) return null;
  const res = await fetch(
    `${base}/rest/v1/mynah_spotify_connections?select=refresh_token&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ refresh_token?: string }>;
  return rows[0]?.refresh_token?.trim() || null;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function createOAuthState(userId: string): Promise<string> {
  const base = supabaseUrl();
  const state = randomState();
  await fetch(`${base}/rest/v1/mynah_spotify_oauth_states?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: "DELETE",
    headers: restHeaders(true),
  });
  const res = await fetch(`${base}/rest/v1/mynah_spotify_oauth_states`, {
    method: "POST",
    headers: { ...restHeaders(true), Prefer: "return=minimal" },
    body: JSON.stringify({ state, user_id: userId }),
  });
  if (!res.ok) {
    throw new Error(`Could not create Spotify OAuth state (${res.status})`);
  }
  return state;
}

async function consumeOAuthState(state: string): Promise<string | null> {
  const base = supabaseUrl();
  const res = await fetch(
    `${base}/rest/v1/mynah_spotify_oauth_states?state=eq.${encodeURIComponent(state)}&expires_at=gte.${encodeURIComponent(new Date().toISOString())}&select=user_id`,
    { headers: restHeaders(true) },
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ user_id?: string }>;
  const userId = rows[0]?.user_id ?? null;
  if (userId) {
    await fetch(`${base}/rest/v1/mynah_spotify_oauth_states?state=eq.${encodeURIComponent(state)}`, {
      method: "DELETE",
      headers: restHeaders(true),
    });
  }
  return userId;
}

async function spotifyProfile(accessToken: string): Promise<{ id?: string; display_name?: string }> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return await res.json() as { id?: string; display_name?: string };
}

async function storeSpotifyConnection(
  userId: string,
  token: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string },
): Promise<{ display_name?: string }> {
  const refreshToken = token.refresh_token ?? await userSpotifyRefreshToken(userId);
  if (!refreshToken) {
    throw new Error("Spotify did not return a refresh token");
  }
  const profile = await spotifyProfile(token.access_token);
  const res = await fetch(`${supabaseUrl()}/rest/v1/mynah_spotify_connections`, {
    method: "POST",
    headers: {
      ...restHeaders(true),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      spotify_user_id: profile.id ?? null,
      display_name: profile.display_name ?? null,
      access_token: token.access_token,
      refresh_token: refreshToken,
      expires_at_ms: Date.now() + (token.expires_in ?? 3600) * 1000,
      scope: token.scope ?? null,
      token_type: token.token_type ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not store Spotify connection (${res.status}): ${text.slice(0, 160)}`);
  }
  return profile;
}

async function exchangeSpotifyCode(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}> {
  const { clientId, clientSecret } = spotifyEnv();
  if (!clientId || !clientSecret) {
    throw new Error("Spotify client is not configured");
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Spotify token ${res.status}: ${text.slice(0, 220)}`);
  }
  return JSON.parse(text);
}

async function oauthStateResponse(req: Request): Promise<Response> {
  const userId = await authUserId(req);
  if (!userId) {
    return jsonResponse(401, { error: "Missing Supabase session" });
  }
  const { clientId } = spotifyEnv();
  if (!clientId) {
    return jsonResponse(500, { error: "SPOTIFY_CLIENT_ID is not configured" });
  }
  const state = await createOAuthState(userId);
  await spotifyDebugEvent("oauth_state_created", undefined, userId);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(req),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return jsonResponse(200, { url: `https://accounts.spotify.com/authorize?${params.toString()}` });
}

async function callbackResponse(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const err = (url.searchParams.get("error") ?? "").trim();
  if (err) {
    await spotifyDebugEvent("callback_spotify_error", err);
    return redirectResponse(spotifyConnectPageUrl(req, { error: `Spotify authorization failed: ${err}` }), 303);
  }
  const code = (url.searchParams.get("code") ?? "").trim();
  const state = (url.searchParams.get("state") ?? "").trim();
  if (!code || !state) {
    await spotifyDebugEvent("callback_missing_code_or_state");
    return redirectResponse(spotifyConnectPageUrl(req, { error: "Spotify callback is missing code or state." }), 303);
  }
  try {
    await spotifyDebugEvent("callback_started");
    const userId = await consumeOAuthState(state);
    if (!userId) {
      await spotifyDebugEvent("callback_state_expired");
      return redirectResponse(spotifyConnectPageUrl(req, { error: "Spotify authorization expired. Please try again." }), 303);
    }
    await spotifyDebugEvent("callback_state_consumed", undefined, userId);
    const token = await exchangeSpotifyCode(code, spotifyRedirectUri(req));
    await spotifyDebugEvent("callback_token_exchanged", token.refresh_token ? "refresh_token=yes" : "refresh_token=no", userId);
    const profile = await storeSpotifyConnection(userId, token);
    await spotifyDebugEvent("callback_connection_stored", profile.display_name, userId);
    return redirectResponse(spotifyConnectPageUrl(req, {
      connected: "1",
      name: profile.display_name ?? "",
    }), 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Spotify callback failed", msg);
    await spotifyDebugEvent("callback_failed", msg);
    return redirectResponse(spotifyConnectPageUrl(req, { error: "Spotify connection failed. Please try again." }), 303);
  }
}

async function getAccessToken(refreshToken: string, cacheKey: string): Promise<string> {
  const { clientId, clientSecret } = spotifyEnv();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Spotify is not connected for this Castalia account");
  }
  const now = Date.now();
  if (tokenCache && tokenCache.key === cacheKey && now < tokenCache.expires_at_ms - 30_000) {
    return tokenCache.access_token;
  }

  const basic = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Spotify token ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  tokenCache = {
    key: cacheKey,
    access_token: data.access_token,
    expires_at_ms: now + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function spotifyApi(
  req: Request,
  method: string,
  path: string,
  opts?: { body?: string },
): Promise<Response> {
  const userId = await authUserId(req);
  const userRefreshToken = userId ? await userSpotifyRefreshToken(userId) : null;
  const latestRefreshToken = userRefreshToken ? null : await latestSpotifyRefreshToken();
  const globalRefreshToken = spotifyEnv().refreshToken;
  const refreshToken = userRefreshToken || latestRefreshToken || globalRefreshToken;
  const cacheKey = userRefreshToken ? `user:${userId}` : latestRefreshToken ? "latest" : "global";
  const token = await getAccessToken(refreshToken, cacheKey);
  return await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts?.body,
  });
}

function decodeJsonString(s: string): string {
  return s
    .replace(/\\\\/g, "\u0000")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\u0000/g, "\\");
}

function parseDeviceName(json: string): string {
  const di = json.indexOf('"device"');
  if (di < 0) {
    return "";
  }
  const slice = json.slice(di, di + 2800);
  if (slice.includes('"device":null') || slice.includes('"device" : null')) {
    return "";
  }
  const nm = slice.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return nm ? decodeJsonString(nm[1]) : "";
}

function parsePlayerJson(json: string): {
  isPlaying: boolean;
  track: string;
  artist: string;
  deviceName: string;
} {
  const deviceName = parseDeviceName(json);
  let isPlaying = false;
  const mPlay = json.match(/"is_playing"\s*:\s*(true|false)/);
  if (mPlay) {
    isPlaying = mPlay[1] === "true";
  }
  if (json.includes('"item":null')) {
    return { isPlaying, track: "", artist: "", deviceName };
  }
  const itemIdx = json.indexOf('"item"');
  if (itemIdx < 0) {
    return { isPlaying, track: "", artist: "", deviceName };
  }
  const slice = json.slice(itemIdx, Math.min(json.length, itemIdx + 48_000));

  let artist = "";
  const artIdx = slice.indexOf(`"artists"`);
  if (artIdx >= 0) {
    const artSlice = slice.slice(artIdx, artIdx + 8000);
    const artMatch = artSlice.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (artMatch) {
      artist = decodeJsonString(artMatch[1]);
    }
  }

  let track = "";
  const typeIdx = slice.lastIndexOf('"type":"track"');
  if (typeIdx > 0) {
    const before = slice.slice(0, typeIdx);
    const names = [...before.matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
    if (names.length > 0) {
      track = decodeJsonString(names[names.length - 1][1]);
    }
  }

  return { isPlaying, track, artist, deviceName };
}

async function readStatus(req: Request): Promise<{
  isPlaying: boolean;
  track: string;
  artist: string;
  deviceName: string;
}> {
  const res = await spotifyApi(req, "GET", "/me/player");
  if (res.status === 204) {
    return { isPlaying: false, track: "", artist: "", deviceName: "" };
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`player GET ${res.status}: ${text.slice(0, 200)}`);
  }
  return parsePlayerJson(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const suffix = functionPathSuffix(new URL(req.url));
  if (req.method === "GET" && (suffix === "" || suffix === "connect")) {
    return await connectPage(req);
  }
  if (req.method === "POST" && suffix === "oauth-state") {
    return await oauthStateResponse(req);
  }
  if (req.method === "GET" && suffix === "callback") {
    return await callbackResponse(req);
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const action = (body.action ?? "status") as Action;

  try {
    if (action === "status") {
      const st = await readStatus(req);
      return jsonResponse(200, { ok: true, ...st });
    }

    if (action === "toggle") {
      const st = await readStatus(req);
      if (st.isPlaying) {
        const r = await spotifyApi(req, "PUT", "/me/player/pause");
        if (!r.ok && r.status !== 204) {
          const t = await r.text();
          throw new Error(`pause ${r.status}: ${t.slice(0, 160)}`);
        }
      } else {
        const r = await spotifyApi(req, "PUT", "/me/player/play");
        if (!r.ok && r.status !== 204) {
          const t = await r.text();
          throw new Error(`play ${r.status}: ${t.slice(0, 160)}`);
        }
      }
      const after = await readStatus(req);
      return jsonResponse(200, { ok: true, ...after });
    }

    if (action === "next") {
      const r = await spotifyApi(req, "POST", "/me/player/next");
      if (!r.ok && r.status !== 204) {
        const t = await r.text();
        throw new Error(`next ${r.status}: ${t.slice(0, 160)}`);
      }
      const after = await readStatus(req);
      return jsonResponse(200, { ok: true, ...after });
    }

    if (action === "previous") {
      const r = await spotifyApi(req, "POST", "/me/player/previous");
      if (!r.ok && r.status !== 204) {
        const t = await r.text();
        throw new Error(`previous ${r.status}: ${t.slice(0, 160)}`);
      }
      const after = await readStatus(req);
      return jsonResponse(200, { ok: true, ...after });
    }

    if (action === "play") {
      const r = await spotifyApi(req, "PUT", "/me/player/play");
      if (!r.ok && r.status !== 204) {
        const t = await r.text();
        throw new Error(`play ${r.status}: ${t.slice(0, 160)}`);
      }
      const after = await readStatus(req);
      return jsonResponse(200, { ok: true, ...after });
    }

    if (action === "pause" || action === "stop") {
      const r = await spotifyApi(req, "PUT", "/me/player/pause");
      if (!r.ok && r.status !== 204) {
        const t = await r.text();
        throw new Error(`pause ${r.status}: ${t.slice(0, 160)}`);
      }
      const after = await readStatus(req);
      return jsonResponse(200, { ok: true, ...after });
    }

    return jsonResponse(400, { error: "Unknown action", action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(200, {
      ok: false,
      isPlaying: false,
      track: "",
      artist: "",
      deviceName: "",
      error: msg,
    });
  }
});
