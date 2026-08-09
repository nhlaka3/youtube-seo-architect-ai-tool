#!/usr/bin/env python3
"""Batch footer link cleanup: /X.html -> /X across static pages + API templates.
Idempotent. Replaces only the 7 known footer-nav hrefs (double-quoted)."""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."

# (old, new) — footer nav links only
PAIRS = [
    ('href="/dashboard.html"', 'href="/dashboard"'),
    ('href="/changelog.html"', 'href="/changelog"'),
    ('href="/about.html"', 'href="/about"'),
    ('href="/contact.html"', 'href="/contact"'),
    ('href="/privacy-policy.html"', 'href="/privacy-policy"'),
    ('href="/terms-of-service.html"', 'href="/terms-of-service"'),
    ('href="/tools.html"', 'href="/tools"'),
]

def fix(content):
    total = 0
    for old, new in PAIRS:
        n = content.count(old)
        if n:
            content = content.replace(old, new)
            total += n
    return content, total

# 1) Static HTML: everything under public/ + deployed root vite entries
static_files = sorted(glob.glob(os.path.join(ROOT, "public", "**", "*.html"), recursive=True))
static_files += [os.path.join(ROOT, f) for f in
    ["index.html", "dashboard.html", "about.html", "contact.html", "pricing.html",
     "privacy-policy.html", "terms-of-service.html", "changelog.html", "tools.html",
     "warriorplus-landing.html", "redirect.html", "404.html"]]

changed_files = 0
total_repl = 0
for fp in static_files:
    if not os.path.exists(fp):
        continue
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()
    new_content, n = fix(content)
    if n:
        with open(fp, "w", encoding="utf-8") as f:
            f.write(new_content)
        changed_files += 1
        total_repl += n
        print(f"  {n:4d}  {os.path.relpath(fp, ROOT)}")

print(f"\nStatic: {changed_files} files, {total_repl} replacements")

# 2) API templates (footer HTML baked into JS strings)
for api_file in ["api/index.js", "api/blog-renderer.js"]:
    fp = os.path.join(ROOT, api_file)
    if not os.path.exists(fp):
        continue
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()
    new_content, n = fix(content)
    if n:
        with open(fp, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"  {n:4d}  {api_file}")

print("Done.")
