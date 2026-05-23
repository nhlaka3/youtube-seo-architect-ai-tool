import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const forbidden = [
  "in today's world","landscape","leverage","robust","seamless",
  "foster","moreover","pivotal","embark","game-changer",
  "cutting-edge","streamline","at its core","that said",
  "let's explore","ultimately","it's important to note"
];

(async () => {
  const r = await pool.query(
    "SELECT slug, content FROM seo_pages WHERE status = $1 ORDER BY published_at DESC",
    ['published']
  );
  console.log('Published posts:', r.rows.length);
  console.log('');
  
  let totalViolations = 0;
  let postsWithViolations = 0;
  
  r.rows.forEach((row, i) => {
    const wc = row.content.split(/\s+/).filter(Boolean).length;
    const hits = forbidden.filter(p => row.content.toLowerCase().includes(p.toLowerCase()));
    if (hits.length > 0) {
      postsWithViolations++;
      totalViolations += hits.length;
      console.log('FAIL', (i+1)+'.', row.slug, '('+wc+'w)', '|', hits.join(', '));
    } else {
      console.log('OK  ', (i+1)+'.', row.slug, '('+wc+'w)');
    }
  });
  
  console.log('');
  console.log('Clean:', r.rows.length - postsWithViolations, '/', r.rows.length);
  console.log('Bad  :', postsWithViolations, '|', totalViolations, 'violations');
  
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
