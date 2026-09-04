#!/usr/bin/env node
/**
 * Ensures the /guides hub (public/guides/index.html) lists the 4 pillar guides.
 * The daily workflow regenerates the hub from generate-guides.mjs (tool-guides
 * only) — this script re-injects the pillar section if missing. Idempotent.
 *
 * Usage: node scripts/add-pillar-cards-to-guides-hub.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const HUB = resolve(PROJECT, 'public/guides/index.html');
const DRY_RUN = process.argv.includes('--dry-run');

const PILLAR_SECTION = `
    <h2 class="section-title">Pillar Guides <small>Complete systems with cluster articles, checklists, and mini case studies — 1,500+ words each</small></h2>
    <div class="index-grid">
      <a href="/guides/youtube-seo-strategy-2026" class="index-card chart-entrance">
        <div class="card-header"><strong>Complete YouTube SEO Strategy 2026</strong><span class="card-badge">Pillar</span></div>
        <div class="card-body">The 7-layer system that ranks: search intent, keyword research, packaging, metadata, retention, session time, and authority — with a pre-upload checklist.</div>
        <div class="card-footer">18 min read · 8 cluster articles</div>
      </a>
      <a href="/guides/youtube-keyword-research-master-guide" class="index-card chart-entrance">
        <div class="card-header"><strong>YouTube Keyword Research Master Guide</strong><span class="card-badge">Pillar</span></div>
        <div class="card-body">Five research methods, a demand-vs-competition scoring system, the long-tail strategy, and a 90-day keyword bank workflow.</div>
        <div class="card-footer">16 min read · 7 cluster articles</div>
      </a>
      <a href="/guides/youtube-metadata-optimization" class="index-card chart-entrance">
        <div class="card-header"><strong>YouTube Metadata Optimization</strong><span class="card-badge">Pillar</span></div>
        <div class="card-body">Titles that earn clicks, descriptions that rank, tags that help, chapters that win placements, and a monthly metadata audit workflow.</div>
        <div class="card-footer">15 min read · 9 cluster articles</div>
      </a>
      <a href="/guides/youtube-channel-growth-analytics" class="index-card chart-entrance">
        <div class="card-header"><strong>Channel Growth &amp; Analytics</strong><span class="card-badge">Pillar</span></div>
        <div class="card-body">Read your dashboard like a consultant: impressions × CTR × retention, the metrics that matter at your channel size, and a monthly growth workflow.</div>
        <div class="card-footer">16 min read · 8 cluster articles</div>
      </a>
    </div>
`;

let html = readFileSync(HUB, 'utf-8');

if (html.includes('Pillar Guides')) {
  console.log('⏭ Pillar section already present — nothing to do');
  process.exit(0);
}

// Insert after the hero div (before the first container content)
const heroEnd = html.indexOf('</div>', html.indexOf('class="hero"'));
if (heroEnd === -1) {
  console.error('⚠ Could not find hero section in hub');
  process.exit(1);
}
const insertPos = heroEnd + 6;
html = html.slice(0, insertPos) + PILLAR_SECTION + '\n' + html.slice(insertPos);

if (!DRY_RUN) writeFileSync(HUB, html);
console.log(`${DRY_RUN ? '[dry] ' : ''}✅ Pillar section injected into ${HUB}`);
