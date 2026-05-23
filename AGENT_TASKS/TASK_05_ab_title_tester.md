# TASK 05 — Autonomous A/B Title Tester

## Goal
Allow users to test 2 title variants on a video. The system automatically
applies Variant A for 48h, records CTR, switches to Variant B for 48h,
records CTR, declares the winner, and applies it permanently. All automated.

---

## STEP 1 — Add ab_tests table to DB

**Modify file: `src/database/services.js`**

Add inside db initialization:

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS ab_tests (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    channel_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    original_title TEXT,
    variant_a TEXT NOT NULL,
    variant_b TEXT NOT NULL,
    phase TEXT DEFAULT 'variant_a',
    phase_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    variant_a_views_start INTEGER DEFAULT 0,
    variant_a_views_end INTEGER DEFAULT 0,
    variant_b_views_start INTEGER DEFAULT 0,
    variant_b_views_end INTEGER DEFAULT 0,
    winner TEXT,
    status TEXT DEFAULT 'running',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_ab_tests_channel ON ab_tests(channel_id);
  CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
`);
```

Add service methods:

```js
createAbTest(data) {
  const stmt = db.prepare(`
    INSERT INTO ab_tests 
    (channel_id, video_id, original_title, variant_a, variant_b, 
     variant_a_views_start, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
  `);
  return stmt.run(
    data.channelId, data.videoId, data.originalTitle,
    data.variantA, data.variantB, data.initialViews || 0
  );
},

getRunningAbTests() {
  return db.prepare(
    `SELECT * FROM ab_tests WHERE status = 'running' ORDER BY created_at DESC`
  ).all();
},

getAbTestsByChannel(channelId) {
  return db.prepare(
    `SELECT * FROM ab_tests WHERE channel_id = ? ORDER BY created_at DESC LIMIT 20`
  ).all(channelId);
},

getAbTestById(id) {
  return db.prepare(`SELECT * FROM ab_tests WHERE id = ?`).get(id);
},

updateAbTest(id, data) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE ab_tests SET ${fields} WHERE id = ?`);
  return stmt.run(...Object.values(data), id);
},
```

---

## STEP 2 — Create the A/B test API

**Create file: `api/ab-test.js`**

```js
import express from 'express';
import { z } from 'zod';
import { validateBody } from './middleware/validate.js';
import { deductCredits, CREDIT_COSTS } from './credits.js';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

const requireChannelId = (req, res, next) => {
  const channelId = req.headers['x-channel-id'] || req.body?.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel connection required' });
  req.channelId = channelId;
  next();
};

const startAbTestSchema = z.object({
  videoId: z.string().min(5),
  variantA: z.string().min(10).max(100),
  variantB: z.string().min(10).max(100),
  accessToken: z.string().min(10),
});

const advanceAbTestSchema = z.object({
  testId: z.string().min(5),
  accessToken: z.string().min(10),
});

/**
 * Apply a title to a YouTube video via the Data API.
 */
async function applyTitle(videoId, title, accessToken) {
  // First fetch current snippet (we need categoryId)
  const getRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!getRes.ok) throw new Error('Could not fetch video snippet');
  const getData = await getRes.json();
  const snippet = getData.items?.[0]?.snippet;
  if (!snippet) throw new Error('Video not found');

  const updateRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          ...snippet,
          title: title.substring(0, 100),
        },
      }),
    }
  );
  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err.error?.message || 'YouTube update failed');
  }
  return true;
}

/**
 * Get current view count for a video.
 */
async function getViewCount(videoId, accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return parseInt(data.items?.[0]?.statistics?.viewCount || '0');
}

// ── Route: Start A/B test ──
router.post('/start', requireChannelId, validateBody(startAbTestSchema), async (req, res) => {
  try {
    const { videoId, variantA, variantB, accessToken } = req.body;
    const { default: dbService } = await import('../src/database/services.js');

    // Check for existing running test on this video
    const existing = dbService.getAbTestsByChannel(req.channelId)
      .find(t => t.video_id === videoId && t.status === 'running');
    if (existing) {
      return sendRes(res, 409, { error: 'A/B test already running for this video', testId: existing.id });
    }

    // Get current video info
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!videoRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video data' });
    const videoData = await videoRes.json();
    const video = videoData.items?.[0];
    if (!video) return sendRes(res, 404, { error: 'Video not found' });

    const originalTitle = video.snippet?.title || '';
    const initialViews = parseInt(video.statistics?.viewCount || '0');

    // Apply Variant A immediately
    await applyTitle(videoId, variantA, accessToken);

    // Create test record
    const result = dbService.createAbTest({
      channelId: req.channelId,
      videoId,
      originalTitle,
      variantA,
      variantB,
      initialViews,
    });

    sendRes(res, 200, {
      success: true,
      testId: result.lastInsertRowid,
      message: `A/B test started. Variant A applied: "${variantA}"`,
      phase: 'variant_a',
      switchAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error('[A/B Test] Start error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Advance test to next phase (called by cron or manually) ──
router.post('/advance', validateBody(advanceAbTestSchema), async (req, res) => {
  try {
    const { testId, accessToken } = req.body;
    const { default: dbService } = await import('../src/database/services.js');
    
    const test = dbService.getAbTestById(testId);
    if (!test) return sendRes(res, 404, { error: 'Test not found' });
    if (test.status !== 'running') return sendRes(res, 400, { error: 'Test is not running' });

    const currentViews = await getViewCount(test.video_id, accessToken);

    if (test.phase === 'variant_a') {
      // Record Variant A results, switch to Variant B
      await applyTitle(test.video_id, test.variant_b, accessToken);
      dbService.updateAbTest(testId, {
        phase: 'variant_b',
        phase_started_at: new Date().toISOString(),
        variant_a_views_end: currentViews,
        variant_b_views_start: currentViews,
      });
      sendRes(res, 200, {
        success: true,
        message: `Switched to Variant B: "${test.variant_b}"`,
        phase: 'variant_b',
        variantAViews: currentViews - test.variant_a_views_start,
      });

    } else if (test.phase === 'variant_b') {
      // A/B test complete — declare winner
      const aViews = test.variant_a_views_end - test.variant_a_views_start;
      const bViews = currentViews - test.variant_b_views_start;
      const winner = bViews >= aViews ? 'variant_b' : 'variant_a';
      const winningTitle = winner === 'variant_b' ? test.variant_b : test.variant_a;

      // Apply winning title permanently
      await applyTitle(test.video_id, winningTitle, accessToken);

      dbService.updateAbTest(testId, {
        phase: 'complete',
        variant_b_views_end: currentViews,
        winner,
        status: 'complete',
        completed_at: new Date().toISOString(),
      });

      sendRes(res, 200, {
        success: true,
        message: `Test complete! Winner: ${winner === 'variant_b' ? 'Variant B' : 'Variant A'}`,
        winner,
        winningTitle,
        variantAViews: aViews,
        variantBViews: bViews,
        improvement: bViews > aViews 
          ? `+${Math.round((bViews - aViews) / Math.max(aViews, 1) * 100)}%`
          : `${Math.round((bViews - aViews) / Math.max(aViews, 1) * 100)}%`,
      });
    }
  } catch (e) {
    console.error('[A/B Test] Advance error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get all tests for a channel ──
router.get('/list', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const tests = dbService.getAbTestsByChannel(req.channelId);
    sendRes(res, 200, { tests });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Cancel a test and restore original title ──
router.post('/cancel/:testId', requireChannelId, async (req, res) => {
  try {
    const { testId } = req.params;
    const { accessToken } = req.body;
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    
    const { default: dbService } = await import('../src/database/services.js');
    const test = dbService.getAbTestById(testId);
    if (!test) return sendRes(res, 404, { error: 'Test not found' });

    // Restore original title
    if (test.original_title) {
      await applyTitle(test.video_id, test.original_title, accessToken);
    }
    dbService.updateAbTest(testId, { status: 'cancelled', completed_at: new Date().toISOString() });
    sendRes(res, 200, { success: true, message: 'Test cancelled, original title restored' });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Cron checker — advance tests that are 48h old ──
// This endpoint is called by the daily cron job
router.post('/cron-advance-ready', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    return sendRes(res, 401, { error: 'Unauthorized' });
  }
  
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const runningTests = dbService.getRunningAbTests();
    const cutoff = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
    
    const ready = runningTests.filter(t => {
      const phaseStart = new Date(t.phase_started_at).getTime();
      return phaseStart < cutoff;
    });

    sendRes(res, 200, { 
      ready: ready.length, 
      total: runningTests.length,
      readyTestIds: ready.map(t => t.id),
      message: 'Tests ready to advance (advance each individually with user accessToken)'
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Generate A/B variant suggestions using AI ──
router.post('/suggest-variants', requireChannelId, async (req, res) => {
  try {
    const { currentTitle, videoDescription, niche } = req.body;
    if (!currentTitle) return sendRes(res, 400, { error: 'currentTitle required' });

    const { askAI } = await import('./_lib/ai-provider.js');
    
    const raw = await askAI(
      'You are a YouTube CTR optimization expert. Return ONLY valid JSON.',
      `Generate 2 A/B test title variants for this YouTube video.
Current title: "${currentTitle}"
Niche: "${niche || 'General'}"
Description context: "${(videoDescription || '').substring(0, 200)}"

Rules:
- Each variant must be ≤60 characters
- Variant A: Curiosity/question angle
- Variant B: Result/benefit angle
- Both must be meaningfully different from current title
- Both must be compelling, not generic

Return JSON:
{
  "variantA": "Curiosity angle title",
  "variantB": "Result/benefit angle title",
  "rationale": "Why these variants will test CTR effectively"
}`,
      { temperature: 0.8, maxTokens: 400 }
    );

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    sendRes(res, 200, {
      variantA: (parsed.variantA || '').substring(0, 60),
      variantB: (parsed.variantB || '').substring(0, 60),
      rationale: parsed.rationale || '',
      originalTitle: currentTitle,
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Register in main.js

```js
// Import:
import { router as abTestRouter } from './api/ab-test.js';

// Register:
app.use('/api/ab-test', abTestRouter);
```

---

## Acceptance Criteria

1. `POST /api/ab-test/suggest-variants` with `{ currentTitle, niche }` returns
   `{ variantA, variantB, rationale }`
2. `POST /api/ab-test/start` with `{ videoId, variantA, variantB, accessToken }`
   returns `{ success: true, testId, switchAt }`
3. DB has `ab_tests` table with the new row
4. `GET /api/ab-test/list` returns array of tests for channel
5. `POST /api/ab-test/advance` with valid testId transitions phase from
   `variant_a` → `variant_b` → complete
6. On complete, `winner` field is set correctly

## Files Changed
- `src/database/services.js` — MODIFIED (1 new table + 5 methods)
- `api/ab-test.js` — NEW
- `main.js` — MODIFIED
