#!/usr/bin/env python3
"""Quantify llms.txt / llms-full.txt quality issues."""
import re, html

def analyze(path, label):
    raw = open(path, encoding='utf-8', errors='replace').read()
    lines = raw.splitlines()
    entries = [l for l in lines if l.startswith('- [')]
    print(f"=== {label} ===")
    print(f"bytes: {len(raw)}, lines: {len(lines)}, list entries: {len(entries)}")
    # section headers
    secs = [l for l in lines if l.startswith('## ')]
    print("sections:", secs)
    # empty descriptions: entry ends with '): ' or '):' or ':'
    empty = [l[:90] for l in entries if re.search(r'\):\s*$|\):\s*$|\)$', l) and ']:' in l and re.search(r'\]\([^)]*\):\s*$', l)]
    print("entries with EMPTY description:", len(empty))
    for e in empty[:10]: print("   ", e)
    # template-injected descriptions (slug echo)
    tmpl = [l for l in entries if 'Learn how to ' in l]
    print("entries with 'Learn how to' template:", len(tmpl))
    tmpl2 = [l for l in entries if 'Analyze your text for SEO keywords' in l]
    print("entries with generic 'Analyze your text' filler:", len(tmpl2))
    # HTML entity leaks / tags
    ent = [l[:80] for l in entries if '&amp;' in l or '&lt;' in l or '&gt;' in l or '<a href' in l]
    print("entries leaking HTML entities/tags:", len(ent))
    for e in ent[:6]: print("   ", e)
    # truncated/mid-word
    trunc = [l[:80] for l in entries if re.search(r'\w{2,}$', l) and re.search(r'chann\s*$|creat\s*$|chan\s*$|seo\s*$', l)]
    print("entries ending mid-word (truncated):", len(trunc))
    for e in trunc[:6]: print("   ", e)
    # doubled words like 'channels channels' / 'channels chan'
    dup = [l[:80] for l in entries if re.search(r'(\w+) \1', l) or re.search(r'channels chan', l)]
    print("entries with doubled/garbled words:", len(dup))
    for e in dup[:6]: print("   ", e)
    # slug-like lowercase starts
    sluggy = [l[:70] for l in entries if re.match(r'- \[[a-z]', l)]
    print("entries with lowercase (slug-derived) titles:", len(sluggy))
    print()

analyze('llms.txt', 'llms.txt')
analyze('llms-full.txt', 'llms-full.txt')
