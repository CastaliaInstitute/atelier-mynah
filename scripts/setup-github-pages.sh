#!/usr/bin/env bash
# Configure GitHub Pages via gh (requires: gh auth login, repo admin).
# https://docs.github.com/rest/pages/pages
set -euo pipefail

OWNER="${OWNER:-CastaliaInstitute}"
REPO="${REPO:-mynah}"

echo "Target: ${OWNER}/${REPO}"
echo ""

if gh api "repos/${OWNER}/${REPO}/pages" >/dev/null 2>&1; then
  echo "Pages site already exists. Current settings:"
else
  echo "Creating Pages site (legacy build from main branch, /docs)..."
  gh api -X POST "repos/${OWNER}/${REPO}/pages" --input - <<EOF
{
  "build_type": "legacy",
  "source": {
    "branch": "main",
    "path": "/docs"
  }
}
EOF
  echo "Created."
fi

gh api "repos/${OWNER}/${REPO}/pages" \
  --jq '{status, html_url, build_type, source, cname, https_enforced, protected_domain_state}'

echo ""
echo "Custom domain is read from docs/CNAME in the default branch."
echo "After DNS resolves and GitHub issues a TLS certificate, enforce HTTPS:"
echo "  ./scripts/gh-pages-enforce-https.sh"
echo "(polls gh api PUT until GitHub accepts https_enforced — cert can lag DNS.)"
echo ""
echo "One-shot (fails until cert exists):"
echo "  gh api -X PUT repos/${OWNER}/${REPO}/pages --input - <<'EOF'"
echo '{'
echo '  "build_type": "legacy",'
echo '  "cname": "mynah.castalia.institute",'
echo '  "https_enforced": true,'
echo '  "source": { "branch": "main", "path": "/docs" }'
echo '}'
echo "EOF"
echo ""
echo "Optional: request a new build"
echo "  gh api -X POST repos/${OWNER}/${REPO}/pages/builds"
