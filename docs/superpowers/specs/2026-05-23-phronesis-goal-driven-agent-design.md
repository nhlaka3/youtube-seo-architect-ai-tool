# Phronesis Goal-Driven Agent — Design Spec

**Date:** 2026-05-23  
**Status:** Design approved

---

## Problem

The current Phronesis system is a manually-triggered pipeline (scan → propose → recommend). It doesn't autonomously pursue goals, doesn't proactively communicate, and doesn't feel like an agent — it feels like a set of tools.

## Goal

Transform Phronesis into an autonomous, goal-driven agent with a proactive coach-style conversational interface.

## Core Principle

**The goal drives everything.** Every scan, proposal, and recommendation is prioritized by its contribution toward the user's stated goal. The agent proactively surfaces insights and asks for approval before acting.

---

## Architecture

### Three Layers

| Layer | Purpose | Trigger |
|-------|---------|---------|
| **Autonomous Loop** | Background scanning, scoring, proposing | Cron (every 2-6 hours) |
| **Coach Chat** | Proactive insights, conversational approval | Agent-initiated when issues found |
| **Goal Engine** | Goal setting, progress tracking, adaptation | User sets goal, agent tracks |

### Data Flow

```
Cron → Autonomous Loop
         ↓
    Scan → Score → Propose → Goal-prioritize → Queue
         ↓
    Coach Chat: "3 issues found affecting your goal. Fix?"
         ↓
    User approves → Agent applies → Memory updated → Progress tracked
```

---

## Goal Engine

### Lifecycle
1. **Set** — User defines goal (target metric, deadline, constraints) via `POST /api/agent/goal/set`
2. **Plan** — Agent decomposes into phases with timeline estimates (reuses existing planner.js)
3. **Execute** — Agent prioritizes actions by goal-contribution score
4. **Track** — Agent reports progress, updates estimates
5. **Adapt** — Agent adjusts strategy based on outcome data

### Goal Schema
```json
{
  "goalId": "goal_abc123",
  "type": "subscribers",
  "target": 10000,
  "current": 4200,
  "deadline": "2026-12-31",
  "createdAt": "2026-05-23T00:00:00Z",
  "phases": [
    { "phase": 1, "name": "AUDIT", "status": "complete",
      "estimatedImpact": "+500 subs" },
    { "phase": 2, "name": "OPTIMIZE_UNDERPERFORMING", "status": "active",
      "estimatedImpact": "+1200 subs" },
    { "phase": 3, "name": "GROWTH_COMPOUNDING", "status": "pending",
      "estimatedImpact": "+3000 subs" }
  ],
  "progress": { "percent": 42, "weeklyRate": 340, "eta": "2026-11-15" }
}
```

### Goal-Contribution Scoring
Every action gets scored by how much it moves the needle:
- `contributionScore = estimatedImpact / effort * urgency`
- Agent prioritizes highest-contribution actions first
- Reported to user: "This fix is projected to bring 80 subscribers"

---

## Coach Chat

### Proactive Triggers
Agent initiates conversation when:
- Videos drop in ranking (rank change > 5 positions)
- Goal timeline slips (> 10% behind schedule)
- New optimization opportunities found (high goal-contribution)
- Daily progress summary
- Weekly strategy review

### Message Structure
Each agent message has:
- **Alert type** (ranking, progress, opportunity, summary)
- **Goal impact** (how this affects the goal)
- **Recommendation** (what the agent proposes to do)
- **Inline action buttons** (approve, show details, dismiss)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/goal/set` | POST | Set/replace goal |
| `/api/agent/goal/status` | GET | Current goal + progress |
| `/api/agent/coach/inbox` | GET | Unread coach messages |
| `/api/agent/coach/respond` | POST | User approves/rejects proposal |
| `/api/agent/coach/ask` | POST | User asks agent a question |

### Frontend Changes
- Replace current Phronesis pipeline UI with chat panel
- Goal progress bar at top
- Structured messages with inline buttons (`[Fix Now]`)
- Free-text input for questions

---

## Autonomous Loop (Cron)

### Triggers
| Frequency | Action |
|-----------|--------|
| Every 2 hours | Metric delta scan — check for ranking drops, CTR changes |
| Every 6 hours | Full optimization loop — scan → score → propose → queue |
| Daily | Progress report toward goal |
| On goal set | Immediate full planning + audit |

### Safety Gates
- No destructive actions without user approval
- Max 10 auto-proposals per cycle
- Confidence threshold (score > 0.7 required for auto-queue)
- Kill switch (existing) respected

---

## What We Reuse

| Existing | Used for |
|----------|----------|
| `planner.js` | Phase/steps decomposition (already works) |
| `orchestrator.js` | Scan → propose → recommend loop |
| 16 sub-agents | Scan, propose, recommend actions |
| `memory-engine.js` | Snapshots, impact measurement |
| `scoring-engine.js` | Video scoring |
| `safety.js` | Action validation |
| `quality-gates.js` | Proposal quality checks |
| `retrospective.js` | Learning from outcomes |

## What We Build

| New | Purpose |
|-----|---------|
| Goal engine | Set, track, adapt goals |
| Goal-contribution scorer | Prioritize actions by goal impact |
| Coach chat API | Proactive messaging, structured responses |
| Coach chat UI | Chat panel replacing pipeline UI |
| Cron wiring | Connect autonomous loop to Vercel cron |

---

## Out of Scope
- Multi-goal support (one goal at a time)
- Goal templates / suggestions
- External integrations (Slack, email) for coach messages
- Mobile push notifications

---

## Spec Self-Review
- **Placeholders:** None. All endpoints, schemas, and triggers are specified.
- **Internal consistency:** Goal lifecycle stages match agent phases. Cron triggers align with coach message types. API endpoints cover all chat interactions.
- **Scope:** Single goal, single agent, single chat interface. Focused.
- **Ambiguity:** Goal-contribution scoring formula specified. Message structure defined with example. Safety gates enumerated.
