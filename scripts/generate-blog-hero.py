#!/usr/bin/env python3
"""
Blog Hero Image Generator — YT SEO Architect
Usage:
  python3 scripts/generate-blog-hero.py <slug> "Title Line 1" "Title Line 2" "Optional Line 3" "CATEGORY BADGE"

Outputs:
  public/blog/<slug>-hero.png   (800×400 — article hero)
  public/blog/<slug>-og.png     (1200×630 — Open Graph / social sharing)

Fallback: If Pillow is not installed, generates a minimal SVG placeholder instead.
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

# ── Colors (matches site theme) ─────────────────────────────
BG_DARK = "#020617"
BG_CARD = "#0F172A"
ACCENT = "#F97316"
ACCENT_LIGHT = "#FB923C"
TEXT_PRIMARY = "#F8FAFC"
TEXT_MUTED = "#94A3B8"
BORDER = "rgba(249,115,22,0.3)"

try:
    from PIL import Image, ImageDraw, ImageFont

    # ── Font resolution ─────────────────────────────────────
    FONT_PATHS = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        # Windows (WSL)
        "/mnt/c/Windows/Fonts/segoeuib.ttf",
        "/mnt/c/Windows/Fonts/segoeui.ttf",
    ]

    def find_font(size, bold=True):
        """Find best available font, falling back to default."""
        for fp in FONT_PATHS:
            if os.path.exists(fp):
                return ImageFont.truetype(fp, size)
        return ImageFont.load_default()

    title_font = find_font(48, bold=True)
    title_font_sm = find_font(36, bold=True)
    badge_font = find_font(14, bold=True)
    brand_font = find_font(18, bold=True)
    brand_font_sm = find_font(14, bold=False)

    def draw_hero(w, h, output_path, is_og=False):
        scale = w / 800.0
        img = Image.new("RGB", (w, h), BG_DARK)
        draw = ImageDraw.Draw(img)

        # ── Accent bar at top ──
        draw.rectangle([0, 0, w, int(6 * scale)], fill=ACCENT)

        # ── Content area background ──
        margin = int(40 * scale)
        card_y = int(20 * scale)
        card_h = h - int(60 * scale)
        draw.rounded_rectangle(
            [margin, card_y, w - margin, card_y + card_h],
            radius=int(16 * scale),
            fill=BG_CARD,
            outline=ACCENT,
            width=1
        )

        # ── Badge ──
        badge_text = BADGE.upper()
        badge_bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
        badge_w = badge_bbox[2] - badge_bbox[0] + int(24 * scale)
        badge_h = badge_bbox[3] - badge_bbox[1] + int(12 * scale)
        badge_x = int(70 * scale)
        badge_y = int(50 * scale)
        draw.rounded_rectangle(
            [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
            radius=int(10 * scale),
            fill=ACCENT
        )
        draw.text(
            (badge_x + int(12 * scale), badge_y + int(6 * scale)),
            badge_text,
            fill="white",
            font=badge_font
        )

        # ── Title lines ──
        title_y = badge_y + badge_h + int(28 * scale)
        # Determine font size based on line count
        use_font = title_font_sm if (TITLE_L2 and TITLE_L3) else title_font

        # Available text width inside the card (card edges minus badge offset and right padding)
        text_max_x = w - margin - int(30 * scale)  # right edge of available area
        available_width = text_max_x - badge_x

        lines = [l for l in [TITLE_L1, TITLE_L2, TITLE_L3] if l]
        wrapped_lines = []
        for line in lines:
            # Wrap by actual pixel width, not character count
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
                    # If a single word is too long, truncate it with ellipsis
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
            draw.text(
                (badge_x, title_y + i * int(52 * scale)),
                line,
                fill=TEXT_PRIMARY,
                font=use_font
            )

        # ── Footer bar ──
        footer_y = h - int(44 * scale)
        draw.rectangle([0, footer_y, w, h], fill=BG_CARD)
        footer_text = "yt-seo-architect.vercel.app/blog  ·  17 free tools, no credit card"
        # Truncate footer if it overflows
        footer_width = draw.textlength(footer_text, font=brand_font_sm)
        if footer_width > w - int(80 * scale):
            footer_text = "yt-seo-architect.vercel.app/blog"
        draw.text(
            (int(40 * scale), footer_y + int(14 * scale)),
            footer_text,
            fill=TEXT_MUTED,
            font=brand_font_sm
        )

        # ── Logo circle ──
        logo_size = int(40 * scale)
        logo_x = w - margin - logo_size - int(10 * scale)
        logo_y = int(14 * scale)
        draw.ellipse(
            [logo_x, logo_y, logo_x + logo_size, logo_y + logo_size],
            fill=ACCENT
        )
        # Simple bolt symbol
        bolt_text = "⚡"
        bolt_bbox = draw.textbbox((0, 0), bolt_text, font=brand_font)
        bolt_w = bolt_bbox[2] - bolt_bbox[0]
        bolt_h = bolt_bbox[3] - bolt_bbox[1]
        draw.text(
            (logo_x + (logo_size - bolt_w) // 2, logo_y + (logo_size - bolt_h) // 2 - int(2 * scale)),
            bolt_text,
            fill="white",
            font=brand_font
        )

        img.save(output_path)
        print(f"✅ Created {output_path} ({w}×{h})")

    draw_hero(800, 400, HERO_PATH, is_og=False)
    draw_hero(1200, 630, OG_PATH, is_og=True)

except ImportError:
    # ── Pillow not available — generate SVG fallback ─────────────
    print("⚠️  Pillow not installed. Generating SVG fallback instead.")
    print("   Install with: pip install Pillow")

    title_text = TITLE_L1
    if TITLE_L2:
        title_text += "\n" + TITLE_L2

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="{BG_DARK}"/>
  <rect width="800" height="6" fill="{ACCENT}"/>
  <rect x="30" y="20" width="740" height="340" rx="16" fill="{BG_CARD}" stroke="{ACCENT}" stroke-width="1"/>
  <rect x="60" y="48" rx="10" width="120" height="28" fill="{ACCENT}"/>
  <text x="72" y="68" fill="white" font-family="sans-serif" font-weight="bold" font-size="13">{BADGE.upper()}</text>
  <text x="60" y="118" fill="{TEXT_PRIMARY}" font-family="sans-serif" font-weight="bold" font-size="34">{TITLE_L1[:40]}</text>
  <text x="60" y="164" fill="{TEXT_PRIMARY}" font-family="sans-serif" font-weight="bold" font-size="34">{TITLE_L2[:40]}</text>
  {"<text x=\"60\" y=\"210\" fill=\"{TEXT_PRIMARY}\" font-family=\"sans-serif\" font-weight=\"bold\" font-size=\"34\">" + TITLE_L3[:40] + "</text>" if TITLE_L3 else ""}
  <rect y="358" width="800" height="42" fill="{BG_CARD}"/>
  <text x="40" y="384" fill="{TEXT_MUTED}" font-family="sans-serif" font-size="13">yt-seo-architect.vercel.app/blog  ·  17 free tools, no credit card</text>
</svg>"""

    with open(HERO_PATH.replace(".png", ".svg"), "w") as f:
        f.write(svg)
    print(f"✅ Created SVG fallback: {HERO_PATH.replace('.png', '.svg')}")
