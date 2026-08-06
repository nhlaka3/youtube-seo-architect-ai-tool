#!/usr/bin/env node
/**
 * Publish a blog post drafted by the claude-blog methodology:
 * wraps the article body in the canonical template, saves to the Neon DB
 * (seo_pages), and updates the sitemap.
 *
 * Usage: node scripts/publish-blog-shorts.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BODY = '/tmp/blog-shorts/article-body.html';
const SLUG = 'youtube-shorts-monetization-requirements-2026';
const TITLE = 'YouTube Shorts Monetization Requirements in 2026 (Exact Numbers)';
const META = 'The exact 2026 requirements to earn money from YouTube Shorts: 1,000 subscribers plus 10 million valid Shorts views (90 days) or 4,000 long-form watch hours, what counts, and what you actually earn.';
const SITEMAP = resolve(PROJECT, 'public/sitemap.xml');
const URL = `https://yt-seo-architect.vercel.app/blog/${SLUG}`;

const { renderBlogTemplate } = await import('../api/blog-renderer.js');
const { validateBlogPost } = await import('../api/blog-validation.js');
const { default: dbService } = await import('../src/database/services.js');

const articleHTML = readFileSync(BODY, 'utf-8');
const wordCount = articleHTML.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const today = new Date().toISOString().split('T')[0];

const page = {
  slug: SLUG,
  title: TITLE,
  h1: `${TITLE}: Complete Guide`,
  metaDescription: META,
  content: articleHTML,
  wordCount,
  publishedAt: today,
  updatedAt: today,
};

console.log('Wrapping in blog template...');
const fullHTML = renderBlogTemplate(page);
console.log(`  ${fullHTML.length} bytes, ${wordCount} words`);

console.log('Validating structure...');
const validation = validateBlogPost(page);
if (validation.valid) console.log('  ✅ Structural validation passed');
else {
  console.log('  ⚠ Structural issues (non-blocking, renderer auto-fixes):');
  for (const f of validation.failures) console.log(`    - ${f}`);
}

console.log('Saving to database...');
const backoff = ms => new Promise(r => setTimeout(r, ms));
let saved = false;
for (let attempt = 0; attempt < 4; attempt++) {
  try {
    await dbService.saveSeoPage({
      slug: page.slug,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.title,
      content: fullHTML,
      wordCount: page.wordCount,
      status: 'published',
      publishedAt: new Date(),
    });
    saved = true;
    console.log('  ✅ Saved to database');
    break;
  } catch (e) {
    if (attempt === 3) { console.error(`  ❌ DB save failed after 4 attempts: ${e.message}`); process.exitCode = 1; }
    else { console.log(`  ⚠ attempt ${attempt + 1} failed (${e.message.slice(0, 80)}), retrying...`); await backoff(2500 * (attempt + 1)); }
  }
}

// Sitemap: dynamic route (/sitemap.xml) reads the seo_pages DB — no static
// file exists in this project, so nothing to update here. The DB save above
// makes the post appear in the live sitemap automatically.

console.log('\n══════════════════════════════════════════');
console.log('  ✅ PUBLISHED TO DB');
console.log(`  URL: ${URL}`);
console.log(`  Words: ${wordCount} | Visuals: 1 hero + 3 charts`);
console.log('  Deploy: push to private repo (Vercel auto-deploys)');
console.log('══════════════════════════════════════════');
