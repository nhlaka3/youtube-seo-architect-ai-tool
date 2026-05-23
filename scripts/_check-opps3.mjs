import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  // View all 142 pending keyword slugs and actual keyword text
  // with first 10 chars, to understand what "vague topic names" exist
  const { rows } = await pool.query(
    "SELECT keyword, target_url_slug, priority FROM content_opportunities WHERE status = $1 ORDER BY priority DESC, created_at ASC",
    ['pending']
  );
  console.log('Total pending:', rows.length);
  console.log('=== PENDING KEYWORDS (by target_url_slug grouping) ===\n');
  
  // Group by slug prefix
  const groups = {};
  rows.forEach(r => {
    const prefix = r.target_url_slug.split('-').slice(0, 2).join('-');
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(r.keyword);
  });
  
  Object.keys(groups).sort().forEach(prefix => {
    console.log(prefix + '-' + 'x'.repeat(Math.min(groups[prefix].length, 10)));
    groups[prefix].slice(0, 3).forEach(kw => console.log('   -', kw));
    if (groups[prefix].length > 3) console.log('   ... and', groups[prefix].length - 3, 'more');
    console.log('');
  });
  
  console.log('=== UNIQUE PREFIXES ===');
  Object.keys(groups).forEach(p => console.log(p));
  
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
