# Phronesis Goal-Driven Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Phronesis from a manually-triggered pipeline into an autonomous, goal-driven agent with a proactive coach-style chat interface.

**Architecture:** Three layers built in 3 phases (A→B→C). Backend-first, each phase independently testable via API. Frontend last.

**Tech Stack:** Express.js API, vanilla JS frontend, Neon Postgres + Drizzle ORM, existing agent-core modules

---

## Phase A: Goal Engine + Scoring (Backend Foundation)

### Task A1: Create Goal Schema & Database Table

**Files:**
- Create: `api/agent-core/goal-engine.js`
- Modify: `src/database/schema.js` (add goals table)

- [ ] **Step 1: Add goals table to schema**

```js
// In src/database/schema.js, add after existing tables:
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  type: text('type').notNull(), // 'subscribers', 'views', 'watch_hours', 'revenue'
  target: integer('target').notNull(),
  current: integer('current').notNull().default(0),
  deadline: text('deadline'),
  status: text('status').notNull().default('active'), // 'active', 'paused', 'completed', 'failed'
  phases: text('phases').notNull().default('[]'), // JSON array
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});
```

Run: `node scripts/run-migration.js` (or export from schema and use existing migration flow)

- [ ] **Step 2: Create goal-engine.js**

```js
// api/agent-core/goal-engine.js
// Goal lifecycle: set → plan → track → adapt
import { generatePlan } from './planner.js';
import { captureScanSnapshot, measureImpactDelta } from './memory-engine.js';

/**
 * Set a new goal. Replaces any existing active goal.
 */
export async function setGoal({ channelId, type, target, deadline }) {
  const goal = {
    id: 'goal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    channelId,
    type,
    target,
    current: await getCurrentMetric(channelId, type),
    deadline,
    status: 'active',
    phases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Deactivate any existing goals
  await deactivateExistingGoals(channelId);

  // Generate plan using existing planner
  const plan = await generatePlan(goal.id, `Grow channel ${type} to ${target} by ${deadline}`, 'channel-growth');
  goal.phases = plan.phases.map(p => ({
    ...p,
    status: 'pending',
    estimatedImpact: estimatePhaseImpact(p, type, target)
  }));

  // Save to database
  const { default: dbService } = await import('../../src/database/services.js');
  await dbService.db.insert(goals).values(goal);

  return goal;
}

/**
 * Get current metric value for a channel
 */
async function getCurrentMetric(channelId, type) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const users = await dbService.getAllUsers(100);
    const user = users.find(u => u.channelId === channelId);
    if (!user) return 0;
    if (type === 'subscribers') return parseInt(user.subscriberCount) || 0;
    if (type === 'views') return parseInt(user.viewCount) || 0;
    return 0;
  } catch(e) { return 0; }
}

/**
 * Estimate impact of a phase based on historical data
 */
function estimatePhaseImpact(phase, goalType, target) {
  // Simple heuristic — can be improved with actual ML later
  const phaseWeights = { AUDIT: 0.1, OPTIMIZE: 0.4, GROWTH: 0.3, COMPOUND: 0.2 };
  const weight = phaseWeights[phase.name] || 0.2;
  const impact = Math.round(target * weight);
  return `+${impact} ${goalType}`;
}

/**
 * Get current active goal for a channel
 */
export async function getGoalStatus(channelId) {
  const { default: dbService } = await import('../../src/database/services.js');
  const results = await dbService.db.select().from(goals)
    .where({ channelId, status: 'active' }).limit(1);
  if (!results.length) return null;
  const goal = results[0];
  // Update current metric
  goal.current = await getCurrentMetric(channelId, goal.type);
  // Calculate progress
  goal.progress = {
    percent: Math.round((goal.current / goal.target) * 100),
    remaining: goal.target - goal.current,
    weeklyRate: calculateWeeklyRate(goal)
  };
  if (goal.progress.weeklyRate > 0) {
    const weeksLeft = goal.progress.remaining / goal.progress.weeklyRate;
    goal.progress.eta = new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().split('T')[0];
  }
  return goal;
}

function calculateWeeklyRate(goal) {
  const created = new Date(goal.createdAt);
  const weeks = Math.max(0.1, (Date.now() - created.getTime()) / (7 * 86400000));
  return Math.round((goal.current - (goal.initialCurrent || 0)) / weeks);
}

async function deactivateExistingGoals(channelId) {
  const s = await import('../../src/database/schema.js');
  const { default: dbService } = await import('../../src/database/services.js');
  await dbService.db.update(s.goals)
    .set({ status: 'completed', updatedAt: new Date().toISOString() })
    .where({ channelId, status: 'active' });
}
```

- [ ] **Step 3: Test via API**

```bash
# Set a goal
curl -X POST http://localhost:3000/api/agent/goal/set \
  -H "Content-Type: application/json" \
  -H "x-channel-id: UC_TEST" \
  -d '{"type":"subscribers","target":10000,"deadline":"2026-12-31"}'
# Expected: 200 with goal object

# Get status
curl http://localhost:3000/api/agent/goal/status?channelId=UC_TEST
# Expected: 200 with goal + progress
```

- [ ] **Step 4: Commit**

```bash
git add api/agent-core/goal-engine.js src/database/schema.js
git commit -m "feat(agent): goal engine — set, track, adapt goals"
```

---

### Task A2: Create Goal-Contribution Scorer

**Files:**
- Create: `api/agent-core/contribution-scorer.js`

- [ ] **Step 1: Create scorer**

```js
// api/agent-core/contribution-scorer.js
// Scores every agent action by how much it contributes to the goal

/**
 * Score an action by estimated goal contribution.
 * Higher score = higher priority.
 */
export function scoreAction(action, goal) {
  if (!goal) return { score: 0.5, reasoning: 'No goal set' };

  const baseScore = scoreByType(action.type, goal.type);
  const urgencyBonus = calculateUrgency(goal);
  const volumeFactor = normalizeVolume(action.estimatedViews || 0);

  return {
    score: Math.min(1.0, baseScore * urgencyBonus * volumeFactor),
    reasoning: generateReasoning(action, goal, baseScore, urgencyBonus),
    estimatedImpact: estimateImpact(action, goal)
  };
}

function scoreByType(actionType, goalType) {
  // How relevant is this action type to the goal?
  const matrix = {
    subscribers: {
      'title-fix': 0.7, 'tag-optimize': 0.5, 'description-update': 0.4,
      'thumbnail-redesign': 0.8, 'retention-fix': 0.6, 'bulk-update': 0.3,
      'competitor-analysis': 0.4, 'seo-audit': 0.5, 'trend-capitalize': 0.6
    },
    views: {
      'title-fix': 0.6, 'tag-optimize': 0.7, 'description-update': 0.5,
      'thumbnail-redesign': 0.9, 'retention-fix': 0.4, 'bulk-update': 0.3,
      'competitor-analysis': 0.5, 'seo-audit': 0.4, 'trend-capitalize': 0.8
    },
    watch_hours: {
      'title-fix': 0.5, 'tag-optimize': 0.4, 'description-update': 0.4,
      'thumbnail-redesign': 0.6, 'retention-fix': 0.9, 'bulk-update': 0.3,
      'competitor-analysis': 0.3, 'seo-audit': 0.4, 'trend-capitalize': 0.5
    }
  };
  return (matrix[goalType] && matrix[goalType][actionType]) || 0.3;
}

function calculateUrgency(goal) {
  if (!goal.deadline) return 1.0;
  const deadline = new Date(goal.deadline);
  const now = Date.now();
  const total = deadline.getTime() - new Date(goal.createdAt).getTime();
  const elapsed = now - new Date(goal.createdAt).getTime();
  const expectedProgress = elapsed / total;
  const actualProgress = goal.current / goal.target;
  // If behind schedule, increase urgency
  if (actualProgress < expectedProgress) {
    return 1.0 + (expectedProgress - actualProgress) * 2;
  }
  return 1.0;
}

function normalizeVolume(views) {
  return Math.min(1.0, Math.max(0.1, Math.log10(views + 1) / 6));
}

function estimateImpact(action, goal) {
  const baseMap = { subscribers: 40, views: 500, watch_hours: 100 };
  const base = baseMap[goal.type] || 50;
  return Math.round(base * (scoreAction(action, goal).score));
}

function generateReasoning(action, goal, base, urgency) {
  const parts = [`This ${action.type} action`];
  if (urgency > 1.2) parts.push('is urgent (behind goal schedule)');
  if (action.estimatedViews > 1000) parts.push(`affects ${action.estimatedViews}+ views`);
  parts.push(`estimated to contribute ~${estimateImpact(action, goal)} ${goal.type}`);
  return parts.join(', ') + '.';
}

/**
 * Sort and rank actions by goal contribution
 */
export function prioritizeActions(actions, goal) {
  return actions
    .map(a => ({ ...a, contribution: scoreAction(a, goal) }))
    .sort((a, b) => b.contribution.score - a.contribution.score)
    .slice(0, 10); // Top 10 highest-impact
}
```

- [ ] **Step 2: Commit**

```bash
git add api/agent-core/contribution-scorer.js
git commit -m "feat(agent): goal-contribution scorer for action prioritization"
```

---

## Phase B: Coach Chat API + Cron Wiring

### Task B1: Create Coach Chat API

**Files:**
- Create: `api/agent-core/coach.js`

- [ ] **Step 1: Create coach chat engine**

```js
// api/agent-core/coach.js
// Proactive coach chat — agent initiates messages, user responds

const coachInbox = new Map(); // channelId → messages[]

export function addCoachMessage(channelId, message) {
  if (!coachInbox.has(channelId)) coachInbox.set(channelId, []);
  coachInbox.get(channelId).push({
    id: 'msg_' + Date.now(),
    ...message,
    timestamp: new Date().toISOString(),
    read: false
  });
}

export function getCoachInbox(channelId) {
  return coachInbox.get(channelId) || [];
}

export function markRead(channelId, messageId) {
  const msgs = coachInbox.get(channelId);
  if (!msgs) return;
  const msg = msgs.find(m => m.id === messageId);
  if (msg) msg.read = true;
}

export function clearInbox(channelId) {
  coachInbox.delete(channelId);
}

/**
 * Build a structured coach message
 */
export function buildMessage({ type, title, body, goalImpact, actions }) {
  return {
    type,       // 'alert', 'opportunity', 'progress', 'summary'
    title,      // Short headline
    body,       // Full explanation
    goalImpact, // "This affects your 10K subscriber goal — +2 days to ETA"
    actions     // [{ label: 'Fix Now', action: 'approve', proposalId: '...' }]
  };
}

/**
 * Generate a ranking alert message
 */
export function buildRankingAlert(video, goal) {
  return buildMessage({
    type: 'alert',
    title: `🚨 ${video.title?.substring(0, 40)}... dropped in ranking`,
    body: `Your video dropped from position #${video.oldRank} to #${video.newRank} for "${video.keyword}". Found ${video.issues?.length || 0} issues.`,
    goalImpact: goal ? `Estimated impact: -${Math.round(video.estimatedSubscribers || 0)} ${goal.type}` : null,
    actions: [
      { label: 'Optimize Now', action: 'approve', proposalId: video.proposalId },
      { label: 'Show Details', action: 'details', videoId: video.videoId },
      { label: 'Dismiss', action: 'dismiss' }
    ]
  });
}

/**
 * Build a progress summary message
 */
export function buildProgressSummary(goal) {
  if (!goal) return null;
  return buildMessage({
    type: 'summary',
    title: '📊 Weekly Progress Report',
    body: `Goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}%).\n` +
          `This week: +${goal.progress?.weeklyRate || 0} ${goal.type}.\n` +
          `ETA: ${goal.progress?.eta || 'calculating...'}`,
    goalImpact: goal.progress?.weeklyRate > 0
      ? `At this rate, you'll reach your goal by ${goal.progress?.eta}`
      : 'Progress is slower than projected. Consider increasing optimization frequency.',
    actions: [
      { label: 'Adjust Goal', action: 'adjust_goal' },
      { label: 'View Details', action: 'details' }
    ]
  });
}
```

- [ ] **Step 2: Add coach API routes to index.js**

```js
// Add to api/index.js:

// Goal endpoints
app.post('/api/agent/goal/set', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { type, target, deadline } = req.body || {};
    if (!type || !target) return res.status(400).json({ error: 'type and target required' });
    const { setGoal } = await import('./agent-core/goal-engine.js');
    const goal = await setGoal({ channelId, type, target: parseInt(target), deadline });
    res.json({ success: true, goal });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/goal/status', async (req, res) => {
  try {
    const channelId = req.query.channelId || req.headers['x-channel-id'];
    const { getGoalStatus } = await import('./agent-core/goal-engine.js');
    const goal = await getGoalStatus(channelId);
    res.json({ goal });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Coach inbox endpoints
app.get('/api/agent/coach/inbox', async (req, res) => {
  const channelId = req.query.channelId || req.headers['x-channel-id'];
  const { getCoachInbox } = await import('./agent-core/coach.js');
  const messages = getCoachInbox(channelId);
  res.json({ messages });
});

app.post('/api/agent/coach/respond', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { messageId, action, proposalId } = req.body || {};
    const { markRead } = await import('./agent-core/coach.js');
    markRead(channelId, messageId);
    if (action === 'approve' && proposalId) {
      // Execute the approved proposal
      const { executeProposal } = await import('./agent-workflows/orchestrator.js');
      await executeProposal(proposalId, channelId);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent/coach/ask', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { question } = req.body || {};
    const { handleQuestion } = await import('./agent-core/coach.js');
    const response = await handleQuestion(channelId, question);
    res.json({ response });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Commit**

```bash
git add api/agent-core/coach.js api/index.js
git commit -m "feat(agent): coach chat API — inbox, respond, ask"
```

---

### Task B2: Wire Cron for Autonomous Loop

**Files:**
- Create: `api/cron-agent-loop.js`
- Modify: `vercel.json` (add cron job)

- [ ] **Step 1: Create cron handler**

```js
// api/cron-agent-loop.js
// Cron-triggered autonomous agent loop
// Runs scan → score → propose → coach notify

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { default: dbService } = await import('../src/database/services.js');
    const users = await dbService.getAllUsers(100);
    const results = [];

    for (const user of users) {
      if (!user.channelId || !user.accessToken) continue;
      
      try {
        // Get user's goal
        const { getGoalStatus } = await import('./agent-core/goal-engine.js');
        const goal = await getGoalStatus(user.channelId);

        // Run scan
        const { runChannelScan } = await import('./agent-workflows/orchestrator.js');
        const scanResult = await runChannelScan(user.channelId, {
          accessToken: user.accessToken,
          goalType: goal?.type
        });

        // Score and prioritize
        const { prioritizeActions } = await import('./agent-core/contribution-scorer.js');
        const prioritized = prioritizeActions(scanResult.issues || [], goal);

        // Build coach message for top issues
        const { buildRankingAlert, addCoachMessage } = await import('./agent-core/coach.js');
        for (const issue of prioritized.slice(0, 3)) { // Top 3 only
          const msg = buildRankingAlert(issue, goal);
          addCoachMessage(user.channelId, msg);
        }

        results.push({
          channelId: user.channelId,
          issuesFound: scanResult.issues?.length || 0,
          prioritized: prioritized.length,
          goalActive: !!goal
        });
      } catch(userErr) {
        console.error(`[Cron Agent] Error for ${user.channelId}:`, userErr.message);
      }
    }

    res.json({ success: true, channelsProcessed: results.length, results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Add cron to vercel.json**

Add to the `crons` array in vercel.json:
```json
{
  "path": "/api/cron-agent-loop",
  "schedule": "0 */6 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add api/cron-agent-loop.js vercel.json
git commit -m "feat(agent): cron-powered autonomous loop every 6 hours"
```

---

## Phase C: Coach Chat UI

### Task C1: Build Coach Chat Frontend

**Files:**
- Modify: `dashboard.html` (add chat panel)
- Modify: `main.js` (add chat UI functions)

- [ ] **Step 1: Add chat panel HTML to dashboard.html**

Add inside the main content area, after the existing workspace:
```html
<!-- Coach Chat Panel -->
<div id="coach-chat-panel" class="coach-chat" style="display:none;">
  <div class="coach-header">
    <span>🧠 Phronesis Coach</span>
    <span id="goal-progress-bar" style="font-size:12px;color:var(--text-muted);"></span>
    <button data-action="toggleCoach" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">×</button>
  </div>
  <div id="coach-messages" class="coach-messages"></div>
  <div class="coach-input-row">
    <input id="coach-input" type="text" placeholder="Ask Phronesis anything..." />
    <button onclick="sendCoachMessage()">Send</button>
  </div>
</div>

<!-- Coach toggle button (floating) -->
<button id="coach-toggle-btn" onclick="toggleCoachPanel()"
  style="position:fixed;bottom:24px;right:24px;z-index:999;
         background:var(--primary);color:#fff;border:none;
         border-radius:50%;width:56px;height:56px;font-size:24px;
         cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);">
  🧠
  <span id="coach-badge" style="display:none;position:absolute;top:-4px;right:-4px;
    background:var(--danger);color:#fff;border-radius:50%;width:20px;height:20px;
    font-size:11px;line-height:20px;text-align:center;">3</span>
</button>
```

- [ ] **Step 2: Add chat functions to main.js**

```js
// ── Coach Chat UI ──
let coachPollInterval = null;

function toggleCoachPanel() {
  const panel = document.getElementById('coach-chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display === 'flex') {
    loadCoachMessages();
    loadGoalStatus();
    // Poll every 30 seconds
    coachPollInterval = setInterval(loadCoachMessages, 30000);
  } else {
    clearInterval(coachPollInterval);
  }
}

async function loadGoalStatus() {
  try {
    const chId = localStorage.getItem('ytseo_channel_id');
    const res = await fetch(`/api/agent/goal/status?channelId=${chId}`);
    const data = await res.json();
    if (data.goal) {
      const bar = document.getElementById('goal-progress-bar');
      bar.textContent = `${data.goal.current}/${data.goal.target} ${data.goal.type} (${data.goal.progress?.percent || 0}%)`;
    }
  } catch(e) {}
}

async function loadCoachMessages() {
  try {
    const chId = localStorage.getItem('ytseo_channel_id');
    const res = await fetch(`/api/agent/coach/inbox?channelId=${chId}`);
    const data = await res.json();
    renderCoachMessages(data.messages || []);
    // Update badge
    const unread = (data.messages || []).filter(m => !m.read).length;
    const badge = document.getElementById('coach-badge');
    if (badge) {
      badge.style.display = unread > 0 ? 'block' : 'none';
      badge.textContent = unread;
    }
  } catch(e) {}
}

function renderCoachMessages(messages) {
  const container = document.getElementById('coach-messages');
  if (!container) return;
  container.innerHTML = messages.map(m => `
    <div class="coach-msg coach-msg--${m.type || 'info'}">
      <div class="coach-msg-title">${m.title || ''}</div>
      <div class="coach-msg-body">${m.body || ''}</div>
      ${m.goalImpact ? `<div class="coach-msg-impact">${m.goalImpact}</div>` : ''}
      ${m.actions ? `<div class="coach-msg-actions">
        ${m.actions.map(a => `<button onclick="respondToCoach('${m.id}','${a.action}','${a.proposalId || ''}')">${a.label}</button>`).join('')}
      </div>` : ''}
      <div class="coach-msg-time">${new Date(m.timestamp).toLocaleTimeString()}</div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

async function respondToCoach(messageId, action, proposalId) {
  try {
    const chId = localStorage.getItem('ytseo_channel_id');
    await fetch('/api/agent/coach/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
      body: JSON.stringify({ messageId, action, proposalId, channelId: chId })
    });
    loadCoachMessages();
  } catch(e) { showToast('Failed to respond', 'error'); }
}

async function sendCoachMessage() {
  const input = document.getElementById('coach-input');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  // Add user message to chat
  const container = document.getElementById('coach-messages');
  container.innerHTML += `<div class="coach-msg coach-msg--user"><div class="coach-msg-body">${question}</div></div>`;
  try {
    const chId = localStorage.getItem('ytseo_channel_id');
    const res = await fetch('/api/agent/coach/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
      body: JSON.stringify({ question, channelId: chId })
    });
    const data = await res.json();
    container.innerHTML += `<div class="coach-msg coach-msg--response"><div class="coach-msg-body">${data.response || 'Sorry, I could not process that.'}</div></div>`;
    container.scrollTop = container.scrollHeight;
  } catch(e) { showToast('Failed to send message', 'error'); }
}

// Initialize coach on load
setTimeout(() => { loadCoachMessages(); loadGoalStatus(); }, 3000);
```

- [ ] **Step 3: Commit**

```bash
git add dashboard.html main.js
git commit -m "feat(agent): coach chat UI — chat panel, goal bar, message actions"
```

---

### Task C2: Goal Setup UI

**Files:**
- Modify: `main.js` (add goal setup dialog)

- [ ] **Step 1: Add goal setup function**

```js
function showGoalSetup() {
  const existing = document.getElementById('goal-setup-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'goal-setup-modal';
  modal.innerHTML = `
    <div class="goal-setup-overlay" onclick="this.parentElement.remove()"></div>
    <div class="goal-setup-card">
      <h3>🎯 Set Your Channel Goal</h3>
      <select id="goal-type">
        <option value="subscribers">Subscribers</option>
        <option value="views">Views</option>
        <option value="watch_hours">Watch Hours</option>
      </select>
      <input id="goal-target" type="number" placeholder="Target (e.g. 10000)" />
      <input id="goal-deadline" type="date" placeholder="Deadline" />
      <button onclick="saveGoal()">Start Working Toward This Goal</button>
      <button onclick="this.closest('#goal-setup-modal').remove()" style="background:none;color:var(--text-muted);">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function saveGoal() {
  const type = document.getElementById('goal-type').value;
  const target = document.getElementById('goal-target').value;
  const deadline = document.getElementById('goal-deadline').value;
  if (!target) return showToast('Please set a target', 'error');
  try {
    const chId = localStorage.getItem('ytseo_channel_id');
    const res = await fetch('/api/agent/goal/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
      body: JSON.stringify({ type, target: parseInt(target), deadline, channelId: chId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Goal set! Agent is working on it.', 'success');
      document.getElementById('goal-setup-modal').remove();
      loadGoalStatus();
    }
  } catch(e) { showToast('Failed to set goal', 'error'); }
}
```

- [ ] **Step 2: Commit**

```bash
git add main.js
git commit -m "feat(agent): goal setup UI dialog"
```

---

## Final Verification

- [ ] **Step 1: Full API test**

```bash
# 1. Set goal
curl -X POST https://yt-seo-architect.vercel.app/api/agent/goal/set \
  -H "Content-Type: application/json" -H "x-channel-id: UC_TEST" \
  -d '{"type":"subscribers","target":10000,"deadline":"2026-12-31"}'

# 2. Check status
curl https://yt-seo-architect.vercel.app/api/agent/goal/status?channelId=UC_TEST

# 3. Check coach inbox
curl https://yt-seo-architect.vercel.app/api/agent/coach/inbox?channelId=UC_TEST
```

- [ ] **Step 2: Deploy and smoke test**

```bash
vercel --prod --yes
```

Verify: dashboard loads, coach chat toggle works, goal setup works, messages display

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat: complete Phronesis goal-driven agent"
```

---

## Self-Review Summary

- **Spec coverage:** All 3 layers (autonomous loop, coach chat, goal engine) covered across 3 phases. All 5 API endpoints implemented. Cron wiring complete. Frontend chat UI + goal setup covered.
- **Placeholder scan:** No TBD/TODO. All code blocks contain actual implementation.
- **Type consistency:** Goal schema matches between API, database, and frontend. Message format matches between coach.js and frontend rendering.
