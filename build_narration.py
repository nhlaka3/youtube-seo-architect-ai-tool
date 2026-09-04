"""Generate kokoro am_michael narration for youtube-title-examples-2026.

Per-scene wavs + timeline.json + full concatenated track staged in the
composer's public dir. Mirrors projects/youtube-title-formulas-2026/build_narration.py
and drives the project's kokoro_tts tool via the registry (voice am_michael).
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
sys.path.insert(0, BASE)
from tools.tool_registry import registry  # noqa: E402

SR = 24000
GAP = 0.4
TARGET_NARRATION = 360.0

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "script.txt")
NARR_DIR = os.path.join(HERE, "narration")
os.makedirs(NARR_DIR, exist_ok=True)


def re_match_scene(line):
    return re.match(r"SCENE\s+(\d+)\s*\|\s*(\w+)", line)


# ---- parse script ----
scenes = []
cur = None
for line in open(SCRIPT, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    m = re_match_scene(line)
    if m:
        cur = {"num": int(m.group(1)), "type": m.group(2), "text": ""}
        scenes.append(cur)
    elif cur is not None:
        cur["text"] += (" " if cur["text"] else "") + line
texts = [s["text"].strip() for s in scenes]
print(f"parsed {len(scenes)} scenes", flush=True)

registry.discover()
tts = registry._tools["kokoro_tts"]


def synth_all(speed):
    audios, durs = [], []
    for i, t in enumerate(texts, 1):
        out = os.path.join(NARR_DIR, f"scene_{i:02d}.wav")
        res = tts.execute({
            "text": t,
            "voice": "am_michael",
            "speed": speed,
            "output_path": out,
        })
        if not res.success:
            raise RuntimeError(f"kokoro_tts failed scene {i}: {res.error}")
        data, sr = sf.read(out, dtype="float32")
        d = len(data) / sr
        audios.append(data)
        durs.append(d)
        print(f"  scene {i:02d} @{speed:.3f}: {d:.2f}s", flush=True)
    return audios, durs


start_speed = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
audios, durs = synth_all(start_speed)
total = sum(durs)
print(f"total @{start_speed:.3f} = {total:.2f}s", flush=True)

# auto-tune speed toward target (reuse the prior project's linear correction)
if not (TARGET_NARRATION - 6.0 <= total <= TARGET_NARRATION + 6.0):
    adj = (total - TARGET_NARRATION) / 112.0
    s2 = max(0.9, min(1.3, start_speed + adj))
    print(f"correcting speed {start_speed:.3f} -> {s2:.3f}", flush=True)
    audios, durs = synth_all(s2)
    total = sum(durs)
    print(f"total @{s2:.3f} = {total:.2f}s", flush=True)

timeline = []
for i, (s, a, d) in enumerate(zip(scenes, audios, durs), 1):
    sf.write(os.path.join(NARR_DIR, f"scene_{i:02d}.wav"), a, SR)
    timeline.append({"scene": s["num"], "type": s["type"], "audio_dur": round(d, 3)})

with open(os.path.join(HERE, "timeline.json"), "w", encoding="utf-8") as f:
    json.dump(timeline, f, indent=2)
print(f"narration total: {sum(durs):.2f}s -> timeline.json", flush=True)

silence = np.zeros(int(SR * GAP), dtype=np.float32)
parts = []
for i, a in enumerate(audios):
    if i:
        parts.append(silence)
    parts.append(a)
full = np.concatenate(parts)
pub = os.path.join(BASE, "remotion-composer", "public", "narration")
os.makedirs(pub, exist_ok=True)
out = os.path.join(pub, "youtube-title-examples-2026.wav")
sf.write(out, full, SR)
print(f"full track: {len(full)/SR:.2f}s -> {out}", flush=True)