# Content Quality / E-E-A-T Audit — yt-seo-architect.vercel.app

Auditor: Content Quality / E-E-A-T specialist
Date: 2026-07-31
Method: /tmp/crawl.json absent at audit time — crawled live with curl (~35 pages: homepage, about, blog index, 8 blog posts, 10 glossary pages, 5 tool pages, 2 /vs/ pages, privacy, terms, changelog, robots, sitemap) + full sitemap inventory (5,810 URLs). Word counts are main-content text extractions (scripts/styles stripped).

Site inventory (sitemap.xml): 5,714 /glossary/ URLs (~2,857 EN + ~2,857 ES), 44 /blog/ URLs (35 posts + 9 category pages), 37 /tools/ URLs, 6 /vs/ URLs, 9 top-level pages.

---

## CRITICAL

**CRITICAL — 14 newly published blog posts are bulk-AI template content with fabricated "research" (scaled content abuse)**
- Evidence: /blog/ index (https://yt-seo-architect.vercel.app/blog) lists 14 posts dated 7/27–7/30/2026 that are NOT in sitemap.xml and show "0 words": understanding-youtube-algorithm-updates-for-creators-2026, using-youtube-features-to-enhance-viewer-experience-2026, best-youtube-growth-strategies-for-new-creators-2026, creating-effective-youtube-thumbnails-for-clicks-2026, developing-a-youtube-content-calendar-strategy-2026, improving-youtube-engagement-with-live-streaming-2026, increasing-youtube-watch-time-with-analytics-2026, maximizing-youtube-revenue-with-sponsorships-2026, youtube-algorithm-best-strategies-2026, youtube-channel-branding-tips-for-consistency-2026, youtube-content-strategy-for-beginners-2026, youtube-shorts-seo-guide-2026, youtube-subscriber-growth-2026, youtube-thumbnail-tips-2026.
- Observed (fetched 2): understanding-youtube-algorithm-updates-for-creators-2026 (~2,400 words) opens with "Direct Answer: Understanding Youtube Algorithm Updates For Creators 2026 gives you the exact strategies used by top YouTube creators to grow their channels in 2026" (title restated as content) and a fabricated study: "we conducted a comprehensive investigation... we chose to study a total of 15 channels across various niches... combined subscriber base of over 10 million users and a total view count of over 1 billion" — no channel names, no data, no methodology. TL;DR grammar broken: "Learn how to understanding youtube algorithm updates for creators 2026." youtube-thumbnail-tips-2026: "Learn how to youtube thumbnail tips 2026."
- Recommendation: unpublish or fully rewrite all 14 posts before Google indexes them. If they are drafts, fix the publish pipeline so drafts aren't served publicly. Never present invented channel studies as research — replace with real, verifiable case data or remove the "How We Tested This / What the Data Shows" template.

**CRITICAL — Fabricated performance claims presented as fact; "social proof" section is empty**
- Evidence: homepage (/) "Built for Real Results — 30-50% Average CTR improvement after optimization, 2-4 Weeks typical time to see ranking improvements"; FAQ "Creators who optimize... see 30-50% higher CTR"; blog "Our analysis of 10,000+ YouTube titles found... Titles with specific numbers get 36% higher click-through rates." Homepage section header "Trusted by YouTube Creators" contains ZERO testimonials/logos/quotes — it is an empty heading followed by the privacy section.
- Observed: no case studies, no named customers, no screenshots of real channel results anywhere on the site; the only "screenshots" are mock dashboard UIs with sample data (e.g., keyword table "best drone for beginners 2026 12K...").
- Recommendation: remove or substantiate every metric. Add real, named (with permission) case studies, before/after screenshots with timestamps, or link to verifiable public data. Replace the empty "Trusted by" section with actual testimonials or delete it.

---

## HIGH

**HIGH — Glossary "How to Optimize" sections are 4–6 shared boilerplate templates reused across ~2,857 EN pages (large duplicated content mass)**
- Evidence: 10 sampled glossary pages (e.g., /glossary/audience-retention, /glossary/click-through-rate, /glossary/competitor-analysis, /glossary/content-pillar, /glossary/evergreen-content, /glossary/keyword-cannibalization, /glossary/long-tail-keywords, /glossary/video-chapters, /glossary/youtube-algorithm, /glossary/youtube-shorts) share near-identical 250–400-word "How to Optimize" blocks in 4 visible groups, e.g.:
  - Group A (audience-retention, click-through-rate): "start by checking your current baseline in YouTube Studio Analytics... Set a specific target — for example, increase by 10% over the next 30 days..."
  - Group B (competitor-analysis, content-pillar, evergreen-content): "start by defining your channel's core topic pillars — the 3-5 subjects you'll consistently create content about... balancing evergreen content (60-70%)..."
  - Group C (keyword-cannibalization, long-tail-keywords, video-chapters): "start with a full audit of your existing content to find current optimization gaps. Use YT SEO Architect's free SEO audit tool..."
- Observed absurdity: /glossary/evergreen-content's "How to Optimize" advises balancing "evergreen content (60-70%)" — template text self-referential to the wrong term; /glossary/keyword-cannibalization opens "To implement effective keyword cannibalization" (grammatically wrong).
- Recommendation: rewrite each term's optimization section from scratch (or at minimum per-group uniqueization with term-specific tactics). Duplicated blocks across thousands of pages dilute ranking power and trigger quality classifiers.

**HIGH — Glossary "Related Blog Posts" blocks link to dead URLs (404/410) across the corpus**
- Evidence: /glossary/youtube-algorithm and /glossary/click-through-rate link to /blog/youtube-algorithm-changes-2026 → HTTP 410 Gone; /glossary/youtube-shorts links to /blog/youtube-shorts-monetization-requirements-2026 → HTTP 404. Sampled 10 pages; 2 of 10 contain broken related-blog links → projected ~500+ broken internal links across the glossary.
- Recommendation: audit every /glossary/* → /blog/* mapping and point to live posts only; add a redirect or remove the block when no related post exists.

**HIGH — Title tag bug: duplicated "2026 2026" on indexable posts**
- Evidence: /blog/youtube-seo-for-music-channels-2026 title tag = "Youtube Seo For Music Channels 2026 2026 — YT SEO Architect" (63 chars); /blog/youtube-seo-for-cooking-channels-2026 = "Youtube Seo For Cooking Channels 2026 2026 — YT SEO Architect". Both are in sitemap.xml (indexable).
- Recommendation: fix title generation to avoid appending "2026" when the slug already ends in 2026; sweep all 49 posts for the pattern.

**HIGH — No named human expertise anywhere: About page anonymous, bylines are brand, author identity inconsistent**
- Evidence: /about (https://yt-seo-architect.vercel.app/about) — "Why I Built This" personal quote with NO name, no photo, no credentials, no team, no LinkedIn/social links; footer contact is a bare Gmail "Questions? thiza3062@gmail.com". Blog bylines read "By YT SEO Architect" (brand); an author box naming "Patrick — Founder of YT SEO Architect... Previously helped 500+ creators" appears on only 2 of 4 sampled posts (youtube-title-examples-2026, youtube-seo-examples-2026 — the latter also has a typo "tool s"); the 14 new posts show "YT SEO Architect Team" in the author box while their JSON-LD Article schema says "author": {"name": "Patrick"}. Privacy Policy and ToS name no legal entity (no company, no address); ToS mentions "subscription terms" for a product positioned as 100% free.
- Recommendation: publish a named founder page (photo, bio, credentials, links), make author attribution consistent between visible byline, author box, and schema (Person with url), use a branded domain email instead of a personal Gmail, and state the operating entity in Privacy/ToS.

**HIGH — Meta descriptions missing on core tool pages and templated/over-long elsewhere**
- Evidence: /tools/tag-generator (title 36 chars "Best YouTube Tags — YT SEO Architect") and /tools/title-optimizer have NO meta description (0 chars); /tools/description-writer also none. Glossary meta descriptions are 229–246 chars (truncated in SERPs at ~155) with identical boilerplate suffix "Learn what [Term] means, w..." (e.g., /glossary/youtube-algorithm 236 chars; /glossary/youtube-shorts 241 chars). Blog post how-youtube-algorithm-works-2026 description: "Learn how to how youtube algorithm works 2026. Step-by-step guide..." — broken grammar + keyword stuffing.
- Recommendation: write unique 150–160-char descriptions for every tool page and glossary page (drop the templated suffix), and fix the "Learn how to [title]" generation template.

---

## MEDIUM

**MEDIUM — Blog → tools internal linking is nearly absent (no hub-and-spoke to the product)**
- Evidence: /blog/youtube-title-examples-2026 (3,081 words, 90 internal links) contains exactly 1 link to a tool page (/tools/youtube-title-examples-2026) plus /tools/ index; glossary pages link to 25–28 unique internal pages but almost exclusively other glossary terms. Blog posts sampled link to /glossary/ 8 times but to /tools/ 1–2 times.
- Recommendation: add contextual in-article links to the relevant free tools (title optimizer, tag generator, description writer) in every post — this is the site's core conversion path.

**MEDIUM — Keyword cannibalization: identical slugs live under both /blog/ and /tools/**
- Evidence: same keyword targets duplicated across sections, e.g., /blog/best-youtube-seo-tools-2026 vs /tools/best-youtube-seo-tools-2026; /blog/youtube-analytics-explained-2026 vs /tools/youtube-analytics-explained-2026; /blog/youtube-community-posts-strategy-2026 vs /tools/youtube-community-posts-strategy-2026; /blog/youtube-for-small-channels-2026 vs /tools/youtube-for-small-channels-2026 (verified: 8+ shared slugs of 37 tools).
- Note: content is NOT duplicated (blog = 2,882–3,011-word articles; tools = 119–164-word interactive landing pages; diff ratio 0.008–0.02) — but two pages targeting the same query split authority.
- Recommendation: differentiate intent (tools pages should target "free tool" queries, blog posts the informational query) with distinct titles/metas and cross-linking.

**MEDIUM — Glossary readability is college-level (FK grade 14–16), wrong for beginner creators**
- Evidence: FK grade: /glossary/keyword-cannibalization 16.0 (avg sentence 23.2 words, 42% long words), /glossary/youtube-algorithm 14.0 (avg 21.0 words); blog posts 10.4–11.9; homepage 10.0; about 10.4.
- Recommendation: shorten glossary sentences to ≤18 words and target grade 8–10; the audience is explicitly beginners ("first 100 subscribers").

**MEDIUM — Inconsistent product claims: "90+ tools" vs "17 tools" vs sitemap**
- Evidence: /tools/ index (https://yt-seo-architect.vercel.app/tools) says "90+ AI-powered tools"; homepage and /about say "17 AI-powered tools"; sitemap contains 37 /tools/ URLs; /tools/ index links to ~32 /public/tools/* URLs (canonicalized to /tools/* routes — correct, but these URLs are not in the sitemap). Changelog says "50+ keyword-seeded tool pages".
- Recommendation: reconcile the number used in marketing copy with what's actually live and sitemapped.

**MEDIUM — 14 new blog posts missing from XML sitemap; blog index shows "0 words" for them**
- Evidence: sitemap.xml contains 35 blog posts (44 /blog/ URLs incl. categories); the /blog/ index lists 49 guides, the 14 newest (7/27–7/30) absent from sitemap and displaying "0 words · 7/29/2026" (they actually contain ~2,300–2,650 words — display bug in the word-count field).
- Recommendation: regenerate sitemap after publishing and fix the index word-count field.

**MEDIUM — Freshness signals stale: changelog and homepage "actively maintained" stamp**
- Evidence: /changelog last entry May 12, 2026 (2.5 months old at audit); homepage footer "✅ Updated May 2026 — actively maintained"; glossary sitemap entries have no lastmod at all (only blog posts do).
- Recommendation: publish changelog entries for the 14 new posts and tool updates; add lastmod to glossary URLs or remove changefreq signals.

---

## LOW / INFO

**LOW — Blog title tags too long (truncation in SERPs)**
- Evidence: /blog/what-does-youtube-ctr-actually-mean title = 95 chars; /blog/youtube-title-examples-2026 = 96 chars; /blog/youtube-seo-examples-2026 = 86 chars (Google truncates ~60). Several glossary titles 65–69 chars (/glossary/video-chapters 69, /glossary/click-through-rate 66, /glossary/keyword-cannibalization 65). /tools/tag-generator title only 36 chars and weak ("Best YouTube Tags").
- Recommendation: keep titles 50–60 chars; move brand suffix to the end and cut it where needed.

**LOW — Duplicate H1 bug on blog post**
- Evidence: /blog/youtube-seo-examples-2026 renders the H1 "7 Real YouTube SEO Examples That Boost Rankings in 2026 (With Data)" 15 times in the DOM (repeated section headings).
- Recommendation: ensure a single H1 per page.

**LOW — Factual error: "YouTube Shorts (up to 60 seconds)"**
- Evidence: /glossary/youtube-shorts definition and FAQ: "vertical short-form videos (up to 60 seconds)" — outdated since Oct 2024 when YouTube extended Shorts to 3 minutes; no mention of 3-minute limit anywhere on the page. Likely repeated across ES versions and related content.
- Recommendation: update the definition corpus (EN + ES).

**LOW — Homepage renders "0 AI Tools" stat and leftover pricing UI**
- Evidence: homepage hero stat block shows "0 / AI Tools" in raw HTML (animated counter, no-JS value 0); footer contains a hidden "Upgrade Your Plan — Select your plan below. Cancel" pricing dialog, contradicting "100% free, no subscription plans" copy; ToS retains "subscription terms". Homepage has "Skip to pricing" skip-link with no pricing section.
- Recommendation: set sensible no-JS fallback values and remove the legacy pricing modal + ToS references.

**INFO — /vs/ pages are thin and self-declared winners**
- Evidence: /vs/vidiq and /vs/tubebuddy: 366–377 words, table + FAQ; "🏆 Winner: YT SEO Architect" banner and "8.5/10 vs 8/10" scores with no methodology; no author/date/last-updated; no external links to the compared products' pricing pages.
- Recommendation: add sourced pricing/feature citations and a published date; consider an "honest trade-offs" framing for credibility.

**INFO — Positive technical hygiene observed**: canonical tags on all sampled pages; hreflang en/es pairs + x-default on glossary (verified /glossary/es/youtube-algorithm serves proper Spanish, 2,857 ES pages); robots.txt clean (blocks /_next/, /api/, template paths); 404s return proper status; /public/tools/*.html 308-redirects to canonical /tools/ routes; JSON-LD Article/FAQPage/Organization/Person present on blog posts with datePublished; privacy policy has effective date and clear OAuth data-handling language; blog posts carry visible publish date, read time, and "Updated" badges.

---

## What works

- Glossary template is substantively strong: 836–1,040 words per page with plain-language definition, quick-facts table, "why it matters," FAQ, 25–28 unique related-term links, and related blog links — far from the "~200-word thin page" pattern common in programmatic glossaries. The problem is template duplication inside the corpus, not thinness.
- The 35 older blog posts (7/22–7/27) are well-structured long-form (2,200–3,200 words) with TL;DR, TOC, share buttons, FAQ sections, and schema — good E-E-A-T scaffolding if authorship is made real.
- Clean internationalization: full Spanish glossary with correct hreflang, so ES pages don't compete as duplicates.
- Trust-page basics are present: privacy policy (effective date, no-data-selling, OAuth transparency), terms, 404 handling, canonicalization, and robots policy that explicitly welcomes AI crawlers.
- Free tool pages (tag-generator 971 words, title-optimizer 855 words) include genuinely useful guidance sections ("Complete Guide to YouTube Tags in 2026") rather than bare tool UIs.

## Summary

The site's foundation (architecture, sitemap, canonical/hreflang hygiene, schema, and glossary page depth) is well above typical programmatic-SEO quality, and the older 35 blog posts are credible long-form content. However, two critical problems threaten the whole domain: (1) 14 freshly published blog posts are obvious bulk-AI template content with invented "channel studies" and broken grammar — classic scaled content abuse that can trigger sitewide manual action; and (2) the entire trust layer is anonymous — no named founder on About, brand-only bylines, inconsistent author attribution between visible text and schema, a personal Gmail as the only contact, and unsourced "30-50% CTR" claims with an empty "Trusted by" section. Compounding issues: boilerplate "How to Optimize" blocks duplicated across ~2,857 glossary pages, broken related-blog links to 404/410 URLs, missing meta descriptions on the three core tool pages, "2026 2026" title bugs on indexed posts, and stale changelog/freshness signals. Priorities: unpublish/rewrite the 14 template posts, name and consistently attribute a real author, remove or substantiate fabricated data, then deduplicate glossary boilerplate and fix the dead links.
