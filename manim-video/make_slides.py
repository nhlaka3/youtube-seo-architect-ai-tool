from PIL import Image, ImageDraw, ImageFont
import os

output_dir = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/manim-video/slides"
os.makedirs(output_dir, exist_ok=True)

W, H = 1920, 1080
BG = "#0F0F1A"
ACCENT = "#58C4DD"
YELLOW = "#FFD93D"
WHITE = "#FFFFFF"
DIM = "#888899"

title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
hilight_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)

def create_slide(filename, title, subtitle=None, bullets=None, footer=None, highlight=None):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    y = 160
    
    if title:
        draw.text((120, y), title, fill=ACCENT, font=title_font)
        y += 100
    
    if subtitle:
        draw.text((120, y), subtitle, fill=DIM, font=body_font)
        y += 60
    
    if highlight:
        y += 30
        margin = 120
        box_h = 90
        draw.rounded_rectangle([margin, y, W-margin, y+box_h], radius=15, fill="#1A1A30", outline=ACCENT, width=3)
        tw = draw.textlength(highlight, font=hilight_font)
        draw.text(((W - tw)//2, y + 20), highlight, fill=YELLOW, font=hilight_font)
        y += box_h + 30
    
    if bullets:
        y += 20
        for bullet in bullets:
            draw.text((160, y), f"▸ {bullet}", fill=WHITE, font=body_font)
            y += 58
    
    if footer:
        fw = draw.textlength(footer, font=small_font)
        draw.text(((W - fw)//2, H-80), footer, fill=DIM, font=small_font)
    
    img.save(os.path.join(output_dir, filename))
    print(f"Created {filename}")

create_slide("01_problem.png", "Your Videos Deserve", "You spent hours filming, editing, picking the perfect thumbnail...",
    bullets=["Uploaded. Waited.", "Two hundred views.", "Maybe three hundred if you're lucky."],
    highlight="Sound Familiar?")

create_slide("02_competitor.png", "Meanwhile...",
    bullets=["That other creator? 50,000 views.", "Same topic. Same niche.", "Their video isn't even better than yours."],
    highlight="What's the Difference?")

create_slide("03_truth.png", "The Algorithm Wants",
    bullets=["Keywords the audience is searching for", "Optimized tags and descriptions", "Metadata that feeds the ranking engine"],
    highlight="You're Skipping the SEO. They Aren't.")

create_slide("04_intro.png", "YT SEO Architect",
    subtitle="Your YouTube channel's search command center",
    bullets=["17 AI-powered tools    |    One dashboard    |    No spreadsheets. No guesswork."],
    highlight="Stop Doing SEO by Hand",
    footer="yt-seo-architect.vercel.app")

create_slide("05_steps.png", "How It Works",
    bullets=["(1)  Connect your channel — 10 seconds, same Google sign-in", "(2)  Pick what you want to optimize", "(3)  AI does the work. You hit Apply."],
    highlight="Back to Making Videos.")

create_slide("06_keywords.png", "Keyword Discovery",
    subtitle="AI finds the exact long-tail keywords your audience searches for",
    bullets=["Search volume + competition level + intent — all laid out", "Not the broad, impossible-to-rank keywords", "The specific ones where you can actually rank"],
    highlight="100 Free Credits — Just Sign Up")

create_slide("07_audit.png", "SEO Audit Tool",
    subtitle="Paste any YouTube URL. Get a full scorecard in 30 seconds.",
    bullets=["Title score + Description + Tags + Thumbnail", "AI-generated fix suggestions", "Prioritized: High to Medium to Low impact"],
    highlight="Know What's Holding You Back")

create_slide("08_pro_tools.png", "Pro & Agency Tools",
    subtitle="For creators who take growth seriously",
    bullets=["Script Generator — AI writes your video scripts", "Thumbnail Lab — Analyze before you publish", "Competitor Sniper — Reverse-engineer what works"],
    highlight="Bulk Injector: Update Your Entire Catalog")

create_slide("09_pricing_free.png", "Start Free",
    bullets=["100 free credits", "Keyword Discovery + SEO Audit + Thumbnail Lab", "AI Coach — your personal growth strategist"],
    highlight="No Credit Card Required. Ever.",
    footer="yt-seo-architect.vercel.app")

create_slide("10_pricing_pro.png", "Pro Plan — $5/month",
    subtitle="Less than one coffee run",
    bullets=["1,000 credits/month", "Script Generator + Competitor Sniper", "Bulk Injector + Retention Re-Orderer", "Saves 3-5 hours of SEO work per video"],
    highlight="Full Toolkit Access")

create_slide("11_pricing_agency.png", "Agency Plan — $19/month",
    bullets=["Unlimited credits    |    Multi-channel support", "AI Auto-Responder    |    Full automation pipeline"],
    highlight="For Agencies & Power Creators")

create_slide("12_cta.png", "Stop Guessing.",
    subtitle="Let AI handle your YouTube SEO.",
    bullets=["yt-seo-architect.vercel.app", "Start Free — 100 Credits"],
    highlight="See You on the Trending Page!",
    footer="YT SEO Architect")

print("All 12 slides created!")
