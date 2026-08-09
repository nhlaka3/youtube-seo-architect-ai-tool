#!/usr/bin/env python3
"""GSC demand monitor for glossary comparison pages.

Queries Search Console for impressions/clicks on /glossary/*-vs-* URLs over the
last 28 days and prints pairs with real demand. Use it to decide which noindex
comparison pairs deserve promotion into INDEXED_COMPARISONS (api/index.js).

Usage: python3 scripts/check-comparison-demand.py [--min-impressions 20]
"""
import sys, json
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = Path(__file__).resolve().parent.parent / "config" / "google-indexing-key.json"
SITE = "https://yt-seo-architect.vercel.app/"
MIN_IMP = int(sys.argv[sys.argv.index("--min-impressions") + 1]) if "--min-impressions" in sys.argv else 20

creds = service_account.Credentials.from_service_account_file(
    str(KEY), scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
svc = build("webmasters", "v3", credentials=creds)

rows = svc.searchanalytics().query(siteUrl=SITE, body={
    "startDate": "2026-07-10", "endDate": "2026-08-07",
    "dimensions": ["page"], "rowLimit": 5000,
}).execute().get("rows", [])

pairs = []
for r in rows:
    u = r["keys"][0].replace(SITE, "")
    if "-vs-" not in u:
        continue
    slug = u.rsplit("/", 1)[-1]
    pairs.append({"slug": slug, "clicks": r["clicks"], "impressions": r["impressions"],
                  "ctr": r["ctr"], "position": r["position"]})

# aggregate same pair across languages, keep max impressions
agg = {}
for p in pairs:
    s = p["slug"]
    if s not in agg or p["impressions"] > agg[s]["impressions"]:
        agg[s] = p
demand = sorted(agg.values(), key=lambda x: -x["impressions"])
top = [p for p in demand if p["impressions"] >= MIN_IMP]

print(f"comparison URLs seen in GSC (28d): {len(agg)} | with >= {MIN_IMP} impressions: {len(top)}")
for p in top[:25]:
    print(f"  {p['slug'][:58]:58} imp={p['impressions']:>4} cl={p['clicks']:>3} ctr={p['ctr']*100:4.1f}% pos={p['position']:5.1f}")
json.dump(top, open("/tmp/comparison-demand.json", "w"), indent=1)
print("saved /tmp/comparison-demand.json")
