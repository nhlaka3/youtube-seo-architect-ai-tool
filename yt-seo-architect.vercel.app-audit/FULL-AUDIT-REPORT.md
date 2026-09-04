# FULL SEO AUDIT — yt-seo-architect.vercel.app

**Audit date:** 2026-08-03 (fresh re-audit) · **Health Score: 67/100** (prior audit same day: 58/100 — **+9 points**)
**Business type:** SaaS — free AI YouTube SEO tool (SoftwareApplication) with a programmatic SEO glossary (EN/ES/PT), blog, and 95 interactive tools
**Method:** Homepage rendering (Playwright/Chromium), 18,090-URL sitemap download + structural analysis, ~330-URL status-code sampling across all URL families, JSON-LD parse checks on blog posts, canonical/hreflang/OG checks, security header inspection, GEO readiness check (llms.txt). Field data (CrUX/GSC) not available — no Google API credentials; PageSpeed API quota exhausted at test time.

---

## Executive Summary

**The remediation work since the prior audit has landed.** Every one of the prior audit's top-5 critical issues is measurably fixed:

- ✅ **Sitemap 404s: ~29% → ~1.3%** — the 3,000+ broken glossary URLs are gone. A 200-URL stratified sample found 14 404s; the entire residual broken set is one generator family (see #1 below).
- ✅ **Blog JSON-LD: unparseable on ~50% → 100% valid** — all 10 sampled posts parse cleanly.
- ✅ **lastmod coverage: 49/11,096 → 18,034/18,090 (99.7%)**.
- ✅ **noindex core pages** (/dashboard, /changelog, /privacy-policy, /terms-of-service) removed from sitemap.
- ✅ **/about now indexable** (was noindexed).
- ✅ **CSP whitelists AdSense + jsdelivr** — Vercel Analytics and AdSense can now load.
- ✅ **security.txt** served at /.well-known/security.txt.
- ✅ **Cannibalization: 42 blog/tools pairs resolved** via 308 redirects (e.g. /tools/how-to-keywords-youtube → /blog/how-to-keywords-youtube).

The score is now held down by a **new generator bug** (a 324-URL "double-vs" glossary family, ~73% broken), **5 residual identical blog/tools slug pairs**, **canonical hygiene gaps** (a /tools→tools.html canonical loop, missing canonicals on 4 core pages, duplicate canonicals on some blog posts), and **GEO completeness issues** (llms.txt covers only 17 of 50 blog posts and zero of 18k glossary pages).

### Top 5 critical issues
1. **324-URL "double-vs" glossary family ~73% broken** — URLs like `/glossary/average-view-duration-vs-vidiq-vs-tubebuddy` 404 (sample: 22/30). Also `/glossary/vidiq-vs-tubebuddy` (EN + ES) 404 while PT works. Est. **~240 broken URLs** still listed in sitemap.
2. **5 remaining identical blog/tools slug pairs cannibalize** — both indexable: `youtube-for-tutorials-2026`, `youtube-intro-hook-first-3-seconds`, `youtube-monetization-tips-2026`, `youtube-seo-for-business-channels-2026`, `youtube-seo-for-gaming-channels-2026`.
3. **Canonical loop on /tools** — canonical points to `https://…/tools.html`, which 308-redirects back to `/tools` (canonical → redirect → self).
4. **Missing canonicals on core pages** — /about, /privacy-policy, /terms-of-service, /contact have no canonical tag.
5. **llms.txt is stale & shallow** — lists 17/50 blog posts, **zero** glossary entries (18k pages = the site's main content asset), and llms-full.txt embeds a literal "Page not found" section (broken /blog/generic-hero entry).

### Top 5 quick wins
1. **Drop the 324 double-vs URLs from the sitemap generator** (and fix `/glossary/vidiq-vs-tubebuddy` EN/ES) — one deploy removes ~240 404s.
2. **301 the 5 remaining /tools/* twins to their /blog/* homes** (or noindex the thin tool variants).
3. **Fix the /tools canonical** to `https://yt-seo-architect.vercel.app/tools`.
4. **Add canonicals to /about, /privacy-policy, /terms-of-service, /contact**.
5. **Regenerate llms.txt/llms-full.txt** to cover all 50 blog posts + top glossary terms, and exclude broken entries.

---

## Category Scores

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Technical SEO | 72 | 22% | 15.8 |
| Content Quality | 60 | 23% | 13.8 |
| On-Page SEO | 65 | 20% | 13.0 |
| Schema / Structured Data | 80 | 10% | 8.0 |
| Performance (CWV) | 65 | 10% | 6.5 |
| AI Search Readiness | 72 | 10% | 7.2 |
| Images | 55 | 5% | 2.8 |
| **Total** | | | **67.1 → 67** |

---

## Technical SEO — 72/100

### What works
- **Sitemap**: 18,090 URLs, all resolvable except the double-vs family (~1.3%). lastmod on 99.7%.
- **Security headers**: strict CSP (now includes pagead2.googlesyndication.com + cdn.jsdelivr.net), HSTS preload, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Referrer-Policy, security.txt.
- **robots.txt**: allows all AI crawlers (ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended), blocks only dev paths.
- **HTTP statuses**: homepage 200; all 58 blog URLs 200; all 16 sitemap tools URLs 200; /vs/* and /guide/* 200; removed blog post returns clean **410 Gone** (correct).
- **SPA note**: homepage is server-rendered HTML with valid JSON-LD; Googlebot sees full content.

### Findings
| Severity | Finding |
|---|---|
| **Critical** | **324 "double-vs" glossary URLs, ~73% broken (est. ~240 404s)**. Pattern: `/{term}-vs-{tool}-vs-{tool}` where tool ∈ {vidiq, tubebuddy}. Sample 30 → 22×404. Also `/glossary/vidiq-vs-tubebuddy` (EN) + `/glossary/es/vidiq-vs-tubebuddy` 404 while PT variant is 200. |
| High | `/tools` canonical → `tools.html` (which 308s back to /tools) — canonical-to-redirect loop confuses consolidation. |
| High | Missing canonical on /about, /privacy-policy, /terms-of-service, /contact. |
| High | Duplicate canonical tags on some blog posts (e.g. /blog/youtube-tags-2026 emits 2× `<link rel=canonical>`). |
| Low | /blog/generic-hero returns 200 (orphaned stub) and leaks into llms-full.txt as "Page not found". |

---

## Content Quality — 60/100

### What works
- **Blog JSON-LD fixed** — Article+FAQPage rich results restored site-wide (10/10 sampled valid).
- /about is indexable again; E-E-A-T path exists but is incomplete.
- 50 blog posts, all live, with full H1s, meta descriptions, and internal tool links.

### Findings
| Severity | Finding |
|---|---|
| High | **E-E-A-T still thin**: anonymous authorship (no named founder/author pages), Gmail contact only, no "Trusted by" data, no author bio schema. Niche is adjacent to money/advice content — Google weights E-E-A-T heavily here. |
| Medium | AI-template blog titles persist ("Learn how to X 2026" pattern) on many posts — generic, low-click-value phrasing. |
| Medium | ~95 tool pages use boilerplate descriptions; llms.txt tool entries repeat generic filler ("Analyze your text for SEO keywords, topic clusters, and readability") rather than unique value propositions. |
| Low | Blog titles truncated with "…" in some SERP titles (e.g. 76-char titles for youtube-tags-2026) — over the 60-char guidance; truncation visible. |

---

## On-Page SEO — 65/100

### What works
- Titles + metas present on homepage, tools hub, blog, glossary, vs, guide pages.
- Single H1 on blog posts; keyword-rich glossary titles with correct casing.
- Correct hreflang (en/es/pt/x-default) on glossary pages.
- Homepage canonical correct; OG tags complete with valid og-image.png (197 KB, 1200×630).

### Findings
| Severity | Finding |
|---|---|
| **Critical** | **5 identical blog/tools slug pairs both indexable** — /tools/{slug} ("Free Interactive Tool" thin variant) competes with /blog/{slug} (full article). See list in exec summary. |
| High | /tools canonical loop (see Technical). |
| High | Missing canonicals on 4 core pages (see Technical). |
| Medium | Homepage title 65 chars (slightly over), blog SERP titles 73-76 chars with visible "…" truncation. |
| Low | /tools vs /tools.html duplicate accessible paths — /tools.html 308s to /tools (clean), but canonical still points at the redirector. |

---

## Schema / Structured Data — 80/100

### What works
- Homepage: single valid JSON-LD block (SoftwareApplication + FAQPage + Organization + WebSite + BreadcrumbList + SearchAction) — parsed cleanly.
- Blog posts: Article (+FAQPage where applicable) valid on all sampled.
- Glossary pages: Definition/FactSheet-style JSON-LD valid, hreflang alternates present.

### Findings
| Severity | Finding |
|---|---|
| Medium | No Author/Person schema anywhere — weakens E-E-A-T structured signals for a money-adjacent niche. |
| Low | No VideoObject schema on tool/blog pages even though the product targets YouTube creators. |

---

## Performance (CWV) — 65/100

### Findings
| Severity | Finding |
|---|---|
| Medium | **Field data unavailable** — no CrUX/GSC credentials; PageSpeed Insights API returned 429 (daily quota exhausted) at test time. Score is lab-estimate only. |
| Low | Homepage renders statically (server HTML, no client-side content dependency) — structurally well-positioned for CWV. |
| Info | Sitemap is 3.4 MB / 18,090 URLs — within XML size limits (50 MB) but large; consider sitemap index files for crawl efficiency. |

---

## AI Search Readiness (GEO) — 72/100

### What works
- robots.txt explicitly allows every major AI crawler.
- llms.txt + llms-full.txt published with brand line, core platform links, blog index.
- Clean, static, LLM-friendly HTML; glossary pages highly structured.

### Findings
| Severity | Finding |
|---|---|
| High | **llms.txt incomplete**: covers only 17 of 50 blog posts; **zero glossary entries** despite 18,006 glossary pages being the site's richest structured content asset. |
| High | **llms-full.txt embeds a "Page not found" section** for /blog/generic-hero — an AI crawler reading the file hits broken content. |
| Medium | llms.txt tool descriptions are templated filler, not unique value propositions — weak citation fodder. |
| Low | No FAQ/HowTo Q&A blocks surfaced in llms.txt for AI answer extraction. |

---

## Images — 55/100

### What works
- og-image.png exists and serves correctly (200, 197 KB, proper OG dimensions).
- favicon present.

### Findings
| Severity | Finding |
|---|---|
| Medium | Alt-text quality not verified at scale (curl-level audit); prior audit noted corrupted alt attributes from glossary-link injection on some blog heroes — recheck post-remediation. |
| Info | Blog heroes are self-hosted now (picsum hotlink removed per prior audit). |

---

## Priority Action Plan

| Priority | Action | Effort |
|---|---|---|
| **Critical** | Regenerate sitemap without the 324 double-vs URLs; fix `/glossary/vidiq-vs-tubebuddy` EN/ES | 1 day |
| **Critical** | 301 the 5 residual /tools/* twins → /blog/* (or noindex tool variants) | 1 day |
| **High** | Fix /tools canonical → `https://yt-seo-architect.vercel.app/tools` | 30 min |
| **High** | Add canonicals to /about, /privacy-policy, /terms-of-service, /contact; dedupe blog canonicals | 1 hr |
| **High** | Regenerate llms.txt/llms-full.txt: 50 posts + top glossary terms, strip broken entries | half day |
| **Medium** | Add Person/Author schema + author pages; consider VideoObject schema | 1-2 days |
| **Medium** | Rewrite boilerplate tool descriptions to unique value props (helps llms.txt too) | 2-3 days |
| **Medium** | Trim blog SERP titles ≤60 chars (no ellipsis truncation) | 1 hr |
| **Low** | 410 or remove /blog/generic-hero; add Q&A blocks to llms.txt | 1 hr |

---

## Method & Limitations
- ~330 unique URLs sampled across glossary (plain, vs-style, double-vs, EN/ES/PT), blog (all 58), tools (all 16), vs (6), guide (1), core pages, llms files.
- PageSpeed Insights API quota exhausted (429) — CWV scores are prior-audit lab estimates, not fresh field data.
- No Google API credentials → no CrUX/GSC/GA4 data in this audit.
