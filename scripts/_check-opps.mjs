import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

(async () => {
  const r = await pool.query(
    "SELECT keyword, target_url_slug, priority FROM content_opportunities WHERE status = $1 ORDER BY priority DESC LIMIT 20",
    ['pending']
  );
  console.log('Pending keyword count:', r.rows.length);
  r.rows.forEach((row, i) => console.log((i+1)+'.', row.keyword.slice(0, 55), '| slug:', (row.target_url_slug||'').slice(0, 40), '| pri:', row.priority));
  console.log('\n--- Full pending keyword sample (first 5) ---');
  r.rows.slice(0, 5).forEach((row, i) => console.log((i+1)+'. FULL:', row.keyword));
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
