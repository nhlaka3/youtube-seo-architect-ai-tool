import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  // Try non-parameterized (direct literal), then parameterized
  try {
    const r1 = await pool.query(
      "SELECT id::text, keyword, target_url_slug FROM content_opportunities WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5"
    );
    console.log('Literal query rows:', r1.rows.length);
    r1.rows.forEach(r => console.log('  ', r.keyword.slice(0, 55), '|', r.target_url_slug));
  } catch(e) {
    console.error('Literal query error:', e.message);
  }
  
  try {
    const r2 = await pool.query(
      'SELECT id::text, keyword, target_url_slug FROM content_opportunities WHERE status = $1 ORDER BY created_at ASC LIMIT 5',
      ['pending']
    );
    console.log('\nParam query rows:', r2.rows.length);
    r2.rows.forEach(r => console.log('  ', r.keyword.slice(0, 55), '|', r.target_url_slug));
  } catch(e) {
    console.error('Param query error:', e.message);
  }
  
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
