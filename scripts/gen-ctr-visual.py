#!/usr/bin/env python3
"""Generate an on-brand 'Average CTR by Search Position' bar chart (PIL) to
repair a cron post whose matplotlib visual was lost to .gitignore (visual-1).
Usage: python3 scripts/gen-ctr-visual.py <out.png> [width height]
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 420
out = sys.argv[1] if len(sys.argv) > 1 else 'public/blog/x-visual-1.png'
if len(sys.argv) > 3:
    W, H = int(sys.argv[2]), int(sys.argv[3])

BG = (10, 11, 16)
CARD = (16, 20, 32)
CYAN = (0, 242, 255)
GREEN = (0, 255, 136)
TEXT = (226, 232, 240)
MUTED = (139, 139, 158)

def font(size, bold=True):
    paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/mnt/c/Windows/Fonts/segoeuib.ttf',
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# top accent bar
for x in range(W):
    t = x / W
    d.line([(x, 0), (x, 3)], fill=(0, int(242 * (1 - t) + 255 * t), int(255 * (1 - t) + 136 * t)))

# card
d.rounded_rectangle([28, 22, W - 28, H - 30], radius=14, fill=CARD, outline=(45, 33, 94), width=1)

f_title = font(19)
f_label = font(12)
f_val = font(10, bold=False)
f_sub = font(11, bold=False)

d.text((48, 42), 'Average CTR by Search Position', fill=TEXT, font=f_title)
d.text((48, 68), 'Click-through rate vs ranking — illustrative, based on typical position curves', fill=MUTED, font=f_sub)

# chart area
x0, x1, y0, y1 = 60, W - 60, 96, H - 90
vals = [14.0, 10.2, 7.8, 6.1, 4.9, 4.0, 3.3, 2.8, 2.3, 1.9]  # position 1..10
n = len(vals)
maxv = max(vals)
slot = (x1 - x0) / n
bar_w = slot * 0.52

# gridlines
for g in (0.25, 0.5, 0.75, 1.0):
    gy = y1 - (y1 - y0) * g
    d.line([(x0, gy), (x1, gy)], fill=(255, 255, 255, 14), width=1)
    d.text((x0 - 8, gy - 6), f'{int(g * maxv)}%', fill=MUTED, font=f_val, anchor='rm')

for i, v in enumerate(vals):
    cx = x0 + slot * i + slot / 2
    bh = (y1 - y0) * (v / maxv)
    by = y1 - bh
    color = CYAN if i < 3 else GREEN if i < 6 else (167, 139, 250)
    d.rounded_rectangle([cx - bar_w / 2, by, cx + bar_w / 2, y1], radius=6, fill=color)
    d.text((cx, by - 12), f'{v:.1f}%', fill=TEXT, font=f_val, anchor='mm')
    d.text((cx, y1 + 14), str(i + 1), fill=MUTED, font=f_label, anchor='mm')

d.text((x0, y1 + 44), 'Search position', fill=MUTED, font=f_label)
d.text((x1, y1 + 44), 'position 1 = 10×+ the clicks of position 10', fill=MUTED, font=f_val, anchor='rm')

img.save(out)
print(f'✅ {out} ({W}x{H})')
