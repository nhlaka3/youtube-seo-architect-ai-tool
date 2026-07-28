// api/programmatic-seo/indexing.js
// Phase 11C — Dynamic Sitemap, Robots.txt & Tool Routing
import express from 'express';
export const router = express.Router();

// ── GET /sitemap.xml — Dynamic XML sitemap of all published SEO pages ──
router.get('/sitemap.xml', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');

    const pages = await dbService.db.select()
      .from(s.seoPages)
      .where(eq(s.seoPages.status, 'published'))
      .orderBy(desc(s.seoPages.publishedAt))
      .limit(500);

    const base = process.env.BASE_URL || `https://${req.get('host')}`;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url><loc>${base}/</loc><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${base}/dashboard</loc><priority>0.9</priority></url>\n`;
    xml += `  <url><loc>${base}/blog</loc><priority>0.9</priority></url>\n`;
    xml += `  <url><loc>${base}/pricing</loc><priority>0.8</priority></url>\n`;
    xml += `  <url><loc>${base}/about</loc><priority>0.7</priority></url>\n`;
    xml += `  <url><loc>${base}/changelog</loc><priority>0.6</priority></url>\n`;

    for (const page of pages) {
      const date = page.publishedAt
        ? new Date(page.publishedAt).toISOString().split('T')[0]
        : '2026-05-14';
      xml += `  <url><loc>${base}/blog/${page.slug}</loc><lastmod>${date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
    }

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    console.error('[PSEO Indexing] Sitemap error:', e.message);
    res.status(500).send('Error generating sitemap');
  }
});

// ── GET /robots.txt — Standard robots.txt with sitemap directive ──
router.get('/robots.txt', async (req, res) => {
  try {
    const base = process.env.BASE_URL || `https://${req.get('host')}`;
    const robots = [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${base}/sitemap.xml`
    ].join('\n');

    res.header('Content-Type', 'text/plain');
    res.send(robots);
  } catch (e) {
    console.error('[PSEO Indexing] Robots.txt error:', e.message);
    res.status(500).send('Error');
  }
});
