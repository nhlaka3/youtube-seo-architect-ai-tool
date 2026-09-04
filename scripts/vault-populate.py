#!/usr/bin/env python3
"""Step 5: Populate the Obsidian Vault from DataForSEO extraction output.
1. paa-mined-<date>.json  -> appends mined PAA Qs to Questions/paa-mining-digest.md
2. ranked-keywords-<date>.json -> refreshes Keywords/categorized-keywords-reference.md stats
Usage: python3 scripts/vault-populate.py [--paa] [--keywords]
"""
import json, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "marketing" / "dataforseo"
VAULT = Path("/mnt/c/Users/nhlaka/Desktop/yt-seo-architect-vault")
today = date.today().isoformat()

do_paa = "--paa" in sys.argv
do_kw = "--keywords" in sys.argv
if not do_paa and not do_kw:
    print("Usage: python3 scripts/vault-populate.py [--paa] [--keywords]")
    sys.exit(1)

# ── PAA digest ──────────────────────────────────────────────────
if do_paa:
    files = sorted(DATA.glob("paa-mined-*.json"))
    if not files:
        print("No paa-mined-*.json found. Run: node scripts/dataforseo-extract.mjs --paa")
        sys.exit(1)
    mined = json.loads(files[-1].read_text(encoding="utf-8"))
    digest = VAULT / "Questions" / "paa-mining-digest.md"
    original = digest.read_text(encoding="utf-8")

    sections = []
    for term, blob in mined.items():
        if not blob.get("paas"):
            continue
        lines = [f"### {q}" for q in blob["paas"][:6]]
        related = blob.get("related", [])[:3]
        if related:
            lines.append(f"*Related: {', '.join(related)}*")
        sections.append(f"## PAA — \"{term}\"\n" + "\n".join(lines))

    if sections:
        block = "\n\n---\n\n## 🔬 Mined PAA Batch ({today})\n\n" + "\n\n".join(sections) + "\n"
        if f"Mined PAA Batch ({today})" in original:
            print("⏭ PAA batch already in digest for today")
        else:
            digest.write_text(original.rstrip() + block, encoding="utf-8")
            print(f"✓ Appended {len(sections)} PAA term-clusters to paa-mining-digest.md")
    else:
        print("⚠ No PAA questions mined in latest file")

# ── Keywords reference ──────────────────────────────────────────
if do_kw:
    files = sorted(DATA.glob("ranked-keywords-*.json"))
    if not files:
        print("No ranked-keywords-*.json found. Run: node scripts/dataforseo-extract.mjs --keywords")
        sys.exit(1)
    raw = json.loads(files[-1].read_text(encoding="utf-8"))
    total = sum(len(v) for v in raw.values())
    domains = list(raw.keys())
    kw_ref = VAULT / "Keywords" / "categorized-keywords-reference.md"
    original = kw_ref.read_text(encoding="utf-8")
    stats = f"""## 📊 Latest DataForSEO Extraction ({today})

- **Competitors profiled:** {', '.join(domains) if domains else 'n/a'}
- **Total keyword rows extracted:** {total}
- **XLSX master:** `marketing/dataforseo/keyword-master-{today}.xlsx` (4 tabs: High Opportunity / Hidden Gems / High Volume / All Keywords)
- **Next step:** segment into content calendar — map High Opportunity + Hidden Gems to `/tools` + `/blog` routes per [[Keywords/cannibalization-ledger]].

"""
    marker = "## 📊 Latest DataForSEO Extraction"
    if marker in original:
        original = original[: original.index(marker)] + stats
    else:
        original = original.rstrip() + "\n\n---\n\n" + stats
    kw_ref.write_text(original, encoding="utf-8")
    print(f"✓ Refreshed categorized-keywords-reference.md ({total} rows, {len(domains)} domains)")
