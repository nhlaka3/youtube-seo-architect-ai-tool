# TASK 16 — The Nova War Room (Persona & Social Proof)

## Goal
Transform the "War Room" into a live marketing demo. Instead of a technical log, it should display the **Nova Persona** in action, making the user feel like they have hired an elite AI Growth Architect.

---

## STEP 1 — The Persona String Library
**Create file: `api/agent-workflows/persona.js`**
Define Nova's "Voice" to be used in the logs.

```js
export const NOVA_VOICE = {
  SCANNING: "Nova is currently auditing your channel's neural footprint for growth gaps...",
  OPTIMIZING: "Detected a strategic weakness in [VIDEO]. Applying my 'Algorithmic Hijack' pattern.",
  PSEO: "Architected [COUNT] new landing pages to capture high-intent search traffic.",
  TREND: "Identified a viral shift in [NICHE]. Drafting a trend-response series plan."
};
```

---

## STEP 2 — Real-Time Activity UI
**Modify file: `dashboard.html`**
Upgrade the War Room panel with persona-driven animations.

- **Status Bar:** A pulse animation that stays "Active" as long as Nova is in the "Think Loop."
- **Cognitive Feed:** Log items formatted as "Nova's Thoughts" rather than system events.
- **Live Impact Counter:** A scrolling ticker showing "Total Optimizations Applied: 12,402" (Global stat).

---

## STEP 3 — The Social Proof Trigger
**Modify file: `api/agent-workflows/orchestrator.js`**
Ensure that whenever a task is completed, it's logged with a **Marketing-Friendly** description from the Persona library.

---

## Acceptance Criteria
1. The War Room UI looks like a "Control Center" for a high-end AI agent.
2. Log messages are written in the first person ("I found...", "I optimized...").
3. The "Thinking" animation activates during background cron jobs.
4. The dashboard header shows Nova's current state (e.g., "Nova is observing market trends").

---

## Files Changed
- `api/agent-workflows/persona.js` — NEW
- `api/agent-workflows/orchestrator.js` — MODIFIED (Logging logic)
- `dashboard.html` — MODIFIED (Persona UI updates)
- `js/core/ui-engine.js` — MODIFIED (Live feed handlers)
