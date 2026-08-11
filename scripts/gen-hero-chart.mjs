#!/usr/bin/env node
/**
 * scripts/gen-hero-chart.mjs
 * Emit a per-post chart SVG for hero scenes: rotates chart TYPE (keyword
 * opportunity / metadata scorecard / publish flow) and COLOR PALETTE by slug
 * hash, so every post's hero chart is visibly distinct. Prints the <svg> to
 * stdout.
 * Usage: node scripts/gen-hero-chart.mjs <slug> "<keyword>"
 */
import { generatePostVisuals } from './blog-visuals.mjs';

const slug = process.argv[2] || 'generic';
const keyword = process.argv[3] || slug;

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const H = hash(slug);

const PALETTES = [
  ['#00f2ff', '#00ff88', '#a78bfa', '#fbbf24'], // cyber-luxe signature
  ['#ff3366', '#00f2ff', '#fbbf24', '#a78bfa'],
  ['#4ade80', '#60a5fa', '#f472b6', '#a3e635'],
  ['#22d3ee', '#c084fc', '#fb923c', '#34d399'],
  ['#818cf8', '#fbbf24', '#f472b6', '#2dd4bf'],
  ['#f43f5e', '#38bdf8', '#a3e635', '#f59e0b'],
  ['#00ff88', '#00f2ff', '#f472b6', '#fbbf24'],
  ['#38bdf8', '#a78bfa', '#34d399', '#f43f5e'],
];

// NOTE: idx and palette MUST use independent bits of the hash — H % 2 and
// H % 6 are correlated (H%6=5 ⟹ H%3=2), which collapses variety.
const idx = H % 2; // keyword-opportunity | metadata scorecard (both data-vary)
const pal = PALETTES[(H >> 5) % PALETTES.length];
let svg = generatePostVisuals({ slug, keyword })[idx].figure_html.match(/<svg[\s\S]*?<\/svg>/)[0];

// recolor the four bar/box colors to this post's palette (labels follow)
const OLD = ['#4ade80', '#fb923c', '#a5b4fc', '#f472b6'];
OLD.forEach((c, i) => { svg = svg.split(c).join(pal[i]); });

process.stdout.write(svg);
