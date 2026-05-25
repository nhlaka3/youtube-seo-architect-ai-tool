# Design: Integrate Ask Phronesis with Phronesis Agent to Fulfill User Goals

**Date:** 2026-05-25  
**Status:** Approved  
**Approach:** Goal-First Architecture with Agent Tools (Option C + DB-persisted goals)

## Problem

The "Ask Phronesis" coach chat and the Phronesis autonomous agent pipeline operate as two partially-connected systems:

1. **Goal Engine** uses in-memory storage (`goalStore` Map) — goals are lost on server restart
2. **"Ask Phronesis" chat** returns AI-written advice but cannot trigger scans, proposals, or optimizations
3. **Coach Memory** endpoints exist but the frontend never calls them — no conversation persistence
4. **Two separate goal-setting paths** (`/api/agent/goal/set` → in-memory, `/api/agent/goal` → DB `agentSettings.goal`) that don't synchronize
5. **Cron loop progress summaries** read from in-memory goal that may be stale or null after restart

## Design

### Architecture

```
User Chat Input
       │
       ▼
POST /api/agent/coach/ask  (extended)
       │
       ▼
🧠 AI Function Calling (Groq → Gemini failover)
  • Intent detection → tool selection → argument extraction
       │
       ├── Instant tools (≤2s): goal_status, set_goal, get_inbox, get_activity, chat
       │       └── Direct DB read → format → response
       │
       └── Async tools (30-60s): scan_channel, optimize_video, apply_fixes
               └── Create job record → return jobId + "I'm on it"
                   Background: scan → score → propose → queue → coach inbox
```

### Components

| Component | Change |
|---|---|
| `api/agent-core/goal-engine.js` | Replace in-memory `goalStore` Map with DB reads/writes via Neon Postgres. Add `getGoal(channelId)` and `upsertGoal()` backed by a `goals` table. |
| `api/agent-core/coach.js` (`handleQuestion`) | Add function calling via prompt engineering (Groq/Gemini don't have native function calling like OpenAI). System prompt includes tool definitions + `forceJson: true`. AI returns `{tool, args, message}` JSON. Coach dispatches to tool executor, returns result or async jobId. |
| **NEW: `api/agent-core/tool-executor.js`** | Maps tool names → async pipeline stages. Handles instant vs. async dispatch, job tracking, and result formatting for chat display. |
| `api/agent-core/coach.js` (conversation) | Persist `conversationHistory` to DB-backed coach memory. Load on first message. |
| `api/coach-memory.js` | Wire frontend to call `POST /api/coach-memory/save` after each conversation exchange. Load on chat open. |
| `api/cron-agent-loop.js` | No structural change. Reads goals from DB instead of in-memory. |
| `api/agent-workflows/orchestrator.js` | No structural change. Tool executor reuses existing `runAutonomousLoop`, `autoApplySweep`, `fetchUnderperformingVideos`. |
| Frontend (`main.js`, `dashboard.html`) | Poll for async job completion every 5s. Show "scanning..." progress messages. Wire coach-memory save/load. |
| **NEW: `agent_jobs` DB table** | `id, channelId, tool, status (queued/running/completed/failed), progress%, result, error, createdAt, completedAt` |
| **Migration** | Existing `agentSettings.goal` column data migrates to new `goals` table. Duplicate `POST /api/agent/goal` endpoint removed — all goal operations go through `goal-engine.js`. |

### New DB Table: `goals`

Replaces in-memory `goalStore` Map. Columns: `id, channelId, type (subscribers/views/watch_hours), target, current, initialCurrent, deadline, status (active/completed/abandoned), phases (JSONB), createdAt, updatedAt`.

### Agent Tools (Function Definitions)

| Tool | Args | Type | Maps To |
|---|---|---|---|
| `goal_status` | — | Instant | `goal-engine.js` → `getGoalStatus()` |
| `set_goal` | `type, target, deadline` | Instant | `goal-engine.js` → `upsertGoal()` |
| `scan_channel` | `videoId?` (optional) | Async | `orchestrator` → `fetchUnderperformingVideos` |
| `get_inbox` | — | Instant | `optimizationQueue` DB query |
| `apply_fixes` | `autoApply: boolean` | Async | `orchestrator` → `autoApplySweep` |
| `optimize_video` | `videoId` or `title` | Async | `orchestrator` → targeted scan + propose |
| `get_activity` | `limit?` (default 10) | Instant | `agentActivityLogs` DB query |
| `chat` | — | Instant | Fallback — conversational AI response |

### Data Flow

**Instant queries** (~1-2s):
```
User → Coach AI → tool selection → tool-executor → DB read → format → response
```

**Async operations** (immediate ack + background):
```
User → Coach AI → multi-step tool plan → tool-executor creates job
  → Returns: "Scanning N videos... job #abc"
  → Background: scan → score → propose → queue → coach inbox message
  → Frontend polls GET /api/agent/coach/job/{id} every 5s
```

### Error Handling

| Scenario | System Response | User Sees |
|---|---|---|
| No YouTube token | Tool executor returns error immediately | "Connect your channel in Settings → YouTube." |
| No goal set | goal_status returns null, AI prompts user | "Want to set a goal now?" |
| AI call fails (both providers down) | Fallback to rule-based keyword matching | "Try: 'goal status', 'scan channel', or 'show inbox'." |
| YouTube API rate limit | Mark job as retryable, cooldown 5min | "YouTube is rate-limiting us. I'll retry in 5 minutes." |
| Async job timeout (90s) | Mark failed with partial results | "Scan timed out. I found N issues in processed videos — check inbox." |
| DB connection failure | Fallback to conversation-only, degraded message | "I can chat but can't access your data right now." |
| Ambiguous user request | AI can't pick tool → asks clarifying question | "I can scan, check goals, or review inbox. What helps most?" |
| Duplicate concurrent job | Return existing jobId | "A scan is already in progress (job #abc)." |

### Async Job Lifecycle

```
queued → running → completed  (results in inbox)
                → failed     (error + partial results)
```

Jobs stored in `agent_jobs` table. Frontend polls `GET /api/agent/coach/job/{id}`.

## Testing

### Automated Tests

| Layer | Tests | Approach |
|---|---|---|
| Goal Engine | Set/get/update goal, persist across restarts, edge case: 0 initial | Unit tests with in-memory SQLite (`sql.js` already in deps) |
| Tool Executor | goal_status returns formatted goal, scan_channel creates job, no-token error, duplicate job handling, job lifecycle | Integration tests mocking YouTube API |
| Coach AI (function calling) | Maps natural language to correct tools: "How's my goal?" → goal_status, "Scan my channel" → scan_channel, "Hello" → chat, ambiguous → clarification | Unit tests with mocked AI responses |
| Coach Memory | Save/load/clear memory across conversations | Integration tests with DB |
| API Endpoints | POST /coach/ask, GET /goal/status, POST /goal/set, GET /coach/job/{id}, POST /coach-memory/save | HTTP integration tests (existing `node --test` infrastructure) |

### Manual Smoke Test

1. Open dashboard → click "Phronesis Coach" button
2. Set a goal: "1000 subscribers"
3. Ask: "How am I doing?" → shows goal progress
4. Ask: "Scan my channel" → "Scanning..." then results in inbox
5. Ask: "Show my inbox" → lists proposals
6. Ask: "Apply all safe fixes" → queues auto-apply
7. Close and reopen browser → goal and memory persist
8. Trigger cron (or wait 6h) → autonomous scan still works with DB goal

## Scope Boundaries

**In scope:**
- DB-backed goal engine (replaces in-memory Map)
- Function calling in coach AI with 8 tools
- Tool executor bridging chat → agent pipeline
- Async job tracking with `agent_jobs` table
- Frontend job polling and progress display
- Coach memory wired to frontend
- Duplicate `POST /api/agent/goal` endpoint deprecated/merged

**Out of scope (future):**
- Multiple simultaneous goals per channel
- Goal history/analytics dashboard
- Push notifications (mobile/web)
- Scheduling recurring scans at custom intervals
- Multi-channel goal management
- Agent persona/style customization from chat
