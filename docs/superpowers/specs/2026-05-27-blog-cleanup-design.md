# Blog Cleanup & Programmatic SEO Purge

**Date:** 2026-05-27
**Status:** Ready

---

## Problem

Bing crawled 6 low-quality blog posts that violate the `_TEMPLATE.html` guidelines: short (< 1,200 words), missing author box, missing breadcrumb, only 3 FAQ entries instead of 5, some with banned AI words. These were programmatically generated and indexed via the sitemap. Additionally, a programmatic SEO pipeline auto-publishes 2 posts per day, creating more low-quality content.

## Goal

1. Delete all trash blog posts and their assets
2. Shut down the programmatic SEO pipeline
3. Add automatic validation to prevent future trash posts from being indexed

---

## Trash Posts (8 identified)

All share a consistent pattern: no author box, no breadcrumb, only 3 FAQ `<details>`, word count < 1,200.

| # | File | Words | In Sitemap? | In blog.html? |
|---|---|---|---|---|
| 1 | `youtube-description-templates.html` | 743 | Yes | Yes |
| 2 | `how-to-write-youtube-titles.html` | 940 | Yes | Yes |
| 3 | `youtube-algorithm-changes-2026.html` | 951 | No | Yes |
| 4 | `youtube-keyword-research-tutorial.html` | 951 | Yes | Yes |
| 5 | `how-to-mass-update-youtube-descriptions-safely.html` | 962 | Yes | Yes |
| 6 | `youtube-shorts-seo-ranking-guide.html` | 1,009 | No | Yes |
| 7 | `youtube-tags-generator-vs-vidiq.html` | 1,025 | Yes | Yes |
| 8 | `youtube-seo-guide-2026.html` | 1,250 | Yes | Yes |

## Borderline Posts (3 kept)

| File | Issue | Decision |
|---|---|---|
| `youtube-metadata-auditor-vs-vidiq-shadow-ban.html` | 1,096 words, otherwise compliant | Keep |
| `how-to-fix-youtube-shadow-ban-2026.html` | 1,288 words, only 3 FAQs | Keep |
| `github-seo-backlinks-guide.html` | 1,216 words, fully compliant | Keep |

---

## Design

### Part 1: File Deletions

Delete 8 HTML posts from `public/blog/`:
- `public/blog/youtube-description-templates.html`
- `public/blog/how-to-write-youtube-titles.html`
- `public/blog/youtube-algorithm-changes-2026.html`
- `public/blog/youtube-keyword-research-tutorial.html`
- `public/blog/how-to-mass-update-youtube-descriptions-safely.html`
- `public/blog/youtube-shorts-seo-ranking-guide.html`
- `public/blog/youtube-tags-generator-vs-vidiq.html`
- `public/blog/youtube-seo-guide-2026.html`

Delete associated images (hero + og PNGs) if they exist — 16 files total.

Delete `public/blog/post.html` — the dynamic programmatic SEO template.

### Part 2: blog.html Edits

Remove the 8 card entries for trash posts. Keep only the 14 good posts (plus any correctly-templated future posts).

### Part 3: sitemap.xml Edits

Remove the 6 blog `<url>` entries for trash posts:
- `/blog/youtube-description-templates`
- `/blog/how-to-write-youtube-titles`
- `/blog/youtube-keyword-research-tutorial`
- `/blog/how-to-mass-update-youtube-descriptions-safely`
- `/blog/youtube-tags-generator-vs-vidiq`
- `/blog/youtube-seo-guide-2026`

### Part 4: Pipeline Shutdown

**Delete directory:** `api/programmatic-seo/` (contains `competitor-analysis.js`, `keyword-clusters.js`, `generator.js`, `indexing.js`, `long-tail-engine.js`).

**In `api/index.js`** — remove/disable:
- The daily cron that auto-publishes 2 blog posts (lines ~991-1020)
- The programmatic SEO route mounts (current lines 71-75)
- The `/p/:slug` redirect route (current line 841)
- The `sitemap-pseo.xml` route (current line 1333)
- The `triggerAutoExpansion` import (current line 882)
- The bulk generate import (current line 778)
- Any remaining references to `programmatic-seo/`

**In `vercel.json`** — remove `sitemap-pseo.xml` rewrite (line 24) and `/p` and `/p/(.+)` rewrites (lines 27-28).

### Part 5: Automatic Validation Gate

Add a `validateBlogPost(filePath)` function that runs these checks:

| Check | Rule |
|---|---|
| Word count | ≥ 1,200 words of visible body text (strip HTML tags) |
| Author box | Must contain `class="author-box"` or `class="author-info"` |
| Breadcrumb | Must contain `BreadcrumbList` schema or `<nav class="breadcrumb">` |
| FAQ entries | Must have exactly 5 `<details>` elements |
| TL;DR block | Must contain `class="tldr"` or "Direct Answer" |
| Banned words | Must NOT contain: excited, leverage, seamless, robust, embark, streamline, pivotal, cutting-edge |

**Integration points:**

1. **`api/index.js` — sitemap generation endpoint (`/sitemap.xml`):** Before adding a blog URL to the sitemap, run `validateBlogPost()`. Posts that fail are silently excluded. This prevents search engines from ever crawling bad posts.

2. **`blog.html` listing page (if server-rendered) or a build-time check:** Only blog cards for validated posts appear on the index. Since `blog.html` is currently a static file at `/blog.html` but the `/blog` route goes through the API, the validation can be applied server-side in `api/index.js` when building the blog listing response.

**How it works:** A bad post on disk is invisible. It can't appear in the sitemap, can't appear in the blog index, and gets no internal links. The only way to reach it is knowing the URL directly — which search engines won't, since it's not in the sitemap and nothing links to it.

### 14 Good Posts (kept)

`best-youtube-seo-tools-2026.html`, `github-seo-backlinks-guide.html`, `how-to-fix-youtube-shadow-ban-2026.html`, `what-does-youtube-ctr-actually-mean.html`, `youtube-ai-seo-coach-phronesis-2026.html`, `youtube-analytics-explained-2026.html`, `youtube-analytics-4-metrics-that-matter.html`, `youtube-competitor-analysis-reverse-engineer.html`, `youtube-description-templates-2026.html`, `youtube-end-screens-cards-guide-2026.html`, `youtube-metadata-auditor-vs-vidiq-shadow-ban.html`, `youtube-retention-graph-explained-2026.html`, `youtube-seo-audit-diagnostic-fix-2026.html`, `youtube-thumbnail-ab-testing-guide.html`, `youtube-video-not-getting-views-diagnostic-fix-2026.html`

---

## Error Handling

- Image deletions: if a file doesn't exist, skip — don't fail
- File deletions: use `fs.unlink` with error handling; log but continue if a file is already gone
- Text edits: use exact string matches; verify uniqueness before replacing
- Template file (`_TEMPLATE.html`) and `blog.css` are explicitly excluded from all deletions

## Testing

- After cleanup, verify no trash HTML files remain in `public/blog/`
- Verify `blog.html` lists only good posts
- Verify `sitemap.xml` has no trash blog URLs
- Verify `api/programmatic-seo/` directory is gone
- Verify `api/index.js` has no remaining references to programmatic SEO
- Verify `validateBlogPost()` correctly flags a known-bad post and passes a known-good post
