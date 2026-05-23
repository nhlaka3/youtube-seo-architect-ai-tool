// api/programmatic-seo/keyword-clusters.js
// Phase 11A — Keyword Cluster Engine
import express from 'express';
export const router = express.Router();

async function generateClusters(niche, seedKeyword) {
  const { default: dbService } = await import('../../src/database/services.js');
  const s = await import('../../src/database/schema.js');
  const { desc } = await import('drizzle-orm');

  // Get weak competitor pages for context
  const weak = await dbService.db.select()
    .from(s.competitorPages)
    .orderBy(desc(s.competitorPages.weaknessScore))
    .limit(10);
  const weakSum = weak
    .map(p => `"${p.title}" (${p.wordCount} words, weakness:${p.weaknessScore}/100, keyword:${p.keywordFocus})`)
    .join('\n');

  // Extract competitor keywords to constrain AI
  const compKeywords = [...new Set(weak.map(p => p.keywordFocus).filter(Boolean))].join(', ');

  const { askAI } = await import('../_lib/ai-provider.js');
  const raw = await askAI(
    'You are a programmatic SEO strategist. CRITICAL: Generate keywords ONLY for the exact niche specified. Do NOT introduce unrelated topics like cooking, food, recipes, vacuum, science fiction. If the niche is YouTube SEO, only generate YouTube SEO keywords. Return ONLY valid JSON.',
    `Generate keyword clusters for niche:"${niche}" seed:"${seedKeyword}".
Competitor keywords found: ${compKeywords}
Weak competitor pages we can beat:
${weakSum}

Generate clusters that directly target the SAME keywords/topics as these weak competitors so we can outrank them. JSON: {"clusters":[{"clusterName":"...","pillarKeyword":"...","supportingKeywords":["..."],"searchIntent":"informational","monthlyVolumeTier":"Medium","competition":"Low","opportunityScore":75,"contentGap":true,"recommendedPageType":"blog"}]}`,
    { temperature: 0.4, maxTokens: 2000, forceJson: true }
  );

  const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
  let saved = 0;

  for (const c of (data.clusters || [])) {
    await dbService.saveKeywordCluster({
      clusterName: c.clusterName,
      pillarKeyword: c.pillarKeyword,
      supportingKeywords: c.supportingKeywords || [],
      searchIntent: c.searchIntent,
      monthlyVolumeTier: c.monthlyVolumeTier,
      competition: c.competition,
      opportunityScore: c.opportunityScore || 0,
      contentGap: c.contentGap,
      recommendedPageType: c.recommendedPageType || 'blog'
    });

    // Create content opportunities for supporting keywords
    for (const kw of (c.supportingKeywords || []).slice(0, 3)) {
      const slug = kw.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60);
      await dbService.createContentOpportunity({
        keyword: kw,
        pageType: c.recommendedPageType || 'blog',
        targetUrlSlug: slug,
        priority: Math.round((c.opportunityScore || 50) / 10)
      });
    }
    saved++;
  }

  return { clustersGenerated: saved, clusters: data.clusters, contentGapSummary: data.contentGapSummary };
}

// ── POST /generate — Generate keyword clusters via AI ──
router.post('/generate', async (req, res) => {
  try {
    const { niche, seedKeyword } = req.body || {};
    if (!niche || !seedKeyword) return res.status(400).json({ error: 'niche + seedKeyword required' });
    const result = await generateClusters(niche, seedKeyword);
    res.json(result);
  } catch (e) {
    console.error('[PSEO] Cluster generation error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET / — Return top clusters ──
router.get('/', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const clusters = await dbService.getTopClusters(50);
    res.json({ clusters });
  } catch (e) {
    console.error('[PSEO] Clusters fetch error:', e.message);
    res.json({ clusters: [] });
  }
});

// ── GET /opportunities — Return pending opportunities + stats ──
router.get('/opportunities', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const opportunities = await dbService.getPendingOpportunities(50);
    const stats = await dbService.getSeoStats();
    res.json({ opportunities, stats });
  } catch (e) {
    console.error('[PSEO] Opportunities fetch error:', e.message);
    res.json({ opportunities: [], stats: { publishedPages: 0, pendingOpportunities: 0, clusters: 0 } });
  }
});

// ── POST /cleanup — Delete off-topic opportunities (cooking, vacuum, etc.) ──
router.post('/cleanup', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { like, or } = await import('drizzle-orm');
    
    const blockedTerms = ['%cooking%', '%cook%', '%recipe%', '%food%', '%kitchen%', 
      '%vacuum%', '%science fiction%', '%myth%', '%misconceptions%', '%popular culture%'];
    
    let deleted = 0;
    for (const term of blockedTerms) {
      const result = await dbService.db.delete(s.contentOpportunities)
        .where(like(s.contentOpportunities.keyword, term));
      deleted += result.rowCount || 0;
    }
    
    res.json({ success: true, deleted, message: `Cleaned up ${deleted} off-topic opportunities` });
  } catch (e) {
    console.error('[PSEO] Cleanup error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /cleanup-pages — Delete off-topic + thin pages from blog ──
router.post('/cleanup-pages', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { like, lt, or } = await import('drizzle-orm');
    
    const blockedTerms = ['%cooking%', '%cook%', '%recipe%', '%food%', '%kitchen%', 
      '%vacuum%', '%science-fiction%', '%myth%', '%misconceptions%', '%popular-culture%'];
    
    let deleted = 0;
    // Delete off-topic pages
    for (const term of blockedTerms) {
      const result = await dbService.db.delete(s.seoPages)
        .where(like(s.seoPages.slug, term));
      deleted += result.rowCount || 0;
    }
    // Delete thin pages (< 300 words)
    const thinResult = await dbService.db.delete(s.seoPages)
      .where(lt(s.seoPages.wordCount, 300));
    deleted += thinResult.rowCount || 0;
    
    res.json({ success: true, deleted, message: `Removed ${deleted} weak/useless pages` });
  } catch (e) {
    console.error('[PSEO] Page cleanup error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export { generateClusters };
