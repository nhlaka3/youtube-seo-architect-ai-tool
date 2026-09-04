#!/usr/bin/env node
/**
 * Publish public/blog/youtube-seo-tips-for-creators-in-2026.html to seoPages (Neon DB).
 * Mirrors the upsert pattern of publish-blog-db.js. Idempotent (onConflictDoUpdate).
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
// Prefer Vercel-pulled envs (production DB); fall back to local env file.
const envFile = resolve(process.cwd(), '.env.vercel');
if (readFileSync(envFile, 'utf-8').includes('DATABASE_URL=')) {
  loadEnv({ path: '.env.vercel' });
} else {
  loadEnv({ path: '.env.local' });
}
import { initDatabase } from '../src/database/connection.js';
import { seoPages } from '../src/database/schema.js';
import { countVisuals, analyzeVisuals, fixVisualAnimations } from '../api/blog-validation.js';

const POST = {
  file: 'public/blog/youtube-seo-tips-for-creators-in-2026.html',
  slug: 'youtube-seo-tips-for-creators-in-2026',
  title: 'YouTube SEO Tips for Creators in 2026: What Actually Moves Rankings',
  metaDescription: "14 practical YouTube SEO tips for creators in 2026, grounded in YouTube's official search documentation — metadata, watch time, chapters, Shorts, AI-era features, and the full checklist.",
  h1: 'YouTube SEO Tips for Creators in 2026: What Actually Moves Rankings',
};

function extractArticleContent(html) {
  const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1].trim();
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1].trim();
  return html;
}

function countWords(html) {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

async function main() {
  const db = initDatabase();
  if (!db) {
    console.error('Failed to connect to database. Check DATABASE_URL.');
    process.exit(1);
  }
  const fullHtml0 = readFileSync(resolve(process.cwd(), POST.file), 'utf-8');
  const article0 = extractArticleContent(fullHtml0);
  // AUTO-CORRECT first: wrap any non-animated visual so the post is fixed,
  // not just blocked. Write the corrected HTML back to the file.
  const fixRes = fixVisualAnimations(article0);
  if (fixRes.fixed > 0) {
    console.log(`✏️  Auto-corrected ${fixRes.fixed} non-animated visual(s):`);
    for (const r of fixRes.report) console.log('   - ' + r);
    writeFileSync(resolve(process.cwd(), POST.file), fullHtml0.replace(article0, fixRes.html));
  }
  const fullHtml = readFileSync(resolve(process.cwd(), POST.file), 'utf-8');
  const content = extractArticleContent(fullHtml);
  const wordCount = countWords(content);
  const visuals = countVisuals(content);
  const { unanimated } = analyzeVisuals(content);
  console.log(`Slug: ${POST.slug} | Word count: ${wordCount} | Visuals: ${visuals} | Unanimated: ${unanimated.length}`);
  if (wordCount < 1200) {
    console.error(`Word count ${wordCount} below 1200 minimum — aborting.`);
    process.exit(1);
  }
  if (visuals < 3) {
    console.error(`Only ${visuals} content visuals (images/inline SVG charts) — site standard requires 3+ (see AGENTS.md Motion Conventions). Could not auto-correct: add at least ${3 - visuals} more image/chart. Aborting.`);
    process.exit(1);
  }
  if (unanimated.length) {
    console.error(`${unanimated.length} visual(s) still not animated after auto-fix (${unanimated.map(u => `<${u.name}>`).join(', ')}) — see AGENTS.md Motion Conventions. Aborting.`);
    process.exit(1);
  }
  if (!fullHtml.includes('motion-utilities.css')) {
    console.error('Missing motion-utilities.css link — post visuals will not be animated. Aborting.');
    process.exit(1);
  }
  await db.insert(seoPages).values({
    slug: POST.slug,
    pageType: 'blog',
    title: POST.title,
    metaDescription: POST.metaDescription,
    h1: POST.h1,
    content,
    wordCount,
    status: 'published',
    publishedAt: new Date(),
  }).onConflictDoUpdate({
    target: seoPages.slug,
    set: {
      title: POST.title,
      metaDescription: POST.metaDescription,
      h1: POST.h1,
      content,
      wordCount,
      status: 'published',
    },
  });
  console.log('Published to DB: /blog/' + POST.slug);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});