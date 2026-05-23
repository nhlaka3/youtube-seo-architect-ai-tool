import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

(async () => {
  console.log('🧼 Starting Clean-Up: Removing Forbidden AI Word "leverage"...\n');

  const { rows } = await pool.query('SELECT id, slug, content FROM seo_pages');
  let cleanCount = 0;

  for (const row of rows) {
    let content = row.content;
    
    // Leverage case-insensitive match (leverage, leverages, Leveraging, leveraged)
    const leverageRegex = /\bleverage(s|d|ng)?\b/gi;
    
    if (leverageRegex.test(content)) {
      const updatedContent = content.replace(leverageRegex, (match) => {
        const lower = match.toLowerCase();
        let replacement = 'use';
        
        if (lower.startsWith('leveraging')) {
          replacement = 'harnessing';
        } else if (lower.endsWith('d')) {
          replacement = 'used';
        } else if (lower.endsWith('s')) {
          replacement = 'uses';
        } else if (lower.endsWith('ng')) {
          replacement = 'using';
        } else {
          replacement = 'harness';
        }
        
        // Match original case (Capitalized or lowercase)
        if (match[0] === match[0].toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });

      await pool.query('UPDATE seo_pages SET content = $1 WHERE id = $2', [updatedContent, row.id]);
      console.log(`  ✓ Cleaned up "leverage" from post: '${row.slug}'`);
      cleanCount++;
    }
  }

  console.log(`\n🎉 Success! Cleaned "leverage" from ${cleanCount} posts.`);
  await pool.end();
})().catch(err => {
  console.error(err);
  pool.end().catch(() => {});
  process.exit(1);
});
