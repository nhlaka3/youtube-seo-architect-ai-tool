#!/usr/bin/env node
/**
 * Publish blog posts to the seoPages database table.
 * Reads static HTML files from public/blog/, extracts article content,
 * and inserts into the database via Drizzle ORM.
 *
 * Usage:
 *   node scripts/publish-blog-db.js
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initDatabase } from '../src/database/connection.js';
import { seoPages } from '../src/database/schema.js';
import { eq } from 'drizzle-orm';

const posts = [
  {
    file: 'public/blog/youtube-community-posts-strategy-2026.html',
    slug: 'youtube-community-posts-strategy-2026',
    title: 'YouTube Community Posts Strategy 2026: How to Use Polls, Images & Text to Grow',
    metaDescription: 'Master the YouTube community posts strategy in 2026. Learn how polls, images, and text posts boost engagement, train the algorithm, and grow subscribers between uploads.',
    h1: 'YouTube Community Posts Strategy 2026: How to Use Polls, Images & Text to Grow',
  },
  {
    file: 'public/blog/youtube-chapter-timestamps-seo-guide.html',
    slug: 'youtube-chapter-timestamps-seo-guide',
    title: 'YouTube Chapter Timestamps SEO Guide 2026: How Chapters Boost Rankings',
    metaDescription: 'Learn how YouTube chapter timestamps boost SEO rankings in 2026. Step-by-step guide to writing timestamp chapters that increase CTR, watch time, and Google visibility.',
    h1: 'YouTube Chapter Timestamps SEO Guide 2026: How Chapters Boost Rankings',
  },
];

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
    console.error('❌ Failed to connect to database. Check DATABASE_URL.');
    process.exit(1);
  }

  for (const post of posts) {
    const filePath = resolve(process.cwd(), post.file);
    console.log(`\n📄 Reading: ${post.file}`);

    const fullHtml = readFileSync(filePath, 'utf-8');
    const content = extractArticleContent(fullHtml);
    const wordCount = countWords(content);

    console.log(`   Slug: ${post.slug}`);
    console.log(`   Title: ${post.title}`);
    console.log(`   Word count: ${wordCount}`);

    if (wordCount < 1200) {
      console.error(`   ❌ Word count ${wordCount} is below 1200 minimum. Skipping.`);
      continue;
    }

    const now = new Date();

    // Upsert: insert or update if slug already exists
    await db.insert(seoPages).values({
      slug: post.slug,
      pageType: 'blog',
      title: post.title,
      metaDescription: post.metaDescription,
      h1: post.h1,
      content,
      wordCount,
      status: 'published',
      publishedAt: now,
    }).onConflictDoUpdate({
      target: seoPages.slug,
      set: {
        title: post.title,
        metaDescription: post.metaDescription,
        h1: post.h1,
        content,
        wordCount,
        status: 'published',
      },
    });

    console.log(`   ✅ Published: /blog/${post.slug}`);
  }

  console.log('\n🎉 Done! Both posts published to database.');
  console.log('   Verify at:');
  console.log('   https://yt-seo-architect.vercel.app/blog/youtube-community-posts-strategy-2026');
  console.log('   https://yt-seo-architect.vercel.app/blog/youtube-chapter-timestamps-seo-guide');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
