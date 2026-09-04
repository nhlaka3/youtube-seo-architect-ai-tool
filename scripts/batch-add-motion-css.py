#!/usr/bin/env python3
"""Batch-insert the motion-utilities.css <link> into all deployed static HTML.

- Binary mode byte-replace (preserves CRLF vs LF line endings — no whole-file diffs).
- Idempotent: skips files that already reference motion-utilities.css.
- Targets: root *.html + public/tools/**, public/blog/* (no _archive),
  public/guides/**, public/vs/**, public/niches/**, public/widgets/**, public/*.html.
- Excludes public/glossary/** (API-rendered, thousands of generated pages).
- Reports files that have no </head> so they can be checked manually.
"""
import glob
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LINK = b'<link rel="stylesheet" href="/motion-utilities.css">\n'
MARKER = b'motion-utilities.css'

patterns = [
    os.path.join(ROOT, '*.html'),
    os.path.join(ROOT, 'public', '*.html'),
    os.path.join(ROOT, 'public', 'tools', '**', '*.html'),
    os.path.join(ROOT, 'public', 'blog', '*.html'),
    os.path.join(ROOT, 'public', 'guides', '**', '*.html'),
    os.path.join(ROOT, 'public', 'vs', '**', '*.html'),
    os.path.join(ROOT, 'public', 'niches', '**', '*.html'),
    os.path.join(ROOT, 'public', 'widgets', '**', '*.html'),
]

EXCLUDE_SUBSTR = ['public/glossary', 'public/blog/_archive', 'node_modules']

files = []
for p in patterns:
    for fp in sorted(glob.glob(p, recursive=True)):
        if any(x in fp for x in EXCLUDE_SUBSTR):
            continue
        if fp not in files:
            files.append(fp)

updated, skipped, no_head = 0, 0, []
for fp in files:
    data = open(fp, 'rb').read()
    if MARKER in data:
        skipped += 1
        continue
    if b'</head>' not in data:
        no_head.append(fp)
        continue
    data = data.replace(b'</head>', LINK + b'</head>', 1)
    open(fp, 'wb').write(data)
    updated += 1

print(f'Total files: {len(files)}')
print(f'Updated: {updated}')
print(f'Skipped (already has link): {skipped}')
print(f'No </head> found: {len(no_head)}')
for fp in no_head[:20]:
    print('  MISSING HEAD:', fp)