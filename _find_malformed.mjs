import { config } from 'dotenv';
import { resolve } from 'path';
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
const rewrites = JSON.parse((await import('fs')).readFileSync('/tmp/c5-rewrites.json', 'utf-8'));
// identify malformed entries
const malformed = {};
for (const [k, v] of Object.entries(rewrites)) {
  const fullRe = /^<p[^>]*>[\s\S]*?<\/p>$/;
  if (!fullRe.test(v)) malformed[k] = v;
}
console.log('malformed rewrite count:', Object.keys(malformed).length);
// find posts containing these malformed fragments
for (const r of rows) {
  const c = r.content || '';
  const hits = [];
  for (const [k, v] of Object.entries(malformed)) {
    if (c.includes(v.slice(0, 80))) hits.push(k.slice(0, 40));
  }
  if (hits.length) console.log(`${r.slug}: ${hits.length} malformed fragment(s)`);
}
await client.end();
