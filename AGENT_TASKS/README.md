# AGENT TASKS — YouTube SEO Architect
## Master Task Index

Each file is a self-contained brief. Feed it to any AI coding agent.
No conversation history needed — every brief has all the context required.

---

## Execution Order & Status

| # | File | Feature | Effort | Status |
|---|------|---------|--------|--------|
| 01 | `TASK_01_redis_cache.md` | Upstash Redis / in-memory cache layer | Small | ⬜ TODO |
| 02 | `TASK_02_cron_optimizer.md` | Daily autonomous SEO scan + queue | Medium | ⬜ TODO |
| 03 | `TASK_03_feedback_loop.md` | Impact measurement + keyword wins | Medium | ⬜ TODO |
| 04 | `TASK_04_keyword_intelligence.md` | Keyword Research Lab panel | Medium | ⬜ TODO |
| 05 | `TASK_05_ab_title_tester.md` | Autonomous A/B title testing | Medium | ⬜ TODO |
| 06 | `TASK_06_thumbnail_ai.md` | fal.ai thumbnail image generation | Small | ⬜ TODO |
| 07 | `TASK_07_ai_coach_memory.md` | AI Coach persistent memory | Medium | ⬜ TODO |
| 08 | `TASK_08_trend_pulse.md` | Real-time trend alerts + capitalize | Medium | ⬜ TODO |
| 09 | `TASK_09_optimization_queue_ui.md` | Optimization Queue review UI | Medium | ⬜ TODO |
| 10 | `TASK_10_analytics_dashboard.md` | Growth Analytics dashboard panel | Medium | ⬜ TODO |
| 11A | `TASK_11A_programmatic_seo_research.md` | PSEO: Research, Weak Page Scan, Clusters | Medium | ⬜ TODO |
| 11B | `TASK_11B_programmatic_seo_generator.md` | PSEO: Page Generator, Blog Engine, UI | High | ⬜ TODO |
| 11C | `TASK_11C_pseo_indexing_expansion.md` | PSEO: Indexing, Sitemaps, Auto-Expansion | Small | ⬜ TODO |
| 12 | `TASK_12_content_strategy_agent.md` | Content Calendar AI + Series Planner | Medium | ⬜ TODO |
| 13 | `TASK_13_monetization_scaling.md` | Team Workspaces + Viral Referrals + Billing | High | ⬜ TODO |
| 14 | `TASK_14_autonomous_orchestrator.md` | "Super-Agent" Mode: Auto-Pilot Orchestration | High | ⬜ TODO |
| 15 | `TASK_15_public_seo_lab.md` | Marketing: Public SEO Lab (Lead Magnet) | Medium | ⬜ TODO |
| 16 | `TASK_16_nova_war_room.md` | Marketing: Nova War Room (Demo Persona) | Medium | ⬜ TODO |





---

## Task Dependencies

```
TASK_01 (Cache)
   └── TASK_02 (Cron) — uses cache
         └── TASK_03 (Feedback Loop) — reads cron data
               └── TASK_09 (Queue UI) — UI for cron output
                     └── TASK_10 (Analytics) — reads all data

TASK_04 (Keyword Lab)       — standalone
TASK_05 (A/B Tester)        — standalone; TASK_10 reads its results
TASK_06 (Thumbnail Gen)     — standalone
TASK_07 (Coach Memory)      — reads channel data from DB
TASK_08 (Trend Pulse)       — standalone

TASK_11A (PSEO Research) — standalone
   └── TASK_11B (PSEO Gen) — scales 11A data
         └── TASK_11C (PSEO Indexing) — indexes 11B data
```



**Recommended execution path:**
1 → 2 → 3 → 9 → 10 (core growth engine)
4, 5, 6, 7, 8 can be done in any order, in parallel.
11A → 11B → 11C (PSEO growth)
15, 16 (Marketing engine)

---

## How to Use These Files

### With Claude / Antigravity
```
Paste the entire TASK_XX file content into a new conversation and say:
"Implement this task exactly as specified."
```

### With Cursor / Copilot
```
Open the task file alongside the target files listed under "Files Changed"
and follow the step-by-step instructions.
```

### With any agent that supports file context
```
Attach: TASK_XX_filename.md + the files listed in "Files Changed"
Prompt: "Implement all steps in the task file."
```

---

## Environment Variables Required

| Variable | Used By | Get From |
|----------|---------|----------|
| `YOUTUBE_API_KEY` | Tasks 02, 08 | Google Cloud Console |
| `CRON_SECRET` | Task 02 | Generate: `openssl rand -hex 32` |
| `CSRF_SECRET` | All routes | Generate: `openssl rand -hex 32` |
| `FAL_API_KEY` | Task 06 | https://fal.ai |
| `UPSTASH_REDIS_REST_URL` | Task 01 | https://upstash.com (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | Task 01 | https://upstash.com (optional) |

---

## Architecture Overview

```
dashboard.html          ← Single-page app (all panels)
main.js                 ← Express server + all client JS
api/
  ├── ai-engine.js      ← Multi-brain AI (Groq/Gemini/OpenAI)
  ├── youtube-ops.js    ← YouTube Data API operations
  ├── cron-optimizer.js ← [TASK_02] Autonomous SEO scanner
  ├── feedback-loop.js  ← [TASK_03] Impact measurement
  ├── keyword-intelligence.js ← [TASK_04] Keyword Lab
  ├── ab-test.js        ← [TASK_05] A/B title tester
  ├── thumbnail-gen.js  ← [TASK_06] AI image generation
  ├── coach-memory.js   ← [TASK_07] Persistent coach memory
  ├── trend-pulse.js    ← [TASK_08] Trend alerts
  ├── analytics.js      ← [TASK_10] Growth analytics
  ├── programmatic-seo/
  │     ├── competitor-analysis.js ← [TASK_11A]
  │     ├── keyword-clusters.js    ← [TASK_11A]
  │     ├── generator.js           ← [TASK_11B/C]
  │     └── indexing.js            ← [TASK_11C]
  ├── agent-workflows/
  │     ├── series-planner.js      ← [TASK_12]
  │     └── orchestrator.js        ← [TASK_14]
  ├── monetization/

  │     ├── team-ops.js            ← [TASK_13]
  │     └── referrals.js           ← [TASK_13]
  └── _lib/



      ├── cache.js      ← [TASK_01] Cache layer
      └── ai-provider.js← Unified AI wrapper
  ├── marketing/
      ├── seo-lab.js    ← [TASK_15]
      └── war-room.js   ← [TASK_16]

src/database/
  └── services.js       ← SQLite (better-sqlite3) — all DB ops
vercel.json             ← Cron job schedule
```

---

## Status Legend
- ⬜ TODO — not started
- 🔄 IN PROGRESS — being implemented
- ✅ DONE — complete and tested
- ⚠️ BLOCKED — waiting on dependency

Update this table as tasks complete.
