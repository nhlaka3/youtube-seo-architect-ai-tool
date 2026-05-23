# TASK 12 — AI Agent Workflows: Content Strategy & Series Planner

## Goal
Implement a high-level "Producer Agent" workflow. This system doesn't just optimize single videos; it plans **multi-video series** (to boost binge-watching/retention) and manages an **AI Content Calendar** that aligns video releases with trends and keyword clusters.

---

## STEP 1 — Content Strategy Tables

**Modify file: `src/database/services.js`**

```js
db.exec(`
  -- Multi-video series tracking
  CREATE TABLE IF NOT EXISTS content_series (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    series_name TEXT NOT NULL,
    niche TEXT,
    goal TEXT, -- 'growth', 'retention', 'revenue'
    total_videos INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Individual video slots in a series/calendar
  CREATE TABLE IF NOT EXISTS content_plan_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    series_id TEXT,
    title TEXT NOT NULL,
    angle TEXT, -- The specific 'hook' or 'unique selling point'
    target_keyword TEXT,
    planned_date DATETIME,
    status TEXT DEFAULT 'planned', -- 'planned', 'scripting', 'produced', 'published'
    video_id TEXT, -- Link to actual YouTube video ID once published
    order_in_series INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES content_series(id)
  );

  CREATE INDEX IF NOT EXISTS idx_plan_date ON content_plan_items(planned_date);
  CREATE INDEX IF NOT EXISTS idx_series_id ON content_plan_items(series_id);
`);
```

Add service methods:

```js
// ── Content Strategy service methods ──

createSeries(data) {
  const info = db.prepare(`
    INSERT INTO content_series (series_name, niche, goal, total_videos)
    VALUES (?, ?, ?, ?)
  `).run(data.seriesName, data.niche, data.goal, data.totalVideos || 5);
  return info.lastInsertRowid;
},

addPlanItem(data) {
  return db.prepare(`
    INSERT INTO content_plan_items 
    (series_id, title, angle, target_keyword, planned_date, order_in_series)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.seriesId || null, data.title, data.angle,
    data.targetKeyword, data.plannedDate, data.orderInSeries || 0
  );
},

getSeriesWithItems(seriesId) {
  const series = db.prepare(`SELECT * FROM content_series WHERE id = ?`).get(seriesId);
  if (!series) return null;
  series.items = db.prepare(`
    SELECT * FROM content_plan_items 
    WHERE series_id = ? 
    ORDER BY order_in_series ASC
  `).all(seriesId);
  return series;
},

getContentCalendar(startDate, endDate) {
  return db.prepare(`
    SELECT cpi.*, cs.series_name 
    FROM content_plan_items cpi
    LEFT JOIN content_series cs ON cpi.series_id = cs.id
    WHERE planned_date BETWEEN ? AND ?
    ORDER BY planned_date ASC
  `).all(startDate, endDate);
},

updatePlanItemStatus(id, status, videoId = null) {
  return db.prepare(`
    UPDATE content_plan_items 
    SET status = ?, video_id = COALESCE(?, video_id)
    WHERE id = ?
  `).run(status, videoId, id);
},
```

---

## STEP 2 — Series Planner API

**Create file: `api/agent-workflows/series-planner.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

/**
 * AI logic to plan a cohesive multi-video series.
 */
async function generateSeriesPlan(niche, topic, videoCount = 5) {
  const { askAI } = await import('../_lib/ai-provider.js');
  
  const prompt = `You are a YouTube Strategist. Plan a ${videoCount}-video series that encourages binge-watching.
Niche: ${niche}
Core Topic: ${topic}

Each video should build on the previous one. 
Return JSON:
{
  "seriesName": "Catchy Series Title",
  "goal": "growth|retention",
  "videos": [
    {
      "title": "Video Title",
      "angle": "The unique psychological hook",
      "targetKeyword": "Best keyword to rank for",
      "order": 1,
      "whyItWorks": "Strategic reason for this video in the sequence"
    }
  ]
}`;

  const raw = await askAI(
    'You are a high-level content producer. Return ONLY valid JSON.',
    prompt,
    { temperature: 0.8 }
  );

  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Route: Create a new series plan ──
router.post('/plan-series', async (req, res) => {
  try {
    const { niche, topic, videoCount } = req.body;
    const plan = await generateSeriesPlan(niche, topic, videoCount);
    
    const { default: db } = await import('../../src/database/services.js');
    
    // Save to DB
    db.prepare('BEGIN').run();
    try {
      const seriesId = db.createSeries({
        seriesName: plan.seriesName,
        niche,
        goal: plan.goal,
        totalVideos: plan.videos.length
      });

      // Insert videos with 7-day intervals
      const now = new Date();
      for (let i = 0; i < plan.videos.length; i++) {
        const v = plan.videos[i];
        const plannedDate = new Date(now);
        plannedDate.setDate(now.getDate() + (i * 7));

        db.addPlanItem({
          seriesId,
          title: v.title,
          angle: v.angle,
          targetKeyword: v.targetKeyword,
          plannedDate: plannedDate.toISOString(),
          orderInSeries: v.order
        });
      }
      db.prepare('COMMIT').run();
      
      const fullSeries = db.getSeriesWithItems(seriesId);
      sendRes(res, 200, { success: true, series: fullSeries });
    } catch (err) {
      db.prepare('ROLLBACK').run();
      throw err;
    }
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Dashboard UI: "Strategy Center"

**Modify file: `dashboard.html`**

Add a "Content Strategy" tab for managing series and the calendar.

```html
<!-- Tab Link -->
<div class="nav-item" onclick="showTab('strategy-center')">
  <i class="fas fa-calendar-alt"></i> Content Strategy
</div>

<!-- Strategy Content -->
<div id="strategy-center" class="tab-content" style="display:none">
  <div class="section-header">
    <h2>AI Content Strategy & Series Planner</h2>
    <div class="header-actions">
      <button class="btn-primary" onclick="openSeriesModal()">Plan New Series</button>
    </div>
  </div>

  <div class="strategy-layout">
    <div class="series-list">
      <h3>Active Series</h3>
      <div id="active-series-container">
        <!-- Series cards here -->
      </div>
    </div>
    
    <div class="calendar-view">
      <h3>Content Calendar</h3>
      <div id="calendar-grid" class="calendar-grid">
        <!-- Calendar items here -->
      </div>
    </div>
  </div>
</div>

<!-- Simple Series Planner Modal -->
<div id="series-modal" class="modal" style="display:none">
  <div class="modal-content">
    <h3>Plan Multi-Video Series</h3>
    <input type="text" id="series-topic" placeholder="e.g. Master YouTube Analytics">
    <select id="series-count">
      <option value="3">3 Videos (Mini-series)</option>
      <option value="5" selected>5 Videos (Full Arc)</option>
      <option value="10">10 Videos (Deep Dive)</option>
    </select>
    <button onclick="submitSeriesPlan()">Generate Plan</button>
  </div>
</div>
```

---

## STEP 4 — Dashboard Logic

**Modify file: `main.js`**

```js
async function submitSeriesPlan() {
  const topic = document.getElementById('series-topic').value;
  const count = document.getElementById('series-count').value;
  
  showToast('AI is mapping out your series arc...');
  
  const res = await fetch('/api/agent/series/plan-series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      niche: window.currentNiche || 'YouTube SEO', 
      topic, 
      videoCount: count 
    })
  });

  if (res.ok) {
    showToast('Series plan created!', 'success');
    closeModal('series-modal');
    loadStrategyData();
  }
}

async function loadStrategyData() {
  // Fetch active series and calendar items from DB
  // Populate strategy-center UI
}
```

---

## Acceptance Criteria

1. "Content Strategy" tab allows inputting a topic and choosing video count.
2. AI successfully generates a JSON plan with cohesive " binge-worthy" video titles and hooks.
3. The system automatically schedules the videos (e.g., 1 per week) in the `content_plan_items` table.
4. Active series are displayed with their progress (videos published vs planned).
5. The calendar view shows upcoming video deadlines and keywords.

## Files Changed
- `src/database/services.js` — MODIFIED (2 new tables + 5 new methods)
- `api/agent-workflows/series-planner.js` — NEW
- `main.js` — MODIFIED (UI integration + router registration)
- `dashboard.html` — MODIFIED (New Strategy Tab + Modal)
- `AGENT_TASKS/README.md` — MODIFIED (Index update)
