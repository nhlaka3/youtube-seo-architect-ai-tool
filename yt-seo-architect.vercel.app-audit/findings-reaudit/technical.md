# Technical SEO Re-Audit — yt-seo-architect.vercel.app (2026-08-05)

Score: **82/100** (prior audit 2026-08-03: 55/100)

Method: curl header/body inspection, 250-URL random sitemap sample (threaded), 120-URL glossary sample,
base64 decode of inline CSS, local source review (vercel.json, api/index.js, dist/).
No PageSpeed/CrUX data available (no API key; PSI rate-limited; CrUX not configured).

---

## ✅ Previously-fixed items — VERIFIED HOLDING

| # | Prior fix | Re-audit evidence | Status |
|---|-----------|-------------------|--------|
| 1 | Sitemap regenerated from live URLs | 250/250 random full-sitemap URLs → **200** (0 broken); 120/120 glossary sample → 200. Prior: 28.75% broken. `channel-optimization-for-small-channels` family (255 URLs, all 404) **purged from sitemap**. No soft-404 catch-all: `/glossary/zzz-this-term-definitely-does-not-exist-xyz987` → real 404, `/tools/nonexistent-tool-xyz` → 404, `/vs/nonexistent-vs` → 404 | ✅ FIXED |
| 2 | noindex URLs dropped from sitemap | `/dashboard`, `/changelog`, `/privacy-policy`, `/terms-of-service` absent from sitemap. `/about` still listed AND now `index, follow` (was noindex) — consistent | ✅ FIXED |
| 3 | /blog/generic-hero removed | Now returns **410 Gone** (was 200 placeholder) | ✅ FIXED |
| 4 | /guide fixed | `/guide` → **308 permanent** → `/guide/youtube-seo` (200, `index,follow`, self-canonical); `/guide/youtube-seo` in sitemap. (308, not 301 — semantically equivalent for Google; if strict 301 required, change `permanent: true` handling — note only) | ✅ FIXED |
| 5 | /pricing built | Real 200 page, `<title>Pricing — YT SEO Architect | 100% Free, No Limits</title>`, in sitemap | ✅ FIXED |
| 6 | Security headers added | Homepage/dashboard/pricing: `strict-transport-security: max-age=63072000; includeSubDomains; preload` ✅, `x-frame-options: SAMEORIGIN` ✅, `x-content-type-options: nosniff` ✅, `referrer-policy: strict-origin-when-cross-origin` ✅, full CSP ✅. `.well-known/security.txt` → 200, valid (Contact, Policy, Expires 2027-08-03) | ✅ FIXED |
| 7 | CSP whitelist for cdn.jsdelivr.net | vercel.json CSP now includes `cdn.jsdelivr.net` + `pagead2.googlesyndication.com`; homepage's Vite entry `main-DJ7GC5Xn.js` (Vercel Analytics injector, imports `https://cdn.jsdelivr.net/npm/@vercel/analytics@1/dist/index.mjs`) is no longer CSP-blocked | ✅ FIXED |
| 8 | robots.txt AI policy | ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider → `Allow: /`; GPTBot, CCBot → `Disallow: /`; `Sitemap:` line present | ✅ FIXED |
| 9 | llms.txt | 200, text/plain, 43,713 bytes | ✅ FIXED |
| 10 | sitemap changefreq/priority stripped | 0 occurrences in 17,763-URL sitemap (1.83MB, `application/xml`, `cache-control: max-age=3600`) | ✅ FIXED |

## 🔴 Remaining / NEW issues

### 1. HIGH — Homepage design-tokens stylesheet blocked by CSP (the reported console error #1)
- Evidence: homepage HTML ships `<link rel="stylesheet" href="data:text/css;base64,Lyog4pSA...">` (base64 decodes to the full `:root` design-token set: `--bg-page`, `--text-primary`, `--primary: #00f2ff`, etc.). The response CSP is `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com` — **`data:` is NOT allowed**, so the browser rejects the stylesheet (`'unsafe-inline'` does not cover data: URLs). Console error reproduced in render_page.py run; confirmed structurally.
- Root cause: `/assets/design-tokens.css` was deleted (now 404 — this is why console error #2's text/plain MIME is gone), and the replacement was an inline data: URL instead of the file that already exists: **`https://yt-seo-architect.vercel.app/design-tokens.css` → 200, `content-type: text/css`, 2,551 bytes** (served by vercel.json `builds` entry; api/index.js templates at lines 879/1107 already reference it correctly).
- Impact: `:root` tokens undefined on homepage → the inline `<style>` block (`background: var(--bg-page)`, `color: var(--text-primary)`) falls back to defaults; visual regression; token-driven theming broken.
- Fix: in the homepage template/build replace the data: URL with `<link rel="stylesheet" href="/design-tokens.css">` (and optionally add `data:` to `style-src` as belt-and-braces).

### 2. MEDIUM — lastmod still missing on glossary (prior fix #2 NOT applied)
- Only **49 / 17,763** URLs carry `<lastmod>` (blog posts + a few vs pages, all `2026-07-31`). All 17,682 glossary URLs lack lastmod. Glossary is the bulk of the sitemap and gets zero freshness signal.

### 3. MEDIUM — Sitemap ballooned +60% and is one flat 1.83MB file
- 11,096 → **17,763 URLs** (glossary 17,682 = 5,894 terms × 3 locale variants en/es/pt). All sampled URLs are live (0% broken), so the crawl-waste fix holds, but: (a) no sitemap index; (b) no lastmod (see #2); (c) thousands of thin, near-duplicate localized glossary pages consume crawl budget — verify indexation quality (onpage specialist) and consider `<xhtml:link hreflang>` alternates between locales.

### 4. LOW-MEDIUM — Inconsistent CSP across routes (two divergent policies)
- Static pages (/, /pricing, /dashboard, /tools/*, /vs/*) AND blog/glossary pages: vercel.json long CSP (includes `cdn.jsdelivr.net`, `www.gstatic.com`, `static.cloudflareinsights.com`).
- `robots.txt` and `/guide/youtube-seo`: **api/index.js helmet CSP** (api/index.js:246-274) — script-src lacks `cdn.jsdelivr.net`, `gstatic`, `static.cloudflareinsights.com`; also lacks `frame-ancestors`/`upgrade-insecure-requests` parity in the other direction. No current breakage (those routes don't load those hosts) but the policies will drift; any future script added to guide/robots routes silently breaks. Unify: make helmet CSP match vercel.json (or drop helmet CSP and rely on vercel.json).

### 5. LOW — No custom 404 page
- Missing pages return Vercel's default `The page could not be found` (text/plain, 26–79 bytes). A branded 404 with site links would retain crawlers/users.

### 6. LOW — /assets/* 404s cached immutable for 1 year
- `cache-control: public, max-age=31536000, immutable` is applied to **404 responses** too (verified on `/assets/design-tokens.css` and `/assets/definitely-missing-file-xyz.js`). Any deleted hashed asset → clients cache the 404 for a year. vercel.json header rule `"/assets/(.*)"` applies regardless of status. Recommend a `has`-conditioned rule or removing the rule in favor of Vercel's built-in immutable handling for hashed files.

### 7. LOW — HSTS max-age inconsistent
- HTML pages: `max-age=63072000` (Vercel platform default, preload). robots.txt/guide: `max-age=31536000` (helmet, preload). Both preload-eligible; unify to avoid ambiguity.

### 8. LOW — /dashboard canonical points to extension URL
- `<link rel="canonical" href="https://yt-seo-architect.vercel.app/dashboard.html">` while the page is served at `/dashboard` (noindex, so impact nil — tidy anyway).

### 9. INFO — robots.txt leftovers
- `Disallow: /_next/` (stale, harmless), `Disallow: /api/` applies to AI crawlers too (fine). Express serves robots.txt via rewrite → helmet CSP/HSTS — works.

## Evidence files
- Raw homepage HTML: `findings-reaudit/raw/homepage.html`
- Sitemap dump: `/tmp/sitemap.xml` (17,763 URLs; 49 lastmod; 0 changefreq/priority)
- vercel.json / api/index.js reviewed in workspace root (`/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/`)
- Scripts: `ucp_check.py` → no UCP profile (404; forward-looking opportunity, not required); `preload_check.py` → 50/100 (see performance.md); `consistency_check.py` cannot run (skills dir is not a git repo); `pagespeed_check.py`/`lcp_subparts.py` require API key (unavailable).

## Top recommended fixes (priority order)
1. Swap the CSP-blocked data: tokens link for `/design-tokens.css` (fixes console error #1 + visual regression).
2. Add lastmod to all glossary URLs in the sitemap generator.
3. Remove one of the two divergent CSP sources (align helmet CSP with vercel.json).
4. Custom 404 page; scope the /assets immutable rule to avoid caching 404s.
