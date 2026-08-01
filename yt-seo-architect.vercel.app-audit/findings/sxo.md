# Search Experience (SXO) Audit — yt-seo-architect.vercel.app

Audit date: 2026-07-31 | Method: crawl.json bulk analysis (500 URLs) + 12 live fetches (curl, desktop UA) + sitemap/urls.txt inventory (5,810 URLs; sitemap per technical.md = 8,667 URLs, 8,571 glossary).
Scope: page-type vs SERP-intent match, persona fit, SERP feature opportunities, title/CTR, internal search journeys, mismatch red flags.
Note: broken pages (HTTP 500 / 404) are analyzed for their SEARCH-EXPERIENCE impact; root causes are covered in technical.md.

---

## 1. SERP-intent mapping (page type vs dominant Google intent)

| Page type | Dominant SERP intent | Verdict | Key evidence |
|---|---|---|---|
| Homepage `/` | Brand / transactional ("yt seo architect", "free youtube seo tool") | **Match** | H1 "Your Videos Deserve More Views. 100% Free AI YouTube SEO."; schema: Organization, WebSite, SoftwareApplication, Offer, FAQPage; 30 internal links incl. 21 tools. |
| Glossary term `/glossary/<term>` | Informational ("average view duration meaning") | **Match — best pattern on site** | Definition box directly under H1 ("The average minutes a viewer watches your video before leaving…"); What Is → Why Matters → How to Optimize → Common Questions → Related Terms → Related Blog Posts → Compare → Free Tools. 912 words, 16 glossary + 6 tool + 2 blog links. |
| vs-comparison `/glossary/<a>-vs-<b>` | Commercial investigation ("vidiq vs tubebuddy") | **Mismatch — 76% broken** | 154 of 202 sampled vs- URLs return HTTP 500; sitemap holds ~8.3k vs- URLs. The ~48 that work (e.g. `/glossary/ad-revenue-vs-revenue-per-mille`, 339 words) are well-structured: Quick Answer box + comparison table + "When to Use Each". |
| Tool page `/tools/<tool>` | Transactional ("keyword difficulty checker") | **Mismatch — thin SPA shells** | 16 of 21 tool pages have 98–180 words, zero H2s, zero schema, no form in SSR HTML; `/tools/keyword-difficulty-scorer` literally renders the text "undefined" in the body (visible in snippets). `/tools/tag-generator` (971 words, SSR'd tag chips, HowTo schema) is the exception. |
| Blog post `/blog/<slug>` | Informational ("how to find youtube keywords") | **Match** | TL;DR answer box under meta, TOC, FAQPage schema, inline glossary links, 3 tool links, published+updated dates, ~2,000 words. |
| /tools hub | Transactional hub | **Match** | Title "Free YouTube SEO Tools — 90+ Tools", 6 category H2s + filter UI. No ItemList schema. |
| /blog hub | Informational hub | **Partial match — quality blemish** | Title + "49 guides · Free" fine, but 14 newest post cards display "0 words · 7/30/2026". No Blog/ItemList schema. |
| /glossary hub | Informational hub | **Partial match — scale mismatch** | CollectionPage schema ✓, 75 terms in 6 categories with i18n links — but sitemap advertises 8,571 glossary URLs, ~99% of them vs-pages, most broken. Hub shows "75+ Terms Defined" while the crawlable index is dominated by errors. |
| /pricing | Navigational / commercial ("yt seo architect pricing") | **Mismatch — renders the app dashboard** | H1 "Command Center", "Coach Mode: Restricted", 52 inputs, 3 mentions of price/free/plan, title "YT SEO Architect - 2026 YouTube SEO Optimization Platform" (no pricing keyword), no schema. Also: homepage nav has NO Pricing link (Tools / Blog / Glossary / Dashboard only) — the only pricing anchor is `#pricing` on the homepage. |

---

## 2. Findings by severity

**CRITICAL — Broken commercial-investigation pages: users clicking "X vs Y" SERP results get server errors**
Evidence: 154 of 202 sampled `-vs-` URLs return HTTP 500 (crawl.json); live re-fetch of `/glossary/vidiq-vs-tubebuddy` → 500 (64-byte error body). Sitemap contains ~8,328 vs- URLs (technical.md), so ~3.3k–7.7k URLs are affected. "vidiq vs tubebuddy" is a classic high-intent commercial query; every impression won is a 100% bounce. Google treats repeated 500s as soft-404s and may deindex the whole vs- family, dragging crawl trust down site-wide.
Recommendation: fix the lookup bug (technical.md) AND, until fixed, remove broken vs- URLs from the sitemap; serve a real 404 (never 500) for missing terms. Audit all 5,554 vs- URLs in urls.txt against the live status of their two constituent terms.

**CRITICAL — /pricing serves the dashboard, not pricing: navigational intent met with an app shell**
Evidence: live fetch of `/pricing` returns 215 KB HTML of the "Command Center" dashboard (H1 "Command Center", "Coach Mode: Restricted", 52 inputs, 0 pricing-oriented H2s, title without "pricing"/"free" keyword, no FAQ/Offer schema). A searcher typing "yt seo architect pricing" lands on a login-gated-looking app with no explanation of cost (product is free — the homepage `#pricing` section says "NO PAYWALLS … 100% free … Launch Free Dashboard Now", but that copy never appears on /pricing itself).
Recommendation: point /pricing at a real pricing/free-positioning page (or 301 it to the homepage `#pricing` anchor); add Offer/FAQPage schema; add "Pricing" to the main nav so the anchor and URL agree.

**HIGH — Transactional tool pages are contentless shells; one renders the literal string "undefined"**
Evidence: 16 of 21 /tools/* pages have 98–180 words, no H2s, no JSON-LD, no form/input in SSR HTML (tool UI is 100% client-side). `/tools/keyword-difficulty-scorer` body: "Score any YouTube keyword for competition and opportunity. Find low-competition keywords that are easier to rank for. undefined 🚀 More Free Tools…" — the "undefined" is a render bug that Google can pull straight into the meta/snippet. A beginner searching "keyword difficulty checker" sees a ~100-word page that cannot demonstrate the tool without JS.
Recommendation: SSR a real form + 150–300 words of usage guidance ("How to use", example scoring, FAQ) per tool; fix the undefined render; add WebApplication + FAQPage schema. Model: `/tools/tag-generator` (971 words, SSR'd tag chips above the fold, HowTo schema, FAQ section, 5 tool + 4 blog links).

**HIGH — Homepage links to 404 niche tag pages (dead ends from the strongest page on the site)**
Evidence: homepage HTML links `/tools/tag-generator/{vlog,travel,roblox,fortnite,minecraft,…}`; all 17 sampled `/tools/<tool>/<param>` URLs return 404 (crawl.json). These are visible homepage CTAs ("tag generator for gaming/minecraft/…") that die on click.
Recommendation: either make niche URLs render real pages (SSR'd tag lists + guide content) or relink to the working `/tools/tag-generator` with the niche as a query param (`?niche=gaming`). Never link a 404 from the homepage.

**HIGH — Duplicate page pairs with zero canonical signals let Google choose the SERP face**
Evidence: 325/325 crawled 200-pages have NO canonical tag. Live-verified duplicate pairs with identical titles: `/glossary` vs `/public/glossary` ("YouTube SEO Glossary — 75+ Terms Defined"), `/tools` vs `/tools.html`, `/about` vs `/about.html`, `/privacy-policy` vs `/privacy-policy.html`, `/dashboard` vs `/dashboard.html`. A parallel `/public/tools/*.html` copy set (31 pages, 2×404, blog-slug titles like "Youtube shorts algorithm 2026 — Free Interactive Tool") competes with `/tools/*`.
Recommendation: self-referencing canonicals everywhere; 301 the `.html` variants and `/public/*` copies to canonical routes; consolidate duplicate title/H1 pairs. (See technical.md for crawl-level detail.)

**HIGH — Blog hub cards display "0 words" for the 14 newest posts**
Evidence: `/blog` HTML shows cards like "Understanding Youtube Algorithm Updates For Creators 2026 **0 words** · 7/30/2026" (word-count field unpopulated for recent posts; older cards show real counts 1,548–3,207). Visible to users and crawlers; undermines the "Expert guides" positioning and looks broken in snippets.
Recommendation: compute word counts at build/publish time; fall back to a fixed label ("Guide") when missing; add Blog/ItemList schema to the hub.

**MEDIUM — FAQ content exists without FAQPage schema where PAA traffic is winnable**
Evidence: `/tools/tag-generator` has an H2 "Frequently Asked Questions" but no FAQPage schema (only WebApplication/Offer/HowTo). Glossary term pages have a "Common Questions" H2 and Article/WebPage schema — no FAQPage. Meanwhile `/blog/*` posts and `/vs/vidiq` DO ship FAQPage. Inconsistent; glossary + tools are exactly the pages where "People Also Ask" overlap (definition-style queries) is highest.
Recommendation: emit FAQPage (with Question/Answer) wherever a FAQ/Common Questions block exists — glossary terms, vs pages, tool pages, tag-generator.

**MEDIUM — Working vs pages have no conversion path (and no blog cross-links)**
Evidence: `/glossary/ad-revenue-vs-revenue-per-mille` (200): 1 tool link, 0 blog links, 0 product CTAs, no FAQ section; 339 words. The comparison itself is well done (Quick Answer box above the fold, comparison table, "When to Use Each"), but commercial-investigation searchers comparing concepts get no bridge to the product. Contrast: glossary term pages link 5–6 relevant tools ("🛠️ Free Tools for Average View Duration (AVD)").
Recommendation: on every 200 vs page add (a) a "Which tool helps with this" block linking 1–2 relevant /tools pages, (b) a soft CTA to the dashboard, (c) 2–3 related blog links, (d) FAQ section + schema.

**MEDIUM — Title/CTR: truncation risk + keyword/title gaps on key templates**
Evidence: mean title length 64.5 chars; 198/500 titles >60 chars. Glossary template "Average View Duration (AVD) — YouTube SEO Glossary | YT SEO Architect" puts the keyword first (good) but burns ~40 chars on suffix/brand, guaranteeing truncation on desktop SERPs for longer terms. `/tools/tag-generator` title is "Best YouTube Tags — YT SEO Architect" — the URL's primary keyword "tag generator" is absent. Tool titles are inconsistent ("Title ab tester — Free Interactive Tool" vs "YouTube Revenue Calculator — Estimate Ad Earnings Free"; a /public copy is "How to keywords youtube — Free Interactive Tool"). 238 of 325 pages have title≈H1 (no SERP/H1 differentiation).
Recommendation: cap titles at ~55 chars (drop "| YT SEO Architect" to "— YT SEO" or end-state brand only on money pages); align each tool title to its slug keyword + intent modifier ("Free" / "Calculator" / "Checker"); fix casing; vary H1 from title where natural.

**LOW — Sitelinks searchbox schema present but likely ineligible**
Evidence: homepage WebSite schema declares SearchAction → `https://yt-seo-architect.vercel.app/dashboard?q={search_term_string}`. The dashboard is the app, not a public site search (no /search route found in crawl; dashboard requires the app context). Google requires public, crawlable search results for the sitelinks searchbox feature.
Recommendation: either implement a public /search?q= endpoint (great SXO win for a 8.6k-page index) or remove the SearchAction to avoid a schema/feature mismatch.

**INFO — Thin-page index bloat in /public/tools/*.html set**
Evidence: 31 pages, 98–180 words each, several 404 (e.g. 2 in crawl sample); titles are blog-slug-turned-tool ("Youtube metadata auditor vs vidiq shadow ban — Free Interactive Tool"). Adds crawl budget + duplicate-SERP risk without serving transactional intent. Recommendation: 301 to /tools/* routes or delete; keep only genuinely interactive tools.

**INFO — One blog page has anomalous 573k-word crawl reading**
Evidence: `/blog/creating-effective-youtube-thumbnails-for-clicks-2026` word_count 573,371 (likely embedded JSON/image data inflating content length; /pricing is 215 KB for the same reason). Verify payload size on that post; if it's inline data, move it out of the HTML (perf + crawl efficiency).

---

## 3. Persona scoring — quick creator (beginner YouTuber)

| Surface | Level fit | Notes |
|---|---|---|
| Glossary definitions | ✓ Excellent | 1–2 sentence plain-language definitions ("The average minutes a viewer watches your video before leaving"), no jargon walls; i18n ES/PT links. |
| Blog posts | ✓ Good | TL;DR box, TOC, step-by-step blueprints, glossary tooltips; ~2k–3k words is appropriate for "how to" intent. |
| tag-generator | ✓ Good | Tags SSR'd instantly, "About These YouTube Tags" + 2026 guide + FAQ — beginner can use it with zero explanation needed. |
| Tool SPAs (16 pages) | ✗ Fails | No content to assess readability against; a beginner landing on keyword-difficulty-scorer sees an input, a one-liner, and "undefined". No example, no "how to use", no interpretation of the score. |
| /pricing | ✗ Confusing | Beginner clicking "pricing" gets a command-center dashboard with "Coach Mode: Restricted" — reads as a locked paywall, directly contradicting the free positioning. |
| Broken vs pages | ✗ Fails | Beginner comparing tools/concepts hits raw 500 errors — perceived as "site is dead". |

Readability mismatch evidence: the gap is not tone but *absence* — 45 crawled pages under 200 words, of which 37 are tool pages (transactional intent) that offer a beginner zero orientation.

---

## 4. SERP feature opportunities

| Page type | Winnable features | Current status |
|---|---|---|
| Glossary term | **Featured snippet** (definition box is the ideal snippet format; "What Is…" H2 + 40-60 word answer), PAA via Common Questions | Definition box ✓; FAQPage schema ✗ (add it) |
| vs page (200) | Featured snippet (Quick Answer + comparison table = table snippet), PAA | Quick Answer + table ✓; FAQ ✗; snippet-format text could be tightened to 40–60 words |
| Blog post | Featured snippet (TL;DR box), PAA (FAQPage ✓ already) | Snippet-ready ✓ |
| Tool page | HowTo / WebApplication, FAQ, sitelinks for brand tools | tag-generator ✓ (HowTo); 16 others ✗ (no schema, no content) |
| Hubs | ItemList (/tools), Blog schema (/blog), CollectionPage (/glossary ✓), sitelinks (after canonicals fixed) | CollectionPage ✓ only |
| Homepage | FAQPage ✓, SoftwareApplication ✓, sitelinks searchbox (needs public search) | Schema-rich; searchbox ineligible today (see LOW above) |
| Video carousel | n/a (no on-page video; if demo video added to homepage "Under 2 Minutes" section, YouTube video schema becomes relevant) | — |

---

## 5. Internal search journeys (SERP → page → product)

Journey A — WORKS (the model journey):
SERP "average view duration" → `/glossary/average-view-duration` (200, definition box above fold) → "🛠️ Free Tools for Average View Duration (AVD)" with 5 relevant tools (audience-retention-benchmark, engagement-rate-calculator, tag-generator, title-optimizer, channel-health-score) → tool → nav "Dashboard". No dead end; commercial bridge present.

Journey B — DEAD END (high volume):
SERP "vidiq vs tubebuddy" / "tubebuddy vs vidiq" → `/glossary/vidiq-vs-tubebuddy` → HTTP 500. Even the working variant route `/vs/vidiq` (200, FAQPage ✓) links 0 tools and 0 product CTAs — user reads the comparison and leaves.

Journey C — DEAD END (from homepage):
Homepage → "Tag Generator for Minecraft" card → `/tools/tag-generator/minecraft` → 404. The site's strongest page funnels users into errors.

Journey D — WORKS:
Blog post "How to Find YouTube Keywords…" → inline glossary links (10) + "Keyword Research Tools Compared" + 3 tool links → tools. FAQPage + TL;DR make it snippet-competitive; tool links are contextual.

Journey E — DEAD END (navigational):
SERP "yt seo architect pricing" → `/pricing` → dashboard shell ("Coach Mode: Restricted"), no pricing copy, no visible signup CTA in SSR HTML.

Gaps summary: blog→glossary→tools wiring is genuinely good; the broken links are (1) SERP→vs- pages (500s), (2) homepage→niche tag pages (404s), (3) /pricing→dashboard, (4) contact intent (`/contact.html` → 404; no working contact page in crawl). Glossary and vs pages lack a direct "Get Started / Launch free dashboard" CTA — every healthy content page should end with one.

---

## 6. What works

- Glossary term pages are a near-perfect informational pattern: definition box above the fold, logical H2 ladder, rich internal links (16 glossary + 6 tools + 2 blog), i18n links.
- Blog posts ship snippet-first structure (TL;DR box, FAQPage schema, glossary inline links, dates, 3 tool CTAs).
- Homepage schema stack (Organization/WebSite/SoftwareApplication/Offer/FAQPage) and 21 tool links support brand-intent SERPs.
- tag-generator proves the tool-page pattern is achievable (SSR'd results, HowTo schema, FAQ, 971 words).
- Working vs pages have the right skeleton (Quick Answer, comparison table, When-to-Use) — they just need conversion bridges and the 500s fixed.
- 325/325 crawled 200-pages have meta descriptions; H1 counts are clean (1 per page in samples).

---

## Summary

The site's informational layer (glossary terms, blog) matches SERP intent well and is snippet-optimized; its commercial layer is broken — 76% of vs- pages (the bulk of the 8.5k-URL index) return 500, /pricing serves the dashboard instead of pricing, and 16 tool pages are sub-200-word shells (one renders "undefined" in the snippet). Fix order: (1) stop 500s / prune sitemap, (2) real /pricing page + nav link, (3) SSR content + schema on tool pages, (4) fix homepage 404 links, (5) canonicals + consolidate duplicates, (6) add FAQPage schema to glossary/vs/tool pages, (7) add product CTAs to healthy vs pages and cap titles at ~55 chars.
