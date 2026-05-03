# Cloudflare DNS for `mynah.castalia.institute`

Zone **castalia.institute** is on Cloudflare (nameservers `anirban.ns.cloudflare.com`, `deb.ns.cloudflare.com`).

This subdomain points at **GitHub Pages** for repo `CastaliaInstitute/mynah` (project site). The CNAME target must be **`castaliainstitute.github.io`** (apex `github.io`, not a path).

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
