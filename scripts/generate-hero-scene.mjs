#!/usr/bin/env node
/**
 * scripts/generate-hero-scene.mjs
 *
 * Blog hero + OG image generator — "dashboard product-shot" style.
 * Renders a stylized YouTube Analytics scene (retention curve + stat cards
 * with sparklines + keyword search chip) as SVG, then rasterizes it with the
 * cached headless Chromium to PNG, and converts to WebP with ffmpeg.
 *
 * Replaces the text-on-card output of generate-blog-hero.py with a real
 * visual scene that matches the site's inline SVG chart aesthetic.
 *
 * Usage:
 *   node scripts/generate-hero-scene.mjs <slug> "<title L1>" "<title L2>" "<keyword>" "<badge>"
 *
 * Outputs (overwrites in place — the post HTML keeps referencing the same paths):
 *   public/blog/<slug>-hero.png   (800×400 article hero)
 *   public/blog/<slug>-hero.webp  (WebP variant)
 *   public/blog/<slug>-og.png     (1200×630 Open Graph)
 *
 * Requires: cached Playwright chrome-headless-shell (see QA notes) + ffmpeg.
 * Chrome path is auto-detected from ~/.cache/ms-playwright.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { homedir } from 'os';

const SLUG = process.argv[2] || 'generic';
const TITLE_L1 = process.argv[3] || 'Blog Post';
const TITLE_L2 = process.argv[4] || '';
const KEYWORD = process.argv[5] || 'youtube seo tips 2026';
const BADGE = (process.argv[6] || 'BLOG').toUpperCase();

const OUT = resolve(process.cwd(), 'public', 'blog');
mkdirSync(OUT, { recursive: true });
const TMP = '/tmp/hero-scenes';
mkdirSync(TMP, { recursive: true });

// ── Chrome discovery (Playwright cache, then common paths) ─────────
function findChrome() {
  const candidates = [
    join(homedir(), '.cache', 'ms-playwright'),
    '/home/nhlaka/.cache/ms-playwright',
  ];
  for (const base of candidates) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      if (!entry.startsWith('chromium_headless_shell')) continue;
      const shell = join(base, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (existsSync(shell)) return shell;
    }
  }
  return null;
}
const CHROME = findChrome();
if (!CHROME) {
  console.error('✋ chrome-headless-shell not found (looked in ~/.cache/ms-playwright). Run: npx playwright install chrome-headless-shell');
  process.exit(1);
}

// ── Scene builder (Cyber-Luxe Dark) ────────────────────────────────
function wrapTitle(l1, l2, maxChars = 54) {
  const cut = (s) => (s.length > maxChars ? s.slice(0, maxChars - 1).trimEnd() + '…' : s);
  const a = cut(l1);
  const b = l2 ? cut(l2) : '';
  return { a, b };
}

function sceneSvg({ title1, title2, keyword, badge }) {
  const W = 800, H = 400;
  const C = {
    cyan: '#00f2ff', green: '#00ff88', violet: '#a78bfa', amber: '#fbbf24',
    red: '#ff3366', bg: '#0a0b10', card: '#101420', muted: '#8b8b9e',
    text: '#e2e8f0', faint: 'rgba(255,255,255,0.045)',
  };
  // curve geometry (same shape language as the in-article retention chart)
  const curve = 'M60 92 C 75 96 85 100 100 103 C 130 135 170 165 220 172 C 270 178 300 184 320 187 C 370 191 410 195 440 197';
  const area = curve + ' L 440 250 L 60 250 Z';

  const spark = (bars, color) => bars.map((h, i) =>
    `<rect x="${532 + i * 16}" y="${150 - h}" width="9" height="${h}" rx="2" fill="${color}" opacity="0.85"/>`).join('');

  const statCard = (y, label, value, delta, color, bars, delColor) => `
      <rect x="460" y="${y}" width="280" height="64" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <text x="472" y="${y + 16}" fill="${C.muted}" font-size="8.5" font-weight="700" letter-spacing="0.1em">${label}</text>
      <text x="472" y="${y + 38}" fill="#ffffff" font-size="16" font-weight="700">${value}</text>
      <text x="${472 + 9.2 * value.length}" y="${y + 38}" fill="${delColor || color}" font-size="10" font-weight="700">${delta}</text>
      ${spark(bars, color)}`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <linearGradient id="topbar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f2ff"/><stop offset="100%" stop-color="#00ff88"/>
    </linearGradient>
    <linearGradient id="retArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#00f2ff" stop-opacity="0.03"/>
    </linearGradient>
    <radialGradient id="glowC" cx="0.15" cy="0.1" r="0.6">
      <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.10"/><stop offset="100%" stop-color="#00f2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowG" cx="0.9" cy="0.95" r="0.7">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0.08"/><stop offset="100%" stop-color="#00ff88" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1" fill="${C.faint}"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glowC)"/>
  <rect width="${W}" height="${H}" fill="url(#glowG)"/>
  <rect width="${W}" height="4" fill="url(#topbar)"/>

  <!-- window card -->
  <rect x="40" y="30" width="720" height="330" rx="14" fill="${C.card}" stroke="rgba(0,242,255,0.35)" stroke-width="1"/>
  <circle cx="62" cy="50" r="4" fill="#ff3366"/>
  <circle cx="78" cy="50" r="4" fill="#fbbf24"/>
  <circle cx="94" cy="50" r="4" fill="#00ff88"/>
  <rect x="112" y="38" width="300" height="22" rx="11" fill="rgba(255,255,255,0.04)"/>
  <text x="124" y="53" fill="${C.muted}" font-size="9.5">yt-seo-architect.vercel.app/blog</text>
  <rect x="712" y="36" width="28" height="28" rx="6" fill="none" stroke="${C.cyan}" stroke-width="2"/>
  <path d="M720 44 L734 50 L720 56 Z" fill="${C.cyan}"/>
  <text x="748" y="55" fill="${C.muted}" font-size="9.5">${badge}</text>

  <!-- left: retention panel -->
  <text x="60" y="80" fill="${C.muted}" font-size="9" font-weight="700" letter-spacing="0.14em">RETENTION · WATCH TIME PER QUERY</text>
  <line x1="60" y1="90" x2="440" y2="90" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="130" x2="440" y2="130" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="170" x2="440" y2="170" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="210" x2="440" y2="210" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="250" x2="440" y2="250" stroke="#2d215e" stroke-width="1.5"/>
  <text x="52" y="93" text-anchor="end" fill="${C.muted}" font-size="8.5">100%</text>
  <text x="52" y="133" text-anchor="end" fill="${C.muted}" font-size="8.5">75%</text>
  <text x="52" y="173" text-anchor="end" fill="${C.muted}" font-size="8.5">50%</text>
  <text x="52" y="213" text-anchor="end" fill="${C.muted}" font-size="8.5">25%</text>
  <rect x="60" y="90" width="40" height="160" fill="rgba(0,255,136,0.08)"/>
  <text x="80" y="104" text-anchor="middle" fill="#00ff88" font-size="8" font-weight="700">HOOK</text>
  <path d="${area}" fill="url(#retArea)"/>
  <path d="${curve}" fill="none" stroke="${C.cyan}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="103" r="3.5" fill="#00ff88"/>
  <circle cx="220" cy="172" r="3.5" fill="#a78bfa"/>
  <line x1="220" y1="90" x2="220" y2="250" stroke="#a78bfa" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>
  <text x="60" y="266" fill="${C.muted}" font-size="8.5">0:00</text>
  <text x="220" y="266" fill="${C.muted}" font-size="8.5">3:00</text>
  <text x="330" y="266" fill="${C.muted}" font-size="8.5">6:00</text>
  <text x="440" y="266" fill="${C.muted}" font-size="8.5">10:00</text>
  <text x="60" y="284" fill="${C.muted}" font-size="8.5">drops at a timestamp = fixable script moment</text>

  <!-- right: stat cards -->
  ${statCard(78, 'VIEWS', '24.1K', '+12%', C.green, [10, 14, 11, 18, 22, 17, 26], C.green)}
  ${statCard(154, 'WATCH TIME', '14:50', 'avg', C.cyan, [12, 16, 14, 20, 19, 24, 22], C.cyan)}
  ${statCard(230, 'CLICK-THROUGH', '6.8%', '+0.4', C.violet, [8, 12, 10, 15, 14, 18, 20], C.violet)}

  <!-- bottom row: title + keyword search chip -->
  <text x="60" y="316" fill="#ffffff" font-size="13" font-weight="700">${title1}</text>
  ${title2 ? `<text x="60" y="333" fill="#00ff88" font-size="11" font-weight="600">${title2}</text>` : ''}
  <rect x="460" y="308" width="280" height="30" rx="15" fill="rgba(0,242,255,0.06)" stroke="rgba(0,242,255,0.45)" stroke-width="1"/>
  <circle cx="478" cy="323" r="5" fill="none" stroke="${C.cyan}" stroke-width="1.6"/>
  <line x1="482" y1="327" x2="487" y2="332" stroke="${C.cyan}" stroke-width="1.6" stroke-linecap="round"/>
  <text x="494" y="326" fill="${C.cyan}" font-size="11" font-weight="600">${keyword}</text>

  <!-- footer -->
  <line x1="40" y1="368" x2="760" y2="368" stroke="rgba(0,242,255,0.18)" stroke-width="1"/>
  <text x="400" y="386" text-anchor="middle" fill="${C.muted}" font-size="9.5">yt-seo-architect.vercel.app/blog · 17 free tools, no credit card</text>
</svg>`;
}

// ── Rasterize with headless chrome ─────────────────────────────────
function shot(htmlPath, pngPath, w, h) {
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--force-device-scale-factor=1`, `--window-size=${w},${h}`,
    `--screenshot=${pngPath}`, `file://${htmlPath}`,
  ], { stdio: 'pipe' });
}

// ── Main ───────────────────────────────────────────────────────────
const { a: t1, b: t2 } = wrapTitle(TITLE_L1, TITLE_L2);
const svg = sceneSvg({ title1: t1, title2: t2, keyword: KEYWORD, badge: BADGE });

// hero 800×400
const heroHtml = `${svg}`;
const heroPath = join(TMP, `${SLUG}-hero.html`);
writeFileSync(heroPath, heroHtml);
const heroPng = join(OUT, `${SLUG}-hero.png`);
shot(heroPath, heroPng, 800, 400);

// og 1200×630 (same scene scaled 1.5, vertically centered)
const ogHtml = `<div style="width:1200px;height:630px;margin:0;overflow:hidden;background:#0a0b10"><div style="transform:translateY(15px) scale(1.5);transform-origin:top left;width:800px;height:400px">${svg}</div></div>`;
const ogPath = join(TMP, `${SLUG}-og.html`);
writeFileSync(ogPath, ogHtml);
const ogPng = join(OUT, `${SLUG}-og.png`);
shot(ogPath, ogPng, 1200, 630);

// webp variants
const heroWebp = join(OUT, `${SLUG}-hero.webp`);
execFileSync('ffmpeg', ['-y', '-i', heroPng, '-c:v', 'libwebp', '-quality', '82', heroWebp], { stdio: 'pipe' });

console.log(`✅ ${SLUG}-hero.png (800×400)`);
console.log(`✅ ${SLUG}-hero.webp`);
console.log(`✅ ${SLUG}-og.png (1200×630)`);
