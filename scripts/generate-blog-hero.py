#!/usr/bin/env python3
"""
Blog Hero Image Generator — YT SEO Architect (Cyber-Luxe v5)
Usage:
  python3 scripts/generate-blog-hero.py <slug> "Title Line 1" "Title Line 2" "Optional Line 3" "CATEGORY BADGE"

Outputs:
  public/blog/<slug>-hero.png   (800×400 — article hero)
  public/blog/<slug>-og.png     (1200×630 — Open Graph / social sharing)

Design: Cyber-Luxe Dark — Electric Cyan + Acid Green on Midnight Navy.
"""

import sys, os

SLUG = sys.argv[1] if len(sys.argv) > 1 else "generic"
TITLE_L1 = sys.argv[2] if len(sys.argv) > 2 else "Blog Post"
TITLE_L2 = sys.argv[3] if len(sys.argv) > 3 else ""
TITLE_L3 = sys.argv[4] if len(sys.argv) > 4 else ""
BADGE = sys.argv[5] if len(sys.argv) > 5 else "BLOG"

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "blog")
os.makedirs(OUT_DIR, exist_ok=True)

HERO_PATH = os.path.join(OUT_DIR, f"{SLUG}-hero.png")
OG_PATH = os.path.join(OUT_DIR, f"{SLUG}-og.png")

# ── Cyber-Luxe Colors (matches DESIGN.md) ─────────────────────
BG_DEEP = "#0a0b10"           # Midnight Navy Deep — page background
BG_CARD = "rgba(16,20,32,0.6)" # Card Glass
CYAN = "#00f2ff"              # Electric Cyan — CTAs, highlights
GREEN = "#00ff88"             # Acid Green — success, accent
TEXT_ACTIVE = "#ffffff"       # Headings
TEXT_PRIMARY = "#f0f2f5"      # Body text
TEXT_MUTED = "#a8b2c1"        # Secondary text
DANGER = "#ff3366"            # Errors
OLED_BLACK = "#000000"

try:
    from PIL import Image, ImageDraw, ImageFont

    FONT_PATHS = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/mnt/c/Windows/Fonts/segoeuib.ttf",
        "/mnt/c/Windows/Fonts/segoeui.ttf",
    ]

    def find_font(size, bold=True):
        for fp in FONT_PATHS:
            if os.path.exists(fp):
                return ImageFont.truetype(fp, size)
        return ImageFont.load_default()

    title_font = find_font(46, bold=True)
    title_font_sm = find_font(34, bold=True)
    badge_font = find_font(13, bold=True)
    brand_font = find_font(16, bold=True)
    muted_font = find_font(13, bold=False)

    def draw_hero(w, h, output_path, is_og=False):
        scale = w / 800.0
        img = Image.new("RGB", (w, h), BG_DEEP)
        draw = ImageDraw.Draw(img)

        # ── Top accent bar (cyan → green gradient) ──
        bar_h = int(4 * scale)
        for x in range(w):
            t = x / w
            r = int(0) 
            g = int(242 * (1 - t) + 255 * t)
            b = int(255 * (1 - t) + 136 * t)
            draw.rectangle([x, 0, x + 1, bar_h], fill=(r, g, b))

        # ── Geometric accent shapes (subtle) ──
        # Top-right corner triangle
        tri_size = int(80 * scale)
        draw.polygon([
            (w - tri_size, 0), (w, 0), (w, tri_size)
        ], fill=(0, 242//15, 255//15))

        # ── Glass card background ──
        margin = int(36 * scale)
        card_y = int(22 * scale)
        card_h = h - int(70 * scale)
        # Card fill
        draw.rounded_rectangle(
            [margin, card_y, w - margin, card_y + card_h],
            radius=int(14 * scale),
            fill=(16, 20, 32),
            outline=None,
        )
        # Card border (cyan, subtle)
        draw.rounded_rectangle(
            [margin, card_y, w - margin, card_y + card_h],
            radius=int(14 * scale),
            fill=None,
            outline=(0, 242, 255),
            width=1
        )

        # ── Left accent line on card ──
        line_x = margin + int(3 * scale)
        line_top = card_y + int(14 * scale)
        line_bot = card_y + card_h - int(14 * scale)
        draw.line(
            [(line_x, line_top), (line_x, line_bot)],
            fill=(0, 242, 255),
            width=2
        )

        # ── Badge ──
        badge_text = BADGE.upper()
        badge_bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
        badge_w = badge_bbox[2] - badge_bbox[0] + int(22 * scale)
        badge_h = badge_bbox[3] - badge_bbox[1] + int(12 * scale)
        badge_x = margin + int(20 * scale)
        badge_y = card_y + int(28 * scale)
        
        # Badge background with cyan glow
        draw.rounded_rectangle(
            [badge_x - 1, badge_y - 1, badge_x + badge_w + 1, badge_y + badge_h + 1],
            radius=int(6 * scale),
            fill=None,
            outline=(0, 242, 255),
            width=1
        )
        draw.rounded_rectangle(
            [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
            radius=int(6 * scale),
            fill=(0, 242 // 8, 255 // 8)
        )
        draw.text(
            (badge_x + int(11 * scale), badge_y + int(6 * scale)),
            badge_text,
            fill=CYAN,
            font=badge_font
        )

        # ── Title lines ──
        title_y = badge_y + badge_h + int(24 * scale)
        use_font = title_font_sm if (TITLE_L2 and TITLE_L3) else title_font

        text_max_x = w - margin - int(26 * scale)
        available_width = text_max_x - badge_x

        lines = [l for l in [TITLE_L1, TITLE_L2, TITLE_L3] if l]
        wrapped_lines = []
        for line in lines:
            words = line.split()
            current_line = ""
            for word in words:
                test_line = (current_line + " " + word).strip()
                test_width = draw.textlength(test_line, font=use_font)
                if test_width <= available_width:
                    current_line = test_line
                else:
                    if current_line:
                        wrapped_lines.append(current_line)
                    if draw.textlength(word, font=use_font) > available_width:
                        truncated = word
                        while draw.textlength(truncated + "…", font=use_font) > available_width and len(truncated) > 1:
                            truncated = truncated[:-1]
                        current_line = truncated + "…"
                    else:
                        current_line = word
            if current_line:
                wrapped_lines.append(current_line)

        max_title_lines = 4 if is_og else 3
        for i, line in enumerate(wrapped_lines[:max_title_lines]):
            # First line white, second line acid green
            color = TEXT_ACTIVE if i == 0 else GREEN
            if len(wrapped_lines) > 2 and i == len(wrapped_lines) - 1:
                color = TEXT_PRIMARY
            draw.text(
                (badge_x, title_y + i * int(50 * scale)),
                line,
                fill=color,
                font=use_font
            )

        # ── Bottom info bar ──
        footer_y = h - int(46 * scale)
        # Subtle top border on footer
        draw.line(
            [(margin, footer_y), (w - margin, footer_y)],
            fill=(0, 242 // 4, 255 // 4),
            width=1
        )
        footer_text = "yt-seo-architect.vercel.app/blog  ·  17 free tools, no credit card"
        footer_width = draw.textlength(footer_text, font=muted_font)
        if footer_width > w - int(80 * scale):
            footer_text = "yt-seo-architect.vercel.app/blog"
        draw.text(
            (margin + int(4 * scale), footer_y + int(14 * scale)),
            footer_text,
            fill=TEXT_MUTED,
            font=muted_font
        )

        # ── Logo mark (sharp square, not round) ──
        logo_size = int(34 * scale)
        logo_x = w - margin - logo_size - int(12 * scale)
        logo_y = int(18 * scale)
        # Sharp square (radius ≤ 1rem per DESIGN.md)
        draw.rounded_rectangle(
            [logo_x, logo_y, logo_x + logo_size, logo_y + logo_size],
            radius=int(6 * scale),
            fill=None,
            outline=(0, 242, 255),
            width=2
        )
        bolt_text = "⚡"
        bolt_bbox = draw.textbbox((0, 0), bolt_text, font=brand_font)
        bolt_w = bolt_bbox[2] - bolt_bbox[0]
        bolt_h = bolt_bbox[3] - bolt_bbox[1]
        draw.text(
            (logo_x + (logo_size - bolt_w) // 2, logo_y + (logo_size - bolt_h) // 2 - int(1 * scale)),
            bolt_text,
            fill=CYAN,
            font=brand_font
        )

        img.save(output_path)
        print(f"✅ Created {output_path} ({w}×{h})")

    draw_hero(800, 400, HERO_PATH, is_og=False)
    draw_hero(1200, 630, OG_PATH, is_og=True)

except ImportError:
    print("⚠️  Pillow not installed. Install with: pip install Pillow")
