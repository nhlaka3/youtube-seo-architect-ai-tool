import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  const { rows } = await pool.query('SELECT slug, h1, content FROM seo_pages WHERE status = $1', ['published']);
  console.log('=== H1 + TL;DR + STRUCTURE CHECK\n');
  rows.forEach((row, i) => {
    const c = row.content;
    const tldrMatch = c.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
    const tldrText = tldrMatch ? tldrMatch[1].replace(/<[^>]+>/g, '').trim() : 'MISSING';
    const tldrOk = tldrText.length > 30;
    const contentH1Match = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const contentH1 = contentH1Match ? contentH1Match[1].replace(/<[^>]+>/g, '').trim() : 'MISSING';
    const first100 = c.split(/\s+/).slice(0, 100).join(' ');
    const primaryWord = row.slug.split('-').slice(0, 2).join(' ');
    const kwInFirst100 = first100.toLowerCase().includes(primaryWord.toLowerCase());
    const toolMentions = (c.match(/YT SEO Architect/g) || []).length;
    console.log((i+1) + '. ' + row.slug);
    console.log('   H1           : ' + row.h1.slice(0, 60));
    console.log('   TL;DR (first 80 chars) : ' + (tldrText || 'EMPTY').slice(0,80) + (tldrOk ? ' [OK]' : ' [SHORT/MISSING]'));
    console.log('   Tool mentions : ' + toolMentions);
    console.log('   Primary KW in first 100w : ' + (kwInFirst100 ? 'YES [OK]' : 'NO [MISSING]'));
  });
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
