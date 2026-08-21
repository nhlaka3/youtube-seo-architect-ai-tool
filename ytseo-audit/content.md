# Content Quality + On-Page + Schema Audit — https://yt-seo-architect.vercel.app/

Audit date: 2026-08-17 | Method: curl-fetched 16 live pages + sitemap index + 3 sub-sitemaps; parsed with python3 (regex + HTMLParser + json.loads + textstat). All data below is from live fetch, not assumptions.

---

## 1. ON-PAGE SIGNALS (11 audited pages)

| URL | <title> (len) | meta desc (len) | H1 | H2 | H3 | words |
|---|---|---|---|---|---|---|
| / | YT SEO Architect — AI YouTube SEO Tool \| Keywords, Tags & Scripts (65) | 175 | 1 | 10 | 26 | 1872 |
| /blog | YouTube SEO Blog — Guides & Strategies \| YT SEO Architect (57) | 148 | 1 | 0 | 1 | 974 |
| /tools | Free YouTube SEO Tools \| YT SEO Architect (41) | 149 | 1 | 7 | 36 | 578 |
| /about | About — YT SEO Architect (24) | 119 | 1 | 8 | 7 | 697 |
| /pricing | Pricing — YT SEO Architect \| 100% Free, No Limits (49) | 140 | 1 | 3 | 0 | 266 |
| /guides | YouTube SEO Guides: Pillar Guides & Tool Tutorials (2026) (57) | 169 | 1 | 2 | 0 | 350 |
| /guides/youtube-seo-strategy-2026 | Complete YouTube SEO Strategy 2026: The 7-Layer System That Ranks (65) | 193 | 1 | 13 | 4 | 2147 |
| /blog/youtube-content-calendar-template-2026 | Youtube Content Calendar Template 2026 — YT SEO Architect (57) | 139 | 1 | 10 | 15 | 2506 |
| /tools/keyword-difficulty-scorer | Keyword Difficulty Checker — Free YouTube SEO Tool (50) | 108 | 1 | 0 | 1 | 59 |
| /blog/creating-high-click-through-rates-youtube-thumbnails | Creating High Click-through Rates Youtube Thumbnails 2026 — YT SEO Architect (76) | 153 | 1 | 10 | 22 | 2630 |
| /blog/boost-youtube-channel-revenue-streams-2026 | Boost Youtube Channel Revenue Streams 2026 — YT SEO Architect (61) | 143 | 1 | 10 | 7 | 2267 |

### 1.1 Title tags
- [Info] Every audited page has exactly one <title>; all pages also emit <link rel="canonical"> pointing to the exact fetched URL (verified on all 3 audited blog posts, e.g. https://yt-seo-architect.vercel.app/blog/creating-high-click-through-rates-youtube-thumbnails). No duplicate/missing canonicals found.
- [Medium] Ungrammatical, keyword-stuffed titles on blog posts — "Creating High Click-through Rates Youtube Thumbnails 2026", "Boost Youtube Channel Revenue Streams 2026", "Youtube Content Calendar Template 2026". "Youtube" (lowercase u) + missing articles ("How to Create High Click-Through Rates on YouTube Thumbnails"). Looks templated; reads poorly in SERPs.
- [Medium] Title/H1 mismatch on /blog/youtube-seo-tips-for-creators-in-2026: <title> = "YouTube Tags 2026: How to Research, Write, and Rank With… — YT SEO Architect" but H1 = "YouTube SEO Tips for Creators in 2026: What Actually Moves Rankings — YT SEO Architect". Title describes a different article (tags vs tips) — likely template/default-title bug; also ends with a literal "…" ellipsis.
- [Low] /about title "About — YT SEO Architect" (24 chars) is short but acceptable; /tools/keyword-difficulty-scorer title ("Keyword Difficulty Checker") vs H1 ("🔍 Keyword Difficulty Score") use different terminology (checker vs score) for the same tool.
- [Low] /tools/channel-audit-score title uses sentence case: "Channel audit score — Free Interactive Tool | YT SEO Architect".
- [Info] og:title on homepage ("YT SEO Architect — AI-Powered YouTube Growth Platform") differs from <title>; minor inconsistency, harmless.

### 1.2 Meta descriptions (120–160 chars recommended)
- [High] Length violations on 5 of 11 pages:
  - / : 175 chars (too long; will be truncated in SERP)
  - /guides : 169 chars
  - /guides/youtube-seo-strategy-2026 : 193 chars
  - /tools/keyword-difficulty-scorer : 108 chars (too short)
  - /about : 119 chars (1 char under)
  - /tools/channel-audit-score : 256 chars (severely over; see 1.3)
- [High] Template-generated descriptions on blog posts — identical boilerplate with the keyword swapped in:
  - "Learn how to youtube content calendar template 2026. Step-by-step guide with examples, tools, and strategies for 2026. Free tools included." (139c)
  - "Learn how to creating high click-through rates youtube thumbnails. Step-by-step guide with examples, tools, and strategies for 2026. Free tools included." (153c)
  - "Learn how to boost youtube channel revenue streams 2026. Step-by-step guide with examples, tools, and strategies for 2026. Free tools included." (143c)
  The phrasing "Learn how to creating high click-through rates…" is grammatically broken. This is a machine-generated pattern; likely applied to all ~59 posts.
- [Low] Duplicate-phrase overlap: homepage desc and /tools desc both begin "Free YouTube SEO tools: keyword research, tag generator, title optimizer…" — near-duplicate opener competing for the same SERP intent.

### 1.3 Heading structure
- [Info] All 11 pages have exactly one H1 — clean.
- [Info] Blog posts have strong H2/H3 hierarchy (calendar post: 10 H2s incl. "TL;DR", "In This Article", "Step-by-Step", "FAQ", "Key Takeaways" + 15 H3s; CTR post: 10 H2 + 22 H3; revenue post: 10 H2 + 7 H3). Guide: 13 H2 + 4 H3.
- [Medium] /tools/keyword-difficulty-scorer has ZERO H2 and one H3 in 59 words of visible text — a bare tool shell with no on-page content.
- [Low] /blog index has 0 H2 and only 1 H3 — no category/topic navigation headings; /guides index has only 2 H2s (one is likely the page heading duplication).

### 1.4 Author bylines & dates
- [Info] All 3 audited blog posts + the pillar guide have a visible byline: author name "Patrick" hyperlinked to /about (anchor: Patrick), <meta name="author" content="Patrick">, and a visible "August 2026" date string. JSON-LD Article datePublished/dateModified present on all (2026-08-17, 2026-08-16, 2026-08-15, 2026-08-12). No visible "updated" flag on posts (dateModified == datePublished everywhere).
- [Medium] Byline is name-only — no avatar, role, or credentials next to the name; single shared author identity across all ~59 posts + guide is consistent with an automated pipeline (see E-E-A-T).

---

## 2. E-E-A-T ASSESSMENT

- [Info] About page (/about, 697 words) is mostly product marketing ("Made for Creators, Not Corporations", tool suite description) but DOES include a real founder signal: a signed quote "— Patrick, Founder, YT SEO Architect" and Organization JSON-LD declares founder: Person "Patrick" with sameAs https://github.com/nhlaka3 and knowsAbout list (YouTube SEO, YouTube Analytics, YouTube Algorithm…).
- [Medium] Founder identity is thin: no photo, no LinkedIn/Twitter profile, no credentials/experience story, no email on the About page itself. "Patrick" has no surname anywhere on the site. Organization sameAs has only 3 entries (verified in homepage schema) — limited entity corroboration.
- [High] The 3 audited blog posts contain numeric/statistical claims with ZERO citations. External links on /blog/creating-high-click-through-rates-youtube-thumbnails and /blog/boost-youtube-channel-revenue-streams-2026 are: 3 Amazon affiliate links (tag=44HlecM), social share buttons (Twitter/X, Reddit, LinkedIn, WhatsApp, Telegram, Facebook), github.com/nhlaka3, youtube.com, and fonts. No support.google.com, no studies, no data sources. Example claims found with no source: "1200", "630" (thumbnail dimensions), 8 FAQ answers, revenue figures.
- [Info] Counter-example: /blog/youtube-seo-tips-for-creators-in-2026 DOES cite sources: https://support.google.com/youtube/answer/13338784, /answer/146402, /answer/16090438, /topic/12751231, plus backlinko.com/youtube-ranking-factors. So citation practice is inconsistent across the pipeline.
- [Info] Contact page EXISTS: /contact (200, 330 words) with a working form (Name/Email/Subject/Message, topic select incl. Partnership, Press, AdSense), "average response time: under 24 hours".
- [Medium] /contact is NOT linked from the homepage, /about, or the footer (footer links only Privacy, Terms, About), and is not in the sitemap — it is only reachable via blog-post and /pricing in-content links. A contact page hidden from the footer hurts trust signals.
- [Info] Privacy policy exists: /privacy-policy (200, 529 words, "Effective Date: April 9, 2026") and Terms exist: /terms-of-service (200, 446 words, "Effective Date: May 5, 2026"). Both linked in the footer of every page.
- [Low] /privacy-policy and /terms-of-service are not included in sitemap-core.xml (neither is /contact or /dashboard).
- [Low] All 3 audited posts + guide contain affiliate Amazon links (tag=44HlecM) without any visible disclosure ("contains affiliate links") near the links — compliance/trust risk.

---

## 3. THIN CONTENT (<300 words visible text)

- [High] /tools/keyword-difficulty-scorer — 59 words total, no H2, no FAQ, no how-to copy, no internal links to guides. It carries WebApplication schema (name "Keyword Difficulty Score") and a canonical, but the page is an empty shell; content is generated client-side. Thin for a page targeting "keyword difficulty" head terms.
- [Medium] /pricing — 266 words. Thin but acceptable for a $0 pricing page; lacks FAQ/feature-detail copy that would let it rank for "youtube seo tool pricing".
- [Info] /guides index — 350 words (borderline OK). /tools index — 578 words (OK). All 3 audited blog posts are 2200–2600 words (substantial). Strategy guide 2147 words.

---

## 4. DUPLICATE / TEMPLATE CONTENT

Checked 16 titles + meta descriptions (11 audited + 5 spot-fetched: /blog/youtube-seo-tips-for-creators-in-2026, /blog/how-many-subscribers-to-monetize-youtube-2026, /tools/tag-generator, /tools/title-optimizer, /tools/channel-audit-score).

- [High] Blog meta descriptions are a near-duplicate template across posts (see 1.2 — identical sentence skeleton, keyword swapped). If this pattern holds across all ~59 posts (blog index lists 59), the site has 59 near-duplicate descriptions — weak SERP differentiation and a classic programmatic-content fingerprint.
- [Medium] Blog title pattern is also templated: "X 2026 — YT SEO Architect" (observed: "Youtube Content Calendar Template 2026 — …", "Creating High Click-through Rates Youtube Thumbnails 2026 — …", "Boost Youtube Channel Revenue Streams 2026 — …").
- [Medium] /tools/channel-audit-score meta description (256 chars) is copy-pasted boilerplate that doesn't match the tool: "Analyze your text for SEO keywords, topic clusters, and readability…" describes a text analyzer, not a channel audit tool. Signal that tool-page descriptions are auto-generated without QA.
- [Low] No exact-duplicate titles/descriptions found among the 16 sampled (all differ by keyword), but the two "SEO tools" descriptions overlap heavily at the opener ("Free YouTube SEO tools: keyword research, tag generator…" on both / and /tools).
- [Info] Blog post body structure is also templated: every audited post has the same section skeleton (⚡ TL;DR → 📑 In This Article → definition H2 → "Step-by-Step" → "Best Tools" → "Mistakes" → FAQ → 🎯 Key Takeaways) with 13 "faq" mentions per page. Combined with identical author + same-day publishing cadence (posts dated 08-15, 08-16, 08-17), the site presents as programmatically generated content.

---

## 5. INTERNAL LINKING & ORPHANS

- [Info] Homepage: 47 total links, 41 internal to 29 unique paths; zero generic anchors ("click here"/"read more" not found). Descriptive anchors incl. "🏷️ Free Tag Generator", "📝 Free Title Optimizer", "Try the free tag generator →", "Gaming Tags".
- [Info] Blog posts: 60–62 links each, ~44–46 internal to 24–25 unique paths; TOC anchors, breadcrumb (Home / Blog), byline → /about, plus 5–6 related-post links in the body (e.g. /blog/youtube-competitor-analysis-reverse-engineer, /blog/youtube-thumbnail-ab-testing-guide, /blog/youtube-seo-audit-diagnostic-fix-2026, /blog/best-youtube-seo-tools-2026). All 59 blog posts ARE linked from /blog index (verified against sitemap: 0 missing posts).
- [Medium] Blog posts link to ZERO tool pages and ZERO guides in the body (0 /tools/, 0 /guides/ links in body of both audited posts). The site's money pages (85 tools) get no contextual link equity from articles.
- [Medium] /tools index links only 23 of 52 tool pages present in sitemap-core.xml — ~29 tool pages are unreachable from the tools hub (reachable only via guides/sitemap). Spot evidence: /tools/channel-audit-score and /tools/audience-retention-benchmark are in the sitemap; /tools index anchors found: 23 unique /tools/* paths.
- [Medium] 8 orphan category pages in sitemap-core.xml, linked from nowhere: /blog/category/monetization, /blog/category/shorts, /blog/category/analytics, /blog/category/optimization, /blog/category/strategy, /blog/category/growth, /blog/category/tools, /blog/category/niche. No blog post links to its category (category links on posts: empty set). /blog/categories IS linked from the blog index, but the 8 category pages themselves are orphaned.
- [Medium] /dashboard (200, linked in main nav of every page) and /contact, /privacy-policy, /terms-of-service are absent from all sitemaps (sitemap index: sitemap-core.xml 157 URLs, sitemap-glossary-terms.xml 345, sitemap-glossary-pairs.xml 48; total 550).
- [Info] Sitemap health: sitemap.xml is a valid sitemap index; all 3 sub-sitemaps fetched OK. No 404s among sitemap URLs spot-checked.
- [Low] External link profile on blog posts is dominated by social share buttons and Amazon affiliate links (3 per post) — low editorial value; the 3 audited posts contain no high-authority outbound citations (see E-E-A-T).

---

## 6. STRUCTURED DATA (JSON-LD)

All <script type="application/ld+json"> blocks parsed with json.loads: 0 parse errors across all audited pages.

- [Info] Homepage: single @graph with 5 valid nodes — Organization (name, url, logo, email, 3 sameAs, founder Person "Patrick" w/ GitHub), WebSite (name, url), SoftwareApplication (name, description, url, applicationCategory, operatingSystem, offers, featureList, speakable), FAQPage (8 Question/Answer pairs, all well-formed, speakable), BreadcrumbList. Matches expected schema set; all required fields present.
- [Low] Homepage WebSite node lacks potentialAction (no SearchAction/sitelinks searchbox). BreadcrumbList on homepage has only 1 item — technically valid but useless.
- [Info] Blog posts + pillar guide: Article schema complete — headline, datePublished, dateModified, author {Person "Patrick"}, mainEntityOfPage all present (verified on all 3 posts + guide). FAQPage on each post: 5 Q/A pairs, all valid (0 malformed).
- [Low] Posts use "Article" rather than the more specific "BlogPosting" (valid, but BlogPosting is the recommended type for blog posts).
- [Medium] /blog index has NO structured data at all (0 ld+json blocks) — no ItemList/Blog schema for the hub page, unlike /tools which has WebPage + ItemList (23 items).
- [Info] /tools/keyword-difficulty-scorer: valid WebApplication (name "Keyword Difficulty Score", offers, operatingSystem "Web"). /about: AboutPage. /guides: CollectionPage. /pricing + /tools: WebPage. All parse and carry core fields.
- [Info] No invalid/missing @type, no empty blocks, no duplicated schema nodes across pages audited.

---

## 7. READABILITY (Flesch Reading Ease, textstat)

- [Medium] /blog/creating-high-click-through-rates-youtube-thumbnails: FRE 49.1 (college/difficult), Flesch-Kincaid grade 11.3, 2630 words.
- [Medium] /blog/boost-youtube-channel-revenue-streams-2026: FRE 41.9 (difficult), FK grade 12.0, 2267 words.
Both posts are written at an 11th–12th grade level for a target audience of YouTube creators (typically high-school reading level). The revenue post is the harder of the two.

---

## 8. PRIORITY FIX LIST

1. [Critical] None found — no broken schema, no missing canonicals, no zero-content pages, all sitemap pages return 200.
2. [High] Fix templated/grammatically broken blog meta descriptions ("Learn how to creating high click-through rates…") and 175–256 char over-length descriptions (/, /guides, strategy guide, channel-audit-score).
3. [High] Add source citations to blog posts that make claims but link only to Amazon affiliates (calendar, CTR, revenue posts); standardize the citation practice already present in the seo-tips post.
4. [High] Build out /tools/keyword-difficulty-scorer (59 words, no H2) with how-to copy, FAQ, and guide links.
5. [Medium] Fix title/H1 mismatch on /blog/youtube-seo-tips-for-creators-in-2026 ("YouTube Tags 2026…" vs "YouTube SEO Tips…").
6. [Medium] Link blog posts to tools/guides (0 contextual tool links in post bodies); link remaining ~29 tool pages from /tools index.
7. [Medium] De-orphan 8 /blog/category/* pages (link categories from posts or noindex them) and add /dashboard, /contact, /privacy-policy, /terms-of-service to sitemaps.
8. [Medium] Add /contact to footer/nav (currently hidden from homepage footer).
9. [Medium] Add affiliate-link disclosure near Amazon links on blog posts.
10. [Medium] Improve readability of blog posts (FRE 42–49 → target 60+).
11. [Low] Switch Article → BlogPosting; add SearchAction to WebSite schema; add ItemList/Blog schema to /blog index; expand founder identity on /about (photo, LinkedIn, surname).

---

### Method note
Pages fetched with curl (16 URLs) + sitemap index + 3 sub-sitemaps (550 URLs total). Word counts = visible text after stripping script/style/svg/head. Readability via textstat 0.7.x. JSON-LD validated with json.loads. Internal-link counts include nav/footer; body-scoped counts exclude header/footer where noted.
