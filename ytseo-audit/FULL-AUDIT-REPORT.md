# FULL SEO AUDIT REPORT — yt-seo-architect.vercel.app

**Audit date:** 2026-08-17
**Business type detected:** Free AI SaaS tool (YouTube SEO toolkit — keyword research, tag generator, title optimizer, metadata audit, channel analytics)
**Site scope:** 550 URLs in sitemap (157 core + 345 glossary terms + 48 glossary pairs); ~72 blog posts, 85 tool pages, 4 pillar guides, ~390 glossary pages
**Method:** Live crawl (render_page.py via Playwright Chromium), batch status-code crawl of all 550 sitemap URLs, curl extraction, JSON-LD validation, textstat readability, Common Crawl backlink graph, specialist subagent analysis (technical / content / on-page / schema / GEO / SXO / images)

---

## EXECUTIVE SUMMARY

### SEO Health Score: 78 / 100 (Good)

| Category | Score | Weight |
|---|---|---|
| Technical SEO | 88 | 22% |
| Content Quality | 64 | 23% |
| On-Page SEO | 71 | 20% |
| Schema / Structured Data | 88 | 10% |
| Performance (CWV) | 70 | 10% |
| AI Search Readiness | 82 | 10% |
| Images | 95 | 5% |

**What's working (the foundation is solid):**
- Zero broken pages — all 550 sitemap URLs return 200
- Exemplary robots.txt: 8 AI answer-engine crawlers allowed, 14 training crawlers blocked
- Spec-perfect llms.txt, fresh same-day, 316 links deep
- Valid JSON-LD everywhere: Organization, WebSite, SoftwareApplication, FAQPage, Breadcrumb, Article + speakable
- Full security header suite (CSP, HSTS preload, nosniff)
- Clean on-page fundamentals: 1 H1 per page, self-referencing canonicals, index,follow everywhere
- Image discipline: alt + dimensions + lazy/eager strategy all correct

**Top 5 critical issues (none block indexing — but these cap growth):**

1. **No custom domain (HIGH).** The entire site — content, llms.txt, JSON-LD, canonicals, social shares — lives on the free `vercel.app` subdomain. `yt-seo-architect.com` does not resolve (HTTP 000 / DNS NXDOMAIN). Consequences: zero domain authority, vercel.app subdomains filtered by SEO tools and some AI link extractors, brand queries can't surface a branded domain, backlink building impossible to attribute. **This is the single highest-leverage fix.**
2. **Templated, grammatically broken blog meta descriptions (HIGH).** "Learn how to creating high click-through rates youtube thumbnails…" — same skeleton on all ~59 posts; 5 pages have descriptions at 108–256 chars (outside 120–160).
3. **Blog posts claim stats with zero citations (HIGH).** External links are Amazon affiliate tags + social share buttons; only 1 of 4 sampled posts cites support.google.com / backlinko.
4. **Thin money page (HIGH).** /tools/keyword-difficulty-scorer is a 59-word shell with no H2 targeting a head term.
5. **No CWV field data (MEDIUM).** PSI rate-limited without API key, GSC not connected. Proxy signals (77KB HTML, HTTP/2, Brotli, 0.29s TTFT) suggest good CWV — unverified.

**Top 5 quick wins:**
1. Fix the 5 meta description length violations + broken template
2. Update homepage footer "Updated May 2026" badge (llms.txt says 2026-08-17 — contradictory freshness)
3. Unify tool count: "85 tools" (llms.txt bullet) vs "90+ tools" (header/meta)
4. Add /dashboard, /contact, /privacy-policy, /terms-of-service to sitemap-core.xml
5. Link /contact from the footer (currently hidden — trust signal)

---

## 1. TECHNICAL SEO (88/100)

### Crawlability — PASS
- robots.txt: HTTP 200, valid. Allows all; disallows /blog/_TEMPLATE, /api/, /admin/, /_next/, /node_modules/ (all genuinely non-indexable).
- AI crawler policy exemplary (see AI Search Readiness).
- **All 550 sitemap URLs return HTTP 200** — zero broken pages in sitemap.

### Sitemaps — PASS (1 Medium)
- sitemap.xml = valid index → 3 children: sitemap-core.xml (157), sitemap-glossary-terms.xml (345), sitemap-glossary-pairs.xml (48). All well-formed, zero duplicates, full coverage.
- **[Medium]** lastmod on only 58/550 URLs (10.5%) — glossary sitemaps (393 URLs) have zero lastmod. Freshness signal underused.

### Canonicals — PASS
- Self-referencing canonical on all 7 sampled pages (/, /blog, /tools, /about, guide, blog post, tool page). No conflicts.

### Indexability — PASS
- `index, follow` everywhere sampled; no noindex leaks, no x-robots-tag surprises.

### Security Headers — PASS (exemplary)
- CSP comprehensive (Stripe/PayPal/Google/Groq/Cloudflare allowlisted, object-src 'none', base-uri 'self')
- HSTS `max-age=63072000; includeSubDomains; preload`
- X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin
- Brotli + HTTP/2 + CDN cache HIT

### Redirects / 404s — NOT VERIFIED (limitation)
- Redirect (http→https, trailing slash) and 404 checks were interrupted by a command guard mid-audit. Vercel edge serves 308 http→https by default; custom 404 page unconfirmed. Verify manually.

### Performance — PARTIAL
- PSI/CrUX rate-limited without API key; local Lighthouse interrupted. Proxy signals: 77,047 bytes HTML homepage, HTTP/2, Brotli, 0.29s TTFT, cache HIT.
- **[Medium]** No field CWV data (CrUX) without GSC/API access. Asset profile suggests LCP<2.5s / CLS<0.1 / INP<200ms — unverified.

---

## 2. CONTENT QUALITY (64/100)

### Strengths
- Blog posts substantial: 2,200–2,600 words, 10–13 H2s (TL;DR, In This Article, Step-by-Step, FAQ, Key Takeaways)
- Pillar guide 2,147 words; homepage 1,872 words
- Byline + dates on all posts; seo-tips post cites primary sources

### Findings
- **[High]** Claims without citations — 3 of 4 sampled posts cite nothing (affiliate + social only)
- **[High]** /tools/keyword-difficulty-scorer: 59 words, 0 H2
- **[Medium]** Readability FRE 41.9–49.1 (11th–12th grade) for a creator audience
- **[Medium]** Affiliate links (Amazon tag=44HlecM, Canva, Adobe) without disclosure
- **[Medium]** Thin founder identity: "Patrick", no surname/photo/LinkedIn, single shared author across all posts reads as automated pipeline
- **[Low]** /pricing 266 words

### E-E-A-T summary
Positive: About page has founder signature + Organization schema with Person/Founder + GitHub sameAs; /contact exists with form; privacy/terms live in footer.
Negative: contact hidden from footer; no photo/surname/credentials; citations inconsistent across posts; ~59 same-day-ish posts from one author present a programmatic-content fingerprint.

---

## 3. ON-PAGE SEO (71/100)

### Strengths
- Exactly 1 H1 on every audited page; titles brand-suffixed
- Homepage internal linking strong: 47 links, 41 internal, descriptive anchors, zero "click here"
- All 59 posts linked from /blog index; related posts + breadcrumbs in article bodies

### Findings
- **[High]** Templated broken meta descriptions across ~59 posts
- **[High]** 5 pages with meta desc outside 120–160 chars (175, 169, 193, 256, 108)
- **[Medium]** Ungrammatical templated titles ("Creating High Click-through Rates Youtube Thumbnails 2026")
- **[Medium]** Title/H1 mismatch on /blog/youtube-seo-tips-for-creators-in-2026 (title says "YouTube Tags 2026", H1 says "YouTube SEO Tips")
- **[Medium]** Blog posts link to ZERO tool/guide pages; /tools index links only 23 of 52 tool pages (~29 unreachable from hub)
- **[Medium]** 8 orphaned /blog/category/* pages (linked from nowhere)
- **[Medium]** /dashboard, /contact, /privacy-policy, /terms-of-service missing from all sitemaps; /contact missing from footer
- **[Low]** /blog index has 0 H2s

---

## 4. SCHEMA / STRUCTURED DATA (88/100)

### Strengths
- 0 JSON-LD parse errors across all audited pages
- Homepage @graph: Organization (logo, email, 3 sameAs, founder Person w/ GitHub), WebSite, SoftwareApplication (price 0, 17 features, speakable), FAQPage (8 Q/A), BreadcrumbList
- Posts: Article + FAQPage (5 Q/A) + speakable xpaths; tools: WebApplication; guides: CollectionPage; about: AboutPage

### Findings
- [Low] Article → BlogPosting (recommended for posts)
- [Low] WebSite lacks SearchAction; /blog index has no schema (no ItemList/Blog)
- [Info] Homepage BreadcrumbList = 1 item (useless but valid)

---

## 5. PERFORMANCE (70/100)

- No lab/field numbers this audit (API rate limit + interrupted Lighthouse)
- Proxy signals healthy (77KB HTML, HTTP/2, Brotli, 0.29s TTFT, eager LCP hero with fetchpriority=high, lazy everything else)
- **[Medium]** Verify with CrUX once GSC connected / API key added

---

## 6. AI SEARCH READINESS (82/100)

### robots.txt — exemplary (PASS)
- **Allowed (search/reference):** ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider
- **Blocked (training):** GPTBot, CCBot, GrokBot, Amazonbot, Meta-ExternalAgent, cohere-ai, Cohere-Research, AI2Bot, YouBot, DuckAssistBot, Timpibot, Diffbot, OmgiliBot, ExaBot
- GPTBot blocked while ChatGPT-User + OAI-SearchBot allowed = correct OpenAI search-vs-training split

### llms.txt — spec-perfect (PASS, 1 Low)
- H1 + blockquote (Site/Updated 2026-08-17), 4 H2 sections, 316 bullet links, 0 empty
- Coverage: 7 core + 72 blog + 126 guides + 111 glossary
- [Low] "85 free tools" (Tools bullet) vs "90+ tools" (header/meta)

### Citability — strong (PASS, 2 Low)
- Byline "Patrick" + meta author + Person schema + GitHub sameAs on all posts
- article:published_time / datePublished / dateModified present
- Monetize post cites YouTube official policy with retrieval dates ("retrieved 2026-08-07")
- Speakable schema + Direct Answer-first structure + FAQ + Key Takeaways = ideal for LLM extraction
- [Low] Zero blockquotes; thin author entity; generic Amazon affiliate links

### Brand/entity — strong (PASS, 1 Medium)
- Full Organization/WebSite/SoftwareApplication graph; logo 200; consistent titles/footer/socials
- **[Medium]** Footer badge "Updated May 2026" contradicts llms.txt 2026-08-17

### The big one — **[HIGH]** No custom domain
- yt-seo-architect.com = HTTP 000 (does not resolve). All entity signals, llms.txt, JSON-LD urls, canonicals point at the free subdomain. vercel.app subdomains are filtered by some SEO tools and AI link extractors; no domain authority; backlinks unattributeable; brand queries can't surface a branded domain.

---

## 7. IMAGES (95/100)

- 0/3 missing alt; 0/3 missing dimensions; correct lazy/eager (LCP hero eager + fetchpriority=high)
- og:image 1200×630 verified 200 + og:image:width/height/type; twitter:card summary_large_image
- No defects found.

---

## 8. BACKLINKS — NO DATA (limitation)

- Common Crawl has no host-level data for `*.vercel.app` subdomains (expected limitation); .com query empty (no DNS). Backlink profile unverifiable without a commercial index (Ahrefs/Majestic) or GSC Links report.
- dev.to + GitHub = 2 referring domains per project tracking (goal1.txt). Custom domain is the prerequisite for meaningful backlink acquisition.

---

## SCORING NOTES

- No Critical-severity findings: nothing blocks indexing (all pages 200, canonicals clean, schema valid, robots open).
- Content Quality (64) and On-Page (71) drag the weighted score down; Technical (88), Schema (88), Images (95) hold it up.
- Performance (70) is a "no data" penalty, not evidence of slow pages.

*Full evidence: findings/technical.md, findings/content.md, findings/geo.md. Action plan: ACTION-PLAN.md.*
