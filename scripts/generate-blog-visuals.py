#!/usr/bin/env python3
"""
scripts/generate-blog-visuals.py

Branded data-visual generator for YT SEO Architect blog posts (Cyber-Luxe
Dark: #0a0b10 bg, #00f2ff cyan, #00ff88 green, orange accent). Produces
matplotlib charts as 800px PNGs matching the blog's in-content image style.

Chart types:
  bar    — horizontal bar comparison (RPM by niche, CTR benchmarks, stats)
  line   — line/area chart (retention curves, growth over time)
  funnel — conversion funnel (impressions → views → watch time → subs)
  stat   — big-number stat card (single highlight metric)
  steps  — numbered process/checklist flow
  donut  — share breakdown (traffic sources, signal weights)

Usage:
  # Auto: scan a post's H2 headings, generate fitting charts, print JSON spec
  python3 scripts/generate-blog-visuals.py public/blog/<slug>.html --auto

  # Explicit: one chart
  python3 scripts/generate-blog-visuals.py <slug> --type bar \
    --title "Average RPM by Niche (2026)" \
    --data '[{"label":"Finance","value":12.5},{"label":"Tech","value":8.2}]' \
    --unit "$"

  # Spec file (multi-chart, full control):
  python3 scripts/generate-blog-visuals.py <slug> --spec spec.json

Requires: matplotlib (installed in ~/.venv/manim). No network calls.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ── Cyber-Luxe palette (matches DESIGN.md + generate-blog-hero.py) ──
BG = "#0a0b10"
CARD = "#101420"
CYAN = "#00f2ff"
GREEN = "#00ff88"
ORANGE = "#f97316"
ORANGE2 = "#fb923c"
TEXT = "#f0f2f5"
MUTED = "#a8b2c1"
GRID = "#1c2333"

FONT = "DejaVu Sans"  # matplotlib default; Geist not bundled

# ── Benchmark data (illustrative ranges from public YouTube/creator data) ──
# Source labels are embedded in each chart so readers know these are
# benchmark ranges, not claims about a specific channel.
BENCHMARKS = {
    "ctr_by_position": {
        "title": "Average CTR by Search Position",
        "data": [
            {"label": "#1", "value": 27.0}, {"label": "#2", "value": 15.6},
            {"label": "#3", "value": 11.0}, {"label": "#4", "value": 8.9},
            {"label": "#5", "value": 7.1}, {"label": "#6", "value": 5.9},
            {"label": "#7", "value": 4.8}, {"label": "#8", "value": 4.1},
            {"label": "#9", "value": 3.6}, {"label": "#10", "value": 3.1},
        ],
        "unit": "%",
        "source": "Source: public SERP CTR benchmark ranges",
        "color": "cyan",
    },
    "retention_curve": {
        "title": "Typical Audience Retention Curve",
        "data": [
            {"label": "0%", "value": 100}, {"label": "10%", "value": 74},
            {"label": "20%", "value": 62}, {"label": "30%", "value": 54},
            {"label": "40%", "value": 47}, {"label": "50%", "value": 41},
            {"label": "60%", "value": 35}, {"label": "70%", "value": 29},
            {"label": "80%", "value": 23}, {"label": "90%", "value": 17},
            {"label": "100%", "value": 10},
        ],
        "unit": "%",
        "source": "Source: typical mid-size channel retention profile",
        "color": "cyan",
    },
    "rpm_by_niche": {
        "title": "Average RPM by Niche (Typical Ranges)",
        "data": [
            {"label": "Finance", "value": 12.5}, {"label": "Tech", "value": 8.2},
            {"label": "Education", "value": 6.4}, {"label": "Gaming", "value": 3.1},
            {"label": "Vlogs", "value": 2.4}, {"label": "Shorts", "value": 0.2},
        ],
        "unit": "$",
        "source": "Source: public creator RPM benchmark ranges (US views)",
        "color": "green",
    },
    "traffic_sources": {
        "title": "Typical YouTube Traffic Mix",
        "data": [
            {"label": "Browse/Home", "value": 38},
            {"label": "Suggested", "value": 25},
            {"label": "Search", "value": 17},
            {"label": "External", "value": 9},
            {"label": "Playlists", "value": 7},
            {"label": "Other", "value": 4},
        ],
        "unit": "%",
        "source": "Source: typical channel traffic-source distribution",
        "color": "cyan",
    },
    "upload_growth": {
        "title": "Views per Video vs Upload Frequency",
        "data": [
            {"label": "<1/mo", "value": 1.0}, {"label": "1-2/mo", "value": 1.6},
            {"label": "Weekly", "value": 2.3}, {"label": "2x/week", "value": 2.8},
            {"label": "Daily", "value": 3.1},
        ],
        "unit": "x",
        "source": "Source: illustrative growth-vs-cadence pattern",
        "color": "green",
    },
    "subs_funnel": {
        "title": "Audience Conversion Funnel",
        "steps": [
            {"label": "Impressions", "value": "10,000"},
            {"label": "Views", "value": "2,800"},
            {"label": "Watch time >30s", "value": "1,200"},
            {"label": "Subscribers", "value": "85"},
        ],
        "source": "Source: illustrative funnel, 28% CTR, 43% 30s retention",
        "color": "cyan",
    },
}

# Keyword → chart detection rules (matched against post H2 headings)
DETECT_RULES = [
    ("retention", ["retention", "watch time", "audience hold", "drop-off"]),
    ("ctr", ["ctr", "click-through", "click through", "thumbnail"]),
    ("rpm", ["rpm", "revenue", "monetiz", "sponsorship", "adsense", "earn"]),
    ("funnel", ["funnel", "subscriber", "conversion", "growth path"]),
    ("traffic", ["traffic source", "impression", "visibility", "algorithm", "suggested"]),
    ("growth", ["upload", "frequency", "cadence", "consistency", "schedule"]),
]

CHART_ORDER = ["ctr", "retention", "rpm", "funnel", "traffic", "growth"]


def setup_style() -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.facecolor": BG,
        "axes.facecolor": BG,
        "savefig.facecolor": BG,
        "text.color": TEXT,
        "axes.edgecolor": GRID,
        "axes.labelcolor": TEXT,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "font.family": FONT,
        "font.size": 13,
        "axes.titlesize": 18,
        "axes.titleweight": "bold",
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "figure.dpi": 110,
    })


def color_for(name: str) -> str:
    return {"cyan": CYAN, "green": GREEN, "orange": ORANGE}.get(name, CYAN)


def footer(ax, source: str) -> None:
    ax.text(0.01, -0.16, source, transform=ax.transAxes,
            fontsize=9.5, color=MUTED, ha="left", va="top")


def draw_bar(fig, ax, spec: dict) -> None:
    data = spec["data"]
    labels = [d["label"] for d in data][::-1]
    values = [d["value"] for d in data][::-1]
    unit = spec.get("unit", "")
    colors = [color_for(spec.get("color", "cyan"))] * len(labels)
    colors[-1] = ORANGE  # highlight the top row
    bars = ax.barh(labels, values, color=colors, height=0.62, zorder=3)
    for b, v in zip(bars, values):
        ax.text(v + max(values) * 0.015, b.get_y() + b.get_height() / 2,
                f"{v:g}{unit}", va="center", ha="left", color=TEXT, fontsize=12, zorder=4)
    ax.set_xlim(0, max(values) * 1.18)
    ax.set_title(spec["title"], pad=16)
    ax.set_axisbelow(True)
    footer(ax, spec.get("source", ""))


def draw_line(fig, ax, spec: dict) -> None:
    data = spec["data"]
    labels = [d["label"] for d in data]
    values = [d["value"] for d in data]
    c = color_for(spec.get("color", "cyan"))
    ax.plot(range(len(values)), values, color=c, linewidth=3, zorder=3, marker="o",
            markersize=5, markerfacecolor=BG, markeredgecolor=c, markeredgewidth=2)
    ax.fill_between(range(len(values)), values, min(values) * 0.85, color=c, alpha=0.08, zorder=2)
    for i, v in enumerate(values):
        ax.text(i, v + max(values) * 0.03, f"{v:g}{spec.get('unit','')}",
                ha="center", color=TEXT, fontsize=11, zorder=4)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, fontsize=10.5)
    ax.set_ylim(min(values) * 0.7, max(values) * 1.18)
    ax.set_title(spec["title"], pad=16)
    footer(ax, spec.get("source", ""))


def draw_funnel(fig, ax, spec: dict) -> None:
    steps = spec["steps"]
    n = len(steps)
    c = color_for(spec.get("color", "cyan"))
    widths = [1.0 - i * 0.16 for i in range(n)]
    for i, (step, w) in enumerate(zip(steps, widths)):
        y = n - i
        x0 = (1 - w) / 2
        ax.add_patch(__import__("matplotlib").patches.FancyBboxPatch(
            (x0, y - 0.86), w, 0.72, boxstyle="round,pad=0.02,rounding_size=0.06",
            facecolor=c if i < n - 1 else ORANGE, alpha=0.22 if i < n - 1 else 0.9,
            edgecolor=c if i < n - 1 else ORANGE, linewidth=1.4, zorder=3))
        ax.text(0.5, y - 0.5, f"{step['label']}   {step['value']}",
                ha="center", va="center", color=TEXT, fontsize=12.5, zorder=4, fontweight="bold")
    ax.set_xlim(0, 1)
    ax.set_ylim(0.4, n + 0.6)
    ax.axis("off")
    ax.set_title(spec["title"], pad=10)
    footer(ax, spec.get("source", ""))


def draw_stat(fig, ax, spec: dict) -> None:
    value = spec.get("value", "—")
    label = spec.get("label", "")
    sub = spec.get("sub", "")
    c = color_for(spec.get("color", "cyan"))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.add_patch(__import__("matplotlib").patches.FancyBboxPatch(
        (0.04, 0.08), 0.92, 0.84, boxstyle="round,pad=0.02,rounding_size=0.04",
        facecolor=CARD, edgecolor=GRID, linewidth=1.2, zorder=1))
    ax.text(0.5, 0.62, value, ha="center", va="center", color=c,
            fontsize=44, fontweight="bold", zorder=3)
    ax.text(0.5, 0.40, label, ha="center", va="center", color=TEXT,
            fontsize=15, zorder=3)
    if sub:
        ax.text(0.5, 0.18, sub, ha="center", va="center", color=MUTED,
                fontsize=10.5, zorder=3)
    footer(ax, spec.get("source", ""))


def draw_steps(fig, ax, spec: dict) -> None:
    steps = spec.get("steps", [])
    n = len(steps)
    c = color_for(spec.get("color", "cyan"))
    ax.set_xlim(0, n + 0.2)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.set_title(spec.get("title", "Process"), pad=14)
    for i, s in enumerate(steps):
        x = i + 1
        circle = __import__("matplotlib").patches.Circle(
            (x, 0.62), 0.16, facecolor=c if i < n - 1 else ORANGE, edgecolor="none", zorder=3)
        ax.add_patch(circle)
        ax.text(x, 0.62, str(i + 1), ha="center", va="center", color=BG,
                fontsize=14, fontweight="bold", zorder=4)
        ax.text(x, 0.28, s if isinstance(s, str) else s.get("label", ""),
                ha="center", va="top", color=TEXT, fontsize=11, zorder=3, wrap=True)
        if i < n - 1:
            ax.annotate("", xy=(x + 0.9, 0.62), xytext=(x + 0.22, 0.62),
                        arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=1.6))
    footer(ax, spec.get("source", ""))


def draw_donut(fig, ax, spec: dict) -> None:
    data = spec["data"]
    values = [d["value"] for d in data]
    labels = [d["label"] for d in data]
    colors = [color_for(spec.get("color", "cyan")), GREEN, ORANGE, "#5b6b8c",
              "#8a5cf6", "#e2e8f0"]
    wedges, texts = ax.pie(
        values, labels=None, colors=colors[:len(values)], startangle=90,
        counterclock=False, wedgeprops=dict(width=0.42, edgecolor=BG, linewidth=2))
    ax.text(0, 0, f"{sum(values)}{spec.get('unit','')}", ha="center", va="center",
            color=TEXT, fontsize=16, fontweight="bold")
    ax.legend(wedges, [f"{l} — {v}{spec.get('unit','')}" for l, v in zip(labels, values)],
              loc="center left", bbox_to_anchor=(1.02, 0.5), fontsize=10.5,
              facecolor=BG, edgecolor=GRID, labelcolor=TEXT)
    ax.set_title(spec["title"], pad=14)
    footer(ax, spec.get("source", ""))


DRAWERS = {"bar": draw_bar, "line": draw_line, "funnel": draw_funnel,
           "stat": draw_stat, "steps": draw_steps, "donut": draw_donut}


def render_chart(spec: dict, out_path: Path) -> None:
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8, 4.2))
    fig.subplots_adjust(bottom=0.22, left=0.14, right=0.95, top=0.86)
    DRAWERS[spec["type"]](fig, ax, spec)
    fig.savefig(out_path, dpi=110, bbox_inches="tight", pad_inches=0.18)
    plt.close(fig)


def detect_charts(h2_headings: list[str]) -> list[tuple[str, dict]]:
    """Pick benchmark charts that match the post's sections, in page order."""
    text = " ".join(h2_headings).lower()
    picks: list[tuple[str, dict]] = []
    for kind in CHART_ORDER:
        for rule_kind, needles in DETECT_RULES:
            if kind != rule_kind:
                continue
            if any(n in text for n in needles):
                spec = dict(BENCHMARKS[bench_name(kind)])
                spec["type"] = KIND_TYPE[kind]
                picks.append((kind, spec))
                break
    return picks[:3]


def bench_name(kind: str) -> str:
    return {
        "ctr": "ctr_by_position", "retention": "retention_curve",
        "rpm": "rpm_by_niche", "funnel": "subs_funnel",
        "traffic": "traffic_sources", "growth": "upload_growth",
    }[kind]


# Detection kind → chart drawer type
KIND_TYPE = {
    "ctr": "bar", "retention": "line", "rpm": "bar",
    "funnel": "funnel", "traffic": "donut", "growth": "bar",
}


def figure_html(slug: str, idx: int, spec: dict, out_dir: str = "/blog") -> str:
    """In-content <figure> block matching the blog's existing image styling."""
    fname = f"{slug}-visual-{idx}.png"
    caption = spec.get("caption") or spec.get("title", "")
    source = spec.get("source", "")
    src = f"{out_dir}/{fname}"
    return (
        f'<figure class="blog-visual" style="margin:28px 0;">'
        f'<img src="{src}" alt="{caption}" width="800" height="420" loading="lazy" '
        f'style="width:100%;height:auto;max-width:800px;border-radius:12px;'
        f'border:1px solid #2D215E;margin:0 0 8px 0;"/>'
        f'<figcaption style="color:#a8b2c1;font-size:13px;text-align:center;">'
        f"{caption} — {source}</figcaption></figure>"
    )


def auto_generate(html_path: Path, out_dir: Path, slug: str) -> list[dict]:
    """Scan post H2s + body text, generate up to 3 matching charts.

    Falls back to the CTR-by-position chart (relevant to every YouTube SEO
    post) when no section keywords match.
    """
    raw = html_path.read_text(encoding="utf-8", errors="ignore")
    h2s = [re.sub(r"<[^>]+>", "", h).strip()
           for h in re.findall(r"<h2[^>]*>(.*?)</h2>", raw, re.DOTALL | re.IGNORECASE)]
    picks = detect_charts(h2s)
    if not picks:
        # Template headings are generic ("What the Data Shows") — fall back to
        # the universally relevant CTR-by-position chart.
        spec = dict(BENCHMARKS["ctr_by_position"])
        spec["type"] = "bar"
        picks = [("ctr", spec)]
    results = []
    for idx, (kind, spec) in enumerate(picks, start=1):
        spec = dict(spec)  # copy — don't mutate BENCHMARKS
        out = out_dir / f"{slug}-visual-{idx}.png"
        render_chart(spec, out)
        results.append({
            "file": out.name,
            "type": kind,
            "title": spec["title"],
            "figure_html": figure_html(slug, idx, spec),
            "insert_after": kind,  # injector maps kind → section id
        })
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", help="Slug or path to blog HTML")
    ap.add_argument("--auto", action="store_true",
                    help="Detect chart types from the post's H2 headings")
    ap.add_argument("--type", choices=list(DRAWERS), help="Chart type")
    ap.add_argument("--title", default="", help="Chart title")
    ap.add_argument("--data", default="", help="JSON array of {label,value}")
    ap.add_argument("--unit", default="", help="Value unit suffix")
    ap.add_argument("--spec", help="JSON spec file (list of chart specs)")
    ap.add_argument("--slug", help="Explicit slug (use when target path is a temp file)")
    ap.add_argument("--out-dir", default="public/blog", help="Output dir")
    args = ap.parse_args()

    target = Path(args.target)
    if target.suffix in (".html", ".htm"):
        slug = args.slug or target.stem
        html_path = target
    else:
        slug = args.slug or (target.name if target.suffix else str(target))
        html_path = None

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.auto:
        if not html_path:
            html_path = Path("public/blog") / f"{slug}.html"
        if not html_path.exists():
            print(f"❌ Post not found: {html_path}", file=sys.stderr)
            return 1
        results = auto_generate(html_path, out_dir, slug)
        print(json.dumps({"slug": slug, "charts": results}, indent=2))
        print(f"\n✅ Generated {len(results)} visuals for {slug} → {out_dir}",
              file=sys.stderr)
        return 0

    if args.spec:
        specs = json.loads(Path(args.spec).read_text())
        for idx, spec in enumerate(specs, start=1):
            render_chart(spec, out_dir / f"{slug}-visual-{idx}.png")
        print(f"✅ Generated {len(specs)} visuals for {slug}")
        return 0

    # Single chart from CLI args
    spec = {
        "type": args.type or "bar",
        "title": args.title or "Benchmark",
        "data": json.loads(args.data or "[]"),
        "unit": args.unit,
        "source": "Source: benchmark data",
    }
    render_chart(spec, out_dir / f"{slug}-visual-1.png")
    print(f"✅ Generated {slug}-visual-1.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
