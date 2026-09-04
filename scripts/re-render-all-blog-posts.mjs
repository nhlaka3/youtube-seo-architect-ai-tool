#!/usr/bin/env node
/**
 * scripts/re-render-all-blog-posts.mjs
 *
 * Re-renders every blog post in the DB through the CURRENT blog template and
 * rewrites the static file (public/blog/<slug>.html). Static files shadow the
 * API renderer, so template/layout fixes only reach the live site when files
 * are regenerated. Run after any api/blog-renderer.js template change.
 *
 * Usage:
 *   node scripts/re-render-all-blog-posts.mjs           # all pageType=blog
 *   node scripts/re-render-all-blog-posts.mjs --dry-run # preview only
 *
 * Env: DATABASE_URL (from .env.local)
 */

import dotenv from 'dotenv';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
dotenv.config({ path: resolve(PROJECT, '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

const { renderBlogTemplate } = await import('../api/blog-renderer.js');
const { default: dbService } = await import('../src/database/services.js');
const s = await import('../src/database/schema.js');
const { eq } = await import('drizzle-orm');

const BLOG_DIR = resolve(PROJECT, 'public/blog');
mkdirSync(BLOG_DIR, { recursive: true });

console.log('🔄 Re-rendering all blog posts through the current template\n');

const rows = await dbService.db
  .select()
  .from(s.seoPages)
  .where(eq(s.seoPages.pageType, 'blog'));

let rendered = 0, skipped = 0, failed = 0;
for (const page of rows) {
  if (!page.slug || page.slug.startsWith('_')) { skipped++; continue; }
  try {
    const html = renderBlogTemplate(page);
    if (!DRY_RUN) {
      writeFileSync(resolve(BLOG_DIR, `${page.slug}.html`), html);
    }
    rendered++;
    if (rendered <= 3 || DRY_RUN) {
      console.log(`  ✓ ${page.slug} (${page.wordCount || '?'} words)`);
    }
  } catch (e) {
    failed++;
    console.error(`  ✗ ${page.slug}: ${e.message}`);
  }
}

console.log(`\n✅ Done: ${rendered} rendered, ${skipped} skipped, ${failed} failed${DRY_RUN ? ' (dry-run — nothing written)' : ' → static files updated'}`);
console.log('Next: npx vercel --prod --yes to ship the new layout site-wide.');
