import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'content_opportunities' ORDER BY ordinal_position"
  );
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));
  // Quick data check
  const r = await pool.query("SELECT COUNT(*) AS cnt FROM content_opportunities");
  console.log('Total rows:', r.rows[0].cnt);
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
