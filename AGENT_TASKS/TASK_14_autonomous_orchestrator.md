# TASK 14 — The "Super-Agent" Orchestrator (Autonomous Mode)

## Goal
The final piece of the platform: a centralized **Autonomous Orchestrator**. This task implements the "Autonomous Mode" toggle in the dashboard, which enables a multi-agent loop that periodically scans analytics, generates series plans, executes PSEO expansions, and applies SEO optimizations without manual intervention.

---

## STEP 1 — Autonomous Mode Configuration

**Modify file: `src/database/services.js`**

```js
db.exec(`
  -- Global Agent Settings
  CREATE TABLE IF NOT EXISTS agent_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    is_autonomous BOOLEAN DEFAULT 0,
    auto_publish_pseo BOOLEAN DEFAULT 0,
    auto_apply_seo_score_threshold INTEGER DEFAULT 90,
    max_daily_optimizations INTEGER DEFAULT 10,
    last_run_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Agent Execution Logs
  CREATE TABLE IF NOT EXISTS agent_activity_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    agent_name TEXT NOT NULL, -- 'optimizer', 'content_planner', 'pseo_engine'
    action_taken TEXT NOT NULL,
    impact_description TEXT,
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
```

---

## STEP 2 — The Orchestrator Engine

**Create file: `api/agent-workflows/orchestrator.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

/**
 * The core "Think Loop" for the Autonomous Agent.
 */
async function runAutonomousLoop() {
  const { default: db } = await import('../../src/database/services.js');
  const settings = db.prepare(`SELECT * FROM agent_settings WHERE id = 'global'`).get();
  
  if (!settings || !settings.is_autonomous) return { status: 'skipped', reason: 'Autonomous mode off' };

  const results = [];

  // 1. Check for underperforming videos (Task 02 logic)
  const weakVideos = await fetchUnderperformingVideos(); // From youtube-ops
  if (weakVideos.length > 0) {
    // Trigger auto-optimization if score is high enough
    results.push({ task: 'optimization', count: weakVideos.length });
  }

  // 2. Check for PSEO gaps (Task 11A/B logic)
  if (settings.auto_publish_pseo) {
     const opportunities = db.getPendingOpportunities(5);
     // Trigger bulk generate
     results.push({ task: 'pseo_generation', count: opportunities.length });
  }

  // 3. Check for Trend Alerts (Task 08 logic)
  const trends = await scanTrends(); 
  if (trends.length > 0) {
    // Generate a new series plan based on the trend
    results.push({ task: 'trend_response', trend: trends[0].name });
  }

  db.prepare(`UPDATE agent_settings SET last_run_at = CURRENT_TIMESTAMP WHERE id = 'global'`).run();
  
  return { status: 'completed', tasks: results };
}

// ── Route: Toggle Autonomous Mode ──
router.post('/toggle', async (req, res) => {
  const { enabled } = req.body;
  const { default: db } = await import('../../src/database/services.js');
  
  db.prepare(`
    INSERT INTO agent_settings (id, is_autonomous) 
    VALUES ('global', ?) 
    ON CONFLICT(id) DO UPDATE SET is_autonomous = ?, updated_at = CURRENT_TIMESTAMP
  `).run(enabled ? 1 : 0, enabled ? 1 : 0);

  sendRes(res, 200, { success: true, is_autonomous: !!enabled });
});

export default router;
```

---

## STEP 3 — Dashboard UI: "The War Room"

**Modify file: `dashboard.html`**

Update the header or a dedicated "War Room" panel to show the Agent's status.

```html
<!-- Autonomous Toggle in Header -->
<div class="agent-status-bar">
  <div class="status-indicator">
    <span class="pulse-dot"></span>
    <span id="agent-status-text">Agent: Idle</span>
  </div>
  <div class="toggle-switch">
    <input type="checkbox" id="auto-mode-toggle" onchange="toggleAutoMode(this.checked)">
    <label for="auto-mode-toggle">Autonomous Mode</label>
  </div>
</div>

<!-- War Room Panel -->
<div id="war-room" class="tab-content" style="display:none">
  <div class="section-header">
    <h2>Growth War Room</h2>
    <p>Real-time autonomous agent activity and decisions.</p>
  </div>

  <div class="activity-feed" id="agent-logs">
    <!-- Log items appear here -->
    <div class="log-item">
      <span class="log-time">10:05 AM</span>
      <span class="log-agent">[Optimizer]</span>
      <span class="log-msg">Detected 12% CTR drop on "Video X". Applying Title variant B.</span>
    </div>
  </div>
</div>
```

---

## STEP 4 — Background Worker Integration

**Modify file: `api/index.js`**

Add the orchestrator to the existing daily cron job or create a high-frequency trigger.

```js
import { runAutonomousLoop } from './agent-workflows/orchestrator.js';

// Inside the cron handler
app.get('/api/cron/daily-growth-pulse', async (req, res) => {
  // ... auth check ...
  
  const results = await runAutonomousLoop();
  
  // Send notification to user if significant actions taken
  console.log('[AGENT] Autonomous Loop Finished:', results);
  
  res.json(results);
});
```

---

## Acceptance Criteria

1. "Autonomous Mode" toggle persists its state in the database.
2. When enabled, the `runAutonomousLoop` correctly identifies and triggers sub-tasks (Optimizations, PSEO, Trends).
3. Every agent action is logged to `agent_activity_logs` and displayed in the "War Room" feed.
4. UI pulse animation activates when the agent is "Thinking" or "Executing".
5. The system respects `max_daily_optimizations` limits to avoid API quota exhaustion.

## Files Changed
- `src/database/services.js` — MODIFIED (2 new tables)
- `api/agent-workflows/orchestrator.js` — NEW
- `dashboard.html` — MODIFIED (Status bar + War Room UI)
- `main.js` — MODIFIED (UI logic + toggle handler)
- `api/index.js` — MODIFIED (Cron integration)
- `AGENT_TASKS/README.md` — MODIFIED (Index update)
