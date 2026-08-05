import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
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
const diff = readFileSync('/tmp/c5-fix-diff-apply-1785872317887.txt','utf-8');
const changedSlugs = new Set([...diff.matchAll(/### \/blog\/([\w-]+)/g)].map(m => m[1]));
let untouched = 0, untouchedBad = 0;
for (const r of rows) {
  if (changedSlugs.has(r.slug)) continue;
  untouched++;
  const c = r.content || '';
  const open = (c.match(/<p[^>]*>/g) || []).length;
  const close = (c.match(/<\/p>/g) || []).length;
  const isFullDoc = /<!DOCTYPE/i.test(c);
  if (open !== close) { untouchedBad++; console.log(`UNTOUCHED-MISMATCH ${r.slug}: open=${open} close=${close} isFullDoc=${isFullDoc}`); }
}
console.log(`\nUntouched posts: ${untouched}, of which unbalanced: ${untouchedBad}`);
await client.end();
