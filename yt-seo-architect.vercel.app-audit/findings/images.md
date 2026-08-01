# Images Audit — yt-seo-architect.vercel.app

Audit date: 2026-07-31 · Method: live HTML analysis of homepage, glossary term, blog post, tool page, glossary hub (5 pages)

## What Works
- **Minimal image footprint**: homepage, glossary pages, tool pages ship **0 images** (favicon only) — no image weight, no missing-alt issues, nothing to optimize on the critical templates.
- No lazy-loading gaps of consequence given the near-zero image count.
- Blog hero images carry `width`/`height` attributes (CLS-safe).

## Findings

**MEDIUM — Blog hero images hotlink the random placeholder service picsum.photos**
Evidence: `https://picsum.photos/seed/best-youtube-seo-tools-2026/800/400` on blog posts (e.g. /blog/best-youtube-seo-tools-2026). picsum.photos is a demo/random-image CDN — images are **unstable** (a "seed" is not guaranteed stable long-term), uncacheable deterministically, off-brand, and an unoptimized third-party dependency.
Recommendation: self-host deterministic branded OG/hero images (e.g. `/assets/blog/<slug>.webp`, 1200×630, WebP) generated at publish time; add `fetchpriority="high"` on the LCP image and keep width/height.

**LOW — No OG image on non-blog templates**
Evidence: homepage, glossary, and tool pages contain no `<meta property="og:image">`; schema audit confirms `logo.svg` referenced by Organization schema returns **404** (see schema.md).
Recommendation: publish a single branded 1200×630 og-image (reuse the working `og-image.png` from blog template) sitewide + fix the Organization `logo` URL.

**INFO — No width/height or lazy-loading attributes on the glossary/blog card images** — negligible impact at current image counts; apply if image usage grows.

## Summary
Images are a non-issue at scale (site is essentially text + JS). The only real work: replace picsum.photos with self-hosted branded images and fix the 404 logo.svg. Category score contribution: 80/100.
