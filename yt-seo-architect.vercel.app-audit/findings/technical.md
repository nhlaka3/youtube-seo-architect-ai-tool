# Technical SEO Audit — yt-seo-architect.vercel.app

Audit date: 2026-07-31 | Method: live curl checks (no crawl.json available — fetched live)
Sitemap: 8,667 URLs (8,571 glossary + 45 blog + 37 tools + 6 /vs/ + 9 core/guide)

---

## 1. CRITICAL — ~90% of glossary "-vs-" pages return HTTP 500 (server error)

**Evidence:** `https://yt-seo-architect.vercel.app/glossary/vidiq-vs-tubebuddy` returns
`HTTP 500` with body `{"error":"Cannot read properties of undefined (reading 'slug')"}`.
Random sample of 90 "-vs-" pages across languages: **84 failed (93%)** — en 29/30,
es 28/30, pt 27/30. A sitemap-ordered sample of 40 showed 16 fails (40%), so the true
failure rate is between ~40% and ~93% of the 8,328 vs- URLs in the sitemap
(≈3,300–7,700 broken URLs). Failures are stable across repeated requests (500/500 on
retest) — a deterministic serverless-function bug, not rate limiting. Working examples
(e.g. `/glossary/dwell-time-vs-super-chat`, `/glossary/pt/dwell-time-vs-super-chat`)
show the feature can work, so the bug is data-dependent (missing term in the lookup map,
e.g. brand terms like `vidiq`/`tubebuddy` and combos where a term resolves to undefined).

**Impact:** Google/Bing will treat these as server errors (noindex-able only after
repeated 500s; crawl budget burned across ~7,000 URLs on every crawl; sitemap is ~90%
broken). Users clicking glossary links get raw JSON errors. This is the single biggest
technical issue on the site.

**Recommendation:** Fix the lookup bug (defensive handling when a term slug is missing;
return 404, never 500, for missing data). Remove broken vs- URLs from the sitemap until
fixed, or fix the data source so every sitemap URL resolves. Add uptime/monitoring on a
sample of vs- URLs.

## 2. CRITICAL — 81 /glossary/pt/ plain-term URLs in sitemap return 404

**Evidence:** All 10 tested pt plain pages 404, e.g. `/glossary/pt/youtube-algorithm`
→ `HTTP 404`, body `{"error":"Not found","path":"/glossary/pt/youtube-algorithm"}`.
The pt plain-term pages (81 in sitemap) were never generated; only pt vs- pages exist.
(For contrast, en and es plain pages work: 10/10 each → 200.)

**Impact:** Sitemap contains URLs that don't exist. Combined with finding #1, ~7,800 of
8,667 sitemap URLs (≈90%) return errors.

**Recommendation:** Generate the 81 pt plain-term pages, or remove them from the
sitemap. Add a sitemap-validation step to the build (only emit URLs that return 200).

## 3. HIGH — Canonical tags on /tools, /glossary, /dashboard point to redirecting URLs (canonical loops)

**Evidence:**
- `/tools` → `<link rel="canonical" href="https://yt-seo-architect.vercel.app/tools.html">` — but `/tools.html` returns **308** → `/tools`
- `/glossary` → canonical `https://yt-seo-architect.vercel.app/glossary/` — but `/glossary/` returns **308** → `/glossary`
- `/dashboard` → canonical `https://yt-seo-architect.vercel.app/dashboard.html` — but `/dashboard.html` returns **308** → `/dashboard`

Each canonical points at a URL that permanently redirects back to the page itself
(confirmed: 308, single hop). `/tools` and `/glossary` are indexable pages, so Google
receives a self-referencing redirect loop via the canonical tag.

**Recommendation:** Set canonical to the exact final URL (no trailing slash, no .html)
on all three pages. Root cause is likely the same template bug as #5.

## 4. HIGH — /dashboard is in the sitemap but is noindex,nofollow

**Evidence:** `/sitemap.xml` includes `<loc>https://yt-seo-architect.vercel.app/dashboard</loc>`
(priority 0.9). The page itself serves `<meta name="robots" content="noindex, nofollow" />`
(HTTP 200). Also `/dashboard` is linked from core navigation.

**Impact:** Sitemap/noindex conflict — Google explicitly discourages submitting
noindexed URLs; signals contradict each other and the sitemap trust is degraded.
(noindex itself is correct for a logged-in app surface.)

**Recommendation:** Remove `/dashboard` from the sitemap (and the `<priority>0.9</priority>`
entry). Keep the noindex meta. Consider adding `X-Robots-Tag: noindex` header as well.

## 5. HIGH — Tool pages have no static <title> tag in raw HTML

**Evidence:** `/tools/tag-generator`, `/tools/title-optimizer`, `/tools/description-writer`
all return HTML with meta description + canonical + robots, but **no `<title>` tag**
(grep found zero `<title>` elements). These are SPA pages (Vite, `/assets/main-*.js`);
titles are presumably set client-side via JS, which is fragile for indexing and SERP
display. For contrast, `/tools/best-youtube-seo-tools-2026` (static-rendered) has a
proper title.

**Impact:** Risk of missing/blank titles in Google SERPs and for JS-less crawlers
(including some social scrapers); inconsistent title handling across the tools section.

**Recommendation:** Emit a static `<title>` per tool page server-side (or per-route
during prerender) matching the JS-set title.

## 6. MEDIUM — /blog/_TEMPLATE is live with placeholder content and index,follow

**Evidence:** `https://yt-seo-architect.vercel.app/blog/_TEMPLATE` → HTTP 200 with
`<title>[POST_TITLE] — YT SEO Architect</title>`,
`<meta name="robots" content="index, follow" />` and canonical
`https://yt-seo-architect.vercel.app/blog/[POST_SLUG]`. It is disallowed in robots.txt
(`Disallow: /blog/_TEMPLATE`) and absent from the sitemap, but robots.txt disallow does
not prevent indexing if the URL is discovered through other signals; the malformed
canonical with literal `[POST_SLUG]` is also a live template leak.

**Recommendation:** Delete the template from the deployed output, or at minimum add
`noindex, nofollow` meta and keep it disallowed. Ideally the deploy pipeline should
exclude `_TEMPLATE` files.

## 7. MEDIUM — Inconsistent security headers between /blog and the rest of the site

**Evidence:**
- `/`, `/tools/*`, `/glossary/*`, `/dashboard`: have CSP + HSTS (`max-age=63072000`),
  but **missing** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- `/blog` (+ posts): has CSP + HSTS (`max-age=31536000`) + `X-Frame-Options: SAMEORIGIN` +
  `X-Content-Type-Options: nosniff` + `Referrer-Policy: no-referrer` + `frame-ancestors`
  + `script-src-attr 'none'` + `upgrade-insecure-requests`.

**Impact:** Clickjacking risk and missing nosniff protection on ~99% of pages; header
inconsistency across sections. HSTS max-age differs (2y vs 1y).

**Recommendation:** Apply the stricter /blog header set site-wide (Vercel `headers`
config in vercel.json or middleware), with a single HSTS policy.

## 8. MEDIUM — hreflang clusters inconsistent and point at dead pages

**Evidence:** Working en page `/glossary/youtube-algorithm` declares hreflang `en`, `es`,
`x-default` (no `pt`). Working pt page `/glossary/pt/dwell-time-vs-super-chat` declares
`en`, `es`, `pt`. So en pages omit pt while pt pages include en/es — asymmetric clusters.
Worse, hreflang targets frequently 500: e.g. `/glossary/pt/dwell-time-vs-super-chat`
links to `/glossary/dwell-time-vs-super-chat` and `/glossary/es/dwell-time-vs-super-chat`
(these two currently 200), but for the ~93% of vs- terms that error, the en/es/pt
alternates point at 500s.

**Impact:** Google may ignore hreflang signals entirely when clusters are asymmetric or
point to server errors, harming international indexing of the 8,571-page glossary.

**Recommendation:** Generate hreflang clusters from one source of truth; emit a link only
if the target URL actually exists; include `x-default` and all three languages
(en/es/pt) consistently on every glossary page.

## 9. LOW — Stale counts in section titles

**Evidence:** `/glossary` `<title>` says "75+ Terms Defined" but the site has 8,571
glossary pages; `/tools` says "90+ Tools" but the sitemap contains 37 tool URLs
(+hub). Titles/descriptions understate and misrepresent the actual index size.

**Recommendation:** Regenerate titles from live counts, or drop the numbers.

## 10. LOW — Sitemap has no <lastmod>

**Evidence:** All 8,667 `<url>` entries carry only `<changefreq>`/`<priority>`, no
`<lastmod>`. (changefreq/priority are largely ignored by Google.)

**Recommendation:** Add `<lastmod>` (ISO 8601) from content build dates to improve
freshness signaling for the daily-updated blog/glossary.

## 11. LOW — CSP weakened by 'unsafe-inline'/'unsafe-eval'; jsdelivr not whitelisted

**Evidence:** `content-security-policy` on `/` includes `script-src 'self' 'unsafe-inline'
'unsafe-eval' ...`. `cdn.jsdelivr.net` is NOT whitelisted — however, no page currently
references jsdelivr or `@vercel/analytics` (grep = 0 on /, /blog, /tools, /glossary,
/dashboard), so the previously observed Vercel-Analytics console error appears
**resolved** (script removed). Risk returns if the script is re-added.

**Recommendation:** Keep analytics off jsdelivr (or whitelist the exact domain), and
gradually remove `unsafe-inline`/`unsafe-eval` (hash/nonce-based script-src) for a
defense-in-depth improvement.

## 12. INFO — Redirect hygiene is otherwise clean

**Evidence:** All observed redirects are **308 Permanent**, single-hop, no chains:
`http://` → `https://` (308), `/glossary/` → `/glossary` (308), `/tools.html` →
`/tools` (308), `/dashboard.html` → `/dashboard` (308), `/glossary/term/` →
`/glossary/term` (308). `www.yt-seo-architect.vercel.app` does not resolve (NXDOMAIN —
no www alias on the Vercel preview domain; ensure a canonical-domain redirect is
configured when a custom domain is added). URLs are case-sensitive: `/GLOSSARY/...` →
404 (no soft-404s).

## 13. INFO — robots.txt nuances

**Evidence:** Syntax valid; sitemap declared; `*` blocks `/api/`, `/admin/`,
`/blog/_TEMPLATE`, `/_next/`, `/node_modules/`; GPTBot/CCBot blocked; ChatGPT-User,
Google-Extended, PerplexityBot, Claude-Web, anthropic-ai, OAI-SearchBot,
Applebot-Extended, Bytespider allowed. Caveat: the per-agent `Allow: /` groups override
the `*` disallows, so AI crawlers are *not* blocked from `/api/`/`/admin/` (those paths
404 anyway, so practical risk is low).

**Recommendation:** If `/admin/` ever becomes live, repeat the Disallow rules inside
each AI-agent group, or rely on auth instead.

## 14. INFO — Glossary hub /glossary/pt/ and /guide edge cases

**Evidence:** `/glossary/pt` → 404 (no pt hub page, yet 2,857 pt URLs in sitemap).
`/guide/` → 308 → `/guide` → 404, while `/guide/youtube-seo` → 200 (sitemap has only
the latter). `/blog/_TEMPLATE` aside, all disallowed paths 404 correctly.

## What works

- **robots.txt:** well-formed, sitemap declared, training crawlers (GPTBot/CCBot)
  blocked, AI search crawlers allowed, internal paths disallowed for `*`.
- **Sitemap:** valid XML, exactly 8,667 URLs, zero duplicates, zero `http://` URLs,
  zero trailing-slash variants (except root), no `_TEMPLATE` leak; matches stated
  section counts (8,571 glossary / 45 blog / 37 tools / 6 vs).
- **Healthy sections:** homepage, /about, /blog + all 35 posts + 9 category pages,
  /tools hub + all 37 tool pages (10/10 random → 200), all 6 /vs/ pages (6/6 → 200),
  /guide/youtube-seo, en+es plain glossary pages (20/20 → 200) — all with correct
  self-canonicals and index,follow.
- **Redirect hygiene:** single-hop 308s everywhere; http→https enforced; no chains.
- **404 handling:** real HTTP 404 status (plain text NOT_FOUND; JSON for missing
  glossary terms); no soft-404s.
- **Security baseline:** HSTS with preload on all pages; CSP present everywhere;
  /blog section has a strong, complete header set.
- **Performance signals:** no mixed content; preconnect (fonts.googleapis.com,
  fonts.gstatic.com, apis.google.com) and dns-prefetch (paypal, groq) usage is sane;
  HTTP/2; Vercel edge caching (x-vercel-cache: HIT on static pages).
- **hreflang on en glossary pages:** includes x-default and en/es alternates.

---

## Summary

The site's technical foundation (robots.txt, sitemap integrity, redirects, 404s, HSTS)
is solid, but the glossary is catastrophically broken: roughly 90% of its 8,571 sitemap
URLs error — ~84/90 sampled "-vs-" pages return HTTP 500 (serverless lookup bug) and
all 81 pt plain-term pages 404 — so ~7,800 of 8,667 sitemap URLs are unusable right now.
Canonical tags on /tools, /glossary and /dashboard form redirect loops (pointing at
.html/trailing-slash URLs that 308 back), tool SPA pages ship without static <title>
tags, and /dashboard sits in the sitemap while noindexed. Fixing the vs- page lookup bug
and sitemap hygiene (drop broken/pt-plain/dashboard URLs, fix canonicals, add static
titles) is the highest-impact work; header unification and hreflang consistency are
secondary. Everything outside the glossary vs- generator — blog, tools, /vs/, guide,
core pages — is in good technical shape.
