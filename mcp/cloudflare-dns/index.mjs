/**
 * MCP server: Cloudflare domains & DNS — zones (add/remove), nameservers, records.
 *
 * Token permissions (typical):
 * - Zone → Zone → Read/Edit (create/delete zones needs Edit on account zones)
 * - Zone → DNS → Edit (records)
 * - Account → Account Settings → Read (accounts_list; optional for zone create)
 *
 * Create an API token in Dashboard → API Tokens with scopes matching what you use.
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

async function defaultAccountId(explicit) {
  if (explicit) return explicit;
  const accounts = await cfJson("/accounts?page=1&per_page=50");
  if (!accounts?.length) {
    throw new Error(
      "No Cloudflare accounts visible to this token; pass accountId to zones_create."
    );
  }
  return accounts[0].id;
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

async function upsertDnsRecord(args) {
  const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
  const zoneDomain = await zoneDomainName(zoneId, args.zoneName);
  const { label, fqdn } = normalizeName(zoneDomain, args.recordName);

  const type = args.type;
  const existing = await cfJson(
    `/zones/${zoneId}/dns_records?type=${encodeURIComponent(type)}&name=${encodeURIComponent(fqdn)}`
  );

  const apiName = label === "@" ? zoneDomain : label;
  const content = args.content.trim().replace(/^https?:\/\//, "").split("/")[0];

  /** @type {Record<string, unknown>} */
  const payload = {
    type,
    name: apiName,
    content,
    ttl: args.ttl ?? 1,
  };

  if (["A", "AAAA", "CNAME"].includes(type)) {
    payload.proxied = args.proxied ?? false;
  }

  if (type === "MX") {
    payload.priority = args.mxPriority ?? 10;
    payload.content = args.content.trim();
    delete payload.proxied;
  }

  if (type === "TXT") {
    delete payload.proxied;
  }

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

  return { fqdn, payload, result, zoneId, zoneDomain };
}

const server = new McpServer({
  name: "mynah-cloudflare-dns",
  version: "1.1.0",
});

server.tool(
  "accounts_list",
  "List Cloudflare accounts visible to this token (pick accountId for zones_create).",
  {},
  async () => {
    const accounts = await cfJson("/accounts?page=1&per_page=50");
    return {
      content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }],
    };
  }
);

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
  "zones_create",
  "Add a root domain as a new Cloudflare zone. Returns name_servers to set at your registrar.",
  {
    domain: z
      .string()
      .describe("Apex domain e.g. example.com (no subdomain, no trailing dot)"),
    accountId: z
      .string()
      .optional()
      .describe("Cloudflare account id; defaults to first account from accounts_list"),
    jump_start: z
      .boolean()
      .optional()
      .default(false)
      .describe("Attempt to fetch existing DNS records from nameservers"),
    zoneType: z
      .enum(["full", "partial"])
      .optional()
      .default("full")
      .describe("full = authoritative DNS at Cloudflare; partial = CNAME setup"),
  },
  async (args) => {
    const accountId = await defaultAccountId(args.accountId);
    const zone = await cfJson("/zones", {
      method: "POST",
      body: JSON.stringify({
        name: args.domain.trim().toLowerCase().replace(/\.$/, ""),
        account: { id: accountId },
        jump_start: args.jump_start ?? false,
        type: args.zoneType ?? "full",
      }),
    });

    const summary = {
      zone_id: zone.id,
      zone_name: zone.name,
      status: zone.status,
      type: zone.type,
      name_servers: zone.name_servers,
      next_steps: [
        "At your DNS registrar for this domain, replace nameservers with name_servers (unless using partial/CNAME setup).",
        "Wait until zone status is active in Cloudflare.",
        "Add records with dns_record_upsert or dns_cname_upsert (e.g. GitHub Pages CNAME).",
      ],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  "zones_nameservers",
  "Show delegation nameservers and status for a zone (what registrars should use).",
  {
    zoneId: z.string().optional(),
    zoneName: z.string().optional(),
  },
  async (args) => {
    const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
    const z = await cfJson(`/zones/${zoneId}`);
    const out = {
      id: z.id,
      name: z.name,
      status: z.status,
      paused: z.paused,
      type: z.type,
      name_servers: z.name_servers,
      original_name_servers: z.original_name_servers,
      original_registrar: z.original_registrar,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
    };
  }
);

server.tool(
  "zones_delete",
  "Remove a zone from Cloudflare (destructive). confirmationDomain must equal the zone apex.",
  {
    zoneId: z.string().optional(),
    zoneName: z.string().optional(),
    confirmationDomain: z
      .string()
      .describe("Must exactly match zone apex e.g. example.com"),
  },
  async (args) => {
    const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
    const z = await cfJson(`/zones/${zoneId}`);
    const want = args.confirmationDomain.trim().toLowerCase().replace(/\.$/, "");
    if (z.name !== want) {
      throw new Error(
        `confirmationDomain "${want}" does not match zone.name "${z.name}" — refusing delete`
      );
    }
    await cfJson(`/zones/${zoneId}`, { method: "DELETE" });
    return {
      content: [
        {
          type: "text",
          text: `Deleted zone ${z.name} (id ${zoneId}).`,
        },
      ],
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
  "dns_record_upsert",
  "Create or update a DNS record: A, AAAA, CNAME, TXT, or MX (use mxPriority for MX).",
  {
    zoneName: z.string().optional(),
    zoneId: z.string().optional(),
    type: z.enum(["A", "AAAA", "CNAME", "TXT", "MX"]),
    recordName: z
      .string()
      .describe("Subdomain label (www) or FQDN (www.example.com); use @ apex via apex label if supported"),
    content: z.string().describe("Target IP, hostname, TXT value, or MX host"),
    ttl: z.number().optional().default(1),
    proxied: z
      .boolean()
      .optional()
      .default(false)
      .describe("Only applies to A, AAAA, CNAME"),
    mxPriority: z.number().optional().describe("Required semantics for MX; default 10"),
  },
  async (args) => {
    const data = await upsertDnsRecord(args);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "dns_cname_upsert",
  "Create or update a CNAME (GitHub Pages: recordName mynah → castaliainstitute.github.io). Default proxied=false.",
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
    const data = await upsertDnsRecord({ ...args, type: "CNAME" });
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  "dns_record_delete",
  "Delete DNS record(s) matching zone + type + FQDN name.",
  {
    zoneId: z.string().optional(),
    zoneName: z.string().optional(),
    type: z.string().describe("A, CNAME, TXT, ..."),
    name: z.string().describe("Full record name e.g. mynah.castalia.institute"),
  },
  async (args) => {
    const zoneId = await resolveZoneId(args.zoneName, args.zoneId);
    const records = await cfJson(
      `/zones/${zoneId}/dns_records?type=${encodeURIComponent(args.type)}&name=${encodeURIComponent(args.name.trim())}`
    );
    if (!records?.length) {
      return {
        content: [{ type: "text", text: "No matching records to delete." }],
      };
    }
    const deleted = [];
    for (const r of records) {
      await cfJson(`/zones/${zoneId}/dns_records/${r.id}`, { method: "DELETE" });
      deleted.push({ id: r.id, name: r.name, type: r.type });
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ deleted }, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
