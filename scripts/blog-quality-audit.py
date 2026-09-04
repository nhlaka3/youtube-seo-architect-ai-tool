#!/usr/bin/env python3
"""
scripts/blog-quality-audit.py

Full-site blog quality audit for YT SEO Architect. Runs the vendored
claude-blog scoring tools (analyze_blog + cognitive_load, no network) plus
local structural metrics, then writes:

  reports/blog-quality-report.md   — human-readable report
  reports/blog-quality.json        — machine-readable scores
  scripts/refresh-priority.json    — slugs ordered worst-first (feeds
                                     refresh-oldest-post.mjs so the refresh
                                     cron fixes the LOWEST-quality post, not
                                     just the oldest)

Usage:
  python3 scripts/blog-quality-audit.py                 # audit public/blog/
  python3 scripts/blog-quality-audit.py --dir public/blog --json
  python3 scripts/blog-quality-audit.py --min-score 50  # only list below 50

Notes:
  - ai_citation_score.py is deliberately NOT run here (batch runs were
    blocked; the scorer does network link checks). Run it manually per post:
      python3 scripts/blog-quality/ai_citation_score.py public/blog/<slug>.html
  - Reports go to reports/ (gitignored if you want; commit refresh-priority.json)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
BLOG_DIR = PROJECT / "public" / "blog"
QUALITY_DIR = Path(__file__).resolve().parent / "blog-quality"
REPORT_DIR = PROJECT / "reports"
PRIORITY_FILE = PROJECT / "scripts" / "refresh-priority.json"

SKIP_PREFIXES = ("_", ".")
MIN_REFRESH_GAP_DAYS = 7  # don't re-prioritize posts refreshed this week


def run(cmd: list[str], timeout: int = 300) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout


def analyze_all(files: list[Path]) -> dict:
    out = run([
        sys.executable, str(QUALITY_DIR / "analyze_blog.py"),
        str(BLOG_DIR), "--batch", "--format", "json",
    ])
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        print("  ⚠ analyze_blog returned no valid JSON — continuing without scores")
        return {"results": []}


def cognitive_for(file: Path) -> dict:
    out = run([
        sys.executable, str(QUALITY_DIR / "cognitive_load.py"),
        str(file), "--format", "json",
    ], timeout=120)
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return {}
    return data


def structural_metrics(html: str) -> dict:
    imgs = re.findall(r"<img[^>]*>", html)
    article = re.search(r"<article[^>]*>([\s\S]*?)</article>", html, re.I)
    body = article.group(1) if article else html
    text = re.sub(r"<[^>]+>", " ", body)
    pub = re.search(r'<meta property="article:published_time" content="([^"]+)"', html)
    mod = re.search(r'<meta property="article:modified_time" content="([^"]+)"', html)
    h2 = len(re.findall(r"<h2[^>]*>", body))
    return {
        "img_count": len(imgs),
        "imgs_with_alt": sum(1 for i in imgs if re.search(r'alt=["\'][^"\']+["\']', i)),
        "word_count": len(text.split()),
        "h2_count": h2,
        "published": pub.group(1) if pub else None,
        "modified": mod.group(1) if mod else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default=str(BLOG_DIR))
    ap.add_argument("--json", action="store_true", help="Print JSON report to stdout")
    ap.add_argument("--min-score", type=int, default=0, help="Only report posts below this score")
    ap.add_argument("--skip-priority", action="store_true", help="Don't write refresh-priority.json")
    args = ap.parse_args()

    d = Path(args.dir)
    files = sorted(f for f in d.glob("*.html") if not f.name.startswith(SKIP_PREFIXES))
    if not files:
        print(f"❌ No blog posts found in {d}")
        return 1

    print(f"🔍 Auditing {len(files)} posts in {d} ...\n")

    # 1. analyze_blog (5-category, 100-pt)
    print("  Running analyze_blog (quality/SEO/E-E-A-T/technical/AI-readiness)...")
    analyzed = analyze_all(files)
    scores = {}
    for r in analyzed.get("results", []):
        slug = Path(r["file"]).stem
        scores[slug] = {
            "total": r.get("score", {}).get("total", 0),
            "categories": r.get("score", {}).get("categories", {}),
            "rating": r.get("score", {}).get("rating", "?"),
        }

    # 2. cognitive_load per post (no network)
    print("  Running cognitive_load (per-section readability)...")
    cognitive = {}
    for f in files:
        slug = f.stem
        data = cognitive_for(f)
        sections = data.get("sections", [])
        if sections:
            avg = sum(s.get("load_score", 0) for s in sections) / len(sections)
            cognitive[slug] = {
                "avg_load": round(avg, 1),
                "max_load": max((s.get("load_score", 0) for s in sections), default=0),
                "overloaded_sections": sum(1 for s in sections if s.get("verdict") == "overloaded"),
                "section_count": len(sections),
            }

    # 3. Structural metrics
    print("  Extracting structural metrics (images, words, dates)...")
    structure = {}
    for f in files:
        structure[f.stem] = structural_metrics(f.read_text(encoding="utf-8", errors="ignore"))

    # 4. Cannibalization (no network)
    print("  Running cannibalization check...")
    cannib_out = run([
        sys.executable, str(QUALITY_DIR / "cannibalization.py"),
        "--dir", str(d), "--json",
    ], timeout=120)
    try:
        cannib = json.loads(cannib_out)
    except json.JSONDecodeError:
        cannib = {"clusters": []}

    # 5. Assemble report
    rows = []
    for f in files:
        slug = f.stem
        s = structure.get(slug, {})
        q = scores.get(slug, {})
        c = cognitive.get(slug, {})
        rows.append({
            "slug": slug,
            "quality_score": q.get("total", 0),
            "rating": q.get("rating", "?"),
            "words": s.get("word_count", 0),
            "h2": s.get("h2_count", 0),
            "images": s.get("img_count", 0),
            "imgs_with_alt": s.get("imgs_with_alt", 0),
            "avg_load": c.get("avg_load"),
            "overloaded_sections": c.get("overloaded_sections", 0),
            "published": s.get("published"),
            "modified": s.get("modified"),
            "categories": q.get("categories", {}),
        })

    rows.sort(key=lambda r: (r["quality_score"], -(r.get("words") or 0)))

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "post_count": len(rows),
        "average_quality": round(sum(r["quality_score"] for r in rows) / len(rows), 1),
        "average_words": round(sum(r["words"] for r in rows) / len(rows), 0),
        "posts_with_one_image_or_less": sum(1 for r in rows if r["images"] <= 1),
        "cannibalization_clusters": len(cannib.get("clusters", [])),
        "posts": rows,
        "cannibalization": cannib.get("clusters", []),
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "blog-quality.json").write_text(json.dumps(report, indent=2))
    (REPORT_DIR / "blog-quality-report.md").write_text(render_md(report))
    print(f"\n  ✅ Report: {REPORT_DIR / 'blog-quality-report.md'}")

    # 6. Refresh priority (worst-first, skip recently refreshed)
    if not args.skip_priority:
        today = datetime.utcnow().date()
        priority = []
        for r in sorted(rows, key=lambda x: (x["quality_score"], -(x["words"] or 0))):
            if r["quality_score"] >= args.min_score and args.min_score:
                continue
            mod = None
            if r.get("modified"):
                try:
                    mod = datetime.fromisoformat(r["modified"].replace("Z", "")).date()
                except ValueError:
                    mod = None
            if mod and (today - mod).days < MIN_REFRESH_GAP_DAYS:
                continue  # refreshed this week already — skip
            # Posts below the word floor are broken/empty shells — they need
            # full regeneration (auto-blog-generator), not a section graft.
            action = "regenerate" if (r["words"] or 0) < 800 else "refresh"
            priority.append({
                "slug": r["slug"],
                "quality_score": r["quality_score"],
                "words": r["words"] or 0,
                "action": action,
            })
        PRIORITY_FILE.write_text(json.dumps(priority, indent=2))
        print(f"  ✅ Refresh priority: {PRIORITY_FILE} ({len(priority)} slugs)")

    # 7. Output
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render_md(report))
    return 0


def render_md(report: dict) -> str:
    lines = [
        "# Blog Quality Audit",
        "",
        f"**Generated:** {report['generated_at']}  ",
        f"**Posts:** {report['post_count']}  ",
        f"**Average quality:** {report['average_quality']}/100  ",
        f"**Average words:** {report['average_words']}  ",
        f"**Posts with ≤1 image:** {report['posts_with_one_image_or_less']}  ",
        f"**Cannibalization clusters:** {report['cannibalization_clusters']}",
        "",
        "## Ranked (worst first)",
        "",
        "| Slug | Score | Rating | Words | H2 | Imgs | Avg load |",
        "|------|-------|--------|-------|----|------|----------|",
    ]
    for r in report["posts"]:
        lines.append(
            f"| {r['slug'][:44]} | {r['quality_score']} | {r['rating']} | "
            f"{r['words']} | {r['h2']} | {r['images']} | {r['avg_load'] or '-'} |"
        )
    if report.get("cannibalization"):
        lines.append("\n## Cannibalization")
        for i, c in enumerate(report["cannibalization"], 1):
            lines.append(f"- **{c['severity']}** {', '.join(c['posts'])} — {c['recommendation']}")
    lines.append("\n## Notes")
    lines.append("- Score: internal editorial-readiness heuristic (0-100), not a ranking guarantee.")
    lines.append("- ai_citation_score (GEO/AI-citation readiness) not run in batch — run per-post manually.")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
