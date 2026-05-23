// api/agent-core/approvals.js — Command Inbox API
import express from 'express';
export const router = express.Router();
const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

const requireChannelId = (req, res, next) => {
  const ch = req.headers['x-channel-id'] || req.body?.channelId;
  if (!ch) return sendRes(res, 400, { error: 'Channel required' });
  req.channelId = ch; next();
};

router.get('/pending', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc } = await import('drizzle-orm');
    // Show ALL recent proposals — pending + recently executed
    const { eq } = await import('drizzle-orm');
    const items = await dbService.db.select().from(s.optimizationQueue)
      .where(eq(s.optimizationQueue.channelId, req.channelId))
      .orderBy(desc(s.optimizationQueue.createdAt)).limit(50);
    sendRes(res, 200, { items });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/:id/approve', requireChannelId, async (req, res) => {
  try {
    const { id } = req.params;
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    await dbService.db.update(s.optimizationQueue).set({ status: 'approved', actionedAt: new Date() }).where(eq(s.optimizationQueue.id, id));
    await dbService.db.insert(s.agentActivityLogs).values({ agentName: 'user', actionTaken: 'Approved optimization', impactDescription: `Item ${id} approved`, status: 'success' });
    
    // ── Record learning outcome (continuous-learning-v2) ──
    try{
      const item = await dbService.db.select().from(s.optimizationQueue).where(eq(s.optimizationQueue.id, id)).limit(1);
      if(item.length){
        const actionType = item[0].proposedTitle ? 'title_optimization'
                         : (item[0].proposedTags || []).length ? 'tag_optimization'
                         : 'video_optimization';
        const { recordLearningOutcome } = await import('./confidence-engine.js');
        await recordLearningOutcome(actionType, 'General', true, 10);
        const { trackOutcome } = await import('./outcome-tracker.js');
        await trackOutcome(actionType, 'applied', 'General').catch(()=>{});
      }
    }catch(e){/* non-critical */}
    
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/:id/skip', requireChannelId, async (req, res) => {
  try {
    const { id } = req.params;
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    await dbService.db.update(s.optimizationQueue).set({ status: 'skipped', actionedAt: new Date() }).where(eq(s.optimizationQueue.id, id));
    
    // ── Record learning: skip = unsuccessful ──
    try{
      const item = await dbService.db.select().from(s.optimizationQueue).where(eq(s.optimizationQueue.id, id)).limit(1);
      if(item.length){
        const actionType = item[0].proposedTitle ? 'title_optimization'
                         : (item[0].proposedTags || []).length ? 'tag_optimization'
                         : 'video_optimization';
        const { recordLearningOutcome } = await import('./confidence-engine.js');
        await recordLearningOutcome(actionType, 'General', false, 0);
        const { trackOutcome } = await import('./outcome-tracker.js');
        await trackOutcome(actionType, 'skipped', 'General').catch(()=>{});
      }
    }catch(e){/* non-critical */}
    
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// POST /clear-all — Delete all queue items
router.post('/clear-all', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.delete(s.optimizationQueue);
    sendRes(res, 200, { success: true, message: 'All queue items cleared' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/:id/edit', requireChannelId, async (req, res) => {
  try {
    const { id } = req.params;
    const { proposedTitle, proposedDescription, proposedTags } = req.body || {};
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const update = { status: 'approved', actionedAt: new Date() };
    if (proposedTitle) update.proposedTitle = proposedTitle;
    if (proposedDescription) update.proposedDescription = proposedDescription;
    if (proposedTags) update.proposedTags = proposedTags;
    await dbService.db.update(s.optimizationQueue).set(update).where(eq(s.optimizationQueue.id, id));
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

export default router;
