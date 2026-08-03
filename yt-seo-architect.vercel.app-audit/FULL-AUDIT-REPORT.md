# FULL SEO AUDIT — yt-seo-architect.vercel.app

**Audit date:** 2026-08-03 · **Health Score: 58/100** (prior audit 2026-07-31: 59/100)
**Business type:** SaaS — free AI YouTube SEO tool (SoftwareApplication) with a programmatic SEO glossary (EN/ES/PT), blog, and 90+ interactive tools
**Method:** Homepage rendering (Playwright), 11,096-URL sitemap analysis, 50-URL deep probe + 80-URL status sampling, security/header inspection, GEO readiness check. Field data (CrUX/GSC) not available — no Google API credentials configured.

---

## Executive Summary

The site has **real strengths**: clean AI-crawler access, published llms.txt/llms-full.txt, valid homepage schema, correct hreflang, the prior 6,400-glossary-500 bug is fixed, and pages are static-prerendered (Googlebot sees full content). But the score is held down by **scale-level data hygiene issues**: ~29% of the sitemap is broken (404) URLs, ~half of blog posts ship unparseable JSON-LD, 24 blog/tools slug pairs cannibalize each other, and the E-E-A-T foundation (noindex About, anonymous authorship) is missing for a niche adjacent to money/advice content.

### Top 5 critical issues
1. **Sitemap ~29% broken** — 23/80 sampled glossary URLs 404 (~3,000+ of 10,986); the `channel-optimization-for-small-channels` family alone = 255 dead URLs.
2. **Blog JSON-LD unparseable on ~50% of posts** — unescaped HTML in JSON strings breaks Article+FAQPage rich results.
3. **24 blog/tools slug pairs cannibalizing** — identical content targets, both indexable.
4. **E-E-A-T vacuum** — noindex /about, anonymous authorship, Gmail contact, empty "Trusted by".
5. **CSP blocks first-party scripts** — Vercel Analytics and Google AdSense won't load (console-verified).

### Top 5 quick wins
1. Regenerate sitemap from live-verified URLs only (removes ~3,000 broken URLs in one deploy).
2. Fix blog JSON-LD escaping in the template (restores rich results site-wide).
3. 301 the 24 tools-article shells to their /blog/ homes.
4. Add `<lastmod>` to the 11,047 glossary URLs missing it.
5. Whitelist `pagead2.googlesyndication.com` + `cdn.jsdelivr.net` in the CSP (enables AdSense + analytics).

---

## Category Scores

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Technical SEO | 55 | 22% | 12.1 |
| Content Quality | 48 | 23% | 11.0 |
| On-Page SEO | 62 | 20% | 12.4 |
| Schema / Structured Data | 55 | 10% | 5.5 |
| Performance (CWV) | 65 | 10% | 6.5 |
| AI Search Readiness | 78 | 10% | 7.8 |
| Images | 50 | 5% | 2.5 |
| **Total** | | | **57.8 → 58** |

---

## Technical SEO (55/100)

**What works**
- HTTPS + HSTS (preload); Vercel CDN caching (immutable hashed assets, `max-age=0, must-revalidate` for HTML).
- robots.txt clean — internal paths blocked only; AI crawlers explicitly allowed (ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, OAI-SearchBot, Applebot-Extended, Bytespider).
- Prior 6,400 glossary HTTP-500 bug **fixed** — vs-pages now render 200 with valid Article schema.
- llms.txt and llms-full.txt (33KB) live; canonical tags present; hreflang en/es/pt/x-default correct.

**Findings**
- **CRITICAL — Sitemap ~29% broken.** 11,096 URLs listed; 10,986 are `/glossary/`. 80-URL random sample: **23 × HTTP 404 (28.75%)** → extrapolated ~3,160 broken URLs submitted to Google. The 255-URL `channel-optimization-for-small-channels*` family is 100% dead.
- **HIGH — 5 noindex pages in sitemap.** `/dashboard`, `/about`, `/changelog`, `/privacy-policy`, `/terms-of-service` (all `noindex`) are listed.
- **HIGH — CSP blocks first-party scripts.** `@vercel/analytics` from `cdn.jsdelivr.net` throws a CSP violation (console-verified via Playwright); AdSense `pagead2.googlesyndication.com` is also blocked.
- **MEDIUM — lastmod missing on 99.5%.** Only 49/11,096 URLs have `<lastmod>`.
- **MEDIUM — Security gaps.** No `X-Frame-Options`, `X-Content-Type-Options: nosniff`, or `Referrer-Policy`; `/security.txt` and `/.well-known/security.txt` 404.
- **MEDIUM — Stray routes.** `/blog/generic-hero` = 200 (16-byte placeholder); `/guide` = 404; `/pricing` redirects to the noindex dashboard shell.

---

## Content Quality (48/100)

**What works**
- Blog posts are substantive (2,000–10,500 words, structured H2s, FAQ blocks, tool links).
- Multilingual glossary (EN/ES/PT) with real definitions.
- Comprehensive llms.txt content map; interlinking between blog and glossary/tools.

**Findings**
- **HIGH — E-E-A-T vacuum.** `/about` is `noindex` with no named founder; authorship is brand-only; contact = Gmail; no legal entity; homepage "Trusted by" section shows no verifiable logos. This is an advice/monetization-adjacent niche where Google weighs E-E-A-T heavily.
- **HIGH — Scaled AI-template risk.** 58 posts share the "Learn how to {keyword} 2026" template pattern; 10,986 programmatic glossary pages. High automated-output volume without a visible human review gate.
- **MEDIUM — Thin templates.** Tools pages: 109–172 words, H2=0 (12 sampled); blog category hubs: 74–82 words; glossary vs-pages: 300–490 words of boilerplate.
- **MEDIUM — 6 × H1** on `/blog/maximizing-youtube-revenue-with-sponsorships-2026` (198KB, 10,545 words).
- **LOW — llms.txt data bugs.** `[null]` entry → `/blog/generic-hero`; stale counts (18 blog / 95 tools vs live 58 / 37).

---

## On-Page SEO (62/100)

**What works**
- Single H1 on nearly all pages; meta descriptions on 49/50 sampled; canonicals present; 50 internal links on the homepage; Googlebot receives identical static HTML (no SPA wall).

**Findings**
- **HIGH — Alt-attribute corruption.** Glossary cross-linker injects raw `<a href="/glossary/...">` HTML **inside image alt attributes** on some posts (e.g. `youtube-shorts-seo-guide-2026`), producing invalid markup.
- **HIGH — 24 blog/tools cannibalization pairs** (`youtube-intro-hook-first-3-seconds`, `youtube-tags-2026`, …), both indexable.
- **MEDIUM — Long titles.** Blog titles 62–96 chars (8/14 sampled >60); tools titles 63–94 chars.
- **LOW — Meta-description gaps.** Some short (61–99 chars); `tools/description-writer` has none.

---

## Schema / Structured Data (55/100)

**What works**
- Homepage JSON-LD valid + rich: Organization (`logo.png` — the svg→png fix has landed), WebSite, SoftwareApplication, FAQPage, BreadcrumbList.
- Tools → WebApplication; /vs/ → FAQPage; glossary → Article (all parseable).

**Findings**
- **CRITICAL — Blog JSON-LD broken on ~50% of sampled posts.** 7/14 posts have unparseable blocks (unescaped HTML): e.g. `youtube-intro-hook` 4/5 parseable, `youtube-metadata-auditor-vs-vidiq-shadow-ban` 1/3, `youtube-analytics-4-metrics` 1/2, `youtube-end-screens-cards-guide` 1/2.
- **MEDIUM — SearchAction → login-gated `/dashboard?q=`** (noindex + requires app login).
- **LOW — No ItemList/BreadcrumbList on hubs; no DefinedTerm on glossary.**

---

## Performance — CWV (65/100)

**What works**
- Lean homepage HTML (71KB), zero homepage images (stable layout, low CLS risk), edge-cached, static prerender, preconnects declared.
- Only 3 external scripts on the homepage.

**Findings**
- **MEDIUM — No field data.** CrUX/GSC credentials not configured (`google_auth --check` = tier -1); LCP/INP/CLS scored from lab signals only.
- **MEDIUM — Third-party dependencies.** `lucide` loads from unpkg.com; Vercel Analytics + AdSense are CSP-blocked (see Technical).

---

## AI Search Readiness (78/100) — strongest category

**What works**
- robots.txt explicitly allows all major AI crawlers; blocks only training-only bots (GPTBot, CCBot).
- llms.txt + llms-full.txt published and comprehensive.
- FAQPage schema feeds direct AI answers; 10,000+ glossary terms = massive topical surface; citable title/description pairs.

**Findings**
- **LOW — llms.txt quality bugs** (`[null]` entry, stale counts) dilute the AI-facing map.
- **LOW — Broken JSON-LD + 404 URLs** reduce passage-level citability for AI crawlers that validate sources.

---

## Images (50/100)

**What works**
- Most pages carry 0–1 images (fast); alt text present on sampled images; picsum hotlinks mostly replaced with self-hosted PNG heroes.

**Findings**
- **HIGH — Alt-attribute HTML corruption** (glossary-link injection) on blog heroes.
- **MEDIUM — Remaining hotlink.** `youtube-description-templates-2026` still loads from `picsum.photos`.
- **LOW — PNG-only heroes, no WebP/AVIF; some images lack width/height.**

---

## Improvement vs prior audit (2026-07-31)

| Issue | Before | Now |
|---|---|---|
| Glossary vs-pages HTTP 500 | ~6,400 broken | **FIXED** (200s, valid Article schema) |
| llms.txt / llms-full.txt | 404 | **LIVE** (200, 33KB) |
| Organization logo | svg → 404 | **FIXED** (logo.png) |
| Sitemap broken share | ~96% | **~29%** (still critical) |
| Blog JSON-LD | broken | **Still broken** (~50%) |
| Blog/tools cannibalization | 25+ pairs | **24 pairs** (unchanged) |
| E-E-A-T | vacuum | **Vacuum** (unchanged) |
| /about indexability | noindex | **noindex** (unchanged) |
| /pricing | → dashboard shell | **→ dashboard shell** (unchanged) |
| security.txt | missing | **missing** |

---

*Full data envelope in `audit-data.json`; per-category findings in `findings/`; prioritized plan in `ACTION-PLAN.md`.*
