// api/cron-optimizer.js — Autonomous Optimization Queue (Task 02)
// Spacing artifacts fixed: tit le→title, filt er→filter, scor e→score, inc ludes→includes, awai t→await, suc cess→success
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

// ── Internal: Scan channel, find underperforming videos, queue AI proposals ──
async function scanAndQueue(channelId, accessToken) {
  const { default: dbService } = await import('../src/database/services.js');
  const { computeSEOScores } = await import('./_lib/seo-analyzer.js');
  const { askAI } = await import('./_lib/ai-provider.js');
  const { askAIWithPersona } = await import('./_lib/persona-wrapper.js');

  // Fetch uploads playlist
  const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  if (!chRes.ok) throw new Error('YouTube API unavailable');
  const chData = await chRes.json();
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('No uploads found');

  // Fetch videos
  const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=30&playlistId=${uploadsId}`, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const plData = await plRes.json();
  const ids = (plData.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
  if (!ids.length) return { queued: 0, message: 'No videos found' };

  // Fetch stats
  const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(',')}`, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const statsData = await statsRes.json();
  const videos = statsData.items || [];

  // Score and find bottom 30% with score < 70
  const scored = videos.map(v => ({
    video: v,
    seo: computeSEOScores(v.snippet?.title || '', v.snippet?.description || '', v.snippet?.tags || [])
  }));
  scored.sort((a, b) => a.seo.overall - b.seo.overall);
  const target = Math.min(6, Math.ceil(scored.length * 0.3));
  const toOptimize = scored.slice(0, target).filter(s => s.seo.overall < 70);
  if (!toOptimize.length) return { queued: 0, total: videos.length, message: 'All videos score >= 70' };

  // Clear old pending items (> 7 days)
  await dbService.clearOldQueueItems(channelId);

  // Fetch proven keyword wins for this niche (feedback loop flywheel)
  let winsContext = '';
  try {
    const wins = await dbService.getTopKeywordWins(niche || 'General', 10);
    if (wins.length > 0) {
      const winningKeywords = wins.map(w => w.keyword).join(', ');
      winsContext = `\nPROVEN HIGH-PERFORMING KEYWORDS (use these in titles and tags): ${winningKeywords}`;
    }
  } catch (e) { /* proceed without wins */ }

  // Generate AI proposals in parallel (up to 6 at once)
  const optimizeTasks = toOptimize.map(async ({ video, seo }) => {
    const title = video.snippet?.title || '';
    const desc = (video.snippet?.description || '').substring(0, 2000);
    const tags = video.snippet?.tags || [];

    try {
      const raw = await askAIWithPersona(
        'You are a YouTube SEO optimizer. Return ONLY valid JSON.',
        `Optimize this video. JSON: {"newTitle":"<=60 chars with keyword and power word","newDescription":">=200 words with hook, timestamps, CTA, hashtags","newTags":["tag1","tag2"]}\nTitle: "${title}"\nScore: ${seo.overall}/100\nDesc: ${desc.substring(0, 500)}\nTags: ${tags.slice(0, 10).join(', ')}${winsContext}`,
        { temperature: 0.5, maxTokens: 1500, forceJson: true }
      );
      const parsed = JSON.parse(raw.replace(/\x60\x60\x60json|\x60\x60\x60/g, '').trim());
      const proposedTitle = (parsed.newTitle || title).substring(0, 60).trim();
      const proposedDesc = parsed.newDescription || desc;
      const proposedTags = (parsed.newTags || tags).filter(t => t && t.trim().length > 1).slice(0, 20);
      const proposedScore = computeSEOScores(proposedTitle, proposedDesc, proposedTags);

      await dbService.createQueueItem({
        channelId, videoId: video.id, videoTitle: title,
        currentTitle: title, currentDescription: desc, currentTags: tags,
        proposedTitle, proposedDescription: proposedDesc, proposedTags,
        scoreBefore: seo.overall, scoreAfter: proposedScore.overall, status: 'pending'
      });
      return { videoId: video.id, success: true };
    } catch (e) {
      console.warn('[CronOpt] Failed for', video.id, e.message);
      return { videoId: video.id, success: false, error: e.message };
    }
  });

  const results = await Promise.allSettled(optimizeTasks);
  const queued = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  return { queued, total: videos.length, optimized: toOptimize.length };
}

// ── GET /daily-optimize — Vercel cron endpoint (protected) ──
router.get('/daily-optimize', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
    return sendRes(res, 401, { error: 'Unauthorized — invalid cron secret' });
  }

  try {
    // Scan all active channels
    const { default: dbService } = await import('../src/database/services.js');
    const users = await dbService.getAllUsers(100);
    let scanned = 0;
    for (const user of users) {
      try {
        // Users need an active access token to scan — skip if none
        if (!user.lastRefresh) continue;
        const accessToken = user.metadata?.accessToken;
        if (!accessToken) continue;
        const result = await scanAndQueue(user.channelId, accessToken);
        scanned++;
      } catch (e) {
        console.warn(`[CronOpt] Failed for ${user.channelId}:`, e.message);
      }
    }
    sendRes(res, 200, { success: true, message: `Scanned ${scanned} channels`, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('[CronOpt] Daily scan failed:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /scan-and-queue — Manual dashboard trigger ──
router.post('/scan-and-queue', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { accessToken } = req.body || {};
    if (!channelId || !accessToken) return sendRes(res, 400, { error: 'channelId + accessToken required' });
    const result = await scanAndQueue(channelId, accessToken);
    sendRes(res, 200, { success: true, ...result });
  } catch (e) {
    console.error('[CronOpt] scan-and-queue error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── GET /queue — Fetch pending items + stats ──
router.get('/queue', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.query.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    const { default: dbService } = await import('../src/database/services.js');
    const items = await dbService.getQueueByChannel(channelId, 'pending');
    const stats = await dbService.getQueueStats(channelId);
    sendRes(res, 200, { queue: items, stats });
  } catch (e) {
    console.error('[CronOpt] queue error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /queue/:id/action — Approve or skip a queue item ──
router.post('/queue/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};
    if (!['approved', 'skipped'].includes(action)) return sendRes(res, 400, { error: 'action must be approved or skipped' });
    const { default: dbService } = await import('../src/database/services.js');
    await dbService.updateQueueItemStatus(id, action);
    sendRes(res, 200, { success: true });
  } catch (e) {
    console.error('[CronOpt] action error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /queue/approve-all — Bulk approve all pending items ──
router.post('/queue/approve-all', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    const { default: dbService } = await import('../src/database/services.js');
    const schema = await import('../src/database/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const result = await dbService.db.update(schema.optimizationQueue)
      .set({ status: 'approved', actionedAt: new Date() })
      .where(and(eq(schema.optimizationQueue.channelId, channelId), eq(schema.optimizationQueue.status, 'pending')));
    sendRes(res, 200, { success: true, approved: result.rowCount || 0 });
  } catch (e) {
    console.error('[CronOpt] approve-all error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /queue/:id/apply — Apply optimization directly to YouTube ──
router.post('/queue/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });

    const { default: dbService } = await import('../src/database/services.js');
    const schema = await import('../src/database/schema.js');
    const { eq } = await import('drizzle-orm');

    const items = await dbService.db.select().from(schema.optimizationQueue).where(eq(schema.optimizationQueue.id, id)).limit(1);
    const item = items[0];
    if (!item) return sendRes(res, 404, { error: 'Not found' });

    // ── Accept edited overrides from preview modal ──
    const title  = req.body?.proposedTitle  || item.proposedTitle  || item.currentTitle || '';
    const desc   = req.body?.proposedDescription || item.proposedDescription || item.currentDescription || '';
    const tags   = req.body?.proposedTags   || item.proposedTags   || [];

    const cleanTags = (Array.isArray(tags) ? tags : []).map(t => String(t).replace(/\\s+/g, '')).filter(t => t.length > 1).slice(0, 25);

    const getRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + item.videoId, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!getRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video' });
    const gd = await getRes.json();
    const snip = gd.items?.[0]?.snippet;
    if (!snip) return sendRes(res, 404, { error: 'Video not found' });

    const updateRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.videoId,
        snippet: {
          ...snip,
          title: title.substring(0, 100),
          description: desc,
          tags: cleanTags
        }
      })
    });
    if (!updateRes.ok) {
      const e = await updateRes.json().catch(() => ({}));
      return sendRes(res, 502, { error: e.error?.message || 'YouTube update failed' });
    }

    // Save edits back to DB if they came from the preview modal
    if (req.body?.proposedTitle || req.body?.proposedDescription || req.body?.proposedTags) {
      await dbService.db.update(schema.optimizationQueue).set({
        proposedTitle: title,
        proposedDescription: desc,
        proposedTags: cleanTags,
        actionedAt: new Date()
      }).where(eq(schema.optimizationQueue.id, id));
    }
    await dbService.updateQueueItemStatus(id, 'applied');

    try {
      await dbService.db.insert(schema.optimizationTrials).values({
        channelId: item.channelId, videoId: item.videoId, videoTitle: title,
        optimizationType: 'auto-queued', beforeMetrics: {},
        appliedData: { oldTitle: item.currentTitle, oldDescription: item.currentDescription, oldTags: item.currentTags, newTitle: title, newDescription: desc, newTags: cleanTags },
        seoScoreBefore: item.scoreBefore, notes: 'Applied from queue' + (req.body?.proposedTitle||req.body?.proposedDescription||req.body?.proposedTags ? ' (user-edited)' : '')
      });
    } catch (e) { /* trial insert is optional */ }

    // ── Learning signal ──
    (async function recordOutcome(){
      try{
        const { trackOutcome } = await import('./agent-core/outcome-tracker.js');
        await trackOutcome(item.actionType || 'optimization', 'applied', 'General');
      }catch(err){} // swallow
    })();

    sendRes(res, 200, { success: true });
  } catch (e) {
    console.error('[CronOpt] apply error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
