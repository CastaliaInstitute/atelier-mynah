# Mynah

Marketing and product site for Mynah (`mynah.castalia.institute`), maintained by [Castalia Institute](https://github.com/CastaliaInstitute).

Design specifications live under [`docs/design/`](docs/design/README.md).

## Codex build brief

The Codex-ready site brief (homepage copy, sections, positioning, visuals, image prompts, privacy copy, roadmap, SEO, implementation notes) lives in the Cursor canvas for this project. Export or paste that canvas into the repo (for example `docs/CODEX_BRIEF.md`) before handing off to Codex so the brief travels with the codebase.

## Repository

- **GitHub:** https://github.com/CastaliaInstitute/mynah

## DNS (`mynah.castalia.institute`)

The apex domain uses Cloudflare nameservers (`castalia.institute` → Cloudflare). Add a DNS record in the Cloudflare dashboard for zone **castalia.institute**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `mynah` | Your hosting target (see below) | DNS only or proxied per your TLS/setup |

**If you use GitHub Pages** for this repository (project site):

1. Repository **Settings → Pages**: set source (e.g. GitHub Actions or `main` + `/docs` or root `/`).
2. **Settings → Pages → Custom domain:** `mynah.castalia.institute` (adds the Enforce HTTPS checkbox after validation).
3. Cloudflare **CNAME** `mynah` → `castaliainstitute.github.io` (DNS only is typical until GitHub validates; you can enable the orange proxy after certificates succeed if desired).

**If you use another host** (Vercel, Netlify, Cloudflare Pages): set the CNAME target to the hostname that provider gives you for the custom domain, then complete their custom-domain flow.

See [`docs/infrastructure/cloudflare-dns.md`](docs/infrastructure/cloudflare-dns.md) for API/token automation if you prefer not to use the dashboard.
