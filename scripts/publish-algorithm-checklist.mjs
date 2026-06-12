#!/usr/bin/env node
/**
 * Publish "YouTube Algorithm Checklist 2026" to the seo_pages table.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/publish-algorithm-checklist.js
 *
 * The script reads the static HTML from public/blog/, extracts the article
 * body, and inserts a row with status='published'.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  // 1. Read the static HTML
  const htmlPath = resolve(ROOT, 'public/blog/youtube-algorithm-checklist-2026.html');
  const rawHTML = readFileSync(htmlPath, 'utf-8');

  // 2. Extract article body (between <article> and </article>)
  const articleMatch = rawHTML.match(/<article>([\s\S]*?)<\/article>/);
  if (!articleMatch) {
    console.error('❌ Could not extract <article> from HTML');
    process.exit(1);
  }
  const content = articleMatch[1].trim();

  // 3. Count words (strip HTML tags)
  const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = textOnly.split(/\s+/).length;

  // 4. Extract title from <h1> inside article
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/);
  const title = h1Match
    ? h1Match[1].replace(/<[^>]+>/g, '').trim()
    : 'YouTube Algorithm Checklist 2026: The 10-Point Creator Growth Blueprint';

  const slug = 'youtube-algorithm-checklist-2026';
  const metaDescription =
    'The ultimate YouTube Algorithm Checklist for 2026. 10 proven strategies to master Satisfied Watch Time, AI Citations, and Session Contribution for channel growth.';

  console.log(`📝 Title:    ${title}`);
  console.log(`📎 Slug:     ${slug}`);
  console.log(`📊 Words:    ${wordCount}`);
  console.log(`📄 Content:  ${content.length} chars`);

  // 5. Check if slug already exists
  const existing = await sql`SELECT id, status FROM seo_pages WHERE slug = ${slug}`;
  if (existing.length > 0) {
    console.log(`\n⚠️  Slug "${slug}" already exists (status: ${existing[0].status}). Updating...`);
    await sql`
      UPDATE seo_pages
      SET title = ${title},
          slug = ${slug},
          meta_description = ${metaDescription},
          content = ${content},
          word_count = ${wordCount},
          page_type = 'blog',
          status = 'published',
          published_at = '2026-06-12'::timestamp
      WHERE slug = ${slug}
    `;
    console.log('✅ Updated existing row.');
  } else {
    // 6. Insert
    await sql`
      INSERT INTO seo_pages (slug, page_type, title, meta_description, content, word_count, status, published_at)
      VALUES (${slug}, 'blog', ${title}, ${metaDescription}, ${content}, ${wordCount}, 'published', '2026-06-12'::timestamp)
    `;
    console.log('✅ Inserted new row into seo_pages.');
  }

  // 7. Verify
  const verify = await sql`SELECT slug, title, word_count, status FROM seo_pages WHERE slug = ${slug}`;
  console.log('\n🔍 Verification:');
  console.table(verify);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
