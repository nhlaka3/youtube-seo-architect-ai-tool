import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function main() {
  // Step 1: delete all seoPages published before the new post, keep only the new one
  const r1 = await pool.query(`
    DELETE FROM seo_pages
    WHERE published_at < '2026-05-18T11:31:40'
      AND slug != 'youtube-playlist-seo-for-small-channels'
    RETURNING slug
  `);
  console.log('seoPages deleted:', r1.rowCount);

  // Step 2: mark orphaned contentOpportunities as 'expired'
  const r2 = await pool.query(`
    UPDATE content_opportunities
    SET status = 'expired'
    WHERE status = 'generated'
      AND (page_id IS NULL OR page_id NOT IN (SELECT id FROM seo_pages))
  `);
  console.log('contentOpportunities marked expired:', r2.rowCount);

  // Step 3: verify
  const r3 = await pool.query(
    "SELECT slug, published_at FROM seo_pages WHERE status='published' ORDER BY published_at DESC"
  );
  console.log('remaining posts:', r3.rowCount);
  r3.rows.forEach(p => console.log(' ', p.slug, p.published_at));

  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
