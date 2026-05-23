// api/pseo/content-plans.js
// Phase 2 — Content Plan Inbox (Review → Approve → Generate pipeline)
// Stores combinatorial planning specs, provides review/approval workflow,
// and triggers AI content generation from approved plans.
import express from 'express';
export const router = express.Router();

// ═══════════════════════════════════════════════════════════════
//  STORE: Save planning specs from long-tail engine
// ═══════════════════════════════════════════════════════════════

// POST /store — Save a batch of planning specs for review
router.post('/store', async (req, res) => {
  try {
    const { plans } = req.body || {};
    if (!plans || !Array.isArray(plans) || !plans.length) {
      return res.status(400).json({ error: 'plans array required' });
    }

    const { default: dbService } = await import('../../src/database/services.js');
    let saved = 0;
    let updated = 0;
    let skipped = 0;

    for (const plan of plans) {
      try {
        const result = await dbService.saveContentPlan({
          keyword: plan.primary_keyword,
          pageType: 'blog',
          targetUrlSlug: plan.url_slug,
          priority: Math.min(10, Math.round((plan.opportunity_score || 50) / 10)),
          status: 'pending_review',
          planSpec: plan,
        });
        if (result && result.length) {
          saved++;
        }
      } catch (e) {
        if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
          updated++;
        } else {
          skipped++;
        }
      }
    }

    res.json({ success: true, saved, updated, skipped, total: plans.length });
  } catch (e) {
    console.error('[ContentPlans] Store error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  INBOX: List plans for review
// ═══════════════════════════════════════════════════════════════

// GET /inbox — List plans awaiting review (paginated)
router.get('/inbox', async (req, res) => {
  try {
    const status = req.query.status || 'pending_review';
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const { default: dbService } = await import('../../src/database/services.js');
    const plans = await dbService.getContentPlans(status, limit);

    // Enrich with plan spec details for display
    const enriched = plans.map(p => ({
      id: p.id,
      keyword: p.keyword,
      slug: p.targetUrlSlug,
      priority: p.priority,
      status: p.status,
      category: p.planSpec?.topic_category || 'unknown',
      intent: p.planSpec?.intent || 'informational',
      audience: p.planSpec?.audience || 'all creators',
      problem: p.planSpec?.problem || '',
      seo_title: p.planSpec?.seo_title || p.keyword,
      meta_description: p.planSpec?.meta_description || '',
      opportunity_score: p.planSpec?.opportunity_score || 0,
      faq_count: (p.planSpec?.faq || []).length,
      outline_count: (p.planSpec?.outline || []).length,
      has_plan: !!p.planSpec,
      created_at: p.createdAt,
    }));

    // Category breakdown for dashboard
    const byCategory = {};
    enriched.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });

    res.json({
      plans: enriched,
      total: enriched.length,
      page,
      by_category: byCategory,
    });
  } catch (e) {
    console.error('[ContentPlans] Inbox error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /inbox/stats — Quick stats for the dashboard
router.get('/inbox/stats', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const pending = await dbService.getContentPlans('pending_review', 500);
    const approved = await dbService.getContentPlans('approved', 500);
    const rejected = await dbService.getContentPlans('rejected', 500);
    const generated = await dbService.getContentPlans('generated', 500);

    // Category distribution
    const byCategory = {};
    [...pending, ...approved].forEach(p => {
      const cat = p.planSpec?.topic_category || 'unknown';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    res.json({
      pending_review: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      generated: generated.length,
      total: pending.length + approved.length + generated.length,
      by_category: byCategory,
    });
  } catch (e) {
    console.error('[ContentPlans] Stats error:', e.message);
    res.json({ pending_review: 0, approved: 0, rejected: 0, generated: 0, total: 0 });
  }
});

// ═══════════════════════════════════════════════════════════════
//  APPROVAL: Approve / Reject / Batch
// ═══════════════════════════════════════════════════════════════

// POST /approve/:id — Approve a single plan
router.post('/approve/:id', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const result = await dbService.approveContentPlan(req.params.id);
    if (!result || !result.length) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json({ success: true, plan: result[0] });
  } catch (e) {
    console.error('[ContentPlans] Approve error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /reject/:id — Reject a single plan
router.post('/reject/:id', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { default: dbService } = await import('../../src/database/services.js');
    const result = await dbService.rejectContentPlan(req.params.id, reason || 'No reason given');
    if (!result || !result.length) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json({ success: true, plan: result[0] });
  } catch (e) {
    console.error('[ContentPlans] Reject error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /batch-approve — Approve all pending plans (with optional filters)
router.post('/batch-approve', async (req, res) => {
  try {
    const { category, minScore } = req.body || {};
    const { default: dbService } = await import('../../src/database/services.js');
    const plans = await dbService.getContentPlans('pending_review', 500);

    let approved = 0;
    for (const plan of plans) {
      // Apply filters
      if (category && plan.planSpec?.topic_category !== category) continue;
      if (minScore && (plan.planSpec?.opportunity_score || 0) < minScore) continue;

      try {
        await dbService.approveContentPlan(plan.id);
        approved++;
      } catch (e) { /* skip */ }
    }

    res.json({ success: true, approved, total_reviewed: plans.length });
  } catch (e) {
    console.error('[ContentPlans] Batch approve error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /batch-reject — Reject low-quality plans
router.post('/batch-reject', async (req, res) => {
  try {
    const { maxScore, reason } = req.body || {};
    const threshold = maxScore || 40;
    const { default: dbService } = await import('../../src/database/services.js');
    const plans = await dbService.getContentPlans('pending_review', 500);

    let rejected = 0;
    for (const plan of plans) {
      if ((plan.planSpec?.opportunity_score || 0) < threshold) {
        try {
          await dbService.rejectContentPlan(plan.id, reason || `Score below ${threshold}`);
          rejected++;
        } catch (e) { /* skip */ }
      }
    }

    res.json({ success: true, rejected, total_reviewed: plans.length });
  } catch (e) {
    console.error('[ContentPlans] Batch reject error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GENERATE: Trigger AI content from approved plans
// ═══════════════════════════════════════════════════════════════

// POST /generate/:id — Generate content from an approved plan spec
router.post('/generate/:id', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');

    // Get the plan
    const plans = await dbService.db.select().from(s.contentOpportunities)
      .where(eq(s.contentOpportunities.id, req.params.id)).limit(1);
    const plan = plans[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.status !== 'approved' && plan.status !== 'pending_review') {
      return res.status(400).json({ error: `Plan must be approved. Current status: ${plan.status}` });
    }

    const planSpec = plan.planSpec;
    if (!planSpec) return res.status(400).json({ error: 'No plan spec found' });

    // Generate content using the plan spec
    const { generatePageFromPlan } = await import('../programmatic-seo/generator.js');
    const pageContent = await generatePageFromPlan(planSpec, plan);

    if (!pageContent) {
      return res.status(500).json({ error: 'Content generation failed' });
    }

    // Save the generated page
    await dbService.saveSeoPage({
      opportunityId: plan.id,
      slug: plan.targetUrlSlug || planSpec.url_slug,
      pageType: 'blog',
      title: pageContent.title,
      metaDescription: pageContent.metaDescription,
      h1: pageContent.h1,
      content: pageContent.content,
      schemaMarkup: pageContent.schemaMarkup || '',
      internalLinks: pageContent.internalLinks || [],
      wordCount: pageContent.wordCount || 0,
      status: 'published',
      publishedAt: new Date(),
    });

    // Update plan status
    await dbService.updateContentOpportunityStatus(plan.id, 'generated', plan.targetUrlSlug);

    res.json({
      success: true,
      page: {
        slug: plan.targetUrlSlug || planSpec.url_slug,
        title: pageContent.title,
        wordCount: pageContent.wordCount,
        status: 'published',
      },
    });
  } catch (e) {
    console.error('[ContentPlans] Generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /batch-generate — Generate content for all approved plans
router.post('/batch-generate', async (req, res) => {
  try {
    const { limit } = req.body || {};
    const maxToGenerate = limit || 5;
    const { default: dbService } = await import('../../src/database/services.js');
    const plans = await dbService.getApprovedPlans(maxToGenerate);

    if (!plans.length) {
      return res.json({ generated: 0, message: 'No approved plans to generate' });
    }

    const { generatePageFromPlan } = await import('../programmatic-seo/generator.js');
    const results = [];

    for (const plan of plans) {
      try {
        const planSpec = plan.planSpec;
        if (!planSpec) continue;

        const pageContent = await generatePageFromPlan(planSpec, plan);
        if (!pageContent) continue;

        const slug = plan.targetUrlSlug || planSpec.url_slug;
        await dbService.saveSeoPage({
          opportunityId: plan.id,
          slug,
          pageType: 'blog',
          title: pageContent.title,
          metaDescription: pageContent.metaDescription,
          h1: pageContent.h1,
          content: pageContent.content,
          schemaMarkup: pageContent.schemaMarkup || '',
          internalLinks: pageContent.internalLinks || [],
          wordCount: pageContent.wordCount || 0,
          status: 'published',
          publishedAt: new Date(),
        });

        await dbService.updateContentOpportunityStatus(plan.id, 'generated', slug);
        results.push({ slug, title: pageContent.title, wordCount: pageContent.wordCount });
      } catch (pageErr) {
        console.warn('[ContentPlans] Batch generate failed for', plan.keyword, ':', pageErr.message);
      }
    }

    res.json({ success: true, generated: results.length, pages: results });
  } catch (e) {
    console.error('[ContentPlans] Batch generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PLAN DETAIL: View a single plan with full spec
// ═══════════════════════════════════════════════════════════════

// GET /detail/:id — View full plan spec
router.get('/detail/:id', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const plans = await dbService.db.select().from(s.contentOpportunities)
      .where(eq(s.contentOpportunities.id, req.params.id)).limit(1);
    const plan = plans[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    res.json({
      id: plan.id,
      keyword: plan.keyword,
      slug: plan.targetUrlSlug,
      priority: plan.priority,
      status: plan.status,
      plan_spec: plan.planSpec,
      created_at: plan.createdAt,
    });
  } catch (e) {
    console.error('[ContentPlans] Detail error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  PIPELINE: Combined generate → store → review → generate flow
// ═══════════════════════════════════════════════════════════════

// POST /pipeline — Run the full pipeline: generate candidates → store → optional auto-approve
router.post('/pipeline', async (req, res) => {
  try {
    const { categories, includeGeo, maxPerAction, limit, autoApprove, autoGenerate } = req.body || {};

    // Step 1: Generate candidates
    const { generateLongTailCandidates } = await import('../programmatic-seo/long-tail-engine.js');
    const candidates = generateLongTailCandidates({
      categories: categories || null,
      includeGeo: includeGeo || false,
      maxPerAction: maxPerAction || 8,
    });

    const limited = limit ? candidates.slice(0, limit) : candidates.slice(0, 100);

    // Step 2: Store as plans
    const { default: dbService } = await import('../../src/database/services.js');
    let stored = 0;
    const storedPlans = [];

    for (const c of limited) {
      try {
        await dbService.saveContentPlan({
          keyword: c.primary_keyword,
          pageType: 'blog',
          targetUrlSlug: c.url_slug,
          priority: Math.min(10, Math.round((c.opportunity_score || 50) / 10)),
          status: autoApprove ? 'approved' : 'pending_review',
          planSpec: c,
        });
        stored++;
        storedPlans.push(c);
      } catch (e) { /* skip duplicates */ }
    }

    // Step 3: Auto-generate if requested
    let generated = 0;
    if (autoGenerate && storedPlans.length > 0) {
      const { generatePageFromPlan } = await import('../programmatic-seo/generator.js');
      for (const spec of storedPlans.slice(0, Math.min(5, storedPlans.length))) {
        try {
          const pageContent = await generatePageFromPlan(spec, { keyword: spec.primary_keyword });
          if (pageContent && pageContent.content) {
            await dbService.saveSeoPage({
              slug: spec.url_slug,
              pageType: 'blog',
              title: pageContent.title,
              metaDescription: pageContent.metaDescription,
              h1: pageContent.h1,
              content: pageContent.content,
              schemaMarkup: pageContent.schemaMarkup || '',
              internalLinks: pageContent.internalLinks || [],
              wordCount: pageContent.wordCount || 0,
              status: 'published',
              publishedAt: new Date(),
            });
            generated++;
          }
        } catch (e) { /* skip */ }
      }
    }

    // Stats
    const byCategory = {};
    limited.forEach(c => {
      byCategory[c.topic_category] = (byCategory[c.topic_category] || 0) + 1;
    });

    res.json({
      success: true,
      generated: candidates.length,
      stored,
      auto_approved: autoApprove || false,
      generated_pages: generated,
      by_category: byCategory,
      status: autoApprove ? 'Ready — plans approved and queued for generation' : 'Ready for review — plans in inbox',
    });
  } catch (e) {
    console.error('[ContentPlans] Pipeline error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
