// api/agent-core/safety.js — Safety, rollback, kill switch (Phase 5)
import express from 'express';
export const router = express.Router();
const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

// Check daily limits for a channel (only counts real agent actions, not system toggles)
export async function checkDailyLimits(channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { gte, notInArray } = await import('drizzle-orm');
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const rows = await dbService.db.select().from(s.agentSettings).limit(1);
    const maxDaily = rows[0]?.maxDailyOptimizations || 10;
    const realAgents = ['optimizer', 'trend_scanner', 'pseo_engine', 'ab_tester', 'coach', 'content_planner'];
    const todayLogs = await dbService.db.select().from(s.agentActivityLogs)
      .where(gte(s.agentActivityLogs.createdAt, todayStart));
    // Only count real agent actions (exclude system/user toggle/kill/mock entries)
    const realCount = todayLogs.filter(l => realAgents.includes(l.agentName)).length;
    return { allowed: realCount < maxDaily, used: realCount, max: maxDaily, totalEntries: todayLogs.length };
  } catch (e) { return { allowed: true, used: 0, max: 10 }; }
}

// POST /kill-switch — Emergency stop
router.post('/kill-switch', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    await dbService.db.update(s.agentSettings).set({ isAutonomous: false, dryRunMode: true, updatedAt: new Date() }).where(eq(s.agentSettings.id, 'global'));
    // Clear pending queue
    await dbService.db.update(s.optimizationQueue).set({ status: 'skipped' }).where(eq(s.optimizationQueue.status, 'pending'));
    await dbService.db.insert(s.agentActivityLogs).values({ agentName: 'system', actionTaken: '🛑 KILL SWITCH ACTIVATED — Agent halted, queue cleared', impactDescription: 'Emergency stop triggered', status: 'success' });
    sendRes(res, 200, { success: true, message: 'Kill switch activated. Agent halted, pending queue cleared.' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// POST /rollback/:videoId — Restore original metadata
router.post('/rollback/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const items = await dbService.db.select().from(s.optimizationQueue)
      .where(eq(s.optimizationQueue.videoId, videoId))
      .where(eq(s.optimizationQueue.status, 'applied'))
      .orderBy(desc(s.optimizationQueue.createdAt)).limit(1);
    if (!items.length) return sendRes(res, 404, { error: 'No applied optimization found for this video' });
    const item = items[0];
    const getRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`, {
      headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(10000)
    });
    if (!getRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video' });
    const gd = await getRes.json();
    const snip = gd.items?.[0]?.snippet;
    if (!snip) return sendRes(res, 404, { error: 'Video not found' });
    await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, snippet: { ...snip, title: (item.currentTitle || '').substring(0, 100), description: item.currentDescription || '', tags: (item.currentTags || []).slice(0, 20) } })
    });
    await dbService.db.insert(s.agentActivityLogs).values({ agentName: 'system', actionTaken: `↩️ Rolled back: ${videoId}`, impactDescription: 'Original metadata restored', status: 'success' });
    sendRes(res, 200, { success: true, message: 'Original metadata restored' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// GET /daily-stats — Current day's limit usage
router.get('/daily-stats', async (req, res) => {
  try {
    const ch = req.headers['x-channel-id'] || req.query.channelId || 'global';
    const stats = await checkDailyLimits(ch);
    sendRes(res, 200, stats);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

export default router;
