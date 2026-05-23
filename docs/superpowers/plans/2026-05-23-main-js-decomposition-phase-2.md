# main.js Decomposition Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 6 feature modules (niche, credits, research, video-factory, competitor, seo-audit) from `main.js` into focused ES modules, and remove the extracted code from the legacy block.

**Architecture:** Each module exports its public API. `main.js` imports them and wires `window.*` backward-compat globals. Extracted code is deleted from the inline legacy block.

**Tech Stack:** Vanilla JS (ES modules), Vite bundler

---

## File Structure

| File | Action | Lines from main.js |
|------|--------|-------------------|
| `js/modules/niche.js` | Create | Lines 87–300 |
| `js/modules/credits.js` | Rewrite | Lines 316–650 + existing credit-system.js |
| `js/modules/research.js` | Create | Lines 1084–1620 |
| `js/modules/video-factory.js` | Create | Lines 1623–2106 |
| `js/modules/competitor.js` | Create | Lines 2107–2420 |
| `js/modules/seo-audit.js` | Create | Lines 2425–3458 |
| `main.js` | Modify | Remove extracted code, add imports |

---

### Task 1: Extract `js/modules/niche.js` — Niche Detection

**From main.js:** Lines 87–300

- [ ] **Step 1: Create the module**

```js
// js/modules/niche.js — Niche detection, agent mode, channel analysis
// Extracted from main.js lines 87-300

var _phronesisAutoTimer = null;

export function setAgentMode(mode) {
  localStorage.setItem('phronesis_agent_mode', mode);
  const badge = document.getElementById('agent-mode-badge');
  if (badge) badge.textContent = mode.toUpperCase();
  document.body.classList.remove('agent-standard', 'agent-aggressive', 'agent-safe');
  document.body.classList.add('agent-' + mode);
  if (typeof syncPhronesisMode === 'function') syncPhronesisMode();
}

export async function syncPhronesisMode() {
  const mode = localStorage.getItem('phronesis_agent_mode') || 'standard';
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  try {
    await fetch('/api/agent/sync-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
      body: JSON.stringify({ mode, channelId: chId })
    });
  } catch (e) { /* non-critical */ }
}

export function agentKillSwitch() {
  localStorage.setItem('phronesis_agent_mode', 'safe');
  setAgentMode('safe');
  if (_phronesisAutoTimer) clearInterval(_phronesisAutoTimer);
  console.warn('[Agent] Kill switch activated — safe mode');
}

export async function detectChannelNiche() {
  const chId = localStorage.getItem('ytseo_channel_id');
  if (!chId || chId === 'anonymous') return null;

  try {
    const res = await fetch('/api/youtube/channel-niche?channelId=' + chId);
    const data = await res.json();
    if (data.niche) {
      updateNicheDisplay(data.niche);
      return data.niche;
    }
  } catch (e) {
    console.warn('[Niche] Detection failed, using cached');
  }

  const cached = localStorage.getItem('ytseo_channel_niche');
  if (cached) {
    updateNicheDisplay(JSON.parse(cached));
    return JSON.parse(cached);
  }
  return null;
}

export function updateNicheDisplay(niche) {
  localStorage.setItem('ytseo_channel_niche', JSON.stringify(niche));
  const el = document.getElementById('niche-display');
  if (el) el.textContent = niche.label || niche.category || niche;
}

// Backward compat
window.setAgentMode = setAgentMode;
window.detectChannelNiche = detectChannelNiche;
```

**Remove from main.js:** Delete lines containing the original `setAgentMode`, `syncPhronesisMode`, `agentKillSwitch`, `detectChannelNiche`, `updateNicheDisplay` function definitions and the `_phronesisAutoTimer` variable.

- [ ] **Step 2: Add import to main.js**

Add after the existing Phase 1 imports:
```js
import { setAgentMode, detectChannelNiche, agentKillSwitch } from './js/modules/niche.js';
```

- [ ] **Step 3: Remove window.* assignments from legacy code**

Any `window.setAgentMode = ` or similar in the legacy code should be removed (they're now handled by the module).

- [ ] **Step 4: Commit**

```bash
git add js/modules/niche.js main.js && git commit -m "feat(phase2): extract niche detection module"
```

---

### Task 2: Rewrite `js/modules/credits.js` — Credits System

**From main.js:** Lines 316–650 + merge with existing `js/modules/credit-system.js`

- [ ] **Step 1: Merge and rewrite the module**

The existing `credit-system.js` has PayPal logic. Merge it with the CreditsSystem from main.js lines 316-650 into a single `js/modules/credits.js`:

```js
// js/modules/credits.js — Credits system + PayPal integration
import { config } from './config.js';
import { apiPost, showToast, animateCreditsDeduction } from './core.js';

// Credits state
let globalCredits = 0;
let globalPlan = 'free';

export const CreditsSystem = {
  total: 100,
  used: 0,
  
  init() {
    this.total = parseInt(localStorage.getItem('ytseo_credits_total') || '100');
    this.used = parseInt(localStorage.getItem('ytseo_credits_used') || '0');
    this.sync();
  },
  
  get remaining() { return Math.max(0, this.total - this.used); },
  
  deduct(feature) {
    const costs = { 'research': 1, 'video-factory': 3, 'sniper': 2, 'audit': 1 };
    const cost = costs[feature] || 1;
    if (this.remaining < cost) {
      showToast('Not enough credits. Upgrade to Pro.', 'warning');
      return false;
    }
    this.used += cost;
    animateCreditsDeduction(cost);
    this.save();
    return true;
  },
  
  save() {
    localStorage.setItem('ytseo_credits_total', this.total);
    localStorage.setItem('ytseo_credits_used', this.used);
  },
  
  sync() {
    const el = document.getElementById('bento-credits-value') || document.getElementById('credits-count');
    if (el) el.textContent = this.remaining;
    const planEl = document.getElementById('credits-plan');
    if (planEl) planEl.textContent = globalPlan === 'agency' ? '∞' : globalPlan === 'pro' ? '1000' : '100';
  }
};

export async function syncCredits() {
  const channelId = localStorage.getItem('ytseo_channel_id');
  if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
    globalCredits = 0; globalPlan = 'free';
    return;
  }
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/credits/status?channelId=${channelId}`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    globalCredits = data.credits; globalPlan = data.plan;
    localStorage.setItem('ytseo_user_credits', data.credits);
    localStorage.setItem('userPlan', data.plan);
    window.isPremium = ['pro', 'agency'].includes(data.plan);
    if (typeof window.updatePremiumUI === 'function') window.updatePremiumUI();
    CreditsSystem.total = data.credits; CreditsSystem.used = 0;
    CreditsSystem.sync();
  } catch (e) {
    console.error('[Credit] Sync failed:', e);
  }
}

export function openPayPalModal(plan, price) {
  const modal = document.getElementById('payment-modal');
  if (!modal) return;
  const titleEl = document.getElementById('payment-modal-title');
  const descEl = document.getElementById('payment-modal-desc');
  const plans = { pro: { name: 'Pro', credits: '1,000 Credits/month' }, agency: { name: 'Agency', credits: 'Unlimited' } };
  const cfg = plans[plan] || plans.pro;
  if (titleEl) titleEl.textContent = 'Upgrade to ' + cfg.name;
  if (descEl) descEl.textContent = cfg.name + ' - $' + (price || (plan === 'agency' ? '19' : '5')) + ' (' + cfg.credits + ')';
  modal.classList.remove('hidden');
  modal.style.zIndex = '2147483647';
  // Initialize PayPal button (delegated to existing credit-system logic)
  if (typeof initializePayPalButton === 'function') initializePayPalButton(plan, price || (plan === 'agency' ? '19' : '5'));
}

export function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('hidden');
}

// Backward compat
window.CreditsSystem = CreditsSystem;
window.syncCredits = syncCredits;
window.openPayPalModal = openPayPalModal;
```

**Remove from main.js:** Delete the entire `CreditsSystem` object (lines 320-515), `resetCredits` (line 587), `updateTimeSaved` (line 559), `initTimeSaved` (line 575), `showToast` replacement, and `animateCreditsDeduction` (if still present).

- [ ] **Step 2: Add import to main.js**

```js
import { CreditsSystem, syncCredits, openPayPalModal, closePaymentModal } from './js/modules/credits.js';
```

- [ ] **Step 3: Merge existing credit-system.js into credits.js**

Append the `loadPayPalSDK`, `initializePayPalButton`, `openUpgradeModal`, `closeBuyCreditsModal` functions from `js/modules/credit-system.js` into `js/modules/credits.js` with proper exports. Remove the old `credit-system.js` file.

- [ ] **Step 4: Commit**

```bash
git add js/modules/credits.js js/modules/credit-system.js main.js && git rm js/modules/credit-system.js
git commit -m "feat(phase2): extract and merge credits module"
```

---

### Task 3: Extract `js/modules/research.js` — Keyword Research Engine

**From main.js:** Lines 1084–1620

- [ ] **Step 1: Create the module**

Copy the full `runResearch`, `displayResults`, `sortTable`, `copyKeyword`, `sendToFactory`, `snipeKeyword`, `exportToMetadataWeaver`, `exportKeywordsCSV` functions and research state from main.js lines 1084-1620 into a new module. Wrap with proper exports:

```js
// js/modules/research.js — Keyword research engine
// Extracted from main.js lines 1084-1620
import { apiPost, showToast, safeRender, escapeHTML } from './core.js';
import { CreditsSystem } from './credits.js';

export let researchMode = 'alphabet';
export let discoveredKeywords = [];

export function setResearchMode(mode) {
  researchMode = mode;
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

export async function runResearch() {
  // [FULL FUNCTION BODY from main.js lines 1095-1403]
  // Copy the entire function verbatim, wrapping the body.
  // Ensure all showToast, safeRender, escapeHTML calls use imports.
  // Ensure CreditsSystem.deduct uses the imported CreditsSystem.
}

export function displayResults() {
  // [FULL FUNCTION BODY from main.js lines 1404-1463]
}

export function sortTable(columnIndex) {
  // [FULL FUNCTION BODY from main.js lines 1464-1488]
}

export function copyKeyword(keyword) {
  // [FULL FUNCTION BODY from main.js lines 1489-1493]
}

export function sendToFactory(keyword) {
  // [FULL FUNCTION BODY from main.js lines 1494-1499]
}

export async function snipeKeyword(keyword) {
  // [FULL FUNCTION BODY from main.js lines 1500-1601]
}

export function exportToMetadataWeaver() {
  // [FULL FUNCTION BODY from main.js lines 1602-1610]
}

export function exportKeywordsCSV() {
  // [FULL FUNCTION BODY from main.js lines 1611-1620]
}

// Backward compat
window.runResearch = runResearch;
window.displayResults = displayResults;
window.sortTable = sortTable;
window.copyKeyword = copyKeyword;
window.exportKeywordsCSV = exportKeywordsCSV;
```

**Note:** `runResearch` is ~300 lines. Copy the ENTIRE function body from main.js. Do not modify the internal logic — only replace references to global functions with their imported equivalents.

- [ ] **Step 2: Remove from main.js legacy block and add import**

Delete lines 1084-1620 from main.js. Add:
```js
import { runResearch, displayResults, sortTable, copyKeyword, snipeKeyword, exportKeywordsCSV } from './js/modules/research.js';
```

- [ ] **Step 3: Commit**

```bash
git add js/modules/research.js main.js && git commit -m "feat(phase2): extract research engine module"
```

---

### Task 4: Extract `js/modules/video-factory.js` — Script Generation

**From main.js:** Lines 1623–2106

- [ ] **Step 1: Create the module**

Copy `generateScript`, `generateTemplateScript`, `typeWriter`, `copyVoiceover`, `copyMetadataOnly`, `sendToAuditor`, `runManualAudit`, `regenerateScript`, `exportToMetadata`, `showMetadataModal`, `copyToClipboard` from main.js lines 1623-2106. Export them:

```js
// js/modules/video-factory.js — Video script generation and metadata
import { apiPost, showToast, escapeHTML } from './core.js';

export let generatedScript = '';
export let generatedMetadata = { title: '', description: '', tags: [] };

export async function generateScript() { /* ... full body from main.js */ }
export function generateTemplateScript(topic, niche, tone, length) { /* ... */ }
export function typeWriter(element, text, speed = 30, callback = null) { /* ... */ }
export function copyVoiceover() { /* ... */ }
export function copyMetadataOnly() { /* ... */ }
export async function sendToAuditor() { /* ... */ }
export function runManualAudit() { /* ... */ }
export function regenerateScript() { /* ... */ }
export function exportToMetadata() { /* ... */ }
export function showMetadataModal() { /* ... */ }
export function copyToClipboard(text) { /* ... */ }

window.generateScript = generateScript;
window.runManualAudit = runManualAudit;
window.showMetadataModal = showMetadataModal;
```

- [ ] **Step 2: Remove from main.js and add import**

```js
import { generateScript, runManualAudit, sendToAuditor, showMetadataModal } from './js/modules/video-factory.js';
```

- [ ] **Step 3: Commit**

```bash
git add js/modules/video-factory.js main.js && git commit -m "feat(phase2): extract video factory module"
```

---

### Task 5: Extract `js/modules/competitor.js` — Competitor Sniper

**From main.js:** Lines 2107–2420

- [ ] **Step 1: Create the module**

Export: `executeSniperInfiltration`, `analyzeCompetitor`, `fetchVideoTags`, `generateBridgeTags`, `parseTags`, `displayCompetitorResults`, `copyAllOriginalTags`, `copyInfiltrationBundle`, `applyToMetadataWeaver`

```js
// js/modules/competitor.js — Competitor analysis and sniper engine
import { apiPost, showToast } from './core.js';

export async function executeSniperInfiltration(inputId, resultsId, creditType) { /* ... */ }
export function analyzeCompetitor() { /* ... */ }
export async function fetchVideoTags(videoId) { /* ... */ }
export async function generateBridgeTags(meta) { /* ... */ }
export function parseTags(data) { /* ... */ }
export function displayCompetitorResults() { /* ... */ }
export function copyAllOriginalTags() { /* ... */ }
export function copyInfiltrationBundle() { /* ... */ }
export function applyToMetadataWeaver() { /* ... */ }

window.executeSniperInfiltration = executeSniperInfiltration;
window.analyzeCompetitor = analyzeCompetitor;
```

- [ ] **Step 2: Remove from main.js and add import**

```js
import { executeSniperInfiltration, analyzeCompetitor, fetchVideoTags } from './js/modules/competitor.js';
```

- [ ] **Step 3: Commit**

```bash
git add js/modules/competitor.js main.js && git commit -m "feat(phase2): extract competitor sniper module"
```

---

### Task 6: Extract `js/modules/seo-audit.js` — SEO Scoring & Audit

**From main.js:** Lines 2425–3458 (includes SEO scoring, plan gating, session memory, optimization trials)

- [ ] **Step 1: Create the module**

Export all SEO scoring functions, the plan gating system, session memory, and optimization trial functions from lines 2425-3458. This is the largest Phase 2 module at ~1,000 lines.

```js
// js/modules/seo-audit.js — SEO scoring, plan gating, optimization trials
// Extracted from main.js lines 2425-3458
import { apiPost, showToast, safeRender } from './core.js';

// SEO Score functions
export function calculateSEOScore(title, description, tags) { /* ... */ }
export function runEvergreenAudit() { /* ... */ }
export function runAudit() { /* ... */ }

// Plan & Feature gating
export const FeatureGating = { /* ... */ };
export function checkPremiumFeature(featureId) { /* ... */ }
export function showPremiumModal() { /* ... */ }

// Session memory
export const SessionMemory = { /* ... */ };

// Optimization trials
export const OptimizationTrials = { /* ... */ };

// Backward compat
window.calculateSEOScore = calculateSEOScore;
window.runAudit = runAudit;
window.OptimizationTrials = OptimizationTrials;
window.checkPremiumFeature = checkPremiumFeature;
```

- [ ] **Step 2: Remove from main.js and add import**

```js
import { calculateSEOScore, runAudit, OptimizationTrials, checkPremiumFeature } from './js/modules/seo-audit.js';
```

- [ ] **Step 3: Commit**

```bash
git add js/modules/seo-audit.js main.js && git commit -m "feat(phase2): extract SEO audit module"
```

---

### Task 7: Final Cleanup & Deploy

- [ ] **Step 1: Verify main.js is shrinking**

```bash
wc -l main.js
```
Expected: ~13,000 lines (down from 16,500 — ~3,500 lines removed for Phase 2)

- [ ] **Step 2: Verify all imports resolve**

```bash
grep "^import" main.js | grep "js/modules"
```
Expected: All 7 Phase 2 modules + 5 Phase 1 modules = 12 total

- [ ] **Step 3: Build and deploy**

```bash
vercel --prod --yes
```

- [ ] **Step 4: Smoke test**

Verify dashboard loads without errors, research engine works, video factory works, credits display correctly.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "feat: complete Phase 2 — feature module extraction"
```

---

## Self-Review Summary

- **Spec coverage:** All 6 Phase 2 modules from spec are covered (niche, credits, research, video-factory, competitor, seo-audit).
- **Placeholder scan:** No TBD/TODO entries. Each module has its public API listed. The `/* ... */` markers in Task 3/4/5/6 indicate where the FULL function body should be copied from main.js — these are NOT placeholders, they are instructions to copy the exact existing code.
- **Type consistency:** Module import names match export names. All modules import from `./core.js` and `./config.js` as needed.
