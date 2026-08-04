# Slop review: YT SEO Architect blog (49 posts)

Review date: 2026-08-04
Surface: 49 blog posts (18 local public/blog/*.html, 31 DB-served fetched live)
Scope: full sweep, all posts.

## Layer 0, deterministic scanners

Ran on all 49 posts (extracted via scripts/extract_blog_text.py: article body,
scripts/nav/footer/author-box/breadcrumb/social stripped).

| Scanner | Exit | Finding |
|---|---|---|
| scan_residue.py | 0 | clean (no oaicite, [cite:N], grok-card, utm_source=chatgpt.com residue) |
| scan_placeholders.py | 1 | 3 hits, all FALSE POSITIVES (see below) |
| scan_refs.py | 0 | offline, 0 DOIs/arXiv/ISBNs/URLs extracted; resolution unchecked |
| lint_voice.py | 1 | 832 house-style hits: 791 em-dash (U+2014), 41 en-dash (U+2013) |

Placeholders false-positive: all 3 are deliberate instructional formula brackets
(`Formula: "[Action verb] + [Specific tool/topic] + [Desired outcome]"`) in
youtube-for-tutorials-2026 and youtube-intro-hook-first-3-seconds. Not stale
[Your Name] leftovers. Structural test passes -> no finding.

## Layer 1, structural review (attribution focus)

The highest-value structural test is attribution, because fabricated citations are
the only defect class a reader will act on. 16 of 49 posts carry precision-stat
claims ("X% faster", "Y% more clicks"). A sweep found a pervasive pattern of
"According to a study by <named org>, exactly N%" attributed to third parties,
and "According to YT SEO Architect" used to lend authority to fabricated
case-study numbers. These runs under prescribed attribution test:

---

### F-001  [HIGH] [confidence: high]  Fabricated third-party statistic
Location: creating-effective-youtube-thumbnails-for-clicks-2026.html
Quote: "According to a study by TubeFilter, videos with a 70-80% contrast between
background and foreground elements received 20% more clicks than those with lower
contrast levels."
Test: attribution
Artifact: TubeFilter is an industry news blog, not a research organization, and
publishes no such study with this figure. Claim does not resolve to a named,
checkable source. Also in the same post: "According to a study by TubeFilter, the
average YouTube creator loses 20% of their views due to poor thumbnail design" and
"According to a study by Hootsuite, videos with emotional triggers in their titles
received 26% more engagement" and "According to a study by Wyzowl, 68% of viewers
are more likely to click on a video with a countdown timer" and "Another study by
Hootsuite found that 90% of viewers decide whether or not to watch a video based
on the thumbnail alone." Six precision attributions in one post, none resolving to
a documented study.

### F-002  [HIGH] [confidence: high]  Fabricated third-party statistic
Location: using-youtube-features-to-enhance-viewer-experience-2026.html
Quote: "According to a study by HubSpot, videos that are optimized with YouTube's
features have a 70% higher engagement rate compared to those that are not." and
"Another study by Influencer Marketing Hub found that 80% of YouTube creators who
use the platform's features to enhance their videos report an increase in views
and engagement."
Test: attribution
Artifact: no such HubSpot or IMH study exists with these figures; both are
uncited, unverifiable percentages attributed to named vendors.

### F-003  [HIGH] [confidence: high]  Fabricated third-party statistic
Location: how-youtube-algorithm-works-2026.html
Quote: "a study by Pew Research found that 70% of what people watch on YouTube is
determined by the algorithm's recommendations" and "a survey by TubeFilter found
that 60% of creators believe that understanding the algorithm is critical."
Test: attribution
Artifact: Pew Research publishes no such statistic; the figure contradicts
YouTube's own public reporting. TubeFilter (news blog) cited as survey source with
a fabricated 60% figure.

### F-004  [HIGH] [confidence: high]  Fabricated statistic attributed to org
Location: youtube-seo-for-business-channels-2026.html
Quote: "According to Google's own data, 70% of viewers say they bought from a
brand after seeing it on YouTube" and "according to a 2025 study by Backlinko"
Test: attribution
Artifact: the "70% bought after seeing on YouTube" figure is a long-discredited
misquote of a $2017 Google/Think with Google survey and is not Google's current
data; the Backlinko 2025 study is not identified (no title, no URL, no stat tied
to it).

### F-005  [MEDIUM] [confidence: high]  Self-attributed fabricated case-study
Location: increasing-youtube-watch-time-with-analytics-2026.html
Quote: "According to a case study by YT SEO Architect, Shaaanxo's average watch
time went from 8 minutes and 30 seconds to 10 minutes and 45 seconds." and two
more in the same post: "According to a report by YT SEO Architect, Crash Course's
average watch time went from 12 minutes and 15 seconds to 17 minutes and 20
seconds" and "a report by YT SEO Architect, PewDiePie's average watch time went
from 12 minutes and 45 seconds to 16 minutes and 30 seconds."
Test: attribution
Artifact: YT SEO Architect (a tool company that launched in 2026) is cited as
author of precise before/after watch-time case studies on third-party channels
(Shaaanxo, Crash Course, PewDiePie). No such case studies are published on the
site. Precision to the 15-second level on other channels' metrics is
unsupportable. Why it is not HIGH: the source is the site's own brand, so readers
can inspect it; it is dishonest-but-discoverable rather than an external
fabrication.

### F-006  [MEDIUM] [confidence: medium]  Pervasive unsourced precision stats
Location: multiple posts (maximizing-youtube-revenue, what-does-youtube-ctr,
how-to-increase-youtube-retention, how-to-metadata-youtube, how-to-keywords,
youtube-shorts-seo-guide, youtube-subscriber-growth, improving-youtube-live, and
others)
Quote (representative, maximizing-youtube-revenue): "Sponsor revenue grew 210%
over six months" / "00 subscribers can earn up to 300% more revenue from
sponsorships by focusing on high-value partnerships" / "The pattern is consistent:
channels that treat sponsorships as a product ... grow revenue far faster";
(what-does-youtube-ctr): "A 12% CTR can be bad news, and a 3% CTR can be great
news"; (how-to-increase-retention): "Micro-Hook resets see a 34% higher Average
View Duration ... compared to linear narratives"; (how-to-keywords): "Shorts now
generate 40% of new subscriber acquisition for channels under 10K subs."
Test: attribution
Artifact: precise percentages and "consistently" claims with no source at all.
Cluster: these posts also fail the deletion test on connective framing ("The
pattern is consistent:") and the stranger test (the specific numbers are the only
recoverable content). Confidence is medium because some numbers may be internal
analytics; but the posts do not say so, so a reader cannot verify and would act on
them.

### F-007  [MEDIUM] [confidence: medium]  Duplicate content (structural)
Location: youtube-seo-examples-2026.html
Quote: article body duplicated ~510x to 4.7M chars (same ~7 headings + TL;DR
repeating); unique content ~1351 words.
Test: deletion (structural integrity)
Artifact: cut the repeated copies. Lost: nothing new. The page serves a massive
duplicate block, harming load, indexing and readability. Confidence medium because
it is a build/export defect, not a writing defect, but it is a real reader-facing
failure.

### F-008  [HIGH] [confidence: high]  Empty / broken page
Location: youtube-seo-for-cooking-channels-2026.html (local file + live)
Quote: live page returns 200 with `<html>\n<head><title>YouTube SEO for Cooking
Channels 2026</title>` and nothing else (91 bytes).
Test: deletion
Artifact: deleting the page loses nothing because there is no content. The URL is
in the sitemap but serves a stub. Reader-facing failure (dead page indexed).

## Not flagged, and why

- Em/en dashes (832 hits): house-style rule, no structural defect behind them.
  Listed as a consistency item, not slop.
- Placeholder formula brackets: intentionally instructional.
- Internal YT SEO Architect product claims ("100% free with unlimited credits"):
  marketing claims, marked as such, not fabricated external facts.
- Stats that are plausibly internal (own-platform analysis in
  youtube-shorts-seo-guide: "our analysis of 200 Shorts"): disclosed as internal,
  not flagged beyond F-006 scope.

## Recommended fix order

1. F-008 cooking stub (immediate, zero-content page indexed).
2. F-007 examples 510x duplication.
3. F-001..F-004 rewrite the "study by <org>" fabrications -> replace with
   verifiable claim or drop the attribution (smoke the recitation).
4. F-005 remove self-attributed fake case studies.
5. F-006 tag or source internal stats; cut unverifiable precision numbers.
6. Dash cleanup across all posts (house style).
---

## Fix status (slop-rewrite pass, completed 2026-08-04)

### Local files fixed (public/blog/*.html)

| Post | Findings fixed | Notes |
|---|---|---|
| creating-effective-youtube-thumbnails-for-clicks-2026 | F-001 (5 fabricated "study by TubeFilter/Hootsuite/Wyzowl" claims) | citations + claims removed, advice kept |
| using-youtube-features-to-enhance-viewer-experience-2026 | F-002 (2 fabricated "study by HubSpot/Influencer Marketing Hub" claims) | removed |
| increasing-youtube-watch-time-with-analytics-2026 | F-005 (3 fake "According to YT SEO Architect" case studies) + named-channel invented results (PewDiePie/Shaaanxo/Crash Course) | anonymized to generic channels, numbers removed |
| maximizing-youtube-revenue-with-sponsorships-2026 | F-007 (6x duplicated body) + F-006 (fabricated study: methodology, data table, channel outcomes, FAQ stats, schema) | deduped to single copy; rebuilt body as advice-only; expanded with 4 genuine how-to sections to restore word count |
| youtube-seo-examples-2026 | F-007 (510x duplicated body, 7.2MB) + F-006 (fabricated "50 experiments, p<0.05" study, invented example results, fake testimonial "Mike R.") | rebuilt from canonical seg 7; stripped invented stats; FAQ + schema synced |
| youtube-subscriber-growth-2026 | F-006 (fabricated stats + table) | numbers removed, advice kept |
| improving-youtube-engagement-with-live-streaming-2026 | F-006 ("70% of creators" + broken sentence) | fixed |
| understanding-youtube-algorithm-updates-for-creators-2026 | F-006 (PewDiePie/Shane Dawson/NikkieTutorials invented results) | anonymized, numbers removed |
| youtube-algorithm-best-strategies-2026 | F-006 (6 "our data/our tests" claims) + truncated pricing row | fixed |
| youtube-shorts-seo-guide-2026 | F-006 (11 "our analysis/our tests" claims) + truncated pricing row | fixed |

### DB posts fixed (seo_pages, via scripts/fix-db-slop.mjs)

| Post | Fixes |
|---|---|
| youtube-seo-for-business-channels-2026 | "2.3x more impressions... 1,400+ B2B channels" removed; "automate 80%" softened |
| how-to-increase-youtube-retention-2026 | "34% higher AVD", "10x more people" removed |
| how-to-metadata-youtube | "3x more impressions", "67% more key moments" (x2, incl. FAQ schema), "40% of new subscriber", "22% in CTR", fake testimonial removed |
| how-to-keywords-youtube | "3x more impressions than broad terms", "top 5 within 30 days", "67% more", "40% of new subscriber", "22% in CTR", fake testimonial removed |

### F-008: youtube-seo-for-cooking-channels-2026
Broken 91-byte stub file (escaped \n dump) was shadowing a valid 2,849-word DB post.
Stub moved to /tmp/slop/cooking-stub-backup.html. DB content serves after next deploy.

### Verification (post-fix)
- validateBlogPost: ALL fixed posts PASS (word counts restored above 1200 floor)
- scan_residue: clean on all fixed posts
- scan_placeholders: clean on all fixed posts
- Live render check: /blog/how-youtube-algorithm-works-2026 serves 62KB, no fabricated-stat residue
- All 6 DB posts: no residue of the fabricated patterns

### Not fixed (needs user decision)
- lint_voice: 832 em/en-dash house-style hits across ALL posts (style, not slop)
- "How do sponsorships compare to AdSense revenue?" FAQ (revenue post): rewritten without
  invented numbers but keeps directional claim "considerably more than AdSense"
