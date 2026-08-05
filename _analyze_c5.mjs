import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
config({ path: resolve('.env.local'), override: true });

const { default: pkg } = await import('pg');
const { Client } = pkg;
const url = process.env.DATABASE_URL;
const base = url.split('?')[0];
const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000, keepAlive: true });
let connected = false;
for (let attempt = 1; attempt <= 6 && !connected; attempt++) {
  try { await client.connect(); connected = true; }
  catch (e) {
    console.error(`connect attempt ${attempt} failed: ${e.code || e.message}`);
    if (attempt < 6) { await new Promise(r => setTimeout(r, 2500 * attempt)); }
    else throw e;
  }
}
console.log('connected');

const rows = await client.query("select slug, title, content from seo_pages where page_type='blog'");
const statRe = /(According to|study by|found that|a (recent|new|2026) (study|report|survey)|[0-9]+%|statistics?)/i;

let report = '';
let totalStats = 0;
const bySlug = {};
for (const r of rows.rows) {
  const content = r.content || '';
  // strip tags roughly to get text lines
  const lines = content.split('\n');
  const hits = lines.filter(l => statRe.test(l) && l.includes('<p') );
  if (hits.length) {
    totalStats += hits.length;
    bySlug[r.slug] = hits.length;
    report += `\n======== ${r.slug} (${hits.length}) ========\n`;
    for (const h of hits) {
      const text = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) report += `  - ${text.slice(0, 320)}\n`;
    }
  }
}

// static files
let staticStats = 0;
for (const f of readdirSync('public/blog')) {
  if (!f.endsWith('.html') || f.startsWith('_')) continue;
  const html = readFileSync(resolve('public/blog', f), 'utf-8');
  const lines = html.split('\n');
  const hits = lines.filter(l => statRe.test(l) && l.includes('<p'));
  staticStats += hits.length;
}
report = `DB rows: ${rows.rows.length} | DB stat-hits: ${totalStats} | static stat-hits: ${staticStats}\n` + report;
console.log(report);
await client.end();