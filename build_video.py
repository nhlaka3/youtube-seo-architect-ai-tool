"""Fast narrated slideshow video for youtube-title-examples-2026.

Generates 8 title-card PNGs (Pillow) and assembles a narrated 1280x720 MP4
with ffmpeg (subtle zoom + fade per card, Kokoro am_michael narration).
Fallback for low-RAM WSL where the Remotion animated render is too slow.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")
CARDS = os.path.join(PROJ, "assets", "cards")
CLIPS = os.path.join(PROJ, "assets", "clips")
os.makedirs(CARDS, exist_ok=True)
os.makedirs(CLIPS, exist_ok=True)

W, H = 1280, 720
FPS = 30
BG = (15, 23, 42)          # #0F172A
FG = (226, 232, 240)       # slate-100
SUB = (148, 163, 184)      # slate-400
CYAN = (34, 211, 238)
GREEN = (52, 211, 153)
RED = (248, 113, 113)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# per-scene card content (mirrors build_storyboard.py SCENES)
CARDS_SPEC = {
    1: ("kicker", "YOUTUBE TITLES 2026", "The One Title Formula That Wins",
        "Number + Benefit + Timeframe · data from 10,427 titles", CYAN),
    2: ("callout", "WHY IT MATTERS", "A great title does 3 jobs",
        "Keyword placement for search. Curiosity for clicks. Accuracy for retention.", CYAN),
    3: ("card", "THE WINNING FORMULA", "Number + Benefit + Timeframe",
        "“5 Ways to Double Your YouTube Views in 30 Days”", CYAN),
    4: ("card", "THE DATA", "What actually works",
        "Numbers +36%  ·  Odd numbers beat even  ·  Front-load keyword +14%\n"
        "Specificity 2.3x  ·  Best length 40–60 characters", GREEN),
    5: ("card", "STEAL THESE", "3 more patterns",
        "Curiosity gaps  ·  Negative framing (+27%)\nYear-forward titles  ·  Honest questions", GREEN),
    6: ("card", "THE PROCESS", "The 6-step workflow",
        "Research → formula → 10 variations → 40–60 chars\n→ score → verify the promise", GREEN),
    7: ("callout", "WARNING", "The retention trap",
        "A 12% CTR that dies in 15s loses to a steady 6–8%.\nNever change a title that is actively ranking.", RED),
    8: ("stat", "TRY IT FREE", "Score your title free",
        "36% — numbers lift click-through rate.\n12 CTR signals · no credit card.", CYAN),
}


def font(size):
    return ImageFont.truetype(FONT, size)


def fontr(size):
    return ImageFont.truetype(FONT_REG, size)


def make_card(spec, path):
    kind, kicker, title, body, accent = spec
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # subtle top glow
    for i in range(60):
        alpha = int(22 * (1 - i / 60))
        d.rectangle([0, i, W, i + 1], fill=(
            BG[0] + (accent[0] - BG[0]) * alpha // 255 // 8,
            BG[1] + (accent[1] - BG[1]) * alpha // 255 // 8,
            BG[2] + (accent[2] - BG[2]) * alpha // 255 // 8,
        ))
    # accent underline
    d.rectangle([100, 190, 100 + 90, 194], fill=accent)
    # kicker
    d.text((100, 210), kicker, font=font(30), fill=accent)
    # title (wrapped)
    title_f = font(58)
    lines = _wrap(d, title, title_f, W - 200)
    y = 300
    for ln in lines:
        d.text((100, y), ln, font=title_f, fill=FG)
        y += 72
    # body
    body_f = fontr(34)
    by = y + 30
    for bl in body.split("\n"):
        d.text((100, by), bl, font=body_f, fill=SUB)
        by += 46
    img.save(path)


def _wrap(draw, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def main():
    timeline = json.load(open(os.path.join(PROJ, "timeline.json"), encoding="utf-8"))
    # build cards
    for scene in timeline:
        num = scene["scene"]
        make_card(CARDS_SPEC[num], os.path.join(CARDS, f"scene_{num:02d}.png"))
    print("cards built:", len(timeline))

    # per-scene clips
    total = 0.0
    n = len(timeline)
    with open(os.path.join(PROJ, "concat.txt"), "w") as cf:
        for i, s in enumerate(timeline):
            num = s["scene"]
            dur = s["audio_dur"]
            lead = 0.0 if i == 0 else 0.25
            tail = 1.0 if i == n - 1 else 0.35
            clip_dur = lead + dur + tail
            wav = os.path.join(PROJ, "narration", f"scene_{num:02d}.wav")
            out = os.path.join(CLIPS, f"clip_{num:02d}.mp4")
            frames = int(round(clip_dur * FPS))
            fade_out = max(0.2, clip_dur - 0.4)
            card = os.path.join(CARDS, f"scene_{num:02d}.png")
            # pad card up for smooth zoom, then zoompan to 1280x720
            vf = (
                f"scale=1600:900,"
                f"zoompan=z='min(zoom+0.0008,1.08)':d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
                f"format=yuv420p,"
                f"fade=t=in:st=0:d=0.3,fade=t=out:st={fade_out:.2f}:d=0.4"
            )
            cmd = [
                "ffmpeg", "-y", "-i", card, "-i", wav,
                "-filter_complex", f"[0:v]{vf}[v];[1:a]apad=pad_dur={clip_dur:.2f}[a]",
                "-map", "[v]", "-map", "[a]",
                "-t", f"{clip_dur:.2f}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-c:a", "aac", "-shortest", out,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            cf.write(f"file '{out}'\n")
            total += clip_dur
            print(f"clip {num:02d}: {clip_dur:.2f}s", flush=True)

    final = os.path.join(PROJ, "renders", "youtube-title-examples-2026.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", os.path.join(PROJ, "concat.txt"),
        "-c", "copy", final,
    ], check=True, capture_output=True)
    print(f"FINAL: {final}  total {total:.1f}s (~{total/60:.1f} min)")


if __name__ == "__main__":
    main()
