#!/usr/bin/env node
/**
 * Adds "part of the pillar cluster" links to cluster blog posts (public/blog/*.html).
 * Each pillar in scripts/pillars-data.js lists its cluster articles; this script
 * injects a compact box linking back to the pillar with descriptive anchor text.
 *
 * Usage: node scripts/add-pillar-links.mjs [--dry-run] [--force]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PILLARS } from './pillars-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Build slug → pillar map from the pillar data (cluster URLs are /blog/<slug>)
const slugToPillar = {};
for (const p of PILLARS) {
  for (const [, url] of p.clusters) {
    const m = url.match(/\/blog\/([a-z0-9-]+)/);
    if (m) slugToPillar[m[1]] = p;
  }
}

const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
let added = 0, skipped = 0, noMatch = 0;

for (const file of files) {
  const filePath = resolve(BLOG_DIR, file);
  const slug = file.replace('.html', '');
  const pillar = slugToPillar[slug];
  if (!pillar) { noMatch++; continue; }

  let html = readFileSync(filePath, 'utf-8');
  if (html.includes('class="pillar-cta"')) {
    if (!FORCE) { skipped++; continue; }
    html = html.replace(/<div class="pillar-cta"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*/gi, '');
  }

  const pillarUrl = `/guides/${pillar.slug}`;
  const pillarName = pillar.h1.split(':')[0];
  const box = `
      <div class="pillar-cta" style="background:rgba(0,242,255,0.04);border-left:3px solid #00f2ff;border-radius:8px;padding:.7rem 1rem;margin:1.25rem 0;font-size:.93rem;color:#cbd5e1;">
        📖 This article is part of the <a href="${pillarUrl}" style="color:#00f2ff;text-decoration:none;font-weight:600;">${pillarName}</a> cluster — read the full guide for the complete system.
      </div>`;

  // Insert after the template-cta (if present) so CTAs stack cleanly, else before first content h2
  const tplIdx = html.indexOf('class="template-cta"');
  if (tplIdx > -1) {
    // find the end of the template-cta div block
    const blockEnd = html.indexOf('</div>', html.indexOf('Open the Template →'));
    if (blockEnd > -1) {
      const insertPos = html.indexOf('</div>', blockEnd + 6) + 6;
      html = html.slice(0, insertPos) + box + html.slice(insertPos);
      if (!DRY_RUN) writeFileSync(filePath, html);
      added++;
      console.log(`  ✅ ${slug} → /guides/${pillar.slug}`);
      continue;
    }
  }
  const h2s = [...html.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/gi)];
  const contentH2 = h2s.find(m => !/in this article|table of contents|overview|tldr/i.test(m[0]));
  if (contentH2 && contentH2.index > 200) {
    html = html.slice(0, contentH2.index) + box + '\n\n' + html.slice(contentH2.index);
  } else {
    html = html.replace('</body>', box + '\n</body>');
  }
  if (!DRY_RUN) writeFileSync(filePath, html);
  added++;
  console.log(`  ✅ ${slug} → /guides/${pillar.slug}`);
}

console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}added ${added}, already-done ${skipped}, no-match ${noMatch} of ${files.length} posts`);
