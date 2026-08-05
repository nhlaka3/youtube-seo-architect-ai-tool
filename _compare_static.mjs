import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve('.env.local'), override: true });
const { default: pg } = await import('pg');
const { Client } = pg;
const base = process.env.DATABASE_URL.split('?')[0];
const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000, keepAlive: true });
let connected = false;
for (let a = 1; a <= 6 && !connected; a++) {
  try { await client.connect(); connected = true; }
  catch (e) { if (a < 6) await new Promise(r => setTimeout(r, 2500 * a)); else throw e; }
}
const { rows } = await client.query("select slug, content from seo_pages where page_type='blog'");
const db = Object.fromEntries(rows.map(r => [r.slug, r.content || '']));
const BLOG_DIR = resolve('/mnt/c/Users/nhlaka/Desktop/Youtube seo tool', 'public/blog');
const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html'));
const count = (s, re) => (s.match(re) || []).length;
for (const f of files) {
  const slug = f.replace('.html', '');
  if (!db[slug]) continue;
  const staticHtml = readFileSync(resolve(BLOG_DIR, f), 'utf-8');
  const curr = db[slug];
  const sp = count(staticHtml, /<p[^>]*>/g), sc = count(staticHtml, /<\/p>/g);
  const dp = count(curr, /<p[^>]*>/g), dc = count(curr, /<\/p>/g);
  const deltaOpen = dp - sp, deltaClose = dc - sc;
  // also detect div-block insertion
  const divDelta = count(curr, /<div/g) - count(staticHtml, /<div/g);
  if (deltaOpen !== 0 || deltaClose !== 0 || divDelta !== 0) {
    console.log(`${slug}: static ${sp}/${sc} → db ${dp}/${dc} (Δ open=${deltaOpen} close=${deltaClose} divΔ=${divDelta})`);
  }
}
await client.end();
