# Performance (CWV) Findings (score 65/100)

## Evidence (lab signals — no field data available)
- Homepage HTML: 71KB · 6 scripts (3 external: lucide@0.460.0 via unpkg, /assets/main-*.js, /js/blog-enhancements.js) · 5 stylesheets · **0 images**
- Caching: `public, max-age=0, must-revalidate` (HTML) + immutable hashed assets ✅
- Static prerender: Googlebot receives identical full HTML (no client-render wall) ✅
- Playwright render: 200, rendered mode, 1 console error (CSP-blocked analytics)
- CrUX/GSC credentials: **not configured** (google_auth tier -1) → no field LCP/INP/CLS

## Issues
- No field CWV data (biggest gap — cannot verify real-world LCP/INP/CLS)
- lucide loaded from unpkg (third-party render dependency)
- Vercel Analytics + AdSense CSP-blocked (dead script requests)

## Fixes
1. Configure GOOGLE_API_KEY for CrUX field data
2. Bundle lucide locally
3. Whitelist analytics/ads in CSP or remove them
4. Run Lighthouse on a real machine (Chrome not available in this environment)
