# Technical SEO Findings (score 55/100)

## Evidence
- Sitemap: 11,096 URLs (1.86MB) — glossary 10,986 · blog 58 · tools 37 · vs 6 · core 6
- 80-URL glossary sample: **404 ×23, 200 ×57 (28.75% broken)**
- `channel-optimization-for-small-channels*` family: **255 URLs, all 404**
- lastmod present on only **49/11,096** URLs
- 5 noindex core URLs in sitemap: /dashboard, /about, /changelog, /privacy-policy, /terms-of-service
- headers: HSTS preload ✅ · **missing X-Frame-Options, nosniff, Referrer-Policy** ❌
- `/blog/generic-hero` = 200 (16b placeholder); `/guide` = 404; `/pricing` → 307 → noindex dashboard
- robots.txt ✅ (AI crawlers allowed, GPTBot/CCBot blocked)
- Console (Playwright): CSP violation blocking `cdn.jsdelivr.net` @vercel/analytics

## Prior-state comparison
- Glossary 500 bug: FIXED (was ~6,400 of 8,328)
- Sitemap broken share: ~96% → ~29%
- llms.txt / llms-full.txt: 404 → 200 (33KB)

## Fixes
1. Regenerate sitemap from live URLs only (biggest single lever)
2. Add lastmod to glossary entries
3. Drop noindex URLs from sitemap
4. Add security headers + security.txt
5. Whitelist cdn.jsdelivr.net + pagead2.googlesyndication.com in CSP
6. Delete/noindex /blog/generic-hero; fix /guide; build real /pricing
