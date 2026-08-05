import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve('.env.local'), override: true });

const { default: pkg } = await import('pg');
const { Client } = pkg;
const url = process.env.DATABASE_URL;
const base = url.split('?')[0];
const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000, keepAlive: true });
let connected = false;
for (let a = 1; a <= 6 && !connected; a++) {
  try { await client.connect(); connected = true; }
  catch (e) { if (a < 6) await new Promise(r => setTimeout(r, 2500 * a)); else throw e; }
}
const rows = await client.query("select slug, content from seo_pages where page_type='blog'");

// Split HTML into sentences, normalize, dedupe
const statRe = /(According to|study by|found that|a (recent|new|2026) (study|report|survey)|[0-9]+%|survey of|[0-9,]+\+? (creators|users|channels|videos)|we audited|we collected data|we analyzed data|data from [0-9]+|case study)/i;

const counts = new Map();
for (const r of rows.rows) {
  const content = r.content || '';
  const paras = content.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
  for (const p of paras) {
    const text = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 40) continue;
    if (!statRe.test(text)) continue;
    // also require a number to focus on statistics
    if (!/[0-9]+(\.[0-9]+)?%|\b[0-9,]+\b/.test(text)) continue;
    const key = text.toLowerCase().slice(0, 160);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
}

// Sort by frequency, then print
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
let uniqueTotal = 0;
for (const [k, n] of sorted) {
  uniqueTotal++;
  // find a sample full sentence to show
}
console.log('UNIQUE stat paragraphs:', sorted.length);
// Print with frequency, first 140 chars
for (const [k, n] of sorted) {
  console.log(`[x${n}] ${k.slice(0, 220)}`);
}
await client.end();