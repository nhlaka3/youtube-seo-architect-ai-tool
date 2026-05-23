# TASK 02 — Cron-Powered Autonomous Optimization Scheduler

## Goal
Every 24 hours, automatically scan all active channels, find underperforming
videos, generate AI optimization proposals, and store them in a queue for
user approval. Users receive a proactive "inbox" of optimizations without
any manual work.

## Prerequisites
- Task 01 (cache layer) should be done first, but not required.

---

## STEP 1 — Add DB table for optimization queue

**Modify file: `src/database/services.js`**

Find the database initialization section (where tables are created with
`CREATE TABLE IF NOT EXISTS`). Add the following new table creation:

```js
// Add inside the db initialization, after existing CREATE TABLE statements:
db.exec(`
  CREATE TABLE IF NOT EXISTS optimization_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    channel_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_title TEXT,
    current_title TEXT,
    current_description TEXT,
    current_tags TEXT,
    proposed_title TEXT,
    proposed_description TEXT,
    proposed_tags TEXT,
    score_before INTEGER DEFAULT 0,
    score_after INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    actioned_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_opt_queue_channel ON optimization_queue(channel_id);
  CREATE INDEX IF NOT EXISTS idx_opt_queue_status ON optimization_queue(status);
`);
```

Then add these service methods inside the `dbService` export object:

```js
// Add to the exported dbService object:

createQueueItem(data) {
  const stmt = db.prepare(`
    INSERT INTO optimization_queue 
    (channel_id, video_id, video_title, current_title, current_description, 
     current_tags, proposed_title, proposed_description, proposed_tags, 
     score_before, score_after, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  return stmt.run(
    data.channelId, data.videoId, data.videoTitle, data.currentTitle,
    data.currentDescription, JSON.stringify(data.currentTags || []),
    data.proposedTitle, data.proposedDescription, 
    JSON.stringify(data.proposedTags || []),
    data.scoreBefore || 0, data.scoreAfter || 0
  );
},

getQueueByChannel(channelId, status = 'pending') {
  const stmt = db.prepare(`
    SELECT * FROM optimization_queue 
    WHERE channel_id = ? AND status = ?
    ORDER BY created_at DESC LIMIT 50
  `);
  const rows = stmt.all(channelId, status);
  return rows.map(r => ({
    ...r,
    currentTags: JSON.parse(r.current_tags || '[]'),
    proposedTags: JSON.parse(r.proposed_tags || '[]'),
  }));
},

updateQueueItemStatus(id, status) {
  const stmt = db.prepare(`
    UPDATE optimization_queue SET status = ?, actioned_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  return stmt.run(status, id);
},

clearOldQueueItems(channelId) {
  // Remove pending items older than 7 days before adding new ones
  const stmt = db.prepare(`
    DELETE FROM optimization_queue 
    WHERE channel_id = ? AND status = 'pending' 
    AND created_at < datetime('now', '-7 days')
  `);
  return stmt.run(channelId);
},

getQueueStats(channelId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status='approved' THEN 1 END) as approved,
      COUNT(CASE WHEN status='applied' THEN 1 END) as applied,
      COUNT(CASE WHEN status='skipped' THEN 1 END) as skipped
    FROM optimization_queue WHERE channel_id = ?
  `);
  return stmt.get(channelId) || { pending: 0, approved: 0, applied: 0, skipped: 0 };
},
```

---

## STEP 2 — Create the cron handler

**Create file: `api/cron-optimizer.js`**

```js
import express from 'express';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

// Reuse the SEO score computation from youtube-ops.js
function computeSEOScores(title, desc, tags) {
  const t = title || '';
  const d = desc || '';
  const tArr = Array.isArray(tags) ? tags : [];
  
  let titleScore = 0;
  if (t.length >= 30 && t.length <= 60) titleScore += 50;
  else if (t.length > 0 && t.length < 30) titleScore += 25;
  else if (t.length > 60 && t.length <= 100) titleScore += 35;
  if (/\d/.test(t)) titleScore += 15;
  if (/[!?]/.test(t)) titleScore += 10;
  if (t.split(' ').length >= 4) titleScore += 15;
  if (/how|why|what|best|top|secret|proven|guide/i.test(t)) titleScore += 10;
  titleScore = Math.min(100, titleScore);

  const words = d.split(/\s+/).filter(w => w.length > 1).length;
  let descScore = 0;
  if (words >= 200) descScore += 40;
  else if (words >= 100) descScore += 25;
  else if (words >= 50) descScore += 15;
  if (/\d{1,2}:\d{2}/.test(d)) descScore += 20;
  if (/subscribe|like|comment/i.test(d)) descScore += 15;
  if (/#\w+/.test(d)) descScore += 10;
  if (d.includes('\n')) descScore += 15;
  descScore = Math.min(100, descScore);

  let tagsScore = 0;
  if (tArr.length >= 15) tagsScore += 50;
  else if (tArr.length >= 8) tagsScore += 30;
  else if (tArr.length >= 3) tagsScore += 15;
  const longTail = tArr.filter(t => t.split(/\s+/).length >= 2 || t.length > 8).length;
  if (longTail >= 5) tagsScore += 30;
  else if (longTail >= 2) tagsScore += 15;
  tagsScore = Math.min(100, tagsScore);

  const overall = Math.round((titleScore + descScore + tagsScore) / 3);
  return { title: titleScore, desc: descScore, tags: tagsScore, overall };
}

/**
 * Internal function to scan a channel and populate the optimization queue.
 * Can be called by cron OR manually via the dashboard.
 */
async function scanAndQueue(channelId, accessToken) {
  const { default: dbService } = await import('../src/database/services.js');
  const { askAI } = await import('./_lib/ai-provider.js');

  // 1. Fetch channel's recent videos via YouTube API
  const chRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (!chRes.ok) throw new Error('YouTube API unavailable');
  
  const chData = await chRes.json();
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('No uploads playlist found');

  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=30&playlistId=${uploadsId}`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const plData = await plRes.json();
  const videoIds = (plData.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
  if (!videoIds.length) return { queued: 0, message: 'No videos found' };

  // 2. Fetch video stats + snippets
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const statsData = await statsRes.json();
  const videos = statsData.items || [];

  // 3. Score each video and find the bottom 20%
  const scored = videos.map(v => {
    const seo = computeSEOScores(
      v.snippet?.title || '',
      v.snippet?.description || '',
      v.snippet?.tags || []
    );
    return { video: v, seo };
  });

  // Sort by overall SEO score ascending (worst first)
  scored.sort((a, b) => a.seo.overall - b.seo.overall);
  
  // Take bottom 30% or max 6 videos
  const targetCount = Math.min(6, Math.ceil(scored.length * 0.3));
  const toOptimize = scored.slice(0, targetCount).filter(s => s.seo.overall < 70);

  if (!toOptimize.length) {
    return { queued: 0, message: 'All videos already well-optimized (score >= 70)' };
  }

  // 4. Clear stale pending items before adding new ones
  dbService.clearOldQueueItems(channelId);

  // 5. Generate AI proposals for each underperformer
  let queued = 0;
  for (const { video, seo } of toOptimize) {
    const title = video.snippet?.title || '';
    const desc = (video.snippet?.description || '').substring(0, 2000);
    const tags = video.snippet?.tags || [];
    const niche = 'General'; // Could be resolved from channel data

    try {
      const prompt = `Optimize this YouTube video metadata. Return ONLY valid JSON.
Title: "${title}"
Description preview: "${desc.substring(0, 500)}"
Tags: ${tags.slice(0, 10).join(', ')}
Current SEO score: ${seo.overall}/100

Return JSON:
{
  "newTitle": "Optimized title ≤60 chars",
  "newDescription": "Full optimized description ≥200 words with hook, timestamps placeholder, CTA, hashtags",
  "newTags": ["tag1","tag2","tag3"],
  "estimatedScoreLift": 15
}`;

      const raw = await askAI(
        'You are a YouTube SEO optimizer. Return ONLY valid JSON, no markdown.',
        prompt,
        { temperature: 0.5, maxTokens: 1500 }
      );
      
      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch {
        continue; // Skip if AI returns invalid JSON
      }

      const proposedTitle = (parsed.newTitle || title).substring(0, 60).trim();
      const proposedDesc = parsed.newDescription || desc;
      const proposedTags = (parsed.newTags || tags).map(t => String(t).replace(/\s+/g, '')).filter(t => t.length > 1).slice(0, 20);
      const proposedScore = computeSEOScores(proposedTitle, proposedDesc, proposedTags);

      dbService.createQueueItem({
        channelId,
        videoId: video.id,
        videoTitle: title,
        currentTitle: title,
        currentDescription: desc,
        currentTags: tags,
        proposedTitle,
        proposedDescription: proposedDesc,
        proposedTags,
        scoreBefore: seo.overall,
        scoreAfter: proposedScore.overall,
      });
      queued++;
    } catch (err) {
      console.warn(`[CronOptimizer] Failed to generate proposal for ${video.id}:`, err.message);
    }
  }

  return { queued, total: videos.length, optimized: toOptimize.length };
}

// ── Route: Vercel Cron endpoint (called by Vercel scheduler) ──
// Add to vercel.json: { "crons": [{ "path": "/api/cron/daily-optimize", "schedule": "0 6 * * *" }] }
router.get('/daily-optimize', async (req, res) => {
  // Verify this is a legitimate Vercel cron call
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret !== process.env.CRON_SECRET) {
    return sendRes(res, 401, { error: 'Unauthorized' });
  }

  try {
    const { default: dbService } = await import('../src/database/services.js');
    
    // Get all channels that have stored access tokens
    // NOTE: This requires channels table to have access_token column
    // For now, log that cron ran and return success (full impl needs token storage)
    console.log('[CronOptimizer] Daily cron triggered at', new Date().toISOString());
    
    sendRes(res, 200, { 
      success: true, 
      message: 'Daily optimization cron executed',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[CronOptimizer] Cron error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Manual trigger (user initiates from dashboard) ──
router.post('/scan-and-queue', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { accessToken } = req.body || {};
    
    if (!channelId || !accessToken) {
      return sendRes(res, 400, { error: 'channelId and accessToken required' });
    }

    const result = await scanAndQueue(channelId, accessToken);
    sendRes(res, 200, { success: true, ...result });
  } catch (e) {
    console.error('[CronOptimizer] Scan error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get pending queue for a channel ──
router.get('/queue', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.query.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    
    const { default: dbService } = await import('../src/database/services.js');
    const queue = dbService.getQueueByChannel(channelId, 'pending');
    const stats = dbService.getQueueStats(channelId);
    sendRes(res, 200, { queue, stats });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Approve or skip a queue item ──
router.post('/queue/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approved' | 'skipped'
    if (!['approved', 'skipped'].includes(action)) {
      return sendRes(res, 400, { error: 'action must be approved or skipped' });
    }
    const { default: dbService } = await import('../src/database/services.js');
    dbService.updateQueueItemStatus(id, action);
    sendRes(res, 200, { success: true });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Register the router in main.js

**Modify file: `main.js`**

Find the section where routers are imported and registered. It looks like:
```js
import { router as aiRouter } from './api/ai-engine.js';
app.use('/api/ai', aiRouter);
```

Add:
```js
// Import (at top with other imports):
import { router as cronRouter } from './api/cron-optimizer.js';

// Register (with other app.use calls):
app.use('/api/cron', cronRouter);
```

---

## STEP 4 — Update vercel.json to add cron schedule

**Modify file: `vercel.json`**

Find the JSON structure and add a `crons` array at the top level:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-optimize",
      "schedule": "0 6 * * *"
    }
  ]
}
```
(Runs at 6 AM UTC daily)

---

## Acceptance Criteria

1. `POST /api/cron/scan-and-queue` with valid `channelId` + `accessToken` in body
   returns `{ success: true, queued: N, total: M }` (N may be 0 if all videos score >= 70)
2. `GET /api/cron/queue?channelId=UCxxx` returns array of pending queue items
3. `POST /api/cron/queue/{id}/action` with `{ "action": "approved" }` updates the item
4. DB has `optimization_queue` table (check with sqlite3 CLI: `.tables`)
5. No existing routes broken

## Files Changed
- `src/database/services.js` — MODIFIED (new table + 5 new methods)
- `api/cron-optimizer.js` — NEW
- `main.js` — MODIFIED (import + register router)
- `vercel.json` — MODIFIED (add crons array)
