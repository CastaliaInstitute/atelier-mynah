#!/usr/bin/env bash
# Ensure Cloudflare DNS for GitHub Pages custom hostname mynah.castalia.institute.
#
# Wrangler does not expose DNS record CRUD; Cloudflare expects the REST API for zone
# DNS. This script uses the same credential mechanism as Wrangler deploy: set
# CLOUDFLARE_API_TOKEN with Zone → DNS → Edit on zone castalia.institute (and Zone →
# Zone → Read to resolve the zone id). Then run this script after `wrangler login` if
# you like — `wrangler whoami` is only a sanity check on which account you are using.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN='...'   # API token, not OAuth-only Wrangler login
#   ./scripts/ensure-mynah-dns.sh
#
set -euo pipefail

ZONE_NAME="${ZONE_NAME:-castalia.institute}"
RECORD_NAME="${RECORD_NAME:-mynah}"
CNAME_TARGET="${CNAME_TARGET:-castaliainstitute.github.io}"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler not found; install: npm i -g wrangler" >&2
  exit 1
fi

echo "=== wrangler whoami (CLI session) ==="
wrangler whoami || true
echo ""

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN." >&2
  echo "Create an API token: Dashboard → My Profile → API Tokens → Create Token." >&2
  echo "Permissions: Zone → DNS → Edit (and Zone → Zone → Read) for castalia.institute." >&2
  echo "OAuth from \`wrangler login\` alone usually cannot create DNS records." >&2
  exit 1
fi

API="https://api.cloudflare.com/client/v4"

zone_resp="$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "${API}/zones?name=${ZONE_NAME}")"

zone_id="$(python3 -c 'import json,sys; j=json.load(sys.stdin); r=j.get("result") or []; print(r[0]["id"] if r else "")' <<<"$zone_resp")"

if [[ -z "$zone_id" ]]; then
  echo "Could not resolve zone id for ${ZONE_NAME}. Check token scope and zone name." >&2
  echo "$zone_resp" >&2
  exit 1
fi

echo "Zone ${ZONE_NAME} id: ${zone_id}"

list_resp="$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "${API}/zones/${zone_id}/dns_records?type=CNAME&name=${RECORD_NAME}.${ZONE_NAME}")"

record_id="$(python3 -c 'import json,sys; j=json.load(sys.stdin); r=j.get("result") or []; print(r[0]["id"] if r else "")' <<<"$list_resp")"

payload="$(RECORD_NAME="$RECORD_NAME" CNAME_TARGET="$CNAME_TARGET" python3 -c '
import json, os
print(json.dumps({
  "type": "CNAME",
  "name": os.environ["RECORD_NAME"],
  "content": os.environ["CNAME_TARGET"],
  "ttl": 1,
  "proxied": False,
}))
')"

if [[ -n "$record_id" ]]; then
  echo "Updating existing CNAME ${RECORD_NAME}.${ZONE_NAME} -> ${CNAME_TARGET}"
  curl -fsS -X PATCH "${API}/zones/${zone_id}/dns_records/${record_id}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload" | python3 -m json.tool
else
  echo "Creating CNAME ${RECORD_NAME}.${ZONE_NAME} -> ${CNAME_TARGET}"
  curl -fsS -X POST "${API}/zones/${zone_id}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$payload" | python3 -m json.tool
fi

echo ""
echo "Verify:"
echo "  dig +short ${RECORD_NAME}.${ZONE_NAME} CNAME"
echo "Then in GitHub: Settings → Pages → recheck custom domain / Enforce HTTPS."
