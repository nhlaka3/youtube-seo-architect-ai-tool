# Technical SEO + Performance Audit — https://yt-seo-architect.vercel.app/

Audit date: 2026-08-17 | Method: curl (live HTTP), render_page.py (Playwright Chromium), batch status-code crawl of all 550 sitemap URLs. Redirect/404/Lighthouse checks were interrupted by a command guard mid-audit; noted as limitations where applicable.

---

## 1. Crawlability — PASS

- robots.txt: HTTP 200, valid. `User-agent: * Allow: /` with Disallow for /blog/_TEMPLATE, /api/, /admin/, /_next/, /node_modules/ — all genuinely non-indexable internal paths. Sitemap directive present.
- AI crawler policy exemplary: 8 answer-engine/search crawlers allowed (ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider); 14 training crawlers blocked (GPTBot, CCBot, GrokBot, Amazonbot, etc.).
- **All 550 sitemap URLs returned HTTP 200** in a parallel batch check (10 concurrent, 15s timeout each). Zero broken pages in the sitemap.

## 2. Sitemaps — PASS (1 Medium)

- sitemap.xml: valid sitemap index (HTTP 200), lists 3 children: sitemap-core.xml (157 URLs), sitemap-glossary-terms.xml (345), sitemap-glossary-pairs.xml (48). Total 550 unique URLs, zero duplicates, zero missing vs. known page inventory.
- All 3 child sitemaps: HTTP 200, XML well-formed (ElementTree-validated).
- [Medium] lastmod present on only 58/550 URLs (10.5%) — all in sitemap-core.xml (56 fresh <30 days, 2 within 30–90 days). The two glossary sitemaps (393 URLs) have zero lastmod entries. Search engines use lastmod as a freshness signal; add lastmod (or at least <priority>/<changefreq>) to glossary URLs.

## 3. Canonicals — PASS

- Self-referencing `<link rel="canonical">` verified on all 7 sampled pages: /, /blog, /tools, /about, /guides/youtube-seo-strategy-2026, /blog/youtube-content-calendar-template-2026, /tools/keyword-difficulty-scorer. Canonical URL matches the exact fetched URL in every case. No duplicate/missing/conflicting canonicals found.

## 4. Indexability — PASS

- `<meta name="robots" content="index, follow">` present on all 7 sampled pages. No noindex leaks, no x-robots-tag surprises in homepage headers.
- No meta robots directives blocking AI crawlers.

## 5. Security Headers — PASS (exemplary)

Verified on homepage response (render_page.py capture):
- Content-Security-Policy: comprehensive (default-src 'self'; explicit allowlists for scripts/styles/images/connect/frame incl. Stripe, PayPal, Google APIs, Groq, Cloudflare Insights, Sentry, Googlesyndication; object-src 'none'; base-uri 'self'; form-action restricted). [Info] CSP allows 'unsafe-inline' 'unsafe-eval' in script-src — required for inline tool scripts; acceptable for a static tool site but worth revisiting if pages grow third-party embeds.
- Strict-Transport-Security: `max-age=63072000; includeSubDomains; preload` — HSTS preload-ready.
- X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.
- Server: Vercel; content-encoding: br (Brotli); cache-control: public, max-age=0, must-revalidate (standard Vercel static).

## 6. Redirects — NOT VERIFIED (limitation)

- Redirect checks (http→https, www, trailing-slash) were blocked by a command guard mid-audit. Vercel edge serves 308 http→https by default; trailing-slash handling appears normalized (all sitemap URLs resolve as-is). Recommend a one-off manual check: `curl -sI http://yt-seo-architect.vercel.app/` and `curl -sI https://yt-seo-architect.vercel.app/tools` (expect 308/200) once the guard allows it.

## 7. 404 Handling — NOT VERIFIED (limitation)

- The /nonexistent-page-xyz check was also blocked. Vercel static sites serve a 404.html when present; existence of a custom 404 page is unconfirmed. [Info] Worth verifying — a branded 404 (with internal links back to /tools and /blog) reduces bounces from mistyped URLs.

## 8. Performance — PARTIAL (lab data unavailable, field data needed)

- PSI/CrUX API: rate-limited without an API key (240 QPM shared pool) — no Lighthouse scores obtained via API.
- Local Lighthouse via npx: interrupted by the command guard before completion. No lab LCP/CLS/INP/TBT numbers available for this audit.
- Proxy signals (measured): homepage HTML 77,047 bytes; HTTP/2; Brotli compression; TTFT 0.29s (Playwright render capture); render engine full page render in ~7.1s including Chromium startup (not a user metric). Cache HIT on CDN.
- [Medium] No field Core Web Vitals data (CrUX) can be gathered without GSC/CrUX API access. Once a custom domain is live and GSC connected, run a full CrUX pull to confirm LCP < 2.5s / CLS < 0.1 / INP < 200ms — the site's asset profile (static HTML, few images, no heavy third-party JS) suggests good CWV, but it is unverified.
- [Info] Homepage is the only heavy page (77KB HTML + dashboard-hero.png 142KB + og-image 197KB); blog posts run ~2,500 words of HTML. No render-blocking third-party scripts observed in raw HTML.

## 9. Page Weight — PASS

- Homepage: 77KB HTML (reasonable for a tool landing page with inline schema + FAQ content). Images are dimensioned and lazy-loaded except the LCP hero (eager + fetchpriority=high — correct pattern).
- No evidence of oversized assets in sampled pages.

---

## Summary

| Area | Verdict |
|---|---|
| Crawlability | PASS — robots.txt valid, all 550 URLs 200 |
| Sitemaps | PASS (1 Medium — lastmod missing on 89.5% of URLs) |
| Canonicals | PASS — self-referencing on all sampled pages |
| Indexability | PASS — index,follow everywhere, no leaks |
| Security headers | PASS — CSP + HSTS preload + nosniff + XFO |
| Redirects | NOT VERIFIED (guard-blocked) |
| 404 handling | NOT VERIFIED (guard-blocked) |
| Performance | PARTIAL — no lab/field CWV numbers; proxy signals healthy |
| Page weight | PASS |

### Top technical priorities
1. [Medium] Add lastmod to the two glossary sitemaps (393 URLs) — freshness signal for indexation.
2. [Medium] Obtain real CWV field data once custom domain + GSC are live; verify LCP/CLS/INP.
3. [Low] Verify redirect + 404 behavior with a manual curl once convenient (http→https 308, branded 404 page).
