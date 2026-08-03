# ACTION PLAN — yt-seo-architect.vercel.app

**Health Score: 58/100 · Audit: 2026-08-03 · Priorities: Critical > High > Medium > Low**

---

## Phase 1: Critical Fixes (Week 1)

1. **Purge the ~3,000 broken glossary URLs from the sitemap.** 23/80 sampled `/glossary/` URLs 404 (the 255-URL `channel-optimization-for-small-channels*` family is 100% dead). Regenerate sitemap.xml from live-verified URLs only; add a broken-link check to CI (`curl -o /dev/null -w '%{http_code}'` sweep or a script like `scripts/check-indexing.mjs`).
2. **Fix blog JSON-LD escaping.** 7/14 sampled posts have unparseable `ld+json` (unescaped HTML). Use a real serializer in the blog template (`JSON.stringify`/`json.dumps` + HTML-escape), re-render affected posts, and add a schema-parseability check to CI.
3. **Fix glossary-link injection into `alt` attributes.** The cross-linker writes `<a href="/glossary/...">` inside image alt text on some posts. Make the injector match visible text nodes only (never inside tags/attributes); re-render affected posts.
4. **Unblock CSP for AdSense + analytics.** Add `https://pagead2.googlesyndication.com` to `script-src`, `https://googleads.g.doubleclick.net https://tpc.googlesyndication.com` to `frame-src`, `https://cdn.jsdelivr.net` to `script-src`, and the ad/analytics domains to `connect-src` in vercel.json. (Also required for the AdSense verification work to pay off.)
5. **Exclude the 5 noindex core URLs** (`/dashboard`, `/about`, `/changelog`, `/privacy-policy`, `/terms-of-service`) from the sitemap generator.

## Phase 2: High-Impact Improvements (Weeks 2–3)

6. **Resolve 24 blog/tools cannibalization pairs.** Pick one home per keyword (recommend `/blog/` for articles; keep `/tools/` only for interactive tools). 301 or canonical the losers, fix the `/tools/` sitemap section.
7. **E-E-A-T pass.** Make `/about` indexable with a named founder, consistent author bylines on posts, a business email/address, legal entity in privacy/ToS, and remove unverifiable "Trusted by" claims.
8. **Security headers + security.txt.** Add `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` to vercel.json headers; publish `/.well-known/security.txt`.
9. **Trim titles to ≤60 chars** in the blog/tools generators (sampled blog titles run 62–96 chars).
10. **Add `<lastmod>` to glossary URLs** in the sitemap generator (11,047 URLs missing it).
11. **Clean llms.txt**: remove the `[null]`/generic-hero entry, refresh blog/tool counts from the live sitemap.

## Phase 3: Content & Authority (Month 2)

12. **Expand thin tool pages** (109–172 words → 500+ with how-to steps, examples, FAQ) and blog category hubs (74–82 words).
13. **Human review/fact-check gate** in the daily blog-publisher workflow (the current AI template posts are the top scaled-content-abuse risk).
14. **Vary glossary boilerplate** ("How to Optimize" blocks) per term; add internal links from glossary → blog (currently 0 blog links on sampled glossary pages).
15. **Build a real indexable `/pricing` page**; fix `/guide` (404) and `/blog/generic-hero` (live placeholder).
16. **Performance**: bundle `lucide` locally; convert blog heroes to WebP with width/height; replace the remaining `picsum.photos` hotlink.

## Phase 4: Monitoring & Iteration (Ongoing)

17. **Connect Google APIs** — `GOOGLE_API_KEY` (CrUX field data for LCP/INP/CLS), GSC for indexation monitoring; this closes the biggest data gap in this audit.
18. **Backlink program** — the domain is absent from Common Crawl (essentially no measurable link graph): tool directories, GitHub repos, HARO/PR, social profiles with consistent "YT SEO Architect" naming.
19. **CI guardrails** — sitemap re-validation on deploy, JSON-LD parseability check, broken-link sweep, and a monthly re-run of this audit.

---

## Score roadmap

| Action | Est. score lift |
|---|---|
| Fix broken sitemap + JSON-LD + cannibalization (Phases 1–2) | +8–10 → 66–68 |
| + E-E-A-T pass + thin-page expansion (Phase 3) | +6–8 → 72–76 |
| + Field data + backlinks + CI gates (Phase 4) | +4–6 → 78–82 |
