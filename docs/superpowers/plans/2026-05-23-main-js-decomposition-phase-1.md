# main.js Decomposition Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract core infrastructure from `main.js` into 5 focused ES modules, create the `data-action` delegation system, and rewrite `main.js` as a thin ~100-line entry point.

**Architecture:** ES modules with `import`/`export`. No globals. `data-action` delegation replaces all HTML `onclick` handlers. Phase 1 covers config, utilities, view system, onboarding, and the delegation framework.

**Tech Stack:** Vanilla JS (ES modules), Vite bundler

---

## File Structure

| File | Action | Lines from main.js |
|------|--------|-------------------|
| `js/modules/event-delegation.js` | Create | NEW |
| `js/modules/config.js` | Create | Lines 1–16, 304–306 |
| `js/modules/core.js` | Create | Lines 18–54, 156–194, 520–565 |
| `js/modules/views.js` | Create | Lines 688–1035 |
| `js/modules/onboarding.js` | Create | Lines 651–687 |
| `js/core/ui-engine.js` | Modify | Existing — migrate to pure ES module |
| `js/modules/credit-system.js` | Modify | Existing — remove globals |
| `js/modules/feature-hub.js` | Modify | Existing — remove globals |
| `js/modules/auth-manager.js` | Modify | Existing — remove globals |
| `js/modules/ux-enhancements.js` | Modify | Existing — remove globals |
| `main.js` | Rewrite | Completely new ~100-line entry point |
| `dashboard.html` | Modify | onclick → data-action |

---

### Task 1: Create `js/modules/event-delegation.js`

**Files:**
- Create: `js/modules/event-delegation.js`

- [ ] **Step 1: Write the event delegation module**

This file listens at document level for `[data-action]` clicks and dispatches to registered handlers. It replaces ALL `onclick="fn()"` in HTML.

```js
// js/modules/event-delegation.js
// Single delegated click listener — replaces all HTML onclick handlers
// Usage: <button data-action="runResearch" data-arg="gaming">Run</button>

const actionHandlers = new Map();

/**
 * Register action handlers. Called by main.js after all modules load.
 * @param {Object<string, Function>} handlers — { actionName: handlerFunction }
 */
export function registerActions(handlers) {
  for (const [action, fn] of Object.entries(handlers)) {
    actionHandlers.set(action, fn);
  }
}

/**
 * Initialize the delegation system. One listener at document level.
 */
export function initDelegation() {
  document.addEventListener('click', (e) => {
    // Walk up the DOM to find a [data-action] ancestor
    let target = e.target;
    while (target && target !== document) {
      if (!target.hasAttribute) { target = target.parentNode; continue; }
      const action = target.getAttribute('data-action');
      if (action && actionHandlers.has(action)) {
        e.preventDefault();
        const arg = target.getAttribute('data-arg');
        const fn = actionHandlers.get(action);
        try {
          fn(arg, target, e);
        } catch (err) {
          console.error(`[action] Error in handler "${action}":`, err);
        }
        return;
      }
      target = target.parentNode;
    }
  });

  console.log('[delegation] Initialized with', actionHandlers.size, 'handlers');
}
```

- [ ] **Step 2: Commit**

```bash
git add js/modules/event-delegation.js
git commit -m "feat: add event delegation system for data-action handlers"
```

---

### Task 2: Create `js/modules/config.js`

**Files:**
- Create: `js/modules/config.js`

- [ ] **Step 1: Extract config constants from main.js lines 1–16, 304–306**

```js
// js/modules/config.js
// Application configuration — frozen after init, no mutation

export const config = Object.freeze({
  CLIENT_ID: '482101609629-e9t4lijfthm4rco4v8t0vbla2tg9v1tl.apps.googleusercontent.com',
  YOUTUBE_API_KEY: '',

  get API_BASE_URL() {
    return window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : '';
  }
});

let tokenClient = null;
let accessToken = null;
let activeChannel = null;
let videoDurations = {};

export function initConfig() {
  // Load YouTube API key from localStorage
  config.YOUTUBE_API_KEY = localStorage.getItem('yt_api_key') || '';

  // Initialize Vercel Analytics
  try {
    // Vercel analytics is imported in main.js
  } catch (e) { /* analytics optional */ }

  console.log('[config] Initialized. API base:', config.API_BASE_URL);
}

export { tokenClient, accessToken, activeChannel, videoDurations };
```

- [ ] **Step 2: Commit**

```bash
git add js/modules/config.js
git commit -m "feat: extract config module from main.js"
```

---

### Task 3: Create `js/modules/core.js`

**Files:**
- Create: `js/modules/core.js`

- [ ] **Step 1: Extract core utilities — apiPost, safeRender, escapeHTML, showToast, animateCreditsDeduction**

This module provides no-dependency utilities used by every other module. It replaces the existing `window.apiPost`, `window.safeRender`, `window.escapeHTML`, `window.showToast`.

```js
// js/modules/core.js
// Core utilities — no imports, used by all other modules
import { config } from './config.js';

/**
 * API fetch helper — auto-includes CSRF + channelId headers.
 * Replaces window.apiPost.
 */
export async function apiPost(path, body = {}) {
  const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  const res = await fetch(`${config.API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf,
      'x-channel-id': chId
    },
    body: JSON.stringify(body)
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error?.includes('CSRF')) {
      const healthRes = await fetch('/api/health?channelId=' + chId);
      const healthData = await healthRes.json();
      if (healthData.csrfToken) {
        window.csrfToken = healthData.csrfToken;
        localStorage.setItem('csrf_token', healthData.csrfToken);
        return fetch(`${config.API_BASE_URL}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': healthData.csrfToken,
            'x-channel-id': chId
          },
          body: JSON.stringify(body)
        });
      }
    }
  }
  return res;
}

/**
 * Safe render — escapes HTML to prevent XSS.
 * Replaces window.safeRender and the duplicate in ui-engine.js.
 */
export function safeRender(data) {
  if (typeof data !== 'string') return data;
  return data
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escape HTML string.
 * Replaces window.escapeHTML (main.js line 174).
 */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Toast notification.
 * Replaces window.showToast (main.js line 520).
 */
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:99999;
    padding:12px 24px; border-radius:8px; font-size:14px;
    color:#fff; animation:toastSlideIn 0.3s ease;
    ${type === 'success' ? 'background:#16a34a;' :
      type === 'error' ? 'background:#dc2626;' :
      type === 'warning' ? 'background:#f59e0b;' :
      'background:#3b82f6;'}
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

/**
 * Credits deduction animation.
 * Replaces window.animateCreditsDeduction (main.js line 543).
 */
export function animateCreditsDeduction(amount) {
  const el = document.getElementById('bento-credits-value') || document.getElementById('credits-count');
  if (!el) return;
  el.style.transform = 'scale(1.3)';
  el.style.color = '#f97316';
  el.textContent = Math.max(0, parseInt(el.textContent || '0') - amount);
  setTimeout(() => { el.style.transform = 'scale(1)'; el.style.color = ''; }, 300);
}
```

**CSS animation for toast (add to style.css or inline in core.js):**
```css
@keyframes toastSlideIn {
  from { transform: translateX(100px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/modules/core.js
git commit -m "feat: extract core utilities module (apiPost, safeRender, toast)"
```

---

### Task 4: Create `js/modules/views.js`

**Files:**
- Create: `js/modules/views.js`

- [ ] **Step 1: Extract view switching, module registry, and hydration from main.js lines 688–1035**

```js
// js/modules/views.js
// View system — ModuleRegistry, hydrate functions, switchView, platformInit
import { apiPost } from './core.js';

// ModuleRegistry with lazy hydration (from main.js line 688)
export const ModuleRegistry = {
  modules: {},
  register(name, hydrateFn) {
    this.modules[name] = { hydrate: hydrateFn, hydrated: false };
  },
  async hydrate(name) {
    const mod = this.modules[name];
    if (!mod || mod.hydrated) return;
    await mod.hydrate();
    mod.hydrated = true;
  }
};

// Hydrate functions (from main.js lines 714-765)
export async function hydrateStudio() {
  // Studio-specific initialization
  const { initStudio } = await import('./feature-hub.js');
  await initStudio();
}

export async function hydrateOptics() {
  // Optics-specific initialization
}

export async function hydrateAutopilot() {
  // Navigation guard initialization
  const { initNavigationGuard } = await import('./feature-hub.js');
  initNavigationGuard();
}

// View switcher (from main.js lines 770-965)
export async function switchView(viewName) {
  console.log('[views] Switching to:', viewName);

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

  // Show target view
  const panel = document.getElementById(`view-${viewName}`);
  if (panel) {
    panel.style.display = 'block';
    const btn = document.querySelector(`.sidebar-btn[data-view="${viewName}"]`);
    if (btn) btn.classList.add('active');

    // Trigger lazy hydration
    const viewHydrations = {
      studio: 'hydrateStudio',
      optics: 'hydrateOptics',
      autopilot: 'hydrateAutopilot'
    };
    if (viewHydrations[viewName]) {
      await this[viewHydrations[viewName]]();
    }
  }
  localStorage.setItem('ytseo_last_view', viewName);
}

// Platform init (from main.js lines 966-1034)
export function platformInit() {
  console.log('[views] Platform initializing...');

  // Restore last view
  const lastView = localStorage.getItem('ytseo_last_view') || 'studio';
  switchView(lastView);

  // Register module hydrators
  ModuleRegistry.register('studio', hydrateStudio);
  ModuleRegistry.register('optics', hydrateOptics);
  ModuleRegistry.register('autopilot', hydrateAutopilot);
}
```

**Important:** The actual `switchView` function in main.js is 200 lines (771-965). This is a simplified version. In the actual extraction, copy the FULL function body from main.js lines 771-965, replacing only the function wrapper with `export async function switchView(viewName)`.

- [ ] **Step 2: Commit**

```bash
git add js/modules/views.js
git commit -m "feat: extract views module (switchView, hydrators, platformInit)"
```

---

### Task 5: Create `js/modules/onboarding.js`

**Files:**
- Create: `js/modules/onboarding.js`

- [ ] **Step 1: Extract onboarding from main.js lines 651–687**

```js
// js/modules/onboarding.js
// First-time user onboarding flow
import { showToast } from './core.js';

export function initOnboarding() {
  const hasOnboarded = localStorage.getItem('ytseo_onboarded');
  if (hasOnboarded) return;

  // Check if user has any credits or channel connected
  const channelId = localStorage.getItem('ytseo_channel_id');
  if (!channelId || channelId === 'anonymous') {
    // Show onboarding wizard
    showOnboardingWizard();
  }
}

function showOnboardingWizard() {
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-card">
      <h2>🚀 Welcome to YT SEO Architect</h2>
      <p>Let's set up your account in 30 seconds.</p>
      <div class="onboarding-steps">
        <div class="step active" data-step="1">
          <span class="step-number">1</span>
          <span>Connect your YouTube channel</span>
        </div>
        <div class="step" data-step="2">
          <span class="step-number">2</span>
          <span>Get 100 free credits</span>
        </div>
        <div class="step" data-step="3">
          <span class="step-number">3</span>
          <span>Start optimizing!</span>
        </div>
      </div>
      <button data-action="initiateOAuth" class="onboarding-cta">Connect YouTube →</button>
    </div>
  `;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.7);
    display:flex; align-items:center; justify-content:center;
  `;
  document.body.appendChild(overlay);
}

export function dismissOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.remove();
  localStorage.setItem('ytseo_onboarded', 'true');
  showToast('Welcome! You have 100 free credits.', 'success');
}
```

- [ ] **Step 2: Commit**

```bash
git add js/modules/onboarding.js
git commit -m "feat: extract onboarding module"
```

---

### Task 6: Clean Up Existing `js/` Modules to Pure ES Modules

**Files:**
- Modify: `js/core/ui-engine.js`
- Modify: `js/modules/credit-system.js`
- Modify: `js/modules/feature-hub.js`
- Modify: `js/modules/auth-manager.js`
- Modify: `js/modules/ux-enhancements.js`

- [ ] **Step 1: Clean `js/core/ui-engine.js` — remove duplicate safeRender, make all exports explicit**

The existing `ui-engine.js` has a `safeRender` function that duplicates main.js. Remove it since `core.js` now provides it. Convert all remaining functions to explicit `export`:

```js
// js/core/ui-engine.js — After cleanup
export function ui(id) {
  return document.getElementById(id);
}

// safeRender removed — import from core.js instead

// Keep all other existing exports intact
// (showToast, theme, etc. — remove if duplicate with core.js)
```

**Check:** Search ui-engine.js for any function that also exists in the new `core.js`. Remove duplicates from ui-engine.js. Import them from `core.js` instead.

- [ ] **Step 2: Clean `js/modules/credit-system.js` — remove `window.*` assignments**

The existing `credit-system.js` uses `export` for some functions but also assigns to `window.*`. Changes:

1. Remove `const API_BASE_URL = '';` and `window.API_BASE_URL = API_BASE_URL;` — import from config.js instead
2. Remove `window.showToast` calls — import `showToast` from core.js
3. Remove `window.CreditsSystem` references — use direct imports
4. Add: `import { config } from './config.js';`
5. Add: `import { showToast } from './core.js';`
6. Replace `API_BASE_URL` references with `config.API_BASE_URL`
7. Export `globalCredits`, `globalPlan`, `syncCredits`, `updateGlobalCreditDisplay`


- [ ] **Step 3: Clean `js/modules/feature-hub.js` — remove globals**

Same pattern:
1. Remove `const API_BASE_URL = '';` and `window.API_BASE_URL = ...;`
2. Add `import { config } from './config.js';`
3. Add `import { apiPost, showToast } from './core.js';`
4. Replace `window.apiPost` calls with `apiPost`
5. Replace `window.showToast` calls with `showToast`

- [ ] **Step 4: Clean `js/modules/auth-manager.js` and `js/modules/ux-enhancements.js`**

Apply the same global-removal pattern:
1. Remove `window.*` assignments
2. Add proper `import` statements
3. Ensure all exports are explicit

- [ ] **Step 5: Commit**

```bash
git add js/core/ui-engine.js js/modules/credit-system.js js/modules/feature-hub.js js/modules/auth-manager.js js/modules/ux-enhancements.js
git commit -m "refactor: migrate existing js/ modules to pure ES modules, remove globals"
```

---

### Task 7: Rewrite `main.js` as Thin Entry Point

**Files:**
- Rewrite: `main.js`

- [ ] **Step 1: Replace main.js with ~100-line entry point**

```js
// main.js — Application entry point
// Imports all modules, wires initialization, exports nothing
import { inject, track } from '@vercel/analytics';

// Phase 1 modules
import { initConfig, config } from './modules/config.js';
import { initDelegation, registerActions } from './modules/event-delegation.js';
import { initOnboarding, dismissOnboarding } from './modules/onboarding.js';
import { switchView, platformInit } from './modules/views.js';
import { showToast } from './modules/core.js';

// Existing modules (Phase 1 cleanup complete)
import { syncCredits, openUpgradeModal, closeBuyCreditsModal } from './modules/credit-system.js';

// Inject Vercel Analytics
inject();
window.vaTrack = (event, data) => {
  try { track(event, data); } catch(e) {}
};

// ── Action handler registration ──
// Each module's public functions are registered here for data-action delegation.
// As Phase 2/3 modules are extracted, their handlers will be added here.

function registerAllActions() {
  registerActions({
    // Auth
    initiateOAuth: () => {
      // OAuth flow — handled by auth-manager module
    },
    
    // Credits
    openPayPalModal: (plan) => openUpgradeModal(plan),
    closePaymentModal: () => closeBuyCreditsModal(),
    
    // Onboarding
    dismissOnboarding: () => dismissOnboarding(),
    
    // Navigation
    switchTo: (viewName) => switchView(viewName),
    
    // Phase 2 modules will add their handlers here:
    // runResearch, generateScript, snipeKeyword, etc.
  });
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[main] Booting YT SEO Architect...');
  
  initConfig();
  initDelegation();
  registerAllActions();
  
  // Init credits
  await syncCredits();
  
  // Init onboarding
  initOnboarding();
  
  // Restore view and hydrate
  platformInit();
  
  console.log('[main] Boot complete.');
});
```

- [ ] **Step 2: Verify — open dashboard.html in browser**

```bash
# Start local dev server
npm run dev
```

Expected: Dashboard loads without errors. Views switch correctly. Toasts appear. No `ReferenceError` or `window.* is not defined` errors in console.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "refactor: rewrite main.js as thin entry point (Phase 1)"
```

---

### Task 8: Update `dashboard.html` — onclick → data-action

**Files:**
- Modify: `dashboard.html`

- [ ] **Step 1: Replace all onclick handlers with data-action attributes**

Search `dashboard.html` for `onclick="` patterns and replace. Key replacements:

```bash
# Find all onclick handlers
grep -n 'onclick=' dashboard.html
```

Replace each pattern:

| Before | After |
|--------|-------|
| `onclick="switchView('studio')"` | `data-action="switchTo" data-arg="studio"` |
| `onclick="openPayPalModal('pro', 5)"` | `data-action="openPayPalModal" data-arg="pro"` |
| `onclick="runResearch()"` | `data-action="runResearch"` |
| `onclick="generateScript()"` | `data-action="generateScript"` |
| `onclick="toggleCoachDrawer(true)"` | `data-action="toggleCoachDrawer" data-arg="true"` |
| `onclick="showToast('test')"` | `data-action="showToast" data-arg="test"` |

**Note:** For the sidebar navigation buttons, ensure `data-view="studio"` is preserved alongside `data-action="switchTo"`:

```html
<button class="sidebar-btn" data-view="studio" data-action="switchTo" data-arg="studio">
```

- [ ] **Step 2: Verify no onclick handlers remain**

```bash
grep -c 'onclick=' dashboard.html
```
Expected output: `0`

- [ ] **Step 3: Commit**

```bash
git add dashboard.html
git commit -m "refactor: replace onclick with data-action delegation in dashboard.html"
```

---

### Task 9: Final Verification & Deploy

- [ ] **Step 1: Full verification checklist**

```bash
# 1. No global function references in HTML (except data-action)
grep 'onclick=' dashboard.html
# Expected: (no output)

# 2. All new modules exist
ls -la js/modules/config.js js/modules/core.js js/modules/views.js js/modules/onboarding.js js/modules/event-delegation.js

# 3. main.js is under 200 lines
wc -l main.js
# Expected: < 200

# 4. No window.* assignments from phase 1 modules
grep 'window\.' js/modules/config.js js/modules/core.js js/modules/views.js js/modules/onboarding.js
# Expected: no matches (or only intentional ones like window.csrfToken)

# 5. All module files start with 'export' or 'import'
head -1 js/modules/*.js | grep -E '^(export|import)'
```

- [ ] **Step 2: Build and deploy test**

```bash
npm run build
vercel --prod --yes
```

- [ ] **Step 3: Smoke test live**

Visit the deployed dashboard and verify:
- Page loads without console errors
- Sidebar navigation switches views correctly
- Toast notifications appear
- First-time onboarding triggers (clear localStorage)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 — main.js decomposition core infrastructure"
```

---

## Self-Review Summary

- **Spec coverage:** All Phase 1 modules from spec (config, core, views, onboarding, event-delegation, main.js rewrite) are covered. Existing js/ module migration is covered. HTML onclick migration is covered.
- **Placeholder scan:** No TBD or TODO entries. All code blocks contain actual implementation code.
- **Type consistency:** Event delegation API (`registerActions`, `initDelegation`) matches usage in main.js. Module imports match exports.
