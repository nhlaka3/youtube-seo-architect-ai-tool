import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve('.env.local'), override: true });
const { default: pg } = await import('pg');
const { Client } = pg;
const base = process.env.DATABASE_URL.split('?')[0];
const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000 });
await client.connect();
const { rows } = await client.query("select slug, content from seo_pages where page_type='blog'");
const map = Object.fromEntries(rows.map(r => [r.slug, r.content || '']));
const slug = process.argv[2];
const content = map[slug] || '';
console.log('=== ' + slug + ' length=' + content.length + ' ===');
// show any JSON artifact location
const jIdx = content.indexOf('{"@context"');
if (jIdx >= 0) console.log('JSON ARTIFACT at', jIdx, ':', content.slice(jIdx-200, jIdx+150));
// find where a <p> has no closing tag - scan for open p without close
const paras = content.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
console.log('matched balanced paras:', paras.length);
// look for 'No explanation' strings
const nx = content.indexOf('No explanation');
if (nx >= 0) console.log('EXPLANATION TEXT at', nx, ':', content.slice(nx-100, nx+200));
// print first 500 chars
console.log('START:', content.slice(0, 500));
await client.end();
