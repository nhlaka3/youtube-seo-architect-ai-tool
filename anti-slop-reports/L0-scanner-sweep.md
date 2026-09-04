# Slop review: YT SEO Architect blog (49 posts)

Review date: 2026-08-04
Surface: 49 blog posts (18 from local public/blog/*.html, 31 DB-served fetched live)
Method: anti-slop toolkit, Layer 0 deterministic scanners on extracted article text.

## Layer 0, deterministic scanners

Ran on all 49 posts (extracted via scripts/extract_blog_text.py, article body,
scripts/nav/footer/author-box/breadcrumb/social stripped).

| Scanner | Exit | Finding |
|---|---|---|
| scan_residue.py | 0 | clean (no oaicite, [cite:N], grok-card, utm_source=chatgpt.com residue) |
| scan_placeholders.py | 1 | 3 hits, all FALSE POSITIVES (instructional formula brackets, not unresolved template) |
| scan_refs.py | 0 | offline, 0 DOIs/arXiv/ISBNs/URLs extracted; resolution unchecked |
| lint_voice.py | 1 | 832 house-style hits: 791 em-dash (U+2014), 41 en-dash (U+2013) |

### scan_placeholders detail (false positives)
All 3 hits are deliberate instructional brackets in hook/formula guidance, not
stale `[Your Name]` / `INSERT_SOURCE_URL` leftovers. Deletion test rule: marker
selects a span; the span is meaningful (an authored formula template), so no
finding. Posts affected: youtube-for-tutorials-2026, youtube-intro-hook-first-3-seconds.

### lint_voice detail (house-style, NOT a slop verdict)
The anti-slop house style forbids U+2014/U+2013 and ` -- `. Em/en dashes appear
across every post. Counts per post (sorted):
maximizing-youtube-revenue (85), best-youtube-seo-tools (38),
youtube-seo-audit-diagnostic-fix (37), youtube-seo-checklist-beginners (35),
youtube-competitor-analysis (32), youtube-analytics-explained (30),
youtube-ai-seo-coach (27), youtube-video-not-getting-views (26),
youtube-playlist-optimization (25), youtube-for-small-channels (24),
youtube-monetization-tips (24), youtube-retention-graph (23), youtube-tags (23),
youtube-title-examples (23), and 34 more posts each with 5-21.
This is a style-consistency item, not evidence of slop in isolation.

## Structural defects found during extraction (NOT scanner-detected)

- youtube-seo-examples-2026: article body duplicated ~510x to 4.7M chars
  (same ~7 headings/TL;DR repeating). Serves a massive duplicate page. Unique
  content is ~1351 words. HIGH severity content defect.
- youtube-seo-for-cooking-channels-2026: local file is a 91-byte stub
  (`<html>\n<head><title>...</title><meta name=`). Live page returns the same
  91 bytes (HTTP 200). Page is effectively empty/broken. HIGH severity.

## Not flagged, and why

- Em/en dashes: present in bulk but are a style rule, no structural defect
  behind them. Listed as a consistency item, not slop.
- Placeholder brackets in hook formulas: intentionally instructional.