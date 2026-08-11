#!/usr/bin/env node
/**
 * scripts/generate-hero-scene.mjs — v3: TOPIC-BASED hero scenes.
 *
 * Classifies each post (slug/title keywords) into a distinct scene archetype
 * and renders a full-bleed on-brand illustration — SERP mockup, thumbnail
 * card, phone reel, retention curve, growth chart, tag cluster, roadmap,
 * checklist, gaming controller, kitchen, dumbbells, audio waveform, etc.
 * No dashboard frame, so heroes differ by COMPOSITION, not just colors.
 *
 * Rasterized with the cached headless Chromium → PNG + WebP + OG.
 *
 * Usage:
 *   node scripts/generate-hero-scene.mjs <slug> "<title L1>" "<title L2>" "<keyword>" "<badge>"
 *
 * Outputs: public/blog/<slug>-hero.png (800×400), -hero.webp, -og.png (1200×630)
 */
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, join } from 'path';
import { homedir } from 'os';

const args = process.argv.slice(2);
// Env-based args (CI-safe: no shell quoting issues with titles/keywords)
const SLUG = process.env.HERO_SLUG || args[0] || 'generic';
const TITLE_L1 = process.env.HERO_TITLE_1 || args[1] || 'Blog Post';
const TITLE_L2 = process.env.HERO_TITLE_2 || args[2] || '';
const KEYWORD = process.env.HERO_KEYWORD || args[3] || 'youtube seo tips 2026';
const BADGE = (process.env.HERO_BADGE || args[4] || 'BLOG').toUpperCase();

const OUT = resolve(process.cwd(), 'public', 'blog');
mkdirSync(OUT, { recursive: true });
const TMP = '/tmp/hero-scenes';
mkdirSync(TMP, { recursive: true });

// ── Rasterizer: prefer rsvg-convert (GitHub runners, no Chrome), fall back
//    to the cached headless Chromium (local WSL) ─────────────────────
function hasCmd(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'pipe' }); return true; } catch { return false; }
}
const RSVG = hasCmd('rsvg-convert');
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
const CHROME = RSVG ? null : findChrome();
if (!RSVG && !CHROME) {
  console.error('✋ No rasterizer found: install librsvg2-bin (apt) or playwright chrome-headless-shell');
  process.exit(1);
}

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const H = hashStr(SLUG);
const ACCENTS = ['#00f2ff', '#00ff88', '#a78bfa', '#fbbf24', '#ff3366', '#22d3ee', '#c084fc', '#34d399'];
const A = ACCENTS[H % 8];          // primary accent for this post
const A2 = ACCENTS[(H >> 4) % 8];  // secondary accent

// ── Archetype classification ───────────────────────────────────────
const TEXT = (SLUG + ' ' + TITLE_L1 + ' ' + TITLE_L2).toLowerCase();
// prefix match: \btag\w* matches tags/tagged; \bshort\w* matches shorts
const has = (words) => new RegExp('\\b(' + words.join('|') + ')\\w*').test(TEXT);
function classify() {
  if (has(['gaming', 'game', 'gamer'])) return 'gaming';
  if (has(['cook', 'recipe', 'kitchen', 'food'])) return 'cooking';
  if (has(['fitness', 'workout', 'exercise', 'health', 'gym'])) return 'fitness';
  if (has(['music', 'song', 'audio', 'sound', 'voice'])) return 'music';
  if (has(['podcast', 'dub', 'multilingual', 'language', 'translat'])) return 'audio';
  if (has(['short'])) return 'shorts';
  if (has(['monetiz', 'subscriber', 'revenue', 'sponsor', 'income', 'grow'])) return 'growth';
  if (has(['tag'])) return 'tags';
  if (has(['title', 'thumbnail', 'ctr', 'click', 'packaging'])) return 'thumbnail';
  if (has(['keyword', 'search', 'query', 'rank', 'algorithm', 'discovery'])) return 'serp';
  if (has(['retention', 'watch', 'analytics', 'engagement', 'audience', 'impression'])) return 'retention';
  if (has(['beginner', 'strategy', 'calendar', 'niche', 'brand', 'community', 'checklist', 'audit', 'diagnostic', 'fix', 'tool', 'compare', 'monitor', 'feature', 'plan'])) return 'roadmap';
  return 'default';
}
const ARCH = classify();

// ── Shared chrome ──────────────────────────────────────────────────
const bg = () => `
  <rect width="800" height="400" fill="#0a0b10"/>
  <rect width="800" height="400" fill="url(#dots)"/>
  <rect width="800" height="400" fill="url(#glowC)"/>
  <rect width="800" height="400" fill="url(#glowG)"/>
  <rect width="800" height="4" fill="url(#topbar)"/>`;

const chrome = (label) => {
  const KW = KEYWORD.length > 28 ? KEYWORD.slice(0, 27).trimEnd() + '…' : KEYWORD;
  return `
  <rect x="40" y="24" width="150" height="26" rx="13" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="58" y="41" fill="${A}" font-size="10" font-weight="700" letter-spacing="0.08em">${label}</text>
  <rect x="712" y="24" width="28" height="28" rx="6" fill="none" stroke="${A}" stroke-width="2"/>
  <path d="M720 32 L734 38 L720 44 Z" fill="${A}"/>
  <text x="66" y="352" fill="#ffffff" font-size="17" font-weight="700">${TITLE_L1}</text>
  ${TITLE_L2 ? `<text x="66" y="372" fill="#00ff88" font-size="12.5" font-weight="600">${TITLE_L2}</text>` : ''}
  <rect x="548" y="330" width="196" height="30" rx="15" fill="rgba(0,242,255,0.06)" stroke="rgba(0,242,255,0.45)" stroke-width="1"/>
  <circle cx="564" cy="345" r="5" fill="none" stroke="#00f2ff" stroke-width="1.6"/>
  <line x1="568" y1="349" x2="573" y2="354" stroke="#00f2ff" stroke-width="1.6" stroke-linecap="round"/>
  <text x="578" y="348" fill="#00f2ff" font-size="11" font-weight="600">${KW}</text>
  <line x1="40" y1="390" x2="760" y2="390" stroke="rgba(0,242,255,0.18)" stroke-width="1"/>
  <text x="400" y="396" text-anchor="middle" fill="#8b8b9e" font-size="8.5">yt-seo-architect.vercel.app/blog · 17 free tools, no credit card</text>`;
};

// ── Archetype scenes (each a distinct composition) ─────────────────
function sceneSerp() {
  const rows = Array.from({ length: 4 }, (_, i) => {
    const w = 330 - ((H >> (i * 3)) % 150);
    const c = i === 0 ? A : '#2d215e';
    return `
    <rect x="300" y="${120 + i * 46}" width="${w}" height="12" rx="4" fill="${c}" opacity="0.85"/>
    <rect x="300" y="${140 + i * 46}" width="${Math.min(150, w * 0.5)}" height="7" rx="3" fill="rgba(255,255,255,0.14)"/>
    <circle cx="318" cy="${126 + i * 46}" r="10" fill="rgba(255,255,255,0.08)"/>`;
  }).join('');
  return `
    <rect x="60" y="70" width="200" height="300" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <rect x="76" y="86" width="168" height="24" rx="12" fill="rgba(255,255,255,0.06)"/>
    <circle cx="90" cy="98" r="5" fill="none" stroke="${A}" stroke-width="1.6"/>
    <line x1="95" y1="102" x2="101" y2="108" stroke="${A}" stroke-width="1.6" stroke-linecap="round"/>
    <text x="112" y="102" fill="#cbd5e1" font-size="11" font-weight="600">YouTube search</text>
    <rect x="76" y="120" width="168" height="30" rx="8" fill="${A}" opacity="0.14"/>
    <text x="90" y="140" fill="${A}" font-size="11" font-weight="700">${KEYWORD.slice(0, 26)}</text>
    <text x="300" y="100" fill="#8b8b9e" font-size="12" font-weight="700">Search results</text>
    ${rows}
    <text x="300" y="330" fill="${A2}" font-size="11" font-weight="600">position 1 = the result search picks</text>`;
}

function sceneThumbnail() {
  return `
    <rect x="60" y="70" width="360" height="204" rx="14" fill="#101420" stroke="${A}" stroke-width="1.5"/>
    <rect x="76" y="86" width="328" height="152" rx="10" fill="url(#thumbGrad)"/>
    <circle cx="236" cy="162" r="26" fill="rgba(0,0,0,0.55)"/>
    <path d="M228 150 L250 162 L228 174 Z" fill="#ffffff"/>
    <rect x="92" y="248" width="240" height="11" rx="4" fill="rgba(255,255,255,0.75)"/>
    <rect x="92" y="265" width="150" height="8" rx="3" fill="rgba(255,255,255,0.22)"/>
    <circle cx="452" cy="110" r="34" fill="none" stroke="${A2}" stroke-width="8" stroke-dasharray="190 24" transform="rotate(-90 452 110)"/>
    <text x="452" y="108" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="700">${4 + (H % 9)}.${H % 10}%</text>
    <text x="452" y="126" text-anchor="middle" fill="#8b8b9e" font-size="9" font-weight="700">CTR</text>
    <text x="452" y="180" text-anchor="middle" fill="${A}" font-size="11" font-weight="700">thumbnails drive clicks</text>
    <rect x="452" y="200" width="150" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="452" y="216" width="100" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>`;
}

function sceneShorts() {
  return `
    <rect x="180" y="70" width="140" height="290" rx="18" fill="#101420" stroke="${A}" stroke-width="1.5"/>
    <rect x="192" y="88" width="116" height="206" rx="10" fill="url(#reelGrad)"/>
    <circle cx="250" cy="185" r="18" fill="rgba(0,0,0,0.5)"/>
    <path d="M244 176 L262 185 L244 194 Z" fill="#ffffff"/>
    <rect x="224" y="306" width="52" height="6" rx="3" fill="rgba(255,255,255,0.25)"/>
    <circle cx="250" cy="332" r="14" fill="none" stroke="${A2}" stroke-width="2"/>
    <path d="M244 328 L252 332 L244 336 Z" fill="${A2}"/>
    <rect x="430" y="80" width="180" height="14" rx="5" fill="rgba(255,255,255,0.2)"/>
    <rect x="430" y="106" width="140" height="10" rx="4" fill="rgba(255,255,255,0.12)"/>
    <rect x="430" y="140" width="170" height="60" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="442" y="168" fill="${A}" font-size="11" font-weight="700">Shorts = own surface</text>
    <text x="442" y="184" fill="#8b8b9e" font-size="9.5">separate feed &amp; ranking logic</text>
    <rect x="430" y="214" width="170" height="60" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="442" y="242" fill="${A2}" font-size="11" font-weight="700">Reel → long-form funnel</text>
    <text x="442" y="258" fill="#8b8b9e" font-size="9.5">use Shorts to point at your library</text>
    <path d="M420 330 L490 300 L560 320 L630 290" fill="none" stroke="${A}" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>`;
}

function sceneGrowth() {
  const bars = [40, 70, 55, 95, 75, 120, 150].map((b, i) => {
    const bh = (b + ((H >> (i * 2)) % 36)) * 1.05;
    return `<rect x="${120 + i * 55}" y="${250 - bh}" width="36" height="${bh}" rx="6" fill="${i === 6 ? A : 'rgba(255,255,255,0.12)'}"/>`;
  }).join('');
  const lineY = 240 - ((H >> 3) % 30);
  return `
    <text x="130" y="90" fill="#ffffff" font-size="30" font-weight="700">${15 + (H % 80)}.${(H >> 3) % 10}K</text>
    <text x="130" y="110" fill="#8b8b9e" font-size="11">subscribers · up <tspan fill="${A}">+${8 + (H % 40)}%</tspan> this month</text>
    <line x1="120" y1="250" x2="530" y2="250" stroke="#2d215e" stroke-width="1.5"/>
    <line x1="120" y1="180" x2="530" y2="180" stroke="rgba(255,255,255,0.06)"/>
    <line x1="120" y1="110" x2="530" y2="110" stroke="rgba(255,255,255,0.06)"/>
    ${bars}
    <path d="M120 ${lineY} C 200 ${lineY - 20} 260 ${lineY - 50} 340 ${lineY - 80} C 420 ${lineY - 110} 470 ${lineY - 140} 540 ${lineY - 170}" fill="none" stroke="${A2}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="540" cy="${lineY - 170}" r="6" fill="${A2}"/>
    <rect x="560" y="70" width="170" height="70" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="574" y="96" fill="#8b8b9e" font-size="9.5">compounding authority</text>
    <text x="574" y="112" fill="#cbd5e1" font-size="11" font-weight="600">one niche, consistent cadence</text>
    <text x="574" y="128" fill="${A}" font-size="10">quality compounds slowly →</text>`;
}

function sceneRetention() {
  const off = (H % 20) - 10;
  const curve = `M90 ${130 + off % 5} C 140 ${120 + off % 4} 180 ${105 + off % 6} 220 ${110 + off % 3} C 300 ${122 + off % 4} 380 ${165 + off % 5} 460 ${172 + off % 3} C 540 ${179} 620 ${180 + off % 3} 690 ${178 + off % 2}`;
  return `
    <text x="90" y="84" fill="#ffffff" font-size="17" font-weight="700">Retention is the ranking signal</text>
    <line x1="90" y1="105" x2="690" y2="105" stroke="rgba(255,255,255,0.06)"/>
    <line x1="90" y1="140" x2="690" y2="140" stroke="rgba(255,255,255,0.06)"/>
    <line x1="90" y1="175" x2="690" y2="175" stroke="rgba(255,255,255,0.06)"/>
    <line x1="90" y1="210" x2="690" y2="210" stroke="#2d215e" stroke-width="1.5"/>
    <rect x="90" y="105" width="52" height="105" fill="rgba(0,255,136,0.1)"/>
    <text x="116" y="122" text-anchor="middle" fill="#00ff88" font-size="9" font-weight="700">HOOK 30s</text>
    <path d="${curve} L 690 210 L 90 210 Z" fill="url(#retArea)"/>
    <path d="${curve}" fill="none" stroke="${A}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="220" cy="${110 + off % 3}" r="5" fill="#00ff88"/>
    <circle cx="460" cy="${172 + off % 3}" r="5" fill="${A2}"/>
    <line x1="460" y1="105" x2="460" y2="210" stroke="${A2}" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.6"/>
    <text x="472" y="160" fill="${A2}" font-size="10.5" font-weight="600">drops = fixable script moments</text>
    <text x="90" y="240" fill="#8b8b9e" font-size="9.5">0:00 · 0:30 · 1:00 · 3:00 · 5:00 · 8:00 · 10:00</text>
    <rect x="540" y="250" width="150" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="540" y="266" width="110" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>`;
}

function sceneTags() {
  const base = ['SEO', '2026', 'tutorial', 'how-to', 'beginners', 'ranking', 'tips', 'growth', 'analytics', 'metadata', 'shorts', 'algorithm'];
  const tags = base.map((t, i) => {
    const j = (i + H) % base.length; // rotate order per post
    const x = 90 + (j % 4) * 150 + ((H >> j) % 30);
    const y = 110 + Math.floor(j / 4) * 70 + ((H >> (j + 3)) % 20);
    const c = [A, A2, '#00ff88', '#8b8b9e'][j % 4];
    return `<rect x="${x}" y="${y}" width="${70 + t.length * 7}" height="30" rx="15" fill="${c}" opacity="0.14" stroke="${c}" stroke-width="1.2"/><text x="${x + 18}" y="${y + 20}" fill="${c}" font-size="11" font-weight="700">${t}</text>`;
  }).join('');
  return `
    <text x="90" y="80" fill="#ffffff" font-size="17" font-weight="700">Tags play a minimal role</text>
    ${tags}
    <rect x="90" y="300" width="340" height="44" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="106" y="326" fill="#cbd5e1" font-size="11" font-weight="600">official help: "tags play a minimal role in discovery"</text>
    <circle cx="560" cy="180" r="52" fill="none" stroke="${A}" stroke-width="7" stroke-dasharray="300 27" transform="rotate(-90 560 180)"/>
    <text x="560" y="176" text-anchor="middle" fill="#ffffff" font-size="19" font-weight="700">minimal</text>
    <text x="560" y="194" text-anchor="middle" fill="#8b8b9e" font-size="9.5">role</text>`;
}

function sceneRoadmap() {
  const jit = (H % 24) - 12;
  const steps = ['Research', 'Package', 'Publish', 'Audit'].map((s, i) => {
    const x = 70 + i * 170 + (i % 2 ? jit : -jit / 2);
    const c = [A, A2, '#00ff88', '#a78bfa'][i];
    return `
    <circle cx="${x + 40}" cy="170" r="26" fill="rgba(255,255,255,0.04)" stroke="${c}" stroke-width="2"/>
    <text x="${x + 40}" y="175" text-anchor="middle" fill="${c}" font-size="12" font-weight="700">${i + 1}</text>
    <text x="${x + 40}" y="220" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="600">${s}</text>
    ${i < 3 ? `<path d="M${x + 78} 170 C ${x + 100} 170 ${x + 120} 170 ${x + 142} 170" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-dasharray="5 4"/>` : ''}`;
  }).join('');
  return `
    <text x="90" y="90" fill="#ffffff" font-size="17" font-weight="700">A repeatable system, not a hack</text>
    <text x="90" y="110" fill="#8b8b9e" font-size="11">consistency is how topic authority compounds</text>
    ${steps}
    <rect x="90" y="260" width="300" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="90" y="276" width="220" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <rect x="480" y="250" width="220" height="60" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="496" y="276" fill="${A}" font-size="11" font-weight="700">calendar &gt; inspiration</text>
    <text x="496" y="293" fill="#8b8b9e" font-size="9.5">plan topics, stick to the niche</text>`;
}

function sceneAudio() {
  const wave = Array.from({ length: 26 }, (_, i) => {
    const h = 20 + ((H >> (i % 7)) % 60);
    return `<rect x="${80 + i * 20}" y="${200 - h / 2}" width="10" height="${h}" rx="5" fill="${i % 5 === 0 ? A : 'rgba(255,255,255,0.14)'}"/>`;
  }).join('');
  return `
    <text x="90" y="84" fill="#ffffff" font-size="17" font-weight="700">New discovery surfaces in 2026</text>
    ${wave}
    <rect x="480" y="100" width="220" height="64" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <circle cx="506" cy="132" r="16" fill="none" stroke="${A}" stroke-width="2"/>
    <path d="M500 126 L512 132 L500 138 Z" fill="${A}"/>
    <text x="532" y="128" fill="#cbd5e1" font-size="11" font-weight="600">Podcasts</text>
    <text x="532" y="144" fill="#8b8b9e" font-size="9.5">first-class format now</text>
    <rect x="480" y="178" width="220" height="64" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <circle cx="506" cy="210" r="14" fill="none" stroke="${A2}" stroke-width="2"/>
    <path d="M502 206 L506 210 L502 214 M506 206 L510 210 L506 214" fill="none" stroke="${A2}" stroke-width="1.6"/>
    <text x="532" y="206" fill="#cbd5e1" font-size="11" font-weight="600">Auto-dubbing</text>
    <text x="532" y="222" fill="#8b8b9e" font-size="9.5">multiply reach per video</text>
    <text x="90" y="330" fill="${A}" font-size="11" font-weight="600">structured, chaptered, captioned = retrievable</text>`;
}

function sceneGaming() {
  return `
    <rect x="120" y="120" width="360" height="150" rx="24" fill="#101420" stroke="${A}" stroke-width="1.5"/>
    <circle cx="210" cy="195" r="34" fill="rgba(255,255,255,0.05)"/>
    <circle cx="210" cy="195" r="22" fill="none" stroke="${A}" stroke-width="3"/>
    <circle cx="390" cy="195" r="34" fill="rgba(255,255,255,0.05)"/>
    <circle cx="390" cy="195" r="22" fill="none" stroke="${A2}" stroke-width="3"/>
    <rect x="292" y="162" width="36" height="30" rx="8" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <rect x="336" y="162" width="36" height="30" rx="8" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <circle cx="300" cy="168" r="4" fill="${A}"/>
    <circle cx="322" cy="186" r="4" fill="${A2}"/>
    <text x="540" y="150" fill="#cbd5e1" font-size="13" font-weight="700">Gaming channels</text>
    <rect x="540" y="165" width="180" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="540" y="182" width="140" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <text x="540" y="230" fill="#8b8b9e" font-size="10.5">the algorithm update changed</text>
    <text x="540" y="246" fill="${A}" font-size="11" font-weight="600">how gameplay content ranks →</text>`;
}

function sceneCooking() {
  return `
    <circle cx="260" cy="190" r="90" fill="#101420" stroke="${A}" stroke-width="1.5"/>
    <circle cx="260" cy="190" r="70" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    <circle cx="260" cy="190" r="46" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <path d="M300 150 a 34 34 0 0 1 0 68" fill="none" stroke="${A2}" stroke-width="5" stroke-linecap="round"/>
    <path d="M226 168 l 24 14 -8 26" fill="none" stroke="#00ff88" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M292 200 l -16 -12" stroke="rgba(255,255,255,0.2)" stroke-width="3" stroke-linecap="round"/>
    <text x="430" y="150" fill="#cbd5e1" font-size="13" font-weight="700">Cooking channels</text>
    <rect x="430" y="165" width="180" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="430" y="182" width="140" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <text x="430" y="230" fill="#8b8b9e" font-size="10.5">recipe + process videos rank on</text>
    <text x="430" y="246" fill="${A}" font-size="11" font-weight="600">engagement &amp; watch time →</text>`;
}

function sceneFitness() {
  return `
    <rect x="150" y="150" width="60" height="80" rx="12" fill="${A}" opacity="0.85"/>
    <rect x="380" y="150" width="60" height="80" rx="12" fill="${A2}" opacity="0.85"/>
    <rect x="205" y="168" width="180" height="44" rx="10" fill="#101420" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <rect x="250" y="182" width="90" height="16" rx="6" fill="rgba(255,255,255,0.15)"/>
    <circle cx="300" cy="210" r="4" fill="${A}"/>
    <text x="500" y="150" fill="#cbd5e1" font-size="13" font-weight="700">Fitness channels</text>
    <rect x="500" y="165" width="180" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="500" y="182" width="130" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <text x="500" y="230" fill="#8b8b9e" font-size="10.5">workout + transformation content</text>
    <text x="500" y="246" fill="${A}" font-size="11" font-weight="600">holds retention across sessions →</text>`;
}

function sceneMusic() {
  return `
    <circle cx="250" cy="200" r="80" fill="#101420" stroke="${A}" stroke-width="1.5"/>
    <path d="M210 200 a 40 40 0 1 1 40 40 L 250 160 Z" fill="${A}" opacity="0.9"/>
    <circle cx="250" cy="240" r="18" fill="none" stroke="#ffffff" stroke-width="5"/>
    <path d="M370 130 l 60 20 -14 60" fill="none" stroke="${A2}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M430 210 a 26 26 0 1 1 -52 0 a 26 26 0 1 1 52 0 Z" fill="none" stroke="${A2}" stroke-width="3"/>
    <rect x="470" y="150" width="170" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="470" y="167" width="130" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <text x="470" y="215" fill="#8b8b9e" font-size="10.5">music &amp; audio content ranks via</text>
    <text x="470" y="231" fill="${A}" font-size="11" font-weight="600">watch time + new surfaces →</text>`;
}

function sceneDefault() {
  return `
    <circle cx="300" cy="190" r="70" fill="#101420" stroke="${A}" stroke-width="2"/>
    <circle cx="300" cy="190" r="44" fill="rgba(0,242,255,0.12)"/>
    <path d="M288 170 L322 190 L288 210 Z" fill="${A}"/>
    <path d="M420 110 a 80 80 0 0 1 0 160" fill="none" stroke="${A2}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <circle cx="420" cy="270" r="6" fill="${A2}"/>
    <rect x="520" y="140" width="180" height="9" rx="4" fill="rgba(255,255,255,0.15)"/>
    <rect x="520" y="157" width="140" height="9" rx="4" fill="rgba(255,255,255,0.1)"/>
    <rect x="520" y="190" width="180" height="40" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    <text x="536" y="215" fill="#cbd5e1" font-size="11" font-weight="600">${KEYWORD.slice(0, 30)}</text>
    <path d="M520 260 L560 250 L600 262 L640 252" fill="none" stroke="${A}" stroke-width="2.5" stroke-linecap="round"/>`;
}

// ── Assemble scene ─────────────────────────────────────────────────
function sceneSvg() {
  const body = {
    serp: sceneSerp, thumbnail: sceneThumbnail, shorts: sceneShorts,
    growth: sceneGrowth, retention: sceneRetention, tags: sceneTags,
    roadmap: sceneRoadmap, audio: sceneAudio, gaming: sceneGaming,
    cooking: sceneCooking, fitness: sceneFitness, music: sceneMusic,
    default: sceneDefault,
  }[ARCH]();
  const label = ARCH === 'default' ? 'SEO GUIDE' : ARCH.toUpperCase();
  return `<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">
  <defs>
    <linearGradient id="topbar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f2ff"/><stop offset="100%" stop-color="#00ff88"/>
    </linearGradient>
    <linearGradient id="retArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#00f2ff" stop-opacity="0.03"/>
    </linearGradient>
    <linearGradient id="thumbGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1b4b"/><stop offset="55%" stop-color="#101420"/><stop offset="100%" stop-color="#0a0b10"/>
    </linearGradient>
    <linearGradient id="reelGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff3366" stop-opacity="0.35"/><stop offset="100%" stop-color="#101420"/>
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
  ${bg()}
  ${body}
  ${chrome(label)}
</svg>`;
}

function run(cmd, args, opts = {}) {
  try {
    execFileSync(cmd, args, { stdio: 'pipe', ...opts });
  } catch (e) {
    console.error(`❌ ${cmd} failed: ${e.message}`);
    if (e.stderr) console.error(String(e.stderr).slice(0, 2000));
    process.exit(1);
  }
}

function shot(svgStr, pngPath, w, h) {
  const svgPath = join(TMP, `${SLUG}-${w}x${h}.svg`);
  writeFileSync(svgPath, svgStr);
  if (RSVG) {
    run('rsvg-convert', ['-w', String(w), '-h', String(h), svgPath, '-o', pngPath]);
    return;
  }
  const htmlPath = join(TMP, `${SLUG}-${w}x${h}.html`);
  writeFileSync(htmlPath, `<div style="width:${w}px;height:${h}px;margin:0;overflow:hidden;background:#0a0b10"><div style="width:${w}px;height:${h}px">${svgStr}</div></div>`);
  run(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    '--virtual-time-budget=4000', `--screenshot=${pngPath}`, `file://${htmlPath}`,
  ]);
}

const svg = sceneSvg();
const heroPng = join(OUT, `${SLUG}-hero.png`);
shot(svg, heroPng, 800, 400);

// OG 1200×630: render the 2:1 scene at 1200×600, pad 15px top/bottom (no stretch)
const ogPng = join(OUT, `${SLUG}-og.png`);
if (RSVG) {
  const og600 = join(TMP, `${SLUG}-og-600.png`);
  shot(svg, og600, 1200, 600);
  run('ffmpeg', ['-y', '-i', og600, '-vf', 'pad=1200:630:0:15:color=#0a0b10', ogPng]);
} else {
  shot(svg, ogPng, 1200, 630);
}

const heroWebp = join(OUT, `${SLUG}-hero.webp`);
run('ffmpeg', ['-y', '-i', heroPng, '-c:v', 'libwebp', '-quality', '82', heroWebp]);

console.log(`✅ ${SLUG}-hero.png (800×400) archetype: ${ARCH} | raster: ${RSVG ? 'rsvg-convert' : 'chrome'}`);
