#!/usr/bin/env python3
"""GSC demand monitor for glossary comparison pages.

Queries Search Console for impressions/clicks on /glossary/*-vs-* URLs over the
last 28 days and prints pairs with real demand. Use it to decide which noindex
comparison pairs deserve promotion into INDEXED_COMPARISONS (api/index.js).

--promote: automatically insert qualifying pairs into INDEXED_COMPARISONS in
           api/index.js (idempotent; existing entries untouched). Intended for
           the weekly GitHub Action.

Usage:
  python3 scripts/check-comparison-demand.py [--min-impressions 20] [--max-position 12]
  python3 scripts/check-comparison-demand.py --promote [--min-impressions 20] [--max-position 12]
"""
import sys, json, re
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
KEY = ROOT / "config" / "google-indexing-key.json"
API_FILE = ROOT / "api" / "index.js"
SITE = "https://yt-seo-architect.vercel.app/"

args = sys.argv[1:]
PROMOTE = "--promote" in args
MIN_IMP = int(args[args.index("--min-impressions") + 1]) if "--min-impressions" in args else 20
MAX_POS = float(args[args.index("--max-position") + 1]) if "--max-position" in args else 12.0

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

if not PROMOTE:
    sys.exit(0)

# ── Promote qualifying pairs into INDEXED_COMPARISONS (api/index.js) ──
candidates = [p for p in top if p["position"] <= MAX_POS and p["impressions"] >= MIN_IMP]
if not candidates:
    print("no pairs qualify for promotion this run")
    sys.exit(0)

src = API_FILE.read_text(encoding="utf-8")
m = re.search(r"const INDEXED_COMPARISONS = new Set\(\[(.*?)\]\);", src, flags=re.S)
if not m:
    print("ERROR: could not find INDEXED_COMPARISONS block", file=sys.stderr)
    sys.exit(2)
existing = set(re.findall(r"'([a-z0-9-]+-vs-[a-z0-9-]+)'", m.group(1)))
added = []
for p in candidates:
    if p["slug"] not in existing:
        existing.add(p["slug"])
        added.append(p)
if not added:
    print("all qualifying pairs already promoted — nothing to change")
    sys.exit(0)

new_entries = sorted(existing)
block = "const INDEXED_COMPARISONS = new Set([\n" + "\n".join(f"  '{s}'," for s in new_entries) + "\n]);"
src = src[: m.start()] + block + src[m.end():]
API_FILE.write_text(src, encoding="utf-8")
print(f"\npromoted {len(added)} pair(s) into INDEXED_COMPARISONS:")
for p in sorted(added, key=lambda x: -x["impressions"]):
    print(f"  {p['slug']} (imp={p['impressions']}, pos={p['position']:.1f})")
print(f"total indexed pairs now: {len(new_entries)}")
