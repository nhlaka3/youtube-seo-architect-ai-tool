// scripts/cleanup-trash-posts.mjs
// Deletes ALL programmatic SEO posts from seo_pages — keeping only the 23
// hand-crafted posts listed in blog.html (the approved whitelist).
//
// DRY RUN:   node scripts/cleanup-trash-posts.mjs
// DELETE:    node scripts/cleanup-trash-posts.mjs --force
//
// Requires DATABASE_URL in .env

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../src/database/schema.js';
import { eq, notInArray } from 'drizzle-orm';

// ── APPROVED WHITELIST (from blog.html — 22 hand-crafted posts, 8+ min read) ──
// youtube-analytics-4-metrics-that-matter excluded — only 7 min read (below threshold)
const APPROVED = [
  'best-youtube-seo-tools-2026', 'github-seo-backlinks-guide',
  'how-to-fix-youtube-shadow-ban-2026', 'how-to-mass-update-youtube-descriptions-safely',
  'how-to-write-youtube-titles', 'what-does-youtube-ctr-actually-mean',
  'youtube-ai-seo-coach-phronesis-2026', 'youtube-algorithm-changes-2026',
  'youtube-analytics-explained-2026', 'youtube-competitor-analysis-reverse-engineer',
  'youtube-description-templates', 'youtube-description-templates-2026',
  'youtube-end-screens-cards-guide-2026', 'youtube-keyword-research-tutorial',
  'youtube-metadata-auditor-vs-vidiq-shadow-ban', 'youtube-retention-graph-explained-2026',
  'youtube-seo-audit-diagnostic-fix-2026', 'youtube-seo-guide-2026',
  'youtube-shorts-seo-ranking-guide', 'youtube-tags-generator-vs-vidiq',
  'youtube-thumbnail-ab-testing-guide', 'youtube-video-not-getting-views-diagnostic-fix-2026'
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  // 1. Fetch all published posts
  const all = await db.select({
    slug: schema.seoPages.slug, title: schema.seoPages.title,
    wordCount: schema.seoPages.wordCount, publishedAt: schema.seoPages.publishedAt,
  }).from(schema.seoPages).where(eq(schema.seoPages.status, 'published'))
    .orderBy(schema.seoPages.publishedAt).limit(200);

  console.log(`=== ALL PUBLISHED POSTS (${all.length}) ===`);
  const trash = [];
  for (const p of all) {
    const kept = APPROVED.includes(p.slug);
    if (kept) {
      console.log(`  ✅ KEEP  ${p.slug} | ${p.wordCount}w | ${p.title?.substring(0,60)}`);
    } else {
      console.log(`  🗑️ TRASH ${p.slug} | ${p.wordCount}w | ${p.title?.substring(0,60)}`);
      trash.push(p);
    }
  }

  console.log(`\n📊 KEEP: ${all.length - trash.length}  |  🗑️ TRASH: ${trash.length}`);

  if (trash.length === 0) {
    console.log('\n✅ Database is clean. No programmatic SEO posts to delete.');
    process.exit(0);
  }

  // 2. Show what will be deleted
  console.log(`\n=== 🗑️ ${trash.length} POSTS TO DELETE ===`);
  trash.forEach(p => console.log(`  - ${p.slug} (${p.wordCount}w): ${p.title}`));

  // 3. Require --force for actual deletion
  const force = process.argv.includes('--force');
  if (!force) {
    console.log('\n⚠️  DRY RUN — add --force to actually delete.');
    console.log('  node scripts/cleanup-trash-posts.mjs --force');
    process.exit(0);
  }

  // 4. Delete ALL posts not in approved list
  const result = await db.delete(schema.seoPages).where(
    notInArray(schema.seoPages.slug, APPROVED)
  ).returning({ slug: schema.seoPages.slug });

  console.log(`\n✅ DELETED ${result.length} posts:`);
  result.forEach(p => console.log(`  ✓ ${p.slug}`));

  // 5. Verify
  const remaining = await db.select({ count: schema.seoPages.slug })
    .from(schema.seoPages).where(eq(schema.seoPages.status, 'published'));
  console.log(`\n📊 Published posts remaining: ${remaining[0]?.count || 0}`);

  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
