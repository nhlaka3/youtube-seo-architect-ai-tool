"""Generate .srt captions + YouTube chapter list from narration timing.

Sentence-level captions are timed proportionally across each scene's
narration window in the final video.
"""
import json
import os
import re

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")

timeline = json.load(open(os.path.join(PROJ, "timeline.json"), encoding="utf-8"))
scenes = []
cur = None
for line in open(os.path.join(PROJ, "script.txt"), encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    m = re.match(r"SCENE\s+(\d+)\s*\|\s*(\w+)", line)
    if m:
        cur = {"num": int(m.group(1)), "type": m.group(2), "text": ""}
        scenes.append(cur)
    elif cur is not None:
        cur["text"] += (" " if cur["text"] else "") + line
by_num = {s["num"]: s for s in scenes}

CHAPTERS = {
    1: "The formula that wins",
    2: "What a great title does",
    3: "Number + Benefit + Timeframe",
    4: "What the data says",
    5: "3 more patterns",
    6: "The 6-step workflow",
    7: "CTR vs retention",
    8: "Try it free",
}

# cumulative clip starts
clips = []
t = 0.0
for i, s in enumerate(timeline):
    num = s["scene"]
    lead = 0.0 if i == 0 else 0.25
    tail = 1.0 if i == len(timeline) - 1 else 0.35
    clip_dur = lead + s["audio_dur"] + tail
    clips.append({"num": num, "lead": lead, "dur": s["audio_dur"], "start": t, "clip_dur": clip_dur})
    t += clip_dur


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def mmss(sec):
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m}:{s:02d}"


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


entries = []
for c in clips:
    text = by_num[c["num"]]["text"]
    sents = split_sentences(text)
    if not sents:
        continue
    w0 = c["start"] + c["lead"]
    total_chars = sum(len(s) for s in sents)
    acc = 0.0
    for sent in sents:
        frac = len(sent) / total_chars
        seg = frac * c["dur"]
        start = w0 + acc
        end = start + seg
        entries.append((start, end, sent))
        acc += seg

srt = []
for i, (s, e, txt) in enumerate(entries, 1):
    srt.append(f"{i}\n{ts(s)} --> {ts(e)}\n{txt}\n")
with open(os.path.join(PROJ, "captions.srt"), "w", encoding="utf-8") as f:
    f.write("\n".join(srt))
print(f"wrote captions.srt ({len(entries)} entries)")

ch = []
for c in clips:
    ch.append(f"{mmss(c['start'])}  {CHAPTERS[c['num']]}")
with open(os.path.join(PROJ, "chapters.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(ch))
print("wrote chapters.txt")
