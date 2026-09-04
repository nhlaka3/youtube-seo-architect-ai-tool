# Sitemap Findings (part of Technical SEO, 55/100)

## Evidence
- **11,096 URLs** in sitemap.xml (1.86MB)
  - /glossary/ ×10,986 (incl. EN/ES/PT)
  - /blog/ ×58 (+2 category hubs)
  - /tools/ ×37
  - /vs/ ×6
  - core: /, /dashboard, /about, /changelog, /privacy-policy, /terms-of-service
- **~29% broken**: 23/80 random glossary URLs → HTTP 404 (~3,160 extrapolated); `channel-optimization-for-small-channels*` family = 255 dead URLs
- **5 noindex URLs listed**: /dashboard, /about, /changelog, /privacy-policy, /terms-of-service
- **lastmod on only 49/11,096** URLs (0.4%)
- /guide present in llms references but 404 on site; /blog/generic-hero live (16b placeholder) not in sitemap

## Fixes
1. Generate sitemap from live-verified URLs only (drops ~3,000 dead entries)
2. Exclude noindex pages
3. Add lastmod (+changefreq) for glossary
4. Add CI validation (broken-link + noindex sweep) before deploy
