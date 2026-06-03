import 'dotenv/config';
import fs from 'fs';
import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importPost(slug) {
  const filePath = `public/blog/${slug}.html`;
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const html = fs.readFileSync(filePath, 'utf8');

  // Extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const fullTitle = titleMatch ? titleMatch[1].replace(' — YT SEO Architect', '') : slug;

  // Extract meta description
  const descMatch = html.match(/<meta name="description" content="(.*?)"/i);
  const metaDesc = descMatch ? descMatch[1] : '';

  // Extract content (body of <article>)
  // We want to include breadcrumbs, meta line, author box, hero image, tldr, toc, and body.
  const contentMatch = html.match(/<article.*?>([\s\S]*?)<\/article>/i);
  let content = contentMatch ? contentMatch[1].trim() : html;

  // Clean up content: remove bottom CTA if it exists (renderer adds one)
  content = content.replace(/<div class="cta-box cta-bottom">[\s\S]*?<\/div>/i, '');
  // Remove the H1 because the renderer adds it
  content = content.replace(/<h1>.*?<\/h1>/i, '');

  const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;

  console.log(`Importing ${slug}... (${wordCount} words)`);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO seo_pages (id, slug, title, meta_description, content, word_count, status, published_at, page_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         meta_description = EXCLUDED.meta_description,
         content = EXCLUDED.content,
         word_count = EXCLUDED.word_count,
         status = EXCLUDED.status,
         published_at = EXCLUDED.published_at
       RETURNING id`,
      [createId(), slug, fullTitle, metaDesc, content, wordCount, 'published', new Date(), 'blog']
    );
    console.log(`Successfully imported ${slug} (ID: ${res.rows[0].id})`);
  } catch (e) {
    console.error(`Error importing ${slug}:`, e.message);
  } finally {
    client.release();
  }
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/import-html-post.mjs <slug>');
  process.exit(1);
}

importPost(slug).then(() => pool.end());
