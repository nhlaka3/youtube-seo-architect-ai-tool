# ACTION PLAN — yt-seo-architect.vercel.app

Prioritized recommendations from the 2026-08-17 full audit. Severity: **Critical** (blocks indexing/penalties — none found) > **High** (significant ranking impact) > **Medium** (optimization) > **Low** (backlog).

---

## Phase 1: Critical Fixes (Week 1)

| # | Severity | Action | Where | Effort |
|---|---|---|---|---|
| 1 | High | **Register a custom domain** (yt-seo-architect.com + consider .ai/.io). Point DNS at Vercel, add domain in project settings, 301-redirect vercel.app → custom domain. Then update llms.txt, sitemap, all JSON-LD url/@id, canonicals, OG tags to the custom domain. | Vercel dashboard + registrar + repo | 2–4 hrs |
| 2 | High | **Regenerate blog meta descriptions**: unique, grammatical, 120–160 chars, one per post. Fix "Learn how to creating…" template in the blog pipeline. | blog pipeline (auto-blog-generator.mjs / publish scripts) | 1–2 hrs |
| 3 | High | **Fix 5 meta description length violations**: / (175c), /guides (169c), /guides/youtube-seo-strategy-2026 (193c), /tools/channel-audit-score (256c — wrong boilerplate describing a text analyzer), /tools/keyword-difficulty-scorer (108c). | static HTML + tool generators | 1 hr |
| 4 | High | **Add source citations** to posts making statistical claims. Standardize the citation practice already present in /blog/youtube-seo-tips-for-creators-in-2026 (support.google.com answers + backlinko) across the pipeline. Add "retrieved YYYY-MM-DD" pattern. | blog pipeline templates | 2–3 hrs |
| 5 | High | **Build out /tools/keyword-difficulty-scorer**: 300–600 words how-to copy, FAQ, internal links to guides, H2s. | tool page template + generate-all-metric-tools.mjs | 1–2 hrs |

## Phase 2: High-Impact Improvements (Weeks 2–3)

| # | Severity | Action | Where |
|---|---|---|---|
| 6 | Medium | Fix title/H1 mismatch on /blog/youtube-seo-tips-for-creators-in-2026 (title says "YouTube Tags 2026…", H1 says "YouTube SEO Tips…"; remove literal "…"). | post HTML |
| 7 | Medium | Rewrite ungrammatical templated titles: "Creating High Click-through Rates Youtube Thumbnails 2026" → "How to Create High-CTR YouTube Thumbnails in 2026" (add articles, fix capitalization) across all posts. | blog pipeline |
| 8 | Medium | Add contextual tool/guide links inside blog post bodies (currently 0 /tools/, 0 /guides/ links in post bodies). | blog pipeline |
| 9 | Medium | Complete /tools index to link all 52 tool pages (currently 23 → ~29 tool pages unreachable from hub). | tools index |
| 10 | Medium | De-orphan 8 /blog/category/* pages: link categories from posts + blog index, or noindex them. | blog templates |
| 11 | Medium | Add /dashboard, /contact, /privacy-policy, /terms-of-service to sitemap-core.xml. | sitemap generator |
| 12 | Medium | Add /contact to footer (currently hidden from footer/homepage — trust signal). | site footer template |
| 13 | Medium | Add affiliate disclosure ("contains affiliate links") near Amazon/Canva/Adobe links on blog posts (FTC). | blog templates |
| 14 | Medium | Fix stale "✅ Updated May 2026" footer badge → current date or remove (contradicts llms.txt 2026-08-17). | homepage HTML |
| 15 | Medium | Improve blog readability: target FRE 60+ (currently 41.9–49.1, 11th–12th grade) — shorter sentences, simpler vocabulary. | blog pipeline / style guide |
| 16 | Medium | Expand founder identity on /about: surname, photo, short bio, credentials, LinkedIn; enrich Person schema (jobTitle, alumniOf, more sameAs). | about page + homepage schema |
| 17 | Medium | Connect GSC to the custom domain + add PageSpeed API key; verify CWV field data (LCP<2.5s, CLS<0.1, INP<200ms). | GSC + claude-seo config |

## Phase 3: Content & Authority (Month 2)

| # | Severity | Action |
|---|---|---|
| 18 | Low | Switch Article → BlogPosting JSON-LD on posts. |
| 19 | Low | Add SearchAction (sitelinks searchbox) to WebSite schema; add ItemList/Blog schema to /blog index. |
| 20 | Low | Add H2 sections to /blog index (Latest Guides, Popular Topics, By Channel Type). |
| 21 | Low | Unify tool count: "85 free tools" vs "90+ tools" — pick one across llms.txt, homepage meta, /tools. |
| 22 | Low | Add lastmod to glossary sitemaps (393 URLs) — freshness signal. |
| 23 | Low | Add blockquotes/expert quotes to posts (citability booster). |
| 24 | Low | Add FAQ + feature comparison to /pricing (266 words → target "youtube seo tool pricing" queries). |
| 25 | High | **Backlink building** (now unblocked by custom domain): dev.to posts, GitHub repos, niche YouTube-tool directories, guest posts, HARO-style citations. Goal: 20+ referring domains. |

## Phase 4: Monitoring & Iteration (Ongoing)

- Re-run this audit after custom domain migration — confirm canonicals, llms.txt, schema, sitemap all use the new domain.
- Monitor GSC: indexation, head-term rankings (current: 7.9–9.3, goal top-10), CTR by query.
- Track CWV in CrUX after API key added; watch for regressions on new tool pages.
- Quarterly: re-audit content quality (citations, readability, meta freshness) as the blog pipeline evolves.

---

## The 3 highest-leverage moves

1. **Custom domain** — unblocks domain authority, backlink attribution, brand entity, and AI-crawler link extraction. Everything else compounds from this.
2. **Fix the meta description + title template in the blog pipeline** — one code change fixes ~59 posts of weak SERP differentiation.
3. **Citations in every post** — the site's AI-search readiness is otherwise excellent; claims without sources are the main citability gap, and citations directly feed Perplexity/ChatGPT/AI Overviews answers.

*Generated 2026-08-17 by the seo-audit skill (Claude SEO v2.2.4). Evidence: FULL-AUDIT-REPORT.md + findings/*.md.*
