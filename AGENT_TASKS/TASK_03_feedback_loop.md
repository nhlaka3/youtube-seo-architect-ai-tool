# TASK 03 — AI Self-Improving Feedback Loop

## Goal
Every 7 days, measure how each applied optimization actually performed.
Store winning keyword/title patterns. Bias future AI proposals toward
patterns that demonstrably improved views, CTR, or watch time.
This is the "flywheel" that makes the AI smarter over time.

## Prerequisites
- Task 02 (cron optimizer) must be done first — this task depends on the
  `optimization_trials` table and `optimization_queue` table existing.

---

## STEP 1 — Add keyword_wins table to DB

**Modify file: `src/database/services.js`**

Add inside the db initialization (after existing CREATE TABLE statements):

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS keyword_wins (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    keyword TEXT NOT NULL,
    niche TEXT DEFAULT 'General',
    pattern_type TEXT DEFAULT 'title_word',
    avg_views_lift REAL DEFAULT 0,
    avg_ctr_lift REAL DEFAULT 0,
    sample_count INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_kw_wins_keyword_niche 
    ON keyword_wins(keyword, niche);

  CREATE TABLE IF NOT EXISTS impact_measurements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    trial_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    views_before INTEGER DEFAULT 0,
    views_after INTEGER DEFAULT 0,
    views_delta INTEGER DEFAULT 0,
    likes_before INTEGER DEFAULT 0,
    likes_after INTEGER DEFAULT 0,
    comments_before INTEGER DEFAULT 0,
    comments_after INTEGER DEFAULT 0,
    engagement_before REAL DEFAULT 0,
    engagement_after REAL DEFAULT 0,
    measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trial_id) REFERENCES optimization_trials(id)
  );
`);
```

Add these service methods to the dbService export:

```js
// Add to exported dbService object:

getTrialsReadyForMeasurement() {
  // Trials that were applied 7+ days ago and not yet measured
  const stmt = db.prepare(`
    SELECT * FROM optimization_trials 
    WHERE status = 'applied' 
    AND created_at < datetime('now', '-7 days')
    AND id NOT IN (SELECT trial_id FROM impact_measurements)
    LIMIT 20
  `);
  return stmt.all();
},

recordImpactMeasurement(data) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO impact_measurements 
    (trial_id, channel_id, video_id, views_before, views_after, views_delta,
     likes_before, likes_after, comments_before, comments_after,
     engagement_before, engagement_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    data.trialId, data.channelId, data.videoId,
    data.viewsBefore, data.viewsAfter, data.viewsAfter - data.viewsBefore,
    data.likesBefore, data.likesAfter,
    data.commentsBefore, data.commentsAfter,
    data.engagementBefore, data.engagementAfter
  );
},

upsertKeywordWin(keyword, niche, viewsLift, ctrLift) {
  const stmt = db.prepare(`
    INSERT INTO keyword_wins (keyword, niche, avg_views_lift, avg_ctr_lift, sample_count, last_updated)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(keyword, niche) DO UPDATE SET
      avg_views_lift = (avg_views_lift * sample_count + excluded.avg_views_lift) / (sample_count + 1),
      avg_ctr_lift = (avg_ctr_lift * sample_count + excluded.avg_ctr_lift) / (sample_count + 1),
      sample_count = sample_count + 1,
      last_updated = CURRENT_TIMESTAMP
  `);
  return stmt.run(keyword.toLowerCase().trim(), niche, viewsLift, ctrLift);
},

getTopKeywordWins(niche, limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM keyword_wins 
    WHERE (niche = ? OR niche = 'General') AND sample_count >= 2
    ORDER BY avg_views_lift DESC LIMIT ?
  `);
  return stmt.all(niche, limit);
},

getImpactStats(channelId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total_measured,
      COUNT(CASE WHEN views_delta > 0 THEN 1 END) as improved,
      AVG(CASE WHEN views_delta > 0 THEN views_delta END) as avg_improvement,
      SUM(views_delta) as total_extra_views
    FROM impact_measurements WHERE channel_id = ?
  `);
  return stmt.get(channelId) || { total_measured: 0, improved: 0, avg_improvement: 0, total_extra_views: 0 };
},
```

---

## STEP 2 — Create the measurement cron handler

**Create file: `api/cron-measure-impact.js`**

```js
import express from 'express';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

/**
 * Extract meaningful keywords/patterns from a title for learning.
 * Returns array of significant words/phrases.
 */
function extractKeywords(title) {
  if (!title) return [];
  const stopWords = new Set([
    'the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could','should',
    'in','on','at','to','for','of','and','or','but','this','that','with',
    'you','your','my','our','their','its','it','he','she','they','we','i'
  ]);
  return title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Fetch current video stats from YouTube API.
 */
async function fetchVideoStats(videoId, accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
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

/**
 * Core measurement logic — can be called by cron or manually.
 */
async function measureImpact(accessToken) {
  const { default: dbService } = await import('../src/database/services.js');
  
  const trials = dbService.getTrialsReadyForMeasurement();
  if (!trials.length) {
    return { measured: 0, message: 'No trials ready for measurement yet' };
  }

  let measured = 0;
  let improved = 0;

  for (const trial of trials) {
    try {
      // Fetch current stats
      const currentStats = await fetchVideoStats(trial.video_id, accessToken);
      if (!currentStats) continue;

      // Get before metrics stored at trial creation
      let beforeMetrics = {};
      try {
        beforeMetrics = typeof trial.before_metrics === 'string' 
          ? JSON.parse(trial.before_metrics) 
          : (trial.before_metrics || {});
      } catch { beforeMetrics = {}; }

      const viewsBefore = beforeMetrics.views || 0;
      const likesBefore = beforeMetrics.likes || 0;
      const commentsBefore = beforeMetrics.comments || 0;
      const engBefore = viewsBefore > 0 
        ? ((likesBefore + commentsBefore) / viewsBefore * 100) : 0;

      // Record measurement
      dbService.recordImpactMeasurement({
        trialId: trial.id,
        channelId: trial.channel_id,
        videoId: trial.video_id,
        viewsBefore,
        viewsAfter: currentStats.views,
        likesBefore,
        likesAfter: currentStats.likes,
        commentsBefore,
        commentsAfter: currentStats.comments,
        engagementBefore: parseFloat(engBefore.toFixed(2)),
        engagementAfter: currentStats.engagement,
      });

      // If video improved, extract keywords from new title and record as wins
      const viewsDelta = currentStats.views - viewsBefore;
      if (viewsDelta > 0 && trial.applied_data) {
        let appliedData = {};
        try {
          appliedData = typeof trial.applied_data === 'string'
            ? JSON.parse(trial.applied_data)
            : (trial.applied_data || {});
        } catch {}

        const newTitle = appliedData.newTitle || '';
        const niche = trial.notes?.match(/niche:(\w+)/i)?.[1] || 'General';
        const viewsLift = viewsBefore > 0 ? (viewsDelta / viewsBefore * 100) : 10;

        const keywords = extractKeywords(newTitle);
        for (const kw of keywords) {
          dbService.upsertKeywordWin(kw, niche, viewsLift, 0);
        }
        improved++;
      }

      // Update trial status to measured
      dbService.updateOptimizationTrial(trial.id, { 
        status: viewsDelta > 0 ? 'success' : 'measured',
        notes: `Measured: +${viewsDelta} views after 7 days`
      });

      measured++;
    } catch (err) {
      console.warn(`[ImpactMeasure] Failed for trial ${trial.id}:`, err.message);
    }
  }

  return { measured, improved, total: trials.length };
}

// ── Route: Vercel Cron (weekly) ──
// Add to vercel.json crons: { "path": "/api/measure/weekly", "schedule": "0 8 * * 1" }
router.get('/weekly', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret !== process.env.CRON_SECRET) {
    return sendRes(res, 401, { error: 'Unauthorized' });
  }
  
  try {
    // Weekly cron runs without a specific accessToken — 
    // For now just log; full impl needs per-channel token refresh
    console.log('[ImpactMeasure] Weekly cron triggered at', new Date().toISOString());
    sendRes(res, 200, { success: true, message: 'Weekly measurement cron executed' });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Manual trigger (user runs measurement with their token) ──
router.post('/measure-now', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { accessToken } = req.body || {};
    if (!channelId || !accessToken) {
      return sendRes(res, 400, { error: 'channelId and accessToken required' });
    }
    const result = await measureImpact(accessToken);
    sendRes(res, 200, { success: true, ...result });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get impact stats for a channel ──
router.get('/stats', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.query.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    const { default: dbService } = await import('../src/database/services.js');
    const stats = dbService.getImpactStats(channelId);
    sendRes(res, 200, stats);
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get top winning keywords for a niche ──
router.get('/keyword-wins', async (req, res) => {
  try {
    const { niche = 'General' } = req.query;
    const { default: dbService } = await import('../src/database/services.js');
    const wins = dbService.getTopKeywordWins(niche, 30);
    sendRes(res, 200, { wins, niche });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Register in main.js

**Modify file: `main.js`** — add with other imports and route registrations:

```js
// Import:
import { router as measureRouter } from './api/cron-measure-impact.js';

// Register:
app.use('/api/measure', measureRouter);
```

---

## STEP 4 — Update vercel.json to add weekly cron

**Modify file: `vercel.json`** — add to the `crons` array created in Task 02:

```json
{
  "path": "/api/measure/weekly",
  "schedule": "0 8 * * 1"
}
```
(Runs at 8 AM UTC every Monday)

---

## STEP 5 — Wire keyword wins into AI proposals (optional enhancement)

**Modify file: `api/cron-optimizer.js`** — inside the `scanAndQueue` function,
before the AI prompt, fetch winning keywords and inject them:

```js
// Add before the AI prompt construction:
const wins = dbService.getTopKeywordWins(niche, 10);
const winningKeywords = wins.map(w => w.keyword).join(', ');
const winsContext = winningKeywords 
  ? `\nPROVEN high-performing keywords for this niche: ${winningKeywords}\nPrioritize these in the title and tags.`
  : '';

// Then add winsContext to the prompt string
```

---

## Acceptance Criteria

1. DB has `keyword_wins` and `impact_measurements` tables
2. `POST /api/measure/measure-now` with valid token runs without error
   Returns `{ success: true, measured: N, improved: M }`
3. `GET /api/measure/keyword-wins?niche=General` returns `{ wins: [...], niche: 'General' }`
4. `GET /api/measure/stats?channelId=UCxxx` returns impact stats object
5. After measuring a successful trial, keyword_wins table has rows

## Files Changed
- `src/database/services.js` — MODIFIED (2 new tables + 5 new methods)
- `api/cron-measure-impact.js` — NEW
- `main.js` — MODIFIED
- `vercel.json` — MODIFIED (add weekly cron)
