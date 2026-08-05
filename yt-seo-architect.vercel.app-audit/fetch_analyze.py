#!/usr/bin/env python3
"""Fetch pages and extract GEO/SXO signals: status, final URL, title, meta robots,
H1s, JSON-LD schema types, canonical, redirects."""
import re, sys, json, urllib.request, urllib.error

URLS = [
    "https://yt-seo-architect.vercel.app/",
    "https://yt-seo-architect.vercel.app/pricing",
    "https://yt-seo-architect.vercel.app/dashboard",
    "https://yt-seo-architect.vercel.app/blog",
    "https://yt-seo-architect.vercel.app/tools/",
    "https://yt-seo-architect.vercel.app/blog/youtube-shorts-seo-guide-2026",
    "https://yt-seo-architect.vercel.app/blog/youtube-seo-examples-2026",
    "https://yt-seo-architect.vercel.app/glossary/youtube-algorithm",
    "https://yt-seo-architect.vercel.app/tools/title-optimizer",
    "https://yt-seo-architect.vercel.app/guide/youtube-seo",
    "https://yt-seo-architect.vercel.app/sitemap.xml",
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; GEO-audit/1.0)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.geturl(), r.headers, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.geturl(), e.headers, e.read().decode("utf-8", "replace")
    except Exception as e:
        return "ERR", url, {}, str(e)

def grab(html, pattern, flags=re.I|re.S):
    m = re.search(pattern, html, flags)
    return m.group(1).strip() if m else None

out = {}
for u in URLS:
    status, final, headers, html = fetch(u)
    info = {"status": status, "final_url": final}
    if isinstance(status, int) and status < 400:
        info["title"] = grab(html, r"<title[^>]*>(.*?)</title>")
        info["meta_robots"] = grab(html, r'<meta[^>]+name=["\']robots["\'][^>]*content=["\']([^"\']+)')
        if not info["meta_robots"]:
            info["meta_robots"] = grab(html, r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']robots')
        info["canonical"] = grab(html, r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)')
        h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S)
        info["h1_count"] = len(h1s)
        info["h1s"] = [re.sub(r"<[^>]+>", "", h).strip()[:160] for h in h1s][:3]
        # JSON-LD schema types
        types = re.findall(r'"@type"\s*:\s*"([^"]+)"', html)
        from collections import Counter
        info["schema_types"] = dict(Counter(types))
        # FAQPage presence
        info["has_faqpage"] = '"FAQPage"' in html
        # noindex hint
        info["noindex"] = bool(info["meta_robots"] and "noindex" in info["meta_robots"].lower())
    out[u] = info
    print(json.dumps({u: info}, indent=1))
