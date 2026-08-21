#!/usr/bin/env python3
"""Mine PAA-style questions from the top mined keywords using question-stem
autocomplete (free proxy for People-Also-Ask boxes).

For each top keyword, query Google Suggest with question prefixes:
  how, how to, what, what is, why, when, can, do, does, is, are, best, which
Collects genuine questions people type. Output: JSON + vault digest append.

Usage: python3 scripts/mine-paa-free.py [--top N] [--max-kw M]
"""
import json, sys, time, urllib.request, urllib.parse, re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "marketing" / "dataforseo"
VAULT = Path("/mnt/c/Users/nhlaka/Desktop/yt-seo-architect-vault")
today = date.today().isoformat()

STEMS = ["how to", "how", "what", "what is", "why", "when", "can",
         "do", "does", "is", "are", "best", "which", "should"]

def suggest(query, client="firefox"):
    url = ("https://suggestqueries.google.com/complete/search?client=" + client +
           "&hl=en&q=" + urllib.parse.quote(query))
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
    if client == "youtube":
        m = re.search(r"window\.google\.ac\.h\((.*)\)", raw)
        if not m:
            return []
        data = json.loads(m.group(1))
        return [item[0] for item in data[1]] if len(data) > 1 else []
    data = json.loads(raw)
    return data[1] if len(data) > 1 else []

Q_WORDS = {"how", "what", "why", "when", "can", "do", "does", "is", "are",
           "which", "should", "who", "where", "will", "would"}

def looks_like_question(s):
    s = s.strip().rstrip("?.")
    if not s:
        return False
    return s.lower().split()[0] in Q_WORDS

def main():
    top_n = 40
    max_kw = 15
    args = sys.argv[1:]
    if "--top" in args:
        top_n = int(args[args.index("--top") + 1])
    if "--max-kw" in args:
        max_kw = int(args[args.index("--max-kw") + 1])

    files = sorted(DATA.glob("keywords-mined-*.json"))
    if not files:
        print("No keywords-mined-*.json — run check-keyword.py --mine first")
        sys.exit(1)
    mined = json.loads(files[-1].read_text(encoding="utf-8"))
    kws = sorted(mined.get("keywords", []), key=lambda k: -(k.get("demand") or 0))
    kws = [k for k in kws if (k.get("demand") or 0) >= 60][:max_kw]
    print(f"Mining PAA-style questions for top {len(kws)} keywords (top {top_n} Qs each)...")

    out = {}
    queries = 0
    for kw in kws:
        term = kw["keyword"]
        qs = set()
        for stem in STEMS:
            if queries >= 400:
                break
            queries += 1
            try:
                for s in suggest(f"{stem} {term}"):
                    s = s.strip()
                    if looks_like_question(s) and len(s) < 120:
                        qs.add(s)
            except Exception:
                pass
            time.sleep(0.15)
        if queries >= 400:
            break
        if qs:
            out[term] = sorted(qs)[:top_n]
            print(f"  {term}: {len(out[term])} questions")

    out_path = DATA / f"paa-free-{today}.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    total = sum(len(v) for v in out.values())
    print(f"\n✅ {out_path.name} — {len(out)} keywords, {total} questions")

    # vault append
    digest = VAULT / "Questions" / "paa-mining-digest.md"
    if digest.exists():
        original = digest.read_text(encoding="utf-8")
        sections = []
        for term, qs in out.items():
            lines = [f"### {q}" for q in qs[:6]]
            sections.append(f"## PAA (free) — \"{term}\"\n" + "\n".join(lines))
        block = "\n\n---\n\n## 🔎 Free PAA Mine ({today})\n\n" + "\n\n".join(sections) + "\n"
        if f"Free PAA Mine ({today})" in original:
            print("⏭ today's free PAA mine already in digest")
        else:
            digest.write_text(original.rstrip() + block, encoding="utf-8")
            print(f"✓ Vault: Questions/paa-mining-digest.md (+{len(sections)} keyword clusters)")

if __name__ == "__main__":
    main()
