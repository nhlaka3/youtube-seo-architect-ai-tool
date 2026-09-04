# SXO — Search Experience Re-Audit
Site: https://yt-seo-architect.vercel.app
Date: 2026-08-05 | Pass: Re-audit | Analyst: SXO specialist (Search Experience)

## Score: 82 / 100

---

## 1. Indexability / crawl surface

| URL | HTTP | Indexable | Notes |
|---|---|---|---|
| / (homepage) | 200 | YES (index,follow) | canonical OK, 1 H1 |
| /pricing | 200 | YES (index,follow) | canonical OK, H1 "Pricing: $0 Forever" — real, indexable |
| /guide | 308 | -> /guide/youtube-seo | permanent redirect to a REAL content page (200, index,follow) — acceptable |
| /guide/youtube-seo | 200 | YES | H1 "The Ultimate Guide to YouTube SEO (2026)", Article schema |
| /dashboard | 200 | NO (noindex,nofollow) | correct — verified meta robots noindex,nofollow |
| /blog | 200 | YES | H1 "📚 YouTube SEO Blog", 50 posts |
| /tools | 200 | YES | H1 "Free YouTube SEO Tools", ItemList schema |
| /blog/<post> | 200 | YES | Article + FAQPage (5 Q&A) |
| /glossary/<term> | 200 | YES | Article + FAQPage (3 Q&A) |
| /vs/keywordtool, /vs | 200 | YES | comparison pages indexable |

### Login-gate / redirect checks — PASS
- No page 307-redirects to a login-gated dashboard. /dashboard itself returns 200 with
  noindex (it is a client-side tool surface, not a login wall; curl returns content).
- /guide 308 -> /guide/youtube-seo is a legit permanent redirect to content, NOT a dashboard.
- /admin and /api return 404 (blocked in robots.txt as well). No leaked internal surfaces.

## 2. Page-type / search-intent alignment

### Homepage — PASS
- H1: "Free YouTube SEO Tool — AI Keyword, Tag & Title Generator.100% Free, Unlimited."
  Targets the head term "Free YouTube SEO Tool" exactly. 
- Title: "YT SEO Architect — AI YouTube SEO Tool | Keywords, Tags & Scripts" — good head-term
  coverage. Meta description present and strong ("90+ free AI YouTube SEO tools...").
- MINOR: "Generator.100%" missing space after the period (H1 rendering typo).

### /pricing — PASS
- H1 "Pricing: $0 Forever" matches intent of users searching "yt seo architect pricing / free".
- Title "Pricing — YT SEO Architect | 100% Free, No Limits" — intent-aligned.
- Offer schema present (1 Offer). No noindex. Real pricing content (not a redirect).

### Blog listing + posts — PASS
- Listing H1 "📚 YouTube SEO Blog" — emoji in H1 is a minor SXO nit (some tools render oddly).
- Posts: 1 H1, Article + FAQPage + SpeakableSpecification, breadcrumbs, meta descriptions
  present and human-written (e.g. Shorts SEO post desc is clean).
- Minor: many post titles/H1s are slug-injected ("Youtube Seo Optimization For Gaming Channels
  2026: Complete Guide") — matches llms.txt disease; hurts CTR + AI citation quality.

### Tools hub — MIXED
- H1 "Free YouTube SEO Tools" matches "free youtube seo tools" intent. ItemList + breadcrumbs.
- MAJOR MISMATCH: title + meta description say "90+ Tools" but the hub page links only 23
  /public/tools/*.html tool cards (verified: 23 unique hrefs). llms.txt claims 95 topic
  guides. Three different numbers (23 / 90+ / 95) for the same inventory — promise vs.
  delivered mismatch that will show in SERP CTR and AI-answer citations.
- Clean URLs (/tools/title-optimizer etc.) resolve 200; /public/tools/*.html 308-redirect to
  /public/tools/* (non-.html). Duplicate URL space for the same tools (canonicalization risk).

### Glossary — PASS
- Term pages indexable, Article + FAQPage, breadcrumbs. Glossary hub lists 85 slugs (~84 terms).
- Last ~10 glossary entries are template garbage ("keyword research for small channels...")
  — low-quality SERP snippets + AI citations for long-tail "keyword research" queries.

### Guide — PASS
- /guide/youtube-seo indexable, Article schema, H1 aligned ("The Ultimate Guide to YouTube SEO
  (2026)"). No FAQPage (minor; could add for AI answer surface).

## 3. Schema / SERP enhancement coverage
- Blog posts: Article, FAQPage (5 Q), SpeakableSpecification, BreadcrumbList, Person,
  Organization, ImageObject — excellent, rich results + AI-answer ready.
- Homepage: Organization, WebSite, SoftwareApplication, Offer, FAQPage (8 Q) — excellent.
- Glossary: Article + FAQPage — good.
- /pricing: WebPage + Offer — adequate.
- Tools hub: WebPage + ItemList — adequate (could add SoftwareApplication per tool).
- /dashboard: no schema — correct (noindexed).

## 4. SXO nits
- H1 typo on homepage ("Generator.100%").
- Blog H1 emoji prefix.
- /tools /tools.html /public/tools/*.html /public/tools/* URL variants — 4 URL forms for tools.
- /dashboard canonical points to /dashboard.html (odd but irrelevant while noindexed).
- llms.txt lists /dashboard as a canonical destination while page is noindex — inconsistent
  signals between AI-surface and search surface.

## Top issues (priority)
1. Tool inventory count mismatch (hub 23 vs title "90+" vs llms.txt "95") — align counts and
   surface all tools on the hub; largest SXO credibility gap.
2. Slug-injected H1/titles on ~40% of blog posts — rewrite titles for CTR + AI citations.
3. Duplicate tool URL forms (/tools/X vs /public/tools/X.html vs /public/tools/X) — pick one
   canonical form, 301 the rest.
4. Glossary template tail — rewrite last ~10 entries.
5. Add FAQPage to guide pages; consider SoftwareApplication schema per tool page.

## Positives
- /pricing fully indexable with real content — no paywall/noindex mistakes.
- /dashboard correctly noindexed; no login-gated redirects anywhere.
- Blog posts have complete rich-snippet schema (FAQPage + Speakable).
- Homepage H1 targets the head term precisely.
- Clean, consistent meta descriptions on listings and posts.
