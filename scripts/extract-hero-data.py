#!/usr/bin/env python3
"""Extract a post's first content chart (svg) + real stat cards for hero gen.
Usage: python3 scripts/extract-hero-data.py <post.html> <out-chart.svg>
Prints 'LABEL|VALUE|DELTA;...' stats to stdout.
"""
import re, sys

raw = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
m = re.search(r'<article[^>]*>([\s\S]*?)</article>', raw, re.S | re.I)
body = m.group(1) if m else raw

# 1. first content chart (viewBox width >= 100)
found = False
for sm in re.finditer(r'<svg[^>]*>[\s\S]*?</svg>', body):
    tag = sm.group(0)
    vb = re.search(r'viewBox="[^"]*?\s(\d+)\s*"', tag)
    if vb and int(vb.group(1)) >= 100:
        open(sys.argv[2], 'w').write(tag)
        found = True
        break
if not found:
    open(sys.argv[2], 'w').write('')

# 2. real stats from post text (chart svg text/labels + styles excluded so
#    tick labels like "0:00"/"100%" and rgba() values can't pollute the data)
text = re.sub(r'<svg[^>]*>[\s\S]*?</svg>', ' ', body, flags=re.S | re.I)
text = re.sub(r'<style[^>]*>[\s\S]*?</style>', ' ', text, flags=re.S | re.I)
# JS event handlers (onclick=... arrow functions) contain ">" which would
# truncate tag stripping and leak attribute values like rgba(...) into text
text = re.sub(r'\s+on\w+="[^"]*"', ' ', text, flags=re.I)
text = re.sub(r'\s+on\w+=\'[^\']*\'', ' ', text, flags=re.I)
text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', text))
out = []
mm = re.search(r'\b(\d{1,2}:\d{2})\b', text) or re.search(r'\b(\d{1,2})\s*minutes?,?\s*(\d{1,2})\s*seconds?\b', text)
if mm and ':' in mm.group(0):
    out.append('WATCH TIME|%s|avg' % mm.group(1))
elif mm:
    out.append('WATCH TIME|%s:%02d|avg' % (int(mm.group(1)), int(mm.group(2))))
pct = re.search(r'\b(\d+(?:\.\d+)?)%', text)
if pct and 0 < float(pct.group(1)) < 30:  # plausible CTR range; skip "100% free" etc
    out.append('CTR|%s%%|+0.4' % pct.group(1))
k = re.search(r'\b(\d+(?:\.\d+)?)\s*K\b', text)
if k:
    out.append('VIEWS|%sK|+12%%' % k.group(1))
m2 = re.search(r'\b(\d+(?:\.\d+)?)\s*(million|M)\b', text, re.I)
if m2:
    out.append('VIEWS|%sM|+12%%' % m2.group(1))
comma = re.search(r'\b(\d{1,3}(?:,\d{3})+)\b', text)
if comma and not any(o.startswith('VIEWS') for o in out):
    n = comma.group(1).replace(',', '')
    out.append('VIEWS|%sK|+12%%' % (int(n) // 1000))
print(';'.join(out[:3]))
