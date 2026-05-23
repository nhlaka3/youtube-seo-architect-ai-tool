#!/usr/bin/env python3
"""Assemble the YT SEO Architect explainer video from slides + voiceover."""
import subprocess, os

BASE = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video"
SLIDES = os.path.join(BASE, "slides")
OUT = os.path.join(BASE, "output")
os.makedirs(OUT, exist_ok=True)

# Slide durations matched to audio segments (in seconds)
slide_durations = [
    ("01_problem.png", 16.54),
    ("02_competitor.png", 10.54),
    ("03_truth.png", 20.09),
    ("04_intro.png", 21.03),
    ("05_steps.png", 19.37),
    ("06_keywords.png", 23.09),
    ("07_audit.png", 24.44),
    ("08_pro_tools.png", 16.71),
    ("09_pricing_free.png", 19.04),
    ("10_pricing_pro.png", 16.90),
    ("11_pricing_agency.png", 12.46),
    ("12_cta.png", 17.67),
]

VOICEOVER = os.path.join(BASE, "voiceover.mp3")

# Step 1: Create video clips for each slide
print("Creating slide video clips...")
clip_files = []
for i, (slide, dur) in enumerate(slide_durations):
    slide_path = os.path.join(SLIDES, slide)
    clip_file = os.path.join(OUT, f"clip_{i:02d}.mp4")
    clip_files.append(clip_file)
    
    if not os.path.exists(clip_file):
        # Create a video from the image with fade-in effect
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", slide_path,
            "-c:v", "libx264", "-t", str(dur),
            "-pix_fmt", "yuv420p", "-r", "30",
            "-vf", f"fade=in:0:30",  # 1 second fade in
            clip_file
        ]
        subprocess.run(cmd, capture_output=True)
        print(f"  clip_{i:02d}.mp4 ({dur:.1f}s)")

# Step 2: Create concat file
concat_file = os.path.join(OUT, "concat.txt")
with open(concat_file, "w") as f:
    for cf in clip_files:
        f.write(f"file '{cf}'\n")

# Step 3: Concatenate all clips with transitions
print("Concatenating clips...")
video_only = os.path.join(OUT, "video_only.mp4")
cmd_concat = [
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0", "-i", concat_file,
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    video_only
]
subprocess.run(cmd_concat, capture_output=True)
print("Video-only track created.")

# Step 4: Mux video with audio
print("Muxing with voiceover...")
final = os.path.join(BASE, "yt-seo-architect-explainer.mp4")
cmd_mux = [
    "ffmpeg", "-y",
    "-i", video_only,
    "-i", VOICEOVER,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    "-map", "0:v:0", "-map", "1:a:0",
    final
]
result = subprocess.run(cmd_mux, capture_output=True, text=True)
print(result.stderr[-500:] if result.stderr else "OK")

# Check final file
if os.path.exists(final):
    size_mb = os.path.getsize(final) / (1024*1024)
    print(f"\nFinal video: {final}")
    print(f"Size: {size_mb:.1f} MB")
    
    # Get duration
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", 
                           "-of", "json", final], capture_output=True, text=True)
    import json
    dur = float(json.loads(probe.stdout)["format"]["duration"])
    print(f"Duration: {dur:.1f}s ({dur/60:.1f} min)")
else:
    print("ERROR: Final video not created!")
    print(result.stderr)
