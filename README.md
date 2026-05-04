# Mynah

Marketing and product site for Mynah (`mynah.castalia.institute`), maintained by [Castalia Institute](https://github.com/CastaliaInstitute).

Design specifications live under [`docs/design/`](docs/design/README.md). Technology baselines (evaluated platforms such as Music Assistant) live under [`docs/technology/`](docs/technology/README.md).

## Codex build brief

The Codex-ready site brief (homepage copy, sections, positioning, visuals, image prompts, privacy copy, roadmap, SEO, implementation notes) lives in the Cursor canvas for this project. Export or paste that canvas into the repo (for example `docs/CODEX_BRIEF.md`) before handing off to Codex so the brief travels with the codebase.

## Repository

- **GitHub:** https://github.com/CastaliaInstitute/mynah

## GitHub Pages

Configured on **`main`** from **`/docs`** (legacy build). The publishing root includes [`docs/index.html`](docs/index.html), [`docs/CNAME`](docs/CNAME) (`mynah.castalia.institute`), and [`.nojekyll`](docs/.nojekyll) so static files are served as-is. There is no `gh pages` subcommand; use [`scripts/setup-github-pages.sh`](scripts/setup-github-pages.sh) (wraps `gh api`) to create or print the current Pages config, and `gh api -X POST repos/CastaliaInstitute/mynah/pages/builds` to queue a rebuild.

- **Project URL (redirects to the custom domain):** https://castaliainstitute.github.io/mynah/
- **Custom domain:** https://mynah.castalia.institute/ (works after the Cloudflare record below exists and DNS propagates)

Once GitHub has provisioned a certificate for the custom domain, enable **Enforce HTTPS** from the CLI with [`scripts/gh-pages-enforce-https.sh`](scripts/gh-pages-enforce-https.sh) (polls `gh api` until the API accepts `https_enforced`), or toggle it under **Settings → Pages**.

## DNS (`mynah.castalia.institute`) — required

The apex domain uses Cloudflare nameservers. Add this record on zone **castalia.institute**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `mynah` | `castaliainstitute.github.io` | DNS only (grey cloud) until GitHub TLS validates; then optional orange-cloud |

Until this record exists, browsers following the `github.io` redirect may not load the site because GitHub sends traffic to `mynah.castalia.institute`.

See [`docs/infrastructure/cloudflare-dns.md`](docs/infrastructure/cloudflare-dns.md).

**Apply the CNAME:** use the Cloudflare dashboard, run [`scripts/ensure-mynah-dns.sh`](scripts/ensure-mynah-dns.sh) with `CLOUDFLARE_API_TOKEN`, use the **`mynah-cloudflare-dns`** MCP (`dns_cname_upsert`) with `.env.local`, or **GitHub Actions**: add repo secret `CLOUDFLARE_API_TOKEN`, then run workflow [**Ensure mynah DNS**](.github/workflows/ensure-mynah-dns.yml) via *Actions → Ensure mynah DNS → Run workflow*.
