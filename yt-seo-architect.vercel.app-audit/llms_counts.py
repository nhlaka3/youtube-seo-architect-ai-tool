#!/usr/bin/env python3
import re

raw = open('llms.txt', encoding='utf-8', errors='replace').read()
lines = raw.splitlines()

# Section claimed counts vs actual entry counts
cur = None
counts = {}
for l in lines:
    if l.startswith('## '):
        cur = l
        counts[cur] = {'claimed': None, 'n': 0}
        m = re.search(r'\((\d+)[^)]*\)', l)
        if m: counts[cur]['claimed'] = int(m.group(1))
    elif l.startswith('- [') and cur:
        counts[cur]['n'] += 1
for k, v in counts.items():
    print(f"{k}: listed={v['n']} claimed={v['claimed']}")

# sample the 'doubled word' matches
print("\n--- sample doubled/garbled matches ---")
for l in lines:
    if l.startswith('- [') and (re.search(r'(\w+) \1', l) or re.search(r'channels chan', l)):
        # show the actual repeated token
        m = re.search(r'(\w+) \1', l)
        tok = m.group(1) if m else 'channels chan'
        print(f"  [{tok}] {l[:100]}")
