# ACTION PLAN — yt-seo-architect.vercel.app

Health Score: 59/100 · Audit: 2026-07-31 · Priorities: Critical > High > Medium > Low

---

## Phase 1: Critical Fixes (Week 1)

1. **Fix or remove the 8,328 /glossary/*-vs-* pages** (~6,400 currently HTTP 500).
   - Root cause: serverless lookup crashes on missing term data (`Cannot read properties of undefined (reading 'slug')`).
   - Fix the lookup OR return 410 for unbuildable pairs; meanwhile **remove all vs-URLs from sitemap.xml** and from glossary "related" blocks. (Recovers ~96% of the broken sitemap.)
2. **Fix blog JSON-LD escaping** — unescaped HTML in JSON strings breaks Article+FAQPage on most new posts. Use a proper JSON encoder (json_encode / htmlspecialchars) in the template.
3. **Reconcile the sitemap**: remove 5 noindex URLs (/dashboard, /about, /privacy-policy, /terms-of-service, /changelog); add the 15 missing live blog posts + 17 live interactive tools; add `<lastmod>`; submit via IndexNow/Google SC after deploy.
4. **Fix homepage 404 links** — 17 `/tools/tag-generator/{niche}` links: generate the pages or 301 to /tools/tag-generator.
5. **Fix Organization `logo` (logo.svg → 404)** on all templates; point at working og-image.png.
6. **Pull or rewrite the 14 bulk-AI posts** with fabricated "studies" — replace with real data + named author, or unpublish until human-reviewed. This is the top scaled-content-abuse risk.
7. **Add llms.txt + llms-full.txt** (currently 404) — product summary, free pricing, glossary topic index.

## Phase 2: High-Impact Improvements (Weeks 2–3)

8. **Resolve /blog ↔ /tools cannibalization**: 25+ identical slug pairs, both indexable. Decide one home per keyword (recommend /blog/ for articles, /tools/ only for interactive tools); 301 or canonical the losers; fix the /tools/ sitemap section (84% articles).
9. **Build a real /pricing page** (indexable): features, free vs premium tiers, FAQ. Remove the leftover pricing modal on the "100% free" homepage; remove the "Free & Unlimited Overhaul" CSS force-unlock stylesheet in /dashboard.
10. **E-E-A-T pass**: named founder/author on About (make it indexable), consistent bylines, legal entity in privacy/ToS, non-Gmail contact, remove fabricated metrics ("30-50% CTR", "10,000+ titles", empty "Trusted by" section), add citations/sources to claims.
11. **On-page fixes**: trim titles to ≤60 chars (198/500 >60, 79 >70); fix "2026 2026" bug; add meta descriptions to tool templates; fix 15x H1 on one post; fix blog hub "0 words" index bug.
12. **Header/redirect hygiene**: canonical .html round-trips (/tools → /tools.html → 308; /dashboard → /dashboard.html); noindex /blog/_TEMPLATE (live with placeholders); unify security headers (XFO, nosniff, Referrer-Policy, HSTS) across routes; fix /contact.html 404 and stale /public/tools links.
13. **Add schema**: ItemList/BreadcrumbList on /blog, /tools, /glossary hubs; DefinedTerm on glossary terms; drop SearchAction → /dashboard?q= (login-gated).

## Phase 3: Content & Authority (Month 2)

14. **Tool pages depth**: 16/21 tools are 98–180-word shells (one renders "undefined") — add how-to, examples, FAQ, meta; internal-link tools ↔ related glossary terms ↔ blog posts (hub-and-spoke).
15. **Glossary improvements**: replace boilerplate "How to Optimize" blocks with per-term content; fix "Related Blog Posts" dead links; lower readability (FK 14–16 → ≤10); update "75+ terms" hub copy.
16. **Topic gaps**: monetization (3 posts), community management (1 post), Shorts SEO (1 giant 38k-word post — split/expand); add category pillar pages; interlink /vs/ section + /guide pillar (currently orphaned).
17. **Performance**: replace lucide unpkg dependency (bundle it); self-host blog hero images (kill picsum.photos); fix CSP-vs-analytics mismatch; re-measure CWV (CrUX via GSC + Lighthouse on a real machine).
18. **AI-search polish**: clean TL;DR "Direct Answer" blocks of keyword-stuffed artifacts; add security.txt; consistent "YouTube" casing; keep FAQPage (no rich results, but feeds AI answers).

## Phase 4: Monitoring & Iteration (Ongoing)

19. **Connect Google APIs**: GSC (indexation + CrUX field data), GA4 (organic traffic), Indexing API — closes the biggest data gap in this audit.
20. **Backlink program** (domain absent from Common Crawl — essentially no measurable link graph): GitHub repos, tool directories, HARO/PR, social profiles with consistent NAP/name ("YT SEO Architect" everywhere).
21. **Publishing workflow guardrails**: human review + fact-check gate for blog posts; sitemap auto-regeneration on publish; automated broken-link checker (the vs-page bug and 404/410 links should have been caught by CI).
22. **Re-audit in 60 days**; add drift baseline now (seo-drift) so future audits can measure change.
