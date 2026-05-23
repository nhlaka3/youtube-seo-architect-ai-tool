# TASK 07 — AI Coach Persistent Memory

## Goal
Give the AI Coach memory that persists between sessions. The coach remembers
a creator's goals, their problem videos, their niche focus, and past advice —
so every conversation builds on the last instead of starting cold.

---

## STEP 1 — Add coach_memory table to DB

**Modify file: `src/database/services.js`**

Add inside db initialization:

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS coach_memory (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    channel_id TEXT NOT NULL UNIQUE,
    niche TEXT,
    content_goals TEXT,
    problem_videos TEXT,
    focus_keywords TEXT,
    upload_frequency TEXT,
    pain_points TEXT,
    wins TEXT,
    last_conversation TEXT,
    conversation_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
```

Add service methods:

```js
getCoachMemory(channelId) {
  const stmt = db.prepare(`SELECT * FROM coach_memory WHERE channel_id = ?`);
  const row = stmt.get(channelId);
  if (!row) return null;
  return {
    ...row,
    contentGoals: row.content_goals ? JSON.parse(row.content_goals) : [],
    problemVideos: row.problem_videos ? JSON.parse(row.problem_videos) : [],
    focusKeywords: row.focus_keywords ? JSON.parse(row.focus_keywords) : [],
    painPoints: row.pain_points ? JSON.parse(row.pain_points) : [],
    wins: row.wins ? JSON.parse(row.wins) : [],
  };
},

upsertCoachMemory(channelId, data) {
  const existing = db.prepare(`SELECT id FROM coach_memory WHERE channel_id = ?`).get(channelId);
  
  if (existing) {
    const stmt = db.prepare(`
      UPDATE coach_memory SET
        niche = COALESCE(?, niche),
        content_goals = COALESCE(?, content_goals),
        problem_videos = COALESCE(?, problem_videos),
        focus_keywords = COALESCE(?, focus_keywords),
        upload_frequency = COALESCE(?, upload_frequency),
        pain_points = COALESCE(?, pain_points),
        wins = COALESCE(?, wins),
        last_conversation = COALESCE(?, last_conversation),
        conversation_count = conversation_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = ?
    `);
    return stmt.run(
      data.niche || null,
      data.contentGoals ? JSON.stringify(data.contentGoals) : null,
      data.problemVideos ? JSON.stringify(data.problemVideos) : null,
      data.focusKeywords ? JSON.stringify(data.focusKeywords) : null,
      data.uploadFrequency || null,
      data.painPoints ? JSON.stringify(data.painPoints) : null,
      data.wins ? JSON.stringify(data.wins) : null,
      data.lastConversation || null,
      channelId
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO coach_memory 
      (channel_id, niche, content_goals, problem_videos, focus_keywords,
       upload_frequency, pain_points, wins, last_conversation, conversation_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    return stmt.run(
      channelId,
      data.niche || null,
      data.contentGoals ? JSON.stringify(data.contentGoals) : '[]',
      data.problemVideos ? JSON.stringify(data.problemVideos) : '[]',
      data.focusKeywords ? JSON.stringify(data.focusKeywords) : '[]',
      data.uploadFrequency || null,
      data.painPoints ? JSON.stringify(data.painPoints) : '[]',
      data.wins ? JSON.stringify(data.wins) : '[]',
      data.lastConversation || null
    );
  }
},

clearCoachMemory(channelId) {
  return db.prepare(`DELETE FROM coach_memory WHERE channel_id = ?`).run(channelId);
},
```

---

## STEP 2 — Add memory endpoints

**Create file: `api/coach-memory.js`**

```js
import express from 'express';
import { z } from 'zod';
import { validateBody } from './middleware/validate.js';

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

const extractSchema = z.object({
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  niche: z.string().optional(),
});

/**
 * Extract memorable facts from a conversation using AI.
 */
async function extractMemoryFromConversation(conversation, niche) {
  const { askAI } = await import('./_lib/ai-provider.js');
  
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'Creator' : 'Coach'}: ${m.content}`)
    .join('\n');

  try {
    const raw = await askAI(
      'You extract structured memory from YouTube creator coaching conversations. Return ONLY valid JSON.',
      `Extract key facts from this coaching conversation to remember for next time.

CONVERSATION:
${transcript.substring(0, 3000)}

Return JSON (use empty arrays if nothing found):
{
  "contentGoals": ["goal1", "goal2"],
  "problemVideos": ["video title that creator mentioned struggling with"],
  "focusKeywords": ["keyword they want to rank for"],
  "uploadFrequency": "once a week / twice a week / etc (null if not mentioned)",
  "painPoints": ["specific problem they described"],
  "wins": ["success they mentioned"],
  "summary": "One sentence summary of this coaching session"
}`,
      { temperature: 0.3, maxTokens: 600 }
    );

    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return {
      contentGoals: [], problemVideos: [], focusKeywords: [],
      uploadFrequency: null, painPoints: [], wins: [], summary: '',
    };
  }
}

// ── Route: Get memory for a channel ──
router.get('/', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const memory = dbService.getCoachMemory(req.channelId);
    sendRes(res, 200, { memory: memory || null, hasMemory: !!memory });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Save memory after a conversation ──
router.post('/save', requireChannelId, validateBody(extractSchema), async (req, res) => {
  try {
    const { conversation, niche } = req.body;
    const { default: dbService } = await import('../src/database/services.js');

    // Extract memorable facts using AI
    const extracted = await extractMemoryFromConversation(conversation, niche);

    dbService.upsertCoachMemory(req.channelId, {
      niche: niche || extracted.niche,
      contentGoals: extracted.contentGoals,
      problemVideos: extracted.problemVideos,
      focusKeywords: extracted.focusKeywords,
      uploadFrequency: extracted.uploadFrequency,
      painPoints: extracted.painPoints,
      wins: extracted.wins,
      lastConversation: extracted.summary,
    });

    sendRes(res, 200, { success: true, extracted });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Clear memory ──
router.delete('/', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    dbService.clearCoachMemory(req.channelId);
    sendRes(res, 200, { success: true });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Inject memory into the AI assistant route

**Modify file: `api/ai-engine.js`**

Find the `/assistant` route (around line 248). At the top of the handler,
**before** the `askAI` call, add memory injection:

```js
// Add AFTER existing variable destructuring (message, context, history):

// ── Load coach memory ──
let memoryContext = '';
try {
  const { default: dbService } = await import('../src/database/services.js');
  const memory = dbService.getCoachMemory(req.channelId);
  if (memory && memory.conversation_count > 0) {
    const goals = memory.contentGoals?.slice(0,3).join(', ');
    const problems = memory.problemVideos?.slice(0,2).join(', ');
    const keywords = memory.focusKeywords?.slice(0,3).join(', ');
    const pains = memory.painPoints?.slice(0,2).join(', ');
    const wins = memory.wins?.slice(0,2).join(', ');

    memoryContext = `\n\n## What I Remember About This Creator (${memory.conversation_count} sessions):\n`;
    if (goals) memoryContext += `- Goals: ${goals}\n`;
    if (problems) memoryContext += `- Struggling with: ${problems}\n`;
    if (keywords) memoryContext += `- Target keywords: ${keywords}\n`;
    if (pains) memoryContext += `- Pain points: ${pains}\n`;
    if (wins) memoryContext += `- Recent wins: ${wins}\n`;
    if (memory.lastConversation) memoryContext += `- Last session: ${memory.lastConversation}\n`;
    memoryContext += `Reference this context naturally — don't list it robotically.`;
  }
} catch { /* Memory load failed silently */ }
```

Then find the line that builds `systemPrompt` and append `memoryContext` to it:

```js
// FIND this line (approximately):
const systemPrompt = `## YouTube SEO Architect Coach\\n\\n...`;

// CHANGE to append memoryContext:
const systemPrompt = `## YouTube SEO Architect Coach\\n\\n...existing content...${memoryContext}`;
```

---

## STEP 4 — Register in main.js

```js
// Import:
import { router as coachMemoryRouter } from './api/coach-memory.js';

// Register:
app.use('/api/coach-memory', coachMemoryRouter);
```

---

## STEP 5 — Auto-save memory after AI Coach conversations in dashboard.html

**Modify file: `main.js`** — find the AI Coach send/submit function (search for
`assistant` or `coach` in the fetch calls). After a successful AI response,
add a background memory save:

```js
// After receiving AI coach reply, background-save the conversation:
async function saveCoachMemoryInBackground(conversationHistory, niche) {
  if (!conversationHistory || conversationHistory.length < 2) return;
  try {
    const channelId = window.currentChannelId || '';
    await fetch('/api/coach-memory/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({
        conversation: conversationHistory.slice(-6), // Last 6 messages
        niche: window.currentNiche || 'General',
      }),
    });
  } catch { /* Silent fail — memory save is best-effort */ }
}
window.saveCoachMemoryInBackground = saveCoachMemoryInBackground;
```

**Add Memory Panel to AI Coach UI** in dashboard.html — find the AI Coach
panel and add a "Memory" section at the top:

```html
<!-- Add inside the AI Coach panel, near the top: -->
<div id="coach-memory-display" style="
  background: rgba(0,212,255,0.05);
  border: 1px solid rgba(0,212,255,0.15);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  display: none;
">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <strong style="color:var(--accent);">🧠 Coach Memory</strong>
    <button onclick="clearCoachMemory()" 
      style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;">
      Clear
    </button>
  </div>
  <div id="coach-memory-content" style="color:var(--text-muted);line-height:1.6;"></div>
</div>
```

Add JS to load and display memory:

```js
async function loadCoachMemoryDisplay() {
  try {
    const channelId = window.currentChannelId || '';
    if (!channelId) return;
    const res = await fetch('/api/coach-memory', {
      headers: { 'x-channel-id': channelId }
    });
    const data = await res.json();
    const memEl = document.getElementById('coach-memory-display');
    const contentEl = document.getElementById('coach-memory-content');
    if (!memEl || !contentEl || !data.hasMemory) return;

    const m = data.memory;
    const parts = [];
    if (m.contentGoals?.length) parts.push(`🎯 Goals: ${m.contentGoals.slice(0,2).join(', ')}`);
    if (m.focusKeywords?.length) parts.push(`🔍 Keywords: ${m.focusKeywords.slice(0,3).join(', ')}`);
    if (m.lastConversation) parts.push(`💬 Last session: ${m.lastConversation}`);

    if (parts.length) {
      contentEl.innerHTML = parts.join('<br/>');
      memEl.style.display = 'block';
    }
  } catch { /* Silent */ }
}

async function clearCoachMemory() {
  if (!confirm('Clear coach memory? The coach will start fresh.')) return;
  const channelId = window.currentChannelId || '';
  await fetch('/api/coach-memory', {
    method: 'DELETE',
    headers: { 'x-channel-id': channelId }
  });
  document.getElementById('coach-memory-display').style.display = 'none';
}

window.loadCoachMemoryDisplay = loadCoachMemoryDisplay;
window.clearCoachMemory = clearCoachMemory;
```

---

## Acceptance Criteria

1. `GET /api/coach-memory` returns `{ memory: null, hasMemory: false }` for new channel
2. `POST /api/coach-memory/save` with a conversation array returns
   `{ success: true, extracted: { contentGoals: [...], ... } }`
3. Second call to `GET /api/coach-memory` returns populated memory object
4. `DELETE /api/coach-memory` clears memory successfully
5. AI Coach `/assistant` endpoint responses reference memory context
   (test by saving memory with `contentGoals: ["Reach 10k subs"]` then
   asking the coach "what are my goals?" — it should answer correctly)
6. Coach memory panel appears in AI Coach UI after a conversation

## Files Changed
- `src/database/services.js` — MODIFIED (1 new table + 3 methods)
- `api/coach-memory.js` — NEW
- `api/ai-engine.js` — MODIFIED (memory injection in /assistant route)
- `main.js` — MODIFIED (router registration + JS functions)
- `dashboard.html` — MODIFIED (memory display panel)
