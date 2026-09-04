# GEO / AI-Search-Readiness + SXO + Images + Backlinks Audit — YT SEO Architect

- Target: https://yt-seo-architect.vercel.app/
- Audit date: 2026-08-17
- Method: curl (real HTTP), python3 3.12.3 HTML parsing, claude-seo commoncrawl_graph.py, DNS checks
- Severity scale: CRITICAL / HIGH / MEDIUM / LOW / PASS / INFO

---

## 1. AI Crawler Access (robots.txt) — PASS

robots.txt fetched: `curl -s https://yt-seo-architect.vercel.app/robots.txt` → HTTP 200.

### Exact directives (verbatim from live robots.txt)

```
User-agent: *
Allow: /
# Block internal/dev pages
Disallow: /blog/_TEMPLATE
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /node_modules/

# Allow AI search crawlers
User-agent: ChatGPT-User       Allow: /
User-agent: Google-Extended    Allow: /
User-agent: PerplexityBot      Allow: /
User-agent: ClaudeBot          Allow: /
User-agent: anthropic-ai       Allow: /
User-agent: OAI-SearchBot      Allow: /
User-agent: Applebot-Extended  Allow: /
User-agent: Bytespider         Allow: /

# Block training-only crawlers
User-agent: GPTBot             Disallow: /
User-agent: CCBot              Disallow: /
User-agent: GrokBot            Disallow: /
User-agent: Amazonbot          Disallow: /
User-agent: Meta-ExternalAgent Disallow: /
User-agent: cohere-ai          Disallow: /
User-agent: Cohere-Research    Disallow: /
User-agent: AI2Bot             Disallow: /
User-agent: YouBot             Disallow: /
User-agent: DuckAssistBot      Disallow: /
User-agent: Timpibot           Disallow: /
User-agent: Diffbot            Disallow: /
User-agent: OmgiliBot          Disallow: /
User-agent: ExaBot             Disallow: /

Sitemap: https://yt-seo-architect.vercel.app/sitemap.xml
```

### Verification
- All 8 target AI *search/reference* crawlers ALLOWED: ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider — each with `Allow: /`. ✅
- All major AI *training* crawlers BLOCKED: GPTBot, CCBot, GrokBot, Amazonbot, Meta-ExternalAgent, cohere-ai, Cohere-Research, AI2Bot, YouBot, DuckAssistBot, Timpibot, Diffbot, OmgiliBot, ExaBot — each with `Disallow: /`. ✅
- GPTBot blocked while ChatGPT-User + OAI-SearchBot allowed = correct OpenAI search-vs-training split. ✅
- Sitemap declared and live: `curl -s -o /dev/null -w "%{http_code}" https://yt-seo-architect.vercel.app/sitemap.xml` → HTTP 200. ✅
- Internal/dev paths (`/api/`, `/admin/`, `/_next/`) blocked from all crawlers — good hygiene. ✅

**Verdict: PASS.** robots.txt is exemplary: search crawlers in, training crawlers out, sitemap advertised. No changes needed.

---

## 2. llms.txt Quality — PASS (1 LOW)

`curl -s https://yt-seo-architect.vercel.app/llms.txt` → HTTP 200, 98,964 bytes (~99 KB).

### Structure (verified by heading scan)
```
# YT SEO Architect                          <- H1
> AI-powered YouTube SEO platform — 90+ free tools ...  <- blockquote description
> Site: https://yt-seo-architect.vercel.app
> Updated: 2026-08-17                        <- freshness (audit date = same day)

## Core Platform                             <- H2, 7 bullets
## Blog Posts (72)                           <- H2, 72 bullets (count matches header)
## Topic Guides with Interactive Tools (126)  <- H2, 126 bullets
## Glossary (111 key terms)                  <- H2, 111 bullets
```
- Total bullet links: 316; empty/malformed bullets: 0. Every entry is `- [Title](url): description` with a one-line summary.
- Blog bullets carry per-post dates, e.g. `... (2026-08-17)`.
- **Coverage**: key pages (Homepage, Dashboard, Tools, About, Pricing, Privacy, Terms) + all 72 blog posts + 126 topic guides + 111 glossary terms. Comprehensive.
- **Freshness**: `Updated: 2026-08-17` — same day as audit; current. ✅

### LOW — tool-count inconsistency
- llms.txt Tools bullet: "85 free interactive YouTube SEO tools"
- Homepage meta description: "90+ free tools" / llms.txt header: "90+ free tools"
- AI crawlers reconciling the two will see conflicting tool counts. Pick one number and use it everywhere (llms.txt header, homepage meta, /tools page).

**Verdict: PASS** — correct llms.txt spec structure (H1, H2, bullet links, Updated line), fresh, deep coverage. Fix the 85-vs-90 count for consistency.

---

## 3. Citability — PASS (2 LOW notes)

Three blog posts fetched (all HTTP 200):
- /blog/youtube-content-calendar-template-2026 (2026-08-17)
- /blog/how-many-subscribers-to-monetize-youtube-2026 (2026-08-07)
- /blog/youtube-tags-2026 (2026-07-22)

### Author bylines — PRESENT
- `<meta name="author" content="Patrick" />` on posts; visible "By Patrick" text in author box (6 "By" matches in HTML).
- Person JSON-LD: `{"@type":"Person","name":"Patrick","url":".../about","sameAs":["https://github.com/nhlaka3"],"knowsAbout":["YouTube SEO","YouTube Analytics","YouTube Algorithm","Content Strategy"]}`.
- "Patrick" appears 4x per post (all 5 checked posts).

### Publish dates — PRESENT
- `article:published_time` meta + `datePublished` + `dateModified` JSON-LD on all 3 posts, e.g. `article:published_time" content="2026-08-17"` / `"datePublished":"2026-08-07"`.
- First-person authorship voice present ("I'll walk through both gates...").

### Stats with sources — PRESENT (strong on monetize post)
- Monetize post cites YouTube's official policy pages with retrieval date:
  - `https://support.google.com/youtube/answer/72851` (YPP thresholds) ×3
  - `https://support.google.com/youtube/answer/72857` (fan-funding tier)
  - Inline: "These numbers are the current public thresholds on YouTube's official monetization policy page (retrieved 2026-08-07)."
- tags post cites Canva/Adobe/DaVinci (tool context links).

### Quotes — ABSENT (minor)
- 0 `<blockquote>` in content-calendar post; no quoted expert/creator statements found. Quotes are a citability booster, not a blocker. LOW.

### Section headings for LLM extraction — EXCELLENT
- content-calendar post: 1 H1, 10 H2, 15 H3. H2 sample: `⚡ TL;DR`, `📑 In This Article`, `What Is a YouTube Content Calendar and Why It Matters in 2026`, `The Complete Breakdown: ...`, `Step-by-Step Guide`, `Best Tools and Methods`, `5 Content Calendar Mistakes...`, `Advanced Strategies...`.
- tags post: 11 H2 incl. `⚡ TL;DR (Direct Answer)`, `❓ Frequently Asked Questions`, `🎯 Key Takeaways`, `🔥 Trending Now in YouTube`, `📊 Trusted by YouTube Creators`.
- Article JSON-LD includes `speakable` xpath (`/html/head/title`, `//h1`, `//*[@id='direct-answer']`, `//*[@class='tldr']`); FAQPage schema with 5 Q&As + speakable.
- These patterns (Direct Answer first, TOC, FAQ, Key Takeaways) are ideal for LLM extraction and AI-answer citation.

### LOW — affiliate links may dilute citability
- Posts contain affiliate links: Amazon (`tag=44HlecM`, 3 generic product links per post), Canva (`?via=YTSEO`), Adobe (`sdid=KRQLO`). Amazon products appear generic/unrelated to YouTube-tags topic. Keep affiliate links minimal and topically relevant; AI systems weigh outbound link quality when citing.

### LOW — thin author entity
- Patrick has no last name, no LinkedIn in Person schema (only GitHub), author page = /about. For entity-based citation (Google's knowledge graph, Perplexity "who wrote this"), a fuller byline (name + short bio + socials) strengthens authority.

**Verdict: PASS** — bylines, dates, primary-source citations, and LLM-friendly structure all present.

---

## 4. Brand Mention / Entity Signals — PASS (1 MEDIUM)

### Organization schema on homepage — PRESENT (strong)
Homepage JSON-LD `@graph` contains:
- `Organization`: name "YT SEO Architect", url `https://yt-seo-architect.vercel.app/`, logo `https://yt-seo-architect.vercel.app/logo.png`, email `thiza3062@gmail.com`, description, sameAs: [`https://twitter.com/YTSEOArchitect`, `https://linkedin.com/company/yt-seo-architect`, `https://github.com/nhlaka3`].
- `WebSite`: name + url.
- `SoftwareApplication`: price "0" USD, `applicationCategory: MultimediaApplication`, 17-item featureList, speakable.
- Logo asset verified live: `logo.png` → HTTP 200 (10,023 B).

### Brand consistency — CONSISTENT
- Title tags (all brand-suffixed):
  - Home: `YT SEO Architect — AI YouTube SEO Tool | Keywords, Tags & Scripts`
  - Tools: `Free YouTube SEO Tools | YT SEO Architect`
  - Blog: `YouTube SEO Blog — Guides & Strategies | YT SEO Architect`
  - Post: `Youtube Content Calendar Template 2026 — YT SEO Architect`
- Footer (tools/blog/post): `© 2026 YT SEO Architect. All rights reserved.` + Privacy/Terms/About/Contact + Twitter/YouTube/GitHub social links.
- Homepage hero img alt embeds brand: "YT SEO Architect dashboard — keyword research, tag generator, title optimizer...".
- og:title/og:image (1200×630 og-image.png, HTTP 200) + twitter:card summary_large_image on homepage and posts.

### MEDIUM — stale freshness badge contradicts llms.txt
- Homepage footer badge: `✅ Updated May 2026 — actively maintained`
- llms.txt: `Updated: 2026-08-17`; newest blog post dated 2026-08-17.
- AI crawlers/LLMs that read both signals will see the site claiming "May 2026" freshness while content is current to Aug 2026. Update the homepage footer badge (or remove it) so freshness signals agree.

**Verdict: PASS** — full Organization/WebSite/SoftwareApplication entity graph, consistent naming across titles/footer/schema/socials. Fix the stale footer date.

---

## 5. SXO (Search Experience Optimization) — PASS (1 LOW)

### Page-type match
| Page | Title/intent | H1 | H2 | H3 | Internal links | External links | CTA |
|---|---|---|---|---|---|---|---|
| Homepage | AI YouTube SEO tool — matches "free youtube seo tool" intent | 1 | 10 | 26 | 41 | 1 (Google permissions link) | 52 CTA-ish links; buttons "Dashboard"/"Cancel" |
| /tools | "Free YouTube SEO Tools" — matches tool-hunting intent | 1 | 7 | 36 | 52 | 5 (social) | 38 CTA links |
| /blog | "Guides & Strategies" — matches learning intent | 1 | 0 | 1 | 74 | 5 (social) | 70 CTA links |
| Blog post | Exact-match title | 1 | 10 | 15 | 48 | 8 (sources + affiliate + social) | "Get Started Free →", "Browse All Tools", "Dashboard" |
| Tool page /tools/keywords-youtube | "Keywords youtube — Free Interactive Tool" | 1 | — | — | 21 | 5 (social) | — |

- Every page checked has a single clear H1, an intent-matched title, prominent CTAs (hero CTA, mid-content CTA boxes, sticky nav CTA), and no dead ends.
- External links on tool/blog pages are social profiles + sources; homepage's only external link is the Google OAuth permissions page (expected).

### Dead-end check (zero internal outbound links) — PASS
- No page with zero internal links found: homepage 41, tools 52, blog 74, blog post 48, tool page 21. All pages funnel to /tools, /dashboard, /blog, related posts, and footer nav.

### LOW — /blog listing has 0 H2 (only 1 H3)
- The blog index lacks H2 section structure (no category groupings, no "Latest"/"Popular" headers). For LLM/AI crawlers summarizing the listing, add H2 sections (e.g., "Latest Guides", "Popular Topics", "By Channel Type") to group the 72 posts.

**Verdict: PASS** — strong page-type match, clear CTAs, zero dead ends.

---

## 6. Images — PASS (0 defects)

Extracted all `<img>` tags with python3 regex parser.

### Homepage (home.html)
- Total `<img>`: 1
- Missing/empty alt: 0
- Missing width or height: 0
- loading=lazy: 1 | eager: 0 | no loading attr: 0
- Evidence: `<img src="/dashboard-hero.png" alt="YT SEO Architect dashboard — keyword research, tag generator, title optimizer, and analytics in one free AI YouTube SEO tool" width="1200" height="750" ... loading="lazy">`

### Blog post (youtube-content-calendar-template-2026)
- Total `<img>`: 2
- Missing/empty alt: 0
- Missing width or height: 0
- loading=lazy: 1 | eager: 1 | no loading attr: 0
- Evidence:
  - Hero: `<img src="/blog/...-hero.png" alt="Youtube Content Calendar Template 2026 guide — YT SEO Architect" width="800" height="400" loading="eager" fetchpriority="high">` (correct LCP pattern)
  - Inline: `<img src="/blog/...-visual-1.png" alt="Average CTR by Search Position" width="800" height="420" loading="lazy">`

### Other checks
- og:image (1200×630) present on homepage + posts; `og:image:width/height/type` set; twitter:card = summary_large_image.
- All hero/OG assets verified HTTP 200: og-image.png (197 KB), logo.png (10 KB), dashboard-hero.png (142 KB).
- No data-URI/SVG images. 0/3 images missing alt; 0/3 missing dimensions.

**Verdict: PASS** — every image has descriptive alt text, explicit dimensions, and correct lazy/eager loading strategy.

---

## 7. Backlinks (Common Crawl) — NO DATA (limitation)

Command: `/home/nhlaka/.claude/skills/seo/bin/claude-seo run commoncrawl_graph.py https://yt-seo-architect.vercel.app`

Result (cc-main-2026-jan-feb-mar, cached):
```
Common Crawl Domain Metrics: yt-seo-architect.vercel.app
  PageRank:            None (rank #None)
  Harmonic Centrality: None (rank #None)
  Number of hosts:     None
```
- No host-level graph data exists for the vercel.app subdomain in the Common Crawl index. Expected behavior: *.vercel.app subdomains are not tracked as standalone hosts in CC's host graph, so this is a known limitation of the free CC-based tool, not necessarily proof of zero backlinks.
- Retried with `https://yt-seo-architect.com` → query produced zero output and was killed after ~4 minutes (domain has no DNS records — see §8 — so no data can exist). No domain-level link data is available from Common Crawl for either host.

### Limitation + recommendation
- **No backlink/domain-authority data available** via Common Crawl. Verify with a commercial index (Ahrefs/Majestic/SEMrush API) or by inspecting Google Search Console "Links" report once Search Console is connected.
- The site sits on `*.vercel.app` — a free subdomain with no inherited domain authority. Moving to a custom domain (and 301-redirecting the subdomain) is the prerequisite for building a meaningful, trackable backlink profile; brand mentions and citations currently point at the free subdomain.

---

## 8. Custom Domain — NOT CONFIGURED (HIGH)

`curl -sI https://yt-seo-architect.com` → **HTTP 000** — connection failed.
- `curl -v` output: `* Could not resolve host: yt-seo-architect.com` / `* Closing connection`
- `getent hosts yt-seo-architect.com` → no result (DNS NXDOMAIN-equivalent).
- The `.com` domain is not pointed at Vercel (no A/AAAA/CNAME records resolving), i.e., not live as a custom domain.

### Impact (HIGH)
- Entire site — content, llms.txt, JSON-LD, canonical URLs, social shares — lives on `https://yt-seo-architect.vercel.app/`.
- Consequences for GEO/AI-search readiness:
  1. No domain authority; every citation/mention carries a free-subdomain URL.
  2. `vercel.app` subdomains are commonly filtered/penalized by SEO tools and some AI crawler link extractors.
  3. Brand queries ("YT SEO Architect") cannot surface a branded domain, weakening entity recognition.
  4. Backlink building is effectively impossible to attribute at domain level (see §7).

**Recommendation (HIGH):** register yt-seo-architect.com (and ideally .ai/.io), point DNS at Vercel, add the domain in Vercel project settings, 301-redirect vercel.app → custom domain, and update llms.txt, sitemap, and all JSON-LD `url`/`@id` fields to the custom domain.

---

## Summary Scorecard

| Area | Verdict | Key issue |
|---|---|---|
| 1. AI crawler access (robots.txt) | PASS | — (8 search crawlers allowed, 14 training crawlers blocked, sitemap live) |
| 2. llms.txt | PASS (1 LOW) | 85-vs-90 tools count inconsistency; otherwise spec-perfect, fresh (2026-08-17), 316 links |
| 3. Citability | PASS (2 LOW) | bylines/dates/primary-source citations present; no blockquotes; thin author entity; affiliate links |
| 4. Brand/entity signals | PASS (1 MEDIUM) | full Organization+WebSite+SoftwareApplication schema; stale "Updated May 2026" footer badge vs llms.txt 2026-08-17 |
| 5. SXO | PASS (1 LOW) | intent-matched pages, CTAs, zero dead ends; /blog lacks H2 structure |
| 6. Images | PASS | 0/3 missing alt, 0/3 missing dimensions, correct lazy/eager |
| 7. Backlinks | NO DATA (limitation) | Common Crawl has no host-level data for vercel.app subdomain; .com query empty/timed out |
| 8. Custom domain | HIGH | yt-seo-architect.com does not resolve (HTTP 000); site fully on free vercel.app subdomain |

### Top 3 priorities
1. **HIGH — Get a custom domain live** (register + Vercel DNS + 301 from vercel.app + update all canonical/schema/llms.txt URLs). Unblocks domain authority, backlink tracking, and brand-entity growth.
2. **MEDIUM — Fix freshness contradiction**: homepage footer says "Updated May 2026", llms.txt says 2026-08-17. Align or remove the footer badge.
3. **LOW — Consistency + structure**: unify 85-vs-90 tool count across llms.txt/homepage; add H2 sections to /blog listing; consider fuller author byline and fewer generic affiliate links.

*Audit artifacts: /tmp/ytseo-audit/robots.txt, /tmp/ytseo-audit/llms.txt, /tmp/ytseo-audit/pages/*.html, /tmp/ytseo-audit/img_audit.py, /tmp/ytseo-audit/sxo_audit.py*
