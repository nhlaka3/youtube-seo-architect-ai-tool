#!/usr/bin/env node
/**
 * Adds /templates page links to all static blog posts (public/blog/*.html).
 * Mirrors the template CTA logic in api/blog-renderer.js (TEMPLATE_BLOG_MAP +
 * keyword fallback). When a template matches, the generic tool CTA box is
 * replaced by the template CTA so only one CTA box renders per post.
 *
 * Usage: node scripts/add-template-links.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Curated blog-slug → template-page map (keep in sync with api/blog-renderer.js)
const TEMPLATE_BLOG_MAP = {
  "youtube-description-templates-2026": "youtube-description-template",
  "youtube-title-examples-2026": "youtube-title-template",
  "youtube-tags-2026": "youtube-tags-template",
  "youtube-thumbnail-tips-2026": "youtube-thumbnail-template",
  "creating-effective-youtube-thumbnails-for-clicks-2026": "youtube-thumbnail-ideas",
  "what-does-youtube-ctr-actually-mean": "youtube-thumbnail-template",
  "youtube-end-screens-cards-guide-2026": "youtube-end-screen-template",
  "youtube-intro-hook-first-3-seconds": "youtube-intro-template",
  "youtube-seo-for-gaming-channels-2026": "youtube-tags-for-gaming",
  "youtube-shorts-seo-guide-2026": "youtube-description-template-for-shorts",
  "youtube-shorts-seo-ranking-guide-2026": "youtube-description-template-for-shorts",
  "youtube-seo-checklist-beginners-2026": "youtube-description-template",
  "youtube-video-not-getting-views-diagnostic-fix-2026": "youtube-description-template-copy-paste",
  "youtube-seo-examples-2026": "youtube-title-ideas",
  "youtube-for-tutorials-2026": "youtube-video-description-template-copy",
  "how-to-increase-youtube-retention-2026": "youtube-video-script-template",
  "increasing-youtube-watch-time-with-analytics-2026": "youtube-chapters-template",
  "youtube-analytics-explained-2026": "youtube-chapters-template",
  "youtube-channel-branding-tips-for-consistency-2026": "youtube-thumbnail-template",
  "youtube-impressions-guide-2026": "youtube-title-template",
  "using-youtube-features-to-enhance-viewer-experience-2026": "youtube-end-screen-template",
  "youtube-playlist-optimization-strategy": "youtube-end-screen-template",
  "youtube-seo-template-2026": "youtube-description-template-copy-paste",
};

const KEYWORD_RULES = [
  ["description", "youtube-description-template"],
  ["title", "youtube-title-template"],
  ["tag", "youtube-tags-template"],
  ["thumbnail", "youtube-thumbnail-template"],
  ["end-screen", "youtube-end-screen-template"],
  ["intro", "youtube-intro-template"],
  ["outro", "youtube-outro-template"],
  ["script", "youtube-video-script-template"],
  ["chapter", "youtube-chapters-template"],
  ["retention", "youtube-video-script-template"],
  ["shorts", "youtube-description-template-for-shorts"],
  ["gaming", "youtube-tags-for-gaming"],
  ["vlog", "youtube-description-template-for-vlogs"],
];

// Template display names — imported from the generator dataset (single source)
const data = JSON.parse(readFileSync(resolve(PROJECT, 'scripts/templates-data.json'), 'utf-8'));
const TEMPLATE_NAMES = {};
for (const t of data.templates) TEMPLATE_NAMES[t.slug] = t.title.replace(/\(2026\).*/, '').replace(/\s*:\s*.*/, '').trim() || t.slug;

function findTemplateKey(slug) {
  let key = TEMPLATE_BLOG_MAP[slug];
  if (!key) {
    const check = slug.toLowerCase();
    for (const [kw, s] of KEYWORD_RULES) {
      if (check.includes(kw)) { key = s; break; }
    }
  }
  return key;
}

// The generic tool-CTA box injected by add-tool-links.mjs (🔧 background #1a1a2e)
const TOOL_CTA_RE = /<div style="background:#1a1a2e;border:1px solid #2a2a4a;[\s\S]*?View All Free Tools →<\/a>\s*<\/div>\s*<\/div>/i;

const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
let added = 0, replaced = 0, skipped = 0, noMatch = 0;

for (const file of files) {
  const filePath = resolve(BLOG_DIR, file);
  const slug = file.replace('.html', '');
  let html = readFileSync(filePath, 'utf-8');

  if (html.includes('class="template-cta"')) {
    if (!FORCE) { skipped++; continue; }
    // strip existing template CTA blocks for re-insertion
    html = html.replace(/<div class="template-cta"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*/gi, '');
  }

  const templateKey = findTemplateKey(slug);
  if (!templateKey) { noMatch++; continue; }

  const templateName = TEMPLATE_NAMES[templateKey] || 'Copy-Paste Template';
  const cta = `
      <div class="template-cta" style="margin:2.5rem 0;padding:1.5rem;background:rgba(0,255,136,0.04);border:1px solid rgba(0,255,136,0.2);border-radius:12px;text-align:center;">
        <h3 style="color:var(--green, #00ff88);margin-bottom:0.5rem;">📋 Get the Copy-Paste Template</h3>
        <p style="color:#a8b2c1;margin-bottom:1rem;">Skip the guesswork — grab the ${templateName} with fill-in-the-blank sections, usage notes, and niche variations.</p>
        <a href="/templates/${templateKey}" style="display:inline-block;background:var(--green, #00ff88);color:#000;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;">Open the Template →</a>
      </div>`;

  // Template wins: remove the generic tool CTA box if present
  let removedTool = false;
  if (TOOL_CTA_RE.test(html)) {
    html = html.replace(TOOL_CTA_RE, '');
    removedTool = true;
  }

  // Insert before the first real content <h2> (skipping TOC + TL;DR headings), else before </body>
  const h2s = [...html.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/gi)];
  const contentH2 = h2s.find(m => !/in this article|table of contents|overview|tldr/i.test(m[0]));
  if (contentH2 && contentH2.index > 200) {
    html = html.slice(0, contentH2.index) + cta + '\n\n' + html.slice(contentH2.index);
  } else {
    html = html.replace('</body>', cta + '\n</body>');
  }
  if (!DRY_RUN) writeFileSync(filePath, html);
  removedTool ? replaced++ : added++;
  console.log(`  ${removedTool ? '🔄' : '✅'} ${slug} → /templates/${templateKey}`);
}

console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}added ${added}, replaced tool-CTA ${replaced}, already-done ${skipped}, no-match ${noMatch} of ${files.length} posts`);
