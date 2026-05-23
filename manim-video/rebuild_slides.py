"""Rebuild slides with presenter avatar composited in corner."""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video"
SLIDES = os.path.join(BASE, "slides")
os.makedirs(SLIDES, exist_ok=True)

W, H = 1920, 1080
BG = "#0F0F1A"
ACCENT = "#58C4DD"
YELLOW = "#FFD93D"
WHITE = "#FFFFFF"
DIM = "#888899"

# Load fonts
title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
hilight_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 44)
label_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)

# Load presenter avatar
avatar = Image.open(os.path.join(SLIDES, "presenter_avatar.png")).convert("RGBA")
# Resize to fit corner nicely
avatar = avatar.resize((280, 280), Image.LANCZOS)

def create_slide(filename, title, subtitle=None, bullets=None, highlight=None, footer=None):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = 140
    
    # Title
    if title:
        draw.text((120, y), title, fill=ACCENT, font=title_font)
        y += 100
    
    if subtitle:
        draw.text((120, y), subtitle, fill=DIM, font=body_font)
        y += 60
    
    if highlight:
        y += 30
        margin = 120
        box_h = 85
        draw.rounded_rectangle([margin, y, W-margin, y+box_h], radius=15, fill="#1A1A30", outline=ACCENT, width=3)
        tw = draw.textlength(highlight, font=hilight_font)
        draw.text(((W - tw)//2, y + 20), highlight, fill=YELLOW, font=hilight_font)
        y += box_h + 30
    
    if bullets:
        y += 20
        for bullet in bullets:
            draw.text((160, y), f"▸  {bullet}", fill=WHITE, font=body_font)
            y += 56
    
    # Presenter avatar in bottom-right corner
    avatar_x = W - 340
    avatar_y = H - 340
    
    # Subtle background circle behind avatar
    draw.ellipse([avatar_x-10, avatar_y-10, avatar_x+290, avatar_y+290], fill="#1E1E35", outline="#3A3A55", width=2)
    
    # Paste avatar
    img.paste(avatar, (avatar_x, avatar_y), avatar)
    
    # "Presented by" label
    label = "Presented by"
    lw = draw.textlength(label, font=label_font)
    draw.text((avatar_x + 140 - lw//2, avatar_y + 300), label, fill=DIM, font=label_font)
    
    if footer:
        fw = draw.textlength(footer, font=small_font)
        draw.text(((W - fw)//2, H-70), footer, fill=DIM, font=small_font)
    
    img.save(os.path.join(SLIDES, filename))
    print(f"Created {filename}")

# === SCENE 1: PROBLEM ===
create_slide("01_problem.png", "Your Videos Deserve More Views",
    subtitle="You spent hours filming, editing, picking the perfect thumbnail...",
    bullets=["Uploaded. Waited.", "Two hundred views. Maybe three hundred if you're lucky."],
    highlight="Sound Familiar?")

create_slide("02_competitor.png", "Meanwhile...",
    bullets=["That other creator? 50,000 views.", "Same topic. Same niche.", "Their video isn't even better than yours."],
    highlight="What's the Difference?")

create_slide("03_truth.png", "The Algorithm Wants More",
    bullets=["Keywords the audience is actually searching for", "Optimized tags and descriptions", "Metadata that feeds the ranking engine"],
    highlight="You're Skipping the SEO. They Aren't.")

# === SCENE 2: SOLUTION ===
create_slide("04_intro.png", "YT SEO Architect",
    subtitle="Your YouTube channel's search command center",
    bullets=["17 AI-powered tools  |  One dashboard  |  No spreadsheets. No guesswork."],
    highlight="Stop Doing SEO by Hand")

create_slide("05_steps.png", "How It Works — 3 Simple Steps",
    bullets=["1.  Connect your channel — 10 seconds, same Google sign-in", "2.  Pick what you want to optimize", "3.  AI does the work. You hit Apply."],
    highlight="Back to Making Videos.  That Simple.")

# === SCENE 3: FEATURES ===
create_slide("06_keywords.png", "Keyword Discovery",
    subtitle="AI finds the exact long-tail keywords your audience searches for",
    bullets=["Search volume + competition level + intent — all laid out", "Not the broad, impossible-to-rank keywords", "The specific ones where YOU can actually rank"],
    highlight="100 Free Credits — Just Sign Up")

create_slide("07_audit.png", "SEO Audit Tool",
    subtitle="Paste any YouTube URL. Full scorecard in under 30 seconds.",
    bullets=["Title score  +  Description  +  Tags  +  Thumbnail — all graded", "AI-generated fix suggestions", "Prioritized: High → Medium → Low impact"],
    highlight="Know Exactly What's Holding You Back")

create_slide("08_pro_tools.png", "Pro & Agency Tools",
    subtitle="For creators who take growth seriously",
    bullets=["Script Generator — AI writes your video scripts from scratch", "Thumbnail Lab — Analyze CTR before you publish", "Competitor Sniper — Reverse-engineer what's working for them"],
    highlight="Bulk Injector: Update Your Entire Catalog in One Click")

# === SCENE 4: PRICING & CTA ===
create_slide("09_pricing_free.png", "Start Completely Free",
    bullets=["100 free credits — no credit card required, ever", "Keyword Discovery + SEO Audit + Thumbnail Lab", "AI Coach — your personal YouTube growth strategist"],
    highlight="Try Everything Before You Spend $0")

create_slide("10_pricing_pro.png", "Pro Plan — $5 per Month",
    subtitle="That's less than one coffee shop run",
    bullets=["1,000 credits per month", "Script Generator + Competitor Sniper + Bulk Injector", "Retention Re-Orderer + Script-to-Shorts", "Saves 3–5 hours of SEO work for every single video"],
    highlight="Full Toolkit — Just $5/month")

create_slide("11_pricing_agency.png", "Agency Plan — $19 per Month",
    bullets=["Unlimited credits  |  Multi-channel support", "AI Auto-Responder  |  Full automation pipeline"],
    highlight="Built for Agencies & Power Creators")

create_slide("12_cta.png", "Stop Guessing. Start Growing.",
    subtitle="Let AI handle your YouTube SEO while you focus on making great videos.",
    bullets=["yt-seo-architect.vercel.app", "Start Free — 100 Credits.  No Credit Card."],
    highlight="I'll See You on the Trending Page!",
    footer="YT SEO Architect")

print("\nAll 12 slides rebuilt with presenter!")
