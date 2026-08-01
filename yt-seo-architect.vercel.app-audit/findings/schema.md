# Schema / Structured Data Audit — yt-seo-architect.vercel.app

Auditor: Schema & Structured Data specialist
Date: 2026-07-31
Method: Live fetches with curl; all `<script type="application/ld+json">` blocks extracted and
validated with `python3 json.loads`. Samples: homepage, /blog, /glossary/, /tools (index pages),
5 glossary term pages, 3 blog posts, 3 tool pages, 1 /vs/ page. Sitemap.xml (8,667 URLs) analyzed
for URL inventory and canonical patterns. A full-coverage re-scan of all 45 blog / 38 tool pages
was requested but not executed (not permitted); findings below reflect sampled evidence, with the
pattern confirmed consistent across every page of a given template that was sampled.

Sitemap inventory (from sitemap.xml): 8,571 glossary, 45 blog, 38 tools, 6 /vs/, plus
about/changelog/contact/dashboard/privacy/terms/guide. All sampled URLs resolve HTTP 200.

---

## What works

- **Homepage is one valid JSON-LD @graph** (5 nodes: Organization, WebSite, SoftwareApplication,
  FAQPage, BreadcrumbList) — not concatenated blocks. Single `<script>` tag, valid JSON, correct
  `@context: https://schema.org`.
- **SoftwareApplication (homepage) has required properties**: name, url, applicationCategory
  (MultimediaApplication), operatingSystem ("Web"), and `offers: { price: "0", priceCurrency: USD }`.
- **WebSite has name + SearchAction** with the modern `query-input: "required name=search_term_string"` format.
- **FAQPage content matches visible page content** (homepage FAQ section is rendered on the page;
  "Is YT SEO Architect free" found in visible HTML) — content-wise it is compliant.
- **Glossary term pages (5/5 sampled)**: 3 valid JSON-LD blocks each — Article, BreadcrumbList,
  FAQPage. Breadcrumbs are correct 4-level hierarchies (Home > Glossary > Category > Term) and the
  category URLs (/glossary/category/analytics) resolve 200.
- **Blog Article markup (valid copies)**: headline, description, datePublished/dateModified, author
  (Person "Patrick", url /about resolves 200), publisher Organization with a real logo file
  (og-image.png, 1024x1024 JPEG, HTTP 200).
- **Tool pages (2/3 sampled)**: WebApplication with `offers: { price: "0", priceCurrency: USD }`.
- **Canonical tags present on all sampled pages**; tool pages correctly canonicalize
  /public/tools/*.html → pretty /tools/* URLs. Sitemap URLs all resolve.

---

## Findings

### CRITICAL-1 — Broken (unparseable) JSON-LD on blog posts
**Evidence**: `https://yt-seo-architect.vercel.app/blog/how-to-keywords-youtube` — 2 of 5 JSON-LD
blocks fail `json.loads` with `Expecting ',' delimiter: line 5 column 52 (char 190)` and
`line 10 column 130`. Cause: raw HTML injected unescaped inside JSON string values:
`"description": "Step-by-step guide to <a href=\"/glossary/youtube-keyword-research\" class=\"glossary-link\">YouTube keyword research</a> ..."`
and FAQ answer text contains `<a href="/glossary/search-volume" class="glossary-link">...`.
Same failure on `blog/best-youtube-seo-tools-2026` (FAQPage block); `blog/youtube-description-templates-2026`
parses but still carries the duplicate structure. Google's parser drops a malformed block entirely,
so the broken Article/FAQPage copies contribute nothing and signal sloppy generation.
**Recommendation**: Never interpolate HTML into JSON strings — strip tags or HTML-escape before
serializing; generate schema via a JSON serializer (json.dumps), and add a build-time gate that
fails the build if any `application/ld+json` block does not pass `json.loads`. Also fix the
content bug visible in the same data: a nested `<a href>` inside another `<a href>` in the
description field.

### HIGH-1 — Organization/publisher logo is a dead URL (logo.svg → 404)
**Evidence**: Homepage Organization node: `"logo": "https://yt-seo-architect.vercel.app/logo.svg"`
and every glossary term's Article.publisher.logo points to the same URL. `curl -I
https://yt-seo-architect.vercel.app/logo.svg` → **HTTP 404** (79-byte error body). `logo.png` also
404. Meanwhile blog posts correctly use `/og-image.png` (200, 1024x1024). Google requires a
fetchable logo for Organization and for Article publisher (min ~112px); a 404 logo voids the
organization/publisher signals on the homepage and all 8,571 glossary pages.
**Recommendation**: Point every logo reference to a file that exists (og-image.png already works,
or upload a real logo.svg ≥112x112), ideally a single canonical logo URL.

### HIGH-2 — Index/hub pages lack structured data
**Evidence**: `https://yt-seo-architect.vercel.app/blog` → 0 JSON-LD blocks; `/tools` → 0 JSON-LD
blocks. Only `/glossary/` has a (minimal) CollectionPage. These hubs for 45 posts and 38 tools
have no Blog, no ItemList, no BreadcrumbList — lost opportunity for sitelinks/carousel signals.
**Recommendation**: Add `Blog` (with `blogPost` ItemList) to /blog; `CollectionPage` + `ItemList`
of tools to /tools; BreadcrumbList on both.

### HIGH-3 — Schema missing entirely on some tool pages
**Evidence**: `https://yt-seo-architect.vercel.app/public/tools/youtube-revenue-estimator.html`
("YouTube Revenue Calculator — Estimate Ad Earnings Free") contains **0** JSON-LD blocks, while
tag-generator and title-optimizer pages have valid WebApplication markup. Tool templates are
inconsistent — pages generated by different templates ship with and without schema.
**Recommendation**: Audit all 38 tool pages for the presence of a valid SoftwareApplication block
(template-level fix: enforce schema in every tool template, with a test asserting ≥1 valid block).

### HIGH-4 — WebSite SearchAction targets a login-gated dashboard
**Evidence**: Homepage WebSite node:
`"potentialAction": { "@type": "SearchAction", "target": "https://yt-seo-architect.vercel.app/dashboard?q={search_term_string}", ... }`.
The dashboard is a Google-OAuth-gated SPA ("Sign in"/"Login"/"OAuth" on page); /dashboard?q=test
returns the app shell, not search results. Google's sitelinks searchbox requires the target URL to
render results for the query without authentication — this action is ineligible and could be seen
as misleading.
**Recommendation**: Point SearchAction at a real public search surface (e.g. /glossary?q= or a
/server-side search page) or remove it.

### MEDIUM-1 — FAQPage markup yields zero rich results (deprecated type) but is deployed site-wide
**Evidence**: FAQPage on homepage (8 Q&As), on every sampled glossary term (2 Q&As), and on blog
posts (5 Q&As). Google deprecated FAQ rich results for most sites in July 2025 — only
"well-known, authoritative government and health websites" qualify. Markup is valid and
content-matching, so it is not harmful, but it provides no SERP benefit anywhere on this site and
adds maintenance + validation surface (two of the sampled broken blocks were FAQPage copies).
Glossary FAQ questions are also auto-generated with heavy keyword stuffing ("What is a good
click-through rate (ctr) on YouTube?" with the phrase repeated 5x in one answer).
**Recommendation**: Remove FAQPage from templates, or keep only where a human-authored FAQ exists;
de-stuff the glossary FAQ questions if kept.

### MEDIUM-2 — Glossary index CollectionPage description is stale and understates inventory
**Evidence**: `/glossary/` CollectionPage: `"description": "75+ YouTube SEO terms defined and
explained."` — but sitemap.xml lists **8,571** glossary URLs and the index page itself links only
75 terms. The schema (and visible copy) undercounts by ~2 orders of magnitude; ~8,496 glossary
pages are reachable only via sitemap. CollectionPage also lacks `mainEntity`/ItemList.
**Recommendation**: Fix the copy to reflect real volume (or paginate), add `mainEntity` as an
ItemList of terms, and ensure internal linking covers more terms (crawlability, not just schema).

### MEDIUM-3 — Glossary terms marked up as Article instead of DefinedTerm
**Evidence**: Every sampled glossary page (5/5) uses `"@type": "Article"` for a dictionary-style
definition (e.g. /glossary/click-through-rate, "The percentage of viewers who click on your
video..."). Article is the wrong semantic type; the pages are definitions of terms — the exact
use case for `DefinedTerm` (termCode, name, description, inDefinedTermSet), which powers
definition/encyclopedia-style enhancements and knowledge-panel entities. 8,571 pages of
DefinedTerm is a strong entity-signal opportunity. Sampled Articles also lack `image` (required
for Article rich results, though this site is unlikely to target Top Stories).
**Recommendation**: Add DefinedTerm (keep or drop Article; if kept, add image + speakable).

### MEDIUM-4 — Duplicate JSON-LD blocks on blog posts
**Evidence**: All 3 sampled blog posts carry Article and FAQPage twice: once inside the valid
array block (block 0: `[{Article}, {FAQPage}]`) and once as standalone blocks (block 1 = Article,
block 2 = FAQPage) — the standalone copies are the ones that are malformed on 2 of 3 pages.
Redundant duplication dilutes/conflicts signals and doubles the chance of a broken block.
**Recommendation**: Emit exactly one `<script type="application/ld+json">` per page containing a
single `@graph` with one of each type.

### LOW-1 — Homepage BreadcrumbList has a single item
**Evidence**: Homepage: `BreadcrumbList > itemListElement: [{position: 1, name: "Home", item: "/"}]`.
A one-item breadcrumb carries no navigation signal.
**Recommendation**: Drop it from the homepage or extend to real hierarchy (Home > Tools, etc.).

### LOW-2 — Trailing-slash mismatches between schema URLs and canonicals
**Evidence**: Tool schema URLs use a trailing slash
(`"url": "https://yt-seo-architect.vercel.app/tools/tag-generator/"`) while the page's canonical
is `https://yt-seo-architect.vercel.app/tools/tag-generator` (no slash). Glossary term schema URLs
have no trailing slash while the /glossary/ index canonical uses one. Both variants resolve 200,
so the site serves duplicate URL forms; schema should match the canonical exactly.
**Recommendation**: Standardize (recommend no trailing slash except where the canonical uses one)
and make schema `url` identical to the canonical.

### LOW-3 — SpeakableSpecification blocks are inert
**Evidence**: Blog posts emit a standalone `SpeakableSpecification` (`xPath: [/html/head/title,
/html/head/meta[@name='description']/@content]`) that no WebPage/Article references via the `speakable` property. Standalone SpeakableSpecification has no effect.
**Recommendation**: Add a WebPage node with `"speakable": {"@id": "...speakable..."}` wired to the
specification, or remove the blocks.

### LOW-4 — Type inconsistency: SoftwareApplication vs WebApplication
**Evidence**: Homepage uses `SoftwareApplication`; tool and /vs/ pages use `WebApplication` (a
subtype — technically valid, but inconsistent across the site and across the 38 tool pages).
**Recommendation**: Standardize on `SoftwareApplication` everywhere (what Google's documentation
uses for web apps) with `offers` price "0".

### LOW-5 — Blog breadcrumb self-references the article with a category label
**Evidence**: Blog BreadcrumbList item 3: `{position: 3, name: "Keyword Research", item:
"https://yt-seo-architect.vercel.app/blog/how-to-keywords-youtube"}` — the crumb's URL is the
article itself, not a category page (no /blog/category/keyword-research exists in sitemap).
**Recommendation**: Point the crumb at a real category URL or drop the third level.

### LOW-6 — Duplicate canonical tags in blog <head>
**Evidence**: blog/how-to-keywords-youtube contains two identical
`<link rel="canonical" href="https://yt-seo-architect.vercel.app/blog/how-to-keywords-youtube" />`
tags. Duplicate canonicals are ignored/confusing to parsers.
**Recommendation**: Emit once (template fix).

### INFO-1 — No WebPage type anywhere
**Evidence**: No page emits a WebPage node; Article/BreadcrumbList/FAQPage float without a page
entity (only `mainEntityOfPage.@id` strings). A WebPage node with `speakable`, `about`,
`inLanguage` would tie the graph together and is where speakable belongs.
**Recommendation**: Add WebPage to every template's @graph.

### INFO-2 — /vs/ pages have minimal schema
**Evidence**: `https://yt-seo-architect.vercel.app/tools/youtube-metadata-auditor-vs-vidiq-shadow-ban`
emits only a WebApplication block (name is lowercase-mixed "Youtube metadata auditor vs vidiq
shadow ban"). No comparison content schema, no FAQ, no Article. Schema.org has no native
comparison type; Article + FAQPage is the practical pattern.
**Recommendation**: Optional — add Article/FAQPage to the 6 /vs/ pages for consistency with the
rest of the site.

---

## Recommendations summary (by page type)

| Page type | Count | Do now |
|---|---|---|
| Blog posts | 45 | Fix broken JSON (escape HTML, json.dumps, build gate); dedupe into one @graph; fix duplicate canonical; fix breadcrumb self-link |
| Glossary terms | 8,571 | Add DefinedTerm; fix publisher logo (404); keep breadcrumbs; drop/strip FAQ stuffing |
| Glossary index | 1 | Fix "75+" description; add mainEntity ItemList |
| Tool pages | 38 | Ensure every page has SoftwareApplication + Offer(0); fix trailing-slash URL; align with canonical |
| /blog, /tools hubs | 2 | Add Blog/CollectionPage + ItemList + BreadcrumbList (currently zero schema) |
| Homepage | 1 | Fix logo 404; repoint or drop SearchAction; drop 1-item breadcrumb; keep the rest |
| /vs/ pages | 6 | Optional Article/FAQPage |
| All pages | — | Add WebPage node; standardize SoftwareApplication; match schema url to canonical |

## Summary

The site's schema foundation is sound on the homepage — one valid @graph with correct
SoftwareApplication (free Offer), WebSite SearchAction, and Organization — and glossary pages ship
valid Article + 4-level BreadcrumbList markup. But three systemic problems dominate: (1) blog
JSON-LD is broken by unescaped HTML in 2 of 3 sampled posts (Critical); (2) the Organization logo
referenced across the homepage and all glossary pages is a 404 (High); (3) key page classes —
/blog, /tools hubs, and at least one tool template — ship with zero schema, and the SearchAction
targets a login-gated dashboard (High). The biggest upside is converting 8,571 glossary
definitions from Article to DefinedTerm, and the FAQPage investment yields nothing since Google
deprecated FAQ rich results in July 2025. Fixes are template-level (escaping, dedupe, logo URL,
WebPage node, DefinedTerm) and low-risk; a build-time JSON-LD validation gate would prevent
regression.
