# Fresh Full SEO Audit — YT SEO Architect

**URL:** https://yt-seo-architect.vercel.app
**Audit date:** 2026-08-03 19:51 SAST
**Method:** `/seo audit` — 10 parallel subagent analyses (technical, content, schema, sitemap, performance, visual, GEO, SXO, backlinks, cluster) on live site + raw HTML + headers
**Data caveats:** No Google API creds (no field CWV / GSC data), no Moz/DataForSEO (backlinks Tier-0 only), PageSpeed API rate-limited (CWV estimated from structure/weight).

---

## SEO Health Score: 62 / 100

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 72 | 15.8 |
| Content Quality | 23% | 50 | 11.5 |
| On-Page SEO | 20% | 60 | 12.0 |
| Schema / Structured Data | 10% | 75 | 7.5 |
| Performance (CWV) | 10% | 60 | 6.0 |
| AI Search Readiness | 10% | 69 | 6.9 |
| Images | 5% | 45 | 2.3 |
| **Total** | | | **62 / 100** |

Sub-dimensions from specialists: Content quality 62 · E-E-A-T **38** · AI citation readiness 55 · GEO 69 · SXO 47 · Backlinks **INSUFFICIENT DATA (effectively 0 dofollow)** · Technical 72 · Performance LCP ~2.8–3.5s / INP ~350–500ms / CLS ≤0.15.

**Bottom line:** A technically sound, fully server-side-rendered site with excellent security, clean URLs, an exemplary AI-crawler policy, valid schema, and multilingual hreflang. What holds it back is **identity and authority**: no human authors, uncited statistics, zero dofollow links, no owned domain, a mass-generated content profile, and a homepage that serves three search intents at once. The site does NOT have the SPA-indexability problem — that fear is unfounded (verified: identical raw HTML to all UAs).

---

## CRITICAL (blocks ranking / trust / risks penalty)

**C1. Broken contact funnel — every "Contact" link 404s.**
`/contact.html` → 308 → `/contact` → **404**. Present in footer and nav of every page. A SaaS with no working contact page fails a core trust signal and leaks conversion.
Evidence: curl chain (sitemap agent). Fix: build `/contact` or retarget the link; this is a 1-line + small-page fix.

**C2. 24 identical blog↔tools URL pairs with no canonical → cannibalization.**
Same article served at `/blog/<slug>` AND `/tools/<slug>` (confirmed: `youtube-tags-2026`, `youtube-shorts-seo-ranking-guide-2026`, retention-graph, shadow-ban), no rel=canonical/robots on either twin. Google must guess; PageRank splits. THINK: one keyword = one canonical URL. Fix: pick one home per topic (keep `/tools/*` for interactive tools, 301 the `/blog/*` twin), enforce in the build.

**C3. Zero dofollow backlink equity; site not discoverably indexed.**
Only inbound link = developer's own GitHub profile, `rel="nofollow"`. Not in Common Crawl, zero Wayback snapshots, Bing shows only fuzzy non-matches. Google indexation unverified but every free signal says "not yet discovered." A ~2-month-old SaaS cannot rank for saturated "youtube tag generator" terms with 0 passing links.
Fix (in order): owned domain → submit sitemap to GSC (already verified) + Bing → Product Hunt launch → first real third-party links (AI/tool directories, creator-economy PR).

**C4. Programmatic content-abuse profile: 18,006 glossary URLs = 99.5% of sitemap.**
~5,895 en + 6,002 es + 6,002 pt auto-generated terms, ~300 `browse-features-vs-*` comparison pages (classic doorway pattern), templated tool descriptions ("Analyze your text for SEO keywords…" repeated ~16×; 3 tools empty), slug-injected blog descriptions in llms.txt. This is exactly the profile AI Overviews and core updates deprioritize.
Fix: gate es/pt quality (locale-native copy, not MT) or trim to en; remove/differentiate the `browse-features-vs-*` cluster; split glossary into its own `<sitemapindex>` entry; verify every term page has 200+ genuinely unique words.

**C5. Uncited statistics presented as fact → misinformation + E-E-A-T collapse.**
"a study by Pew Research found that 70% of what people watch is determined by the algorithm" (not hyperlinked, and not a real Pew finding as phrased), "19 minutes of daily viewing", "TubeFilter survey 60% of creators" — zero reference links anywhere; the only outbound links on the algorithm post are Amazon Associates affiliate URLs.
Fix: every statistic gets an inline link to a primary source or is removed. This is the single biggest credibility threat.

**C6. No named human author or entity anywhere.**
Every post bylined "By YT SEO Architect"; author box is a company blurb; no meta author; About names no founder; E-E-A-T weighted score **38/100**. Experience 40, Expertise 30, Authoritativeness 25, Trust 55.
Fix: named human author + photo + credentials per post, author bio page, link every article.

---

## HIGH (fix within 1 week)

**H1. Canonicals point at 308-redirecting `.html` aliases.**
`/tools` canonical → `tools.html` (308→`/tools`); `/dashboard` → `dashboard.html`; `/public/glossary` → `glossary/` (308→`/glossary`). Self-inflicted redirect hop dilutes the canonical signal. Fix: emit the clean canonical everywhere; add a test that canonical never points at a 3xx.

**H2. Performance: 536KB single dashboard JS bundle + 161KB render-blocking CSS → LCP ~2.8–3.5s, INP ~350–500ms.**
`dashboard--riZiMwk.js` ships every feature's code on first paint (17 tools, no code-splitting). `style.css` (161KB) is render-blocking on the homepage — the dashboard already uses the correct async pattern (`media="print" onload`), the homepage doesn't. Fix: async-load homepage CSS + inline ~10–15KB critical CSS (biggest LCP lever, −0.5–1s); route-level code-splitting per tool (<150KB gz target).

**H3. Intermittent 308-to-self on static assets.**
`/assets/main-CILbTyH1.js`, `style-DzhC3bS7.css`, `/logo.png`, `/og-image.png`, `/favicon.ico` returned 308 echoing the request path during burst requests (5/5 retries then 200). Consistent with a Vercel edge bot-challenge/rate-limit spinning non-browser clients into a loop. Fix: verify via GSC URL Inspection + Vercel bot settings; whitelist Googlebot/Bingbot or raise the threshold; scope header rules to `text/html`.

**H4. llms.txt under-serves the corpus (the file AI assistants actually consume).**
Only 17/46 posts listed; "95 tools" heading with 40 links; four contradictory tool counts across the site (17 / 50+ / 90+ / 95); 14 of 17 descriptions are slug-injected templates ("Learn how to using youtube features to enhance viewer experience 2026"). Fix: regenerate from live content with clean human descriptions, one honest tool count, all 46 posts, add Privacy/Terms descriptions.

**H5. No external brand footprint / owned domain / professional contact.**
Hosted on `*.vercel.app` (non-portable, shared-infrastructure equity), contact is personal Gmail (`thiza3062@gmail.com`) exposed in Organization schema, no Wikipedia/Reddit/YouTube/PH presence, inactive-looking `sameAs`. Fix: acquire `ytseoarchitect.com`, 301 the subdomain, re-verify GSC/AdSense, `hello@<domain>`.

**H6. Zero multi-modal content.**
0 `<img>`, 0 `<video>`, 0 `<iframe>` tags on the homepage; walkthrough video is "Coming Soon" (dead-end CTA); no brand YouTube channel — for a YouTube SEO tool, the single strongest brand-citation signal (r≈0.737) is forfeited. Fix: dashboard screenshot as hero + OG, real walkthrough embed, branded infographic per pillar topic, start a YouTube channel.

**H7. Sitemap gaps + misleading lastmod.**
5 live indexable pages missing: `/about`, `/privacy-policy`, `/terms-of-service`, `/changelog` (+ `/dashboard` if not noindexed). 17,985/18,090 URLs carry identical `lastmod = 2026-08-03` (build stamp, not real change) → crawlers distrust it. Fix: add missing URLs; only emit lastmod on real change; never stamp the daily build.

**H8. No IndexNow / Bing / Yandex / Naver verification.**
No `{key}.txt`, no `msvalidate`/`yandex-verification`, only `google-site-verification`. For a site publishing ~60 posts + a generated glossary, IndexNow meaningfully speeds Bing/Yandex discovery. Fix: static key file, add verification metas, fire IndexNow on deploy.

**H9. About page fails its trust job — thin + missing canonical.**
`/about` is 476 words (below the 500–600 floor), no canonical, no OG/Twitter, no JSON-LD; founder story is an unnamed quote ("I got tired of paying $50/month…"). Fix: 600+ words, name the founder with photo + credentials + a real built channel, add canonical + AboutPage + OG.

**H10. Homepage trust contradiction.**
"100% Free, No Limits", "no catch" + `price: 0` in schema, while the hidden "Upgrade Your Plan" modal + Stripe/PayPal integration exist. AI engines reconciling these produce confused answers; users catch the inconsistency. Fix: label the modal "Plans (coming soon)" or remove it; align schema to the real offer.

---

## MEDIUM (fix within 1 month)

**M1. Mobile touch targets <44px + tablet hamburger cascade leak.**
`.btn` ~30px tall (fails Apple 44px / Google 48dp for the primary conversion element); hamburger ~40px wide; and on 769–1024px tablets BOTH full nav links and a dead hamburger render (style.css `!important` cascade leak beats nav.css `display:none`). Fix: `min-height/min-width:44px` on `.btn`/`.mobile-menu-btn`; scope the `!important` rule.

**M2. `/js/blog-enhancements.js` 404s on every homepage load.**
Referenced `defer` but not deployed → failed request + console error every visit. Fix: deploy or remove the tag.

**M3. 17 broken `/tools/tag-generator/{niche}` nav links (all 404).**
Homepage links to 17 niche tag-generator pages that don't exist. Fix: generate them or remove the links.

**M4. 3 sitemap entries are 308 redirect stubs** (`/glossary/{loc}/category/index`); canonical `/glossary/category` hub missing. Fix: drop the `/index` entries; add the hubs.

**M5. Deprecated `changefreq`/`priority` on all 18,090 URLs** (~15% payload, ignored by Google). Fix: strip both.

**M6. 6 orphaned `/vs/*` comparison pages** (vidIQ, TubeBuddy, Morningfame, Tubics, KeywordTool, Canva) — 200 + in sitemap, zero internal links. Fix: link from `/tools` and relevant blog posts; interlink the set.

**M7. WebSite SearchAction targets noindexed `/dashboard?q=…`.** Sitelinks-searchbox would route to a page Google won't index. Fix: point at an indexable search surface or remove.

**M8. FAQ schema (8 Q&A) diverges from visible FAQ (9); FAQPage yields no SERP feature since May 7, 2026.** Keep existing valid FAQPage for AI/GEO surface; don't add new ones for Google; reconcile the two lists.

**M9. Tools / blog / about lack schema.** `/tools` (90+ tools) needs `ItemList` + per-tool `SoftwareApplication`; `/blog` needs `Blog` + `BreadcrumbList`; `/about` needs `AboutPage` + reusable Organization `@id`. (Blog POSTS already carry valid Article+FAQPage — verified server-rendered.)

**M10. Tool-count inconsistency** (17 on hero/SoftwareApplication vs 90+ on tools vs 95 in llms.txt). Pick one number, apply everywhere.

**M11. Blog index not self-describing** — no per-post excerpts, no `Blog`/`ItemList` schema, cards are title + word count only → nearly uncitable.

**M12. TL;DR boxes low quality** — repeat the title, carry no facts ("Learn how to how youtube algorithm works 2026" contains a duplicate-word error). Fix: 3–5 concrete bullet facts with numbers + sources.

**M13. Readability too hard for "beginner" audience** — FRE 44–46 (college level), 16.8–17.7 words/sentence. Target FRE 60+.

**M14. Date/freshness inconsistencies** — blog index says 7/31/2026, `article:published_time` says 07-26/07-27; "13 min read" vs ~1,742-word body. Single canonical date source + explicit lastUpdated.

---

## LOW (backlog)

**L1.** "2026 2026" doubled-year titles (music/cooking slugs). **L2.** Personal Gmail + personal GitHub in Organization schema — remove/swap for support address. **L3.** Article schema missing `image`/`thumbnailUrl` (suppresses image rich results). **L4.** Stale robots.txt `Disallow: /_next/` (Next.js path not used). **L5.** `font-display:swap` inside `body{}` is dead code (only valid as @font-face descriptor). **L6.** Prior-audit flag: hero `alt` corruption from glossary-link injection into attributes (re-verify and fix the injector).

---

## Synthesis (PERCEIVE → ANALYZE → VALIDATE → ACT)

**PERCEIVE (observe):** Site is SSR, secure, fast-ish, schema-rich, AI-crawler-friendly, but has zero inbound equity, no human identity, an uncited-statistics trust hole, and a mass-generated glossary that dominates 99.5% of its own sitemap.

**ANALYZE (connect-system):** The dependencies run one way — authority work is a prerequisite for ranking work. Links and E-E-A-T (C3, C5, C6, H5) must precede content scaling; canonical/hygiene fixes (C2, H1) must precede content promotion; performance (H2) precedes CRO. The four content-abuse risks (C4, C6, M8, M12) compound: AI-assistant citation amplifies whatever is wrong on the page.

**VALIDATE (accept/falsify):** Each action below carries a falsifiability check — if the leading indicator does not move, the hypothesis is wrong and the action should be re-scoped, not doubled down.

**ACT:** Prioritized below.

---

## Prioritized Action Plan

### Phase 0 — Trust & entity (unblocks everything, lowest effort)
| # | Action | Falsifiability check (ACCEPT) | Leading indicator (GROW) |
|---|---|---|---|
| 1 | Fix `/contact` 404 (C1) | Contact URL returns 200 | No 404s in crawl; contact clicks convert |
| 2 | Cite or delete every statistic (C5) | Spot-check 5 posts: all stats hyperlinked to primary sources | Zero unsourced stats on a fresh crawl |
| 3 | Add named human author + bio page (C6) | Author name present in Article schema + visible byline | Search Console impressions grow on post URLs |
| 4 | Owned domain + professional email, 301 subdomain (H5) | GSC re-verifies new domain, no traffic dip | DA signal appears in Ahrefs/Moz |
| 5 | Submit sitemap to GSC + Bing, implement IndexNow (H8, C3-part) | IndexNow key file live; GSC shows "Discovered—submitted" | Bing/BingBot crawl frequency rises |

### Phase 1 — Fix self-inflicted ranking damage
| # | Action | Falsifiability check (ACCEPT) | Leading indicator (GROW) |
|---|---|---|---|
| 6 | Resolve 24 canonical-less blog↔tools pairs (C2) | Exactly one indexable URL per keyword; others 301 | Search Console "Duplicates" report clears |
| 7 | Fix all canonicals pointing at 308s (H1) | No canonical resolves through a 3xx | Duplicate-page coverage drops in GSC |
| 8 | Gate/trim the 18k glossary + doorway cluster (C4) | No `browse-features-vs-*` URLs indexable; en-only or genuinely unique localized copy | Crawl budget focuses on money pages |
| 9 | Fix 17 broken tag-generator links (M3) + 3 sitemap stubs (M4) + dead JS 404 (M2) | Zero 404s in full-site crawl | Crawl error report trends to 0 |

### Phase 2 — Rank harder (performance, content, links)
| # | Action | Falsifiability check (ACCEPT) | Leading indicator (GROW) |
|---|---|---|---|
| 10 | Async-load homepage CSS + split 536KB dashboard JS (H2) | PSI: LCP <2.5s, INP <200ms mobile lab | CrUX field data goes green |
| 11 | Own "youtube seo" via master pillar page (SXO C1) | Pillar ranks top-50 for "youtube seo" in 90 days | Impressions for head term rise |
| 12 | Wire `/vs/*` orphan pages into internal linking (M6) | Each /vs/ page gets ≥3 inbound internal links | /vs/ pages start getting impressions |
| 13 | Earn first 10 third-party dofollow links (C3) | 10 RD across directories/PR/communities | Referring domains count >10 in Moz |
| 14 | Rebuild llms.txt from live corpus (H4) | llms.txt lists all posts, one honest tool count | AI-assistant traffic/brand mentions up |
| 15 | Add multi-modal content + YouTube channel (H6) | Homepage has real screenshot + video; channel exists | Brand-cited in AI answers / YouTube search |

### Phase 3 — Polish
| # | Action | Falsifiability check (ACCEPT) | Leading indicator (GROW) |
|---|---|---|---|
| 16 | Schema for tools/blog/about + clean SearchAction (M9, M7) | Rich-results test validates new graphs | Eligible-rich-results coverage up |
| 17 | Fix touch targets + tablet nav leak (M1) | Lighthouse mobile tap-target audit passes | Mobile conversion rate holds |
| 18 | Expand About (H9), reconcile FAQ schema (M8), real lastmod (H7) | About ≥600 words w/ canonical; FAQ lists match | Trust signals present on crawl |

---

## Things that are genuinely fine (don't touch)
- Full SSR — Googlebot gets identical 71.8KB HTML, no SPA wall. **The vanilla-JS architecture does NOT hurt indexability.**
- robots.txt: model AI-crawler policy (search allowed, training blocked).
- Valid schema on homepage + blog posts (SoftwareApplication, Article, FAQPage, Organization).
- Security: HSTS preload, strong CSP, nosniff, SAMEORIGIN, HTTPS-only 308s.
- Multilingual glossary hreflang is correct on all 18k pages.
- Meta descriptions present on 49/50 sampled pages.

---

*Report generated by `/seo audit` with 10 specialist agents. Source findings live in this folder (`findings/` from the 14:48 run) and the agent transcripts. No Google/DataForSEO credentials available, so CWV, indexation, and backlink metrics are source-estimates — connect Google APIs (`/seo setup` → `/seo google`) for field data.*
