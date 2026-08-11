#!/usr/bin/env node
/** Read-only check: is the new post in seo_pages, and does it match what the API would query? */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { initDatabase } from '../src/database/connection.js';
import { seoPages } from '../src/database/schema.js';
import { eq } from 'drizzle-orm';

const db = initDatabase();
const row = await db.select({
  slug: seoPages.slug, status: seoPages.status, pageType: seoPages.pageType,
  title: seoPages.title, wordCount: seoPages.wordCount, publishedAt: seoPages.publishedAt,
}).from(seoPages).where(eq(seoPages.slug, 'youtube-seo-tips-for-creators-in-2026')).limit(1);
console.log('ROW:', JSON.stringify(row, null, 1));
const count = await db.select({ n: sqlCount() }).from(seoPages);
console.log('total published:', JSON.stringify(count));

function sqlCount() {
  const { sql } = require('drizzle-orm');
  return sql`count(*)`;
}
process.exit(0);
