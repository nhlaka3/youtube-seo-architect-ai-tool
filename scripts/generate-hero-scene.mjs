#!/usr/bin/env node
/**
 * scripts/generate-hero-scene.mjs
 *
 * Blog hero + OG image generator — "dashboard product-shot" style, UNIQUE
 * per post. The hero embeds the post's OWN first inline chart (so every
 * hero differs, matching the per-post charts), with stat cards pulled from
 * real numbers in the post text, the post title, and a keyword search chip.
 *
 * Falls back to a hash-perturbed retention scene (different curve shape +
 * accent color + stat values per slug) when a post has no inline chart.
 *
 * Usage:
 *   node scripts/generate-hero-scene.mjs <slug> "<title L1>" "<title L2>" \
 *        "<keyword>" "<badge>" [--chart=<extracted-svg-path>] [--stats="L|V|D;L|V|D;L|V|D"]
 *
 * Outputs (overwrites in place — posts keep referencing the same paths):
 *   public/blog/<slug>-hero.png   (800×400 article hero)
 *   public/blog/<slug>-hero.webp  (WebP variant)
 *   public/blog/<slug>-og.png     (1200×630 Open Graph)
 *
 * Requires: cached Playwright chrome-headless-shell + ffmpeg.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, join } from 'path';
import { homedir } from 'os';

const args = process.argv.slice(2);
const get = (i) => args[i] || '';
const flag = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : '';
};
const SLUG = get(0) || 'generic';
const TITLE_L1 = get(1) || 'Blog Post';
const TITLE_L2 = get(2) || '';
const KEYWORD = get(3) || 'youtube seo tips 2026';
const BADGE = (get(4) || 'BLOG').toUpperCase();
const CHART_FILE = flag('chart');
const STATS_RAW = flag('stats');

const OUT = resolve(process.cwd(), 'public', 'blog');
mkdirSync(OUT, { recursive: true });
const TMP = '/tmp/hero-scenes';
mkdirSync(TMP, { recursive: true });

// ── Chrome discovery ───────────────────────────────────────────────
function findChrome() {
  for (const base of [join(homedir(), '.cache', 'ms-playwright'), '/home/nhlaka/.cache/ms-playwright']) {
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
  console.error('✋ chrome-headless-shell not found. Run: npx playwright install chrome-headless-shell');
  process.exit(1);
}

// ── Deterministic per-slug variation ───────────────────────────────
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const H = hashStr(SLUG);
const ACCENTS = ['#00f2ff', '#00ff88', '#a78bfa', '#fbbf24'];
const ACCENT = ACCENTS[H % 4];

// ── Stat cards: real post numbers when available, else hashed ──────
function parseStats(raw) {
  const out = [];
  if (raw) {
    for (const part of raw.split(';')) {
      const [l, v, d] = part.split('|');
      if (l && v) out.push({ label: l, value: v, delta: d || '' });
      if (out.length === 3) break;
    }
  }
  const defs = [
    { label: 'VIEWS', value: `${15 + (H % 85)}.${(H >> 3) % 10}K`, delta: `+${5 + (H >> 4) % 40}%` },
    { label: 'WATCH TIME', value: `${(H >> 6) % 16 + 4}:${String((H >> 9) % 60).padStart(2, '0')}`, delta: 'avg' },
    { label: 'CTR', value: `${(4 + (H >> 12) % 6)}.${(H >> 15) % 10}%`, delta: `+${(H >> 18) % 15 / 10}` },
  ];
  while (out.length < 3) out.push(defs[out.length]);
  return out;
}
const STATS = parseStats(STATS_RAW);

// ── Chart embedding (the post's own first chart) ───────────────────
function loadChart() {
  if (!CHART_FILE || !existsSync(CHART_FILE)) return null;
  let svg = readFileSync(CHART_FILE, 'utf-8');
  const vb = svg.match(/viewBox="([\d.\s]+)"/);
  if (!vb) return null;
  const [vx, vy, vw, vh] = vb[1].trim().split(/\s+/).map(Number);
  // normalize the svg tag: fixed width/height from viewBox, no inline styles
  svg = svg.replace(/<svg[^>]*>/, `<svg width="${vw}" height="${vh}" viewBox="${vb[1]}" xmlns="http://www.w3.org/2000/svg">`);
  return { html: svg, vw, vh };
}
const CHART = loadChart();

// ── Retention fallback scene (hash-perturbed) ──────────────────────
function retentionPanel(accent) {
  const off = (H % 30) - 15; // vertical perturbation
  const curve = `M60 ${92 + off % 7} C 75 ${96 + off % 5} 85 ${100} 100 ${103} C 130 ${135 + off % 4} 170 ${165 + off % 6} 220 ${172 + off % 3} C 270 ${178} 300 ${184} 320 ${187} C 370 ${191} 410 ${195} 440 ${197}`;
  const area = curve + ' L 440 250 L 60 250 Z';
  return `
  <text x="60" y="80" fill="#8b8b9e" font-size="9" font-weight="700" letter-spacing="0.14em">RETENTION · WATCH TIME PER QUERY</text>
  <line x1="60" y1="90" x2="440" y2="90" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="130" x2="440" y2="130" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="170" x2="440" y2="170" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="210" x2="440" y2="210" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <line x1="60" y1="250" x2="440" y2="250" stroke="#2d215e" stroke-width="1.5"/>
  <text x="52" y="93" text-anchor="end" fill="#8b8b9e" font-size="8.5">100%</text>
  <text x="52" y="133" text-anchor="end" fill="#8b8b9e" font-size="8.5">75%</text>
  <text x="52" y="173" text-anchor="end" fill="#8b8b9e" font-size="8.5">50%</text>
  <text x="52" y="213" text-anchor="end" fill="#8b8b9e" font-size="8.5">25%</text>
  <rect x="60" y="90" width="40" height="160" fill="rgba(0,255,136,0.08)"/>
  <text x="80" y="104" text-anchor="middle" fill="#00ff88" font-size="8" font-weight="700">HOOK</text>
  <path d="${area}" fill="url(#retArea)"/>
  <path d="${curve}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="103" r="3.5" fill="#00ff88"/>
  <circle cx="220" cy="${172 + off % 3}" r="3.5" fill="#a78bfa"/>
  <line x1="220" y1="90" x2="220" y2="250" stroke="#a78bfa" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>
  <text x="60" y="266" fill="#8b8b9e" font-size="8.5">0:00</text>
  <text x="220" y="266" fill="#8b8b9e" font-size="8.5">3:00</text>
  <text x="330" y="266" fill="#8b8b9e" font-size="8.5">6:00</text>
  <text x="440" y="266" fill="#8b8b9e" font-size="8.5">10:00</text>
  <text x="60" y="284" fill="#8b8b9e" font-size="8.5">drops at a timestamp = fixable script moment</text>`;
}

// ── Left panel: the post's chart, or the perturbed retention scene ─
function leftPanel() {
  if (CHART) {
    const scale = 370 / CHART.vw; // fit 370px-wide panel
    const ch = CHART.vh * scale;
    const y = 82 + Math.max(0, (166 - ch) / 2);
    return `
  <text x="60" y="80" fill="#8b8b9e" font-size="9" font-weight="700" letter-spacing="0.14em">FEATURED CHART · FROM THIS GUIDE</text>
  <g transform="translate(60 ${y.toFixed(1)}) scale(${scale.toFixed(3)})" clip-path="none">
    ${CHART.html}
  </g>`;
  }
  return retentionPanel(ACCENT);
}

// ── Scene ──────────────────────────────────────────────────────────
function sceneSvg() {
  const W = 800, H = 400;
  const spark = (bars, color) => bars.map((h, i) =>
    `<rect x="${532 + i * 16}" y="${150 - h}" width="9" height="${h}" rx="2" fill="${color}" opacity="0.85"/>`).join('');
  const statCard = (y, s, i) => {
    const c = [ACCENT, '#00ff88', '#a78bfa'][i % 3];
    const bars = [10 + (H + i * 7) % 14, 12 + (H + i * 11) % 12, 10 + (H + i * 5) % 16, 15 + (H + i * 13) % 14, 14 + (H + i * 3) % 15, 19 + (H + i * 17) % 12, 22 + (H + i * 9) % 10];
    const vx = 472 + 9.2 * s.value.length;
    return `
  <rect x="460" y="${y}" width="280" height="64" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="472" y="${y + 16}" fill="#8b8b9e" font-size="8.5" font-weight="700" letter-spacing="0.1em">${s.label}</text>
  <text x="472" y="${y + 38}" fill="#ffffff" font-size="16" font-weight="700">${s.value}</text>
  <text x="${vx}" y="${y + 38}" fill="${c}" font-size="10" font-weight="700">${s.delta}</text>
  ${spark(bars, c)}`;
  };

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
      <circle cx="1.5" cy="1.5" r="1" fill="rgba(255,255,255,0.045)"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="#0a0b10"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glowC)"/>
  <rect width="${W}" height="${H}" fill="url(#glowG)"/>
  <rect width="${W}" height="4" fill="url(#topbar)"/>

  <!-- window card -->
  <rect x="40" y="30" width="720" height="330" rx="14" fill="#101420" stroke="rgba(0,242,255,0.35)" stroke-width="1"/>
  <circle cx="62" cy="50" r="4" fill="#ff3366"/>
  <circle cx="78" cy="50" r="4" fill="#fbbf24"/>
  <circle cx="94" cy="50" r="4" fill="#00ff88"/>
  <rect x="112" y="38" width="300" height="22" rx="11" fill="rgba(255,255,255,0.04)"/>
  <text x="124" y="53" fill="#8b8b9e" font-size="9.5">yt-seo-architect.vercel.app/blog</text>
  <rect x="712" y="36" width="28" height="28" rx="6" fill="none" stroke="${ACCENT}" stroke-width="2"/>
  <path d="M720 44 L734 50 L720 56 Z" fill="${ACCENT}"/>
  <text x="748" y="55" fill="#8b8b9e" font-size="9.5">${BADGE}</text>

  ${leftPanel()}

  ${statCard(78, STATS[0], 0)}
  ${statCard(154, STATS[1], 1)}
  ${statCard(230, STATS[2], 2)}

  <!-- bottom row: title + keyword search chip -->
  <text x="60" y="316" fill="#ffffff" font-size="13" font-weight="700">${TITLE_L1}</text>
  ${TITLE_L2 ? `<text x="60" y="333" fill="#00ff88" font-size="11" font-weight="600">${TITLE_L2}</text>` : ''}
  <rect x="460" y="308" width="280" height="30" rx="15" fill="rgba(0,242,255,0.06)" stroke="rgba(0,242,255,0.45)" stroke-width="1"/>
  <circle cx="478" cy="323" r="5" fill="none" stroke="#00f2ff" stroke-width="1.6"/>
  <line x1="482" y1="327" x2="487" y2="332" stroke="#00f2ff" stroke-width="1.6" stroke-linecap="round"/>
  <text x="494" y="326" fill="#00f2ff" font-size="11" font-weight="600">${KEYWORD}</text>

  <!-- footer -->
  <line x1="40" y1="368" x2="760" y2="368" stroke="rgba(0,242,255,0.18)" stroke-width="1"/>
  <text x="400" y="386" text-anchor="middle" fill="#8b8b9e" font-size="9.5">yt-seo-architect.vercel.app/blog · 17 free tools, no credit card</text>

  <!-- force embedded chart animations to their final state for the raster -->
  <style>
    .bar-grow,.fade-in,.pop,.pulse,.draw-line{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}
  </style>
</svg>`;
}

// ── Rasterize ──────────────────────────────────────────────────────
function shot(htmlPath, pngPath, w, h) {
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    '--virtual-time-budget=4000', `--screenshot=${pngPath}`, `file://${htmlPath}`,
  ], { stdio: 'pipe' });
}

// ── Main ───────────────────────────────────────────────────────────
const svg = sceneSvg();
const heroHtml = `${svg}`;
const heroPath = join(TMP, `${SLUG}-hero.html`);
writeFileSync(heroPath, heroHtml);
const heroPng = join(OUT, `${SLUG}-hero.png`);
shot(heroPath, heroPng, 800, 400);

const ogHtml = `<div style="width:1200px;height:630px;margin:0;overflow:hidden;background:#0a0b10"><div style="transform:translateY(15px) scale(1.5);transform-origin:top left;width:800px;height:400px">${svg}</div></div>`;
const ogPath = join(TMP, `${SLUG}-og.html`);
writeFileSync(ogPath, ogHtml);
const ogPng = join(OUT, `${SLUG}-og.png`);
shot(ogPath, ogPng, 1200, 630);

const heroWebp = join(OUT, `${SLUG}-hero.webp`);
execFileSync('ffmpeg', ['-y', '-i', heroPng, '-c:v', 'libwebp', '-quality', '82', heroWebp], { stdio: 'pipe' });

console.log(`✅ ${SLUG}-hero.png (800×400) ${CHART ? 'with own chart' : 'fallback scene'} | stats: ${STATS.map((s) => s.label + '=' + s.value).join(', ')}`);
console.log(`✅ ${SLUG}-hero.webp`);
console.log(`✅ ${SLUG}-og.png (1200×630)`);
