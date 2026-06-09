#!/usr/bin/env python3
"""Assemble an episode video from generated slide PNGs + optional voiceover.

Usage:
  python assemble.py --plan manim-video/episode_plans/episode_01.json --mode longform
  python assemble.py --plan manim-video/episode_plans/episode_01.json --mode shorts

Behavior:
- Reads slide list + durations from the episode plan JSON.
- Creates per-slide clips (image loop + fade-in) then concatenates via ffmpeg.
- If voiceover audio exists at:
    manim-video/audio/episode_{NN}_{mode}.mp3
  it muxes it in; otherwise produces video-only.
"""

import argparse
import json
import os
import subprocess

BASE = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video"
SLIDES_DIR = os.path.join(BASE, "slides")
OUT_DIR = os.path.join(BASE, "output")
AUDIO_DIR = os.path.join(BASE, "audio")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)


def ffmpeg_run(cmd: list[str]):
    subprocess.run(cmd, capture_output=True, text=True, check=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True, help="Path to episode plan JSON")
    ap.add_argument("--mode", required=True, choices=["longform", "shorts"], help="Which slide set")
    args = ap.parse_args()

    with open(args.plan, "r", encoding="utf-8") as f:
        plan = json.load(f)

    episode_number = int(plan["episodeNumber"])
    slides = plan[args.mode]["slides"]

    print(f"Assembling episode {episode_number} ({args.mode}) with {len(slides)} slides")

    # Step 1: Create slide clips
    clip_files: list[str] = []
    for i, slide_obj in enumerate(slides):
        slide = slide_obj["filename"]
        dur = float(slide_obj["durationSec"])
        slide_path = os.path.join(SLIDES_DIR, slide)

        clip_file = os.path.join(OUT_DIR, f"{episode_number:02d}_{args.mode}_clip_{i:02d}.mp4")
        clip_files.append(clip_file)

        if os.path.exists(clip_file):
            continue

        if not os.path.exists(slide_path):
            # If renderer fell back to text placeholders, skip image clip creation.
            print(f"WARNING: missing slide image: {slide_path}. Skipping clip {i}.")
            continue

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", slide_path,
            "-c:v", "libx264",
            "-t", str(dur),
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-vf", "fade=in:0:30",
            clip_file,
        ]
        ffmpeg_run(cmd)
        print(f"  clip {i+1}/{len(slides)}: {os.path.basename(clip_file)} ({dur:.1f}s)")

    # Step 2: Concatenate
    concat_file = os.path.join(OUT_DIR, f"{episode_number:02d}_{args.mode}_concat.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for cf in clip_files:
            if os.path.exists(cf):
                f.write(f"file '{cf}'\n")

    video_only = os.path.join(OUT_DIR, f"{episode_number:02d}_{args.mode}_video_only.mp4")

    # If we skipped all clips (e.g., placeholders only), stop early.
    existing_clips = [p for p in clip_files if os.path.exists(p)]
    if not existing_clips:
        print("No slide clips were created (missing ffmpeg inputs). Skipping concat.")
        final = video_only
        if os.path.exists(final):
            size_mb = os.path.getsize(final) / (1024 * 1024)
            print(f"Output: {final} ({size_mb:.1f} MB)")
        return

    cmd_concat = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        video_only,
    ]
    ffmpeg_run(cmd_concat)
    print("Video-only track created.")

    # Step 3: Mux audio (optional)
    voiceover = os.path.join(AUDIO_DIR, f"episode_{episode_number:02d}_{args.mode}.mp3")
    final = os.path.join(OUT_DIR, f"episode_{episode_number:02d}_{args.mode}.mp4")

    if os.path.exists(voiceover):
        print(f"Muxing with voiceover: {voiceover}")
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", video_only,
            "-i", voiceover,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-shortest",
            "-map", "0:v:0",
            "-map", "1:a:0",
            final,
        ]
        ffmpeg_run(cmd_mux)
        print(f"Final video created: {final}")
    else:
        print(f"No voiceover found at {voiceover}. Producing video-only output: {video_only}")
        final = video_only

    if os.path.exists(final):
        size_mb = os.path.getsize(final) / (1024 * 1024)
        print(f"Output: {final} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
