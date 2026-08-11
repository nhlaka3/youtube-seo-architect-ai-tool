#!/usr/bin/env python3
"""Locate + print the article payload, handling UTF-16/UTF-8 mixed encodings."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/yt1.html'
b = open(path, 'rb').read()
print('bytes:', len(b), 'head:', b[:4])

if b[:2] in (b'\xff\xfe', b'\xfe\xff'):
    raw = b.decode('utf-16', errors='ignore')
else:
    # Mixed: try utf-8, then a null-stripped utf-16 fallback
    try:
        raw = b.decode('utf-8')
    except Exception:
        raw = b.decode('utf-16', errors='ignore')

print('decoded len:', len(raw))
for probe in ['How YouTube Search works', 'How YouTube Search', 'relevance', 'watch time', 'engagement']:
    i = raw.find(probe)
    print(f'{probe!r}: {i}')
    if i >= 0:
        print('   CTX:', raw[i-150:i+700].replace('\\n', ' ')[:850])
        print()
