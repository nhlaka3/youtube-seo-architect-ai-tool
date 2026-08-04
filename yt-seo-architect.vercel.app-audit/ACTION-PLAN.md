# ACTION PLAN — yt-seo-architect.vercel.app (Audit 2026-08-03, Score 67)

Prioritized roadmap from the 2026-08-03 re-audit. Prior audit's criticals are fixed — these are the next layer.

---

## Phase 1: Critical Fixes (Week 1)

| # | Item | Files/Where | Details |
|---|---|---|---|
| 1 | **Purge 324 broken "double-vs" glossary URLs from sitemap** | `scripts/index-glossary.mjs` / `scripts/generate-glossary*.mjs` / sitemap generator | URLs matching `/{term}-vs-{tool}-vs-{tool}` (tool ∈ vidiq, tubebuddy) are ~73% 404. Exclude any slug with ≥2 `-vs-` segments from sitemap + link index. Also fix `/glossary/vidiq-vs-tubebuddy` (EN) and `/glossary/es/vidiq-vs-tubebuddy` (PT works — replicate its render path). |
| 2 | **Resolve 5 residual blog/tools cannibalization pairs** | `api/[...path].js` redirect table or `tools.html` generator | 301 `/tools/{youtube-for-tutorials-2026, youtube-intro-hook-first-3-seconds, youtube-monetization-tips-2026, youtube-seo-for-business-channels-2026, youtube-seo-for-gaming-channels-2026}` → `/blog/{same-slug}`. If the tools variants are meant to be interactive tools, keep them but **noindex** them instead of 301. |
| 3 | **Regenerate sitemap** | sitemap generator | After #1, regenerate so only resolvable URLs ship. Verify: sample 50 glossary URLs → 0 non-200. |

## Phase 2: High-Impact Improvements (Weeks 2-3)

| # | Item | Files/Where | Details |
|---|---|---|---|
| 4 | **Fix /tools canonical loop** | `tools.html` (root) | Canonical currently `…/tools.html` which 308s to `/tools`. Change to `<link rel="canonical" href="https://yt-seo-architect.vercel.app/tools">`. |
| 5 | **Add missing canonicals** | `about.html`, `privacy-policy.html`, `terms-of-service.html`, `contact.html` | Self-referencing canonicals on each. |
| 6 | **Dedupe blog canonical tags** | blog post template (DB renderer `api/blog-renderer.js` + static posts) | `/blog/youtube-tags-2026` emits 2× canonical. Ensure template emits exactly one. |
| 7 | **Regenerate llms.txt + llms-full.txt** | `scripts/generate-llms-content.mjs` | Cover all 50 blog posts (currently 17), add top ~100 glossary terms with definitions, exclude broken entries (the "Page not found" /blog/generic-hero section). |
| 8 | **Handle /blog/generic-hero** | remove or 410 | Orphaned stub returns 200 and leaks into llms-full.txt. |

## Phase 3: Content & Authority (Month 2)

| # | Item | Details |
|---|---|---|
| 9 | **Person/Author schema + author pages** | Add `Person` JSON-LD with name, url, sameAs on blog posts + About page. Give the site a named human author — critical for E-E-A-T in a money-adjacent niche. |
| 10 | **Rewrite boilerplate tool descriptions** | ~95 tool pages + llms.txt entries use identical filler text. Unique value propositions per tool. |
| 11 | **Trim blog SERP titles ≤60 chars** | Remove "…" truncation (76-char titles visible in SERP). |
| 12 | **VideoObject schema** | Add to tool/blog pages targeting YouTube creators. |

## Phase 4: Monitoring & Iteration (Ongoing)

| # | Item | Details |
|---|---|---|
| 13 | **Connect Google APIs** | Add GOOGLE_API_KEY + GSC creds → enables CrUX field data + URL inspection in future audits (script already exists: `scripts/fetch-crux-field-data.mjs`). |
| 14 | **Sitemap index files** | 18,090 URLs / 3.4 MB sitemap — split into sitemap-index chunks for crawl efficiency. |
| 15 | **Re-audit cadence** | Re-run this audit monthly; prior-audit delta tracking shows +9 pts in <24h. |

---

## Expected Impact

- **Score 67 → ~78**: fixing #1-3 (critical) ≈ +6; #4-8 (high) ≈ +5.
- Removes ~240 soft-404s from Google's crawl budget.
- Kills 5 keyword-competition pairs.
- Doubles AI-crawler surface (llms.txt coverage).
