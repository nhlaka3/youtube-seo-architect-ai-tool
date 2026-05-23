#!/usr/bin/env python3
"""
Google TTS (gTTS) voiceover for manim-video.
Generates individual MP3 per scene segment, concatenates to one track,
then muxes with the 1080p60 video → final_with_audio_v2.mp4
"""

import os, re, subprocess, sys
from gtts import gTTS

# ── paths ─────────────────────────────────────────────────────────────────────
BASE       = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video"
SCENES_DIR = os.path.join(BASE, "media/videos/script/1080p60")
AUDIO_DIR  = os.path.join(BASE, "tts_audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

VIDEO  = os.path.join(BASE, "final.mp4")
OUTPUT = os.path.join(BASE, "final_with_audio_v2.mp4")

# ── pacing plan ───────────────────────────────────────────────────────────────
# (scene_ref, narration_text, tts_file, music_file)
SEGMENTS = [
    # Opening — 8 s
    ("Scene1_Opening",
     "YT SEO Architect — AI-powered YouTube SEO toolkit.",
     "seg01_opening.mp3"),

    # Problem — 8.5 s, two sentences
    ("Scene2_Problem",
     "Researching keywords, writing descriptions, optimizing tags — it takes hours. "
     "Adding titles, testing thumbnails, managing playlists — all by hand.",
     "seg02_problem.mp3"),

    # Dashboard — 8.5 s
    ("Scene3_Dashboard",
     "The dashboard brings all seventeen tools into one place. "
     "Keyword discovery, SEO audit, script generator, tag analyzer — it's all connected.",
     "seg03_dashboard.mp3"),

    # Keyword Discovery — 8.5 s
    ("Scene4_Keyword",
     "Keyword Discovery — AI finds high-opportunity, low-competition keywords "
     "for your niche, ranked by volume, competition, and search intent.",
     "seg04_keyword.mp3"),

    # SEO Audit — 5.8 s
    ("Scene5_Audit",
     "SEO Audit — paste any URL, get a full scorecard "
     "for title, description, tags, and thumbnail, with AI fix suggestions for each.",
     "seg05_audit.mp3"),

    # Script Generator — 6.4 s
    ("Scene6_Script",
     "Script Generator — give it a topic, get a structured script "
     "with hooks, talking points, and a call to action. Export it and start recording.",
     "seg06_script.mp3"),

    # CTA — 6.3 s
    ("Scene7_CTA",
     "Start free — 100 credits — no credit card required. "
     "That's enough to run hundreds of audits, generate scripts, and optimize your entire channel. "
     "youtube-seo-architect.vercel.app",
     "seg07_cta.mp3"),
]


def tts(text: str, path: str, lang="en"):
    """Generate gTTS MP3 at default rate."""
    print(f"  TTS: {text[:65]}...")
    t = gTTS(text=text, lang=lang, slow=False)
    t.save(path)


def to_wav(mp3: str, wav: str):
    """Convert MP3 → 22050 Hz mono 16-bit WAV (espeak-ng/compatible)."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", mp3, "-ar", "22050", "-ac", "1", wav],
        capture_output=True, text=True, check=True
    )


def pad_wav(wav: str, target_secs: float, out: str):
    """Pad or trim WAV to exact target duration."""
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", wav],
        capture_output=True, text=True
    )
    actual = float(r.stdout.strip())
    if actual >= target_secs:
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav,
             "-af", f"atrim=0:{target_secs}", "-c:a", "pcm_s16le", out],
            capture_output=True, text=True, check=True
        )
        print(f"     trimmed {actual:.2f}s → {target_secs:.0f}s")
    else:
        pad = target_secs - actual
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav,
             "-af", f"apad=pad_dur={pad:.3f}", "-c:a", "pcm_s16le", out],
            capture_output=True, text=True, check=True
        )
        print(f"     padded {actual:.2f}s → {target_secs:.0f}s (+{pad:.1f}s silence)")


# Target per-segment durations (match scene lengths)
DURATIONS = {
    "Scene1_Opening":  8.0,
    "Scene2_Problem":   8.5,
    "Scene3_Dashboard": 8.5,
    "Scene4_Keyword":   8.5,
    "Scene5_Audit":     5.8,
    "Scene6_Script":    6.4,
    "Scene7_CTA":       6.3,
}


# ── STEP 1: TTS per segment ───────────────────────────────────────────────────
print("\n[1/4] Generating TTS MP3 per segment...")
for scene, text, mp3_name in SEGMENTS:
    mp3 = os.path.join(AUDIO_DIR, mp3_name)
    tts(text, mp3)

# ── STEP 2: MP3 → WAV, pad/trim ──────────────────────────────────────────────
print("\n[2/4] Converting to WAV and padding to scene duration...")
padded_wavs = []
for scene, text, mp3_name in SEGMENTS:
    mp3  = os.path.join(AUDIO_DIR, mp3_name)
    wav  = os.path.join(AUDIO_DIR, mp3_name.replace(".mp3", ".wav"))
    pad  = os.path.join(AUDIO_DIR, mp3_name.replace(".mp3", "_padded.wav"))
    to_wav(mp3, wav)
    pad_wav(wav, DURATIONS[scene], pad)
    padded_wavs.append(pad)

# ── STEP 3: Concat all padded WAVs → one track ───────────────────────────────
print("\n[3/4] Concatenating audio track...")
concat_txt = os.path.join(AUDIO_DIR, "concat.txt")
with open(concat_txt, "w") as f:
    for w in padded_wavs:
        f.write(f"file '{w}'\n")

final_wav = os.path.join(AUDIO_DIR, "full_track.wav")
r = subprocess.run(
    ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
     "-i", concat_txt, "-c:a", "pcm_s16le", final_wav],
    capture_output=True, text=True, check=True
)
r2 = subprocess.run(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
     "-of", "default=noprint_wrappers=1:nokey=1", final_wav],
    capture_output=True, text=True
)
print(f"  full_track.wav: {float(r2.stdout.strip()):.1f}s")

# ── STEP 4: Mux with H.264 video ─────────────────────────────────────────────
print("\n[4/4] Muxing audio into video...")
r3 = subprocess.run(
    ["ffmpeg", "-y",
     "-i", VIDEO,
     "-i", final_wav,
     "-filter_complex", "[1:a]volume=1.8,atrim=0:52[a]",
     "-map", "0:v", "-map", "[a]",
     "-c:v", "copy",
     "-c:a", "aac", "-b:a", "192k",
     "-shortest",
     "-movflags", "+faststart",
     OUTPUT],
    capture_output=True, text=True, check=True
)

sz  = os.path.getsize(OUTPUT) / 1024 / 1024
r4  = subprocess.run(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
     "-of", "default=noprint_wrappers=1:nokey=1", OUTPUT],
    capture_output=True, text=True
)
print(f"  ✓ {OUTPUT}")
print(f"    {float(r4.stdout.strip()):.1f}s  {sz:.1f} MB")
