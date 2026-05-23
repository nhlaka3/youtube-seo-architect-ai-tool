# TASK 11C — Programmatic SEO: Indexing & Auto-Expansion

## Goal
Phase 3 of the Programmatic SEO system. Ensure the 500+ generated pages are indexed by Google and the system automatically expands its reach based on real-time search trends and user interactions.

---

## STEP 1 — Dynamic Sitemap & Robots.txt

**Create file: `api/programmatic-seo/indexing.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

// ── Route: Serve dynamic sitemap.xml ──
router.get('/sitemap.xml', async (req, res) => {
  try {
    const { default: db } = await import('../../src/database/services.js');
    const pages = db.getAllSeoPages('published');
    
    const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
  </url>`;

    for (const page of pages) {
      xml += `
  <url>
    <loc>${baseUrl}/blog/${page.slug}</loc>
    <lastmod>${new Date(page.published_at || page.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    xml += '\n</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) {
    res.status(500).send('Error generating sitemap');
  }
});

// ── Route: Serve robots.txt ──
router.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Allow: /blog/
Allow: /tools/
Sitemap: ${baseUrl}/sitemap.xml
`);
});

export default router;
```

---

## STEP 2 — Auto-Expansion Engine

**Modify file: `api/programmatic-seo/generator.js`**

Add a function to automatically create a content opportunity when a user searches for a new high-intent keyword in the dashboard.

```js
// ── Auto-Expansion Logic ──
export async function triggerAutoExpansion(keyword, niche = 'YouTube SEO') {
  const { default: db } = await import('../../src/database/services.js');
  
  // Check if we already have a page or opportunity for this
  const existing = db.prepare(`
    SELECT id FROM content_opportunities WHERE keyword = ? 
    UNION 
    SELECT id FROM seo_pages WHERE title LIKE ?
  `).get(keyword, `%${keyword}%`);

  if (!existing) {
    console.log(`[PSEO] Auto-expanding for keyword: ${keyword}`);
    const slug = keyword.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

    db.createContentOpportunity({
      keyword,
      pageType: 'blog',
      slug,
      priority: 3 // Organic expansion priority
    });
    
    // Optionally: Trigger immediate generation if system load is low
    // await generatePageForOpportunity(keyword, niche);
  }
}
```

---

## STEP 3 — Integration with Core Tools

**Modify file: `api/youtube-ops.js` (Keyword Search Route)**

Hook the auto-expansion engine into the keyword research tool.

```js
import { triggerAutoExpansion } from './programmatic-seo/generator.js';

// Inside your keyword search handler:
router.post('/keyword-search', async (req, res) => {
  const { query } = req.body;
  // ... existing search logic ...
  
  // Trigger PSEO expansion in background
  if (query && query.length > 3) {
    triggerAutoExpansion(query).catch(e => console.error('PSEO Expansion Error:', e));
  }
  
  // ... return results ...
});
```

---

## STEP 4 — Public Tools Routing

**Modify file: `main.js`**

Add the indexing router and generic tool routes.

```js
import { router as indexingRouter } from './api/programmatic-seo/indexing.js';

// Public SEO files
app.get('/sitemap.xml', (req, res) => res.redirect('/api/pseo/indexing/sitemap.xml'));
app.get('/robots.txt', (req, res) => res.redirect('/api/pseo/indexing/robots.txt'));
app.use('/api/pseo/indexing', indexingRouter);

// Programmatic Tool Template Route
app.get('/tools/:tool/:slug', (req, res) => {
    // This route serves the same SEO logic as /blog/:slug 
    // but with a 'tool' context for different layouts if needed.
    res.redirect(`/blog/${req.params.slug}?context=${req.params.tool}`);
});
```

---

## Acceptance Criteria

1. Navigating to `/sitemap.xml` returns a valid XML sitemap containing all published pages.
2. Navigating to `/robots.txt` returns standard instructions and the sitemap link.
3. Performing a keyword search in the dashboard automatically creates a new row in the `content_opportunities` table for that keyword (if unique).
4. `/tools/tag-generator/my-slug` redirects or resolves to the correct SEO content page.
5. `BASE_URL` environment variable is used for absolute links in the sitemap.

## Files Changed
- `api/programmatic-seo/indexing.js` — NEW
- `api/programmatic-seo/generator.js` — MODIFIED (Auto-expansion logic)
- `api/youtube-ops.js` — MODIFIED (Keyword search hook)
- `main.js` — MODIFIED (Indexing routes)
- `AGENT_TASKS/README.md` — MODIFIED (Index update)
