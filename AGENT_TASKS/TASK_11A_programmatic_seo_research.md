# TASK 11A — Programmatic SEO: Research & Strategy Engine

## Goal
Phase 1 of the Programmatic SEO system. Automatically analyze competitors,
identify content gaps, map keyword clusters, and generate a ranked content
opportunity database — all stored in SQLite and surfaced in the dashboard.

Phase 2 (TASK_11B) builds the actual page generator on top of this data.

---

## STEP 1 — Add programmatic SEO tables to DB

**Modify file: `src/database/services.js`**

```js
db.exec(`
  -- Competitor pages scraped/analyzed
  CREATE TABLE IF NOT EXISTS competitor_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    competitor_url TEXT NOT NULL,
    page_url TEXT NOT NULL UNIQUE,
    title TEXT,
    h1 TEXT,
    word_count INTEGER DEFAULT 0,
    keyword_focus TEXT,
    estimated_traffic_tier TEXT DEFAULT 'Unknown',
    content_type TEXT DEFAULT 'blog',
    weakness_score INTEGER DEFAULT 0,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Keyword clusters grouped by topic/intent
  CREATE TABLE IF NOT EXISTS keyword_clusters (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    cluster_name TEXT NOT NULL,
    pillar_keyword TEXT NOT NULL,
    supporting_keywords TEXT DEFAULT '[]',
    search_intent TEXT DEFAULT 'informational',
    monthly_volume_tier TEXT DEFAULT 'Low',
    competition TEXT DEFAULT 'High',
    opportunity_score INTEGER DEFAULT 0,
    content_gap BOOLEAN DEFAULT 0,
    recommended_page_type TEXT DEFAULT 'blog',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Content opportunities queue
  CREATE TABLE IF NOT EXISTS content_opportunities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    keyword TEXT NOT NULL,
    cluster_id TEXT,
    page_type TEXT DEFAULT 'blog',
    target_url_slug TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    page_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cluster_id) REFERENCES keyword_clusters(id)
  );

  -- Generated pages
  CREATE TABLE IF NOT EXISTS seo_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    opportunity_id TEXT,
    slug TEXT NOT NULL UNIQUE,
    page_type TEXT DEFAULT 'blog',
    title TEXT NOT NULL,
    meta_description TEXT,
    h1 TEXT,
    content TEXT,
    schema_markup TEXT,
    internal_links TEXT DEFAULT '[]',
    word_count INTEGER DEFAULT 0,
    keyword_density REAL DEFAULT 0,
    status TEXT DEFAULT 'draft',
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_clusters_opp ON keyword_clusters(opportunity_score DESC);
  CREATE INDEX IF NOT EXISTS idx_content_opp ON content_opportunities(priority DESC, status);
  CREATE INDEX IF NOT EXISTS idx_seo_pages_slug ON seo_pages(slug);
  CREATE INDEX IF NOT EXISTS idx_seo_pages_status ON seo_pages(status);
`);
```

Add service methods:

```js
// ── Programmatic SEO service methods ──

saveCompetitorPage(data) {
  return db.prepare(`
    INSERT OR REPLACE INTO competitor_pages
    (competitor_url, page_url, title, h1, word_count, keyword_focus,
     estimated_traffic_tier, content_type, weakness_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.competitorUrl, data.pageUrl, data.title, data.h1,
    data.wordCount || 0, data.keywordFocus, data.trafficTier || 'Unknown',
    data.contentType || 'blog', data.weaknessScore || 0
  );
},

getWeakCompetitorPages(limit = 20) {
  return db.prepare(`
    SELECT * FROM competitor_pages ORDER BY weakness_score DESC LIMIT ?
  `).all(limit);
},

saveKeywordCluster(data) {
  return db.prepare(`
    INSERT OR IGNORE INTO keyword_clusters
    (cluster_name, pillar_keyword, supporting_keywords, search_intent,
     monthly_volume_tier, competition, opportunity_score, content_gap, recommended_page_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.clusterName, data.pillarKeyword,
    JSON.stringify(data.supportingKeywords || []),
    data.searchIntent || 'informational',
    data.monthlyVolumeTier || 'Low',
    data.competition || 'High',
    data.opportunityScore || 0,
    data.contentGap ? 1 : 0,
    data.recommendedPageType || 'blog'
  );
},

getTopClusters(limit = 50) {
  return db.prepare(`
    SELECT *, json(supporting_keywords) as kws
    FROM keyword_clusters
    ORDER BY opportunity_score DESC LIMIT ?
  `).all(limit);
},

createContentOpportunity(data) {
  return db.prepare(`
    INSERT OR IGNORE INTO content_opportunities
    (keyword, cluster_id, page_type, target_url_slug, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.keyword, data.clusterId, data.pageType || 'blog',
    data.slug, data.priority || 5);
},

getPendingOpportunities(limit = 50) {
  return db.prepare(`
    SELECT co.*, kc.cluster_name, kc.pillar_keyword
    FROM content_opportunities co
    LEFT JOIN keyword_clusters kc ON co.cluster_id = kc.id
    WHERE co.status = 'pending'
    ORDER BY co.priority DESC LIMIT ?
  `).all(limit);
},

getSeoPageBySlug(slug) {
  return db.prepare(`SELECT * FROM seo_pages WHERE slug = ?`).get(slug);
},

getAllSeoPages(status = null, limit = 100) {
  if (status) {
    return db.prepare(
      `SELECT id, slug, title, page_type, status, word_count, published_at, created_at
       FROM seo_pages WHERE status = ? ORDER BY created_at DESC LIMIT ?`
    ).all(status, limit);
  }
  return db.prepare(
    `SELECT id, slug, title, page_type, status, word_count, published_at, created_at
     FROM seo_pages ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
},

saveSeoPage(data) {
  const existing = db.prepare(`SELECT id FROM seo_pages WHERE slug = ?`).get(data.slug);
  if (existing) {
    return db.prepare(`
      UPDATE seo_pages SET title=?, meta_description=?, h1=?, content=?,
        schema_markup=?, word_count=?, status=?
      WHERE slug=?
    `).run(data.title, data.metaDescription, data.h1, data.content,
      JSON.stringify(data.schemaMarkup || {}), data.wordCount || 0,
      data.status || 'draft', data.slug);
  }
  return db.prepare(`
    INSERT INTO seo_pages
    (opportunity_id, slug, page_type, title, meta_description, h1,
     content, schema_markup, word_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.opportunityId || null, data.slug, data.pageType || 'blog',
    data.title, data.metaDescription, data.h1, data.content,
    JSON.stringify(data.schemaMarkup || {}), data.wordCount || 0,
    data.status || 'draft'
  );
},

getSeoStats() {
  return {
    totalPages: db.prepare(`SELECT COUNT(*) as c FROM seo_pages`).get()?.c || 0,
    publishedPages: db.prepare(`SELECT COUNT(*) as c FROM seo_pages WHERE status='published'`).get()?.c || 0,
    clusters: db.prepare(`SELECT COUNT(*) as c FROM keyword_clusters`).get()?.c || 0,
    pendingOpportunities: db.prepare(`SELECT COUNT(*) as c FROM content_opportunities WHERE status='pending'`).get()?.c || 0,
    competitorPages: db.prepare(`SELECT COUNT(*) as c FROM competitor_pages`).get()?.c || 0,
  };
},
```

---

## STEP 2 — Create competitor analysis API

**Create file: `api/programmatic-seo/competitor-analysis.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

/**
 * Score competitor page weakness (higher = easier to beat).
 * Uses heuristics: short content, thin title, no numbers, generic h1.
 */
function scoreWeakness(page) {
  let score = 0;
  if ((page.wordCount || 0) < 800) score += 30;
  if ((page.wordCount || 0) < 400) score += 20;
  if (!page.title || page.title.length < 30) score += 15;
  if (!page.h1 || page.h1 === page.title) score += 10;
  const hasNumbers = /\d{4}|\d+\s*(tips|ways|steps|tools)/i.test(page.title || '');
  if (!hasNumbers) score += 10;
  const hasYear = /202[3-9]|203\d/i.test(page.title || '');
  if (!hasYear) score += 5;
  return Math.min(100, score);
}

/**
 * Derive keyword focus from title/h1 — simple NLP-free extraction.
 */
function deriveKeyword(title = '', h1 = '') {
  const text = (h1 || title).toLowerCase();
  // Strip common stop words and return first 4 meaningful words
  const stops = new Set(['a','an','the','and','or','for','to','in','on','of','with','how','what','why','is','are','your','you','that','this']);
  return text.split(/\s+/).filter(w => w.length > 2 && !stops.has(w)).slice(0, 4).join(' ');
}

// ── Route: Analyze competitor URLs ──
router.post('/analyze', async (req, res) => {
  try {
    const { urls, niche } = req.body;
    if (!urls?.length) return sendRes(res, 400, { error: 'urls array required' });

    const { default: db } = await import('../../src/database/services.js');
    const results = [];

    for (const baseUrl of urls.slice(0, 5)) {
      // Fetch the competitor sitemap or blog index
      let pageUrls = [];
      try {
        // Try /sitemap.xml
        const sitemapRes = await fetch(`${baseUrl.replace(/\/$/, '')}/sitemap.xml`, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' }
        });
        if (sitemapRes.ok) {
          const xml = await sitemapRes.text();
          const matches = xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g);
          for (const m of matches) {
            if (pageUrls.length >= 30) break;
            const u = m[1];
            // Filter to blog/article URLs
            if (/\/(blog|article|post|guide|how-to|tips|best|top|youtube-seo)/i.test(u)) {
              pageUrls.push(u);
            }
          }
        }
      } catch { /* Sitemap not available */ }

      // Fallback: just analyze the base URL
      if (!pageUrls.length) pageUrls = [baseUrl];

      // Analyze each page (lightweight — just fetch headers + title)
      for (const pageUrl of pageUrls.slice(0, 10)) {
        try {
          const pageRes = await fetch(pageUrl, {
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (!pageRes.ok) continue;
          const html = await pageRes.text();

          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          const title = titleMatch?.[1]?.trim().replace(/&amp;/g,'&') || '';
          const h1 = h1Match?.[1]?.trim().replace(/<[^>]+>/g,'') || '';
          // Rough word count from stripped HTML
          const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const wordCount = text.split(' ').filter(Boolean).length;

          const pageData = {
            competitorUrl: baseUrl,
            pageUrl,
            title,
            h1,
            wordCount,
            keywordFocus: deriveKeyword(title, h1),
            trafficTier: wordCount > 1500 ? 'High' : wordCount > 700 ? 'Medium' : 'Low',
            contentType: /blog|article|post/i.test(pageUrl) ? 'blog' : 'landing',
            weaknessScore: 0,
          };
          pageData.weaknessScore = scoreWeakness(pageData);

          db.saveCompetitorPage(pageData);
          results.push(pageData);
        } catch { /* Skip failed page */ }
      }
    }

    sendRes(res, 200, {
      analyzed: results.length,
      weakPages: results.filter(p => p.weaknessScore >= 40).length,
      topWeakPages: results.sort((a, b) => b.weaknessScore - a.weaknessScore).slice(0, 10),
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get stored weak competitor pages ──
router.get('/weak-pages', async (req, res) => {
  try {
    const { default: db } = await import('../../src/database/services.js');
    const pages = db.getWeakCompetitorPages(30);
    sendRes(res, 200, { pages });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Create keyword cluster API

**Create file: `api/programmatic-seo/keyword-clusters.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

/**
 * Use AI to generate a full keyword cluster map for a niche + seed keyword.
 */
async function generateClusters(niche, seedKeyword, competitors) {
  const { askAI } = await import('../_lib/ai-provider.js');
  
  const weakPagesSummary = competitors.slice(0, 5)
    .map(p => `"${p.title}" (${p.wordCount} words, weakness: ${p.weaknessScore}/100)`)
    .join('\n');

  const raw = await askAI(
    'You are a programmatic SEO strategist. Return ONLY valid JSON.',
    `Generate a comprehensive keyword cluster map for:
Niche: "${niche}"
Seed keyword: "${seedKeyword}"

Weak competitor pages found:
${weakPagesSummary || 'None analyzed yet'}

Create 8-12 keyword clusters covering:
- Informational (how-to, what is, guide)
- Commercial (best, compare, vs, tools)
- Programmatic (location-based, niche-specific, long-tail variations)
- Content gap opportunities (topics competitors cover poorly)

Return JSON:
{
  "clusters": [
    {
      "clusterName": "Topic cluster name",
      "pillarKeyword": "Main keyword (3-5 words)",
      "supportingKeywords": ["variation 1", "variation 2", "variation 3", "variation 4"],
      "searchIntent": "informational|commercial|transactional|navigational",
      "monthlyVolumeTier": "High|Medium|Low",
      "competition": "High|Medium|Low",
      "opportunityScore": 75,
      "contentGap": true,
      "recommendedPageType": "blog|landing|programmatic",
      "contentAngle": "What angle to use to beat competitors"
    }
  ],
  "programmaticTemplates": [
    {
      "template": "YouTube SEO tips for {niche} creators",
      "variables": ["niche"],
      "estimatedVariations": 50,
      "intent": "informational"
    }
  ],
  "contentGapSummary": "Key gaps found vs competitors"
}`,
    { temperature: 0.6, maxTokens: 2000 }
  );

  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Route: Generate keyword clusters ──
router.post('/generate', async (req, res) => {
  try {
    const { niche, seedKeyword } = req.body;
    if (!niche || !seedKeyword) return sendRes(res, 400, { error: 'niche + seedKeyword required' });

    const { default: db } = await import('../../src/database/services.js');
    const weakPages = db.getWeakCompetitorPages(5);

    const data = await generateClusters(niche, seedKeyword, weakPages);

    // Save clusters to DB
    let saved = 0;
    for (const cluster of (data.clusters || [])) {
      db.saveKeywordCluster({
        clusterName: cluster.clusterName,
        pillarKeyword: cluster.pillarKeyword,
        supportingKeywords: cluster.supportingKeywords || [],
        searchIntent: cluster.searchIntent,
        monthlyVolumeTier: cluster.monthlyVolumeTier,
        competition: cluster.competition,
        opportunityScore: cluster.opportunityScore || 0,
        contentGap: cluster.contentGap,
        recommendedPageType: cluster.recommendedPageType || 'blog',
      });

      // Create content opportunities for each supporting keyword
      for (const kw of (cluster.supportingKeywords || []).slice(0, 3)) {
        const slug = kw.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 60);
        db.createContentOpportunity({
          keyword: kw,
          pageType: cluster.recommendedPageType || 'blog',
          slug,
          priority: Math.round((cluster.opportunityScore || 50) / 10),
        });
      }
      saved++;
    }

    sendRes(res, 200, {
      clustersGenerated: saved,
      clusters: data.clusters,
      programmaticTemplates: data.programmaticTemplates || [],
      contentGapSummary: data.contentGapSummary,
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get top clusters ──
router.get('/', async (req, res) => {
  try {
    const { default: db } = await import('../../src/database/services.js');
    const clusters = db.getTopClusters(50);
    sendRes(res, 200, { clusters });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get pending content opportunities ──
router.get('/opportunities', async (req, res) => {
  try {
    const { default: db } = await import('../../src/database/services.js');
    const opportunities = db.getPendingOpportunities(100);
    const stats = db.getSeoStats();
    sendRes(res, 200, { opportunities, stats });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 4 — Register both routers in main.js

```js
// Imports:
import { router as competitorRouter } from './api/programmatic-seo/competitor-analysis.js';
import { router as clusterRouter } from './api/programmatic-seo/keyword-clusters.js';

// Register:
app.use('/api/pseo/competitors', competitorRouter);
app.use('/api/pseo/clusters', clusterRouter);
```

---

## STEP 5 — Create the directory

```bash
mkdir "api/programmatic-seo"
```

Or on Windows:
```powershell
New-Item -ItemType Directory -Path "api\programmatic-seo" -Force
```

---

## Acceptance Criteria

1. `POST /api/pseo/competitors/analyze` with `{ urls: ["https://competitor.com"], niche: "YouTube SEO" }`
   — fetches sitemap, scrapes up to 10 pages, saves them, returns `{ analyzed, weakPages, topWeakPages }`
2. `GET /api/pseo/competitors/weak-pages` returns stored pages sorted by weakness score
3. `POST /api/pseo/clusters/generate` with `{ niche, seedKeyword }` returns
   `{ clustersGenerated, clusters, programmaticTemplates, contentGapSummary }`
4. Each cluster has: `pillarKeyword, supportingKeywords[], opportunityScore, contentGap, recommendedPageType`
5. DB has: `competitor_pages`, `keyword_clusters`, `content_opportunities`, `seo_pages` tables
6. `GET /api/pseo/clusters/opportunities` returns ranked pending content opportunities

## Files Changed
- `src/database/services.js` — MODIFIED (4 new tables + 9 new methods)
- `api/programmatic-seo/competitor-analysis.js` — NEW
- `api/programmatic-seo/keyword-clusters.js` — NEW
- `main.js` — MODIFIED (2 router registrations)

---
**Next: TASK_11B** — builds the page generator, blog engine, schema markup, and dashboard UI on top of this data.
