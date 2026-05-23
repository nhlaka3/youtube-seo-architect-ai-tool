import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

(async () => {
  console.log('🚀 Starting Blog Image Directives Database Migration...\n');

  const { rows } = await pool.query('SELECT id, slug, content FROM seo_pages');
  console.log(`Found ${rows.length} total posts in the database.`);

  let updatedCount = 0;

  for (const row of rows) {
    let content = row.content;
    let modified = false;

    // 1. Fix missing blockquote TL;DR for youtube-tags-for-organic-growth-strategy
    if (row.slug === 'youtube-tags-for-organic-growth-strategy') {
      const divTldrRegex = /<div class="tldr">([\s\S]*?)<\/div>/i;
      const tldrMatch = content.match(divTldrRegex);
      if (tldrMatch) {
        // Extract inner text/HTML and convert to a clean blockquote
        let innerContent = tldrMatch[1];
        // Clean out headings if present to match standard blockquote TL;DR
        innerContent = innerContent.replace(/<h2>[\s\S]*?<\/h2>/gi, '').trim();
        innerContent = innerContent.replace(/<p>/gi, '').replace(/<\/p>/gi, '').trim();
        
        const newBlockquote = `<blockquote><strong>TL;DR:</strong> ${innerContent}</blockquote>`;
        content = content.replace(divTldrRegex, newBlockquote);
        modified = true;
        console.log(`  ✓ Converted TL;DR to standard blockquote for '${row.slug}'`);
      } else if (!content.includes('<blockquote>')) {
        // Hard fallback blockquote if match failed
        const newBlockquote = `<blockquote><strong>TL;DR:</strong> YouTube tags are not dead. While they are no longer the primary search driver, they serve as crucial semantic anchors that resolve lexical ambiguity for the recommendation algorithm. By using a structured 3-tier semantic tag cluster, you can significantly shorten the algorithm's discovery phase and boost organic rankings.</blockquote>`;
        content = newBlockquote + '\n' + content;
        modified = true;
        console.log(`  ✓ Added fallback blockquote TL;DR for '${row.slug}'`);
      }
    }

    // 2. Parse and update image tags
    const imgRegex = /<img([^>]*?)>/gi;
    let imgIndex = 0;
    
    // We will do a search and replace on the image tags
    const newContent = content.replace(imgRegex, (match, attributesGroup) => {
      imgIndex++;
      
      // Extract original src and alt attributes
      const srcMatch = attributesGroup.match(/src=["']([^"']*)["']/i);
      const altMatch = attributesGroup.match(/alt=["']([^"']*)["']/i);
      
      const src = srcMatch ? srcMatch[1] : '';
      const alt = altMatch ? altMatch[1] : 'YouTube SEO strategy visualization';
      
      if (imgIndex === 1) {
        // Featured Image: Eager loading, fetchpriority="high", brand border & glow
        return `<img src="${src}" alt="${alt}" width="800" height="400" loading="eager" fetchpriority="high" style="width: 100%; height: auto; max-width: 800px; border-radius: 12px; border: 1px solid #2D215E; margin: 0 0 24px 0;" />`;
      } else {
        // In-Content Image: Lazy loading, standard border-radius and spacing
        return `<img src="${src}" alt="${alt}" width="800" height="400" loading="lazy" style="width: 100%; height: auto; max-width: 800px; border-radius: 12px; margin: 24px 0;" />`;
      }
    });

    if (newContent !== row.content) {
      content = newContent;
      modified = true;
    }

    if (modified) {
      await pool.query('UPDATE seo_pages SET content = $1 WHERE id = $2', [content, row.id]);
      console.log(`  ✓ Successfully updated image tags and metadata for: '${row.slug}'`);
      updatedCount++;
    } else {
      console.log(`  - No changes needed for: '${row.slug}'`);
    }
  }

  console.log(`\n🎉 Migration Completed successfully! Updated ${updatedCount} posts.`);
  await pool.end();
})().catch(err => {
  console.error('❌ Migration failed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
