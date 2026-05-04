#!/usr/bin/env bash
# Turn on GitHub Pages "Enforce HTTPS" via gh once GitHub has provisioned a TLS cert
# for the custom domain (may lag DNS by minutes).
#
# Requires: gh auth login, admin on the repo.
# Optional: DIG_DOMAIN — default checks CNAME for mynah.castalia.institute
#
set -euo pipefail

OWNER="${OWNER:-CastaliaInstitute}"
REPO="${REPO:-mynah}"
FULL="${OWNER}/${REPO}"
CN="${CUSTOM_DOMAIN:-mynah.castalia.institute}"
DIG_DOMAIN="${DIG_DOMAIN:-mynah.castalia.institute}"
SLEEP_SEC="${SLEEP_SEC:-90}"
MAX_TRIES="${MAX_TRIES:-40}"

echo "Target repo: ${FULL}"
echo "Custom domain: ${CN}"
echo ""

if command -v dig >/dev/null 2>&1; then
  c="$(dig +short "${DIG_DOMAIN}" CNAME | head -1)"
  if [[ -z "${c}" ]]; then
    echo "WARN: dig shows no CNAME for ${DIG_DOMAIN} — fix DNS before HTTPS can work." >&2
  else
    echo "DNS CNAME ${DIG_DOMAIN} -> ${c}"
  fi
fi

echo ""
echo "Polling: PUT pages with https_enforced=true (sleeps ${SLEEP_SEC}s between tries, max ${MAX_TRIES})."
echo "If this keeps failing, GitHub may still be issuing the certificate—wait and re-run."
echo ""

body="$(mktemp)"
cat >"${body}" <<EOF
{
  "build_type": "legacy",
  "cname": "${CN}",
  "https_enforced": true,
  "source": {
    "branch": "main",
    "path": "/docs"
  }
}
EOF

errlog="$(mktemp)"
trap 'rm -f "${body}" "${errlog}"' EXIT

for ((i = 1; i <= MAX_TRIES; i++)); do
  echo "--- try ${i}/${MAX_TRIES} ---"
  if gh api -X PUT "repos/${FULL}/pages" --input "${body}" 2>"${errlog}"; then
    echo ""
    echo "HTTPS enforcement enabled."
    gh api "repos/${FULL}/pages" --jq '{html_url, https_enforced, cname, status}'
    exit 0
  fi
  if [[ -s "${errlog}" ]]; then
    head -3 "${errlog}" >&2 || true
  fi
  sleep "${SLEEP_SEC}"
done

echo ":: Failed after ${MAX_TRIES} tries. Last gh error:" >&2
cat "${errlog}" >&2 || true
exit 1
