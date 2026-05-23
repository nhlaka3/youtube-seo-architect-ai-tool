import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
(async () => {
  const r = await pool.query(
    "SELECT keyword, target_url_slug, priority FROM content_opportunities WHERE status = $1 ORDER BY priority DESC",
    ['pending']
  );
  
  const slugs = r.rows.map(row => row.target_url_slug);
  console.log('Total pending:', r.rows.length);
  console.log('');
  
  // Find the "vague" ones that are long/compound and likely bad topics
  const vague = r.rows.filter(row => {
    const kw = row.keyword.toLowerCase();
    const slug = row.target_url_slug.toLowerCase();
    // Flag: compound compound names like "video optimization X" or "YouTube SEO tips"
    const isCompound = kw.split(' ').length >= 5 && (kw.includes('optimization') || kw.includes('tips'));
    return isCompound;
  });
  
  console.log('=== COMPOUND/VAUSE KEYWORDS (likely bad for AI topic) ===');
  vague.forEach((row) => {
    console.log('  kw  :', row.keyword.slice(0, 70));
    console.log('  slug:', row.target_url_slug);
    console.log('');
  });
  
  // Show the clean/simple ones
  const clean = r.rows.filter(row => !vague.includes(row));
  console.log('=== CLEAN KEYWORDS (likely good for AI topic) ===');
  clean.forEach((row) => {
    console.log('  kw  :', row.keyword.slice(0, 70));
    console.log('  slug:', row.target_url_slug);
  });
  
  // Show target_url_slugs for the 7 published posts
  console.log('\n=== PUBLISHED BLOG POSTS ===');
  const published = await pool.query(
    "SELECT slug, title FROM seo_pages WHERE status = $1 ORDER BY published_at DESC",
    ['published']
  );
  published.rows.forEach((row) => console.log('  ', row.slug, '|', row.title.slice(0, 60)));
  
  pool.end().catch(() => {});
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
