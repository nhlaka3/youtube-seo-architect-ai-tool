#!/usr/bin/env node
/**
 * scripts/apply-blog-design-update.mjs
 *
 * Batch-updates all existing blog post HTML files with the Cyber-Luxe Dark
 * design improvements: Geist fonts, reading progress bar, reading progress JS.
 *
 * What it does to each file:
 *   1. Adds Geist font <link> tags in <head>
 *   2. Adds <style>body{font-display:swap...} if missing
 *   3. Adds reading progress bar <div> after <body>
 *   4. Adds reading progress JS before </body>
 *
 * Usage:  node scripts/apply-blog-design-update.mjs
 * Dry run: node scripts/apply-blog-design-update.mjs --dry-run
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'public', 'blog');
const DRY_RUN = process.argv.includes('--dry-run');

// Files to skip (template, backups, non-HTML)
const SKIP = new Set(['_TEMPLATE.html', '_backup', '_archive']);

// The font link block to insert before adscript/CSS in <head>
const FONT_LINKS = `  <!-- Geist font (non-render-blocking) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />`;

// The inline style block
const FONT_STYLE = `  <style>body{font-display:swap;font-family:'Geist','Outfit',-apple-system,BlinkMacSystemFont,sans-serif}</style>`;

// Reading progress bar div (insert after <body>)
const PROGRESS_BAR = `\n  <!-- Reading Progress Bar -->\n  <div class="reading-progress" id="readingProgress" aria-hidden="true"></div>`;

// Reading progress JS (insert before </body>)
const PROGRESS_JS = `
  <script>
  /* ── Reading Progress Bar ──────────────────────────── */
  (function(){
    var bar = document.getElementById('readingProgress');
    if(!bar) return;
    var update = function(){
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.setProperty('--scroll-pct', pct + '%');
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();
  </script>`;

function processFile(filePath) {
  const filename = filePath.split('/').pop();
  let html = readFileSync(filePath, 'utf8');
  const original = html;
  const changes = [];

  // ── 1. Add Geist font <link> tags ─────────────────────
  // Insert before the first <script async src="https://pagead2..." or 
  // before <link rel="stylesheet" href="/blog/blog.css" whichever comes first
  const adScriptTarget = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  const cssLinkTarget = '<link rel="stylesheet" href="/blog/blog.css"';
  const styleTarget = '<style>body{font-display:swap;';

  // Check if font links already exist
  if (html.includes('Geist font') || html.includes('Geist:wght')) {
    console.log(`  ⏭  ${filename} — Geist fonts already present, skipping`);
  } else {
    // Find insertion point: after existing meta tags, before ad script or CSS link
    const adIdx = html.indexOf(adScriptTarget);
    const cssIdx = html.indexOf(cssLinkTarget);
    const insertIdx = Math.min(
      adIdx >= 0 ? adIdx : Infinity,
      cssIdx >= 0 ? cssIdx : Infinity
    );

    if (insertIdx < Infinity) {
      // Insert font links + a blank line before the target
      const before = html.substring(0, insertIdx);
      const after = html.substring(insertIdx);
      html = before + FONT_LINKS + '\n\n' + after;
      changes.push('Geist font links');
    } else {
      console.log(`  ⚠️  ${filename} — Could not find insertion point for fonts, skipping`);
    }
  }

  // ── 2. Add/update inline body font style ──────────────
  if (html.includes(styleTarget)) {
    // Already has the style block, update font-family order if needed
    if (html.includes("font-family:'Outfit','Geist'")) {
      html = html.replace(
        "font-family:'Outfit','Geist',-apple-system,BlinkMacSystemFont,sans-serif",
        "font-family:'Geist','Outfit',-apple-system,BlinkMacSystemFont,sans-serif"
      );
      changes.push('font order updated (Geist first)');
    }
  } else if (html.includes('<script defer src="/ga.js"></script></head>')) {
    // Insert the style block right before </head>
    html = html.replace('</head>', `  ${FONT_STYLE}\n</head>`);
    changes.push('body font style');
  }

  // ── 3. Add reading progress bar after <body> ──────────
  if (html.includes('reading-progress')) {
    // Already has it (e.g., _TEMPLATE.html)
  } else {
    const bodyPattern = /(<body[^>]*>)/;
    const match = html.match(bodyPattern);
    if (match && match.index !== undefined) {
      const beforeBody = html.substring(0, match.index + match[0].length);
      const afterBody = html.substring(match.index + match[0].length);
      html = beforeBody + PROGRESS_BAR + afterBody;
      changes.push('reading progress bar');
    }
  }

  // ── 4. Add reading progress JS before </body> ─────────
  if (html.includes('Reading Progress Bar') && html.includes('readingProgress')) {
    // Already has it
  } else if (!html.includes('readingProgress')) {
    // Insert before closing </body>
    html = html.replace('</body>', PROGRESS_JS + '\n</body>');
    changes.push('reading progress JS');
  }

  // ── Done ──────────────────────────────────────────────
  if (html !== original) {
    if (DRY_RUN) {
      console.log(`  ✏️  ${filename} — would update: ${changes.join(', ')}`);
    } else {
      writeFileSync(filePath, html, 'utf8');
      console.log(`  ✅ ${filename} — updated: ${changes.join(', ')}`);
    }
    return true;
  } else if (changes.length === 0) {
    console.log(`  ✅ ${filename} — already up to date`);
    return false;
  }
  return false;
}

// Main
console.log('📝 Batch-updating blog posts with Cyber-Luxe Dark design improvements...');
if (DRY_RUN) console.log('🔍 DRY RUN — no files will be modified\n');
else console.log('\n');

const files = readdirSync(BLOG_DIR)
  .filter(f => extname(f) === '.html' && !SKIP.has(f) && !f.startsWith('.'))
  .sort();

let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = join(BLOG_DIR, file);
  try {
    const didUpdate = processFile(filePath);
    if (didUpdate) updated++;
    else skipped++;
  } catch (err) {
    console.error(`  ❌ ${file} — ERROR: ${err.message}`);
  }
}

console.log(`\n📊 Done. ${updated} files updated, ${skipped} files already up to date.`);
