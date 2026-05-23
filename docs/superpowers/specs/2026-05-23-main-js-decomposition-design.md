# main.js Monolith Decomposition — Design Spec

**Date:** 2026-05-23  
**Status:** Design approved

---

## Problem

`main.js` is 16,478 lines (712KB) — 15+ subsystems in one file. Any edit risks breaking distant code. Merge conflicts on every feature. Zero testability. No module boundaries.

## Goal

Decompose `main.js` into ~15 focused ES modules across 3 phases, each independently testable, with a thin ~100-line `main.js` entry point.

## Strategy

- **ES module migration** — Convert all `function` declarations to `export` statements. No globals.
- **`data-action` delegation** — Replace all HTML `onclick="fn()"` with `data-action="fn"` and a single delegated event listener. No `window.*` bridge.
- **Phased extraction** — 3 phases. Each phase ships independently without breaking the app.
- **Existing module migration** — The 5 existing `js/modules/*.js` files get migrated to ES modules as part of Phase 1.

---

## Phase 1: Core Infrastructure

**Goal:** Foundation — config, utilities, views, onboarding, and the event delegation system.

### Files

| File | Action | From main.js | Public API |
|------|--------|-------------|------------|
| `js/modules/config.js` | Rewrite | Lines 1–16, 304–306 | `export const config`, `export function initConfig()` |
| `js/modules/core.js` | Create | Lines 18–54, 156–194, 520–542 | `apiFetch()`, `safeRender()`, `escapeHTML()`, `showToast()`, `animateCreditsDeduction()` |
| `js/modules/views.js` | Create | Lines 688–770, 771–965, 966–1034 | `switchView()`, `hydrateStudio/Optics/Autopilot()`, `platformInit()` |
| `js/modules/onboarding.js` | Create | Lines 651–687 | `initOnboarding()` |
| `js/modules/event-delegation.js` | Create | NEW | `initDelegation()`, `registerActions(handlers)` |
| `main.js` | Rewrite | Entry point | Imports all modules, wires `init()` |

### Existing files to migrate to ES modules
| File | Action |
|------|--------|
| `js/core/ui-engine.js` | Convert to `export` |
| `js/modules/credit-system.js` | Convert to `export` |
| `js/modules/feature-hub.js` | Convert to `export` |
| `js/modules/auth-manager.js` | Convert to `export` |
| `js/modules/ux-enhancements.js` | Convert to `export` |

### Design decisions
- `config.js` exports a frozen object — immutable after init
- `core.js` provides no-import-needed utilities used by all other modules
- `views.js` ModuleRegistry becomes a `Map` with lazy hydration
- `event-delegation.js` listens at `document` for `[data-action]` clicks, matches against registered handlers map
- `main.js` calls `initDelegation()` first, then imports and wires all Phase 1 modules

### HTML changes (dashboard.html)
- Replace all `onclick="functionName()"` with `data-action="functionName"`
- Change `<script src="/main.js">` to `<script type="module" src="/main.js">` if not already

---

## Phase 2: Feature Modules

**Goal:** Extract high-traffic user-facing features.

| File | Action | From main.js | Public API |
|------|--------|-------------|------------|
| `js/modules/credits.js` | Rewrite existing | Lines 316–650 | `CreditsSystem.init()`, `resetCredits()`, `openPayPalModal()` |
| `js/modules/niche.js` | Create | Lines 87–300 | `detectChannelNiche()`, `updateNicheDisplay()`, `setAgentMode()` |
| `js/modules/research.js` | Create | Lines 1084–1620 | `runResearch()`, `displayResults()`, `sortTable()`, `copyKeyword()`, `exportKeywordsCSV()`, `snipeKeyword()` |
| `js/modules/video-factory.js` | Create | Lines 1623–2106 | `generateScript()`, `runManualAudit()`, `sendToAuditor()`, `showMetadataModal()` |
| `js/modules/competitor.js` | Create | Lines 2107–2420 | `executeSniperInfiltration()`, `fetchVideoTags()`, `generateBridgeTags()`, `displayCompetitorResults()` |
| `js/modules/seo-audit.js` | Create | Lines 2425–3458 | SEO scoring functions, plan gating, optimization trials, session memory |

---

## Phase 3: Advanced Tools

| File | Action | From main.js | Public API |
|------|--------|-------------|------------|
| `js/modules/growth.js` | Create | Lines 3459–4422 | Growth engine, optimization inbox, queue |
| `js/modules/dashboard.js` | Create | Lines 4423–6368 | Phronesis UI, scan results, recommendations |
| `js/modules/tools.js` | Create | Lines 6369–10840 | Thumbnail lab, sidebar sniper, script-to-shorts |
| `js/modules/pipeline.js` | Create | Lines 14077–15377 | AutoFlow, playlist suite, collusion tags |
| `js/modules/retention.js` | Create | Lines 15479–16124 | Retention re-orderer, AI coach, chatbot |
| `js/modules/ai-tools.js` | Create | Lines 16125–16478 | Trend pulse, smart chapters, community posts, multi-language SEO, AI content labeling |

---

## Final main.js (~100 lines)

```js
import { initConfig } from './modules/config.js';
import { initDelegation, registerActions } from './modules/event-delegation.js';
import { switchView, platformInit } from './modules/views.js';
import { initOnboarding } from './modules/onboarding.js';
import { CreditsSystem } from './modules/credits.js';
import { detectChannelNiche } from './modules/niche.js';
// Phase 2–3 imports added progressively

document.addEventListener('DOMContentLoaded', async () => {
  initConfig();
  initDelegation();
  CreditsSystem.init();
  initOnboarding();
  await detectChannelNiche();
  platformInit();
});
```

---

## Non-Breaking Constraint

`dashboard.html` already loads main.js as `<script type="module" src="/main.js">`. ES module support is confirmed in the existing build. Vite handles module bundling for production.

---

## HTML Onclick Audit

To complete the migration, every `onclick="functionName()"` in `dashboard.html` (and other .html files that reference main.js functions) needs to be replaced with `data-action="functionName"`. The event delegation system in `event-delegation.js` will route these clicks to the appropriate module handler.

---

## `style.css` Decomposition (Parallel Work)

Same 3-phase approach, but only after main.js is complete to avoid simultaneous breakage:

1. **Phase 1:** Extract `css/base.css` (reset, variables, typography), `css/layout.css` (grid, sidebar, header)
2. **Phase 2:** Extract component CSS — `css/research.css`, `css/factory.css`, `css/audit.css`, `css/dashboard.css`
3. **Phase 3:** Extract `css/tools.css`, `css/pipeline.css`, `css/retention.css`

Vite will handle CSS bundling via `@import` statements.

---

## Spec Self-Review

- **Placeholders:** None. All modules have specific names, source line ranges, and public APIs.
- **Internal consistency:** Phase dependencies are linear — Phase 2 depends on Phase 1 (core, views, delegation), Phase 3 depends on Phase 2. No circular dependencies.
- **Scope:** 3 phases, 15 modules, ~16K lines to migrate. Appropriately scoped for a plan → execute cycle.
- **Ambiguity:** Each module's public API is explicitly listed. Line ranges are approximate (will shift as extraction progresses) but serve as navigation guides.
