#!/usr/bin/env python3
"""
ASCII Video Showcase
Demonstrates the ascii-video pipeline's core capabilities:
  - Value fields (plasma, vortex, fBM noise, domain warp, rings)
  - Multi-grid composition & pixel blending
  - HSV color system (rainbow, time-cycling, distance-mapped)
  - Character palettes (density ramp, blocks, dots, runes)
  - Shaders (vignette, bloom, grain, chromatic aberration)
  - Text overlays with section labels
  - Adaptive tone mapping

Output: ascii_showcase.mp4  (960x540, 20fps, ~24s)
"""

import numpy as np
import subprocess
import os
import sys
import math
import time
from PIL import Image, ImageDraw, ImageFont

# ── Configuration ──────────────────────────────────────────────────────────────
VW, VH = 960, 540       # video resolution
FPS = 20
DURATION = 24.0         # seconds
TOTAL_FRAMES = int(FPS * DURATION)
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii_showcase.mp4")

# Font path for WSL/Linux
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

# Grid presets: (font_size, description)
GRID_PRESETS = {"sm": 9, "md": 13, "lg": 18}

# ── HSV Colour (vectorised) ────────────────────────────────────────────────────
def hsv2rgb(h, s, v):
    """Vectorised HSV->RGB. h,s,v float32 arrays [0,1]. Returns (R,G,B) uint8."""
    h = h % 1.0
    c = v * s
    x = c * (1 - np.abs((h * 6) % 2 - 1))
    m = v - c
    r = np.zeros_like(h); g = np.zeros_like(h); b = np.zeros_like(h)
    mask = (h < 1/6);           r[mask]=c[mask]; g[mask]=x[mask]
    mask = (h>=1/6)&(h<2/6);    r[mask]=x[mask]; g[mask]=c[mask]
    mask = (h>=2/6)&(h<3/6);    g[mask]=c[mask]; b[mask]=x[mask]
    mask = (h>=3/6)&(h<4/6);    g[mask]=x[mask]; b[mask]=c[mask]
    mask = (h>=4/6)&(h<5/6);    r[mask]=x[mask]; b[mask]=c[mask]
    mask = h >= 5/6;            r[mask]=c[mask]; b[mask]=x[mask]
    R = np.clip((r+m)*255, 0, 255).astype(np.uint8)
    G = np.clip((g+m)*255, 0, 255).astype(np.uint8)
    B = np.clip((b+m)*255, 0, 255).astype(np.uint8)
    return R, G, B

def mkc(R, G, B):
    """Stack R,G,B uint8 arrays into (H,W,3) canvas."""
    o = np.zeros((R.shape[0], R.shape[1], 3), dtype=np.uint8)
    o[:,:,0] = R; o[:,:,1] = G; o[:,:,2] = B
    return o

# ── Character Palettes ─────────────────────────────────────────────────────────
PAL_DEFAULT = " .`'-:;!><=+*^~?/|(){}[]#&$@%"
PAL_DENSE   = " .:;+=xX$#@\u2588"
PAL_BLOCKS  = " \u2591\u2592\u2593\u2588"
PAL_DOTS    = " \u00b7\u2218\u2219\u2022\u25cf\u2605\u2726"
PAL_BLOCKS_EXT = " \u2591\u2592\u2593\u2588\u2584\u2580\u2590\u258c"
PAL_RUNE    = " \u16a0\u16a2\u16a6\u16b1\u16b7\u16c1\u16c7\u16d2\u16d6\u16da\u16de\u16df"
PAL_GREEK   = " \u03b1\u03b2\u03b3\u03b4\u03b5\u03b6\u03b7\u03b8\u03b9\u03ba\u03bb\u03bc\u03bd\u03be\u03c0\u03c1\u03c3\u03c4\u03c6\u03c8\u03c9"
PAL_BINARY  = " \u2588"

# Collect all chars for bitmap pre-rasterisation
ALL_CHARS = set()
for p in [PAL_DEFAULT, PAL_DENSE, PAL_BLOCKS, PAL_DOTS, PAL_BLOCKS_EXT,
          PAL_RUNE, PAL_GREEK, PAL_BINARY]:
    ALL_CHARS.update(p)
ALL_CHARS.update("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-:;!?/'\"|")
ALL_CHARS.discard(" ")

# ── GridLayer ──────────────────────────────────────────────────────────────────
class GridLayer:
    def __init__(self, font_path, font_size, vw=VW, vh=VH):
        self.vw, self.vh = vw, vh
        self.font = ImageFont.truetype(font_path, font_size)
        asc, desc = self.font.getmetrics()
        bbox = self.font.getbbox("M")
        self.cw = bbox[2] - bbox[0]
        self.ch = asc + desc
        self.cols = max(1, vw // self.cw)
        self.rows = max(1, vh // self.ch)
        self.ox = (vw - self.cols * self.cw) // 2
        self.oy = (vh - self.rows * self.ch) // 2
        # Index arrays
        self.rr = np.arange(self.rows, dtype=np.float32)[:, None]
        self.cc = np.arange(self.cols, dtype=np.float32)[None, :]
        # Polar (aspect-corrected)
        cx, cy = self.cols / 2.0, self.rows / 2.0
        asp = self.cw / self.ch
        self.dx = self.cc - cx
        self.dy = (self.rr - cy) * asp
        self.dist = np.sqrt(self.dx**2 + self.dy**2)
        self.angle = np.arctan2(self.dy, self.dx)
        self.dx_n = (self.cc - cx) / max(self.cols, 1)
        self.dy_n = (self.rr - cy) / max(self.rows, 1) * asp
        self.dist_n = np.sqrt(self.dx_n**2 + self.dy_n**2)
        # Pre-rasterise characters
        self.bm = {}
        for c in ALL_CHARS:
            img = Image.new("L", (self.cw, self.ch), 0)
            ImageDraw.Draw(img).text((0, 0), c, fill=255, font=self.font)
            arr = np.array(img, dtype=np.float32) / 255.0
            if arr.max() > 0:
                self.bm[c] = arr
        self.bm[" "] = np.zeros((self.ch, self.cw), dtype=np.float32)

    def render(self, chars, colors, canvas=None):
        """Composite chars onto pixel canvas."""
        if canvas is None:
            canvas = np.zeros((self.vh, self.vw, 3), dtype=np.uint8)
        for row in range(self.rows):
            y = self.oy + row * self.ch
            if y + self.ch > self.vh:
                break
            for col in range(self.cols):
                c = chars[row, col]
                if c == " ":
                    continue
                x = self.ox + col * self.cw
                if x + self.cw > self.vw:
                    break
                a = self.bm.get(c, self.bm.get(" ", self.bm.get(PAL_DEFAULT[0])))
                canvas[y:y+self.ch, x:x+self.cw] = np.maximum(
                    canvas[y:y+self.ch, x:x+self.cw],
                    (a[:, :, None] * colors[row, col]).astype(np.uint8))
        return canvas

# ── Value → Character mapping ──────────────────────────────────────────────────
def val2char(v, mask, pal=PAL_DEFAULT):
    """Map float32 array [0,1] to character array using palette."""
    n = len(pal)
    idx = np.clip((v * n).astype(int), 0, n - 1)
    out = np.full(v.shape, " ", dtype="U1")
    for i, ch in enumerate(pal):
        out[mask & (idx == i)] = ch
    return out

def val2char_gamma(v, mask, pal, gamma=0.8):
    """Gamma-corrected palette mapping."""
    v_adj = np.power(np.clip(v, 0, 1), gamma)
    return val2char(v_adj, mask, pal)

# ── Value Field Generators ─────────────────────────────────────────────────────
def vf_plasma(g, f, t, S):
    """Classic plasma: sum of sines at different orientations."""
    v = np.sin(g.cc * 0.05 + t * 0.8) * 0.5
    v = v + np.sin(g.rr * 0.06 - t * 0.6) * 0.4
    v = v + np.sin((g.cc * 0.03 + g.rr * 0.04) + t * 0.4) * 0.3
    v = v + np.sin(g.dist_n * 5 - t * 0.7) * 0.3
    return np.clip(v * 0.5 + 0.5, 0, 1)

def vf_vortex(g, f, t, S, twist=3.0):
    """Twisting radial pattern."""
    twisted = g.angle + g.dist_n * twist * np.sin(t * 0.5)
    val = np.sin(twisted * 4 - t * 2) * 0.5 + 0.5
    return np.clip(val * (0.5 + 0.5), 0, 1)

def vf_fbm(g, f, t, S, octaves=4, freq=0.06, speed=0.15, bri=0.85):
    """Fractal Brownian Motion — organic texture."""
    val = np.zeros((g.rows, g.cols), dtype=np.float32)
    amp = 1.0
    fx, fy = freq, freq * 0.85
    for i in range(octaves):
        phase = t * speed * (1 + i * 0.3) + i * 17.3
        x = g.cc * fx + phase
        y = g.rr * fy - phase * 0.6 + i * 31.7
        # Simple value noise approximation using sine-based hash
        n = np.sin(x * 127.1 + y * 311.7) * 43758.5453123
        n = n - np.floor(n)
        val = val + n * amp
        amp *= 0.5
        fx *= 2.0
        fy *= 2.0
    max_amp = (1 - 0.5**octaves) / 0.5
    return np.clip(val / max_amp * bri * 0.8, 0, 1)

def vf_domain_warp(g, f, t, S, warp_strength=12.0):
    """Domain warping — flowing organic distortion."""
    # Two noise fields for displacement (using sine hash again)
    def noise2d(x, y):
        n = np.sin(x * 127.1 + y * 311.7) * 43758.5453123
        return n - np.floor(n)
    # Warp field
    wx = noise2d(g.cc * 0.08 + t * 0.2, g.rr * 0.06 + 7.1)
    wy = noise2d(g.cc * 0.06 + t * 0.15 + 3.2, g.rr * 0.07 - 11.8)
    wx = (wx - 0.5) * warp_strength * 0.8
    wy = (wy - 0.5) * warp_strength * 0.6
    warped_cc = g.cc + wx
    warped_rr = g.rr + wy
    # Sample at warped coordinates
    val = np.zeros((g.rows, g.cols), dtype=np.float32)
    amp = 1.0
    fx, fy = 0.05, 0.04
    for i in range(4):
        phase = t * 0.2 + i * 13.7
        n = noise2d(warped_cc * fx + phase, warped_rr * fy - phase * 0.5)
        val = val + n * amp
        amp *= 0.5; fx *= 2.0; fy *= 2.0
    return np.clip(val / 1.875 * 0.8, 0, 1)

def vf_rings(g, f, t, S, n_rings=8):
    """Concentric rings with wobble."""
    val = np.zeros((g.rows, g.cols), dtype=np.float32)
    for ri in range(n_rings):
        rad = (ri + 1) * 4 + np.sin(t * 0.5 + ri * 0.7) * 2
        wobble = np.sin(g.angle * 3 + t * 3) * 1.5
        rd = np.abs(g.dist - rad - wobble)
        th = 2.0
        val = np.maximum(val, np.clip((1 - rd / th) * 0.7, 0, 1))
    return np.clip(val, 0, 1)

def vf_tunnel(g, f, t, S, speed=3.0):
    """Tunnel depth effect."""
    tunnel_d = 1.0 / (g.dist_n + 0.1)
    v1 = np.sin(tunnel_d * 2 - t * speed) * 0.45 + 0.55
    v2 = np.sin(g.angle * 6 + tunnel_d * 1.5 - t * 2) * 0.35 + 0.55
    return np.clip(v1 * 0.5 + v2 * 0.5, 0, 1)

# ── Hue Field Generators ───────────────────────────────────────────────────────
def hf_fixed(hue):
    def fn(g, f, t, S):
        return np.full((g.rows, g.cols), hue, dtype=np.float32)
    return fn

def hf_angle(offset=0.0):
    def fn(g, f, t, S):
        return (g.angle / (2 * np.pi) + offset + t * 0.04) % 1.0
    return fn

def hf_time_cycle(speed=0.08):
    def fn(g, f, t, S):
        return np.full((g.rows, g.cols), (t * speed) % 1.0, dtype=np.float32)
    return fn

def hf_distance(base=0.5, scale=0.15):
    def fn(g, f, t, S):
        return (base + g.dist_n * scale + t * 0.02) % 1.0
    return fn

def hf_freq(offset=0.5):
    """Hue from a sine-based pattern."""
    def fn(g, f, t, S):
        return (np.sin(g.cc * 0.015 + t * 0.2) * 0.5 +
                np.cos(g.rr * 0.012 - t * 0.15) * 0.5) % 1.0
    return fn

# ── Renderer Helper ────────────────────────────────────────────────────────────
def render_vf(grid, val_fn, hue_fn, pal, f, t, S, sat=0.8, threshold=0.03):
    """Render a value field + hue field to a pixel canvas on one grid."""
    val = np.clip(val_fn(grid, f, t, S), 0, 1)
    mask = val > threshold
    ch = val2char_gamma(val, mask, pal, gamma=0.85)
    if callable(hue_fn):
        h = hue_fn(grid, f, t, S) % 1.0
    else:
        h = np.full((grid.rows, grid.cols), float(hue_fn), dtype=np.float32)
    h = np.broadcast_to(h, (grid.rows, grid.cols)).copy()
    R, G, B = hsv2rgb(h, np.clip(sat * np.ones_like(val), 0, 1), val)
    co = mkc(R, G, B)
    return grid.render(ch, co)

# ── Text Helpers ───────────────────────────────────────────────────────────────
def stamp(ch, co, text, row, col, color=(255, 255, 255)):
    """Write text at grid position."""
    for i, c in enumerate(text):
        cc = col + i
        if 0 <= row < ch.shape[0] and 0 <= cc < ch.shape[1]:
            ch[row, cc] = c
            co[row, cc] = color

def create_text_grid(grid, text, pal=PAL_DEFAULT, color=(255, 255, 255)):
    """Create a char/color array with centered text."""
    ch = np.full((grid.rows, grid.cols), " ", dtype="U1")
    co = np.zeros((grid.rows, grid.cols, 3), dtype=np.uint8)
    row = grid.rows // 2
    col = (grid.cols - len(text)) // 2
    for i, c in enumerate(text):
        cc = col + i
        if 0 <= row < grid.rows and 0 <= cc < grid.cols:
            ch[row, cc] = c
            co[row, cc] = color
    return ch, co

# ── Pixel Blend ────────────────────────────────────────────────────────────────
def blend_canvas(base, top, mode="normal", opacity=1.0):
    """Blend two uint8 canvases (H,W,3)."""
    a = base.astype(np.float32) / 255.0
    b = top.astype(np.float32) / 255.0
    if mode == "normal":
        r = b
    elif mode == "screen":
        r = 1 - (1 - a) * (1 - b)
    elif mode == "add":
        r = np.clip(a + b, 0, 1)
    elif mode == "difference":
        r = np.abs(a - b)
    elif mode == "multiply":
        r = a * b
    elif mode == "overlay":
        r = np.where(a < 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))
    elif mode == "softlight":
        r = (1 - 2 * b) * a * a + 2 * b * a
    else:
        r = b
    if opacity < 1.0:
        r = a * (1 - opacity) + r * opacity
    return np.clip(r * 255, 0, 255).astype(np.uint8)

# ── Tone Mapping ───────────────────────────────────────────────────────────────
def tonemap(canvas, gamma=0.75):
    """Adaptive brightness normalization + gamma correction."""
    f = canvas.astype(np.float32)
    sub = f[::4, ::4]
    lo = np.percentile(sub, 1)
    hi = np.percentile(sub, 99.5)
    if hi - lo < 10:
        hi = max(hi, lo + 10)
    f = np.clip((f - lo) / (hi - lo), 0.0, 1.0)
    f = f ** gamma
    f = f * 230 + 15
    return np.clip(f, 0, 255).astype(np.uint8)

# ── Shaders ────────────────────────────────────────────────────────────────────
_vig_cache = {}
def sh_vignette(c, strength=0.25):
    """Edge darkening."""
    k = (c.shape[0], c.shape[1], round(strength, 2))
    if k not in _vig_cache:
        h, w = c.shape[:2]
        Y = np.linspace(-1, 1, h)[:, None]
        X = np.linspace(-1, 1, w)[None, :]
        _vig_cache[k] = np.clip(1.0 - np.sqrt(X**2 + Y**2) * strength, 0.15, 1).astype(np.float32)
    return np.clip(c * _vig_cache[k][:, :, None], 0, 255).astype(np.uint8)

def sh_bloom(c, thr=140):
    """Bright-area glow."""
    sm = c[::4, ::4].astype(np.float32)
    br = np.where(sm > thr, sm, 0)
    for _ in range(2):
        p = np.pad(br, ((1, 1), (1, 1), (0, 0)), mode="edge")
        br = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] +
              p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:] +
              p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0
    bl = np.repeat(np.repeat(br, 4, axis=0), 4, axis=1)[:c.shape[0], :c.shape[1]]
    return np.clip(c.astype(np.float32) + bl * 0.5, 0, 255).astype(np.uint8)

def sh_grain(c, amt=8):
    """Film grain."""
    noise = np.random.randint(-amt, amt + 1, (c.shape[0] // 2, c.shape[1] // 2, 1), dtype=np.int16)
    noise = np.repeat(np.repeat(noise, 2, axis=0), 2, axis=1)[:c.shape[0], :c.shape[1]]
    return np.clip(c.astype(np.int16) + noise, 0, 255).astype(np.uint8)

def sh_chromatic(c, amt=3):
    """R/B channel shift (chromatic aberration)."""
    if amt < 1:
        return c
    a = int(amt)
    o = c.copy()
    o[:, a:, 0] = c[:, :-a, 0]
    o[:, :-a, 2] = c[:, a:, 2]
    return o

def sh_saturation(c, factor=1.3):
    """Adjust saturation."""
    R, G, B = c[:,:,0].astype(np.float32), c[:,:,1].astype(np.float32), c[:,:,2].astype(np.float32)
    gray = (R + G + B) / 3.0
    R = np.clip(gray + (R - gray) * factor, 0, 255).astype(np.uint8)
    G = np.clip(gray + (G - gray) * factor, 0, 255).astype(np.uint8)
    B = np.clip(gray + (B - gray) * factor, 0, 255).astype(np.uint8)
    return np.stack([R, G, B], axis=2)

def apply_shaders(canvas, section, t):
    """Apply shader chain based on section."""
    if section == "plasma":
        canvas = sh_vignette(canvas, 0.22)
        canvas = sh_grain(canvas, 6)
    elif section == "vortex":
        canvas = sh_bloom(canvas, 120)
        canvas = sh_vignette(canvas, 0.2)
    elif section == "fbm":
        canvas = sh_vignette(canvas, 0.25)
        canvas = sh_saturation(canvas, 1.4)
    elif section == "warp":
        canvas = sh_chromatic(canvas, 4)
        canvas = sh_vignette(canvas, 0.2)
    elif section == "rings":
        canvas = sh_bloom(canvas, 100)
        canvas = sh_vignette(canvas, 0.2)
    elif section == "compose":
        canvas = sh_bloom(canvas, 130)
        canvas = sh_chromatic(canvas, 2)
        canvas = sh_vignette(canvas, 0.18)
    elif section == "outro":
        canvas = sh_bloom(canvas, 110)
        canvas = sh_vignette(canvas, 0.15)
    else:  # title
        canvas = sh_bloom(canvas, 150)
        canvas = sh_vignette(canvas, 0.25)
    return canvas

# ── Section Overlay (text stamp on grid) ───────────────────────────────────────
def build_overlay(grid, *items):
    """Build char+color arrays from multiple (text, row, col, color) tuples.
    Items render in order. Later items overwrite earlier at same position."""
    ch = np.full((grid.rows, grid.cols), " ", dtype="U1")
    co = np.zeros((grid.rows, grid.cols, 3), dtype=np.uint8)
    for text, row, col, color in items:
        for i, c in enumerate(text):
            cc = col + i
            if 0 <= row < grid.rows and 0 <= cc < grid.cols:
                ch[row, cc] = c
                co[row, cc] = color
    return ch, co

def format_time(t):
    """Format seconds as mm:ss."""
    m = int(t) // 60
    s = int(t) % 60
    return f"{m:02d}:{s:02d}"

# ── Scene Functions ────────────────────────────────────────────────────────────
S = {}  # persistent state

def scene_title(grids, f, t):
    """Opening title: plasma background + centered text."""
    g = grids["md"]
    canvas = render_vf(g, vf_plasma, hf_angle(0.3), PAL_DENSE, f, t, S, sat=0.85)

    # Overlay text on lg grid (two lines, shifted up from center)
    gl = grids["lg"]
    ch_title, co_title = build_overlay(gl,
        ("ASCII VIDEO", gl.rows//2 - 5, (gl.cols - 11)//2, (255, 255, 240)),
        ("  SHOWCASE ", gl.rows//2 - 4, (gl.cols - 11)//2, (255, 220, 180)))
    canvas = gl.render(ch_title, co_title, canvas)

    # Subtitle on sm grid
    gs = grids["sm"]
    subtitle = "Generative ASCII Art Pipeline"
    ch_sub, co_sub = build_overlay(gs,
        (subtitle, gs.rows//2, (gs.cols - len(subtitle))//2, (160, 200, 255)),
        (f"ascii-video skill  |  960x540  |  20fps", gs.rows - 3, 2, (120, 140, 180)))
    canvas = gs.render(ch_sub, co_sub, canvas)
    return canvas

def scene_plasma(grids, f, t):
    """Plasma effect with rainbow hue."""
    g = grids["md"]
    canvas = render_vf(g, vf_plasma, hf_angle(0.0), PAL_DENSE, f, t, S, sat=0.9)
    gs = grids["sm"]
    ch_overlay, co_overlay = build_overlay(gs,
        ("PLASMA FIELD", 2, (gs.cols - len("PLASMA FIELD"))//2, (255, 200, 100)),
        ("value field: sum-of-sines  |  hue: angle-mapped rainbow", gs.rows - 3, 2, (180, 180, 200)))
    canvas = gs.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_vortex(grids, f, t):
    """Rotating vortex with blocks palette."""
    g = grids["md"]
    canvas = render_vf(g, lambda g, f, t, S: vf_vortex(g, f, t, S, twist=4.0),
                       hf_time_cycle(0.1), PAL_BLOCKS_EXT, f, t, S, sat=0.85)
    gs = grids["sm"]
    ch_overlay, co_overlay = build_overlay(gs,
        ("VORTEX", 2, (gs.cols - len("VORTEX"))//2, (100, 255, 200)),
        ("radial twist  |  blocks palette  |  time-cycling hue", gs.rows - 3, 2, (180, 180, 200)))
    canvas = gs.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_fbm(grids, f, t):
    """fBM noise — organic texture with dots palette."""
    g = grids["md"]
    canvas = render_vf(g, vf_fbm, hf_distance(0.6, 0.12), PAL_DOTS, f, t, S, sat=0.8)
    gs = grids["sm"]
    ch_overlay, co_overlay = build_overlay(gs,
        ("fBM NOISE", 2, (gs.cols - len("fBM NOISE"))//2, (200, 180, 255)),
        ("fractal Brownian motion  |  organic texture  |  dots palette", gs.rows - 3, 2, (180, 180, 200)))
    canvas = gs.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_warp(grids, f, t):
    """Domain warping — melting geometry."""
    g = grids["md"]
    canvas = render_vf(g, vf_domain_warp, hf_freq(), PAL_RUNE, f, t, S, sat=0.75)
    gs = grids["sm"]
    ch_overlay, co_overlay = build_overlay(gs,
        ("DOMAIN WARP", 2, (gs.cols - len("DOMAIN WARP"))//2, (255, 180, 180)),
        ("coordinate displacement  |  flowing distortion  |  rune palette", gs.rows - 3, 2, (180, 180, 200)))
    canvas = gs.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_rings(grids, f, t):
    """Concentric rings with tunnel blend."""
    g = grids["md"]
    canvas = render_vf(g, vf_rings, hf_fixed(0.6), PAL_BLOCKS, f, t, S, sat=0.9)
    # Add tunnel on sm grid, screen blended
    gs = grids["sm"]
    tunnel_canvas = render_vf(gs, vf_tunnel, hf_angle(0.5), PAL_DENSE, f, t, S, sat=0.7)
    canvas = blend_canvas(canvas, tunnel_canvas, "screen", 0.5)
    ch_overlay, co_overlay = build_overlay(gs,
        ("RINGS + TUNNEL", 2, (gs.cols - len("RINGS + TUNNEL"))//2, (255, 200, 200)),
        ("concentric rings  |  tunnel depth  |  screen blend", gs.rows - 3, 2, (180, 180, 200)))
    canvas = gs.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_compose(grids, f, t):
    """Multi-layer composition demo."""
    g_sm = grids["sm"]
    g_md = grids["md"]
    # Layer A: vortex on md
    a = render_vf(g_md, lambda g, f, t, S: vf_vortex(g, f, t, S, twist=5.0),
                  hf_fixed(0.75), PAL_BLOCKS_EXT, f, t, S, sat=0.8)
    # Layer B: fBM on sm with angle hue
    b = render_vf(g_sm, vf_fbm, hf_angle(0.2), PAL_DOTS, f, t, S, sat=0.7)
    # Layer C: rings on lg
    g_lg = grids["lg"]
    c = render_vf(g_lg, vf_rings, hf_time_cycle(0.12), PAL_DENSE, f, t, S, sat=0.85)

    # Blend
    canvas = blend_canvas(a, b, "screen", 0.7)
    canvas = blend_canvas(canvas, c, "difference", 0.5)

    # Label
    ch_overlay, co_overlay = build_overlay(g_sm,
        ("MULTI-LAYER COMPOSITION", 2, (g_sm.cols - len("MULTI-LAYER COMPOSITION"))//2, (255, 220, 150)),
        ("vortex + fBM + rings  |  3 grids  |  screen + difference blend", g_sm.rows - 3, 2, (180, 180, 200)))
    canvas = g_sm.render(ch_overlay, co_overlay, canvas)
    return canvas

def scene_outro(grids, f, t):
    """Ending: tunnel background + 'THE END' + credits."""
    g_sm = grids["sm"]
    g_md = grids["md"]
    # Background: tunnel
    canvas = render_vf(g_md, vf_tunnel, hf_angle(0.7), PAL_BLOCKS_EXT, f, t, S, sat=0.85)
    # + plasma overlay on sm
    plasma_c = render_vf(g_sm, vf_plasma, hf_fixed(0.9), PAL_DOTS, f, t, S, sat=0.5)
    canvas = blend_canvas(canvas, plasma_c, "screen", 0.4)

    # Text: THE END
    g_lg = grids["lg"]
    ch_end, co_end = create_text_grid(g_lg, "THE END", PAL_DEFAULT, (255, 220, 150))
    canvas = g_lg.render(ch_end, co_end, canvas)

    # Credits overlay
    ch_cred, co_cred = build_overlay(g_sm,
        ("made with ascii-video pipeline  |  ~/.hermes/skills/ascii-video",
         g_sm.rows - 3, 2, (180, 180, 200)))
    canvas = g_sm.render(ch_cred, co_cred, canvas)
    return canvas

# ── Section Table ──────────────────────────────────────────────────────────────
SECTIONS = [
    (0.0,  "title"),
    (3.5,  "plasma"),
    (7.0,  "vortex"),
    (10.5, "fbm"),
    (14.0, "warp"),
    (17.5, "rings"),
    (20.5, "compose"),
    (23.0, "outro"),
]

def get_section(t):
    sec = SECTIONS[0][1]
    for ts, name in SECTIONS:
        if t >= ts:
            sec = name
    return sec

SCENE_FUNCS = {
    "title":   scene_title,
    "plasma":  scene_plasma,
    "vortex":  scene_vortex,
    "fbm":     scene_fbm,
    "warp":    scene_warp,
    "rings":   scene_rings,
    "compose": scene_compose,
    "outro":   scene_outro,
}

SCENE_GAMMA = {
    "title":   0.75,
    "plasma":  0.75,
    "vortex":  0.70,
    "fbm":     0.75,
    "warp":    0.70,
    "rings":   0.65,
    "compose": 0.65,
    "outro":   0.70,
}

# ── Main Render Loop ───────────────────────────────────────────────────────────
def run():
    global S
    S.clear()
    total_start = time.time()

    print(f"ASCII Video Showcase")
    print(f"  Resolution: {VW}x{VH}")
    print(f"  FPS: {FPS}, Duration: {DURATION}s, Frames: {TOTAL_FRAMES}")
    print(f"  Output: {OUTPUT}")
    print(f"  Font: {FONT_PATH}")
    print()

    # Initialize grids
    print("Initializing grids...")
    ts = time.time()
    grids = {}
    for key, size in GRID_PRESETS.items():
        grids[key] = GridLayer(FONT_PATH, size)
        print(f"  {key}: {grids[key].cols}x{grids[key].rows} chars @ {size}px")
    print(f"  Grids ready in {time.time()-ts:.1f}s")
    print()

    # Features dict (no audio in generative mode, but we provide a baseline)
    f = {"rms": 0.3, "bass": 0.3, "mid": 0.3, "hi": 0.3, "cent": 0.5,
         "bdecay": 0.0, "sub": 0.3, "flux": 0.3}

    # Start ffmpeg pipe
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{VW}x{VH}", "-r", str(FPS),
        "-i", "pipe:0",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-pix_fmt", "yuv420p",
        OUTPUT
    ]
    pipe = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    last_report = 0

    for fi in range(TOTAL_FRAMES):
        t = fi / FPS
        section = get_section(t)
        gamma = SCENE_GAMMA[section]

        # Render scene
        try:
            canvas = SCENE_FUNCS[section](grids, f, t)
        except Exception as e:
            print(f"\nError at frame {fi} ({section}): {e}")
            canvas = np.zeros((VH, VW, 3), dtype=np.uint8)

        # Tone map
        canvas = tonemap(canvas, gamma)

        # Shaders
        canvas = apply_shaders(canvas, section, t)

        # Write frame
        pipe.stdin.write(canvas.tobytes())

        # Progress report
        if fi - last_report >= FPS or fi == TOTAL_FRAMES - 1:
            elapsed = time.time() - total_start
            fps_actual = (fi + 1) / elapsed
            pct = (fi + 1) / TOTAL_FRAMES * 100
            eta = (TOTAL_FRAMES - fi - 1) / fps_actual if fps_actual > 0 else 0
            print(f"  [{fi+1:4d}/{TOTAL_FRAMES}] {pct:5.1f}%  "
                  f"{fps_actual:4.1f}fps  ETA {eta:4.0f}s  "
                  f"section: {section}", end="\r")
            sys.stdout.flush()
            last_report = fi

    # Cleanup
    pipe.stdin.close()
    pipe.wait()
    total_time = time.time() - total_start
    print(f"\n\nDone! {TOTAL_FRAMES} frames in {total_time:.1f}s ({TOTAL_FRAMES/total_time:.1f} fps)")
    print(f"Output: {OUTPUT}")

    # File size
    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"File size: {size_mb:.1f} MB")

if __name__ == "__main__":
    run()
