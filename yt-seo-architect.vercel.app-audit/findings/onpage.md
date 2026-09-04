# On-Page SEO Findings (score 62/100)

## Evidence (50-URL probe)
- H1 count: 1 on nearly all pages (1 post = 6)
- Meta description: present on **49/50** sampled (missing: /tools/description-writer)
- Title lengths: blog **62–96 chars** (8/14 >60) · tools **63–94** · glossary 47–69 · vs 51–58
- Canonical tags: present on core + content pages
- Homepage: 1 H1, 10 H2, 26 H3, 50 internal links, 0 images
- **Alt-attribute corruption**: hero alt on some posts contains raw `<a href="/glossary/...">` HTML (glossary-link injection into attributes)
- **24 identical blog/tools slugs** (both indexable) — cannibalization
- Googlebot vs default UA: identical 71,800-byte HTML (no SPA wall)

## Fixes
1. Fix glossary-link injector to skip attributes (critical HTML validity)
2. 301/canonical 24 cannibalized pairs
3. Trim titles to ≤60 chars in generators
4. Enforce 120–160 char meta descriptions everywhere
