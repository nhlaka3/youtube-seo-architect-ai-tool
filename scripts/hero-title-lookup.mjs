// Quick DB title lookup for DB-only posts (hero regen).
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
const envFile = resolve(process.cwd(), '.env.vercel');
if (readFileSync(envFile, 'utf-8').includes('DATABASE_URL=')) loadEnv({ path: '.env.vercel' });
else loadEnv({ path: '.env.local' });
import { initDatabase } from '../src/database/connection.js';
import { seoPages } from '../src/database/schema.js';
import { eq } from 'drizzle-orm';

const slugs = process.argv.slice(2);
const db = initDatabase();
if (!db) { console.error('no db'); process.exit(1); }
for (const s of slugs) {
  try {
    const rows = await db.select({ h1: seoPages.h1, title: seoPages.title }).from(seoPages).where(eq(seoPages.slug, s));
    console.log(s + '\t' + (rows[0] ? (rows[0].h1 || rows[0].title || '') : 'NOT FOUND'));
  } catch (e) {
    console.log(s + '\tERROR ' + e.message.slice(0, 60));
  }
}
process.exit(0);
