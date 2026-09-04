#!/usr/bin/env python3
"""Scrape competitor sitemaps → topic phrase corpus (free DataForSEO step-1/2 replacement).

Fetches sitemap.xml (and common sitemap index children) from the 8 known competitors,
extracts URL slugs, converts to readable topic phrases, filters to YouTube-SEO-relevant,
and writes marketing/dataforseo/competitor-topics-<date>.json.

Usage: python3 scripts/scrape-competitor-sitemaps.py
"""
import json, re, sys, time, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "marketing" / "dataforseo"
today = date.today().isoformat()

COMPETITORS = [
    "https://vidiq.com/sitemap.xml",
    "https://www.tubebuddy.com/sitemap.xml",
    "https://morningfa.me/sitemap.xml",
    "https://www.tubics.com/sitemap.xml",
    "https://keywordtool.io/sitemap.xml",
    "https://vidonapp.com/sitemap.xml",
    "https://www.socialpilot.co/sitemap.xml",
    "https://www.hootsuite.com/sitemap.xml",
]

STOP = {"the", "a", "an", "and", "or", "for", "to", "in", "on", "of", "with", "how",
        "what", "why", "is", "are", "do", "does", "can", "your", "you", "best", "top",
        "2026", "2025", "2024", "free", "tips", "guide", "tool", "blog", "article",
        "page", "post", "using", "use", "get", "make", "video", "youtube", "yt"}

NICHE = {"youtube", "seo", "video", "channel", "creator", "subscriber", "view", "watch",
         "algorithm", "monetiz", "tag", "keyword", "thumbnail", "title", "description",
         "rank", "search", "traffic", "growth", "short", "live", "comment", "engagement",
         "retention", "ctr", "audience", "content", "studio", "upload", "analytics"}

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "ignore")

def extract_urls(xml):
    return re.findall(r"<loc>\s*(.*?)\s*</loc>", xml, re.S)

def slug_to_phrase(slug):
    parts = [p for p in slug.split("/") if p and p != "blog"]
    if not parts:
        return None
    last = parts[-1].split(".")[0]
    words = re.split(r"[-_+]+", last)
    words = [w for w in words if w and w.lower() not in STOP and not w.isdigit()]
    if len(words) < 2:
        return None
    return " ".join(words).lower()

def niche_relevant(phrase):
    return any(n in phrase for n in NICHE)

def main():
    all_topics = {}
    total_urls = 0
    for url in COMPETITORS:
        domain = url.split("/")[2]
        try:
            xml = fetch(url)
            urls = extract_urls(xml)
            total_urls += len(urls)
            # if it's a sitemap index, fetch children (up to 10)
            child_maps = re.findall(r"<sitemap>\s*<loc>\s*(.*?)\s*</loc>", xml, re.S)
            if child_maps:
                for cu in child_maps[:10]:
                    try:
                        xml2 = fetch(cu)
                        urls += extract_urls(xml2)
                        time.sleep(0.4)
                    except Exception:
                        pass
            topics = []
            for u in urls:
                slug = u.replace("https://", "").replace("http://", "").replace(domain, "", 1)
                ph = slug_to_phrase(slug)
                if ph and niche_relevant(ph) and ph not in topics:
                    topics.append(ph)
            all_topics[domain] = topics
            print(f"  {domain}: {len(urls)} URLs → {len(topics)} niche topics")
        except Exception as e:
            print(f"  {domain}: FAIL ({str(e)[:60]})")
        time.sleep(0.5)

    out = DATA / f"competitor-topics-{today}.json"
    out.write_text(json.dumps({
        "description": "Competitor content topics scraped from public sitemaps (free competitor-intel layer)",
        "lastUpdated": today,
        "total_urls": total_urls,
        "competitors": all_topics,
    }, indent=2), encoding="utf-8")
    flat = [t for ts in all_topics.values() for t in ts]
    print(f"\n✅ {out.name} — {len(flat)} unique niche topics across {len(all_topics)} competitors")
    sys.exit(0)

if __name__ == "__main__":
    main()
