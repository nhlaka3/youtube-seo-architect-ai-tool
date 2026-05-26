// api/ab-test.js — Autonomous A/B Title Tester (Task 05)
// Spacing artifacts fixed: tit le→title, acce ssToken→accessToken, v ideoId→videoId, etc.
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

let _deductCredits = null, _CREDIT_COSTS = null;
const deductCredits = async (...args) => {
  if (!_deductCredits) ({ deductCredits: _deductCredits, CREDIT_COSTS: _CREDIT_COSTS } = await import('./credits.js'));
  return _deductCredits(...args);
};
const getCreditCost = async (key) => {
  if (!_CREDIT_COSTS) ({ CREDIT_COSTS: _CREDIT_COSTS } = await import('./credits.js'));
  return _CREDIT_COSTS[key] || 5;
};

const requireChannelId = (req, res, next) => {
  const channelId = req.headers['x-channel-id'] || req.body?.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel connection required' });
  req.channelId = channelId;
  next();
};

// ── Helper: Apply a title to a YouTube video ──
async function applyTitle(videoId, title, accessToken) {
  const getRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
  );
  if (!getRes.ok) throw new Error('Could not fetch video snippet');
  const getData = await getRes.json();
  const snippet = getData.items?.[0]?.snippet;
  if (!snippet) throw new Error('Video not found');

  const updateRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, snippet: { ...snippet, title: title.substring(0, 100) } })
    }
  );
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'YouTube update failed');
  }
  return true;
}

// ── Helper: Get current view count ──
async function getViewCount(videoId, accessToken) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return parseInt(data.items?.[0]?.statistics?.viewCount || '0');
  } catch (e) { return 0; }
}

// ── Route: Start A/B test ──
router.post('/start', requireChannelId, async (req, res) => {
  try {
    const { videoId, variantA, variantB, accessToken } = req.body || {};
    if (!videoId || !variantA || !variantB || !accessToken) {
      return sendRes(res, 400, { error: 'Missing: videoId, variantA, variantB, accessToken' });
    }

    // Credit check — A/B test costs 5 credits
    const abCost = await getCreditCost('ab-test');
    const creditResult = await deductCredits(req.channelId, abCost);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });

    const { default: dbService } = await import('../src/database/services.js');

    // Check for existing running test on this video
    const existing = await dbService.getAbTestsByChannel(req.channelId);
    const duplicate = existing.find(t => t.videoId === videoId && t.status === 'running');
    if (duplicate) return sendRes(res, 409, { error: 'A/B test already running for this video', testId: duplicate.id });

    // Fetch video data
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!videoRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video data' });
    const videoData = await videoRes.json();
    const video = videoData.items?.[0];
    if (!video) return sendRes(res, 404, { error: 'Video not found' });

    // Apply Variant A immediately
    await applyTitle(videoId, variantA, accessToken);
    const initialViews = parseInt(video.statistics?.viewCount || '0');

    const result = await dbService.createAbTest({
      channelId: req.channelId, videoId,
      originalTitle: video.snippet?.title || '',
      variantA, variantB, initialViews
    });

    sendRes(res, 200, {
      success: true, testId: result[0]?.id,
      message: `A/B test started. Variant A applied: "${variantA}"`,
      phase: 'variant_a',
      switchAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });
  } catch (e) {
    console.error('[ABTest] start error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Advance test to next phase ──
router.post('/advance', async (req, res) => {
  try {
    const { testId, accessToken } = req.body || {};
    if (!testId || !accessToken) return sendRes(res, 400, { error: 'testId and accessToken required' });

    const { default: dbService } = await import('../src/database/services.js');
    const test = await dbService.getAbTestById(testId);
    if (!test) return sendRes(res, 404, { error: 'Test not found' });
    if (test.status !== 'running') return sendRes(res, 400, { error: 'Test is not running' });

    const currentViews = await getViewCount(test.videoId, accessToken);
    const now = new Date().toISOString();

    if (test.phase === 'variant_a') {
      await applyTitle(test.videoId, test.variantB, accessToken);
      await dbService.updateAbTest(testId, {
        phase: 'variant_b', phaseStartedAt: now,
        variantAViewsEnd: currentViews, variantBViewsStart: currentViews
      });
      sendRes(res, 200, {
        success: true,
        message: `Switched to Variant B: "${test.variantB}"`,
        phase: 'variant_b',
        variantAViews: currentViews - (test.variantAViewsStart || 0)
      });
    } else if (test.phase === 'variant_b') {
      const aViews = (test.variantAViewsEnd || 0) - (test.variantAViewsStart || 0);
      const bViews = currentViews - (test.variantBViewsStart || 0);
      const winner = bViews >= aViews ? 'variant_b' : 'variant_a';
      const winningTitle = winner === 'variant_b' ? test.variantB : test.variantA;

      await applyTitle(test.videoId, winningTitle, accessToken);
      await dbService.updateAbTest(testId, {
        phase: 'complete', variantBViewsEnd: currentViews,
        winner, status: 'completed', completedAt: now
      });

      const max = Math.max(aViews, 1);
      const improvement = bViews >= aViews
        ? `+${Math.round((bViews - aViews) / max * 100)}%`
        : `${Math.round((bViews - aViews) / max * 100)}%`;

      sendRes(res, 200, {
        success: true,
        message: `Test complete! Winner: ${winner === 'variant_b' ? 'Variant B' : 'Variant A'}`,
        winner, winningTitle, variantAViews: aViews, variantBViews: bViews, improvement
      });
    }
  } catch (e) {
    console.error('[ABTest] advance error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: List tests for channel ──
router.get('/list', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const tests = await dbService.getAbTestsByChannel(req.channelId);

    // Auto-advance any tests that are due
    const HOURS_PER_PHASE = 48;
    const now = Date.now();
    for (const test of tests) {
      if (test.status !== 'running') continue;
      const startedAt = new Date(test.phaseStartedAt || test.createdAt).getTime();
      const hoursElapsed = (now - startedAt) / (1000 * 60 * 60);
      if (hoursElapsed >= HOURS_PER_PHASE) {
        try {
          // Get access token from user metadata
          let accessToken = req.headers['x-access-token'];
          if (!accessToken) {
            const users = await dbService.getAllUsers(100).catch(() => []);
            const user = users.find(u => u.channelId === test.channelId);
            accessToken = user?.metadata?.accessToken;
          }
          if (accessToken) {
            try {
              const currentViews = await getViewCount(test.videoId, accessToken);
              if (test.phase === 'variant_a') {
                await applyTitle(test.videoId, test.variantB, accessToken);
                await dbService.updateAbTest(test.id, {
                  phase: 'variant_b', phaseStartedAt: new Date().toISOString(),
                  variantAViewsEnd: currentViews, variantBViewsStart: currentViews
                });
              } else if (test.phase === 'variant_b') {
                const aViews = (test.variantAViewsEnd || 0) - (test.variantAViewsStart || 0);
                const bViews = currentViews - (test.variantBViewsStart || 0);
                const winner = bViews >= aViews ? 'variant_b' : 'variant_a';
                const winningTitle = winner === 'variant_b' ? test.variantB : test.variantA;
                await applyTitle(test.videoId, winningTitle, accessToken);
                await dbService.updateAbTest(test.id, {
                  phase: 'complete', variantBViewsEnd: currentViews,
                  winner, status: 'completed', completedAt: new Date().toISOString()
                });
              }
            } catch(ytErr) {
              // YouTube API failed (expired token) — advance DB anyway
              await dbService.updateAbTest(test.id, {
                phase: test.phase === 'variant_a' ? 'variant_b' : 'complete',
                phaseStartedAt: new Date().toISOString(),
                status: test.phase === 'variant_b' ? 'completed' : 'running',
                completedAt: test.phase === 'variant_b' ? new Date().toISOString() : null
              });
            }
          } else {
            // No access token — advance phase in DB but skip YouTube update
            await dbService.updateAbTest(test.id, {
              phase: test.phase === 'variant_a' ? 'variant_b' : 'complete',
              phaseStartedAt: new Date().toISOString(),
              status: test.phase === 'variant_b' ? 'completed' : 'running',
              completedAt: test.phase === 'variant_b' ? new Date().toISOString() : null
            });
          }
        } catch(e) { console.warn('[ABTest] auto-advance failed for', test.id, e.message); }
      }
    }

    // Re-fetch to get updated tests
    const updatedTests = await dbService.getAbTestsByChannel(req.channelId);
    sendRes(res, 200, { tests: updatedTests });
  } catch (e) {
    console.error('[ABTest] list error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Debug: Force advance all due tests ──
router.post('/force-advance', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const tests = await dbService.getAbTestsByChannel(channelId);
    const now = Date.now();
    const results = [];
    for (const test of tests) {
      if (test.status !== 'running') continue;
      const startedAt = new Date(test.phaseStartedAt || test.createdAt).getTime();
      const hoursElapsed = (now - startedAt) / 3600000;
      const entry = { id: test.id.substring(0,8), phase: test.phase, hoursElapsed: Math.round(hoursElapsed) };
      if (hoursElapsed >= 48) {
        const newPhase = test.phase === 'variant_a' ? 'variant_b' : 'complete';
        await dbService.updateAbTest(test.id, {
          phase: newPhase,
          phaseStartedAt: new Date().toISOString(),
          status: newPhase === 'complete' ? 'completed' : 'running',
          completedAt: newPhase === 'complete' ? new Date().toISOString() : null
        });
        entry.advanced = true;
        entry.newPhase = newPhase;
      }
      results.push(entry);
    }
    sendRes(res, 200, { results });
  } catch(e) { sendRes(res, 500, { error: e.message }); }
});

// ── Route: Cancel test + restore original title ──
router.post('/cancel/:testId', requireChannelId, async (req, res) => {
  try {
    const { testId } = req.params;
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });

    const { default: dbService } = await import('../src/database/services.js');
    const test = await dbService.getAbTestById(testId);
    if (!test) return sendRes(res, 404, { error: 'Test not found' });

    if (test.originalTitle) {
      try { await applyTitle(test.videoId, test.originalTitle, accessToken); } catch (e) {}
    }
    await dbService.updateAbTest(testId, { status: 'cancelled', completedAt: new Date().toISOString() });
    sendRes(res, 200, { success: true, message: 'Test cancelled, original title restored' });
  } catch (e) {
    console.error('[ABTest] cancel error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Cron checker — find tests ready to advance (48h old) ──
router.post('/cron-advance-ready', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.NODE_ENV === 'production' && cronSecret !== process.env.CRON_SECRET) {
    return sendRes(res, 401, { error: 'Unauthorized' });
  }
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const running = await dbService.getRunningAbTests();
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    const ready = running.filter(t => new Date(t.phaseStartedAt).getTime() < cutoff);
    sendRes(res, 200, { ready: ready.length, total: running.length, readyTestIds: ready.map(t => t.id) });
  } catch (e) {
    console.error('[ABTest] cron error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: AI-suggested A/B variants ──
router.post('/suggest-variants', requireChannelId, async (req, res) => {
  try {
    const { currentTitle, videoId, videoDescription, niche } = req.body || {};
    let title = currentTitle;

    // If videoId provided, fetch real title from YouTube oEmbed (server-side, no CORS)
    if (!title && videoId) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || '';
        }
      } catch (e) { /* oEmbed failed, use fallback */ }
    }

    if (!title) return sendRes(res, 400, { error: 'currentTitle or videoId required' });

    const { askAI } = await import('./_lib/ai-provider.js');
    const raw = await askAI(
      'You are a YouTube CTR optimization expert. Return ONLY valid JSON.',
      `Generate 2 A/B test title variants for this YouTube video.
Current title: "${title}"
Niche: "${niche || 'General'}"
Description context: "${(videoDescription || '').substring(0, 200)}"
Rules: Each <= 60 chars. Variant A: Curiosity/question angle. Variant B: Result/benefit angle. Both must differ meaningfully from current title.
Return JSON: { "variantA": "...", "variantB": "...", "rationale": "..." }`,
      { temperature: 0.8, maxTokens: 400, forceJson: true }
    );
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    sendRes(res, 200, {
      variantA: (parsed.variantA || '').substring(0, 60),
      variantB: (parsed.variantB || '').substring(0, 60),
      rationale: parsed.rationale || '',
      originalTitle: title
    });
  } catch (e) {
    console.error('[ABTest] suggest error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
