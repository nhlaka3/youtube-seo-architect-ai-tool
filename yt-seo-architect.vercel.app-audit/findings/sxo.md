# SXO — Search Experience Findings

## Evidence
- **/pricing → 307 redirect to /dashboard.html (noindex, nofollow)** — users searching "yt seo architect pricing" hit a login-gated app shell. Severe intent mismatch; site copy says "100% Free" yet a pricing destination exists.
- **/guide 404s** — any SERP pointing at the guide pillar breaks.
- Blog category pages (e.g. /blog/category/shorts) are 74–82-word stubs — thin search results for "[niche] youtube seo guide" queries.
- Tool pages are 109–172-word shells with H2=0 — shallow experience for "[tool name] for youtube seo" intents.
- Homepage H1 ("Your Videos Deserve More Views.100% Free AI YouTube SEO.") is keyword-weak for the "youtube seo tool" head term; title tag covers it instead.
- Glossary vs-pages (300–490 words) match comparison intent for "X vs Y" queries reasonably well and carry FAQPage.

## Fixes
1. Build a real indexable /pricing page (or 410 + remove all pricing references)
2. Fix or remove /guide; add real category pages
3. Expand tool pages with how-to + FAQ to match tool-comparison intent
4. Tighten homepage H1 to the head keyword
5. Keep expanding glossary vs pages (strong intent match, working schema)
