# FULL SEO AUDIT REPORT — yt-seo-architect.vercel.app

Audit date: 2026-07-31 · Crawl: 500 pages (BFS, robots.txt respected, 5 concurrent, 1s delay) · Live verification: ~120 additional requests
Sitemap: 8,667 URLs · Business type detected: **SaaS — free AI YouTube SEO tool (SoftwareApplication) with pSEO glossary**

## Executive Summary

### SEO Health Score: 59 / 100

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Technical SEO | 58 | 22% | 12.8 |
| Content Quality | 45 | 23% | 10.4 |
| On-Page SEO | 62 | 20% | 12.4 |
| Schema / Structured Data | 50 | 10% | 5.0 |
| Performance (CWV) | 70* | 10% | 7.0 |
| AI Search Readiness | 72 | 10% | 7.2 |
| Images | 80 | 5% | 4.0 |
| **Total** | | | **58.7 → 59** |

\* Performance is an **estimate** from architecture signals (SSR, Vercel CDN, br, preconnect, HSTS). PSI API daily quota was exhausted and local Lighthouse (Unlighthouse) timed out on WSL — no field/lab CWV numbers could be captured this run. Connect GSC/CrUX for real data.

### Top 5 Critical Issues
1. **~6,400 of 8,328 `/glossary/*-vs-*` URLs return HTTP 500** (server bug: `Cannot read properties of undefined (reading 'slug')`); 77% of sampled vs-URLs broken, and all are in the sitemap — the sitemap is ~96% broken URLs and internal link equity drains into error pages.
2. **Blog JSON-LD is broken on most new posts** — unescaped raw HTML inside JSON strings makes the blocks unparseable (2 of 3 sampled); Article+FAQPage rich results fail to register.
3. **14 bulk-AI blog posts (published 7/27–7/30) contain fabricated "research" claims** ("we studied 15 channels… 1 billion views"), broken grammar, mismatched authorship — scaled content abuse risk; also absent from the sitemap.
4. **/pricing serves the dashboard app shell, not a pricing page** (noindex, no pricing content) — navigational intent dead-ends; nav has no Pricing link.
5. **E-E-A-T vacuum**: anonymous ownership, brand-only bylines, fabricated performance claims ("30-50% CTR improvement", "10,000+ titles analyzed"), empty "Trusted by YouTube Creators" section, personal Gmail as the only contact, About/privacy/terms noindexed.

### Top 5 Quick Wins
1. Fix the vs-page server bug (missing term data lookup) or drop the 8.3k vs-URLs from the sitemap until fixed — instantly removes ~96% of error URLs from crawl budget.
2. Add `llms.txt` / `llms-full.txt` (both currently 404) — the biggest missing AI-search asset.
3. Fix `logo.svg` 404 referenced by Organization schema on the homepage and all 8,571 glossary pages.
4. Reconcile sitemap: remove 5 noindex pages (/dashboard, /about, /privacy-policy, /terms-of-service, /changelog), add 15 live blog posts + 17 live tools, add `<lastmod>`.
5. Fix blog JSON-LD escaping + the "2026 2026" title bug + duplicate canonical tags.

---

## 1. Technical SEO (58/100)

### What Works
- robots.txt is exemplary: AI search crawlers (ChatGPT-User, Google-Extended, PerplexityBot, Claude-Web, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider) allowed; GPTBot/CCBot blocked; `/api/`, `/admin/`, `/blog/_TEMPLATE` disallowed; sitemap declared.
- Sitemap: valid XML, 0 duplicates, all https, no trailing-slash issues, 8,667 URLs < 50k limit.
- Clean single-hop 308 redirects (http→https, .html→clean); real 404 statuses (no soft-404s); HSTS preload + CSP present; no mixed content; preconnects sane.
- All page types fully server-rendered (26–215 KB HTML — no SPA shells for crawlers).

### Findings

**CRITICAL — Glossary "X-vs-Y" pages mass-fail with HTTP 500**
Evidence: 154 of 500 crawled pages return 500, all `/glossary/*-vs-*` (verified: `vidiq-vs-tubebuddy`, `ab-testing-vs-cards-end-screens`, `es/vidiq-vs-tubebuddy`, …) with body `{"error":"Cannot read properties of undefined (reading 'slug')"}`. Extrapolated: ~6,400 of 8,328 vs-URLs (77%) broken. Term-pair specific (some pairs 200).
Recommendation: fix the serverless lookup for missing term data; until fixed, exclude vs-URLs from the sitemap and robots-crawlable paths; add graceful 410 for unbuildable pairs.

**HIGH — 17 homepage-linked `/tools/tag-generator/{niche}` URLs return 404** (cooking, coding, gaming, … 17 niches). Homepage links to dead ends. Fix: generate the niche pages or 301 to `/tools/tag-generator`.

**HIGH — Noindex pages in sitemap**: /dashboard (noindex,nofollow), /about, /privacy-policy, /terms-of-service, /changelog all listed in sitemap.xml while serving `noindex`. Remove them or make them indexable.

**HIGH — Canonical .html round-trips**: /tools canonicals to /tools.html (which 308s to /tools); /dashboard canonicals to /dashboard.html (308 → /dashboard). Self-canonical conflict on 4 URL pairs. Fix: canonical to the clean URL directly.

**MEDIUM — `<lastmod>` on only 35/8,667 URLs (0.4%)**; glossary has none. Add lastmod to all (or at least blog + tools).

**MEDIUM — Security headers inconsistent**: homepage has full CSP + HSTS; /blog has stricter CSP + XFO + nosniff + Referrer-Policy; other sections lack XFO/nosniff/Referrer-Policy; HSTS max-age differs across routes. Unify headers in vercel.json.

**MEDIUM — /blog/_TEMPLATE live at 200** with literal `[POST_TITLE]`/`[POST_SLUG]` placeholders, index,follow. robots.txt disallows it but it's not noindexed. Set noindex + remove from any future sitemap.

**MEDIUM — CSP weakened by `'unsafe-inline' 'unsafe-eval'`** and an unblocked third-party script (unpkg.com lucide). Earlier console error: Vercel Analytics from cdn.jsdelivr.net was CSP-blocked (analytics now absent — script removed). Tighten CSP once scripts are consolidated.

**LOW — /contact.html 404** (linked somewhere in the site) and 2 stale `/public/tools/youtube-shorts-seo-guide.html` links 404. Redirect or remove.

**INFO — 410 for /blog/youtube-algorithm-changes-2026 handled correctly**, but it is still linked from glossary "Related Blog Posts" blocks (see content.md).

*Corrections to subagent drafts (verified live):* `/glossary/pt/*` pages return **200** (not 404 — earlier claim refuted); canonical tags **exist** sitewide (a crawler bug in the first pass missed `<link rel=canonical>`); hreflang en/es/pt/x-default is **symmetric** on glossary term pages (asymmetric only on broken vs-pages, whose alternates 500).

---

## 2. Content Quality & E-E-A-T (45/100)

### What Works
- Glossary term pages are genuinely deep: 836–1,040 words, definition-first, 25–28 related-term links, breadcrumbs — real pSEO quality on the working subset.
- Older long-form blog posts are solid (structured, dated, with TL;DR + FAQ).
- Full Spanish localization (2,857 ES pages verified serving real Spanish).

### Findings

**CRITICAL — 14 new blog posts are bulk-AI template content with fabricated research** (published 7/27–7/30, e.g. thumbnail/cooking/music channel posts): invented "studies" ("we studied 15 channels… 1 billion views"), grammar errors ("Learn how to youtube thumbnail tips 2026"), visible byline "YT SEO Architect Team" vs JSON-LD author "Patrick", and no sources. This is the #1 Google scaled-content-abuse trigger. Recommendation: pull or rewrite with real data, named author, citations; add human review to the publishing workflow.

**CRITICAL — Fabricated performance claims presented as fact**: "30–50% CTR improvement", "analysis of 10,000+ titles" — no methodology, no case studies, empty "Trusted by YouTube Creators" section. Replace with honest claims or real data.

**HIGH — Glossary "How to Optimize" sections are 4–6 shared boilerplate templates** reused across ~2,857 EN pages (nonsensical on some terms — duplicated content mass). Generate per-term guidance or remove.

**HIGH — Glossary "Related Blog Posts" link to dead URLs** (404/410, e.g. → /blog/youtube-algorithm-changes-2026 → 410) across the corpus.

**HIGH — No named human expertise**: About page anonymous, brand-only bylines, author identity inconsistent (Team vs Patrick), no legal entity in privacy/ToS, bare Gmail (thiza3062@gmail.com) as contact.

**HIGH — Meta descriptions**: missing on core tool pages; glossary metas 229–246 chars (templated suffix, truncated in SERPs).

**MEDIUM — Blog→tool internal linking nearly absent** (no hub-and-spoke to the product); **MEDIUM — Keyword cannibalization**: identical slugs under both /blog/ and /tools/ (25+ pairs, both 200, self-canonicals, both in sitemap); **MEDIUM — Glossary readability FK grade 14–16** (college-level vs beginner audience); **MEDIUM — Inconsistent claims** ("90+ tools" vs "17 tools"); **MEDIUM — 14 posts missing from sitemap** and blog index shows "0 words" for them; **MEDIUM — Stale freshness**: changelog last updated May 12.

**LOW — Long blog titles (86–96 chars)**, duplicate H1 on one post, factual error ("Shorts up to 60 seconds"), "0 AI Tools" stat on homepage, leftover pricing modal on a "100% free" site.

---

## 3. On-Page SEO (62/100)

### What Works
- Title tags on all 325 crawled 200-pages; meta descriptions present on all 200-pages crawled (tools excluded from some templates); canonical tags present everywhere (verified live); H1 = 1 on 321/325 pages; URL structure clean (lowercase, hyphenated, no params).

### Findings

**HIGH — Title length**: 198/500 crawled titles > 60 chars; 79 > 70 chars (SERP truncation; e.g. 93-char GitHub backlinks post). Glossary pattern "Term — YouTube SEO Glossary | YT SEO Architect" runs ~72 chars. Trim to ≤ 60.

**HIGH — /tools vs /blog cannibalization**: 35 of 38 /tools/ sitemap URLs are blog-post slugs (25 exact-duplicate pairs with /blog/). Google must pick between two self-canonical pages per query. Pick one home per keyword (recommend /blog/ for articles, /tools/ only for interactive tools), 301 or canonical the losers.

**HIGH — Tool SPA shells**: 16/21 tool pages are 98–180-word shells; keyword-difficulty-scorer renders literal "undefined" in body/snippet; tag-generator title omits its slug keyword. Build real content per tool (how-to, examples, FAQ).

**MEDIUM — Blog hub cards show "0 words"** for the 14 newest posts (indexing bug); **MEDIUM — "2026 2026" title duplication** on indexable posts; **MEDIUM — H1 issues on 4 blog posts** (15x duplicated H1 on one); **MEDIUM — /pricing noindex with no pricing content** (intent mismatch, see sxo.md).

**LOW — 1-item homepage breadcrumb**; duplicated `<link rel=canonical>` on blog posts; sitelinks searchbox schema targets login-gated /dashboard?q= (ineligible).

---

## 4. Schema / Structured Data (50/100)

### What Works
- Homepage is one valid JSON-LD @graph: WebSite + SoftwareApplication (price 0 Offer) + Organization + FAQPage + BreadcrumbList — complete required properties, correct URLs.
- Glossary breadcrumbs are correct 4-level hierarchies; blog Article has author/dates/publisher.

### Findings

**CRITICAL — Blog JSON-LD unparseable**: unescaped `<a href=...>` HTML inside JSON strings on 2 of 3 sampled posts ("Expecting ',' delimiter" — python json.loads fails). Also duplicated Article+FAQPage blocks (one valid array, one standalone broken). Fix the server-side template escaping (htmlspecialchars/json_encode properly).

**HIGH — Organization `logo` (logo.svg) returns 404** on homepage and all 8,571 glossary pages (blog uses working og-image.png). Fix the asset or point `logo` at og-image.png.

**HIGH — /blog and /tools hubs have zero schema** (no ItemList/BreadcrumbList); 1 of 3 sampled tool pages (youtube-revenue-estimator) has none.

**HIGH — WebSite SearchAction targets `https://…/dashboard?q=`** — a login-gated OAuth SPA; ineligible for sitelinks searchbox. Remove or point at a real public search.

**MEDIUM — FAQPage deployed sitewide** (homepage 8 Qs, glossary 2, blog 5) but FAQ rich results were deprecated July 2025 — valid markup, zero SERP benefit. Keep for AI-answer extraction, don't expect rich results.

**MEDIUM — Glossary terms use Article instead of DefinedTerm** (8,571-page opportunity for entity-rich results).

**LOW — Glossary hub description says "75+ terms"** vs 8,571 real pages; trailing-slash mismatches between schema URLs and canonicals; inert SpeakableSpecification; SoftwareApplication vs WebApplication inconsistency.

---

## 5. Performance / CWV (70/100 — estimate)

Lab/field data unavailable this run: PSI API daily quota exhausted; Unlighthouse (local Chrome) timed out on WSL. Architecture signals below.

### What Works
- Fully server-rendered HTML (70.9 KB homepage; 26–215 KB across page types), served via Vercel edge with `br` compression and `x-vercel-cache` HITs; preconnect to Google origins; HSTS preload; no images on critical templates.

### Findings

**MEDIUM — Third-party render dependencies**: lucide icons (unpkg.com) + blog-enhancements.js + main bundle — 3 JS, 5 CSS on homepage; unpkg has no SLO. Bundle lucide or inline icons.

**MEDIUM — CSP blocks Vercel Analytics** (cdn.jsdelivr.net) — analytics is silently dead (script absent now, but any re-add will fail; seen as console error in render). Align the CSP allowlist with actual scripts.

**LOW — picsum.photos hotlink for blog heroes** (random-image CDN, uncacheable).

**INFO — No render-blocking-fonts issue; no layout-shift suspects at current image counts.** Recommend: connect GSC (CrUX field data), run Lighthouse on a non-WSL machine, and set up real-user monitoring once analytics is fixed.

---

## 6. AI Search Readiness / GEO (72/100)

### What Works
- Model AI-crawler policy in robots.txt (all 8 AI search bots allowed); **every page type fully server-rendered for AI crawlers** (verified with AI-bot UAs — 200s + full HTML); definition-first glossary with Article+Breadcrumb+FAQ schema = highly quotable; homepage SoftwareApplication schema with price 0 ("free").

### Findings

**HIGH — llms.txt and llms-full.txt both 404** — the single biggest missing GEO asset for a tool site. Add llms.txt (product summary, free pricing, key glossary topics) + llms-full.txt.

**MEDIUM — Blog TL;DR "Direct Answer" blocks contain keyword-stuffed template artifacts** ("Learn how to best youtube growth strategies for new creators 2026") that AI will quote verbatim; posts claim "backed by real channel data" with zero citations.

**MEDIUM — /dashboard ships a "Free & Unlimited Overhaul" stylesheet that force-unlocks premium-locked UI via CSS** (`opacity: 1 !important`) — trust/integrity flag contradicting the "100% Free" claim; an AI reviewer can read it.

**LOW — "Youtube" vs "YouTube" casing in slugs/titles**; sitemap includes app surfaces (/dashboard); no security.txt; Organization schema uses a personal Gmail.

---

## 7. Images (80/100)

See findings/images.md. Summary: near-zero image footprint (0 images on homepage/glossary/tools templates), no missing alt; blog heroes hotlink **picsum.photos** (unstable random placeholder CDN) — replace with self-hosted branded images; fix logo.svg 404; add og:image sitewide.

---

## 8. Sitemap (see findings/sitemap.md)

- **CRITICAL — vs-pages broken at scale**: 77% of sampled vs-URLs 500, all in sitemap (~6,400 broken locs). 
- **CRITICAL — 15 live indexable blog posts missing** (14 new + youtube-thumbnail-ab-testing-guide); sitemap has 35 of ~50 live posts.
- **HIGH — /tools/ section is 84% article pages** (32/38) duplicating /blog/ slugs; 17 live interactive tools absent.
- **HIGH — 5 noindex pages in sitemap**; **HIGH — lastmod 0.4%**; **HIGH — glossary hubs not in sitemap** (hub links only ~74 of 8,571 terms — sitemap is sole discovery for ~8,490 URLs).
- **MEDIUM — /public/tools/ mirror (31 pages, index,follow)** — canonicalized to /tools/ routes (verified) but still crawlable duplicates; changefreq/priority inverted for blog; /glossary/category/index in sitemap 308s.

## 9. Cluster & Topical Architecture (see findings/cluster.md)

- The "8,571-page glossary" is mostly an error surface: 8,328 (97%) are auto-generated vs-URLs, ~6,400 broken; the real glossary is ~81 EN terms (+ ES/PT).
- Flat architecture: glossary terms template-locked to 24–28 same-silo links; no glossary↔blog↔tools cross-linking; /vs/ section (6 pages) nearly orphaned; /guide/youtube-seo pillar near-orphaned.
- Link equity: hubs feed 500 vs-pages; orphans: privacy (0 links), terms (1), about (3), dashboard/pricing (6).
- Coverage strong: keyword/metadata, analytics, production; thin: monetization (3 posts), community mgmt (1 post).

## 10. Backlinks & Authority

**Data unavailable**: no Moz/Bing API keys; Common Crawl (cc-main-2026-jan-feb-mar) has **no record of the domain** — too new/small to have measurable link graph. Recommendation: prioritize off-site authority in Phase 3-4 (directory, GitHub repos, HARO, tool listings). Score contribution neutral; noted as gap.

---

## Methodology & Limitations
- Crawl: 500 pages BFS (cap per audit config); 325×200, 154×500, 20×404, 1×410; 1,761 URLs left in queue (vs- section dominates).
- Live verifications: ~120 curl checks including AI-bot UA fetches, redirect chains, hreflang symmetry, canonical presence.
- Performance: estimate only (PSI quota + WSL Lighthouse timeout) — see §5.
- Discrepancies between subagent drafts were re-verified live; corrections noted inline (pt-404 refuted; canonicals/hreflang confirmed present).
- Specialist files: findings/{technical,content,schema,performance(partial),geo,sxo,cluster,sitemap,images}.md; screenshots/ (desktop+mobile); audit-data.json.
