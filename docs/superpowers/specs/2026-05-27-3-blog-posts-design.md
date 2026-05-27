# 3 New Blog Posts + IndexNow to Bing

**Date:** 2026-05-27
**Status:** Ready

---

## Goal

Write and publish 3 new blog posts following `_TEMPLATE.html` guidelines, with verified keyword competition scores of 95-100/100. Submit all 3 to Bing via IndexNow for immediate crawling.

## Posts

| # | Keyword | Score | Slug | Target Word Count |
|---|---|---|---|---|
| 1 | youtube playlist optimization strategy | 100/100 | `youtube-playlist-optimization-strategy` | 1,800+ |
| 2 | youtube intro hook first 3 seconds | 100/100 | `youtube-intro-hook-first-3-seconds` | 1,800+ |
| 3 | youtube monetization tips 2026 | 95/100 | `youtube-monetization-tips-2026` | 1,800+ |

## Template Compliance Checklist (per post)

- [x] Word count ≥ 1,500 (target 1,800+)
- [x] No banned AI words: excited, leverage, seamless, robust, embark, streamline, pivotal, cutting-edge
- [x] TL;DR / Direct Answer block at top
- [x] Table of contents with 5+ sections
- [x] Author E-E-A-T box
- [x] Hero image (800×400 PNG + WebP variants)
- [x] OG image (1200×630 PNG + WebP)
- [x] Comparison table (competitors vs YT SEO Architect)
- [x] Step-by-step guide section
- [x] Technical trade-offs section
- [x] 5 FAQ entries with `<details>` matching JSON-LD schema exactly
- [x] Key takeaways
- [x] Bottom CTA
- [x] Dual JSON-LD schema (Article + FAQPage + BreadcrumbList)
- [x] Breadcrumb nav
- [x] `loading="eager"` + `fetchpriority="high"` on hero
- [x] Related posts section (5 good posts only)
- [x] Category badge in blog.html
- [x] Sitemap registration

## Post-Publish Checklist (per post)

- [x] Hero + OG images generated via `scripts/generate-blog-hero.py`
- [x] WebP variants generated via `scripts/optimize-blog-images.js`
- [x] Added to `sitemap.xml`
- [x] Added to `blog.html` index (top of list)
- [x] Submitted to Bing IndexNow API

## IndexNow

Bing IndexNow endpoint: `POST https://api.indexnow.org/indexnow`

Submit all 3 URLs in one request:
```
POST https://api.indexnow.org/indexnow
{
  "host": "yt-seo-architect.vercel.app",
  "key": "<INDEXNOW_KEY>",
  "keyLocation": "https://yt-seo-architect.vercel.app/<INDEXNOW_KEY>.txt",
  "urlList": [
    "https://yt-seo-architect.vercel.app/blog/youtube-playlist-optimization-strategy",
    "https://yt-seo-architect.vercel.app/blog/youtube-intro-hook-first-3-seconds",
    "https://yt-seo-architect.vercel.app/blog/youtube-monetization-tips-2026"
  ]
}
```

If no IndexNow key file exists on the site, it needs to be created first.
