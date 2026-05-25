# Phronesis Chat-Agent Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate "Ask Phronesis" coach chat with the autonomous agent pipeline so user commands trigger scans, optimizations, and goal tracking — backed by DB-persisted goals and conversation memory.

**Architecture:** Add function calling (via prompt engineering + JSON response format) to the coach AI. A new `tool-executor.js` bridges tool selections to existing orchestrator pipeline stages. Goals migrate from in-memory Map to a new `goals` DB table. Async jobs track via a new `agent_jobs` table. Frontend polls for job completion.

**Tech Stack:** Groq (llama-3.1-8b-instant) / Gemini 2.0 Flash, Express 5, Drizzle ORM, Neon Postgres, Vanilla JS

---

## File Structure

| File | Responsibility |
|---|---|
| **NEW: `api/agent-core/tool-executor.js`** | Maps tool names → async pipeline stages. Handles instant vs. async dispatch, job creation/tracking, result formatting. |
| **MODIFY: `api/agent-core/goal-engine.js`** | Replace in-memory `goalStore` Map with DB reads/writes via Neon Postgres `goals` table. |
| **MODIFY: `api/agent-core/coach.js`** | Add function calling prompt, wire tool executor, persist conversation to `coach_memory` table. |
| **MODIFY: `api/cron-agent-loop.js`** | Read goals from DB `goals` table instead of in-memory. |
| **MODIFY: `api/index.js`** | Add `GET /api/agent/coach/job/{id}`, remove duplicate `POST /api/agent/goal`. |
| **MODIFY: `src/database/schema.js`** | Add `goals` and `agentJobs` table definitions. |
| **MODIFY: `src/database/services.js`** | Add CRUD methods: `upsertGoal`, `getGoal`, `createJob`, `getJob`, `updateJob`. |
| **MODIFY: `main.js`** | Job polling loop, progress display in chat, wire coach memory to Phronesis chat panel. |

---

### Task 1: DB Schema — goals + agent_jobs tables

**Files:**
- Modify: `src/database/schema.js` (append after `scanResults` table, before `export` statements)
- Modify: `src/database/services.js` (append new methods)
- Modify: `api/index.js` (add migration SQL)

- [ ] **Step 1: Add `goals` and `agentJobs` table definitions to schema.js**

Add these exports at the end of `src/database/schema.js`, before the last line:

```javascript
// Goal Engine — persisted goals (replaces in-memory goalStore Map)
export const goals = pgTable('goals', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull().unique(), // one active goal per channel
  type: text('type').notNull(), // subscribers, views, watch_hours
  target: integer('target').notNull(),
  current: integer('current').default(0),
  initialCurrent: integer('initial_current').default(0),
  deadline: text('deadline'), // ISO date string or null
  status: text('status').default('active'), // active, completed, abandoned
  phases: jsonb('phases').default([]),
  progress: jsonb('progress').default({}), // { percent, remaining, weeklyRate, eta }
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agent Jobs — async job tracking for chat-triggered agent actions
export const agentJobs = pgTable('agent_jobs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull(),
  tool: text('tool').notNull(), // scan_channel, optimize_video, apply_fixes
  status: text('status').default('queued'), // queued, running, completed, failed
  progress: integer('progress').default(0), // 0-100
  result: jsonb('result').default({}), // tool-specific output
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});
```

- [ ] **Step 2: Add CRUD methods for goals and jobs to services.js**

Add these methods to `src/database/services.js`, after the existing `clearCoachMemory` method:

```javascript
// ── Goal Engine CRUD ──
export async function upsertGoal(channelId, goalData) {
  const s = await import('./schema.js');
  const { eq } = await import('drizzle-orm');
  const existing = await db.select().from(s.goals).where(eq(s.goals.channelId, channelId)).limit(1);
  if (existing.length > 0) {
    await db.update(s.goals).set({
      ...goalData,
      updatedAt: new Date()
    }).where(eq(s.goals.channelId, channelId));
  } else {
    await db.insert(s.goals).values({ channelId, ...goalData });
  }
}

export async function getGoal(channelId) {
  const s = await import('./schema.js');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(s.goals).where(eq(s.goals.channelId, channelId)).limit(1);
  return rows[0] || null;
}

export async function deleteGoal(channelId) {
  const s = await import('./schema.js');
  const { eq } = await import('drizzle-orm');
  await db.delete(s.goals).where(eq(s.goals.channelId, channelId));
}

// ── Agent Job CRUD ──
export async function createJob(channelId, tool) {
  const s = await import('./schema.js');
  const jobs = await db.insert(s.agentJobs).values({ channelId, tool, status: 'queued' }).returning();
  return jobs[0];
}

export async function getJob(jobId) {
  const s = await import('./schema.js');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(s.agentJobs).where(eq(s.agentJobs.id, jobId)).limit(1);
  return rows[0] || null;
}

export async function updateJob(jobId, updates) {
  const s = await import('./schema.js');
  const { eq } = await import('drizzle-orm');
  await db.update(s.agentJobs).set(updates).where(eq(s.agentJobs.id, jobId));
}

export async function getActiveJob(channelId, tool) {
  const s = await import('./schema.js');
  const { eq, and, inArray } = await import('drizzle-orm');
  const rows = await db.select().from(s.agentJobs).where(and(
    eq(s.agentJobs.channelId, channelId),
    eq(s.agentJobs.tool, tool),
    inArray(s.agentJobs.status, ['queued', 'running'])
  )).limit(1);
  return rows[0] || null;
}
```

- [ ] **Step 3: Add migration SQL to api/index.js**

In `api/index.js`, find the existing schema creation block (where `agent_settings`, `coach_memory` tables are created via `await sql\`...\``) and add these table creation statements nearby:

```javascript
// Create goals table (if not exists)
try {
  await sql`CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    target INTEGER NOT NULL,
    current INTEGER DEFAULT 0,
    initial_current INTEGER DEFAULT 0,
    deadline TEXT,
    status TEXT DEFAULT 'active',
    phases JSONB DEFAULT '[]'::jsonb,
    progress JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`;
  // Migrate existing goals from agent_settings
  await sql`
    INSERT INTO goals (id, channel_id, type, target, status, created_at, updated_at)
    SELECT gen_random_uuid()::text, channel_id, 'subscribers', 
      CASE WHEN goal ~ '^\d+$' THEN goal::integer ELSE 1000 END,
      'active', NOW(), NOW()
    FROM agent_settings WHERE goal IS NOT NULL AND goal != ''
    ON CONFLICT (channel_id) DO NOTHING
  `;
} catch (e) { console.warn('[Migration] goals table:', e.message); }

// Create agent_jobs table (if not exists)
try {
  await sql`CREATE TABLE IF NOT EXISTS agent_jobs (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    tool TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    result JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
  )`;
} catch (e) { console.warn('[Migration] agent_jobs table:', e.message); }
```

- [ ] **Step 4: Commit**

```bash
git add src/database/schema.js src/database/services.js api/index.js
git commit -m "feat: add goals + agent_jobs DB tables and migration"
```

---

### Task 2: Goal Engine — DB-backed persistence

**Files:**
- Modify: `api/agent-core/goal-engine.js`

- [ ] **Step 1: Rewrite goal-engine.js to use DB instead of in-memory Map**

Replace the entire content of `api/agent-core/goal-engine.js`:

```javascript
// api/agent-core/goal-engine.js
// Goal lifecycle: set → plan → track → adapt
// Persisted to Neon Postgres `goals` table

export async function setGoal({ channelId, type, target, deadline }) {
  const current = await getCurrentMetric(channelId, type);
  const goal = {
    channelId,
    type,
    target: parseInt(target),
    current,
    initialCurrent: current,
    deadline: deadline || null,
    status: 'active',
    phases: [],
    progress: {},
    updatedAt: new Date()
  };

  // Generate plan using existing planner
  try {
    const { generatePlan } = await import('./planner.js');
    const plan = await generatePlan(
      'goal_' + Date.now(),
      'Grow channel ' + type + ' to ' + target + (deadline ? ' by ' + deadline : ''),
      'channel-growth'
    );
    goal.phases = (plan.phases || []).map(p => ({
      ...p,
      status: 'pending',
      estimatedImpact: estimatePhaseImpact(p, type, parseInt(target))
    }));
  } catch(e) {
    goal.phases = getFallbackPhases(goal);
  }

  // Persist to DB
  const { default: dbService } = await import('../../src/database/services.js');
  await dbService.upsertGoal(channelId, goal);

  return goal;
}

function estimatePhaseImpact(phase, goalType, target) {
  const weights = { AUDIT: 0.1, OPTIMIZE: 0.4, GROWTH: 0.3, COMPOUND: 0.2 };
  const name = (phase.name || '').toUpperCase();
  const key = Object.keys(weights).find(k => name.includes(k));
  return '+' + Math.round(target * (key ? weights[key] : 0.2)) + ' ' + goalType;
}

function getFallbackPhases(goal) {
  return [
    { phase: 1, name: 'AUDIT', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.1) + ' ' + goal.type },
    { phase: 2, name: 'OPTIMIZE', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.4) + ' ' + goal.type },
    { phase: 3, name: 'GROWTH', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.3) + ' ' + goal.type },
    { phase: 4, name: 'COMPOUND', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.2) + ' ' + goal.type }
  ];
}

async function getCurrentMetric(channelId, type) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const users = await dbService.getAllUsers(100).catch(() => []);
    const user = users.find(u => u.channelId === channelId);
    if (!user) return 0;
    if (type === 'subscribers') return parseInt(user.subscriberCount) || 0;
    if (type === 'views') return parseInt(user.viewCount) || 0;
    if (type === 'watch_hours') return parseInt(user.watchHours) || 0;
    return 0;
  } catch(e) { return 0; }
}

export async function getGoalStatus(channelId) {
  const { default: dbService } = await import('../../src/database/services.js');
  const goal = await dbService.getGoal(channelId);
  if (!goal || goal.status !== 'active') return null;

  // Update current metric
  const current = await getCurrentMetric(channelId, goal.type);

  // Calculate progress
  const created = new Date(goal.createdAt);
  const weeks = Math.max(0.1, (Date.now() - created.getTime()) / (7 * 86400000));
  const initial = goal.initialCurrent || 0;
  const weeklyRate = Math.round((current - initial) / weeks);

  const progress = {
    percent: goal.target > 0 ? Math.round((current / goal.target) * 100) : 0,
    remaining: Math.max(0, goal.target - current),
    weeklyRate
  };

  if (weeklyRate > 0 && progress.remaining > 0) {
    const weeksLeft = progress.remaining / weeklyRate;
    progress.eta = new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().split('T')[0];
  }

  // Persist updated current + progress
  await dbService.upsertGoal(channelId, { current, progress, updatedAt: new Date() });

  return { ...goal, current, progress };
}
```

- [ ] **Step 2: Commit**

```bash
git add api/agent-core/goal-engine.js
git commit -m "refactor: goal engine uses DB persistence instead of in-memory Map"
```

---

### Task 3: Tool Executor — bridge chat commands to agent pipeline

**Files:**
- Create: `api/agent-core/tool-executor.js`

- [ ] **Step 1: Create tool-executor.js**

```javascript
// api/agent-core/tool-executor.js
// Bridges AI function calling → agent pipeline stages
// Handles instant queries directly, async ops via agent_jobs table

/**
 * Execute a tool selected by the AI function calling system.
 * @param {string} tool - Tool name from tool registry
 * @param {object} args - Arguments extracted by AI
 * @param {string} channelId
 * @returns {{ instant: true, response: string } | { instant: false, jobId: string, message: string }}
 */
export async function executeTool(tool, args, channelId) {
  switch (tool) {

    // ── Instant tools ──
    case 'goal_status': {
      const { getGoalStatus } = await import('./goal-engine.js');
      const goal = await getGoalStatus(channelId);
      if (!goal) return { instant: true, response: 'You haven\'t set a growth goal yet. Say something like "I want 1000 subscribers" and I\'ll help you get there.' };
      const eta = goal.progress?.eta ? ` ETA: ${goal.progress.eta}.` : '';
      return { instant: true, response: `Your goal: ${goal.current.toLocaleString()}/${goal.target.toLocaleString()} ${goal.type} (${goal.progress?.percent || 0}%). Weekly rate: +${goal.progress?.weeklyRate || 0}.${eta}` };
    }

    case 'set_goal': {
      if (!args.type || !args.target) return { instant: true, response: 'I need to know what type of goal (subscribers, views, or watch_hours) and the target number. For example: "I want 1000 subscribers by December".' };
      const { setGoal } = await import('./goal-engine.js');
      const goal = await setGoal({ channelId, type: args.type, target: parseInt(args.target), deadline: args.deadline || null });
      return { instant: true, response: `Goal set! Targeting ${parseInt(args.target).toLocaleString()} ${args.type}${args.deadline ? ' by ' + args.deadline : ''}. Current: ${goal.initialCurrent.toLocaleString()}. I\'m on it.` };
    }

    case 'get_inbox': {
      const { default: dbService } = await import('../../src/database/services.js');
      const s = await import('../../src/database/schema.js');
      const { eq } = await import('drizzle-orm');
      const items = await dbService.db.select().from(s.optimizationQueue).where(eq(s.optimizationQueue.status, 'pending')).limit(5);
      if (!items.length) return { instant: true, response: 'Your inbox is empty — no pending optimizations. Try scanning your channel first.' };
      const summary = items.map(i => `• ${(i.videoTitle || 'Untitled').substring(0, 50)}: ${i.actionType || 'optimization'} (${i.confidence || '?'}% confidence)`).join('\n');
      return { instant: true, response: `You have ${items.length} pending proposal(s):\n${summary}\n\nOpen the Command Inbox in the War Room to review and apply them.` };
    }

    case 'get_activity': {
      const { default: dbService } = await import('../../src/database/services.js');
      const s = await import('../../src/database/schema.js');
      const { desc } = await import('drizzle-orm');
      const limit = Math.min(args.limit || 5, 10);
      const logs = await dbService.db.select().from(s.agentActivityLogs).orderBy(desc(s.agentActivityLogs.createdAt)).limit(limit);
      if (!logs.length) return { instant: true, response: 'No recent agent activity. Try scanning your channel to get started.' };
      const recent = logs.map(l => `[${new Date(l.createdAt).toLocaleTimeString()}] ${l.agentName}: ${(l.actionTaken || '').substring(0, 80)}`).join('\n');
      return { instant: true, response: `Recent activity (last ${logs.length}):\n${recent}` };
    }

    // ── Async tools ──
    case 'scan_channel': {
      const { default: dbService } = await import('../../src/database/services.js');
      // Check for existing active job
      const existing = await dbService.getActiveJob(channelId, 'scan_channel');
      if (existing) return { instant: true, response: `A channel scan is already running (job #${existing.id.substring(0, 8)}). I\'ll show results when it\'s done.` };
      const job = await dbService.createJob(channelId, 'scan_channel');
      // Launch async
      runScanJob(job.id, channelId, args);
      return { instant: false, jobId: job.id, message: `Scanning your channel now... I\'ll update you when I find optimization opportunities. (Job #${job.id.substring(0, 8)})` };
    }

    case 'optimize_video': {
      const videoRef = args.videoId || args.title;
      if (!videoRef) return { instant: true, response: 'Which video should I optimize? Tell me the title or paste the video ID.' };
      const { default: dbService } = await import('../../src/database/services.js');
      const existing = await dbService.getActiveJob(channelId, 'optimize_video');
      if (existing) return { instant: true, response: `An optimization job is already running (job #${existing.id.substring(0, 8)}).` };
      const job = await dbService.createJob(channelId, 'optimize_video');
      runOptimizeJob(job.id, channelId, videoRef);
      return { instant: false, jobId: job.id, message: `Analyzing "${typeof videoRef === 'string' ? videoRef.substring(0, 60) : videoRef}" and generating optimizations... (Job #${job.id.substring(0, 8)})` };
    }

    case 'apply_fixes': {
      const { default: dbService } = await import('../../src/database/services.js');
      const existing = await dbService.getActiveJob(channelId, 'apply_fixes');
      if (existing) return { instant: true, response: `An apply job is already running (job #${existing.id.substring(0, 8)}).` };
      const job = await dbService.createJob(channelId, 'apply_fixes');
      runApplyJob(job.id, channelId);
      return { instant: false, jobId: job.id, message: `Applying approved optimizations to your channel... (Job #${job.id.substring(0, 8)})` };
    }

    default:
      return null; // Let coach fall back to chat response
  }
}

// ── Async Job Runners (fire-and-forget, update DB) ──

async function runScanJob(jobId, channelId, args) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 10 });
    const { runAutonomousLoop } = await import('../agent-workflows/orchestrator.js');
    const result = await runAutonomousLoop(channelId);
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { proposals: result.totalProposals || 0, queueItems: result.queueItemsCreated || 0, status: result.status }
    });
    // Push completion message to coach inbox
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Channel scan complete',
      body: `Found ${result.totalProposals || 0} optimization opportunities. ${result.queueItemsCreated || 0} proposals in your inbox.`,
      actions: [{ label: 'View Inbox', action: 'view_inbox' }, { label: 'Dismiss', action: 'dismiss' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'error',
      title: '❌ Scan failed',
      body: e.message.substring(0, 200),
      actions: [{ label: 'Retry', action: 'retry_scan' }]
    }));
  }
}

async function runOptimizeJob(jobId, channelId, videoRef) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 10 });
    // Run targeted scan for the specific video
    const { runAutonomousLoop } = await import('../agent-workflows/orchestrator.js');
    const result = await runAutonomousLoop(channelId);
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { proposals: result.totalProposals || 0, queueItems: result.queueItemsCreated || 0 }
    });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Optimization analysis complete',
      body: `Generated ${result.totalProposals || 0} proposals. Check your inbox.`,
      actions: [{ label: 'View Inbox', action: 'view_inbox' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() });
  }
}

async function runApplyJob(jobId, channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 20 });
    const { autoApplySweep } = await import('../agent-workflows/orchestrator.js');
    const result = await autoApplySweep();
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { applied: result.applied || 0, failed: result.failed || 0 }
    });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Optimizations applied',
      body: `Applied ${result.applied || 0} changes to YouTube. ${result.failed ? result.failed + ' failed.' : ''}`,
      actions: [{ label: 'Dismiss', action: 'dismiss' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/agent-core/tool-executor.js
git commit -m "feat: tool executor bridges chat AI to agent pipeline"
```

---

### Task 4: Coach — function calling + tool dispatch + conversation persistence

**Files:**
- Modify: `api/agent-core/coach.js`

- [ ] **Step 1: Add function calling system prompt and tool dispatch to handleQuestion**

In `api/agent-core/coach.js`, replace the `handleQuestion` function's system prompt and response handling. Find the `var systemPrompt = ...` block and the `var answer = await askAI(...)` call, then replace them with the function-calling version.

Replace the section from `var systemPrompt = ...` through the end of the `try` block's success path (just before `} catch(e) {`):

```javascript
    var toolDefinitions = `AVAILABLE TOOLS — You MUST use one of these when the user's request matches. Return ONLY valid JSON: {"tool":"tool_name","args":{},"message":"brief confirmation message"}

1. goal_status — Check current goal progress. No args needed.
2. set_goal — Set a new goal. Args: type (subscribers/views/watch_hours), target (number), deadline (optional date string).
3. scan_channel — Scan channel for underperforming videos. Args: videoId (optional, to target one video).
4. get_inbox — Show pending optimization proposals. No args needed.
5. apply_fixes — Apply approved optimizations to YouTube. Args: autoApply (boolean, default true).
6. optimize_video — Optimize a specific video. Args: videoId (string) or title (string).
7. get_activity — Show recent agent activity. Args: limit (number, default 5).
8. chat — None of the above fits. Args: message (your conversational response).

RULES:
- If the user asks about their goal or progress → use goal_status
- If the user wants to scan, find issues, check for problems → use scan_channel
- If the user wants to see proposals, inbox, pending items → use get_inbox
- If the user wants to apply, push, or fix things → use apply_fixes
- If the user asks to optimize a specific video → use optimize_video
- If the user asks what's been happening, recent activity → use get_activity
- If the user wants to set a goal → use set_goal
- If none of the above clearly match → use chat with a helpful conversational response
- If the request is ambiguous, use chat and ask a clarifying question`;

    var systemPrompt = `You are Phronesis, an AI YouTube SEO coach in YT SEO Architect. You help creators grow their channels through SEO optimization and strategic guidance.

GOAL CONTEXT:
${goalContext || 'No active goal set.'}

AGENT CONTEXT (recent activity):
${agentCtx || 'No recent agent activity.'}
${conversationContext}

${toolDefinitions}

Return ONLY valid JSON. No markdown, no code blocks, no extra text. Just the JSON object.`;

    var { askAI } = await import('../_lib/ai-provider.js');
    var rawAnswer = await askAI(systemPrompt, question, { temperature: 0.3, maxTokens: 500, forceJson: true });

    // Parse the AI response
    var parsed;
    try {
      var cleaned = (rawAnswer || '').replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      // If JSON parsing fails, treat as chat
      parsed = { tool: 'chat', args: { message: rawAnswer || fallbackResponse(goal, question) } };
    }

    // Dispatch to tool executor
    var { executeTool } = await import('./tool-executor.js');
    var toolResult = await executeTool(parsed.tool || 'chat', parsed.args || {}, channelId);

    var finalAnswer;
    if (toolResult && toolResult.instant) {
      finalAnswer = toolResult.response;
    } else if (toolResult && !toolResult.instant) {
      finalAnswer = toolResult.message;
      // Store jobId in the assistant message for frontend polling
    } else {
      // Fallback: use the message from chat tool or raw response
      finalAnswer = (parsed.args && parsed.args.message) || parsed.message || rawAnswer || fallbackResponse(goal, question);
    }

    // Store assistant response in history
    if (finalAnswer && typeof finalAnswer === 'string') {
      var trimmed = finalAnswer.trim();
      var historyEntry = { role: 'assistant', content: trimmed };
      if (toolResult && toolResult.jobId) {
        historyEntry.jobId = toolResult.jobId;
      }
      history.push(historyEntry);
      // Trim history if too long
      if (history.length > MAX_HISTORY * 2) {
        history.splice(0, history.length - MAX_HISTORY * 2);
      }
      // Persist conversation to coach_memory
      persistConversationMemory(channelId, history).catch(() => {});
      return trimmed;
    }
```

- [ ] **Step 2: Add conversation persistence function**

Add this function at the end of `api/agent-core/coach.js`:

```javascript
async function persistConversationMemory(channelId, history) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const lastMessages = history.slice(-6); // last 3 exchanges
    const extracted = await extractKeyFacts(lastMessages);
    await dbService.upsertCoachMemory(channelId, {
      lastConversation: extracted.lastConversation || 'Coaching session',
      contentGoals: extracted.contentGoals || [],
      focusKeywords: extracted.focusKeywords || [],
      painPoints: extracted.painPoints || [],
      wins: extracted.wins || []
    });
  } catch(e) { /* best-effort */ }
}

async function extractKeyFacts(messages) {
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    const transcript = messages.map(m => (m.role === 'user' ? 'Creator' : 'Coach') + ': ' + m.content).join('\n');
    const raw = await askAI(
      'Extract key facts from this coaching conversation. Return ONLY valid JSON.',
      `Extract facts:\n\n${transcript.substring(0, 2000)}\n\nJSON: {"contentGoals":[],"focusKeywords":[],"painPoints":[],"wins":[],"lastConversation":"one sentence summary"}`,
      { temperature: 0.3, maxTokens: 400, forceJson: true }
    );
    return JSON.parse((raw || '{}').replace(/```json|```/g, '').trim());
  } catch(e) { return { lastConversation: 'Coaching session' }; }
}
```

- [ ] **Step 3: Commit**

```bash
git add api/agent-core/coach.js
git commit -m "feat: coach gains function calling + conversation persistence"
```

---

### Task 5: Cron Loop — read goals from DB

**Files:**
- Modify: `api/cron-agent-loop.js`

- [ ] **Step 1: Replace in-memory goal access with DB goal access**

In `api/cron-agent-loop.js`, the cron currently calls `getGoalStatus()` from `goal-engine.js` which now reads from DB. No structural changes needed — the import already works. Verify that line ~18-20 imports `getGoalStatus` and uses it. If it does, this task requires no code changes. The `getGoalStatus` function in Task 2 already reads from DB.

Confirm by reading the file to verify. If the import chain is: `cron-agent-loop.js` → `getGoalStatus()` from `goal-engine.js` → `dbService.getGoal()` (DB), then this task is a no-op verification.

- [ ] **Step 2: Verify and commit**

```bash
git add api/cron-agent-loop.js
git commit -m "chore: verify cron loop reads goals from DB (no changes needed)"
```

---

### Task 6: API Endpoints — job status + deprecate duplicate goal

**Files:**
- Modify: `api/index.js`

- [ ] **Step 1: Add GET /api/agent/coach/job/:id endpoint**

Find the existing coach endpoints in `api/index.js` (around line 1280-1305) and add the job status endpoint after them:

```javascript
app.get('/api/agent/coach/job/:id', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const job = await dbService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: { id: job.id, tool: job.tool, status: job.status, progress: job.progress, result: job.result, error: job.error } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Remove the duplicate POST /api/agent/goal endpoint**

Find `POST /api/agent/goal` in the orchestrator router (in `api/index.js` around line 1050-1100 or in the router import chain). Remove or comment out the duplicate goal endpoint, leaving only `POST /api/agent/goal/set` (which goes through `goal-engine.js`).

If the orchestrator's `/goal` endpoint is imported via `app.use('/api/agent', orchestratorRouter)`, find it in `api/agent-workflows/orchestrator.js` and mark it deprecated — redirect to the goal-engine path:

```javascript
// In orchestrator.js POST /goal — replace with redirect
router.post('/goal', async (req, res) => {
  // Deprecated — use /api/agent/goal/set instead
  res.json({ deprecated: true, message: 'Use POST /api/agent/goal/set instead' });
});
```

- [ ] **Step 3: Commit**

```bash
git add api/index.js api/agent-workflows/orchestrator.js
git commit -m "feat: add job status endpoint, deprecate duplicate goal endpoint"
```

---

### Task 7: Frontend — job polling, progress display, coach memory

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Wire coach memory to the Phronesis chat panel**

In `main.js`, find `sendCoachQuestion()` (around line 15621). After the AI response is displayed, add coach memory save and load calls. Also add a `_phronesisChatHistory` array (similar to `_architectChatHistory`).

Add this variable near the top of the file (around line 15519, before `toggleCoachChat`):

```javascript
var _phronesisChatHistory = [];
```

Then modify `sendCoachQuestion()` to track history and save memory. Find this block at the end of `sendCoachQuestion()`:

```javascript
    container.innerHTML += '<div class="coach-msg coach-msg--response"><div class="coach-msg-body">' + (data.response || 'Sorry, I could not process that.') + '</div></div>';
    container.scrollTop = container.scrollHeight;
  } catch(e) {}
```

Replace with:

```javascript
    var responseText = data.response || 'Sorry, I could not process that.';
    container.innerHTML += '<div class="coach-msg coach-msg--response"><div class="coach-msg-body">' + responseText + '</div></div>';
    container.scrollTop = container.scrollHeight;

    // Track history
    _phronesisChatHistory.push({ role: 'user', content: question });
    _phronesisChatHistory.push({ role: 'assistant', content: responseText });
    if (_phronesisChatHistory.length > 20) _phronesisChatHistory = _phronesisChatHistory.slice(-20);

    // Save coach memory in background
    savePhronesisCoachMemory();

    // If response contains a jobId pattern, start polling
    var jobMatch = responseText.match(/Job #([a-z0-9]+)/i);
    if (jobMatch) {
      pollJobStatus(jobMatch[1], container);
    }
  } catch(e) {
    container.innerHTML += '<div class="coach-msg coach-msg--error"><div class="coach-msg-body">Error: ' + e.message + '</div></div>';
  }
```

- [ ] **Step 2: Add savePhronesisCoachMemory and pollJobStatus functions**

Add these new functions after `sendCoachQuestion`:

```javascript
async function savePhronesisCoachMemory() {
  if (!_phronesisChatHistory || _phronesisChatHistory.length < 2) return;
  try {
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    await fetch('/api/coach-memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': channelId },
      body: JSON.stringify({ conversation: _phronesisChatHistory.slice(-6), niche: 'General' })
    });
  } catch(e) { /* best-effort */ }
}
window.savePhronesisCoachMemory = savePhronesisCoachMemory;

var _activePollTimers = {};
function pollJobStatus(jobId, container) {
  if (_activePollTimers[jobId]) clearInterval(_activePollTimers[jobId]);
  var pollCount = 0;
  var maxPolls = 24; // 24 × 5s = 2 minutes max
  _activePollTimers[jobId] = setInterval(async function() {
    pollCount++;
    try {
      var res = await fetch('/api/agent/coach/job/' + jobId);
      var data = await res.json();
      if (!data.job) { clearInterval(_activePollTimers[jobId]); return; }
      if (data.job.status === 'completed') {
        clearInterval(_activePollTimers[jobId]);
        container.innerHTML += '<div class="coach-msg coach-msg--success"><div class="coach-msg-body">✅ Job complete! ' + (data.job.result?.proposals || 0) + ' proposals generated. Check your inbox.</div></div>';
        container.scrollTop = container.scrollHeight;
        // Refresh inbox messages
        loadCoachMessages();
      } else if (data.job.status === 'failed') {
        clearInterval(_activePollTimers[jobId]);
        container.innerHTML += '<div class="coach-msg coach-msg--error"><div class="coach-msg-body">❌ Job failed: ' + (data.job.error || 'Unknown error') + '</div></div>';
        container.scrollTop = container.scrollHeight;
      }
    } catch(e) { /* keep polling */ }
    if (pollCount >= maxPolls) {
      clearInterval(_activePollTimers[jobId]);
      container.innerHTML += '<div class="coach-msg coach-msg--warning"><div class="coach-msg-body">⏰ Job #' + jobId.substring(0, 8) + ' is taking longer than expected. Check your inbox shortly.</div></div>';
      container.scrollTop = container.scrollHeight;
    }
  }, 5000);
}
window.pollJobStatus = pollJobStatus;
```

- [ ] **Step 3: Load coach memory on Phronesis chat open**

In `toggleCoachChat()`, add a call to load coach memory when the panel opens. Find the `if (!isOpen)` block and add:

```javascript
  if (!isOpen) {
    loadCoachMessages();
    loadGoalBar();
    loadPhronesisCoachMemory(); // ADD THIS
    coachPollInterval = setInterval(function() {
      updateCoachBadge();
    }, 30000);
  }
```

Add the function:

```javascript
async function loadPhronesisCoachMemory() {
  try {
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    var res = await fetch('/api/coach-memory/memory', { headers: { 'x-channel-id': channelId } });
    var data = await res.json();
    if (data.hasMemory && data.memory) {
      var container = document.getElementById('coach-messages');
      if (container && data.memory.lastConversation) {
        // Show memory context as a subtle system message at top
        var existingSystem = container.querySelector('.coach-msg--memory');
        if (!existingSystem) {
          container.innerHTML = '<div class="coach-msg coach-msg--memory" style="font-size:11px;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border);margin-bottom:8px;">🧠 Memory: ' + data.memory.lastConversation + '</div>' + container.innerHTML;
        }
      }
    }
  } catch(e) { /* silent */ }
}
window.loadPhronesisCoachMemory = loadPhronesisCoachMemory;
```

- [ ] **Step 4: Commit**

```bash
git add main.js
git commit -m "feat: frontend job polling, progress display, coach memory wired to Phronesis chat"
```

---

### Task 8: Integration Test + Manual Smoke Test

**Files:**
- Modify: `tests/api.test.js` (or create new `tests/phronesis-integration.test.js`)

- [ ] **Step 1: Write integration test for the ask → tool dispatch flow**

```javascript
// tests/phronesis-integration.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// These tests mock the AI provider to avoid real API calls
// Run with: node --test tests/phronesis-integration.test.js

describe('Phronesis Integration', () => {

  describe('Goal Engine (DB-backed)', () => {
    it('should set and retrieve a goal', async () => {
      const { setGoal, getGoalStatus } = await import('../api/agent-core/goal-engine.js');
      const channelId = 'test-channel-' + Date.now();
      const goal = await setGoal({ channelId, type: 'subscribers', target: 1000, deadline: null });
      assert.ok(goal);
      assert.equal(goal.type, 'subscribers');
      assert.equal(goal.target, 1000);
      assert.equal(goal.status, 'active');
      // Verify it persists
      const retrieved = await getGoalStatus(channelId);
      assert.ok(retrieved);
      assert.equal(retrieved.type, 'subscribers');
    });

    it('should return null for channel with no goal', async () => {
      const { getGoalStatus } = await import('../api/agent-core/goal-engine.js');
      const result = await getGoalStatus('no-such-channel-' + Date.now());
      assert.equal(result, null);
    });
  });

  describe('Tool Executor', () => {
    it('should return goal status for goal_status tool', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const channelId = 'test-ts-' + Date.now();
      // Set a goal first
      const { setGoal } = await import('../api/agent-core/goal-engine.js');
      await setGoal({ channelId, type: 'subscribers', target: 1000, deadline: null });

      const result = await executeTool('goal_status', {}, channelId);
      assert.ok(result.instant);
      assert.ok(result.response.includes('subscribers'));
      assert.ok(result.response.includes('1000'));
    });

    it('should return null goal message for no goal', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const result = await executeTool('goal_status', {}, 'no-goal-' + Date.now());
      assert.ok(result.instant);
      assert.ok(result.response.includes('haven\'t set'));
    });

    it('should create a job for scan_channel', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const channelId = 'test-scan-' + Date.now();
      const result = await executeTool('scan_channel', {}, channelId);
      assert.equal(result.instant, false);
      assert.ok(result.jobId);
      assert.ok(result.message.includes('Scanning'));
    });
  });

  describe('Coach Function Calling', () => {
    it('should parse JSON tool response from AI format', async () => {
      // Test that JSON parsing handles various AI output formats
      const parseResponse = (raw) => {
        const cleaned = (raw || '').replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
      };
      // Clean JSON
      assert.deepEqual(parseResponse('{"tool":"goal_status","args":{},"message":"Checking..."}'), { tool: 'goal_status', args: {}, message: 'Checking...' });
      // JSON with code block wrapping
      assert.deepEqual(parseResponse('```json\n{"tool":"chat","args":{"message":"Hello"}}\n```'), { tool: 'chat', args: { message: 'Hello' } });
    });

    it('should fall back to chat when JSON parsing fails', async () => {
      const parseOrFallback = (raw) => {
        try {
          const cleaned = (raw || '').replace(/```json|```/g, '').trim();
          return JSON.parse(cleaned);
        } catch(e) {
          return { tool: 'chat', args: { message: raw || 'Sorry, I could not process that.' } };
        }
      };
      const result = parseOrFallback('Just a plain text response, no JSON');
      assert.equal(result.tool, 'chat');
      assert.ok(result.args.message.includes('plain text'));
    });
  });

  describe('Job Status Polling', () => {
    it('should return job by ID', async () => {
      const { default: dbService } = await import('../src/database/services.js');
      const job = await dbService.createJob('test-poll-' + Date.now(), 'scan_channel');
      const retrieved = await dbService.getJob(job.id);
      assert.ok(retrieved);
      assert.equal(retrieved.tool, 'scan_channel');
      assert.equal(retrieved.status, 'queued');
    });

    it('should update job status', async () => {
      const { default: dbService } = await import('../src/database/services.js');
      const job = await dbService.createJob('test-update-' + Date.now(), 'scan_channel');
      await dbService.updateJob(job.id, { status: 'running', progress: 50 });
      const updated = await dbService.getJob(job.id);
      assert.equal(updated.status, 'running');
      assert.equal(updated.progress, 50);
    });

    it('should return null for nonexistent job', async () => {
      const { default: dbService } = await import('../src/database/services.js');
      const job = await dbService.getJob('nonexistent-id');
      assert.equal(job, null);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 3: Manual smoke test checklist**

Follow the 8-step smoke test from the design spec (document in plan for the implementer):

1. Open dashboard → click "Phronesis Coach" button
2. Set a goal: "1000 subscribers"
3. Ask: "How am I doing?" → shows goal progress
4. Ask: "Scan my channel" → "Scanning..." then results in inbox
5. Ask: "Show my inbox" → lists proposals
6. Ask: "Apply all safe fixes" → queues auto-apply
7. Close and reopen browser → goal and memory persist
8. Trigger cron → autonomous scan still works with DB goal

- [ ] **Step 4: Commit**

```bash
git add tests/phronesis-integration.test.js
git commit -m "test: phronesis chat-agent integration tests"
```

---

## Summary

**8 tasks, ~8 commits.** Estimated effort: 2-3 hours.

| Task | Files | Scope |
|---|---|---|
| 1 | schema.js, services.js, index.js | DB tables + migration |
| 2 | goal-engine.js | DB-backed goal persistence |
| 3 | tool-executor.js (NEW) | Bridge AI → agent pipeline |
| 4 | coach.js | Function calling + memory |
| 5 | cron-agent-loop.js | Verify (likely no-op) |
| 6 | index.js, orchestrator.js | Job endpoint + deprecation |
| 7 | main.js | Frontend polling + memory |
| 8 | tests/*.js | Integration tests |

**Key decisions embedded in the plan:**
- Goals persist in new `goals` table with unique constraint on `channelId` (one active goal per channel)
- Function calling uses prompt engineering + `forceJson: true` (Groq doesn't have native tool calling)
- Async jobs use a lightweight `agent_jobs` table with frontend polling (no WebSockets needed)
- Conversation memory saves best-effort in background — non-blocking
- Duplicate `POST /api/agent/goal` endpoint deprecated, not deleted (backward compat)
