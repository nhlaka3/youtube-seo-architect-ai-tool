#!/usr/bin/env python3
"""Dump all matches for key phrases in a YouTube Help HTML file (raw-decoded)."""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/yt1.html'
b = open(path, 'rb').read()
try:
    raw = b.decode('utf-8', errors='ignore')
except Exception:
    raw = b.decode('latin-1')

keys = ['search and discovery', 'watch time', 'audience retention',
        'click-through', 'titles', 'descriptions', 'how youtube search works',
        'engagement', 'quality', 'keywords', 'narrative', 'freshness']
for kw in keys:
    hits = [m.start() for m in re.finditer(re.escape(kw), raw, re.I)]
    print(f'== {kw}: {len(hits)} hits')
    for i in hits[:3]:
        seg = re.sub(r'<[^>]+>', ' ', raw[max(0, i - 300):i + 500])
        seg = re.sub(r'\s+', ' ', seg)
        print('   ', seg.strip()[:650])
    print()