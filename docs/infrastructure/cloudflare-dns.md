# Cloudflare DNS for `mynah.castalia.institute`

Zone **castalia.institute** is on Cloudflare (nameservers `anirban.ns.cloudflare.com`, `deb.ns.cloudflare.com`).

This subdomain points at **GitHub Pages** for repo `CastaliaInstitute/mynah` (project site). The CNAME target must be **`castaliainstitute.github.io`** (apex `github.io`, not a path).

## Wrangler + DNS (recommended automation)

**Wrangler has no `dns` command** — it targets Workers, KV, Pages deploy, etc. Zone DNS records are created with the **Cloudflare REST API**. Wrangler itself uses a **`CLOUDFLARE_API_TOKEN`** for many operations when that variable is set (see [Workers docs — API token](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token)).

1. Keep **`wrangler login`** if you use Workers/Pages locally; run **`wrangler whoami`** to confirm the account.
2. Create a separate **API token** (Dashboard → My Profile → API Tokens) with **Zone → DNS → Edit** and **Zone → Zone → Read** on **`castalia.institute`** (or the whole account if you accept broader scope).
3. Run the repo script (upserts the CNAME, **DNS only / not proxied**):

```bash
export CLOUDFLARE_API_TOKEN='…'
./scripts/ensure-mynah-dns.sh
```

OAuth from `wrangler login` alone usually lists **`zone (read)`** and **cannot** create records; the API token is required for step 3.

## Cursor MCP (this repo): `mynah-cloudflare-dns`

This repository ships a small stdio MCP server for **domains on Cloudflare** (zones + DNS):

- Path: **`mcp/cloudflare-dns/`** (`index.mjs`)
- **Accounts:** **`accounts_list`**
- **Zones (add/remove/setup):** **`zones_create`**, **`zones_list`**, **`zones_nameservers`**, **`zones_delete`** (requires `confirmationDomain`)
- **DNS:** **`dns_records_list`**, **`dns_record_upsert`** (A, AAAA, CNAME, TXT, MX), **`dns_cname_upsert`**, **`dns_record_delete`**

**API token:** Use a token whose scopes match what you call. Examples:

- **Only DNS on existing zones:** Zone → DNS → Edit, Zone → Zone → Read.
- **Add new domains (zones_create):** include **Zone → Zone → Edit** (and usually **Account → Account Settings → Read** so `accounts_list` / default account work).

Flow for a **new** domain: **`zones_create`** → set registrar NS to returned **`name_servers`** → wait for **active** → **`dns_record_upsert`** / **`dns_cname_upsert`** as needed (e.g. GitHub Pages).

### Cursor `mcp.json` snippet

Add under `mcpServers` (adjust paths if your clone location differs):

```json
"mynah-cloudflare-dns": {
  "command": "node",
  "args": [
    "/Users/danielmcshan/GitHub/CastaliaInstitute/mynah/mcp/cloudflare-dns/index.mjs"
  ],
  "cwd": "/Users/danielmcshan/GitHub/CastaliaInstitute/mynah/mcp/cloudflare-dns",
  "envFile": "/Users/danielmcshan/GitHub/CastaliaInstitute/mynah/mcp/cloudflare-dns/.env.local"
}
```

Then:

```bash
cd mcp/cloudflare-dns && npm install
cp .env.example .env.local
# edit .env.local — set CLOUDFLARE_API_TOKEN
```

Restart Cursor. From chat you can ask to call **`dns_cname_upsert`** with e.g. `zoneName: castalia.institute`, `recordName: mynah`, `content: castaliainstitute.github.io`, `proxied: false`.

### Official `@cloudflare/mcp-server-cloudflare`

The **`user-cloudflare-api`** / npm **`@cloudflare/mcp-server-cloudflare`** bundle exposes Workers, KV, R2, **zones list/get**, routes, etc., but **still no DNS record tools** in current releases. Use this repo’s **`mynah-cloudflare-dns`** MCP for DNS, or the **dashboard**, **`./scripts/ensure-mynah-dns.sh`**, or **`curl`** against the [DNS Records API](https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/create/).

## Dashboard (fastest)

1. Cloudflare → **castalia.institute** → **DNS** → **Records** → **Add record**.
2. **Type:** CNAME  
   **Name:** `mynah`  
   **Target:** `castaliainstitute.github.io`  
   **TTL:** Auto.  
   **Proxy:** DNS only (grey cloud) while GitHub validates the custom domain and issues TLS; then optional orange-cloud proxy.

## API (optional)

With a Cloudflare API token (`Zone.DNS:Edit` on this zone), create the record:

```bash
# Set ZONE_ID from: curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
#   "https://api.cloudflare.com/client/v4/zones?name=castalia.institute" | jq -r '.result[0].id'

curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "CNAME",
    "name": "mynah",
    "content": "castaliainstitute.github.io",
    "ttl": 1,
    "proxied": false
  }'
```

Replace `content` with your actual hosting CNAME target if not GitHub Pages.

## GitHub shows `InvalidDNSError` / “DNS record could not be retrieved”

GitHub asks the public DNS for your hostname. If **no record exists**, verification fails with **InvalidDNSError**.

**Check from your machine** (should **not** be empty once configured):

```bash
dig +short mynah.castalia.institute CNAME
# expect: castaliainstitute.github.io.
```

Querying Cloudflare’s authoritative nameserver directly (replace `deb` with `anirban` if you prefer):

```bash
dig mynah.castalia.institute CNAME +norecurse @deb.ns.cloudflare.com
```

If the status is **NXDOMAIN** or the answer section is **empty**, the **`mynah` record is missing** (or you’re editing DNS in the wrong Cloudflare account / wrong zone). Add the CNAME in the zone that serves **`castalia.institute`**, name **`mynah`**, target **`castaliainstitute.github.io`**.

**Proxy:** keep **DNS only** (grey cloud) until GitHub accepts the domain and HTTPS is working; orange-cloud proxy can interfere with GitHub’s checks or TLS in some setups.

After DNS resolves, re-check **Repository → Settings → Pages → Custom domain** and click **Save** if GitHub still shows an error.
