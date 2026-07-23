#!/usr/bin/env node
/**
 * Adds tool page links to all blog posts and updates cross-sell grids.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

// Tool link mapping by keyword
const TOOL_MAP = [
  { keywords: ['tag', 'tagging'], link: '/tools/tag-generator', text: 'AI Tag Generator', icon: '🏷️' },
  { keywords: ['title', 'ctr', 'click-through'], link: '/tools/title-optimizer', text: 'Title Optimizer', icon: '🎯' },
  { keywords: ['description', 'desc'], link: '/tools/description-writer', text: 'Description Writer', icon: '📝' },
  { keywords: ['keyword', 'search', 'rank'], link: '/tools/', text: 'Keyword Research Tool', icon: '🔍' },
  { keywords: ['audit', 'analyze', 'diagnostic'], link: '/dashboard', text: 'Channel Audit', icon: '📊' },
  { keywords: ['retention', 'watch time'], link: '/dashboard', text: 'Retention Analyzer', icon: '📈' },
  { keywords: ['thumbnail', 'ctr'], link: '/dashboard', text: 'Thumbnail Analyzer', icon: '🖼️' },
  { keywords: ['script', 'writing'], link: '/dashboard', text: 'Script Generator', icon: '📜' },
  { keywords: ['playlist'], link: '/dashboard', text: 'Playlist Strategist', icon: '▶️' },
  { keywords: ['competitor', 'reverse'], link: '/dashboard', text: 'Competitor Sniper', icon: '🎯' },
  { keywords: ['monetization', 'revenue', 'money'], link: '/dashboard', text: 'AI Coach', icon: '🤖' },
  { keywords: ['algorithm', 'algorithm'], link: '/tools/tag-generator', text: 'Tag Generator', icon: '🏷️' },
  { keywords: ['metadata'], link: '/tools/title-optimizer', text: 'Title Optimizer', icon: '🎯' },
  { keywords: ['hook', 'intro', 'first 3'], link: '/tools/title-optimizer', text: 'Title Optimizer', icon: '🎯' },
  { keywords: ['guide', 'tips', 'strategies'], link: '/tools/', text: 'Free SEO Tools', icon: '🔧' },
  { keywords: ['beginner', 'start'], link: '/tools/', text: 'Free SEO Tools', icon: '🔧' },
  { keywords: ['growth', 'grow'], link: '/dashboard', text: 'AI Coach', icon: '🤖' },
  { keywords: ['seo'], link: '/tools/tag-generator', text: 'Tag Generator', icon: '🏷️' },
  { keywords: ['shorts'], link: '/tools/tag-generator', text: 'Tag Generator', icon: '🏷️' },
  { keywords: ['shadow ban'], link: '/dashboard', text: 'Channel Audit', icon: '📊' },
];

function findBestTool(slug, content) {
  const lower = content.toLowerCase();
  // Score each tool
  let best = { link: '/tools/', text: 'Free YouTube SEO Tools', icon: '🔧', score: 0 };
  for (const tool of TOOL_MAP) {
    let score = 0;
    for (const kw of tool.keywords) {
      if (lower.includes(kw) || slug.includes(kw)) score += 2;
      // Bonus if keyword appears in first 500 chars
      if (lower.slice(0, 500).includes(kw)) score += 1;
    }
    if (score > best.score) {
      best = { ...tool, score };
    }
  }
  return best;
}

// Step 1: Add tool links to blog posts
console.log('=== Adding tool links to blog posts ===');
const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
let updated = 0;

for (const file of files) {
  const filePath = resolve(BLOG_DIR, file);
  const slug = file.replace('.html', '');
  let html = readFileSync(filePath, 'utf-8');

  // Skip if already has tool links
  if (html.includes('href="/tools/')) {
    console.log(`  ⏭ ${slug} — already has tool links`);
    continue;
  }

  const tool = findBestTool(slug, html);

  // Build CTA paragraph
  const cta = `\n<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;padding:1rem;margin:1.5rem 0;text-align:center;">\n  <p style="color:#e2e8f0;font-size:0.95rem;margin-bottom:0.5rem;">\n    🔧 <strong>Optimize your YouTube channel with free AI tools</strong>\n  </p>\n  <p style="color:#94a3b8;font-size:0.85rem;margin-bottom:0.75rem;">\n    Use the <a href="${tool.link}" style="color:#6366f1;font-weight:600;text-decoration:none;">${tool.icon} ${tool.text}</a> — no login required. Part of 17 free YouTube SEO tools.\n  </p>\n  <a href="/tools/" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:0.5rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.85rem;">View All Free Tools →</a>\n</div>\n`;

  // Insert before first <h2> or before </body>
  const h2Match = html.match(/<h2[\s>]/i);
  if (h2Match && h2Match.index > 200) {
    // Insert after the first paragraph after the intro section
    const insertAfter = html.indexOf('</h1>');
    if (insertAfter > -1) {
      const afterH1 = html.indexOf('>', html.indexOf('<p', insertAfter));
      if (afterH1 > -1) {
        const insertPos = html.indexOf('</p>', afterH1) + 4;
        html = html.slice(0, insertPos) + cta + html.slice(insertPos);
      } else {
        html = html.slice(0, insertAfter + 5) + cta + html.slice(insertAfter + 5);
      }
    } else {
      html = html.replace('</body>', cta + '\n</body>');
    }
  } else {
    html = html.replace('</body>', cta + '\n</body>');
  }

  writeFileSync(filePath, html);
  console.log(`  ✅ ${slug} → ${tool.text}`);
  updated++;
}

console.log(`\nUpdated ${updated}/${files.length} blog posts with tool links`);

// Step 2: Update cross-sell grids on tool pages
console.log('\n=== Updating tool page cross-sell grids ===');
const toolPages = [
  resolve(PROJECT, 'public/tools/tag-generator.html'),
  resolve(PROJECT, 'public/tools/title-optimizer.html'),
  resolve(PROJECT, 'public/tools/description-writer.html'),
];

for (const filePath of toolPages) {
  if (!existsSync(filePath)) continue;
  let html = readFileSync(filePath, 'utf-8');
  const slug = filePath.split('/').pop().replace('.html', '');

  // Replace /dashboard links in the "More Free YouTube SEO Tools" section with /tools/
  // Only in the tools grid section (not the header CTA)
  const gridSection = html.match(/<section class="tools-grid">[\s\S]*?<\/section>/);
  if (gridSection) {
    const updatedGrid = gridSection[0]
      .replace(/href="\/dashboard"/g, 'href="/tools/"');
    html = html.replace(gridSection[0], updatedGrid);
    writeFileSync(filePath, html);
    console.log(`  ✅ ${slug} — grid links updated`);
  }
}

console.log('\n=== Complete ===');
