# TASK 11B — Programmatic SEO: Content Generator & Blog Engine

## Goal
Phase 2 of the Programmatic SEO system. Convert the research data from TASK_11A into 500+ high-quality, AI-generated landing pages and blog posts. Includes a public routing engine, automated schema markup (JSON-LD), and a "PSEO Lab" dashboard UI.

---

## STEP 1 — Automated Page Generator API

**Create file: `api/programmatic-seo/generator.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

/**
 * Generate a full SEO-optimized page using AI.
 */
async function generatePageContent(opportunity, niche) {
  const { askAI } = await import('../_lib/ai-provider.js');
  
  const prompt = `You are a world-class SEO content writer. Create a high-value ${opportunity.page_type} for the keyword: "${opportunity.keyword}".
Niche: ${niche}
Topic Cluster: ${opportunity.cluster_name}

Requirements:
- Word count: 1200+ words
- Structure: H1, Intro, 4-6 H2 sections, Conclusion
- Style: Informative, authoritative, includes actionable YouTube tips
- Internal Link placeholders: Use [[INTERNAL_LINK]] where relevant
- Schema: Include data for an Article or FAQ schema

Return JSON:
{
  "title": "SEO Optimized Title (60 chars)",
  "metaDescription": "Compelling meta description (155 chars)",
  "h1": "Main Heading",
  "contentHtml": "The full article in clean HTML (no <html>/<body> tags)",
  "schema": { "type": "Article", "faq": [] },
  "tags": ["keyword1", "keyword2"]
}`;

  const raw = await askAI(
    'You are a programmatic SEO engine. Return ONLY valid JSON.',
    prompt,
    { temperature: 0.7, maxTokens: 3000 }
  );

  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Route: Generate page for an opportunity ──
router.post('/generate-page', async (req, res) => {
  try {
    const { opportunityId, niche } = req.body;
    const { default: db } = await import('../../src/database/services.js');
    
    const opp = db.prepare(`
      SELECT co.*, kc.cluster_name 
      FROM content_opportunities co
      LEFT JOIN keyword_clusters kc ON co.cluster_id = kc.id
      WHERE co.id = ?
    `).get(opportunityId);

    if (!opp) return sendRes(res, 404, { error: 'Opportunity not found' });

    const generated = await generatePageContent(opp, niche || 'YouTube SEO');

    const pageData = {
      opportunityId: opp.id,
      slug: opp.target_url_slug,
      pageType: opp.page_type,
      title: generated.title,
      metaDescription: generated.metaDescription,
      h1: generated.h1,
      content: generated.contentHtml,
      schemaMarkup: generated.schema,
      wordCount: generated.contentHtml.split(' ').length,
      status: 'draft'
    };

    db.saveSeoPage(pageData);
    
    // Update opportunity status
    db.prepare(`UPDATE content_opportunities SET status = 'generated' WHERE id = ?`).run(opp.id);

    sendRes(res, 200, { success: true, page: pageData });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Bulk generate (Batch) ──
router.post('/bulk-generate', async (req, res) => {
  try {
    const { limit = 5, niche } = req.body;
    const { default: db } = await import('../../src/database/services.js');
    
    const opportunities = db.getPendingOpportunities(limit);
    const results = [];

    for (const opp of opportunities) {
       // Note: In production, use a queue/worker. This is for the MVP.
       try {
         const generated = await generatePageContent(opp, niche || 'YouTube SEO');
         db.saveSeoPage({
            opportunityId: opp.id,
            slug: opp.target_url_slug,
            pageType: opp.page_type,
            title: generated.title,
            metaDescription: generated.metaDescription,
            h1: generated.h1,
            content: generated.contentHtml,
            schemaMarkup: generated.schema,
            wordCount: generated.contentHtml.split(' ').length,
            status: 'published'
         });
         db.prepare(`UPDATE content_opportunities SET status = 'generated' WHERE id = ?`).run(opp.id);
         results.push(opp.target_url_slug);
       } catch (err) {
         console.error(`Failed to generate ${opp.keyword}:`, err);
       }
    }

    sendRes(res, 200, { generated: results });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 2 — Public Blog Routing

**Modify file: `main.js`**

Add public routes to serve the generated pages at `/blog/:slug`.

```js
// ── Public SEO Blog Engine ──
app.get('/blog/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { default: db } = await import('./src/database/services.js');
    const page = db.getSeoPageBySlug(slug);

    if (!page) return res.status(404).send('Page not found');

    // Simple Template (Can be swapped for a dedicated view engine)
    const schema = JSON.parse(page.schema_markup || '{}');
    const schemaHtml = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${page.title}</title>
        <meta name="description" content="${page.meta_description}">
        ${schemaHtml}
        <link rel="stylesheet" href="/style.css">
        <style>
          body { font-family: 'Inter', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0a0a0f; color: #eee; }
          article h1 { color: #00d4ff; font-size: 2.5rem; }
          article h2 { color: #00d4ff; margin-top: 2rem; }
          .meta { color: #888; font-size: 0.9rem; margin-bottom: 2rem; }
          .content { font-size: 1.1rem; }
          nav { margin-bottom: 3rem; }
          nav a { color: #00d4ff; text-decoration: none; }
        </style>
      </head>
      <body>
        <nav><a href="/">← Back to Dashboard</a></nav>
        <article>
          <h1>${page.h1 || page.title}</h1>
          <div class="meta">Published: ${new Date(page.created_at).toLocaleDateString()} | Word Count: ${page.word_count}</div>
          <div class="content">${page.content}</div>
        </article>
      </body>
      </html>
    `);
  } catch (e) {
    res.status(500).send('Internal Server Error');
  }
});

// Register generator router
import { router as generatorRouter } from './api/programmatic-seo/generator.js';
app.use('/api/pseo/generator', generatorRouter);
```

---

## STEP 3 — Dashboard UI: "SEO Lab"

**Modify file: `dashboard.html`**

Add a new tab for "SEO Lab" and the corresponding UI components.

```html
<!-- Tab Link -->
<div class="nav-item" onclick="showTab('seo-lab')">
  <i class="fas fa-search-plus"></i> SEO Lab
</div>

<!-- SEO Lab Content -->
<div id="seo-lab" class="tab-content" style="display:none">
  <div class="section-header">
    <h2>Programmatic SEO Lab</h2>
    <div class="header-actions">
      <button class="btn-primary" onclick="generateClusters()">Scan Niche Clusters</button>
      <button class="btn-secondary" onclick="bulkGeneratePages()">Batch Publish (5)</button>
    </div>
  </div>

  <div class="grid-3">
    <div class="stat-card">
      <div class="stat-val" id="seo-pages-count">0</div>
      <div class="stat-label">Published Pages</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" id="seo-opp-count">0</div>
      <div class="stat-label">Pending Opportunities</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" id="seo-cluster-count">0</div>
      <div class="stat-label">Keyword Clusters</div>
    </div>
  </div>

  <div class="mt-2">
    <h3>Content Opportunities</h3>
    <div class="data-table-container">
      <table id="seo-opp-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Cluster</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="seo-opp-body">
          <!-- Populated via JS -->
        </tbody>
      </table>
    </div>
  </div>
</div>
```

---

## STEP 4 — Dashboard Logic

**Modify file: `main.js` (UI logic section)**

```js
async function loadSeoLab() {
  const res = await fetch('/api/pseo/clusters/opportunities');
  const data = await res.json();
  
  document.getElementById('seo-pages-count').innerText = data.stats.publishedPages;
  document.getElementById('seo-opp-count').innerText = data.stats.pendingOpportunities;
  document.getElementById('seo-cluster-count').innerText = data.stats.clusters;

  const tbody = document.getElementById('seo-opp-body');
  tbody.innerHTML = data.opportunities.map(opp => `
    <tr>
      <td>${opp.keyword}</td>
      <td><span class="badge">${opp.cluster_name || 'General'}</span></td>
      <td>${opp.page_type}</td>
      <td>${'⭐'.repeat(opp.priority)}</td>
      <td>
        <button class="btn-sm" onclick="generateSinglePage('${opp.id}')">Generate</button>
      </td>
    </tr>
  `).join('');
}

async function generateSinglePage(id) {
  showToast('Generating page... this may take 30s');
  const res = await fetch('/api/pseo/generator/generate-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opportunityId: id })
  });
  if (res.ok) {
    showToast('Page generated successfully!', 'success');
    loadSeoLab();
  }
}

async function bulkGeneratePages() {
  showToast('Batch processing started...');
  const res = await fetch('/api/pseo/generator/bulk-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 5 })
  });
  if (res.ok) {
    const data = await res.json();
    showToast(`Published ${data.generated.length} pages!`, 'success');
    loadSeoLab();
  }
}
```

---

## Acceptance Criteria

1. Navigating to `/blog/my-test-slug` serves a clean, responsive HTML page with full content.
2. The page source contains valid `<script type="application/ld+json">` schema markup.
3. "SEO Lab" dashboard displays real stats from the SQLite DB.
4. "Generate" button for an opportunity creates a new row in `seo_pages` and updates the UI.
5. "Batch Publish" processes multiple pages successfully in one click.
6. AI generated content is 1200+ words and follows the H1/H2 structure.

## Files Changed
- `api/programmatic-seo/generator.js` — NEW
- `main.js` — MODIFIED (Public routing + UI logic)
- `dashboard.html` — MODIFIED (New Tab + UI structure)
