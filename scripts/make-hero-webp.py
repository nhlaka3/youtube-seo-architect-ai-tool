#!/usr/bin/env python3
"""Generate webp variants (hero + og) for a blog post's images, matching site conventions."""
import sys
from PIL import Image

slug = sys.argv[1] if len(sys.argv) > 1 else 'youtube-seo-tips-for-creators-in-2026'
base = f'public/blog/{slug}'

for name in ('hero', 'og'):
    src = f'{base}-{name}.png'
    dst = f'{base}-{name}.webp'
    img = Image.open(src)
    img.save(dst, 'WEBP', quality=82, method=6)
    print(f'{dst} ({img.size[0]}x{img.size[1]})')
