import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  // Find which content_opportunities are linked to the 7 published posts
  const r1 = await pool.query(
    "SELECT id::text, keyword, target_url_slug, status FROM content_opportunities ORDER BY created_at DESC LIMIT 20"
  );
  console.log('=== Latest 20 content_opportunities ===');
  r1.rows.forEach((row, i) => console.log((i+1)+'.', row.id.slice(0,8), '|', row.keyword, '|', row.target_url_slug, '|', row.status));
  
  console.log('\n=== PENDING (by keyword match to known slugs) ===');
  const knownSlugs = ['youtube-thumbnail-tips','youtube-video-optimization-tags','youtube-categories-tips',
    'youtube-tags-best-practices','youtube-video-optimization-description','youtube-description-tips',
    'youtube-playlist-seo-for-small-channels'];
  const { rows: genRows } = await pool.query(
    'SELECT id::text, keyword, target_url_slug, status, seo_page_id::text FROM content_opportunities WHERE status = ANY($1::text[])', 
    [['generated','published','pending']]
  );
  genRows.forEach(row => {
    if (knownSlugs.includes(row.target_url_slug) || knownSlugs.some(s => row.keyword.toLowerCase().includes(s.replace('youtube-','').replace(/-/g,' ')))) {
      console.log(row.id.slice(0,8), '|', row.keyword.slice(0,50), '| slug:', row.target_url_slug, '|', row.status, '| pageId:', row.seo_page_id?.slice(0,8));
    }
  });
  
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
