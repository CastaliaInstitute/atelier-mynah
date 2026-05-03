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
