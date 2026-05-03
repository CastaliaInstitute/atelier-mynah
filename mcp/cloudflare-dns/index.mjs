/**
 * MCP server: Cloudflare zone DNS (CNAME upsert, list records, list zones).
 * Auth: CLOUDFLARE_API_TOKEN with Zone → DNS → Edit + Zone → Zone → Read.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = "https://api.cloudflare.com/client/v4";

function requireToken() {
  const t = process.env.CLOUDFLARE_API_TOKEN;
  if (!t?.trim()) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is not set. Add it via mcp envFile (.env.local) or Cursor MCP env."
    );
  }
  return t.trim();
}

async function cfJson(path, init = {}) {
  const token = requireToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await res.json();
  if (!body.success) {
    const msg = (body.errors || [])
      .map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim())
      .join("; ");
    throw new Error(msg || JSON.stringify(body));
  }
  return body.result;
}

async function resolveZoneId(zoneName, zoneId) {
  if (zoneId) return zoneId;
  if (!zoneName) throw new Error("Provide zoneName or zoneId");
  const zones = await cfJson(`/zones?name=${encodeURIComponent(zoneName)}`);
  if (!zones?.length) throw new Error(`No zone named "${zoneName}"`);
  return zones[0].id;
}

async function zoneDomainName(zoneId, zoneName) {
  if (zoneName) return zoneName;
  const z = await cfJson(`/zones/${zoneId}`);
  return z.name;
}

/** Record label for API body (e.g. mynah) and FQDN for list queries. */
function normalizeName(zoneDomain, recordName) {
  const rn = recordName.trim().toLowerCase();
  const zd = zoneDomain.trim().toLowerCase();
  if (rn === zd || rn.endsWith(`.${zd}`)) {
    const label = rn === zd ? zd : rn.slice(0, -(zd.length + 1));
    return { label: label || "@", fqdn: rn === zd ? zd : rn };
  }
  return { label: rn, fqdn: `${rn}.${zd}` };
}

const server = new McpServer({
  name: "mynah-cloudflare-dns",
  version: "1.0.0",
});

server.tool(
  "zones_list",
  "List Cloudflare zones for this token. Optional filter by exact zone name.",
  {
    name: z.string().optional().describe("Exact zone name e.g. castalia.institute"),
  },
  async ({ name }) => {
    const q = name ? `?name=${encodeURIComponent(name)}` : "";
    const zones = await cfJson(`/zones${q}`);
    return {
      content: [{ type: "text", text: JSON.stringify(zones, null, 2) }],
    };
  }
);

server.tool(
  "dns_records_list",
  "List DNS records in a zone (optional type/name filters). Name filter uses FQDN e.g. mynah.castalia.institute.",
  {
    zoneId: z.string().optional(),
    zoneName: z.string().optional().describe("Zone apex e.g. castalia.institute"),
    type: z.string().optional().describe("A, CNAME, TXT, ..."),
    name: z.string().optional().describe("FQDN filter"),
  },
  async (args) => {
    const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
    const params = new URLSearchParams();
    if (args.type) params.set("type", args.type);
    if (args.name) params.set("name", args.name);
    const qs = params.toString();
    const records = await cfJson(`/zones/${zoneId}/dns_records${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(records, null, 2) }],
    };
  }
);

server.tool(
  "dns_cname_upsert",
  "Create or update a CNAME (typical GitHub Pages: recordName mynah → castaliainstitute.github.io). Default proxied=false.",
  {
    zoneName: z.string().optional(),
    zoneId: z.string().optional(),
    recordName: z
      .string()
      .describe("Subdomain label (mynah) or FQDN (mynah.castalia.institute)"),
    content: z
      .string()
      .describe("Target host e.g. castaliainstitute.github.io (no https://, no path)"),
    ttl: z.number().optional().default(1),
    proxied: z.boolean().optional().default(false),
  },
  async (args) => {
    const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
    const zoneDomain = await zoneDomainName(zoneId, args.zoneName);
    const { label, fqdn } = normalizeName(zoneDomain, args.recordName);

    const existing = await cfJson(
      `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fqdn)}`
    );

    const payload = {
      type: "CNAME",
      name: label === "@" ? zoneDomain : label,
      content: args.content.trim().replace(/^https?:\/\//, "").split("/")[0],
      ttl: args.ttl ?? 1,
      proxied: args.proxied ?? false,
    };

    let result;
    if (existing?.length) {
      const id = existing[0].id;
      result = await cfJson(`/zones/${zoneId}/dns_records/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      result = await cfJson(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ fqdn, payload, result }, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
