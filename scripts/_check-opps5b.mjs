import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  const r = await pool.query(
    "SELECT id::text, keyword, target_url_slug, priority, status, plan_spec FROM content_opportunities WHERE status = $1 ORDER BY created_at ASC LIMIT 20",
    ['pending']
  );
  console.log('Pending rows:', r.rows.length);
  r.rows.forEach((row, i) => {
    console.log((i+1)+'.', row.keyword.slice(0, 55));
    console.log('   slug:', row.target_url_slug);
    console.log('   plan_spec:', typeof row.plan_spec === 'object' ? JSON.stringify(row.plan_spec).slice(0, 100) : row.plan_spec);
    console.log('');
  });
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
