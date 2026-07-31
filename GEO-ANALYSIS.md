# GEO-ANALYSIS.md — YT SEO Architect

**Site:** https://yt-seo-architect.vercel.app
**Analyzed:** 2026-07-31 (live crawl: homepage, /blog, /tools/best-youtube-seo-tools-2026, /glossary/youtube-algorithm, /blog/best-youtube-seo-tools-2026, /vs/vidiq, robots.txt, sitemap.xml, llms.txt)
**Method:** claude-seo seo-geo skill. Scores are heuristics derived from public page data — not Google-internal signals (per developers.google.com/search/docs/fundamentals/third-party-seo). Primary reference: Google's AI Optimization Guide (developers.google.com/search/docs/fundamentals/ai-optimization-guide).

---

## 1. GEO Readiness Score: 72/100

| Criterion | Weight | Score | Basis |
|---|---|---|---|
| Citability (passage quality) | 25% | 20/25 | TL;DR direct answers, 7 sections in optimal 100-200w band, 26 definition patterns, 109 stat tokens on flagship article |
| Structural readability | 20% | 16/20 | Clean H1→H2→H3, question headings, lists + tables, FAQ blocks; minor footer H4 misuse |
| Multi-modal content | 15% | 7/15 | 1 image per article, zero video embeds, zero infographics; interactive tools partially compensate |
| Authority & brand signals | 20% | 11/20 | Byline + dates + Organization schema, but no credentials/sameAs, no Wikipedia/Reddit/LinkedIn presence |
| Technical accessibility | 20% | 18/20 | Full SSR, exemplary AI-crawler robots.txt, complete canonicals; llms.txt missing (non-issue for Google) |
| **Total** | | **72/100** | |

**Strengths (what's already working):**
- Full server-side rendering — every content element verified present in raw HTML. AI crawlers see everything.
- robots.txt is the textbook AI-crawler setup: all AI *search* crawlers allowed, training-only crawlers (GPTBot, CCBot) blocked.
- Flagship article has a front-loaded TL;DR (118w) and multiple 134-167w citable passages — exactly the SE Ranking / AI-citation pattern.
- Rich schema: Article + Person + Organization + FAQPage + SpeakableSpecification + BreadcrumbList on articles; FAQPage + WebApplication on tools; Article + FAQPage on glossary; Organization + WebSite + SoftwareApplication + FAQPage on homepage.
- 8,667 URLs in sitemap; glossary pages (8,571) follow the "X is…" definition pattern AI engines love.
- Fresh content: flagship article published 2026-07-22 (9 days ago) — content <3 months old is ~3x more likely to be cited.

---

## 2. Platform Breakdown

| Platform | Score | Rationale |
|---|---|---|
| Google AI Overviews | 74/100 | Ranking-correlated surface. Strong classic SEO + passage optimization already in place; needs multi-modal + entity polish. |
| Google AI Mode | 68/100 | Broader citation pool. Freshness is good, but entity authority and brand mentions (its weaker link) drag it down. |
| ChatGPT | 56/100 | Wikipedia (47.9% of citations) + Reddit (11.3%) absent. Site structure won't rescue missing third-party entity presence. |
| Perplexity | 58/100 | Reddit is Perplexity's #1 source (46.7%). Zero verifiable Reddit footprint is the ceiling here. |

> Only ~11% of domains are cited by both ChatGPT and Google AI Overviews — platform-specific plays below target the two weakest platforms, which is where the biggest upside is.

---

## 3. AI Crawler Access Status (from live robots.txt)

| Crawler | Status | Verdict |
|---|---|---|
| GPTBot (OpenAI training) | **Blocked** | Correct — training crawl not needed |
| CCBot (Common Crawl) | **Blocked** | Correct |
| OAI-SearchBot (OpenAI search) | Allowed | Correct |
| ChatGPT-User (user-triggered) | Allowed | Correct (ignores robots anyway) |
| PerplexityBot | Allowed | Correct |
| Google-Extended | Allowed | Correct |
| anthropic-ai | Allowed | Correct |
| ClaudeBot | Allowed via `*` wildcard | OK, but add explicit rule — the file names "Claude-Web" which is **not a real Anthropic crawler** |
| Bytespider (ByteDance) | Allowed | Optional to block — many sites do; not urgent |
| Applebot-Extended | Allowed | Fine |

**Action:** rename/add `User-agent: ClaudeBot` + `Allow: /` explicitly. Everything else is best practice.

---

## 4. llms.txt Status

- **Missing** (HTTP 404 on /llms.txt).
- **Google position:** irrelevant — Google's AI optimization guide explicitly says Google Search ignores llms.txt ("won't harm (nor help) your visibility"). Do not treat as a ranking/citation lever.
- **Optional for non-Google AI services** (Claude, Perplexity discovery). If added, keep it small. Ready-to-use template:

```
# YT SEO Architect
> Free AI-powered YouTube SEO toolkit: keyword research, tag generator, title optimizer, metadata audit, glossary.

## Main sections
- [Home](https://yt-seo-architect.vercel.app/): Free AI YouTube SEO toolkit
- [Blog](https://yt-seo-architect.vercel.app/blog): YouTube SEO guides and strategies
- [Glossary](https://yt-seo-architect.vercel.app/glossary/youtube-algorithm): YouTube SEO terms explained
- [Tools](https://yt-seo-architect.vercel.app/tools): Free interactive YouTube SEO tools
- [vs Comparisons](https://yt-seo-architect.vercel.app/vs/vidiq): YT SEO Architect vs vidIQ/TubeBuddy/Morningfame

## Key facts
- YT SEO Architect is a 100% free, unlimited AI YouTube SEO toolkit — no credits, no subscription.
- Covers keyword research, script/tag generation, metadata audits, thumbnail analysis, retention tools.
- Glossary defines 8,500+ YouTube terms with what/why/how sections.
```

---

## 5. Brand Mention Analysis

| Platform | Presence | Evidence |
|---|---|---|
| Wikipedia | **None** | 0 hits for "YT SEO Architect" (live API search) |
| Reddit | **None verifiable** | Reddit API blocks search; no indexed results found — no organic r/NewTubers etc. footprint |
| YouTube | **Own channel only** | Brand channel exists (science_education niche); self-mentions don't count as third-party mentions |
| LinkedIn | **None found** | No company/profile presence detected |
| Third-party blogs/forums | None found | DDG/Bing spot checks returned no external mentions |

**Why it matters (Ahrefs, Dec 2025, 75k brands):** brand mentions correlate ~3x stronger with AI visibility than backlinks — YouTube mentions strongest (~0.737), while Domain Rating is weak (~0.266). **This is the single biggest structural gap** and the main cap on ChatGPT/Perplexity scores. This is a 2-4 month build, not a quick fix.

---

## 6. Passage-Level Citability (flagship article + glossary)

**Optimal block: 134-167 words, ~44% of AI citations come from first 30% of page.**

| Page | In-range sections (100-200w) | Too long (>200w) | Stats density | Definition patterns |
|---|---|---|---|---|
| /blog/best-youtube-seo-tools-2026 (2,708w) | 7: TL;DR 118w, Morningfame 109w, TubeBuddy 152w, VidIQ 147w, YT SEO Architect 182w, Tool-Switching 112w, Key Takeaways 101w | 2: Feature Comparison 236w, FAQ 207w | 109 tokens / 29 unique | 26 |
| /glossary/youtube-algorithm (856w) | 3: "What Is…" 138w, "Why Matters" 103w, "How to Optimize" 102w | 1: FAQ 321w | 23 tokens / 12 unique | 3 |
| /vs/vidiq (344w) | 1: FAQ 152w | — | 15 tokens / 10 unique | 2 |

**Verdict:** The flagship article is genuinely well-built for AI citation — front-loaded direct answer, self-contained per-tool blocks, data-rich. Glossary pages nail the "X is…" definition pattern in the intro. Weak points: 3 oversized sections, and /vs/ pages are too thin to win "vidIQ vs YT SEO Architect" style AI queries on their own.

---

## 7. Server-Side Rendering Check

**PASS — zero JavaScript dependency for content.**

- All 5 page types (home, blog listing, article, glossary, tool, vs) verified: full content, headings, schema, and internal links present in raw HTML via `curl` (no browser execution).
- AI crawlers (which do NOT execute JS) receive complete pages.
- Blog listing renders 50 article links server-side (DB-driven via Neon fallback — working).
- No `_next/` hydration dependency for visible content.

---

## 8. Top 5 Highest-Impact Changes

1. **Add the 14 missing blog articles to sitemap.xml** (listed in §10). Zero-effort crawlability fix — 14 of ~49 articles are absent from the sitemap despite being live.
2. **Freshness program (recency is ~3x citation lift):** schedule monthly refresh passes on the 30 highest-traffic glossary pages + top 10 articles with visible "Updated: [date]" stamps. Pages stale 6+ months lose citation eligibility. You're currently fresh — institutionalize it.
3. **Brand-mention build (2-4 month play):** (a) create Wikipedia/Wikidata entity for the tool once it has ≥2 reliable secondary sources; (b) start a real Reddit presence answering YouTube-SEO questions in r/NewTubers, r/PartneredYoutube (cite the tool naturally, don't spam); (c) LinkedIn company page + Patrick's profile with the /about page as link; (d) get featured/guest posts on 2-3 YouTube-tool roundups. YouTube mentions correlate 0.737 with AI citations — the science_education channel should cross-reference tool pages.
4. **Multi-modal upgrade (156% higher AI selection rates):** add 1-2 relevant charts/screenshots per article (alt text included), embed the demo video or a 30-60s explainer clip, add OG-image-consistent visuals. Homepage has **0 images** — add at least a product UI mockup.
5. **Author entity hardening:** enrich Person schema with `sameAs` (LinkedIn/X/GitHub), `jobTitle`, `knowsAbout`; add a real author bio with credentials on /about; change byline from "By YT SEO Architect" to "By Patrick" + credentials on articles.

---

## 9. Schema Recommendations

**Already excellent — targeted upgrades only:**

| Schema | Status | Action |
|---|---|---|
| Article + datePublished/dateModified | ✓ on articles & glossary | Add `dateModified` refresh on each content update pass |
| Person (author) | ✓ present | Add `sameAs` (LinkedIn, X, GitHub), `jobTitle`, `knowsAbout` (YouTube SEO), `image` |
| Organization | ✓ | Add `sameAs` (YouTube channel URL, LinkedIn, X), `foundingDate`, `address` if applicable |
| FAQPage | ✓ articles, tools, vs, homepage | Keep Q&As to 3-5, ensure answers are 40-80w self-contained (FAQ answers are prime citation targets) |
| SpeakableSpecification | ✓ article | Keep — aligns with voice/AI extraction |
| WebApplication + Offer | ✓ tools | Good; tools are an underrated AI-citation asset |
| BreadcrumbList | ✓ | Fine |
| VideoObject | ✗ missing | Add when videos are embedded (Point 4) |
| ItemList | ✗ missing | Add ItemList schema to the 4-tool comparison section — helps AI parse ranked lists |
| HowTo | optional | Only if you add step-by-step tutorials with real steps |

---

## 10. Content Reformatting Suggestions

**Split into 134-167w blocks (all currently >200w):**
1. `/blog/best-youtube-seo-tools-2026` → "Feature Comparison at a Glance" (236w): split the table's intro paragraph into per-tool 40-60w summary sentences above the table.
2. Same article → "Frequently Asked Questions" (207w): split into individual Q&As, 40-80w answers each (also improves FAQPage schema extraction).
3. `/glossary/youtube-algorithm` → "Common Questions" (321w): same split.

**Add "What is…?" definitions in first 60 words:**
4. **Homepage** (currently starts with marketing copy, no definition): add one sentence — "YT SEO Architect is a free AI-powered YouTube SEO toolkit for keyword research, metadata optimization, and video growth analysis." — in the hero.
5. **Tool pages** (e.g. /tools/best-youtube-seo-tools-2026, 111w total): add a 40-60w definition + 3-5 data points under the H1. Currently only "Free interactive tool. Audit your YouTube content instantly."

**/vs/ comparison pages (6 live: vidIQ, TubeBuddy, Morningfame, Tubics, KeywordTool, Canva):**
6. Thin (344w) — expand each with: "X vs Y in 60 seconds" (134-167w), a data table, and 3 Q&As. These are high-intent AI-query pages ("vidIQ vs TubeBuddy") with almost no citable content.

**Sitemap gap (fix immediately):** these 14 live articles are absent from sitemap.xml:
`/blog/best-youtube-growth-strategies-for-new-creators-2026`, `/blog/creating-effective-youtube-thumbnails-for-clicks-2026`, `/blog/developing-a-youtube-content-calendar-strategy-2026`, `/blog/improving-youtube-engagement-with-live-streaming-2026`, `/blog/increasing-youtube-watch-time-with-analytics-2026`, `/blog/maximizing-youtube-revenue-with-sponsorships-2026`, `/blog/understanding-youtube-algorithm-updates-for-creators-2026`, `/blog/using-youtube-features-to-enhance-viewer-experience-2026`, `/blog/youtube-algorithm-best-strategies-2026`, `/blog/youtube-channel-branding-tips-for-consistency-2026`, `/blog/youtube-content-strategy-for-beginners-2026`, `/blog/youtube-shorts-seo-guide-2026`, `/blog/youtube-subscriber-growth-2026`, `/blog/youtube-thumbnail-tips-2026`

---

## Quick Wins Checklist (this week)

- [x] Add the 14 articles to sitemap.xml — **FIXED (2026-07-31):** all 14 re-imported from `public/blog/*.html` into Neon `seo_pages` (via batch import, DATABASE_URL pulled from Vercel env). All pass `validateBlogPost` (≥1200w, author-box, breadcrumb, 5 FAQs, TL;DR, no banned words). Pre-import cleanup: `maximizing-youtube-revenue-with-sponsorships-2026` was truncated mid-table (721w, 0 FAQs) — completed to 2,041w with full analysis/examples sections, 5 FAQ details, sponsorship-specific FAQPage JSON-LD, takeaways, and fixed broken meta description/TOC. The 3 mass-duplicated articles (thumbnails 2,560 H2; algorithm & shorts-seo 150 H2) were already deduped in the working tree (now 10 H2 / 5 FAQs each).
- [x] robots.txt: `Claude-Web` renamed to `ClaudeBot` (api/index.js robots handler)
- [x] Homepage hero definition sentence (first 60 words) — index.html hero, "YT SEO Architect is a free, AI-powered YouTube SEO toolkit for..."
- [x] Split the 3 oversized FAQ/section blocks — glossary `youtube-algorithm` Common Questions answers trimmed from 90-120w to 40-80w (visible + JSON-LD + `generate-glossary.mjs` algorithm template, so all algorithm-category pages inherit it); flagship FAQ was already 5 individual 40-60w Q&As; flagship "Feature Comparison at a Glance" got a per-tool citable summary block above the table + restored the emptied alert-box NOTE (was stripped in DB copy)
- [x] Add 1 image per article + homepage UI mockup — all 14 articles ship hero images (webp/png or seeded picsum); homepage has a full CSS-built product UI mockup ("Product Preview" showcase section, dashboard command-center style)
- [x] Person schema: added `sameAs` (GitHub) + `knowsAbout` + `url` on article/guide/homepage (blog-renderer.js + api/index.js + index.html). `jobTitle` still pending real title confirmation.
- [x] /llms.txt: file already existed (`public/llms.txt`) but was **excluded from deploys by `*.txt` in .vercelignore** → fixed with `!public/llms.txt` + `!public/llms-full.txt`. Deployed.

## Medium-Term (next 30-90 days)

- Monthly refresh pass with visible "Updated" dates (top 30 glossary + top 10 articles)
- Reddit presence (2-3 substantive answers/week in creator subreddits)
- LinkedIn company + personal profiles wired into Organization/Person sameAs
- 2-3 guest/roundup placements naming the tool
- Wikipedia/Wikidata entity once secondary sources exist

---

*Report generated 2026-07-31. Scores are heuristic — verify with Search Console and platform-native tools before prioritizing. Google's AI Optimization Guide is the canonical reference; llms.txt and AI-rewriting claims from community sources were excluded per Google's myth-busting guidance.*
