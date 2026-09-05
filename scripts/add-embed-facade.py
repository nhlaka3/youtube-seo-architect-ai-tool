#!/usr/bin/env python3
"""Replace YouTube iframe embeds in static blog pages with click-to-play facades.

A facade = thumbnail poster + play button. The iframe is only created on click
(by the handler in /js/blog-enhancements.js), so no cookie-less embed request
fires on page load — no white box when the viewer's network/Google blocks it.

Idempotent: pages already containing a .yt-facade are skipped.
"""
import glob
import html
import re
import sys

IFRAME_RE = re.compile(
    r'<iframe\s+style="[^"]*"\s+src="https://www\.youtube-nocookie\.com/embed/'
    r'([A-Za-z0-9_-]{11})"\s+title="([^"]*)"[^>]*></iframe>'
)


def facade(video_id: str, title: str) -> str:
    t = html.escape(title, quote=True)
    return (
        f'<button type="button" class="yt-facade" data-video="{video_id}" '
        f'aria-label="Play video: {t}" '
        'style="position:absolute;inset:0;display:block;width:100%;height:100%;'
        'padding:0;border:0;background:#0b1220;cursor:pointer;">'
        f'<img src="https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" alt="" '
        'aria-hidden="true" loading="lazy" decoding="async" '
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
        '<span aria-hidden="true" style="position:absolute;inset:0;background:'
        'linear-gradient(180deg,rgba(2,6,23,0) 45%,rgba(2,6,23,0.6) 100%);"></span>'
        '<svg viewBox="0 0 68 48" width="72" height="50" aria-hidden="true" '
        'style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);'
        'filter:drop-shadow(0 4px 10px rgba(0,0,0,0.6));">'
        '<path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0'
        'S12.21.13 7.1 1.55c-2.93.78-4.63 3.26-5.42 6.19C.26 12.85 0 24 0 24'
        's.26 11.16 1.68 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48'
        's21.79-.13 26.9-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.74 35.16 68 24 68 24'
        's-.26-11.15-1.48-16.26z" fill="#f03"/>'
        '<path d="M45 24 27 14v20l18-10z" fill="#fff"/></svg></button>'
    )


def main() -> None:
    changed = skipped = replaced = 0
    for path in sorted(glob.glob('public/blog/*.html')):
        with open(path, encoding='utf-8') as f:
            content = f.read()
        if '.yt-facade' in content:
            skipped += 1
            continue
        matches = list(IFRAME_RE.finditer(content))
        if not matches:
            print(f'SKIP (no iframe): {path}')
            skipped += 1
            continue
        if len(matches) > 1:
            print(f'WARN multiple iframes ({len(matches)}): {path}')
        new_content, n = IFRAME_RE.subn(
            lambda m: facade(m.group(1), m.group(2)), content
        )
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        changed += 1
        replaced += n
        print(f'OK   ({n} embed→facade) {path}')
    print(f'\nDone: {changed} files changed, {replaced} embeds replaced, {skipped} skipped.')
    sys.exit(0 if replaced > 0 else 1)


if __name__ == '__main__':
    main()
