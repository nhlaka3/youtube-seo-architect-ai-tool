// api/analytics.js — Growth Analytics Dashboard (Task 10)
// Spacing artifacts fixed: st atus→status, sel ect→select, av g→avg, da ys→days, coun t→count
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

router.get('/summary', async (req, res) => {
  const channelId = req.headers['x-channel-id'] || req.query.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel required' });
  const days = Number(req.query.days) || 30;

  try {
    const { default: dbService } = await import('../src/database/services.js');
    const [timeline, abSummary, queueThroughput, health, credits] = await Promise.all([
      dbService.getOptimizationTimeline(channelId, days),
      dbService.getAbTestSummary(channelId),
      dbService.getQueueThroughput(channelId, days),
      dbService.getChannelHealthScore(channelId),
      dbService.getCreditsHistory(channelId, days)
    ]);

    const totalOptimizations = (timeline || []).reduce((s, d) => s + (d.count || 0), 0);
    const avgLift = (timeline || []).length
      ? Math.round((timeline || []).reduce((s, d) => s + (d.avgLift || 0), 0) / (timeline || []).length)
      : 0;
    const totalCredits = (credits || []).reduce((s, d) => s + (d.totalUsed || 0), 0);

    sendRes(res, 200, {
      channelId, days,
      timeline: timeline || [],
      abSummary: abSummary || { total: 0, complete: 0, running: 0, bWins: 0, aWins: 0 },
      queueThroughput: queueThroughput || [],
      health: health || { avgScore: 0, trials: 0 },
      credits: credits || [],
      totals: {
        optimizations: totalOptimizations,
        avgSeoLift: avgLift,
        creditsUsed: Math.round(totalCredits),
        abTests: (abSummary || {}).total || 0
      }
    });
  } catch (e) {
    console.error('[Analytics] Summary error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
