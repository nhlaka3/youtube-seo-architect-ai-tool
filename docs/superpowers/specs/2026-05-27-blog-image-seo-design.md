# Blog Image SEO Optimization

**Date:** 2026-05-27
**Status:** Ready

---

## Problem

All 15 blog posts have image SEO issues: missing dimensions (CLS), missing/broken OG images, no responsive images, PNG-only format (no WebP), and most lack a second in-content image. This hurts Core Web Vitals, Google Image Search rankings, and social sharing.

## Goal

1. Auto-optimize all 15 posts: PNG→WebP, responsive srcset, fix dimensions, fix OG tags
2. Add a second in-content image to 2 highest-impact posts

---

## Current State

### Issues across 15 posts

| Issue | Affected Posts |
|---|---|
| Missing `width`/`height` attributes | 6 posts (CLS penalty) |
| Missing `og:image` meta tag | 2 posts (broken social cards) |
| Wrong OG image URL | 1 post (`youtube-seo-audit-diagnostic-fix-2026`) |
| No `srcset` / responsive images | 15 posts |
| No WebP format | 15 posts |
| Only 1 image (hero only) | 10 posts |

### Good — already in place
- All 15 have `loading="eager"` + `fetchpriority="high"` on hero
- All 15 have `ImageObject` schema
- All 15 have keyword-rich alt text

### Current file sizes
- Hero images: 20–27 KB PNG (800×400)
- OG images: 24–32 KB PNG (1200×630)

---

## Design

### Part 1: Automated Optimization Script

**Script:** `scripts/optimize-blog-images.js`

**Process per post:**
1. Find the hero `<img>` and OG `<meta>` tags
2. Read actual PNG dimensions with Sharp
3. Generate WebP variants:
   - Hero: 400w, 800w, 1200w WebP
   - OG: 1200×630 WebP
4. Replace `<img>` with `<picture>` element (WebP + PNG fallback)
5. Inject `width`/`height` if missing
6. Fix missing or broken `og:image` and Twitter image meta tags
7. Report changes

**Output per post:**
```html
<picture>
  <source srcset="/blog/post-hero-400w.webp 400w,
                  /blog/post-hero-800w.webp 800w,
                  /blog/post-hero-1200w.webp 1200w"
          sizes="(max-width: 768px) 100vw, 800px"
          type="image/webp">
  <img src="/blog/post-hero.png" alt="..." width="800" height="400"
       loading="eager" fetchpriority="high">
</picture>
```

**Size impact:** Hero images drop from ~25 KB PNG to ~5 KB WebP. Total page weight for hero images drops ~80%.

**Dependencies:** `sharp` (already in package.json).

**Safety:**
- Original PNGs preserved (not deleted)
- WebP variants generated alongside
- Posts with existing `<picture>` tags are skipped
- `_TEMPLATE.html` and `hero-generic.png` excluded
- Missing files logged, then skipped

### Part 2: Second In-Content Images (Manual)

Two posts get a second image:

1. **`youtube-competitor-analysis-reverse-engineer`** — workflow diagram showing the competitor tag extraction process (step 1: enter competitor URL → step 2: extract tags → step 3: generate infiltration bundle). Inserted in the implementation/steps section with `loading="lazy"`.

2. **`youtube-ai-seo-coach-phronesis-2026`** — annotated screenshot of the Phronesis dashboard showing goal tracking, ETA projections, and optimization proposals. Inserted in the setup section with `loading="lazy"`.

Images generated with the existing hero generator: `python3 scripts/generate-blog-hero.py <slug>-diagram "Title" "" "" "DIAGRAM"`. Both use `loading="lazy"` and include descriptive alt text.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Hero image file not found | Log warning, skip post, continue |
| Can't read image dimensions | Fallback to `width="800" height="400"` |
| Post already has `<picture>` | Skip (already optimized) |
| `_TEMPLATE.html` | Always skipped |
| `hero-generic.png` | Skipped (emergency fallback) |
| Sharp fails to convert | Keep original PNG, skip WebP for that file |

## Testing

- Run `node scripts/optimize-blog-images.js` — verify no errors
- Spot-check 3 posts: confirm `<picture>` present, srcset correct, dimensions correct, OG image fixed
- Run `node --check scripts/optimize-blog-images.js`
- Visually verify one blog post renders correctly with WebP
