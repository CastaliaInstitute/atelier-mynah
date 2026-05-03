# Mynah

Marketing and product site for Mynah (`mynah.castalia.institute`), maintained by [Castalia Institute](https://github.com/CastaliaInstitute).

Design specifications live under [`docs/design/`](docs/design/README.md).

## Codex build brief

The Codex-ready site brief (homepage copy, sections, positioning, visuals, image prompts, privacy copy, roadmap, SEO, implementation notes) lives in the Cursor canvas for this project. Export or paste that canvas into the repo (for example `docs/CODEX_BRIEF.md`) before handing off to Codex so the brief travels with the codebase.

## Repository

- **GitHub:** https://github.com/CastaliaInstitute/mynah

## GitHub Pages

Configured on **`main`** from **`/docs`** (legacy build). The publishing root includes [`docs/index.html`](docs/index.html), [`docs/CNAME`](docs/CNAME) (`mynah.castalia.institute`), and [`.nojekyll`](docs/.nojekyll) so static files are served as-is.

- **Project URL (redirects to the custom domain):** https://castaliainstitute.github.io/mynah/
- **Custom domain:** https://mynah.castalia.institute/ (works after the Cloudflare record below exists and DNS propagates)

In **Settings → Pages**, turn on **Enforce HTTPS** once GitHub finishes issuing a certificate for the custom domain.

## DNS (`mynah.castalia.institute`) — required

The apex domain uses Cloudflare nameservers. Add this record on zone **castalia.institute**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `mynah` | `castaliainstitute.github.io` | DNS only (grey cloud) until GitHub TLS validates; then optional orange-cloud |

Until this record exists, browsers following the `github.io` redirect may not load the site because GitHub sends traffic to `mynah.castalia.institute`.

See [`docs/infrastructure/cloudflare-dns.md`](docs/infrastructure/cloudflare-dns.md) for the same steps plus optional Cloudflare API commands.
