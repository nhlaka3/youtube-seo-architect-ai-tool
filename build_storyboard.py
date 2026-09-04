"""Build storyboard.json for youtube-title-examples-2026 (framework-first, 8 cuts)."""
import json
import os

PROJ = os.path.dirname(os.path.abspath(__file__))
GAP = 0.4  # must match build_narration.py

with open(os.path.join(PROJ, "timeline.json"), encoding="utf-8") as f:
    timeline = json.load(f)

BG = "#0F172A"
CYAN = "#22d3ee"
GREEN = "#34d399"
VIOLET = "#a78bfa"
PINK = "#f472b6"
AMBER = "#fbbf24"
RED = "#ef4444"

# scene num -> visual definition (proven cut types/fields from SCENE_TYPES.md)
SCENES = {
    1: {
        "type": "hero_title",
        "text": "The One Title Formula That Wins",
        "subtitle": "Number + Benefit + Timeframe · data from 10,427 titles",
        "accentColor": CYAN,
        "backgroundColor": BG,
    },
    2: {
        "type": "callout",
        "callout_type": "info",
        "title": "A great title does 3 jobs",
        "text": "Keyword placement for search. Curiosity for clicks. Accuracy for retention.",
        "accentColor": CYAN,
        "backgroundColor": BG,
    },
    3: {
        "type": "text_card",
        "text": "Number + Benefit + Timeframe",
        "subtitle": "\"5 Ways to Double Your YouTube Views in 30 Days\"",
        "fontSize": 52,
        "accentColor": CYAN,
        "backgroundColor": BG,
    },
    4: {
        "type": "kpi_grid",
        "title": "The data says",
        "columns": 3,
        "chartColors": [CYAN, GREEN, VIOLET, AMBER, PINK],
        "chartData": [
            {"label": "Numbers lift CTR", "value": "+36%", "icon": "🔢"},
            {"label": "Odd numbers best", "value": "11 > 10", "icon": "7️⃣"},
            {"label": "Front-loaded keyword", "value": "+14%", "icon": "🔤"},
            {"label": "Specificity", "value": "2.3x", "icon": "🎯"},
            {"label": "Best length", "value": "40-60", "icon": "📏"},
            {"label": "Honest curiosity", "value": "+18%", "icon": "❓"},
        ],
        "backgroundColor": BG,
    },
    5: {
        "type": "text_card",
        "text": "3 more patterns to steal",
        "subtitle": "Curiosity gaps · Negative framing (+27%) · Direct how-to",
        "fontSize": 48,
        "accentColor": GREEN,
        "backgroundColor": BG,
    },
    6: {
        "type": "text_card",
        "text": "The 6-step workflow",
        "subtitle": "Research → formula → 10 variations → 40-60 chars → score → verify the promise",
        "fontSize": 44,
        "accentColor": GREEN,
        "backgroundColor": BG,
    },
    7: {
        "type": "callout",
        "callout_type": "warning",
        "title": "The retention trap",
        "text": "A 12% CTR that dies in 15s loses to a steady 6-8%. Never change a title that is actively ranking.",
        "accentColor": RED,
        "backgroundColor": BG,
    },
    8: {
        "type": "stat_card",
        "stat": "36%",
        "subtitle": "Numbers lift click-through rate. Score your next title free — 12 CTR signals · no credit card.",
        "accentColor": CYAN,
        "backgroundColor": BG,
    },
}

# ---- compute cut boundaries from narration durations ----
cuts = []
t = 0.0
for i, item in enumerate(timeline):
    num = item["scene"]
    dur = item["audio_dur"]
    lead = 0.0 if i == 0 else 0.25   # visual appears just before the voice
    tail = 1.0 if i == len(timeline) - 1 else 0.35
    start = max(0.0, t - lead)
    end = t + dur + tail
    cut = {
        "id": f"scene-{num:02d}",
        "source": "",
        "type": SCENES[num]["type"],
        "in_seconds": round(start, 2),
        "out_seconds": round(end, 2),
        "backgroundColor": BG,
        **{k: v for k, v in SCENES[num].items() if k not in ("type", "backgroundColor")},
    }
    cuts.append(cut)
    t = t + dur + GAP

# ---- overlays ----
t8 = next(c["in_seconds"] for c in cuts if c["id"] == "scene-08")
overlays = [
    {
        "type": "section_title",
        "in_seconds": round(cuts[0]["in_seconds"], 2),
        "out_seconds": round(cuts[0]["out_seconds"], 2),
        "text": "YT SEO ARCHITECT",
        "subtitle": "The title framework that wins",
        "accentColor": CYAN,
    },
    {
        "type": "stat_reveal",
        "in_seconds": round(t8 + 0.6, 2),
        "out_seconds": round(t8 + 7.0, 2),
        "text": "Free forever",
        "subtitle": "title analyzer · no credit card",
        "accentColor": CYAN,
        "position": "bottom-right",
    },
]

storyboard = {
    "theme": "flat-motion-graphics",
    "cuts": cuts,
    "overlays": overlays,
    "captions": [],
    "audio": {"narration": {"src": "narration/youtube-title-examples-2026.wav", "volume": 1}},
}

last = cuts[-1]["out_seconds"]
print(f"video length: {last + 1:.2f}s (~{(last + 1) / 60:.1f} min)")
for c in cuts:
    print(f"  {c['id']} {c['type']:<12} {c['in_seconds']:7.2f} -> {c['out_seconds']:7.2f}")

with open(os.path.join(PROJ, "storyboard.json"), "w", encoding="utf-8") as f:
    json.dump(storyboard, f, indent=2)
print("wrote storyboard.json")