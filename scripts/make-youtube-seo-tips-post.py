#!/usr/bin/env python3
"""Assemble blog/youtube-seo-tips-for-creators-in-2026.html from the youtube-tags-2026 template.

- Copies the template, applies metadata string swaps, splices in the new article body,
  swaps the JSON-LD FAQ entries, and validates the resulting JSON-LD block.
- Idempotent: refuses to run if the target already contains the new h1.
"""
import json
import re
import sys

TEMPLATE = 'public/blog/youtube-tags-2026.html'
TARGET = 'public/blog/youtube-seo-tips-for-creators-in-2026.html'
BODY = 'scripts/post-body-youtube-seo-tips-2026.html'

SLUG_OLD = 'youtube-tags-2026'
SLUG_NEW = 'youtube-seo-tips-for-creators-in-2026'
TITLE = 'YouTube SEO Tips for Creators in 2026: What Actually Moves Rankings'
TITLE_SUFFIX = TITLE + ' — YT SEO Architect'
TITLE_OLD = 'YouTube Tags 2026: How to Research, Write, and Rank With the Right Tags'
TITLE_OLD_SUFFIX = TITLE_OLD + ' — YT SEO Architect'
TITLE_OLD_ENC = 'YouTube%20Tags%202026%3A%20How%20to%20Research%2C%20Write%2C%20and%20Rank%20With%20the%20Right%20Tags'
TITLE_NEW_ENC = 'YouTube%20SEO%20Tips%20for%20Creators%20in%202026%3A%20What%20Actually%20Moves%20Rankings'
DESC_OLD = 'YouTube tags still matter in 2026. Learn how to research and write tags that boost search rankings, plus which tag strategies are dead. Free tag generator included.'
DESC_NEW = '14 practical YouTube SEO tips for creators in 2026, grounded in YouTube\'s official search documentation — metadata, watch time, chapters, Shorts, AI-era features, and the full checklist.'

html = open(TEMPLATE, encoding='utf-8').read()
if TITLE_SUFFIX in html and SLUG_NEW in html:
    print('Target looks already built (new title present) — aborting.')
    sys.exit(1)

# 1) URL/asset slug
html = html.replace(SLUG_OLD, SLUG_NEW)

# 2) Titles (order matters: suffixed form first)
html = html.replace(TITLE_OLD_SUFFIX, TITLE_SUFFIX)
html = html.replace(TITLE_OLD, TITLE)
html = html.replace(TITLE_OLD_ENC, TITLE_NEW_ENC)

# 3) Description
html = html.replace(DESC_OLD, DESC_NEW)

# 4) Dates + meta line
html = html.replace('2026-07-22', '2026-08-10')
html = html.replace('Published July 22, 2026 · 12 min read',
                    'Published August 10, 2026 · 11 min read')

# 5) JSON-LD FAQ swaps
faq_map = [
    ('Should I copy tags from competitors?',
     'Do YouTube tags still matter in 2026?'),
    ('Use competitor tags as research, not copy-paste. Their audience and channel authority differ from yours. Extract relevant tags, then filter for ones that match your actual content.',
     'Very little. YouTube\'s official help says tags play a minimal role in video discovery — title, thumbnail, and description matter more. Use tags only for misspellings and exact variants.'),
    ('Are YouTube tags different from hashtags?',
     'Are Shorts ranked separately from long-form videos?'),
    ('Yes. Tags are hidden metadata you add in YouTube Studio. Hashtags are visible in your title or description and appear above your title. They serve different purposes — tags help search, hashtags help discovery.',
     'Yes. Shorts have their own discovery surface and feed with separate recommendation logic. Treat Shorts as an acquisition channel that points viewers at your long-form content.'),
]
for old, new in faq_map:
    if old not in html:
        print('MISSING FAQ anchor:', old[:60])
    html = html.replace(old, new)

# 6) Splice body: replace [<div class="tldr">, second cta-box) with new body
i_tldr = html.find('<div class="tldr">')
i_cta1 = html.find('<div class="cta-box">', i_tldr)
i_cta2 = html.find('<div class="cta-box">', i_cta1 + 1)
if i_tldr < 0 or i_cta2 < 0:
    print('Splice anchors not found:', i_tldr, i_cta1, i_cta2)
    sys.exit(1)
body = open(BODY, encoding='utf-8').read().strip()
html = html[:i_tldr] + '\n' + body + '\n\n' + html[i_cta2:]

# 7) Validate JSON-LD
def _validate_ld():
    for m in re.finditer(r'<script type="application/ld\+json">([\s\S]*?)</script>', html):
        data = json.loads(m.group(1))
        if isinstance(data, list):
            types = [d.get('@type') for d in data]
            assert 'Article' in types and 'FAQPage' in types, types
    print('JSON-LD: OK')

_validate_ld()

open(TARGET, 'w', encoding='utf-8').write(html)
print(f'Wrote {TARGET}')
print(f'  slug refs: {html.count(SLUG_NEW)} | old-slug refs: {html.count(SLUG_OLD)}')
print(f'  h1 present: {TITLE_SUFFIX in html} | desc present: {DESC_NEW in html}')