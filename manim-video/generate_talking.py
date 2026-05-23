"""Generate talking presenter video — pipes frames directly to ffmpeg, no disk I/O."""
import subprocess, os, re, struct
from PIL import Image

BASE = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video"
SLIDES = os.path.join(BASE, "slides")
OUT = os.path.join(BASE, "output")

# Load mouth variants (resize to 280x280 for corner placement)
SIZE = 280
variants = {}
for name in ["closed", "slight", "open", "wide"]:
    img = Image.open(os.path.join(SLIDES, f"presenter_{name}.png")).convert("RGBA")
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    variants[name] = img

# Read audio levels
levels = []
with open("/tmp/audio_levels.txt") as f:
    for line in f:
        if "RMS_level=" in line:
            val = line.split("RMS_level=")[1].strip()
            if val == "-inf" or val == "-":
                levels.append(-100.0)
            else:
                try:
                    levels.append(float(val))
                except ValueError:
                    levels.append(-100.0)

def level_to_mouth(db):
    if db < -50: return "closed"
    if db < -38: return "slight"
    if db < -28: return "open"
    return "wide"

fps = 25
total_seconds = 217.8
total_frames = int(total_seconds * fps)
frame_interval = max(1, len(levels) // total_frames)

print(f"Piping {total_frames} frames to ffmpeg...")

# Pipe raw RGBA frames to ffmpeg
proc = subprocess.Popen([
    "ffmpeg", "-y",
    "-f", "rawvideo", "-vcodec", "rawvideo",
    "-s", f"{SIZE}x{SIZE}", "-pix_fmt", "rgba",
    "-r", str(fps), "-i", "pipe:0",
    "-c:v", "libx264", "-pix_fmt", "yuva420p",
    "-preset", "fast", "-crf", "23",
    os.path.join(OUT, "talking_presenter.mp4")
], stdin=subprocess.PIPE)

for i in range(total_frames):
    idx = min(i * frame_interval, len(levels) - 1)
    mouth = level_to_mouth(levels[idx])
    frame = variants[mouth]
    proc.stdin.write(frame.tobytes())
    
    if i % 1000 == 0:
        print(f"  Frame {i}/{total_frames}")

proc.stdin.close()
proc.wait()

print(f"Done! Talking presenter: {os.path.join(OUT, 'talking_presenter.mp4')}")
print(f"Size: {os.path.getsize(os.path.join(OUT, 'talking_presenter.mp4'))} bytes")
