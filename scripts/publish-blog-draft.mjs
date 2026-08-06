#!/usr/bin/env node
/**
 * scripts/publish-blog-draft.mjs
 *
 * Publishes a drafted article-body HTML file through the standard pipeline:
 * renderBlogTemplate (canonical template + schema + FAQ + CTAs) -> Neon DB
 * -> static file. The dynamic sitemap picks it up from the DB automatically.
 *
 * Usage:
 *   node scripts/publish-blog-draft.mjs <article-body.html> <slug> [--title "T"]
 *
 * Env: DATABASE_URL (from .env.local)
 */

import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
dotenv.config({ path: resolve(PROJECT, '.env.local') });

const args = process.argv.slice(2);
const bodyPath = args[0];
const slug = args[1];
const titleArg = args.find(a => a.startsWith('--title='))?.split('=')[1];

if (!bodyPath || !slug || !existsSync(bodyPath)) {
  console.error('❌ Usage: node scripts/publish-blog-draft.mjs <article-body.html> <slug> [--title "T"]');
  process.exit(1);
}

const { renderBlogTemplate } = await import('../api/blog-renderer.js');
const { default: dbService } = await import('../src/database/services.js');

const content = readFileSync(bodyPath, 'utf-8');
const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const title = titleArg || 'YouTube Shorts Monetization Requirements in 2026 (Exact Numbers)';
const metaDescription = '2026 Shorts monetization requirements: 1,000 subs + 10M valid Shorts views (90 days) or 4,000 long-form watch hours. What counts as a valid view and what you earn.';

const page = {
  slug,
  title,
  h1: title,
  metaDescription,
  content,
  wordCount,
  publishedAt: new Date(),
  updatedAt: new Date(),
};

console.log(`📝 Publishing "${title}" (${wordCount} words, slug: ${slug})\n`);
console.log('  Wrapping in canonical template...');
const fullHTML = renderBlogTemplate(page);

console.log('  Saving to Neon DB...');
const backoff = ms => new Promise(r => setTimeout(r, ms));
let saved = false;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await dbService.saveSeoPage({
      slug,
      title,
      metaDescription,
      h1: title,
      content: fullHTML,
      wordCount,
      status: 'published',
      publishedAt: new Date(),
    });
    saved = true;
    break;
  } catch (e) {
    if (attempt === 2) { console.error(`  ❌ DB save failed after 3 attempts: ${e.message}`); }
    else { console.log(`  ⚠ retry (${e.message})`); await backoff(2000 * (attempt + 1)); }
  }
}

if (saved) {
  writeFileSync(resolve(PROJECT, `public/blog/${slug}.html`), fullHTML);
  console.log(`  ✅ DB saved + static file written (public/blog/${slug}.html)`);
  console.log(`  ✅ Live URL after deploy: https://yt-seo-architect.vercel.app/blog/${slug}`);
  console.log('  ✅ Sitemap: dynamic route reads from DB — post will appear automatically');
}
