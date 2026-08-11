#!/usr/bin/env node
/**
 * Publish public/blog/youtube-seo-tips-for-creators-in-2026.html to seoPages (Neon DB).
 * Mirrors the upsert pattern of publish-blog-db.js. Idempotent (onConflictDoUpdate).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { initDatabase } from '../src/database/connection.js';
import { seoPages } from '../src/database/schema.js';

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
  const fullHtml = readFileSync(resolve(process.cwd(), POST.file), 'utf-8');
  const content = extractArticleContent(fullHtml);
  const wordCount = countWords(content);
  console.log(`Slug: ${POST.slug} | Word count: ${wordCount}`);
  if (wordCount < 1200) {
    console.error(`Word count ${wordCount} below 1200 minimum — aborting.`);
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