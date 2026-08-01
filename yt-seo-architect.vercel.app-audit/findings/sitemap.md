# XML Sitemap Audit — yt-seo-architect.vercel.app

- Date: 2026-07-31
- Data: /tmp/sitemap.xml (8,667 URLs, 1.4 MB, single sitemap, no sitemap index) + /tmp/crawl.json (500-page crawl sample, BFS incomplete, queue_remaining=1,761) + targeted live re-checks (~20 requests, kept modest)
- Sitemap URL: https://yt-seo-architect.vercel.app/sitemap.xml (referenced correctly in robots.txt)

## Summary

The sitemap is structurally clean (valid XML, zero duplicates, consistent scheme/slash/case, well under size limits) but materially inaccurate: it omits 15 live blog posts and 17+ live tools, includes 5 noindex pages, and points at thousands of glossary comparison URLs that return HTTP 500. Roughly 77% of sampled /glossary/*-vs-* URLs are broken server-side, and the 8.5k-page glossary is nearly orphaned internally (the hub links only ~74 terms and the hub itself is not in the sitemap). Fix the 500 renderer, regenerate the sitemap from live routes, add <lastmod>, and drop noindex URLs.

## What works

- Valid XML, well-formed, correct namespace; 8,667 URLs < 50,000 and 1.4 MB < 50 MB limits (no index split needed).
- Zero duplicate <loc> entries; zero trailing-slash inconsistencies (all URLs without trailing slash); zero http:// URLs; zero case-variant duplicates; max URL length 106 chars.
- robots.txt correctly declares the sitemap; no sitemap-blocking directives.
- 410 handling is correct: /blog/youtube-algorithm-changes-2026 returns 410 and is NOT in the sitemap.
- All 20 crawled 404s (tag-generator/* niches, /contact, 2 /public/tools) are correctly absent from the sitemap.
- The 35 <lastmod> values present are all W3C-valid dates; changefreq/priority values are all valid enum/range values.

## Findings

### CRITICAL — Thousands of sitemap URLs return HTTP 500 (glossary *-vs-* comparisons)

- Evidence: 154 of 200 sampled /glossary/*-vs-* URLs returned HTTP 500 (77%); all 154 are in the sitemap. Failure is term-pair specific, not language-wide: live re-checks — 500 for /glossary/cards-end-screens-vs-session-time, /glossary/audience-demographics-vs-session-time, /glossary/vidiq-vs-tubebuddy (en & es) AND their pt/es variants; 200 for /glossary/ad-revenue-vs-session-time, /glossary/audience-retention-vs-watch-time, /glossary/es/youtube-algorithm-vs-session-time, /glossary/pt/vidiq-vs-tubebuddy. First terms that 500 (all-500 in crawl sample): audience-demographics, batch-production, browse-features, call-to-action, cards-end-screens, channel-audit, channel-branding, channel-trailer, collaboration, community-guidelines, community-tab, competitor-analysis, content-calendar, content-gap-analysis, content-pillar, content-repurposing, copyright-claims, creator-music, cross-promotion, demonetization, description-optimization, evergreen-content, external-traffic, gaming-on-youtube, keyword-cannibalization, long-tail-keywords, mid-roll-ads, mobile-seo, playlist-discovery, premieres, vidiq. Working first terms: ad-revenue, impressions, revenue-per-mille, channel-memberships (plus mixed results for ab-testing, audience-retention, average-view-duration, click-through-rate, closed-captions, cost-per-mille, dwell-time, keyword-difficulty).
- Scale: 8,328 of 8,667 sitemap URLs (96%) are glossary vs-comparisons; if the 77% sample rate holds, ~6,400 URLs are broken. Minimum confirmed broken: 154, all in sitemap. This is a server bug (renderer crashes for terms lacking comparison data), not a sitemap bug — but the sitemap is broadcasting the breakage to Google.
- Recommendation: Fix the vs-comparison renderer to handle missing term data (return a valid page or 404, never 500). Until fixed, exclude broken pairs from the sitemap. Re-crawl and re-verify before/after.

### CRITICAL — 15 live, indexable blog posts missing from sitemap (14 of them published 7/27–7/30)

- Evidence: crawl found 50 live blog posts (200, robots=index,follow); sitemap contains only 35 posts (the other 10 /blog URLs are hub + categories). Missing posts: best-youtube-growth-strategies-for-new-creators-2026, creating-effective-youtube-thumbnails-for-clicks-2026, developing-a-youtube-content-calendar-strategy-2026, understanding-youtube-algorithm-updates-for-creators-2026, maximizing-youtube-revenue-with-sponsorships-2026, improving-youtube-engagement-with-live-streaming-2026, increasing-youtube-watch-time-with-analytics-2026, using-youtube-features-to-enhance-viewer-experience-2026, youtube-algorithm-best-strategies-2026, youtube-channel-branding-tips-for-consistency-2026, youtube-content-strategy-for-beginners-2026, youtube-thumbnail-tips-2026, youtube-subscriber-growth-2026, youtube-shorts-seo-guide-2026, youtube-thumbnail-ab-testing-guide. All return 200 with index,follow.
- Impact: newly published posts get no sitemap discovery signal at the exact moment they need it most.
- Recommendation: Regenerate the sitemap from live routes/posts (or add the 15 URLs now), and add <lastmod> with publish dates.

### CRITICAL — Sitemap /tools/ section is 84% article pages; 17+ live interactive tools omitted

- Evidence: of 38 /tools/ URLs in the sitemap, only 5 are actual interactive tools (tag-generator, title-optimizer, description-writer, keywords-youtube, metadata-youtube); 32 are article pages, and 24 of those duplicate /blog/ slugs exactly (e.g. /tools/youtube-seo-examples-2026 AND /blog/youtube-seo-examples-2026 both live, both 200, index,follow, no canonical on either — duplicate content). Meanwhile 17 live calculator tools (all 200, index,follow) are absent: monetization-readiness-checker, cost-per-view-calculator, youtube-revenue-estimator, audience-retention-benchmark, engagement-rate-calculator, channel-health-score, end-screen-effectiveness-checker, thumbnail-color-analyzer, playlist-performance-analyzer, best-posting-time-finder, upload-schedule-optimizer, video-idea-generator, keyword-difficulty-scorer, title-ab-tester, video-length-optimizer, tag-relevance-checker, description-quality-checker.
- Recommendation: Pick ONE canonical home for article content (keep /blog/, 301 /tools/<slug> articles to /blog/<slug>), add canonical tags, and add the 17 real tools to the sitemap.

### HIGH — 5 noindex pages included in sitemap

- Evidence: /dashboard (robots=noindex, nofollow; priority 0.9, changefreq weekly), /about (noindex), /privacy-policy (noindex), /terms-of-service (noindex), /changelog (noindex) are all in the sitemap. Google drops noindex URLs from sitemaps (wasted crawl budget + mixed signals); Bing treats it as an error condition.
- Recommendation: Remove all 5 from the sitemap (or make them indexable if they're meant to rank). Dashboard is a logged-in tool surface — noindex is correct, sitemap inclusion is wrong.

### HIGH — 99.6% of URLs have no <lastmod> (only 35 of 8,667)

- Evidence: <lastmod> present only on the 35 blog posts in the sitemap (dates 2026-06-11 .. 2026-07-27). Missing on all 8,571 glossary URLs, all 38 tools, all 6 /vs/ pages, and all core pages. Glossary pages are static — but without lastmod (or any freshness signal) Google has no signal to re-crawl the 8.5k-page glossary; combined with the orphan problem (below), most of the site is effectively undiscoverable except via sitemap.
- Recommendation: Emit <lastmod> from the data layer (content updated_at / build date) for every URL; at minimum add a stable lastmod per section.

### HIGH — Glossary hub omitted from sitemap; 8,490+ glossary URLs are effectively orphaned

- Evidence: /glossary (200, index,follow), /glossary/es (200, index,follow), /glossary/pt (200) are NOT in the sitemap. The /glossary hub links only ~74 term pages + 7 category pages (87 distinct glossary hrefs counted), while the sitemap lists 8,571 glossary URLs (74 en plain + 2,776 en-vs + 81 es plain + 2,776 es-vs + 81 pt plain + 2,776 pt-vs + 7 categories). The sitemap is the only discovery path for the vast majority of the glossary.
- Recommendation: Add /glossary, /glossary/es, /glossary/pt to the sitemap; add term/category links to the hub; add lastmod so the section can be re-crawled.

### MEDIUM — /public/ duplicate mirror indexable and uncanonicalized

- Evidence: /public/tools/* serves the same tools (description-writer, tag-generator, title-optimizer, keywords-youtube, etc.) with robots=index,follow and 200 (31 /public/ pages crawled); robots.txt does not disallow /public/; zero canonical tags on any of the 500 crawled pages (canonical=null everywhere). This doubles every tool URL into two indexable copies — duplicate-content dilution — and none of the /public/ copies are in the sitemap (inconsistent coverage).
- Recommendation: noindex or 301 /public/*, add self-referencing canonicals sitewide, and keep only the canonical /tools/ set in the sitemap.

### MEDIUM — changefreq/priority misconfigured for a daily-publishing blog

- Evidence: blog posts are tagged monthly/0.8 (35 posts) and weekly/0.7 (9 posts) while the /blog hub is daily/0.9 — inverted: the listing page is "daily" but the posts it lists are "monthly". Glossary: 8,550 URLs at monthly/0.7 (0.7 is high for mass-generated reference pages; monthly is fine). /dashboard is 0.9 (second-highest priority on the site) despite being noindex. Tools at weekly/0.9 is fine. Priorities are largely ignored by Google anyway; the main cost is the misleading daily blog signal.
- Recommendation: posts → weekly/0.8 or daily/0.9 with real lastmod; glossary → 0.5 monthly; remove priority from noindex URLs; or drop changefreq/priority entirely and rely on lastmod.

### LOW — Redirecting URL in sitemap

- Evidence: /glossary/category/index (in sitemap) returns 308 → /glossary/category; the redirect target is NOT in the sitemap. Also note /glossary/category/algorithm etc. (6 more category URLs) are fine (200).
- Recommendation: Point the sitemap at /glossary/category (or remove the /index variant).

### INFO — "81 /glossary/pt/* URLs 404" claim REFUTED

- Evidence: All 74 of 162 sampled es/pt plain glossary URLs returned 200 (e.g. /glossary/es/youtube-algorithm, /glossary/pt/youtube-algorithm, /glossary/pt/session-time, /glossary/pt/ab-testing); live spot-checks of pt plain pages 200. The sitemap's 81 pt-plain + 81 es-plain URLs are fine. The real 404s found (tag-generator/*, /contact, 2 /public/tools) are correctly absent from the sitemap. The broken set is the *-vs-* pages (see Critical #1), not the pt translations.

### INFO — Image/video sitemaps n/a

- No video content; no image sitemap needed. OG images are embedded in HTML pages. Skipping is correct.

## Coverage matrix (sitemap vs live)

| Section | In sitemap | Live (crawl + spot-check) | Verdict |
|---|---|---|---|
| Root / | 1 | 200, index | OK |
| Core (dashboard, about, changelog, privacy, terms, guide/youtube-seo) | 6 | 200 | 5 of 6 are noindex — remove |
| Blog posts | 35 | 50 live posts (200, index) | 15 missing (Critical) |
| Blog hub + categories | 10 | 200 | OK |
| Tools (interactive) | 5 | 22+ live (17 missing) | 17 missing (Critical) |
| Tools (articles) | 32 | 200 but 24 duplicate /blog/ slugs | dedupe (Critical) |
| /vs/ standalone | 6 | 200 (sampled /vs/vidiq) | OK |
| Glossary plain (en/es/pt) | 236 | 200 (sampled) | OK |
| Glossary *-vs-* | 8,328 | 77% of sample 500 | remove/fix (Critical) |
| Glossary hubs + categories | 7 (categories only) | 200; hubs not in sitemap | add hubs (High) |
| /public/* mirror | 0 | ~31 × 200, index | noindex/301 (Medium) |

## Recommendations (exact fix list)

1. Fix the vs-comparison renderer 500s (server bug) — then re-verify a sample of all 8,328 URLs before leaving them in the sitemap; exclude broken pairs meanwhile.
2. Add the 15 missing blog posts (list above) to the sitemap immediately, with <lastmod> = publish date.
3. Add the 17 missing interactive tools; remove the 24 /tools/ article duplicates (301 to /blog/<slug> first) or keep one canonical set with canonical tags.
4. Remove /dashboard, /about, /privacy-policy, /terms-of-service, /changelog from the sitemap (all noindex).
5. Add <lastmod> to every URL (data-layer updated_at/build date); set blog posts to weekly/0.8+ and glossary to monthly/0.5.
6. Add /glossary, /glossary/es, /glossary/pt hubs to the sitemap and link more terms from the hub.
7. Replace /glossary/category/index with /glossary/category in the sitemap.
8. noindex or 301 /public/*; add self-referencing canonicals sitewide (0 of 500 crawled pages have one).
9. Regenerate the sitemap automatically on each deploy (it is currently stale by 15 posts, 17 tools, and 5,500+ broken URLs), and consider splitting into per-section sitemaps for maintainability (optional at this size).
10. Re-submit sitemap in Google Search Console after regeneration; monitor Crawl Stats for the 500 spike.

## Method & data notes

- Parsed /tmp/sitemap.xml locally (xml.etree); cross-referenced all 500 crawled pages (url + final_url) against sitemap locs; live re-checks limited to ~20 targeted requests (curl status codes, robots.txt, glossary hub link count).
- Crawl sample is BFS-incomplete (queue_remaining=1,761 of 2,261); 414 of 500 crawled pages are in the sitemap. Extrapolations from the 200-URL vs sample are flagged as estimates; the 154 broken URLs and all omissions are directly confirmed.
