// api/cron-measure-impact.js — AI Self-Improving Feedback Loop
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

function extractKeywords(title) {
  if (!title) return [];
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','in','on','at','to','for','of','and','or','but','this','that','with','you','your','my','our','their','its','it','he','she','they','we','i']);
  return title.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
}

async function fetchVideoStats(videoId, accessToken) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const s = data.items?.[0]?.statistics;
  if (!s) return null;
  const views = parseInt(s.viewCount || '0');
  const likes = parseInt(s.likeCount || '0');
  const comments = parseInt(s.commentCount || '0');
  const engagement = views > 0 ? ((likes + comments) / views * 100) : 0;
  return { views, likes, comments, engagement: parseFloat(engagement.toFixed(2)) };
}

async function measureImpact(accessToken) {
  const { default: dbService } = await import('../src/database/services.js');
  const schema = await import('../src/database/schema.js');
  const { eq, and, lt, sql } = await import('drizzle-orm');

  // Trials applied 7+ days ago, not yet measured
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const trials = await dbService.db.select().from(schema.optimizationTrials)
    .where(and(eq(schema.optimizationTrials.status, 'pending'), lt(schema.optimizationTrials.appliedAt, weekAgo)))
    .limit(20);

  if (!trials.length) return { measured: 0, message: 'No trials ready' };

  let measured = 0, improved = 0;
  const calibrationEntries = [];

  for (const trial of trials) {
    try {
      const stats = await fetchVideoStats(trial.videoId, accessToken);
      if (!stats) continue;

      const bm = trial.beforeMetrics || {};
      const viewsBefore = bm.views || 0;
      const likesBefore = bm.likes || 0;
      const commentsBefore = bm.comments || 0;
      const engBefore = viewsBefore > 0 ? ((likesBefore + commentsBefore) / viewsBefore * 100) : 0;

      await dbService.db.insert(schema.impactMeasurements).values({
        trialId: trial.id, channelId: trial.channelId, videoId: trial.videoId,
        viewsBefore, viewsAfter: stats.views, viewsDelta: stats.views - viewsBefore,
        likesBefore, likesAfter: stats.likes, commentsBefore, commentsAfter: stats.comments,
        engagementBefore: parseFloat(engBefore.toFixed(2)), engagementAfter: stats.engagement
      });

      const viewsDelta = stats.views - viewsBefore;
      const wasImprovement = viewsDelta > 0;
      
      if (viewsDelta > 0) {
        const ad = trial.appliedData || {};
        const newTitle = ad.newTitle || trial.videoTitle || '';
        const keywords = extractKeywords(newTitle);
        const viewsLift = viewsBefore > 0 ? (viewsDelta / viewsBefore * 100) : 10;
        for (const kw of keywords) {
          await dbService.db.insert(schema.keywordWins).values({
            keyword: kw.toLowerCase().trim(), niche: 'General', avgViewsLift: viewsLift, avgCtrLift: 0, sampleCount: 1
          }).onConflictDoUpdate({
            target: [schema.keywordWins.keyword, schema.keywordWins.niche],
            set: {
              avgViewsLift: sql`(keyword_wins.avg_views_lift * keyword_wins.sample_count + ${viewsLift}) / (keyword_wins.sample_count + 1)`,
              avgCtrLift: sql`keyword_wins.avg_ctr_lift`,
              sampleCount: sql`keyword_wins.sample_count + 1`,
              lastUpdated: new Date()
            }
          });
        }
        improved++;
      }

      // ── LAYER 4: Save calibration data (predicted vs actual) ──
      const predictedConf = (trial.seoScoreAfter - trial.seoScoreBefore) || 50;
      const actualSuccess = viewsBefore > 0 ? Math.min(1, (viewsDelta / viewsBefore)) : (wasImprovement ? 1 : 0);
      calibrationEntries.push({
        actionType: trial.optimizationType || 'title',
        videoId: trial.videoId,
        predictedConf,
        actualSuccess: +actualSuccess.toFixed(3),
        impactMeasured: viewsDelta,
        niche: 'General'
      });

      await dbService.db.update(schema.optimizationTrials)
        .set({ status: viewsDelta > 0 ? 'completed' : 'completed', improvementPct: viewsBefore > 0 ? Math.round(viewsDelta/viewsBefore*100) : 0, notes: 'Auto-measured: +' + viewsDelta + ' views after 7 days' })
        .where(eq(schema.optimizationTrials.id, trial.id));

      measured++;
    } catch (e) { console.warn('[Measure] Trial ' + trial.id + ':', e.message); }
  }
  
  // ── LAYER 4: Persist calibration data and run retrospective ──
  if (calibrationEntries.length > 0) {
    try {
      for (const cal of calibrationEntries) {
        await dbService.saveCalibrationData(cal).catch(() => {});
      }
      // Trigger retrospective to adjust thresholds
      const { runWeeklyRetrospective } = await import('../agent-core/retrospective.js');
      await runWeeklyRetrospective().catch(e => console.warn('[Measure] Retrospective failed:', e.message));
      // Apply decay to keyword wins
      await dbService.decayOldWins().catch(e => console.warn('[Measure] Decay failed:', e.message));
    } catch (e) { console.warn('[Measure] Calibration/retrospective failed:', e.message); }
  }
  
  return { measured, improved, total: trials.length, calibrationsSaved: calibrationEntries.length };
}

// Weekly cron (Monday 8am) — runs full feedback loop: measure → calibrate → decay → retrospective
router.get('/weekly', async (req, res) => {
  const key = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.NODE_ENV === 'production' && key !== process.env.CRON_SECRET) return sendRes(res, 403, { error: 'Unauthorized' });
  
  // Run the full Layer 4 pipeline
  try {
    const { runWeeklyRetrospective } = await import('../agent-core/retrospective.js');
    const { default: dbService } = await import('../src/database/services.js');
    
    const retroReport = await runWeeklyRetrospective();
    await dbService.decayOldWins();
    
    res.json({ 
      success: true, 
      message: 'Weekly cron executed — retrospective + decay complete', 
      timestamp: new Date().toISOString(),
      retrospective: retroReport.calibrations?.length ? `${retroReport.calibrations.length} action types analyzed` : 'No calibration data yet',
      thresholdAdjustments: retroReport.thresholdAdjustments || {},
      decayApplied: true
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// Manual trigger
router.post('/measure-now', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    const result = await measureImpact(accessToken);
    sendRes(res, 200, { success: true, ...result });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// Impact stats
router.get('/stats', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.query.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    const { default: dbService } = await import('../src/database/services.js');
    const schema = await import('../src/database/schema.js');
    const { eq, sql } = await import('drizzle-orm');
    const rows = await dbService.db.select({
      totalMeasured: sql`COUNT(*)`,
      improved: sql`COUNT(CASE WHEN views_delta > 0 THEN 1 END)`,
      avgImprovement: sql`AVG(CASE WHEN views_delta > 0 THEN views_delta END)`,
      totalExtraViews: sql`SUM(views_delta)`
    }).from(schema.impactMeasurements).where(eq(schema.impactMeasurements.channelId, channelId));
    sendRes(res, 200, rows[0] || { totalMeasured: 0, improved: 0 });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// Keyword wins
router.get('/keyword-wins', async (req, res) => {
  try {
    const niche = req.query.niche || 'General';
    const { default: dbService } = await import('../src/database/services.js');
    const schema = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const wins = await dbService.db.select().from(schema.keywordWins)
      .where(eq(schema.keywordWins.niche, niche))
      .orderBy(desc(schema.keywordWins.avgViewsLift)).limit(30);
    sendRes(res, 200, { wins, niche });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── LAYER 4: Weekly Retrospective (triggered by cron) ──
router.get('/weekly-retrospective', async (req, res) => {
  try {
    const { runWeeklyRetrospective } = await import('../agent-core/retrospective.js');
    const report = await runWeeklyRetrospective();
    sendRes(res, 200, report);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── LAYER 4: Apply decay to keyword wins (weekly) ──
router.get('/apply-decay', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    await dbService.decayOldWins();
    const schema = await import('../src/database/schema.js');
    const { desc } = await import('drizzle-orm');
    const wins = await dbService.db.select().from(schema.keywordWins)
      .orderBy(desc(schema.keywordWins.viewsLift)).limit(10);
    sendRes(res, 200, { decayed: true, topWins: wins.map(w => ({ keyword: w.keyword, viewsLift: +(w.viewsLift||0).toFixed(2) })) });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

export default router;
