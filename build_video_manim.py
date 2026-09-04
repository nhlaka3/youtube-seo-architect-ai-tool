"""Final assembly: 8 manim clips + narration + ducked music, -14 LUFS.

Per-scene: manim visual + narration (offset by lead) -> clip.
Concat -> base; then loop royalty-free music under narration, normalize
to YouTube loudness (-14 LUFS), and mux.
"""
import json
import os
import subprocess

BASE = os.path.join(os.path.expanduser("~"), "OpenMontage")
PROJ = os.path.join(BASE, "projects", "youtube-title-examples-2026")
CLIPS = os.path.join(PROJ, "assets", "clips")
MANIM = os.path.join(PROJ, "assets", "manim_media", "videos", "manim_scenes", "720p30")
MUSIC = os.path.join(PROJ, "assets", "music", "ambient.mp3")
os.makedirs(CLIPS, exist_ok=True)

FPS = 30


def build_clip(num, i, n, item):
    dur = item["audio_dur"]
    lead = 0.0 if i == 0 else 0.25
    tail = 1.0 if i == n - 1 else 0.35
    clip_dur = lead + dur + tail
    wav = os.path.join(PROJ, "narration", f"scene_{num:02d}.wav")
    src = os.path.join(MANIM, f"scene_{num:02d}_manim.mp4")
    out = os.path.join(CLIPS, f"clip_{num:02d}.mp4")
    delay = int(round(lead * 1000))
    vf = f"[1:a]adelay={delay}|{delay},apad=pad_dur={clip_dur:.2f}[a]"
    cmd = [
        "ffmpeg", "-y", "-i", src, "-i", wav,
        "-filter_complex", vf,
        "-map", "0:v", "-map", "[a]",
        "-t", f"{clip_dur:.2f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-shortest", out,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return clip_dur, out


def main():
    timeline = json.load(open(os.path.join(PROJ, "timeline.json"), encoding="utf-8"))
    n = len(timeline)
    total = 0.0
    with open(os.path.join(PROJ, "concat.txt"), "w") as cf:
        for i, item in enumerate(timeline):
            num = item["scene"]
            cd, out = build_clip(num, i, n, item)
            cf.write(f"file '{out}'\n")
            total += cd
            print(f"clip {num:02d}: {cd:.2f}s", flush=True)

    base = os.path.join(PROJ, "assets", "base_no_music.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", os.path.join(PROJ, "concat.txt"), "-c", "copy", base,
    ], check=True, capture_output=True)
    print(f"base concat: {total:.1f}s", flush=True)

    # loop music under narration, fade edges, loudnorm to -14 LUFS
    final = os.path.join(PROJ, "renders", "youtube-title-examples-2026.mp4")
    fc = (
        "[1:a]aformat=sample_rates=44100:channel_layouts=stereo[narr];"
        f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.14,"
        f"afade=t=in:st=0:d=1,afade=t=out:st={max(1.0,total-1.2):.2f}:d=1.2[mus];"
        "[mus][narr]amix=inputs=2:duration=first:dropout_transition=0,"
        "alimiter=limit=0.97,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-stream_loop", "-1", "-i", MUSIC, "-i", base,
        "-filter_complex", fc, "-map", "1:v", "-map", "[a]",
        "-t", f"{total:.2f}", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final,
    ], check=True, capture_output=True)
    print(f"FINAL: {final}  {total:.1f}s (~{total/60:.1f} min)")


if __name__ == "__main__":
    main()
