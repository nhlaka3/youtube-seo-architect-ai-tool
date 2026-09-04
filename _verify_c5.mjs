import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve('.env.local'), override: true });
const { default: pg } = await import('pg');
const { Client } = pg;
const base = process.env.DATABASE_URL.split('?')[0];
const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000 });
await client.connect();
const { rows } = await client.query("select slug, content from seo_pages where page_type='blog'");
let bad = 0;
for (const r of rows) {
  const content = r.content || '';
  // balanced <p> tags
  const open = (content.match(/<p[^>]*>/g) || []).length;
  const close = (content.match(/<\/p>/g) || []).length;
  // stray markdown fences or JSON artifacts
  const fence = (content.match(/```/g) || []).length;
  // orphan </p> without open
  if (open !== close) { console.log(`MISMATCH ${r.slug}: open=${open} close=${close}`); bad++; }
  if (fence > 0) { console.log(`FENCE ${r.slug}: ${fence}`); bad++; }
  if (content.includes('{"@context"') || content.includes('No explanation, no wrapper')) { console.log(`ARTIFACT ${r.slug}`); bad++; }
  // check for a couple of specific fabricated stat remnants
  if (/(PewDiePie.*(30%|25%|15%))|(Shaaanxo.*(20%|25%))|(Crash Course.*40%)|(TubeFilter.*20%|Hootsuite.*90%|Wyzowl.*68%)/i.test(content)) {
    console.log(`STAT-REMNANT ${r.slug}`);
    bad++;
  }
}
console.log(bad === 0 ? '\n✅ Structure intact, no stat remnants across all posts' : `\n⚠ ${bad} issues`);
await client.end();
