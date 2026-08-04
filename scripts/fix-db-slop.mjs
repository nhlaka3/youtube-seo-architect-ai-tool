// fix-db-slop.mjs — strip fabricated stats/claims from DB-served blog posts (F-003/F-004/F-006)
// Usage: node scripts/fix-db-slop.mjs   (reads .env.local for DATABASE_URL)
import { config } from 'dotenv';
config({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 45000 });

// Neon cold starts ETIMEDOUT on first 1-3 connects — retry with backoff
async function queryWithRetry(text, params, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try { return await pool.query(text, params); }
    catch (e) {
      if (i === attempts) throw e;
      await new Promise(r => setTimeout(r, 2500 * i));
    }
  }
}

// slug -> [ [old, new], ... ] exact-string replacements on seo_pages.content
const FIXES = {
  'youtube-seo-for-business-channels-2026': [
    [
      'Business channels that use structured metadata with keyword-first titles, timestamped descriptions, and playlist-driven session watch time see 2.3x more impressions than those that upload without an SEO strategy, based on data from 1,400+ B2B YouTube channels analyzed in early 2026.',
      'Business channels that use structured metadata with keyword-first titles, timestamped descriptions, and playlist-driven session watch time tend to earn more impressions than those that upload without an SEO strategy.',
    ],
    [
      'You can automate 80% of this work using',
      'You can automate most of this work using',
    ],
  ],
  'how-to-increase-youtube-retention-2026': [
    [
      'Channels implementing "Micro-Hook" resets see a 34% higher Average View Duration (AVD) compared to linear narratives.',
      'Channels that reset the viewer\'s attention with frequent pattern interrupts ("micro-hooks") tend to see higher Average View Duration (AVD) than linear narratives.',
    ],
    [
      'If you can deliver the same value in 6 minutes, do it. Your AVD percentage will skyrocket, and the algorithm will promote your video to 10x more people, easily offsetting the lost ad slot.',
      'If you can deliver the same value in 6 minutes, do it. Your AVD percentage will rise, and the algorithm will promote your video to more people, easily offsetting the lost ad slot.',
    ],
  ],
  'how-to-metadata-youtube': [
    [
      'Videos with fully optimized metadata get 3x more impressions than those with default or partial metadata across all channel sizes.',
      'Videos with fully optimized metadata tend to earn more impressions than those with default or partial metadata.',
    ],
    [
      '"How do chapter timestamps improve YouTube SEO?", "acceptedAnswer": {"@type": "Answer", "text": "Chapter timestamps create key moments in Google search results, increasing your visibility. Videos with chapters appear in 67% more key moments results and give viewers a reason to click specific sections, improving overall watch time.',
      '"How do chapter timestamps improve YouTube SEO?", "acceptedAnswer": {"@type": "Answer", "text": "Chapter timestamps create key moments in Google search results, increasing your visibility. Videos with chapters give viewers a reason to click specific sections, improving overall watch time.',
    ],
    [
      '<p>"I went from 200 views per video to 5,000+ in 6 weeks just by fixing my metadata." — Tech creator, 12K subscribers</p>',
      '',
    ],
  ],
  'how-to-keywords-youtube': [
    [
      'Videos targeting long-tail keywords (3+ words) with 100–5,000 monthly searches get 3x more impressions than broad terms.',
      'Videos targeting long-tail keywords (3+ words) tend to earn more impressions than videos targeting broad terms.',
    ],
    [
      'This is the exact process I use for every video on my channel. It takes 20 minutes and consistently finds keywords that rank in the top 5 within 30 days.',
      'This is the exact process I use for every video on my channel. It takes about 20 minutes per keyword.',
    ],
    [
      '<strong>Chapter timestamps</strong> are being weighted more heavily in search ranking — videos with chapters appear in 67% more "key moments" results.',
      '<strong>Chapter timestamps</strong> are being weighted more heavily in search ranking — videos with chapters appear more often in "key moments" results.',
    ],
    [
      '<strong>YouTube Shorts monetization</strong> expanded to all creators — Shorts now generate 40% of new subscriber acquisition for channels under 10K subs.',
      '<strong>YouTube Shorts monetization</strong> expanded to all creators — Shorts now drive a large share of new subscriber acquisition for smaller channels.',
    ],
    [
      '<p>"I went from 200 views per video to 5,000+ in 6 weeks just by fixing my keyword targeting." — Gaming creator, 8K subscribers</p>',
      '',
    ],
  ],
};

let total = 0;
for (const [slug, pairs] of Object.entries(FIXES)) {
  const r = await queryWithRetry('SELECT id, content FROM seo_pages WHERE slug=$1', [slug]);
  if (!r.rows.length) { console.log(`SKIP ${slug}: not in DB`); continue; }
  const { id, content } = r.rows[0];
  let c = content;
  let applied = 0, missed = 0;
  for (const [old, next] of pairs) {
    if (c.includes(old)) { c = c.replace(old, next); applied++; }
    else { console.log(`  MISSED in ${slug}: ${old.slice(0, 70)}...`); missed++; }
  }
  if (applied > 0) {
    const wc = c.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    await queryWithRetry('UPDATE seo_pages SET content=$1, word_count=$2 WHERE id=$3', [c, wc, id]);
    console.log(`UPDATED ${slug}: ${applied} fixes, ${missed} missed, ${r.rows[0].word_count}->${wc} words`);
    total += applied;
  }
}
console.log(`\nTotal fixes applied: ${total}`);
await pool.end();
