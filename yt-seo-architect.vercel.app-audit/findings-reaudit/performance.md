# Performance Re-Audit — yt-seo-architect.vercel.app (2026-08-05)

Score: **62/100** (prior audit 2026-08-03: 65/100 — slight drop due to new CSS duplication + blocked tokens)

Method: curl timing/size/header analysis, local dist/ inspection, preload_check.py.
No field CWV (CrUX not configured); PageSpeed API rate-limited (no key); lcp_subparts.py needs API key.
Homepage has 0 images → LCP is text (no image-preload requirement).

---

## ✅ Previously-fixed items — VERIFIED HOLDING

| # | Prior fix | Re-audit evidence | Status |
|---|-----------|-------------------|--------|
| 1 | lucide bundled locally | `/js/lucide.min.js` → 200, `application/javascript` (local, no unpkg). Note: 355,975 bytes, `defer`, but served `max-age=0` (see issue 4) | ✅ FIXED |
| 2 | Vercel Analytics CSP-blocked → whitelisted | `cdn.jsdelivr.net` in CSP; homepage Vite entry `main-DJ7GC5Xn.js` = analytics injector (imports `@vercel/analytics@1/dist/index.mjs`) — now loads, no dead request | ✅ FIXED |
| 3 | /assets/* immutable caching | Verified `cache-control: public, max-age=31536000, immutable` on all 8 homepage CSS files + dashboard JS | ✅ FIXED |
| 4 | Async CSS pattern (media=print onload) | Present on utilities/nav/style/blog-article links — **but defeated** by duplicate sync Vite links (issue 1) | ⚠️ PARTIAL |
| 5 | Static prerender for Googlebot | Full HTML served (76,416 B homepage); no client-render wall | ✅ HOLDS |
| 6 | HTML caching | `public, max-age=0, must-revalidate` + ETag/Last-Modified; CDN HITs observed (`age: 525`, `x-vercel-cache: HIT`) | ✅ HOLDS |

## 🔴 Remaining / NEW issues

### 1. HIGH — Mixed-build duplicate CSS ≈ 428KB (async optimization defeated)
- Homepage (and dashboard) `<head>` contains **8 stylesheets**: 4 hand-added async links pointing at a PREVIOUS build's hashes — `style-D_leLt0r.css` (217,966 B), `blog-article-DV78dmm3.css` (16,117 B), `nav-BtxCkqx5.css` (5,136 B), `utilities-BTjsAy0A.css` (4,454 B) — **all still present in dist/assets** (so they download) — PLUS 4 Vite-injected **synchronous** links from the CURRENT build: `style-Cpb0hmzC.css` (161,053 B), `main-KQBAxb19.css` (12,856 B), `nav-cT1dljrZ.css` (5,599 B), `utilities-BvA2D3tt.css` (4,748 B).
- The sync Vite links are render-blocking (no `media` attr) → the async intent is void; ~244KB of stale duplicate CSS is fetched and parsed; two builds' rules coexist (conflict risk). Total CSS ≈ 428KB before gzip.
- Fix: delete the hand-added async links (keep Vite's injected set), or suppress Vite injection and keep the async set — one set only.

### 2. HIGH — Design tokens never apply (CSP-blocked data: stylesheet)
- Homepage links design tokens as `data:text/css;base64,...` but CSP `style-src` has no `data:` → stylesheet rejected, `:root` tokens undefined (the inline `<style>` block references `var(--bg-page)`, `var(--text-primary)`, `var(--font)`…). Broken theming + risk of FOUC/incorrect first paint. Correct fix already available: `/design-tokens.css` (200, text/css, 2,551 B). (Cross-ref technical.md #1.)

### 3. MEDIUM — Google Fonts render-blocking on homepage & blog
- Homepage: two synchronous `<link rel="stylesheet">` for `fonts.googleapis.com/css2?family=Geist:wght@100..900` + `Geist+Mono:wght@100..900` (variable, full range) — no `media=print/onload`, no preload. Preconnects present ✅ but the CSS blocks first render. Dashboard uses `media="print" onload` for its fonts — homepage/blog inconsistent with dashboard. Blog pages: same 2 sync font links + sync `/blog/blog.css`.

### 4. MEDIUM — /js/* static files lack long-term caching (lucide 356KB!)
- `/js/lucide.min.js` (355,975 B), `/js/blog-enhancements.js`, `/og-image.png` (197,635 B), `/favicon.ico` all served `cache-control: public, max-age=0, must-revalidate` (Express static) — revalidated every page view. Only `/assets/*` gets immutable. Recommend moving versioned JS (lucide) under `/assets/` or adding a `/js/*` immutable rule with hashed filenames.

### 5. MEDIUM — Dashboard JS bundle 536KB raw / 146KB gzip (task focus item)
- `/assets/dashboard-vLhkHsXF.js` = **536,332 B raw, 146,268 B gzip** (immutable ✅, single chunk) + `vendor-hEGQrGQl.js` 2,650 B + `modulepreload-polyfill` 711 B + lucide 356 KB + AdSense `adsbygoogle.js` (external) + dashboard HTML 215,572 B. No code-splitting visible. Page is noindex so no crawl impact, but real INP/main-thread cost for logged-in users. Consider splitting vendor/route chunks and lazy-loading lucide per-icon.

### 6. LOW — Duplicated Google Fonts link on dashboard
- Two identical `<link ...fonts.googleapis.com/css2?family=Geist...&family=Outfit...` (both `media=print onload`) → duplicate request.

### 7. LOW — No speculation rules / resource hints (preload_check 50/100)
- 0 speculation-rules blocks, 0 preload hints, no `fetchpriority=high` (moot for text LCP, but `fetchpriority="high"` on the async CSS set or fonts would help). Recommend `<script type="speculationrules">` prefetch/prerender for top paths (`/tools`, `/blog`, `/glossary`, `/pricing`) — big navigation-latency win on a tool site.

### 8. LOW — Blog template not optimized
- Blog pages: sync `/blog/blog.css` + 2 sync Google Fonts links + AdSense; no async pattern. If blog is a traffic driver, apply the same treatment as homepage.

### 9. INFO — Unchanged: no field CWV data
- CrUX/GSC credentials not configured → no real LCP/INP/CLS verification possible (same as prior audit). This remains the single biggest measurement gap.

## Resource budget (homepage, fresh view)
- HTML 76.4 KB · CSS ≈ 428 KB across 8 files (+ blocked data: tokens) · JS: lucide 356 KB (defer, max-age=0) + analytics 1.5 KB + inline animation scripts · 2 sync Google-Fonts stylesheets · 0 images.
- Gzip via Vercel on all text assets; `Accept-Encoding: gzip` confirmed (dashboard JS transfers at 146 KB gzip).

## Top recommended fixes (priority order)
1. Remove the stale async CSS set (keep one build's stylesheets) — kills ~244KB of duplicate CSS and restores a real async story.
2. Replace the data: tokens link with `/design-tokens.css` (fixes theming + first paint).
3. Move lucide + /js/* under hashed/immutable URLs (or add /js/* long-cache rule).
4. Async-load the two Google-Fonts stylesheets on homepage/blog (mirror dashboard).
5. Add speculation rules for top paths; split dashboard bundle.
