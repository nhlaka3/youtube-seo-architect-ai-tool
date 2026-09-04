#!/usr/bin/env python3
"""Gap analysis: mined keywords vs existing site coverage.

Builds the existing-site vocabulary (slugs, titles, H1s from public HTML),
then scores each mined keyword by token-overlap with what we already cover.
Output: marketing/dataforseo/keyword-gaps-<date>.json + vault append.

Usage: python3 scripts/gap-analysis.py
"""
import json, re, html as htmlmod
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
DATA = ROOT / "marketing" / "dataforseo"
VAULT = Path("/mnt/c/Users/nhlaka/Desktop/yt-seo-architect-vault")
today = date.today().isoformat()

STOP = {"the", "a", "an", "and", "or", "for", "to", "in", "on", "of", "with",
        "how", "what", "why", "is", "are", "do", "does", "can", "your", "you",
        "best", "top", "2026", "2025", "free", "tips", "guide", "tool"}

def vocab_from_html(path):
    words = set()
    try:
        t = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return words
    # title + h1 + h2 + meta description + slugs
    for pat in [r"<title[^>]*>(.*?)</title>", r"<h1[^>]*>(.*?)</h1>",
                r"<h2[^>]*>(.*?)</h2>", r'name="description" content="(.*?)"']:
        for m in re.finditer(pat, t, re.S | re.I):
            txt = htmlmod.unescape(re.sub(r"<[^>]+>", "", m.group(1)))
            words.update(w.lower().strip(".,;:!?()[]{}'\"") for w in txt.split()
                         if len(w) > 3 and w.lower() not in STOP)
    return words

def main():
    # collect vocab from all public html
    all_words = set()
    files = list(PUBLIC.rglob("*.html"))
    for f in files:
        all_words |= vocab_from_html(f)
    print(f"Site vocabulary: {len(all_words)} content words from {len(files)} pages")

    files = sorted(DATA.glob("keywords-mined-*.json"))
    if not files:
        print("No keywords-mined-*.json — run check-keyword.py --mine first")
        return
    mined = json.loads(files[-1].read_text(encoding="utf-8"))
    kws = mined.get("keywords", [])

    gaps = []
    covered = []
    for k in kws:
        kw = k["keyword"]
        toks = [w for w in kw.split() if w.lower() not in STOP]
        if not toks:
            continue
        hits = sum(1 for t in toks if t in all_words)
        overlap = hits / len(toks)
        rec = {"keyword": kw, "demand": k.get("demand", 0),
               "overlap": round(overlap, 2), "matched": hits, "total": len(toks)}
        if overlap <= 0.33:
            gaps.append(rec)
        else:
            covered.append(rec)

    gaps.sort(key=lambda r: -(r["demand"] or 0))
    out = DATA / f"keyword-gaps-{today}.json"
    out.write_text(json.dumps({"description": "Mined keywords NOT covered by existing site pages",
                               "lastUpdated": today, "total_mined": len(kws),
                               "gap_count": len(gaps), "covered_count": len(covered),
                               "gaps": gaps}, indent=2), encoding="utf-8")
    print(f"\n✅ {out.name}: {len(gaps)} uncovered keywords (of {len(kws)} mined)")

    print("\nTOP 25 UNCOVERED (highest demand):")
    for i, g in enumerate(gaps[:25], 1):
        print(f"  {i}. demand {g['demand']:>3} overlap {g['overlap']:.0%} — {g['keyword']}")

    # vault append
    ref = VAULT / "Keywords" / "categorized-keywords-reference.md"
    if ref.exists():
        original = ref.read_text(encoding="utf-8")
        block = (f"\n\n## 🎯 Keyword Gap List — {today}\n\n"
                 f"{len(gaps)} mined keywords with <34% overlap vs existing site coverage "
                 f"(of {len(kws)} total). Top targets:\n\n"
                 + "\n".join(f"- {g['keyword']} — demand {g['demand']}/100" for g in gaps[:40]) + "\n")
        if f"Keyword Gap List — {today}" in original:
            print("⏭ gap list already in vault")
        else:
            ref.write_text(original.rstrip() + block, encoding="utf-8")
            print(f"✓ Vault: categorized-keywords-reference.md (+{min(len(gaps), 40)} gap targets)")

if __name__ == "__main__":
    main()
