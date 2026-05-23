// api/agent-core/learning.js — Closed-loop learning + feedback (Phase 4)
import express from 'express';
export const router = express.Router();
const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

// POST /feedback — Manual user rating (👍/👎) updates agent_learning
router.post('/feedback', async (req, res) => {
  try {
    const { actionType, niche, rating } = req.body || {};
    if (!actionType || !rating) return sendRes(res, 400, { error: 'actionType + rating required' });
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, and, sql } = await import('drizzle-orm');
    const existing = await dbService.db.select().from(s.agentLearning)
      .where(and(eq(s.agentLearning.actionType, actionType), eq(s.agentLearning.niche, niche || 'General'))).limit(1);
    if (existing.length) {
      const e = existing[0];
      const newSample = (e.sampleSize || 0) + 1;
      const newRate = rating > 0
        ? ((e.successRate || 0) * (e.sampleSize || 0) + 1) / newSample
        : ((e.successRate || 0) * (e.sampleSize || 0)) / newSample;
      await dbService.db.update(s.agentLearning).set({
        successRate: +newRate.toFixed(3), sampleSize: newSample,
        recentSkips: rating <= 0 ? (e.recentSkips || 0) + 1 : 0,
        recentSuccesses: rating > 0 ? (e.recentSuccesses || 0) + 1 : 0,
        lastUpdated: new Date()
      }).where(eq(s.agentLearning.id, e.id));
    } else {
      await dbService.db.insert(s.agentLearning).values({
        actionType, niche: niche || 'General',
        successRate: rating > 0 ? 1 : 0, sampleSize: 1,
        recentSkips: rating <= 0 ? 1 : 0, recentSuccesses: rating > 0 ? 1 : 0
      });
    }
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

export default router;
