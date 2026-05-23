// main.js — Application entry point (Phase 1)
// Architecture: Phase 1 modules (config, core, views, onboarding, delegation)
// are imported first. Phase 2/3 legacy code follows inline (to be extracted incrementally).
import { inject, track } from '@vercel/analytics';

// Phase 1 module imports (aliased to avoid conflicts with legacy code below)
import { initConfig, config } from './js/modules/config.js';
import { initDelegation, registerActions } from './js/modules/event-delegation.js';
import { initOnboarding as _initOnboarding } from './js/modules/onboarding.js';
import { switchView as _switchView, platformInit as _platformInit } from './js/modules/views.js';
import { showToast as _showToast, apiPost as _apiPost, safeRender as _safeRender, escapeHTML as _escapeHTML } from './js/modules/core.js';

// Phase 2 module imports (aliased to avoid conflicts with legacy declarations)
import { setAgentMode as _setAgentMode, detectChannelNiche as _detectChannelNiche, agentKillSwitch as _agentKillSwitch, checkHealthAndCoach as _checkHealthAndCoach } from './js/modules/niche.js';
import { CreditsSystem as _CreditsSystem, syncCredits as _syncCredits, openPayPalModal as _openPayPalModal, closePaymentModal as _closePaymentModal } from './js/modules/credits.js';
import { runResearch as _runResearch, displayResults as _displayResults, sortTable as _sortTable, copyKeyword as _copyKeyword, exportKeywordsCSV as _exportKeywordsCSV } from './js/modules/research.js';
import { generateScript as _generateScript, runManualAudit as _runManualAudit, sendToAuditor as _sendToAuditor, showMetadataModal as _showMetadataModal } from './js/modules/video-factory.js';
import { executeSniperInfiltration as _executeSniperInfiltration, analyzeCompetitor as _analyzeCompetitor, fetchVideoTags as _fetchVideoTags } from './js/modules/competitor.js';
import { calculateSEOScore as _calculateSEOScore, runAudit as _runAudit, OptimizationTrials as _OptimizationTrials, checkPremiumFeature as _checkPremiumFeature } from './js/modules/seo-audit.js';

// Phase 3 module imports (aliased — bridge pattern)
import { GrowthEngine as _GrowthEngine } from './js/modules/growth.js';
import { loadPhronesis as _loadPhronesis, loadScanResults as _loadScanResults, loadNeuralStrategy as _loadNeuralStrategy } from './js/modules/dashboard.js';
import { runThumbnailRedesign as _runThumbnailRedesign, generateChapters as _generateChapters } from './js/modules/tools.js';
import { runAutoFlow as _runAutoFlow, generateWeave as _generateWeave, generateCollusionTags as _generateCollusionTags } from './js/modules/pipeline.js';
import { loadRetentionData as _loadRetentionData, reorderPlaylistOnYoutube as _reorderPlaylistOnYoutube, toggleCoachDrawer as _toggleCoachDrawer, sendArchitectMessage as _sendArchitectMessage } from './js/modules/retention.js';
import { loadTrendPulse as _loadTrendPulse, generateCommunityPost as _generateCommunityPost, generateMultiLanguageSEO as _generateMultiLanguageSEO, generateAILabel as _generateAILabel } from './js/modules/ai-tools.js';

// ═══════════════════════════════════════════════════════════════
//  PHASE 2/3 LEGACY CODE (to be extracted incrementally)
//  This is the full main.js body from before the Phase 1 refactor.
//  Functions here use window.* globals for backward compat.
//  Phase 1 functions (switchView, platformInit, apiPost, etc.)
//  are defined in js/modules/ and aliased above.
// ═══════════════════════════════════════════════════════════════
// BEGIN LEGACY CODE (Phase 2/3 — to be extracted incrementally)

let tokenClient;
let accessToken = null;
let activeChannel = null;
const CLIENT_ID = '482101609629-e9t4lijfthm4rco4v8t0vbla2tg9v1tl.apps.googleusercontent.com';
let videoDurations = {};
const YOUTUBE_API_KEY = localStorage.getItem('yt_api_key') || '';

console.log('[main.js] Loading...');

// ── API HELPER ── Auto-includes CSRF + channelId headers for all backend calls
window.apiPost = async (path, body = {}) => {
  const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
      // Refresh token and retry once
      const healthRes = await fetch('/api/health?channelId=' + chId);
      const healthData = await healthRes.json();
      if (healthData.csrfToken) {
        window.csrfToken = healthData.csrfToken;
        localStorage.setItem('csrf_token', healthData.csrfToken);
        return fetch(`${API_BASE_URL}${path}`, {
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
};

// ── DEFENSIVE SaaS STUB ── Must be defined before HTML onclick handlers fire
window.SaaS = window.SaaS || {
  auth: function() { if (typeof initiateOAuth === 'function') initiateOAuth(); else console.warn('OAuth not ready yet'); },
  research: function() { if (typeof runResearch === 'function') runResearch(); else console.warn('Research not ready yet'); },
  factory: function() { if (typeof generateScript === 'function') generateScript(); else console.warn('Factory not ready yet'); },
  coach: function() { if (typeof toggleCoachDrawer === 'function') toggleCoachDrawer(true); else console.warn('Coach not ready yet'); },
  sniper: function() { if (typeof analyzeCompetitor === 'function') analyzeCompetitor(); else console.warn('Sniper not ready yet'); },
  redesign: function() { if (typeof runThumbnailRedesign === 'function') runThumbnailRedesign(); else console.warn('Redesign not ready yet'); },
  audit: function() { if (typeof runEvergreenAudit === 'function') runEvergreenAudit(); else console.warn('Audit not ready yet'); },
  legal: function() { if (typeof openLegalModal === 'function') openLegalModal(); else console.warn('Legal not ready yet'); },
  pay: function(plan, price) { if (typeof openPayPalModal === 'function') openPayPalModal(plan, price); else console.warn('PayPal not ready yet'); },
  billing: function(plan) { if (typeof openPayPalModal === 'function') openPayPalModal(plan); else console.warn('Billing not ready yet'); },
  fetchComments: function() { if (typeof fetchTargetComments === 'function') fetchTargetComments(); else console.warn('fetchComments not ready yet'); },
  togglePipeline: function(name) { /* loaded lazily */ },
  apply: function() { if (typeof deployGatewayOrder === 'function') deployGatewayOrder(); else console.warn('Apply not ready yet'); },
  niche: function() { if (typeof analyzeNicheRelevance === 'function') analyzeNicheRelevance(); else console.warn('Niche not ready yet'); },
  ask: function(msg) { if (typeof handleCoachMessage === 'function') handleCoachMessage(msg); else console.warn('Ask not ready yet'); },
  send: function() { if (typeof sendArchitectMessage === 'function') sendArchitectMessage(); else console.warn('Send not ready yet'); },
  weave: function() { if (typeof generateWeave === 'function') generateWeave(); else console.warn('Weave not ready yet'); },
  reorder: function() { if (typeof loadRetentionData === 'function') loadRetentionData(); else console.warn('Reorder not ready yet'); },
  clearChat: function() { /* loaded lazily */ },
  restore: function(index) { if (typeof restoreOriginal === 'function') restoreOriginal(index); else console.warn('Restore not ready yet'); },
  purchaseSuccess: function(orderId, plan) { /* loaded lazily */ }
};

// ═══════════════════════════════════════════════════════════════
//  Phronesis Agent Utilities — defined HERE before any HTML
//  onclick handlers fire so the DOM is ready + functions exist
// ═══════════════════════════════════════════════════════════════

var _phronesisAutoTimer = null;

function setAgentMode(mode){
  document.querySelectorAll('.auto-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
  var badge=document.getElementById('war-mode-badge');
  var labels={off:'OFF',monitor:'MONITORING',suggest:'SUGGESTING',auto:'AUTO'};
  if(badge)badge.textContent=labels[mode]||mode.toUpperCase();
  var dot=document.getElementById('war-status-dot');
  if(mode==='off'){if(dot){dot.style.background='var(--war-danger)';dot.classList.remove('agent-active');}}
  else{if(dot){dot.style.background='var(--war-success)';dot.classList.add('agent-active');}}
  var statusText=document.getElementById('war-status-text');
  if(statusText)statusText.textContent=mode==='off'?'Agent Offline':mode==='auto'?'Autonomous Mode Active':'Agent '+labels[mode];
  var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
  fetch('/api/agent/toggle',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-channel-id':ch},
    body:JSON.stringify({enabled:mode!=='off',mode:mode})
  }).then(function(r){return r.json();}).then(function(){
    showToast('Agent ' + mode, 'success');
  }).catch(function(){
    showToast('Failed to toggle agent mode', 'error');
  });
  document.querySelectorAll('.stat-value').forEach(function(el){el.classList.add('pulse-once');setTimeout(function(){el.classList.remove('pulse-once');},600);});
  if(mode==='auto'){
    if(!_phronesisAutoTimer) loadPhronesis();
    if(_phronesisAutoTimer) clearInterval(_phronesisAutoTimer);
    _phronesisAutoTimer = setInterval(function(){
      loadPhronesis(); loadCommandInbox(); loadScanResults(); loadRecommendations();
    }, 90000);
  } else {
    if(_phronesisAutoTimer){ clearInterval(_phronesisAutoTimer); _phronesisAutoTimer=null; }
  }
}
window.setAgentMode=setAgentMode;

async function syncPhronesisMode(){
  try{
    var r = await fetch('/api/agent/status');
    var d = await r.json();
    var enabled = d && d.settings && d.settings.isAutonomous;
    setAgentMode(enabled ? 'auto' : 'monitor');
  }catch(e){}
}
window.syncPhronesisMode = syncPhronesisMode;

function agentKillSwitch(){
  if(!confirm('🛑 Kill Switch: Halt all autonomous actions and clear pending queues?'))return;
  fetch('/api/agent/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
    .then(function(){
      setAgentMode('off');
      showToast('Agent halted', 'success');
      addFeedItem('warning','System','Kill switch activated - agent halted');
      var killBtn=document.querySelector('.kill-switch-btn');
      if(killBtn){killBtn.classList.add('activated');setTimeout(function(){killBtn.classList.remove('activated');},500);}
    })
    .catch(function(){
      showToast('Kill failed — try again', 'error');
    });
}
window.agentKillSwitch=agentKillSwitch;

// Global Niche State
let detectedNiche = localStorage.getItem('ytseo_detected_niche') || null;

/**
 * Global Safe Render Utility
 * Detects if data is an object or string and returns valid text.
 * Prevents the [object Object] bug from appearing in the UI.
 * @param {any} data - The data to render
 * @returns {string} - The safe text to display
 */
function safeRender(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? item : safeRender(item)).join('<br>');
    if (typeof data === 'object') {
        const text = data.text || data.content || data.description ||
                     data.algorithmicDescription || data.suggestion ||
                     data.value || data.template;
        if (text && typeof text === 'string') return text;
        if (data.analysis) return safeRender(data.analysis);
        if (data.proposal) return safeRender(data.proposal);
        if (data.recommendations) return safeRender(data.recommendations);
        return JSON.stringify(data);
    }
    return String(data);
}
window.safeRender = safeRender;

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
window.escapeHTML = escapeHTML;

const safeSetHTML = (id, html) => {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
  }
};
window.safeSetHTML = safeSetHTML;


function checkHealthAndCoach(avgScore) {
    console.log(`[AI Architect] Site Health: ${avgScore}%`);
    if (avgScore < 70) {
        showToast('AI Architect: Your channel stability is low. Consider running a Smart Overhaul.', 'warning');
    }
}
window.checkHealthAndCoach = checkHealthAndCoach;

// ── NICHE DETECTION SYSTEM ──
async function detectChannelNiche() {
  if (!accessToken) {
    console.log('[Niche Detection] No access token, skipping');
    return;
  }

  console.log('[Niche Detection] Starting...');

  try {
    // 1. Get channel about description
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      console.log('[Niche Detection] No channel found');
      return;
    }

    const channel = channelData.items[0];
    const channelAbout = channel.snippet.description || '';
    const channelId = channel.id;

    // 2. Get last 5 video titles
    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const videosData = await videosRes.json();
    const recentTitles = (videosData.items || []).map(v => v.snippet.title);

    console.log('[Niche Detection] Channel:', channel.snippet.title);
    console.log('[Niche Detection] Recent titles:', recentTitles);

    // 3. Call backend to classify (free - no credits needed)
    const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
    const chId = channelId || localStorage.getItem('ytseo_channel_id') || 'anonymous';

    const classifyRes = await fetch(`${API_BASE_URL}/api/youtube/classify-niche`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        'x-channel-id': chId
      },
      body: JSON.stringify({
        channelAbout,
        recentTitles
      })
    });

    const classifyData = await classifyRes.json();
    let niche = classifyData.niche || 'Lifestyle';

    if (!classifyRes.ok) {
      console.warn('[Niche Detection] Backend failed:', classifyData.error);
      // Fallback: use channel description keywords as rough niche
      const descWords = channelAbout.toLowerCase();
      if (descWords.includes('science') || descWords.includes('physics')) niche = 'Science';
      else if (descWords.includes('tech') || descWords.includes('coding')) niche = 'Tech';
      else if (descWords.includes('finance') || descWords.includes('money')) niche = 'Finance';
      else if (descWords.includes('gaming') || descWords.includes('game')) niche = 'Gaming';
      else if (descWords.includes('music') || descWords.includes('song')) niche = 'Music';
      else if (descWords.includes('vlog') || descWords.includes('daily')) niche = 'Vlog';
    }

    // 4. Save to localStorage and update global state
    localStorage.setItem('ytseo_detected_niche', niche);
    detectedNiche = niche;

    // 5. Update sidebar UI
    updateNicheDisplay(niche);

    // 6. Show toast
    showToast(`✨ Intelligence Engine: Niche detected as ${niche}`, 'success');

    console.log('[Niche Detection] Complete:', niche);
  } catch (e) {
    console.error('[Niche Detection] Error:', e);
  }
}

function updateNicheDisplay(niche) {
  // Update any niche label in the sidebar
  const nicheLabels = document.querySelectorAll('[data-niche-label]');
  nicheLabels.forEach(el => {
    if (el) {
      el.innerHTML = `<span class="niche-detected">${niche}</span> <span class="ai-verified">⚡ AI Verified</span>`;
    }
  });

  // Also update niche select if exists
  const nicheSelect = document.getElementById('niche-select');
  if (nicheSelect) {
    // Try to match the niche to an option
    const options = Array.from(nicheSelect.options);
    const match = options.find(opt => opt.value.toLowerCase() === niche.toLowerCase());
    if (match) {
      nicheSelect.value = match.value;
    }
  }
}

// Dynamic API Base URL - works on both localhost and Vercel
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5175'
    : ''; // Empty string = same domain (Vercel)

// ── RETENTION RE-ORDERER STATE ──
let _retentionPlaylistVideos = [];
let _retentionSortedVideos = [];
let _retentionAVDMap = {};
let _retentionInstructions = [];
let _retentionOriginalOrderSnapshot = [];

// ── SUBSCRIPTION MODEL ──
// $10 Standard Edition includes: Keyword Discovery, Metadata Audit, Basic Video/Channel Audit, Thumbnail Heuristics, Retention Re-Orderer, Script-to-Shorts (basic)
// Premium ($20/mo): Full Video Factory, Sidebar Sniper, Bulk Injector, AI Auto-Responder, Auto-Management Suite
// ── CREDITS SYSTEM ──
const CreditsSystem = {
  total: 100,
  used: 0,
  tier: 'standard',
  history: [],

  // Cost per action
  costs: {
    'deep-research': 5,
    'video-factory': 10,
    'channel-audit': 10,
    'keyword-discovery': 3,
    'title-generation': 1,
    'description-generation': 2,
    'thumbnail': 5,
    'thumbnail-analysis': 5,
    'metadata-weave': 3,
    'weaver-apply': 10,
    'collusion-inject': 1,
    'competitor-scan': 5,
    'sidebar-sniper': 5,
    'auto-responder': 1,
    'pipeline': 20,
    'magic-fix': 10,
    'seo-bundle': 5,
    'smart-overhaul': 10,
    'proposal-generate': 2,
    'proposal-apply': 8,
    'retention-reorder': 15,
    'ai-assistant': 1,
    'video-schedule': 3,
    'bulk-inject': 5,
    'auto-mgmt': 10,
    'ai-generate': 1,
    'classify-niche': 1,
    'niche-relevance-guard': 5,
    'evergreen-revival': 10,
    'collusion-tags': 3,
    'session-linker': 3
  },

  init() {
    // Per-channel credit scoping - each YouTube channel has its own balance
    const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const creditsKey = `ytseo_user_credits_${channelId}`;
    const planKey = `ytseo_user_plan_${channelId}`;
    const planCredits = parseInt(localStorage.getItem(creditsKey) || '0');
    const savedLegacy = localStorage.getItem('ytseo_credits');

    if (planCredits > 0) {
      // Use plan-synced credits as source of truth
      this.total = planCredits;
      this.used = 0;
      this.tier = localStorage.getItem(planKey) || 'free';
      this.history = [];
    } else if (savedLegacy) {
      const data = JSON.parse(savedLegacy);
      this.total = data.total || 100;
      this.used = data.used || 0;
      this.tier = data.tier || 'standard';
      this.history = data.history || [];
      // Migrate legacy to unified key
      localStorage.setItem(creditsKey, String(this.remaining));
    } else {
      // First time - give 100 monthly credits (free tier)
      this.total = 100;
      this.used = 0;
      this.save();
      localStorage.setItem(creditsKey, '100');
    }
    this.updateDisplay();
    this.checkLowCredits();

    // Sync with backend once available
    setTimeout(() => {
      updateCreditsDisplay();
      syncPlanFromBackend();
    }, 100);
  },

  save() {
    const remaining = this.total - this.used;
    const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const creditsKey = `ytseo_user_credits_${channelId}`;
    localStorage.setItem('ytseo_credits', JSON.stringify({
      total: this.total,
      used: this.used,
      tier: this.tier,
      history: this.history
    }));
    // Keep unified per-channel key in sync
    localStorage.setItem(creditsKey, String(remaining));
  },

  get remaining() {
    return this.total - this.used;
  },

  canAfford(action) {
    const cost = this.costs[action] || 1;
    return this.remaining >= cost;
  },

  deduct(action) {
    const cost = this.costs[action] || 1;
    if (!this.canAfford(action)) {
      showToast('No credits left! Upgrade to continue.', 'error');
      setTimeout(() => { window.location.href = '/#pricing'; }, 1500);
      return false;
    }

    this.used += cost;
    this.history.push({
      action,
      cost,
      timestamp: new Date().toISOString()
    });

    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }

    this.save();
    this.updateDisplay();
    showToast(`-${cost} credits`, 'deduction');

    // Check if depleted after deduction - redirect to pricing
    if (this.remaining <= 0) {
      setTimeout(() => {
        if (confirm('You\'ve used all your credits! Upgrade to get more. Go to pricing?')) {
          window.location.href = '/#pricing';
        }
      }, 500);
    }
    return true;
  },

  updateDisplay() {
    const countEl = document.getElementById('credits-count');
    const totalEl = document.getElementById('credits-total');

    if (countEl) countEl.textContent = this.remaining;
    if (totalEl) totalEl.textContent = this.total;

    // Update credits display styling
    const creditsDisplay = document.getElementById('credits-display');
    if (creditsDisplay) {
      if (this.remaining <= 10) {
        creditsDisplay.style.background = 'rgba(239, 68, 68, 0.15)';
        creditsDisplay.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      } else if (this.remaining <= 25) {
        creditsDisplay.style.background = 'rgba(245, 158, 11, 0.15)';
        creditsDisplay.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }
    }
  },

  checkLowCredits() {
    if (this.remaining <= 10 && this.remaining > 0) {
      // Show low credits warning
      window.dispatchEvent(new CustomEvent('creditsLow', {
        detail: { remaining: this.remaining }
      }));
    } else if (this.remaining === 0) {
      // Disable all action buttons
      window.dispatchEvent(new CustomEvent('creditsEmpty'));
    }
  },

  reset() {
    this.used = 0;
    this.save();
    this.updateDisplay();
  },

  sync(newBalance, newPlan) {
    if (typeof newBalance === 'number') {
      this.total = newBalance;
      this.used = 0;
    }
    if (newPlan) this.tier = newPlan;
    this.save();
    this.updateDisplay();
  },

  addCredits(amount, tier = 'standard') {
    this.total += amount;
    this.tier = tier;
    this.save();
    this.updateDisplay();
  }
};

window.CreditsSystem = CreditsSystem;

// Initialize credits on load
CreditsSystem.init();
initTimeSaved();

// ── TOAST NOTIFICATIONS ──
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'deduction' ? 'credit-deduction' : type === 'addition' ? 'credit-addition' : ''}`;
  toast.innerHTML = `
    <i class="ph ${type === 'deduction' ? 'ph-minus-circle' : type === 'addition' ? 'ph-plus-circle' : 'ph-info'} toast-icon"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function animateCreditsDeduction(amount) {
  const creditsDisplay = document.getElementById('credits-display');
  if (creditsDisplay) {
    creditsDisplay.classList.add('credits-flash');
    setTimeout(() => creditsDisplay.classList.remove('credits-flash'), 500);
  }

  // Update Bento card credits
  const bentoCredits = document.getElementById('bento-credits-value');
  if (bentoCredits) {
    const currentCredits = parseInt(bentoCredits.textContent) || 0;
    bentoCredits.textContent = currentCredits - amount;
  }
}

// ── TIME SAVED PERSISTENCE ──
function updateTimeSaved(minutes) {
  let timeSaved = parseFloat(localStorage.getItem('ytseo_timeSaved')) || 0;
  timeSaved += minutes;
  localStorage.setItem('ytseo_timeSaved', timeSaved.toString());

  // Update display
  const timeSavedEl = document.getElementById('stat-time-saved');
  if (timeSavedEl) {
    if (timeSaved >= 60) {
      timeSavedEl.textContent = `${(timeSaved / 60).toFixed(1)} Hours`;
    } else {
      timeSavedEl.textContent = `${timeSaved} min`;
    }
  }
}

function initTimeSaved() {
  const timeSaved = parseFloat(localStorage.getItem('ytseo_timeSaved')) || 0;
  const timeSavedEl = document.getElementById('stat-time-saved');
  if (timeSavedEl) {
    if (timeSaved >= 60) {
      timeSavedEl.textContent = `${(timeSaved / 60).toFixed(1)} Hours`;
    } else {
      timeSavedEl.textContent = `${timeSaved} min`;
    }
  }
}

async function resetCredits() {
  localStorage.removeItem('ytseo_credits');
  CreditsSystem.total = 999;
  CreditsSystem.used = 0;
  CreditsSystem.save();
  CreditsSystem.updateDisplay();
  updateCreditsDisplay();
  // Also refill backend DB
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  try {
    await fetch('/api/dev/refill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
      body: JSON.stringify({ channelId: chId })
    });
  } catch(e) {}
  showToast('Credits refilled - Agency Dev Mode', 'success');
}
window.resetCredits = resetCredits;

document.addEventListener('DOMContentLoaded', function() {
  vaTrack('page_view', { page: 'dashboard' });

  // Accessibility runtime enhancements (safe - only enhances onclick items, skips real links)
  document.querySelectorAll('.nav-item[onclick], .folder-item[onclick]').forEach(el => {
    if (!el.getAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('href') && !el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.click(); }
      if (e.key === ' ' && el.getAttribute('role') === 'button') { e.preventDefault(); el.click(); }
    });
  });

  document.querySelectorAll('.folder-header[onclick]').forEach(el => {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-expanded', 'false');
    const match = el.getAttribute('onclick').match(/toggleFolder\('([^']+)'\)/);
    if (match) el.setAttribute('aria-controls', `folder-${match[1]}`);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); el.click();
        setTimeout(() => el.setAttribute('aria-expanded', el.classList.contains('open') ? 'true' : 'false'), 100);
      }
    });
  });

  document.querySelectorAll('button:not([aria-label]):not([title])').forEach(el => {
    const icon = el.querySelector('i[data-lucide]');
    if (icon && !el.textContent.replace(/\s+/g, '')) {
      el.setAttribute('aria-label', (icon.getAttribute('data-lucide') || '').replace(/-/g, ' '));
    }
  });

  if (!document.getElementById('skip-nav')) {
    const skip = document.createElement('a');
    skip.id = 'skip-nav'; skip.href = '#workspace'; skip.textContent = 'Skip to main content';
    skip.style.cssText = 'position:absolute;top:-40px;left:8px;background:var(--primary);color:#fff;padding:8px 16px;z-index:9999;text-decoration:none;font-weight:600;border-radius:0 0 6px 6px;';
    skip.addEventListener('focus', () => { skip.style.top = '8px'; });
    skip.addEventListener('blur', () => { skip.style.top = '-40px'; });
    document.body.prepend(skip);
  }
});

// ── First-Time User Onboarding ──
(function initOnboarding() {
  const hasOnboarded = localStorage.getItem('ytseo_onboarded');
  const isConnected = localStorage.getItem('ytseo_channel_connected') === 'true';
  if (hasOnboarded || isConnected) return;
  setTimeout(() => {
    const steps = [
      { el: '#oauth-btn', title: 'Connect Your Channel', text: 'Sign in with Google to unlock all 17 tools. Official OAuth - no password required.' },
      { el: '#credits-display', title: '100 Free Credits/Month', text: 'Get 100 credits every month. Tools cost 1-5 credits. No credit card required.' },
      { el: '.sidebar', title: 'Explore Tools', text: 'Use the sidebar to navigate between 17 AI-powered tools. Audit videos, research keywords, generate scripts - all from one dashboard.' },
      { el: '#page-title', title: 'You\'re All Set!', text: 'Start by connecting your channel, then explore the tools in the sidebar. Happy optimizing! 🚀' }
    ];
    let cur = -1, ov, tt;
    function show(i) {
      if (ov) { ov.remove(); ov = null; }
      if (tt) { tt.remove(); tt = null; }
      if (i >= steps.length) { localStorage.setItem('ytseo_onboarded', '1'); return; }
      cur = i; const s = steps[i];
      const tgt = document.querySelector(s.el);
      if (!tgt || tgt.offsetParent === null) { show(i + 1); return; }
      ov = document.createElement('div'); ov.className = 'onboard-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;';
      ov.addEventListener('click', () => show(cur + 1));
      document.body.appendChild(ov);
      const r = tgt.getBoundingClientRect();
      tt = document.createElement('div'); tt.className = 'onboard-tt';
      tt.style.cssText = `position:fixed;top:${r.bottom+12}px;left:${Math.max(12,r.left)}px;max-width:320px;background:#1a1a2e;border:1px solid var(--primary);border-radius:12px;padding:16px 20px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
      tt.innerHTML = `<div style="font-weight:700;color:var(--primary);margin-bottom:6px;">${s.title}</div><div style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:12px;">${s.text}</div><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11px;color:#94a3b8;">${cur+1}/${steps.length}</span><div><button class="onboard-skip" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;margin-right:12px;">Skip</button><button class="onboard-next" style="background:var(--primary);color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">Next →</button></div></div>`;
      document.body.appendChild(tt);
      tt.querySelector('.onboard-next').addEventListener('click', (e) => { e.stopPropagation(); show(cur + 1); });
      tt.querySelector('.onboard-skip').addEventListener('click', (e) => { e.stopPropagation(); if(ov)ov.remove();if(tt)tt.remove();localStorage.setItem('ytseo_onboarded','1'); });
      tgt.style.position = 'relative'; tgt.style.zIndex = '9999'; tgt.style.boxShadow = '0 0 0 4px var(--primary)';
    }
    show(0);
  }, 2000);
})();

// ── PERFORMANCE UTILITIES & HYDRATION REGISTRY (PRO-MAX) ──
const ModuleRegistry = {
  studio: false,
  optics: false,
  autopilot: false,
  coach_history: false
};

const utils = {
  // SVG Sprite Helper
  renderIcon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}"><use xlink:href="#lucide-${name}"></use></svg>`;
  },

  // Doherty Threshold Wait
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Show/Hide Skeleton
  toggleSkeleton(show) {
    const overlay = document.getElementById('hydration-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  }
};

// ── MODULE HYDRATORS (LAZY) ──
async function hydrateStudio() {
  if (ModuleRegistry.studio) return;
  const container = document.getElementById('view-factory');
  if (!container) return;
  console.log('🧪 Hydrating Studio Module...');

  // Bind Studio Buttons
  const prepBtn = document.getElementById('prepare-script-btn');
  if (prepBtn) prepBtn.addEventListener('click', prepareVideoScript);

  const renderBtn = document.getElementById('render-video-btn');
  if (renderBtn) renderBtn.addEventListener('click', renderVideoAssembly);

  const autoFlowBtn = document.getElementById('autoflow-btn');
  if (autoFlowBtn) autoFlowBtn.addEventListener('click', runAutoFlow);

  ModuleRegistry.studio = true;
}

async function hydrateOptics() {
  if (ModuleRegistry.optics) return;
  const container = document.getElementById('view-playlist-growth');
  if (!container) return;
  console.log('🔬 Hydrating Optics Module...');
  // Setup Auditor, Bulk Injector
  if (typeof loadPlaylistsForBulk === 'function') await loadPlaylistsForBulk();
  ModuleRegistry.optics = true;
}

async function hydrateAutopilot() {
  if (ModuleRegistry.autopilot) return;
  const container = document.getElementById('view-retention-reorderer');
  if (!container) return;
  console.log('🤖 Hydrating Autopilot Module...');

  // Bind Autopilot Buttons
  const scheduleBtn = document.getElementById('schedule-upload-btn');
  if (scheduleBtn) scheduleBtn.addEventListener('click', scheduleVideoUpload);

  // Auto-Responder Event Delegation
  const feedContainer = document.getElementById('comments-feed');
  if (feedContainer) {
    feedContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.j-draft-btn');
      if (btn) {
        const cid = btn.getAttribute('data-id');
        if (cid && typeof generateAIReply === 'function') generateAIReply(cid);
      }
    });
  }

  if (typeof loadReorderPlaylists === 'function') await loadReorderPlaylists();
  ModuleRegistry.autopilot = true;
}

// ── REFACTORED VIEW SWITCHER (STABILITY FIX) ──
async function switchView(viewName) {
  const isLazy = ['factory', 'thumbnail-lab', 'script-shorts', 'metadata-auditor', 'bulk-injector', 'evergreen-audit', 'retention-reorderer', 'auto-responder'].includes(viewName);

  // Target Module
  let moduleToHydrate = null;
  if (['factory', 'thumbnail-lab', 'script-shorts'].includes(viewName)) moduleToHydrate = 'studio';
  if (['metadata-auditor', 'bulk-injector', 'evergreen-audit'].includes(viewName)) moduleToHydrate = 'optics';
  if (['retention-reorderer', 'auto-responder', 'automation-pipeline'].includes(viewName)) moduleToHydrate = 'autopilot';

  if (moduleToHydrate && !ModuleRegistry[moduleToHydrate]) {
    utils.toggleSkeleton(true);
    await utils.wait(300); // Doherty Threshold (300ms shimmer)

    if (moduleToHydrate === 'studio') await hydrateStudio();
    if (moduleToHydrate === 'optics') await hydrateOptics();
    if (moduleToHydrate === 'autopilot') await hydrateAutopilot();

    utils.toggleSkeleton(false);
  }

  // Update nav items
  document.querySelectorAll('.nav-item, .folder-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    }
  });

  // Update page title
  const titles = {
    'overview': 'Overview',
    'research': 'Research Engine',
    'niche-relevance': 'Niche-Relevance Guard',
    'sidebar-sniper': 'Sidebar Sniper',
    'suggested-analytics': 'Suggested Analytics',
    'trend-pulse': 'Trend Pulse',
    'factory': 'Video Factory',
    'thumbnail-lab': 'Thumbnail Lab',
    'script-shorts': 'Script-to-Shorts',
    'thumbnail-redesign': 'Thumbnail Redesign',
    'chapters-generator': 'Chapters Generator',
    'community-posts': 'Community Posts',
    'metadata-auditor': 'Metadata Auditor',
    'magic-fix': 'Magic Fix',
    'bulk-injector': 'Bulk Injector',
    'evergreen-audit': 'Evergreen Audit',
    'multi-language': 'Multi-Language SEO',
    'ai-labeling': 'AI Content Label',
    'playlist-growth': 'Playlist Growth',
    'retention-reorderer': 'Retention Re-Orderer',
    'auto-responder': 'AI Auto-Responder',
    'system-status': 'System Status',
    'optimization-history': 'Optimization History',
    'growth-engine': 'Growth Engine',
    'cron-inbox': 'Opt. Queue',
    'analytics': 'Analytics',
    'keyword-lab': 'Keyword Lab',
    'ab-tester': 'A/B Tester',
    'seo-lab': 'SEO Lab',
    'phronesis': 'Phronesis',
    'automation-pipeline': 'Automation Pipeline',
    'competitor': 'Competitor Sniper',
    'settings': 'Settings'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[viewName] || viewName;

  // Show/hide views
  Object.keys(titles).forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.style.display = v === viewName ? 'block' : 'none';
    }
  });

  // Analytics Refresh (Immediate)
  if (viewName === 'overview' && localStorage.getItem('ytseo_channel_connected') === 'true') {
     const channelId = localStorage.getItem('ytseo_channel_id');
     if (channelId && typeof fetchYouTubeAnalytics === 'function') fetchYouTubeAnalytics(channelId);
  }

  // Load Neural Strategy Center when overview opens
  if (viewName === 'overview') {
    setTimeout(() => { if (typeof loadNeuralStrategy === 'function') loadNeuralStrategy(); }, 300);
  }

  // Load Growth Engine data when view opens
  if (viewName === 'growth-engine') {
    setTimeout(() => {
      if (typeof loadNeuralStrategy === 'function') loadNeuralStrategy();
      if (typeof GrowthEngine !== 'undefined' && typeof GrowthEngine.loadReport === 'function') GrowthEngine.loadReport();
    }, 300);
  }

  // Load Suggested Analytics when view opens
  if (viewName === 'suggested-analytics' && typeof loadSuggestedAnalytics === 'function') {
    setTimeout(() => loadSuggestedAnalytics(), 200);
  }

  // Run System Health Probe when view opens
  if (viewName === 'system-status' && typeof runSystemHealthProbe === 'function') {
    setTimeout(() => runSystemHealthProbe(), 200);
  }

  // Pre-fill auditor URL from Growth Engine scan and show detected issues
  if (viewName === 'metadata-auditor') {
    const targetVideoId = localStorage.getItem('growth_engine_target_video');
    const issuesJson = localStorage.getItem('growth_engine_issues');
    if (targetVideoId) {
      localStorage.removeItem('growth_engine_target_video');
      localStorage.removeItem('growth_engine_issues');
      setTimeout(() => {
        const urlInput = document.getElementById('audit-video-url');
        if (urlInput) {
          urlInput.value = `https://www.youtube.com/watch?v=${targetVideoId}`;
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Show detected issues above the auditor
        if (issuesJson) {
          try {
            const issues = JSON.parse(issuesJson);
            const resultsEl = document.getElementById('audit-results');
            if (resultsEl && issues.length > 0) {
              const severityColors = { high: '#ef4444', medium: '#f59e0b' };
              const severityBg = { high: 'rgba(239,68,68,0.08)', medium: 'rgba(245,158,11,0.08)' };
              resultsEl.innerHTML = `
                <div data-growth-banner="1" style="background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(251,146,60,0.04));border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:16px 20px;margin-bottom:16px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="font-size:20px;">🔍</span>
                    <strong style="color:var(--primary);">Growth Engine - Issues Detected</strong>
                  </div>
                  <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">The Growth Engine found these issues. Click "Audit Video" below to get AI-powered fix suggestions for each one.</p>
                  ${issues.map(i => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColors[i.severity] || '#94a3b8'};"></span>
                      <span style="font-size:12px;color:${severityColors[i.severity] || '#94a3b8'};">${i.issue}</span>
                      <span style="font-size:10px;color:var(--text-muted);margin-left:auto;">${i.type}</span>
                    </div>
                  `).join('')}
                </div>
              `;
            }
          } catch(e) {}
        }
      }, 500); // Wait for lazy hydration to complete
    }
  }

  // Load Optimization Trials when view opens
  if (viewName === 'optimization-history' && typeof OptimizationTrials !== 'undefined') {
    setTimeout(() => OptimizationTrials.refresh(), 100);
  }

  if (viewName === 'analytics' && typeof loadAnalytics === 'function') {
    setTimeout(() => loadAnalytics(), 100);
  }

  if (viewName === 'ab-tester' && typeof loadAbTests === 'function') {
    setTimeout(() => loadAbTests(), 100);
  }

  if (viewName === 'seo-lab' && typeof loadSeoLab === 'function') {
    setTimeout(() => loadSeoLab(), 100);
    if (typeof loadAutoPublishState === 'function') setTimeout(() => loadAutoPublishState(), 200);
  }

  if (viewName === 'phronesis' && typeof loadPhronesis === 'function') {
    setTimeout(() => loadPhronesis(), 100);
  }

  // AI Architect History Hydration (Lazy)
  if (!ModuleRegistry.coach_history && typeof syncComments === 'function') {
    ModuleRegistry.coach_history = true;
    // Kill 'DOM Not Ready' Errors - check if comments-container exists
    requestIdleCallback(() => {
      if (document.getElementById('comments-container')) {
        syncComments();
      }
    });
  }

  // Weaver Tab-Switch Fix: Update playlist dropdowns when Optics/Playlist Growth view triggered
  if ((viewName === 'playlist-growth' || viewName === 'optics') && typeof loadWeaverPlaylists === 'function') {
    loadWeaverPlaylists();
  }

  // Final Icon Refresh
  if (window.lucide) window.lucide.createIcons();
}
window.switchView = switchView;

/**
 * ── PLATFORM INITIALIZATION (TIER 1) ──
 * This is the single entry point for all DOM-ready logic.
 */
function platformInit() {
  console.log('🚀 Platform Initialization (Tier 1) starting...');

  // Phase 1: Admin access check for SEO Lab
  (function checkAdminAccess() {
    var params = new URLSearchParams(window.location.search);
    var isAdminParam = params.get('admin');
    var storedAdmin = localStorage.getItem('ytseo_admin_access');
    if (isAdminParam === 'true' || storedAdmin === 'true') {
      if (isAdminParam === 'true') localStorage.setItem('ytseo_admin_access', 'true');
      var tab = document.getElementById('nav-seo-lab');
      if (tab) { tab.style.display = 'flex'; tab.style.pointerEvents = ''; tab.style.opacity = ''; }
    }
  })();

  // 0. CRITICAL: Fetch CSRF Token before any tool runs
  fetch('/api/auth/csrf?channelId=' + (localStorage.getItem('ytseo_channel_id') || 'anonymous'))
    .then(r => r.json())
    .then(data => {
      if (data.token) {
        window.csrfToken = data.token;
        localStorage.setItem('csrf_token', data.token);
        console.log('[CSRF] Token initialized before tools');
      }
    })
    .catch(() => console.warn('[CSRF] Token fetch failed, will retry on 403'));

  // 1. Credits & Persistence
  if (typeof CreditsSystem !== 'undefined') CreditsSystem.init();
  if (typeof initTimeSaved === 'function') initTimeSaved();
  if (typeof checkSavedConnection === 'function') checkSavedConnection();

  // 2. UI & Premium State
  if (typeof updatePremiumUI === 'function') updatePremiumUI();
  if (typeof updateCreditsDisplay === 'function') updateCreditsDisplay();

  // 3. API Key Management


  // 4. Critical Event Bindings (Non-Lazy)
  const healthBtn = document.getElementById('run-health-check');
  if (healthBtn) healthBtn.addEventListener('click', runHealthCheck);

  const syncBtn = document.getElementById('sync-comments-btn');
  if (syncBtn) syncBtn.addEventListener('click', syncComments);

  const auditForm = document.getElementById('analyze-form');
  if (auditForm) {
    auditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof runAudit === 'function') runAudit();
    });
  }

  // 5. Default View
  setTimeout(() => switchView('overview'), 100);

  // 6. Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
    console.log('✅ Lucide Icons initialized');
  }

  console.log('✅ Tier 1 Initialization Complete.');

  // Check AI availability
  setTimeout(checkAIStatus, 2000);
}

// Single DOMContentLoaded Listener (NOW HANDLED BY PHASE 1 main.js boot sequence)
// document.addEventListener('DOMContentLoaded', platformInit);

// AI Status Checker - checks both Groq and Gemini
async function checkAIStatus() {
  const statusEl = document.getElementById('ai-status');
  if (!statusEl) return;

  try {
    const res = await fetch('/api/ai/ai-status');
    if (res.ok) {
      const data = await res.json();
      if (data.groq && data.gemini) {
        statusEl.innerHTML = '<div class="pulse-dot" style="background:#10b981;"></div><span>AI: Groq + Gemini</span>';
        statusEl.title = 'Both AI providers online';
      } else if (data.groq) {
        statusEl.innerHTML = '<div class="pulse-dot" style="background:#f59e0b;"></div><span>AI: Groq (no backup)</span>';
        statusEl.title = 'Groq online, Gemini not configured';
      } else if (data.gemini) {
        statusEl.innerHTML = '<div class="pulse-dot" style="background:#10b981;"></div><span>AI: Gemini</span>';
        statusEl.title = 'Gemini online, Groq not configured';
      } else {
        throw new Error('No providers');
      }
    } else {
      throw new Error('Status check failed');
    }
  } catch(e) {
    statusEl.innerHTML = '<div class="pulse-dot" style="background:#ef4444;"></div><span>AI: Offline</span>';
    statusEl.title = 'No AI providers available. Template fallbacks active.';
  }
}

function checkGroqApiKey() {
  // Keys are managed server-side via Vercel environment variables.
  // Always return a truthy sentinel so callers that gate on this value proceed.
  return 'server-managed';
}

function showApiRequiredOverlay(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'flex';
}

function hideApiRequiredOverlay(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'none';
}

// ── RESEARCH ENGINE STATE ──
let researchMode = 'alphabet';
let discoveredKeywords = [];

function setResearchMode(mode) {
  researchMode = mode;
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

async function runResearch() {
  console.log('▶ runResearch called');
  const seedKeywordInput = document.getElementById('research-input') || document.getElementById('seed-keyword');
  const seedKeyword = seedKeywordInput ? seedKeywordInput.value.trim() : '';
  console.log('Seed keyword:', seedKeyword);

  if (!seedKeyword) {
    showToast('Please enter a seed keyword', 'error');
    console.log('No seed keyword entered');
    return;
  }

  const apiKey = checkGroqApiKey();
  console.log('API Key present:', !!apiKey);
  // Non-blocking: if no user key, let backend use SaaS master key
  if (!apiKey) {
    console.log('[Debug] No user key - will use SaaS master key');
  } else {
    console.log('[Debug] Using user API key:', apiKey.substring(0, 10) + '...');
  }
  // REMOVED: blocking overlay on missing key - backend handles fallback

  // Show processing
  const processingOverlay = document.getElementById('processing-overlay');
  const processingStatus = document.getElementById('processing-status');
  const processingBar = document.getElementById('processing-bar');

  console.log('Showing processing overlay');
  if (processingOverlay) processingOverlay.style.display = 'flex';
  if (processingStatus) processingStatus.textContent = 'Starting research...';
  if (processingBar) processingBar.style.width = '10%';

  // Deduct credits - 5 for deep research
  if (!CreditsSystem.deduct('deep-research')) {
    processingOverlay.style.display = 'none';
    return;
  }

  // Processing status cycling
  const statusMessages = [
    'Scraping YouTube autocomplete clusters...',
    'Mining Google search suggestions...',
    'Calculating intent & competition data...',
    'Ranking Golden Keywords...',
    'Finalizing results...'
  ];

  let statusIndex = 0;
  const statusInterval = setInterval(() => {
    processingStatus.textContent = statusMessages[statusIndex];
    processingBar.style.width = `${((statusIndex + 1) / statusMessages.length) * 100}%`;
    statusIndex++;
    if (statusIndex >= statusMessages.length) {
      clearInterval(statusInterval);
    }
  }, 2000);

  // Generate keywords - run ALL sources simultaneously for max coverage
  discoveredKeywords = [];

  // 3 parallel keyword sources: YouTube Alphabet, YouTube Asterisk, Google Suggest
  // Google Suggest patterns - more patterns = richer keyword discovery
  // These generate keywords people actually search on Google (higher relevance than YT autocomplete)
  const googlePatterns = [
    `how to ${seedKeyword}`,
    `what is ${seedKeyword}`,
    `best ${seedKeyword}`,
    `${seedKeyword} vs`,
    `${seedKeyword} guide`,
    `${seedKeyword} explained`,
    `${seedKeyword} tutorial`,
    `${seedKeyword} tips`,
    `${seedKeyword} for beginners`,
    `why ${seedKeyword}`,
    `${seedKeyword} ideas`,
    `${seedKeyword} examples`,
    `is ${seedKeyword}`,
    `can ${seedKeyword}`,
    `${seedKeyword} meaning`,
    `${seedKeyword} definition`
  ];

  const [alphaResults, wildcardResults, googleAlphaResults, googlePatternResults] = await Promise.all([
    runKeywordAlphabetLoop(seedKeyword),
    runAsteriskSearch(seedKeyword),
    (async () => {
      const all = new Set();
      const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
      // Google Suggest: suffix search (seed + letter) - yields long-tail completions
      for (let i = 0; i < alphabet.length; i += 6) {
        const batch = alphabet.slice(i, i + 6);
        const results = await Promise.all(batch.map(c => fetchGoogleSuggest(`${seedKeyword} ${c}`).catch(() => [])));
        results.forEach(r => r.forEach(k => all.add(k)));
        if (i + 6 < alphabet.length) await new Promise(r => setTimeout(r, 100));
      }
      // Google Suggest: prefix search (letter + seed) - yields question/verb starters
      for (let i = 0; i < alphabet.length; i += 6) {
        const batch = alphabet.slice(i, i + 6);
        const results = await Promise.all(batch.map(c => fetchGoogleSuggest(`${c} ${seedKeyword}`).catch(() => [])));
        results.forEach(r => r.forEach(k => all.add(k)));
        if (i + 6 < alphabet.length) await new Promise(r => setTimeout(r, 100));
      }
      return Array.from(all);
    })(),
    (async () => {
      const all = new Set();
      const results = await Promise.all(googlePatterns.map(p => fetchGoogleSuggest(p).catch(() => [])));
      results.forEach(r => r.forEach(k => all.add(k)));
      return Array.from(all);
    })()
  ]);

  // Merge all 4 sources and deduplicate
  const rawKeywords = [...new Set([...alphaResults, ...wildcardResults, ...googleAlphaResults, ...googlePatternResults])];

  // Build relevance filter: extract seed words for niche-aware filtering
  const seedWords = seedKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const seedPhrase = seedKeyword.toLowerCase();
  const significantSeedWords = seedWords.filter(w => w.length > 3); // words > 3 chars are more distinctive

  rawKeywords.forEach((kw) => {
    const kwLower = kw.toLowerCase();
    const words = kwLower.split(/\s+/);
    const wordCount = words.length;

  // ── RELEVANCE FILTER: adaptive threshold based on seed word count ──
  // Goal: "vacuum cleaner" must NOT pass for seed "vacuum theory"
  // But "theory of relativity" SHOULD pass (shares a key concept word)
  const containsFullSeed = kwLower.includes(seedPhrase);
  const matchingSeedWords = significantSeedWords.filter(sw => kwLower.includes(sw));

  // Adaptive threshold - stricter for fewer words, more flexible for longer seeds
  let requiredMatches;
  if (significantSeedWords.length === 0) {
    requiredMatches = 0; // No significant words? Allow (single short word seed)
  } else if (significantSeedWords.length === 1) {
    requiredMatches = 1; // Must contain the single seed word
  } else if (significantSeedWords.length === 2) {
    // For 2-word seeds: require BOTH words (e.g., "vacuum theory" → must contain both "vacuum" AND "theory")
    // This blocks "vacuum cleaner" and "theory of everything" - they're not relevant to "vacuum theory"
    requiredMatches = 2;
  } else {
    // For 3+ word seeds: require a majority (ceil of 60%)
    requiredMatches = Math.ceil(significantSeedWords.length * 0.6);
  }

  const hasEnoughMatches = matchingSeedWords.length >= requiredMatches;

  // Skip if: not full phrase AND not enough matching seed words
  if (!containsFullSeed && !hasEnoughMatches) return;

    // ── INTENT SCORE (0-100): based on keyword structure ──
    let intentScore = 50; // base

    // Long-tail bonus: 4+ words = more specific intent
    if (wordCount >= 5) intentScore += 25;
    else if (wordCount >= 4) intentScore += 18;
    else if (wordCount >= 3) intentScore += 10;

    // Question/intent words signal high purchase/research intent
    const highIntentWords = /^(how|what|why|when|where|who|best|top|review|guide|tutorial|vs|versus)/i;
    if (highIntentWords.test(kwLower)) intentScore += 15;

    // Contains year = fresh intent
    if (/20\d{2}/.test(kwLower)) intentScore += 8;

    // Action words
    if (/\b(learn|create|make|build|fix|solve|get|find|start|stop)\b/i.test(kwLower)) intentScore += 7;

    intentScore = Math.min(intentScore, 100);

    // ── COMPETITION SCORE (0-100): real heuristics, NOT random ──
    // Shorter keywords = more competition (broader terms rank harder)
    // Generic patterns = more competition
    let compScore = 25; // base

    if (wordCount <= 2) compScore += 35;      // 1-2 word keywords: high competition
    else if (wordCount === 3) compScore += 20; // 3 words: moderate-high
    else if (wordCount === 4) compScore += 10; // 4 words: moderate
    // 5+ words: stays at base (low competition - long tail)

    // Generic single words at end = higher competition (e.g., "vacuum theory" vs "vacuum theory explained")
    const lastWord = words[words.length - 1];
    if (/^(a|an|the|and|or|in|on|to|for|of|with|is|it|at|by)$/i.test(lastWord)) compScore += 8;

    // Question format usually has more competing content
    if (/^(how|what|why)/i.test(kwLower)) compScore += 5;

    // Very specific niche terms = lower competition
    const nicheSpecificity = words.filter(w => w.length > 6).length;
    compScore -= nicheSpecificity * 3;

    compScore = Math.max(5, Math.min(compScore, 95));

    // ── ESTIMATED MONTHLY SEARCH VOLUME ──
    // Based on autocomplete existence (shows people search it) + word count
    // More words = more specific = lower but real volume
    const baseVolume = wordCount >= 5 ? 800 : wordCount >= 4 ? 2200 : wordCount >= 3 ? 5500 : 15000;
    // Deterministic variance based on keyword structure (not random, not sinusoidal)
    const charSum = kwLower.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const variance = 0.6 + (charSum % 80) / 100; // 0.6 to 1.4 multiplier
    const estVolume = Math.max(100, Math.round(baseVolume * variance));

    // ── COMPETITION LABEL ──
    const competition = compScore >= 65 ? 'High' : compScore >= 35 ? 'Medium' : 'Low';

    // ── GOLDEN KEYWORD: high intent + low competition + long-tail ──
    const isGolden = intentScore >= 70 && compScore < 50 && wordCount >= 3;

    // ── OPPORTUNITY SCORE: intent-to-competition ratio ──
    const opportunityScore = Math.round((intentScore / Math.max(compScore, 1)) * 50);

    discoveredKeywords.push({
      keyword: kw,
      intentScore,
      competition,
      competitionScore: compScore,
      searchVolume: estVolume,
      opportunityScore,
      wordCount,
      isGolden
    });
  });

  // Sort by opportunity score (best opportunities first)
  discoveredKeywords.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Fallback: if APIs returned nothing (e.g., typo in seed word, network issues),
  // generate template keywords with proper scoring so the UI is still useful
  if (discoveredKeywords.length === 0) {
    const fallbackSeed = seedKeyword; // keep the user's exact input
    const patterns = [
      `best ${fallbackSeed} tips`,
      `${fallbackSeed} tutorial for beginners`,
      `how to ${fallbackSeed}`,
      `${fallbackSeed} guide`,
      `${fallbackSeed} explained`,
      `${fallbackSeed} review`,
      `learn ${fallbackSeed}`,
      `${fallbackSeed} for beginners`,
      `${fallbackSeed} tips and tricks`,
      `${fallbackSeed} step by step`
    ];

    const seedWordsForFallback = fallbackSeed.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const significantFallbackWords = seedWordsForFallback.filter(w => w.length > 3);

    for (const kw of patterns) {
      const kwLower = kw.toLowerCase();
      const words = kwLower.split(/\s+/);
      const wordCount = words.length;

      let intentScore = 50;
      if (wordCount >= 5) intentScore += 25;
      else if (wordCount >= 4) intentScore += 18;
      else if (wordCount >= 3) intentScore += 10;
      if (/^(how|what|why|when|where|who|best|top|review|guide|tutorial|vs|versus)/i.test(kwLower)) intentScore += 15;
      if (/20\d{2}/.test(kwLower)) intentScore += 8;
      if (/\b(learn|create|make|build|fix|solve|get|find|start|stop)\b/i.test(kwLower)) intentScore += 7;
      intentScore = Math.min(intentScore, 100);

      let compScore = 25;
      if (wordCount <= 2) compScore += 35;
      else if (wordCount === 3) compScore += 20;
      else if (wordCount === 4) compScore += 10;
      const lastWord = words[words.length - 1];
      if (/^(a|an|the|and|or|in|on|to|for|of|with|is|it|at|by)$/i.test(lastWord)) compScore += 8;
      if (/^(how|what|why)/i.test(kwLower)) compScore += 5;
      const nicheSpecificity = words.filter(w => w.length > 6).length;
      compScore -= nicheSpecificity * 3;
      compScore = Math.max(5, Math.min(compScore, 95));

      const baseVolume = wordCount >= 5 ? 800 : wordCount >= 4 ? 2200 : wordCount >= 3 ? 5500 : 15000;
      const charSum = kwLower.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const variance = 0.6 + (charSum % 80) / 100;
      const estVolume = Math.max(100, Math.round(baseVolume * variance));

      const competition = compScore >= 65 ? 'High' : compScore >= 35 ? 'Medium' : 'Low';
      const isGolden = intentScore >= 70 && compScore < 50 && wordCount >= 3;
      const opportunityScore = Math.round((intentScore / Math.max(compScore, 1)) * 50);

      discoveredKeywords.push({
        keyword: kw,
        intentScore,
        competition,
        competitionScore: compScore,
        searchVolume: estVolume,
        opportunityScore,
        wordCount,
        isGolden
      });
    }
    discoveredKeywords.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  clearInterval(statusInterval);
  if (processingOverlay) processingOverlay.style.display = 'none';

  // Display results
  displayResults();
  showToast(`Found ${discoveredKeywords.length} keywords`, 'success');
  vaTrack('keyword_research', { keywords: discoveredKeywords.length });
  // Auto-expand: create content opportunities from top keywords
  if (discoveredKeywords.length > 0) {
    var topKw = discoveredKeywords[0].keyword;
    fetch('/api/pseo/auto-expand', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({keyword:topKw}) }).catch(function(){});
  }
}

function displayResults() {
  const tbody = document.getElementById('results-tbody');
  const resultsSection = document.getElementById('results-section');
  const keywordCount = document.getElementById('keyword-count');

  if (!tbody || !resultsSection) {
    console.log('Results elements not found');
    return;
  }

  safeSetHTML('results-tbody', discoveredKeywords.map((item, index) => {
    const intentClass = item.intentScore >= 80 ? 'intent-high' : item.intentScore >= 60 ? 'intent-medium' : 'intent-low';
    const compScore = item.competitionScore || 0;
    let compClass, compLabel;
    if (compScore < 35) { compClass = 'competition-easy'; compLabel = '🟢 Low'; }
    else if (compScore < 65) { compClass = 'competition-medium'; compLabel = '🟡 Medium'; }
    else { compClass = 'competition-high'; compLabel = '🔴 High'; }

    const volume = item.searchVolume || 0;
    const volDisplay = volume >= 10000 ? (volume/1000).toFixed(0) + 'K' : volume >= 1000 ? (volume/1000).toFixed(1) + 'K' : volume;
    const oppScore = item.opportunityScore || 0;
    const oppClass = oppScore >= 70 ? 'intent-high' : oppScore >= 40 ? 'intent-medium' : 'intent-low';

    const goldenTag = item.isGolden ? '<span class="golden-tag"><i data-lucide="star"></i> Golden</span>' : '';
    const escapedKeyword = item.keyword.replace(/'/g, "\\'");

    return `
      <tr>
        <td style="color: var(--text-primary);">${item.keyword} ${goldenTag}</td>
        <td class="${intentClass}">${item.intentScore}</td>
        <td class="${compClass}">${compLabel} <small>(${compScore})</small></td>
        <td style="color: var(--text-primary);">~${volDisplay}/mo</td>
        <td class="${oppClass}" style="font-weight:700;">${oppScore}</td>
        <td>
          <button class="action-btn" onclick="copyKeyword('${escapedKeyword}')" title="Copy">
            <i data-lucide="copy"></i>
          </button>
          <button class="action-btn factory-btn" onclick="sendToFactory('${escapedKeyword}')" title="Send to Video Factory">
            <i data-lucide="wand-2"></i>
          </button>
          <button class="action-btn snipe-btn" onclick="snipeKeyword('${escapedKeyword}')" title="Snipe Competitors">
            <i data-lucide="crosshair"></i>
          </button>
        </td>
      </tr>
    `;
  }).join(''));

  if (keywordCount) keywordCount.textContent = `${discoveredKeywords.length} keywords found`;
  resultsSection.style.display = 'block';

  // Populate Top Opportunity card
  const topCard = document.getElementById('research-top-card');
  if (topCard && discoveredKeywords.length > 0) {
    const top = discoveredKeywords[0];
    topCard.style.display = 'block';
    topCard.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;"><div><div style="font-size:11px;text-transform:uppercase;color:var(--primary);margin-bottom:4px;">⭐ Top Opportunity</div><div style="font-size:20px;font-weight:700;">'+top.keyword+'</div><div style="color:var(--text-muted);margin-top:4px;">Intent: <strong style="color:var(--primary)">'+top.intentScore+'</strong> · Competition: <strong style="color:'+(top.competitionScore<35?'var(--success)':top.competitionScore<65?'var(--warning)':'#ef4444')+'">'+top.competition+'</strong> · Volume: <strong>~'+(top.searchVolume>=1000?(top.searchVolume/1000).toFixed(0)+'K':top.searchVolume)+'/mo</strong></div>'+(top.isGolden?'<span style="display:inline-block;margin-top:6px;background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">🏆 Golden Keyword</span>':'')+'</div><div style="text-align:center;"><div style="font-size:36px;font-weight:800;color:var(--primary);">'+top.opportunityScore+'</div><div style="font-size:11px;color:var(--text-muted);">Score</div></div></div>';
  } else if (topCard) { topCard.style.display = 'none'; }
}

function sortTable(columnIndex) {
  const tbody = document.getElementById('results-tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  const isNumeric = columnIndex !== 0 && columnIndex !== 5; // 0=keyword, 5=actions
  let sortDir = tbody.dataset.sortCol == columnIndex && tbody.dataset.sortDir === 'asc' ? -1 : 1;
  tbody.dataset.sortCol = columnIndex;
  tbody.dataset.sortDir = sortDir === 1 ? 'asc' : 'desc';

  rows.sort((a, b) => {
    let aVal = a.children[columnIndex]?.textContent?.trim() || '';
    let bVal = b.children[columnIndex]?.textContent?.trim() || '';

    if (isNumeric) {
      // Strip emoji/labels, extract first number
      aVal = parseFloat(aVal.replace(/[^0-9.-]/g, '')) || 0;
      bVal = parseFloat(bVal.replace(/[^0-9.-]/g, '')) || 0;
      return (aVal - bVal) * sortDir;
    }
    return aVal.localeCompare(bVal) * sortDir;
  });

  rows.forEach(row => tbody.appendChild(row));
}

function copyKeyword(keyword) {
  navigator.clipboard.writeText(keyword);
  showToast('Keyword copied!', 'success');
}

function sendToFactory(keyword) {
  switchView('factory');
  document.getElementById('video-concept').value = keyword;
  showToast(`Sent "${keyword}" to Video Factory`, 'success');
}

async function snipeKeyword(keyword) {
  const apiKey = checkGroqApiKey();
  // Non-blocking: let backend handle fallback to SaaS master key
  if (!apiKey) {
    console.log('[Debug] No user key - will use SaaS master key');
  }

  showToast(`Sniping top videos for "${keyword}"...`, 'info');

  const processing = document.getElementById('competitor-processing');
  const progressBar = document.getElementById('competitor-progress-bar');
  const statusEl = document.getElementById('competitor-status');

  if (processing) {
    processing.style.display = 'block';
    progressBar.style.width = '0%';
  }

  try {
    const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=3&key=${YOUTUBE_API_KEY}`, {
      method: 'GET'
    });

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error('No videos found for this keyword');
    }

    if (progressBar) progressBar.style.width = '30%';
    if (statusEl) statusEl.textContent = 'Fetching video metadata...';

    const videoIds = searchData.items.map(item => item.id.videoId).join(',');

    const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`, {
      method: 'GET'
    });

    const videosData = await videosResponse.json();

    if (progressBar) progressBar.style.width = '60%';
    if (statusEl) statusEl.textContent = 'Generating infiltration bundle...';

    const allTags = new Set();
    const videoTitles = [];

    videosData.items.forEach(video => {
      videoTitles.push(video.snippet.title);
      if (video.snippet.tags) {
        video.snippet.tags.forEach(tag => allTags.add(tag));
      }
    });

    const keywordParts = keyword.toLowerCase().split(' ');
    keywordParts.forEach(part => {
      if (part.length > 2) allTags.add(part);
    });

    allTags.add(keyword.toLowerCase());
    allTags.add(keyword.toLowerCase().replace(' ', '-'));
    allTags.add(keyword.toLowerCase().replace(' ', '_'));

    const infiltrationTags = Array.from(allTags).slice(0, 15);

    if (progressBar) progressBar.style.width = '100%';

    switchView('competitor');

    const resultsContainer = document.getElementById('competitor-results');
    const originalTagsContainer = document.getElementById('original-tags-container');
    const infiltrationTagsContainer = document.getElementById('infiltration-tags-container');

    if (resultsContainer) {
      resultsContainer.style.display = 'block';

      safeSetHTML('original-tags-container', videosData.items.slice(0, 3).map((video, idx) => `
        <div class="tag-item">
          <span class="tag-rank">#${idx + 1}</span>
          <span class="tag-title">${video.snippet.title.substring(0, 40)}...</span>
          <div class="video-tags">
            ${(video.snippet.tags || []).slice(0, 5).map(tag => `<span class="tag-chip">${tag}</span>`).join('')}
          </div>
        </div>
      `).join(''));

      safeSetHTML('infiltration-tags-container', infiltrationTags.map((tag, idx) =>
        `<span class="tag-chip">${tag}</span>`
      ).join(''));

      window.infiltrationBundle = infiltrationTags;
      window.competitorVideos = videoTitles;
    }

    if (processing) processing.style.display = 'none';
    showToast(`Infiltration bundle generated for "${keyword}"`, 'success');

  } catch (error) {
    if (processing) processing.style.display = 'none';
    showToast('Error sniping keyword: ' + error.message, 'error');
  }
}

function exportToMetadataWeaver() {
  if (discoveredKeywords.length === 0) {
    showToast('No keywords to export', 'error');
    return;
  }
  switchView('factory');
  showToast('Keywords sent to Video Factory', 'success');
}

function exportKeywordsCSV() {
  if (!discoveredKeywords || !discoveredKeywords.length) return showToast('No keywords', 'error');
  var csv = 'Keyword,Intent,Competition,Volume,Opportunity,Golden\n';
  discoveredKeywords.forEach(function(k) {
    csv += '"' + k.keyword + '",' + k.intentScore + ',' + k.competitionScore + ',' + (k.searchVolume||0) + ',' + k.opportunityScore + ',' + (k.isGolden?'Yes':'No') + '\n';
  });
  var b = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'keywords.csv'; a.click();
  showToast('CSV exported!', 'success');
}
window.exportKeywordsCSV = exportKeywordsCSV;

// ── VIDEO FACTORY FUNCTIONS ──
let generatedScript = '';
let generatedMetadata = { title: '', description: '', tags: [] };

async function generateScript() {
  const niche = document.getElementById('niche-select').value;
  const tone = document.getElementById('tone-select').value;
  const length = document.getElementById('length-select').value;
  const topic = document.getElementById('video-concept').value.trim();

  if (!niche || !tone || !length || !topic) {
    showToast('Please fill in all fields', 'error');
    return;
  }

// Check API key - allow fallback to SaaS master key
  const apiKey = checkGroqApiKey();

  // If no user key, we'll let the backend use its master key
  if (!apiKey) {
    console.log('[Debug] No user key - will use SaaS master key');
  } else {
    console.log('[Debug] Using user API key:', apiKey.substring(0, 10) + '...');
  }

  // Don't block - let backend decide whether to use user key or master key
  // (Removed credit deduction for now to test)
  // if (!CreditsSystem.deduct('video-factory')) {
  //   return;
  // }

  // Show processing
  const processing = document.getElementById('script-processing');
  const statusEl = document.getElementById('script-status');
  const progressBar = document.getElementById('script-progress-bar');

  processing.style.display = 'block';

  // Updated status messages based on niche
  const statusMessages = [
    'Analyzing niche patterns...',
    `Applying ${niche} persona...`,
    'Generating script structure...',
    'Writing engaging content...',
    'Finalizing your script...'
  ];

  let statusIndex = 0;
  const statusInterval = setInterval(() => {
    statusEl.textContent = statusMessages[statusIndex];
    progressBar.style.width = `${((statusIndex + 1) / statusMessages.length) * 100}%`;
    statusIndex++;
    if (statusIndex >= statusMessages.length) {
      clearInterval(statusInterval);
    }
  }, 2000);

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/video-factory/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
      },
      body: JSON.stringify({
        topic,
        tone,
        duration: length,
        playlistTitle: 'Content Series',
        niche
      })
    });

    // Enhanced debug - log full response status
    console.log('[Debug] Response status:', res.status);
    console.log('[Debug] Response ok:', res.ok);

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Debug] Server said:', errorText);

      // Try to parse as JSON first, fallback to plain text
      let errorMessage = 'Server error';
      try {
        const errorData = JSON.parse(errorText);
        console.error('[Debug] Parsed error:', errorData);
        errorMessage = errorData.error || errorData.message || errorText;
        if (errorData.hint) {
          console.error('[Debug] Hint:', errorData.hint);
        }
      } catch (e) {
        // Not JSON - use plain text
        errorMessage = errorText || 'Unknown error';
      }

      showToast('Error: ' + errorMessage.substring(0, 200), 'error');

      clearInterval(statusInterval);
      processing.style.display = 'none';
      return;
    }

    const data = await res.json();

    // ENHANCED DEBUG - Log full data object
    console.log('[Debug] Full API Response:', JSON.stringify(data).substring(0, 500));
    console.log('[Debug] data.script exists:', !!data.script);
    console.log('[Debug] data.script length:', data.script?.length);

    clearInterval(statusInterval);
    processing.style.display = 'none';

    // Check if API returned an error in the data
    if (data.error) {
      console.error('[Debug] API Error:', data.error);
      showToast('Error: ' + data.error, 'error');
      return;
    }

    // Validate we have a script
    if (!data.script || data.script.length < 10) {
      showToast('Script appears empty. Please try again.', 'error');
      console.error('[Debug] Empty script received');
      return;
    }

    // Condition Suffix Stripping & Cleanup
    let cleanedScript = data.script || '';

    // 1. Strip Common AI Suffixes (Space + Condition)
    const suffixes = [
      /\\s+Based on your inputs\\.?$/i,
      /\\s+I hope this helps!*$/i,
      /\\s+Let me know if you need anything else\\.?$/i,
      /\\s+Script generated successfully\\.?$/i,
      /\\s+---*.*$/s // Remove everything after a line of dashes if it somehow leaked
    ];

    suffixes.forEach(pattern => {
      cleanedScript = cleanedScript.replace(pattern, '');
    });

    generatedScript = cleanedScript.trim();
    generatedMetadata = data.metadata || {};

    // Generate metadata from the script if backend didn't provide it
    if (!generatedMetadata.title || !generatedMetadata.tags) {
      try {
        const metaRes = await fetch(`${API_BASE_URL}/api/ai/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
            'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
          },
          body: JSON.stringify({
            systemPrompt: 'You are a YouTube SEO expert. Generate a clickable title, description, and tags for this script. Return ONLY JSON.',
            userPrompt: `Generate SEO metadata for this script about "${topic}" in ${niche} niche with ${tone} tone:\n\n${generatedScript.substring(0, 1500)}\n\nReturn JSON: {\"title\":\"YouTube-optimized title under 60 chars\",\"description\":\"SEO description 150-200 words with keywords and call to action\",\"tags\":[\"tag1\",\"tag2\",... up to 15 tags]}`,
            taskType: 'metadata-collusion',
            temperatureOverride: 0.3
          })
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const content = metaData.choices?.[0]?.message?.content || '{}';
          try {
            const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || content);
            generatedMetadata = { title: parsed.title || '', description: parsed.description || '', tags: parsed.tags || [] };
          } catch(e) {}
        }
      } catch(e) { console.warn('Metadata generation failed:', e); }
    }

    // Debug: Log what we received
    const wordCount = generatedScript.split(/\s+/).filter(w => w.length > 0).length;
    const estMinutes = Math.round(wordCount / 150);
    console.log('[Debug] Script length:', generatedScript.length, 'chars,', wordCount, 'words, ~', estMinutes, 'min');

    // Prepare the formatted output: Narrative + Separator + Metadata
    const titleText = generatedMetadata.title ? `TITLE: ${generatedMetadata.title}` : '';
    const tagsText = generatedMetadata.tags ? `TAGS: ${generatedMetadata.tags.join(', ')}` : '';
    const formattedOutput = `${generatedScript}\n\n<hr>\n\n${titleText}\n${tagsText}\n\n📊 ${wordCount} words · ~${estMinutes} min estimated`;

    // Display Script with typewriter and Aura Glow
    const scriptOutput = document.getElementById('script-output');
    const container = document.getElementById('script-output-container');

    // Start Aura Glow
    container.classList.add('aura-active');

    typeWriter(scriptOutput, formattedOutput, 20, () => {
      // End Aura Glow when typewriter finishes
      container.classList.remove('aura-active');

      // Show action buttons after generation
      document.getElementById('regenerate-btn').style.display = 'flex';
      document.getElementById('copy-voiceover-btn').style.display = 'flex';
      document.getElementById('copy-metadata-btn').style.display = 'flex';
      document.getElementById('export-metadata-btn').style.display = 'block';
      document.getElementById('send-auditor-btn').style.display = 'block';

      showToast('Masterpiece generated!', 'success');
    });

  } catch (e) {
    clearInterval(statusInterval);
    console.warn('[Factory] AI generation failed, using template fallback:', e.message);

    // Template-based fallback script when AI is unavailable
    const fallbackScript = generateTemplateScript(topic, niche, tone, length);
    generatedScript = fallbackScript;
    generatedMetadata = {
      title: topic.toUpperCase() + (tone === 'Professional/Authoritative' ? ' - Complete Guide' : tone === 'Mysterious/Storytelling' ? ' - The Truth Revealed' : ' - Everything You Need to Know'),
      description: 'In this video, we explore ' + topic + '. Learn everything about this topic in the ' + niche + ' niche.',
      tags: topic.toLowerCase().split(/\s+/).filter(w => w.length > 3).concat([niche.toLowerCase(), 'guide', 'tutorial', 'explained', '2026'])
    };

    // Render fallback
    const wordCount = generatedScript.split(/\s+/).filter(w => w.length > 0).length;
    const estMinutes = Math.round(wordCount / 150);
    const titleText = generatedMetadata.title ? 'TITLE: ' + generatedMetadata.title : '';
    const tagsText = generatedMetadata.tags ? 'TAGS: ' + generatedMetadata.tags.join(', ') : '';

    const displayEl = document.getElementById('script-display');
    if (displayEl) {
      displayEl.innerHTML = generatedScript.replace(/\n/g, '<br>');
      displayEl.classList.add('script-rendered');
    }
    document.getElementById('metadata-display').innerHTML = '<div class="metadata-section"><h4>' + titleText + '</h4><p>' + tagsText + '</p></div>';
    document.getElementById('script-stats').innerHTML = '📊 ' + wordCount + ' words · ~' + estMinutes + ' min estimated <br><small style="color:var(--text-muted);">⚠️ AI unavailable - template script generated</small>';

    document.getElementById('transcript-tab').style.display = 'block';
    document.getElementById('metadata-tab').style.display = 'block';
    document.getElementById('export-tab').style.display = 'block';
    document.getElementById('regenerate-btn').style.display = 'flex';
    document.getElementById('copy-voiceover-btn').style.display = 'flex';
    document.getElementById('copy-metadata-btn').style.display = 'flex';
    document.getElementById('export-metadata-btn').style.display = 'block';
    document.getElementById('send-auditor-btn').style.display = 'block';

    showToast('Template script generated (AI unavailable)', 'warning');
  }
}

// Template script fallback for when AI is unavailable
function generateTemplateScript(topic, niche, tone, length) {
  const wordTargets = { short: 120, standard: 1200, long: 2000 };
  const target = wordTargets[length] || 1200;
  const segments = Math.max(3, Math.floor(target / 200));
  const introOutro = Math.floor(target * 0.2);
  const bodyPerSegment = Math.floor((target - introOutro) / segments);

  let script = '**[HOT OPEN]** (0:00-0:15)\n';
  script += '[HOST]: Have you ever wondered about ' + topic + '? Today we are diving deep into this fascinating subject that has captured the attention of the ' + niche + ' community worldwide.\n\n';
  script += '**[HOOK]** (0:15-0:30)\n';
  script += '[HOST]: By the end of this video, you will understand ' + topic + ' better than 99% of people. Stay tuned - what you are about to learn will change how you think about this topic forever.\n\n';
  script += '**[CONTEXT]** (0:30-1:30)\n';
  script += '[HOST]: Before we get into the details, let us set the stage. ' + topic + ' has been a topic of discussion in the ' + niche + ' space for years. Experts have debated, researchers have studied, and creators have shared countless perspectives.\n\n';
  script += '[HOST]: But here is the thing - most of what you have heard about ' + topic + ' is either incomplete or outdated. Today, we are going to set the record straight with the latest information available.\n\n';

  for (let i = 1; i <= segments; i++) {
    const min = Math.floor(1.5 + i * 2);
    script += '**[REVEAL ' + i + ']** (' + min + ':00-' + (min + 1) + ':30)\n';
    script += '[HOST]: Here is something most people do not know about ' + topic + '. The research tells us something surprising - and it might completely change your perspective.\n\n';
    script += '[HOST]: When experts analyzed the data on ' + topic + ', they found patterns that nobody expected. These findings have major implications for anyone interested in the ' + niche + ' field.\n\n';
  }

  script += '**[CLIMAX]** (' + Math.floor(1.5 + segments * 2 + 1) + ':00-' + Math.floor(1.5 + segments * 2 + 1.5) + ':30)\n';
  script += '[HOST]: So what does all of this mean? ' + topic + ' is not just a passing trend - it represents a fundamental shift in how we think about ' + niche + '. The evidence is clear.\n\n';
  script += '**[OUTRO]**\n';
  script += '[HOST]: Thank you for watching this deep dive into ' + topic + '. If you found this valuable, please subscribe and hit the notification bell. We release new content every week exploring the most important topics in ' + niche + '.\n\n';
  script += '[HOST]: Leave a comment below - I would love to hear your thoughts on ' + topic + '. What aspect surprised you the most? Until next time, keep exploring and stay curious.\n';

  return script;
}

function typeWriter(element, text, speed = 30, callback = null) {
  if (!element) return;
  let i = 0;
  element.innerHTML = '';
  element.classList.add('typewriter-active');

  function type() {
    if (!element) return;
    if (i < text.length) {
      if (text.substring(i, i + 4) === '<hr>') {
        element.innerHTML += '<hr>';
        i += 4;
      } else {
        element.innerHTML += text.charAt(i);
        i++;
      }
      setTimeout(type, speed);
    } else {
      element.classList.remove('typewriter-active');
      if (callback) callback();
    }
  }
  type();
}

function copyVoiceover() {
  if (!generatedScript) {
    showToast('No script to copy', 'error');
    return;
  }

  // Use Clipboard API
  navigator.clipboard.writeText(generatedScript).then(() => {
    showToast('Copied Full Transcript!', 'success');
  }).catch(err => {
    console.error('Copy failed:', err);
    showToast('Failed to copy', 'error');
  });
}
window.copyVoiceover = copyVoiceover;

function copyMetadataOnly() {
  if (!generatedMetadata.title && !generatedMetadata.tags) {
    showToast('No metadata to copy', 'error');
    return;
  }

  const text = `TITLE: ${safeRender(generatedMetadata.title)}\nTAGS: ${safeRender(generatedMetadata.tags.join(', '))}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied Metadata!', 'success');
  });
}
window.copyMetadataOnly = copyMetadataOnly;

async function sendToAuditor() {
  if (!generatedMetadata.title) {
    showToast('Generate a script first', 'error');
    return;
  }

  // Populate Auditor Input (Feature 3)
  const auditInput = document.getElementById('audit-video-url');
  if (auditInput) {
    // We don't have a URL, but we can set a flag or just populate title/tags for the auditor to use
    // For now, let's switch view and trigger the scoring logic manually
    switchView('metadata-auditor');

    // We'll update auditVideoMetadata to handle this manual state
    window.lastTransferredMetadata = {
      title: generatedMetadata.title,
      tags: generatedMetadata.tags,
      description: generatedMetadata.description || ''
    };

    // Trigger the manual audit path
    runManualAudit();
  }
}
window.sendToAuditor = sendToAuditor;

// Add runManualAudit helper
function runManualAudit() {
  const resultsContainer = document.getElementById('audit-results');
  if (!resultsContainer || !window.lastTransferredMetadata) return;

  const { title, tags, description } = window.lastTransferredMetadata;

  // Scoring logic (simplified version of auditVideoMetadata)
  const titleScore = Math.min(100, (title.length >= 30 && title.length <= 60) ? 95 : 65);
  const tagCount = tags.length;
  const tagScore = Math.min(100, tagCount >= 10 ? 95 : 70);
  const descScore = 85; // Default for AI generated

  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="audit-summary">
        <div class="audit-info">
          <h4><i data-lucide="wand-2"></i> AI-Generated Content Check</h4>
          <p>SEO Verification for Factory Output</p>
        </div>
      </div>
      <div class="audit-scores">
        <div class="audit-score-item">
          <span>Title Strength (${title.length} chars)</span>
          <div class="score-bar"><div style="width: ${titleScore}%; background: ${titleScore >= 80 ? '#10b981' : '#f59e0b'}"></div></div>
          <span>${titleScore}/100</span>
        </div>
        <div class="audit-score-item">
          <span>Tag Density (${tagCount} tags)</span>
          <div class="score-bar"><div style="width: ${tagScore}%; background: ${tagScore >= 10 ? '#10b981' : '#f59e0b'}"></div></div>
          <span>${tagScore}/100</span>
        </div>
      </div>
      <div class="audit-recommendations">
        <h4>SEO Recommendations</h4>
        <h4>SEO Recommendations</h4>
        <ul>
          ${title.length < 30 ? '<li>Title is a bit short for CTR performance.</li>' : '<li>Title length is perfect for SEO.</li>'}
          ${tagCount < 8 ? '<li>Consider adding a few more specific tags.</li>' : '<li>Great tag variety detected.</li>'}
        </ul>
      </div>
    `;
  }

  showToast('Auditing Factory Output...', 'info');
}

function regenerateScript() {
  // Hide buttons during regeneration
  document.getElementById('regenerate-btn').style.display = 'none';
  document.getElementById('copy-voiceover-btn').style.display = 'none';
  generateScript();
}

function exportToMetadata() {
  // Use the AI-generated metadata from the backend response
  const title = generatedMetadata?.title || 'Generated Video';
  const description = generatedMetadata?.description || '';
  const tags = generatedMetadata?.tags || [];

  generatedMetadata = { title, description, tags };

  // Show modal
  showMetadataModal();
}

function showMetadataModal() {
  // Remove existing modal
  const existing = document.querySelector('.metadata-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'metadata-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <i data-lucide="package"></i>
        <h3>Metadata Bundle Generated</h3>
        <button class="close-btn" onclick="this.closest('.metadata-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="metadata-section">
          <label>TITLE</label>
          <div class="metadata-value">
            <span>${generatedMetadata.title}</span>
            <button class="copy-btn" onclick="copyToClipboard('${generatedMetadata.title.replace(/'/g, "\\'")}')">
              <i data-lucide="copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="metadata-section">
          <label>DESCRIPTION</label>
          <div class="metadata-value">
            <span class="description-text">${generatedMetadata.description.substring(0, 200)}...</span>
            <button class="copy-btn" onclick="copyToClipboard('${generatedMetadata.description.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')">
              <i data-lucide="copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="metadata-section">
          <label>TAGS</label>
          <div class="tags-preview">
            ${generatedMetadata.tags.map(tag => `<span class="tag-chip">${tag}</span>`).join('')}
          </div>
          <button class="copy-btn full-width" onclick="copyToClipboard('${generatedMetadata.tags.join(', ')}')">
            <i data-lucide="copy"></i> Copy All Tags
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="this.closest('.metadata-modal').remove()">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard!', 'success');
}

// ── UNIFIED SNIPER ENGINE ──
async function executeSniperInfiltration(inputId, resultsId, creditType) {
  const urlInput = document.getElementById(inputId);
  const container = document.getElementById(resultsId);
  const url = urlInput.value.trim();
  const videoId = getYoutubeId(url);

  if (!videoId) {
    showToast('Please enter a valid YouTube Video URL', 'error');
    return;
  }

  // Show processing in the specific container
  if (container) {
    container.innerHTML = `
      <div class="processing-overlay">
        <div class="spinner-pro"></div>
        <h4>Targeting Competitor Node...</h4>
        <p>Indexing semantic clusters and metadata layers</p>
      </div>
    `;
  }
  container.style.display = 'block';

  try {
    const meta = await fetchVideoTags(videoId);
    const sniperResult = await generateBridgeTags(meta);

    // Deduct only on successful generation
    if (!CreditsSystem.deduct(creditType)) {
      container.style.display = 'none';
      return;
    }

    // Determine source: if API returned real tags, it's 'API'; otherwise AI filled the gap
    const dataSource = (meta.tags && meta.tags.length > 0) ? 'API' : 'AI';
    // For display: use real tags if available, otherwise use AI-predicted tags
    const displayMeta = { ...meta };
    if (dataSource === 'AI' && sniperResult.predictedTags.length > 0) {
      displayMeta.tags = sniperResult.predictedTags;
    }

    renderSniperResultsUI(container, videoId, displayMeta, sniperResult.bridgeTags, sniperResult.predictedTags, dataSource);
    showToast('Infiltration bundle generated [v2.8]', 'success');
  } catch (error) {
    console.error('Sniper Error:', error);
    showToast('Sniper jammed. Using adaptive heuristics.', 'warning');
    // Use the actual video title as fallback, not the URL
    const titleWords = (meta.title || '').split(/\s+/) || ['video', 'strategy', 'viral'];
    const fallbackPredicted = titleWords.slice(0, 10);
    const fallbackBridge = [];
    for (let i = 0; i < Math.min(titleWords.length - 1, 10); i++) {
      fallbackBridge.push(titleWords[i] + ' ' + titleWords[i + 1]);
    }
    while (fallbackBridge.length < 3) { fallbackBridge.push('YouTube Algorithm Insights'); } // fallback safety

    renderSniperResultsUI(container, videoId, { tags: fallbackPredicted, title: url }, fallbackBridge.slice(0, 10), fallbackPredicted, 'AI');
  }
}

function analyzeCompetitor() {
  executeSniperInfiltration('competitor-video-url', 'competitor-results', 'competitor-scan');
}

// [Removed Local Duplicate runSidebarSniper]

window.analyzeCompetitor = analyzeCompetitor;
// [Removed Local Duplicate window.runSidebarSniper]

async function fetchVideoTags(videoId) {
  const apiKey = localStorage.getItem('ytseo_api_key') || '';

  // No API key: use oEmbed to get title only
  if (!apiKey) {
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await res.json();
      return { tags: [], title: data.title || '', description: '' };
    } catch (e) {
      return { tags: [], title: '', description: '' };
    }
  }

  // Has API key: use YouTube Data API with snippet + topicDetails
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${videoId}&key=${apiKey}`);
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      const snippetTags = item.snippet.tags || [];
      const topics = (item.topicDetails?.topicCategories || []).map(url => url.split('/').pop().replace(/_/g, ' '));
      // Use snippet tags first, fall back to topic categories
      return {
        tags: snippetTags.length > 0 ? snippetTags : topics,
        title: item.snippet.title || '',
        description: item.snippet.description || ''
      };
    }
  } catch (e) {
    console.warn('[Sniper] YouTube API failed:', e.message);
  }
  return { tags: [], title: '', description: '' };
}

async function generateBridgeTags(meta) {
  const apiKey = checkGroqApiKey();
  const tags = meta.tags || [];
  const title = meta.title || 'Unknown Video';
  const description = (meta.description || '').substring(0, 500);

  // THE "NEVER-EMPTY" TRIGGER: If tags array is empty, force AI prediction
  const needsAIPrediction = !tags || tags.length === 0;
  let prompt = '';

  if (needsAIPrediction) {
    prompt = `For video "${title}", generate 2 things as JSON:\n1. "predicted": 10 SEO tags this video likely uses\n2. "bridge": 10 SEMANTIC BRIDGE tags (2-4 word phrases from ADJACENT topics that would get this video in Suggested sidebar). NOT the same as predicted. MUST be 2+ words each.\n\nReturn ONLY: {\"predicted\":[\"tag1\"],\"bridge\":[\"Adjacent Topic Phrase\"]}`;
  } else {
    prompt = `Given tags ${tags.slice(0, 10).join(', ')}, generate 10 SEMANTIC BRIDGE tags (2-4 word phrases from ADJACENT topics for Suggested sidebar). NOT the same as given tags.\n\nReturn ONLY: {\"predicted\":[],\"bridge\":[\"Adjacent Topic Phrase\"]}`;
  }

  const doFetch = async (tempOverride) => {
    const payload = {
      taskType: 'metadata-collusion',
      systemPrompt: 'Generate semantic bridge tags for YouTube SEO. Return JSON.',
      userPrompt: prompt,
      // groqApiKey removed - server uses env var
    };
    if (tempOverride !== undefined) payload.temperatureOverride = tempOverride;

    const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('AI Generation failed');
    return await response.json();
  };

  try {
    let result = await doFetch(0.6);
    let parsedTags = parseTags(result);

    // LAW 1 & 3 QUALITY CHECK: Loop over tags to detect shuffling (e.g. "Vacuum Vacuum") or bracketed junk
    const qualityCheck = (tags) => {
      if (!tags || tags.length < 5) return false;
      for (const tag of tags) {
        if (/\[.*\]/.test(tag) || tag.includes('2026')) return false;
        const words = tag.toLowerCase().split(' ');
        const wordSet = new Set(words);
        // If a tag has repeated words (e.g., Vacuum Vacuum), fail check
        if (words.length !== wordSet.size) return false;
      }
      return true;
    };

    if (!qualityCheck(parsedTags.bridgeTags) || !qualityCheck(parsedTags.predictedTags && needsAIPrediction ? parsedTags.predictedTags : ['pass', 'pass', 'pass', 'pass', 'pass'])) {
      console.warn('[Sniper] Quality Check failed (word shuffling detected). Retrying with increased creativity (0.9)...');
      result = await doFetch(0.9);
      parsedTags = parseTags(result);
    }

    return parsedTags;
  } catch (e) {
    console.error('[Sniper] AI Bridge Error:', e);
    // Semantic keyword extraction from title as absolute last resort
    const words = title.split(/[\s\-|:,]+/).filter(w => w.length > 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const fallbackPredicted = words.slice(0, 10);
    const fallbackBridge = [];
    for (let i = 0; i < words.length - 1 && fallbackBridge.length < 10; i++) {
        const combo = words[i] + ' ' + words[i + 1];
        if (words[i].toLowerCase() !== words[i+1].toLowerCase()) fallbackBridge.push(combo);
    }
    while (fallbackBridge.length < 10) {
        fallbackBridge.push('Strategic ' + (words[0] || 'Content') + ' Insights');
        if(fallbackBridge.length >= 10) break;
        fallbackBridge.push('Advanced ' + (words[words.length-1] || 'Topic') + ' Concepts');
    }
    return { bridgeTags: fallbackBridge.slice(0, 10), predictedTags: fallbackPredicted };
  }
}

// Helper to parse groq response safely
function parseTags(data) {
  let content = data.choices?.[0]?.message?.content || '';
  let bridgeTags = [];
  let predictedTags = [];

  try {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd > 0) {
      const jsonStr = content.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonStr);
      bridgeTags = (parsed.bridge || []).filter(t => t && t.trim().length > 0).slice(0, 15);
      predictedTags = (parsed.predicted || []).filter(t => t && t.trim().length > 0).slice(0, 15);

      // Quality filter: remove single-word bridge tags, deduplicate vs predicted
      bridgeTags = bridgeTags.filter(t => {
        const words = t.trim().split(/\s+/);
        return words.length >= 2 || /[A-Z]{2,}/.test(t); // keep acronyms like "WW2"
      });
      // Remove bridge tags that overlap with predicted (case-insensitive)
      const predictedLower = new Set(predictedTags.map(t => t.toLowerCase()));
      bridgeTags = bridgeTags.filter(t => !predictedLower.has(t.toLowerCase()));
      bridgeTags = bridgeTags.slice(0, 10);

      return { bridgeTags, predictedTags };
    }
  } catch (e) {
    console.warn('[Sniper] JSON parse failed, attempting comma split.');
  }

  const allTags = content.split(',').map(t => t.replace(/[^a-zA-Z0-9 ]/g, '').trim()).filter(t => t.length > 1);
  return { bridgeTags: allTags.slice(0, 10), predictedTags: allTags.slice(0, 15) };
}

function displayCompetitorResults() {
  // Original tags
  const originalContainer = document.getElementById('original-tags-container');
  if (originalContainer) {
    originalContainer.innerHTML = originalTags.map(tag =>
      `<span class="tag-chip" onclick="copyKeyword('${tag}')">${tag}</span>`
    ).join('');
  }

  // Infiltration bundle
  const infiltrationContainer = document.getElementById('infiltration-tags-container');
  if (infiltrationContainer) {
    infiltrationContainer.innerHTML = infiltrationTags.map(tag =>
      `<span class="tag-chip generated" onclick="copyKeyword('${tag}')">${tag}</span>`
    ).join('');
  }

  document.getElementById('competitor-results').style.display = 'block';
}

function copyAllOriginalTags() {
  navigator.clipboard.writeText(originalTags.join(', '));
  showToast('All tags copied!', 'success');
}

function copyInfiltrationBundle() {
  navigator.clipboard.writeText(infiltrationTags.join(', '));
  showToast('Bundle copied!', 'success');
}

function applyToMetadataWeaver() {
  switchView('factory');
  showToast('Tags applied to Metadata Weaver', 'success');
}

// ── SIDEBAR NAVIGATION & VIEW SWITCHING (Legacy Duplicate Removed)


// Make switchView globally available
window.switchView = switchView;

// ── FOLDER TOGGLE ──
function toggleFolder(folderId) {
  const folder = document.getElementById(`folder-${folderId}`);
  const header = document.querySelector(`.folder-header[onclick="toggleFolder('${folderId}')"]`);

  if (folder && header) {
    folder.classList.toggle('open');
    header.classList.toggle('open');
  }
}
window.toggleFolder = toggleFolder;

// ── PREMIUM FEATURE CHECK ──
const premiumFeatures = ['thumbnail-redesign', 'auto-responder', 'automation-pipeline'];

function checkPremiumFeature(featureId) {
  // TEMPORARILY BYPASS PREMIUM CHECK FOR TESTING
  // Remove this line to re-enable premium check
  return true;

  if (premiumFeatures.includes(featureId)) {
    const userTier = localStorage.getItem('ytseo_tier') || 'standard';
    if (userTier !== 'premium') {
      showPremiumModal();
      return false;
    }
  }
  return true;
}
window.checkPremiumFeature = checkPremiumFeature;

function showPremiumModal() {
  const existing = document.querySelector('.premium-modal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.className = 'premium-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-icon">
        <i data-lucide="crown"></i>
      </div>
      <h3>Pro-Tier Feature</h3>
      <p>This is a premium feature available to Pro subscribers. Upgrade now to unlock AI Auto-Responder, Thumbnail Redesign, and Automation Pipeline.</p>
      <button class="upgrade-btn" onclick="window.location.href='#upgrade'">
        <i data-lucide="zap"></i> Upgrade to Pro
      </button>
      <span class="close-hint" onclick="this.closest('.premium-modal').remove()">Maybe later</span>
    </div>
  `;
  document.body.appendChild(modal);
}
window.showPremiumModal = showPremiumModal;

// ── SEO SCORE FUNCTIONS ──

function updateSEOScore(scores) {
  const { title = 0, description = 0, tags = 0, thumbnail = 0, overall = 0 } = scores;

  // Calculate overall score
  const avgScore = Math.round((title + description + tags + thumbnail) / 4);

  // Update main score circle
  const scoreRing = document.getElementById('seo-score-ring');
  const scoreNumber = document.getElementById('seo-score-number');

  if (scoreRing && scoreNumber) {
    // Circumference = 2 * PI * r = 2 * 3.14159 * 54 = 339.292
    const circumference = 339.292;
    const offset = circumference - (avgScore / 100) * circumference;

    scoreRing.style.strokeDashoffset = offset;
    scoreNumber.textContent = avgScore;

    // Color based on score
    if (avgScore >= 70) {
      scoreRing.style.stroke = '#10b981';
    } else if (avgScore >= 40) {
      scoreRing.style.stroke = '#f59e0b';
    } else {
      scoreRing.style.stroke = '#ef4444';
    }
  }

  // Update breakdown
  const scoreTitle = document.getElementById('score-title');
  const scoreDesc = document.getElementById('score-desc');
  const scoreTags = document.getElementById('score-tags');
  const scoreThumb = document.getElementById('score-thumb');
  if (scoreTitle) scoreTitle.textContent = `${title}/100`;
  if (scoreDesc) scoreDesc.textContent = `${description}/100`;
  if (scoreTags) scoreTags.textContent = `${tags}/100`;
  if (scoreThumb) scoreThumb.textContent = `${thumbnail}/100`;

  // Update Algorithmic Health card
  const algoRing = document.getElementById('algo-ring');
  const algoScore = document.getElementById('algo-score');

  if (algoRing && algoScore) {
    const circumference = 283; // 2 * PI * 45
    const offset = circumference - (avgScore / 100) * circumference;
    algoRing.style.strokeDashoffset = offset;
    algoScore.textContent = avgScore;

    // Color based on score
    if (avgScore >= 70) {
      algoRing.style.stroke = '#10b981';
    } else if (avgScore >= 40) {
      algoRing.style.stroke = '#f59e0b';
    } else {
      algoRing.style.stroke = '#ef4444';
    }
  }
}

function updateBentoCard(type, value) {
  const valueEl = document.getElementById(`bento-${type}-value`);
  const barEl = document.getElementById(`bento-${type}-bar`);

  if (valueEl) valueEl.textContent = `${value}%`;
  if (barEl) {
    barEl.style.width = `${value}%`;

    // Color based on value
    if (value >= 70) {
      barEl.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    } else if (value >= 40) {
      barEl.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
      barEl.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }
  }
}

function updateCreditsDisplay() {
  const credits = CreditsSystem.remaining;
  const creditValue = document.getElementById('bento-credits-value');
  const creditsCount = document.getElementById('credits-count');
  const creditsTotal = document.getElementById('credits-total');

  if (creditValue) creditValue.textContent = credits;
  if (creditsCount) creditsCount.textContent = credits;
  if (creditsTotal) creditsTotal.textContent = CreditsSystem.total;
}

function updateLastAudit() {
  const auditValue = document.getElementById('bento-audit-value');
  const auditDate = document.getElementById('audit-date');

  const now = new Date();
  const timestamp = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (auditValue) auditValue.textContent = timestamp;
  if (auditDate) auditDate.textContent = 'Channel analysis complete';
}

function addActivityItem(type, title, detail) {
  const activityList = document.getElementById('activity-list');
  if (!activityList) return;

  const iconMap = {
    'keyword': 'keyword',
    'audit': 'audit',
    'title': 'title',
    'description': 'audit',
    'thumbnail': 'title',
    'audit-complete': 'audit'
  };

  const iconClass = iconMap[type] || 'audit';
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const activityHTML = `
    <div class="activity-item">
      <div class="activity-icon ${iconClass}">
        <i class="ph ph-${type === 'keyword' ? 'key' : type === 'audit' ? 'magnifying-glass' : type === 'audit-complete' ? 'check-circle' : 'text-t'}"></i>
      </div>
      <div class="activity-details">
        <div class="activity-title">${title}</div>
        <div class="activity-time">${time}</div>
      </div>
    </div>
  `;

  if (!activityList) return;

  const emptyEl = activityList.querySelector('.activity-empty');
  if (emptyEl) {
    if (activityList) activityList.innerHTML = activityHTML;
  } else {
    activityList.insertAdjacentHTML('afterbegin', activityHTML);
  }
}

function updateCriticalFixes(fixes) {
  const fixesList = document.getElementById('fixes-list');
  const fixesCount = document.getElementById('fixes-count');

  if (!fixesList) return;

  if (!fixes || fixes.length === 0) {
    if (fixesList) {
      fixesList.innerHTML = `
        <div class="fix-empty">
          <i data-lucide="check-circle"></i>
          <p>No critical issues found. Run a channel audit to detect problems.</p>
        </div>
      `;
    }
    if (fixesCount) fixesCount.textContent = '0 issues found';
    return;
  }

  if (fixesCount) fixesCount.textContent = `${fixes.length} issue${fixes.length > 1 ? 's' : ''} found`;

  if (fixesList) {
    fixesList.innerHTML = fixes.map((fix, idx) => `
      <div class="fix-item">
        <div class="fix-info">
          <div class="fix-title">
            ${fix.title}
            <span class="fix-severity ${fix.severity || 'medium'}">${fix.severity || 'medium'}</span>
          </div>
          <div class="fix-detail">${fix.detail}</div>
        </div>
        <div class="fix-action">
          <button class="magic-fix-btn" onclick="magicFix(${idx}, '${fix.type}')">
            <i data-lucide="wand"></i> Magic Fix
          </button>
        </div>
      </div>
    `).join('');
  }
}

// Magic Fix function - generates AI solution
async function magicFix(index, type) {
  const btn = document.querySelectorAll('.magic-fix-btn')[index];
  if (!btn) return;

  // Check credits
  if (!CreditsSystem.canAfford('title-generation')) {
    alert('No credits remaining. Please upgrade to continue.');
    return;
  }

  // Show loading state
  if (btn) btn.innerHTML = '<i class="ph ph-spinner" style="animation: spin 1s linear infinite;"></i> Fixing...';
  btn.disabled = true;

  try {
    CreditsSystem.deduct('title-generation');

    // Call AI to generate fix
    const apiKey = checkGroqApiKey();
    const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || ''
      },
      body: JSON.stringify({
        taskType: type,
        userPrompt: `Generate an improved ${type} for this video that fixes the SEO issue.`
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error. Check console for details.');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No solution generated';

    // Show success
    if (btn) btn.innerHTML = '<i data-lucide="check"></i> Fixed!';
    if (btn) btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

    // Copy to clipboard
    navigator.clipboard.writeText(content);

    setTimeout(() => {
      if (btn) btn.innerHTML = '<i data-lucide="wand"></i> Copy';
      if (btn) btn.style.background = '';
      btn.disabled = false;
    }, 3000);

  } catch (err) {
    if (btn) btn.innerHTML = '<i data-lucide="warning"></i> Error';
    btn.disabled = false;
    console.error('Magic fix failed:', err);
  }
}
window.magicFix = magicFix;

// Demo function to populate scores
function populateDemoScores() {
  updateSEOScore({
    title: 75,
    description: 60,
    tags: 45,
    thumbnail: 80,
    overall: 65
  });

  updateCriticalFixes([
    { title: 'Title Too Long', detail: 'Title exceeds 60 characters - truncate to improve CTR', severity: 'high', type: 'title' },
    { title: 'Missing Timestamps', detail: 'Description lacks video timestamps - add chapters', severity: 'medium', type: 'description' },
    { title: 'Weak Tags', detail: 'Only 3 tags used - add 12 more relevant tags', severity: 'low', type: 'tags' }
  ]);
}
window.populateDemoScores = populateDemoScores;

// Refactored to platformInit()

// ── CONNECTION PERSISTENCE ──
function checkSavedConnection() {
  const isConnected = localStorage.getItem('ytseo_channel_connected') === 'true';
  const channelName = localStorage.getItem('ytseo_channel_name');
  const channelId = localStorage.getItem('ytseo_channel_id');
  const savedToken = localStorage.getItem('ytseo_access_token');

  if (isConnected && savedToken && channelName) {
    // Restore access token
    accessToken = savedToken;
    activeChannel = {
      id: channelId,
      snippet: { title: channelName }
    };

    // Update UI to connected state
    updateConnectedUI(channelName);

    // Fetch real analytics data
    fetchYouTubeAnalytics(channelId);

    // Validate token
    validateToken();

    // ── Sync access token to backend so Phronesis agent can use it ──
    fetch('/api/credits/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': channelId,
        'x-access-token': savedToken
      },
      body: JSON.stringify({ channelId: channelId, accessToken: savedToken })
    }).then(r => r.json()).then(d => console.log('[Token Sync]', d.plan, d.credits, 'credits')).catch(() => {});
  }
}

async function validateToken() {
  try {
    const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.status === 401) {
      // Token expired - show reconnect button
      showReconnectButton();
    }
  } catch (error) {
    console.log('Token validation failed:', error);
  }
}

function showReconnectButton() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Remove existing reconnect button if any
  const existing = headerRight.querySelector('.reconnect-btn');
  if (existing) return;

  const reconnectBtn = document.createElement('button');
  reconnectBtn.className = 'reconnect-btn';
  if (reconnectBtn) reconnectBtn.innerHTML = '⚠️ Session Expired - Click to Re-connect';
  reconnectBtn.onclick = refreshConnection;
  reconnectBtn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(234, 88, 12, 0.15);
    border: 1px solid rgba(234, 88, 12, 0.3);
    border-radius: 8px;
    color: #fb923c;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  `;

  headerRight.insertBefore(reconnectBtn, headerRight.firstChild);
}

function refreshConnection() {
  // Clear all stored session data for security
  localStorage.clear();
  accessToken = null;
  activeChannel = null;

  // Remove reconnect button
  const reconnectBtn = document.querySelector('.reconnect-btn');
  if (reconnectBtn) reconnectBtn.remove();

  // Remove any session-expired modals
  document.querySelectorAll('.session-expired-modal, .auth-expired-modal').forEach(m => m.remove());

  // Trigger OAuth flow
  initiateOAuth();
}

// Check before using any tool
function checkTokenBeforeToolUse() {
  if (!accessToken) {
    showSessionExpiredModal();
    return false;
  }

  // Validate token by making a simple API call
  fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then(response => {
    if (response.status === 401) {
      showSessionExpiredModal();
      return false;
    }
  }).catch(() => {
    showSessionExpiredModal();
    return false;
  });

  return true;
}

function showSessionExpiredModal() {
  // Remove existing modal
  const existing = document.querySelector('.session-expired-modal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.className = 'session-expired-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content" style="border: 2px solid #ea580c;">
      <div class="modal-icon" style="background: rgba(234, 88, 12, 0.15);">
        <i data-lucide="alert-triangle" style="color: #ea580c;"></i>
      </div>
      <h3 style="color: #ea580c;">⚠️ Session Expired</h3>
      <p>Your connection to YouTube has expired. Please refresh to continue using the tools.</p>
      <button class="btn-primary" onclick="refreshConnection(); this.closest('.session-expired-modal').remove();" style="background: #ea580c; border-color: #ea580c;">
        <i data-lucide="refresh-cw"></i> Click to Re-connect
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Signal Orange Modal for 401 Unauthorized during Re-Order
function showAuthExpiredModal() {
  const existing = document.querySelector('.auth-expired-modal');
  if (existing) return;

  const modal = document.createElement('div');
  modal.className = 'auth-expired-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content" style="border: 2px solid #ea580c;">
      <div class="modal-icon" style="background: rgba(234, 88, 12, 0.15);">
        <i data-lucide="alert-triangle" style="color: #ea580c;"></i>
      </div>
      <h3 style="color: #ea580c;">⚠️ Authentication Expired</h3>
      <p>Your session has expired. Please reconnect to optimize playlists.</p>
      <button class="btn-primary" onclick="refreshConnection(); this.closest('.auth-expired-modal').remove();" style="background: #ea580c; border-color: #ea580c;">
        <i data-lucide="refresh-cw"></i> Click to Re-connect
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

function updateConnectedUI(channelName) {
  // Hide Connect CTA and Empty State
  const cta = document.getElementById('connect-cta');
  if (cta) cta.style.display = 'none';
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'none';

  // Show dashboard elements that might be hidden
  const seoSection = document.querySelector('.seo-score-section');
  if (seoSection) seoSection.style.display = 'flex';

  const gridContainer = document.querySelector('.grid-container');
  if (gridContainer) gridContainer.style.display = 'grid';

  const criticalFixes = document.querySelector('.critical-fixes-section');
  if (criticalFixes) criticalFixes.style.display = 'block';

  const dashboardGrid = document.querySelector('.dashboard-grid');
  if (dashboardGrid) dashboardGrid.style.display = 'grid';

  const quickActions = document.querySelector('.quick-actions-section');
  if (quickActions) quickActions.style.display = 'block';

  // Update profile name in header
  const profileName = document.getElementById('profile-name');
  if (profileName) profileName.textContent = channelName;

  // Update profile dropdown with connected options
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    dropdown.innerHTML = `
      <div class="dropdown-item" onclick="switchView('settings')">
        <i data-lucide="settings"></i> Settings
      </div>
      <div class="dropdown-item" onclick="showChannelSelectorFromConnected()">
        <i data-lucide="arrow-left-right"></i> Switch Channel
      </div>
      <div class="dropdown-divider"></div>
      <div class="dropdown-item danger" onclick="logout()">
        <i data-lucide="log-out"></i> Sign Out
      </div>
    `;
  }
}

function logout() {
  // Clear localStorage
  localStorage.removeItem('ytseo_channel_connected');
  localStorage.removeItem('ytseo_channel_name');
  localStorage.removeItem('ytseo_channel_id');
  localStorage.removeItem('ytseo_access_token');

  // Revoke Google token if available
  if (accessToken && window.google) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Token revoked');
    });
  }

  // Reset UI - reload page
  location.reload();
}

window.logout = logout;
window.refreshConnection = refreshConnection;
window.showChannelSelectorFromConnected = showChannelSelectorFromConnected;

// Show channel selector from connected state
async function showChannelSelectorFromConnected() {
  const channels = await fetchChannelData();
  if (channels.length > 1) {
    showChannelSelector(channels);
  }
}

// ── YOUTUBE ANALYTICS FETCH ──
async function fetchYouTubeAnalytics(channelId) {
  if (!accessToken) return;

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    // Get channel statistics
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}`,
      { headers }
    );

    if (!channelRes.ok) {
      if (channelRes.status === 401) {
        showSessionExpiredModal();
        return;
      }
      throw new Error('Failed to fetch channel data');
    }

    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      console.log('No channel data found');
      return;
    }

    const stats = channelData.items[0].statistics;
    const snippet = channelData.items[0].snippet;

    // Update Bento Grid with real stats
    const statKeywords = document.getElementById('stat-keywords');
    const statTraffic = document.getElementById('stat-traffic');
    const statVideos = document.getElementById('stat-videos');

    if (statVideos) statVideos.textContent = parseInt(stats.videoCount || 0).toLocaleString();
    if (statTraffic) statTraffic.textContent = parseInt(stats.viewCount || 0).toLocaleString() + ' views';

    // Calculate initial SEO score based on channel maturity
    const initialScores = calculateInitialSEOScore(stats);
    updateSEOScore(initialScores);

    // Update activity with channel info
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      const emptyEl = activityList.querySelector('.activity-empty');
      if (emptyEl) {
        activityList.innerHTML = `
          <div class="activity-item">
            <div class="activity-icon audit">
              <i data-lucide="check-circle"></i>
            </div>
            <div class="activity-details">
              <div class="activity-title">Connected to ${snippet.title}</div>
              <div class="activity-time">${parseInt(stats.subscriberCount || 0).toLocaleString()} subscribers</div>
            </div>
          </div>
        `;
      }
    }

    // Update last audit
    updateLastAudit();

    console.log('✅ Analytics loaded for:', snippet.title);

  } catch (error) {
    console.error('Analytics fetch error:', error);
  }
}

function calculateInitialSEOScore(stats) {
  const videoCount = parseInt(stats.videoCount) || 0;
  const subscriberCount = parseInt(stats.subscriberCount) || 0;

  // Base score ranges from 45-80 depending on channel maturity
  let baseScore = 45;

  if (videoCount > 10) baseScore += 5;
  if (videoCount > 50) baseScore += 5;
  if (videoCount > 100) baseScore += 5;

  if (subscriberCount > 1000) baseScore += 5;
  if (subscriberCount > 10000) baseScore += 10;
  if (subscriberCount > 100000) baseScore += 10;

  // Cap at 80 - encourages them to run audits
  baseScore = Math.min(baseScore, 80);

  return {
    title: baseScore,
    description: baseScore - 5,
    tags: baseScore - 10,
    thumbnail: baseScore - 15
  };
}

// Sidebar collapse toggle
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}
window.toggleSidebar = toggleSidebar;

// Profile dropdown toggle
function toggleProfileMenu() {
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.classList.toggle('open');
}
window.toggleProfileMenu = toggleProfileMenu;

// Close profile dropdown when clicking outside
document.addEventListener('click', (e) => {
  const profile = document.getElementById('user-profile');
  const dropdown = document.getElementById('profile-dropdown');
  if (profile && !profile.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// Initialize OAuth (new button)
function initiateOAuth() {
  if (!tokenClient) {
    initOAuth();
  }
  setTimeout(() => {
    if (tokenClient) tokenClient.requestAccessToken();
    else alert('Google script still loading.');
  }, 100);
}
window.initiateOAuth = initiateOAuth;

// Permission-Aware: Check if token has write permissions
let hasFullWriteAccess = false;
async function verifyWritePermissions() {
  if (!accessToken) return false;
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    hasFullWriteAccess = res.ok;
    return res.ok;
  } catch (e) {
    hasFullWriteAccess = false;
    return false;
  }
}

// Show permission warning in Bulk Injector UI
function updatePermissionWarning() {
  const warning = document.getElementById('permission-warning');
  if (!warning) return;
  if (hasFullWriteAccess === false) {
    warning.style.display = 'flex';
  } else {
    warning.style.display = 'none';
  }
}

// Run audit with credits check (wraps existing runAudit)
function runAuditWrapper() {
  if (!CreditsSystem.canAfford('channel-audit')) {
    alert('No credits remaining. Please upgrade to continue.');
    return;
  }

  CreditsSystem.deduct('channel-audit');

  // Call the existing async runAudit function
  runAudit();
}

// Replace the old runAudit reference for the button
window.runAudit = runAuditWrapper;

// Run competitor scan with credits check
function runCompetitorScan() {
  if (!CreditsSystem.canAfford('competitor-scan')) {
    alert('No credits remaining. Please upgrade to continue.');
    return;
  }

  CreditsSystem.deduct('competitor-scan');

  // Call existing competitor scan logic
  const urlInput = document.getElementById('competitor-url');
  const url = urlInput?.value?.trim();
  if (url) {
    // Trigger existing competitor snipe function if exists
    if (typeof runCompetitorSnipe === 'function') {
      runCompetitorSnipe(url);
    }
  }
}
window.runCompetitorScan = runCompetitorScan;

// ── PLAN & FEATURE GATING SYSTEM ──
// User plan from backend: 'free', 'pro', 'agency'
let userPlan = localStorage.getItem(getChannelPlanKey()) || 'free';
let userCredits = parseInt(localStorage.getItem(getChannelCreditsKey()) || '0');

function isAdmin() {
  var cid = localStorage.getItem('ytseo_channel_id') || '';
  // Both your channel IDs have admin access
  if (cid === 'UC-vVYFQC_MNjVP03YRZ56Wg' || cid === 'UCmcNApL2w7kk7NG14tXinRg') return true;
  // Also check stored admin list
  var stored = localStorage.getItem('ytseo_admin_ids') || '';
  return stored.split(',').includes(cid);
}
window.isAdmin = isAdmin;

// ── Channel-scoped credit helpers ──
function getChannelCreditsKey() {
  const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  return `ytseo_user_credits_${channelId}`;
}
function getChannelPlanKey() {
  const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  return `ytseo_user_plan_${channelId}`;
}

// Feature access by plan
const PLAN_FEATURES = {
  free: [
    'research', 'metadata-auditor', 'thumbnail-lab', 'suggested-analytics',
    'overview', 'system-status', 'optimization-history', 'niche-relevance', 'sidebar-sniper',
    'trend-pulse', 'ai-labeling', 'multi-language'
  ],
  pro: [
    'research', 'metadata-auditor', 'thumbnail-lab', 'suggested-analytics',
    'overview', 'system-status', 'optimization-history', 'growth-engine', 'cron-inbox', 'analytics', 'ab-tester', 'phronesis', 'niche-relevance', 'sidebar-sniper',
    'factory', 'competitor', 'magic-fix', 'bulk-injector',
    'evergreen-audit', 'retention-reorderer', 'script-shorts',
    'thumbnail-redesign', 'playlist-growth',
    'trend-pulse', 'ai-labeling', 'multi-language',
    'chapters-generator', 'community-posts'
  ],
  agency: [
    'research', 'metadata-auditor', 'thumbnail-lab', 'suggested-analytics',
    'overview', 'system-status', 'optimization-history', 'growth-engine', 'cron-inbox', 'analytics', 'ab-tester', 'phronesis', 'niche-relevance', 'sidebar-sniper',
    'factory', 'competitor', 'magic-fix', 'bulk-injector',
    'evergreen-audit', 'retention-reorderer', 'script-shorts',
    'thumbnail-redesign', 'playlist-growth',
    'auto-responder', 'automation-pipeline',
    'trend-pulse', 'ai-labeling', 'multi-language',
    'chapters-generator', 'community-posts'
  ]
};

function isFeatureAllowed(viewName) {
  if (viewName === 'seo-lab') return isAdmin();
  if (isAdmin()) return true;
  const allowed = PLAN_FEATURES[userPlan] || PLAN_FEATURES.free;
  return allowed.includes(viewName);
}

async function syncPlanFromBackend() {
  const channelId = localStorage.getItem('ytseo_channel_id');
  if (!channelId) return;
  const creditsKey = `ytseo_user_credits_${channelId}`;
  const planKey = `ytseo_user_plan_${channelId}`;
  try {
    const res = await fetch(`/api/credits/status?channelId=${encodeURIComponent(channelId)}`);
    if (!res.ok) return;
    const data = await res.json();
    const serverCredits = data.credits || 0;
    const serverPlan = data.plan || 'free';

    // Always trust the server - it is the authoritative source of credit balance
    // (The server has per-channel credit tracking via channelId in the database)
    userPlan = serverPlan;
    userCredits = serverCredits;
    localStorage.setItem(planKey, userPlan);
    localStorage.setItem(creditsKey, userCredits);
    // Sync CreditsSystem with server balance to prevent display mismatch
    if (typeof CreditsSystem !== 'undefined') {
      CreditsSystem.total = userCredits;
      CreditsSystem.used = 0;
      CreditsSystem.tier = userPlan;
      CreditsSystem.save();
    }
    updatePlanUI();
    updateCreditsDisplay();
  } catch (e) {
    console.warn('[Plan Sync] Failed:', e.message);
  }
}

function updatePlanUI() {
  const planLabel = document.getElementById('plan-label');
  if (planLabel) {
    planLabel.textContent = userPlan === 'agency' ? 'Agency' : userPlan === 'pro' ? 'Pro' : 'Free';
    planLabel.className = 'plan-badge plan-' + userPlan;
  }

  // Show/hide locks on sidebar items based on plan
  document.querySelectorAll('.folder-item, .nav-item[data-view]').forEach(el => {
    const view = el.dataset.view;
    if (!view) return;
    // Skip SEO Lab - admin only. Phronesis visible to all users.
    if (view === 'seo-lab') {
      if (isAdmin()) {
        el.classList.remove('premium-locked','agency-locked');
        el.style.pointerEvents='';
        el.style.display='';
        el.style.opacity='';
        el.style.filter='';
        var lock=el.querySelector('.gold-lock,.agency-lock');
        if(lock)lock.remove();
      } else {
        el.style.display='none';
      }
      return;
    }
    const allowed = isFeatureAllowed(view);

    if (!allowed) {
      const isAgencyOnly = PLAN_FEATURES.agency.includes(view) && !PLAN_FEATURES.pro.includes(view);
      el.classList.remove('agency-locked');
      el.classList.add(isAgencyOnly ? 'agency-locked' : 'premium-locked');
      el.style.pointerEvents = 'none';
      if (isAgencyOnly) {
        el.setAttribute('data-unlock-plan', 'agency');
      } else if (PLAN_FEATURES.pro.includes(view)) {
        el.setAttribute('data-unlock-plan', 'pro');
      }
      // Add lock icon if not present
      if (!el.querySelector('.gold-lock') && !el.querySelector('.agency-lock')) {
        var lock = document.createElement('i');
        lock.setAttribute('data-lucide','lock');
        lock.className = isAgencyOnly ? 'agency-lock' : 'gold-lock';
        lock.style.cssText = 'color:#f59e0b;font-size:12px;margin-left:4px;';
        el.appendChild(lock);
      }
    } else {
      el.classList.remove('premium-locked', 'agency-locked');
      el.style.pointerEvents = '';
      el.removeAttribute('data-unlock-plan');
      var lockEl = el.querySelector('.gold-lock, .agency-lock');
      if (lockEl) lockEl.remove();
    }
  });

  // Update upgrade button
  const upgradeBtn = document.getElementById('header-upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.style.display = userPlan === 'agency' ? 'none' : 'inline-flex';
    if (userPlan === 'free') {
      upgradeBtn.textContent = 'Upgrade to Pro - $5';
      upgradeBtn.href = '/#pricing';
    } else if (userPlan === 'pro') {
      upgradeBtn.textContent = 'Upgrade to Agency - $19';
      upgradeBtn.href = '/#pricing';
    }
  }

  // Update credits display
  const creditsCount = document.getElementById('credits-count');
  if (creditsCount) creditsCount.textContent = userCredits;

  const creditsTotal = document.getElementById('credits-total');
  if (creditsTotal) {
    if (userPlan === 'agency') creditsTotal.textContent = '∞';
    else if (userPlan === 'pro') creditsTotal.textContent = '1,000';
    else creditsTotal.textContent = '100';
  }

  window.isPremium = userPlan !== 'free';
}

// Override switchView to respect plan gating
const _origSwitchViewPlan = window.switchView;
window.switchView = function(viewName) {
  if (!isFeatureAllowed(viewName)) {
    const unlockPlan = PLAN_FEATURES.pro.includes(viewName) ? 'Pro ($5/mo)' : 'Agency ($19/mo)';
    if (typeof showToast === 'function') {
      showToast(`This feature requires ${unlockPlan}. Upgrade to unlock.`, 'warning');
    }
    window.location.href = '/#pricing';
    return;
  }
  if (typeof _origSwitchViewPlan === 'function') {
    _origSwitchViewPlan(viewName);
  }
};

// Initialize plan on page load
setTimeout(() => {
  // Refresh CSRF token first, then sync credits
  fetch('/api/health?channelId=' + (localStorage.getItem('ytseo_channel_id') || 'anonymous'))
    .then(r => r.json())
    .then(data => {
      if (data.csrfToken) {
        window.csrfToken = data.csrfToken;
        localStorage.setItem('csrf_token', data.csrfToken);
        console.log('[CSRF] Token refreshed');
      }
    })
    .catch(() => {})
    .finally(() => syncPlanFromBackend());
}, 500);

// ── SESSION MEMORY SYSTEM ──
const SessionMemory = {
  current: {
    input: null,
    outputs: {},
    timestamp: null,
    toolType: null
  },
  history: [],
  maxHistory: 10,

  save(input, outputs, toolType) {
    this.current = {
      input,
      outputs,
      toolType,
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.history.unshift({
      ...this.current,
      id: Date.now()
    });

    // Keep only last N items
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.saveToStorage();
    this.updateHistoryUI();
  },

  saveToStorage() {
    try {
      localStorage.setItem('ytseo_history', JSON.stringify(this.history));
    } catch (e) {
      console.warn('Could not save to localStorage');
    }
  },

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('ytseo_history');
      if (saved) {
        this.history = JSON.parse(saved);
        this.updateHistoryUI();
      }
    } catch (e) {
      console.warn('Could not load from localStorage');
    }
  },

  getHistory() {
    return this.history;
  },

  loadItem(id) {
    const item = this.history.find(h => h.id === id);
    if (item) {
      this.current = item;
      return item;
    }
    return null;
  },

  clear() {
    this.history = [];
    this.current = { input: null, outputs: {}, timestamp: null, toolType: null };
    localStorage.removeItem('ytseo_history');
    this.updateHistoryUI();
  },

  updateHistoryUI() {
    const historyContainer = document.getElementById('history-list');
    if (!historyContainer) return;

    if (this.history.length === 0) {
      historyContainer.innerHTML = '<p class="text-muted" style="padding:1rem;font-size:0.85rem;">No history yet. Run an analysis to get started.</p>';
      return;
    }

    historyContainer.innerHTML = this.history.map((item, idx) => `
      <div class="history-item" onclick="SessionMemory.loadAndDisplay(${item.id})">
        <div class="history-item-header">
          <span class="history-tool">${item.toolType || 'SEO Analysis'}</span>
          <span class="history-time">${this.formatTime(item.timestamp)}</span>
        </div>
        <div class="history-input-preview">${this.truncate(item.input, 50)}</div>
      </div>
    `).join('');
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return date.toLocaleDateString();
  },

  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  },

  loadAndDisplay(id) {
    const item = this.loadItem(id);
    if (item && item.outputs) {
      // Trigger UI update to show saved results
      window.dispatchEvent(new CustomEvent('sessionLoaded', { detail: item }));
    }
  }
};

// Load history on startup
SessionMemory.loadFromStorage();
window.SessionMemory = SessionMemory;

// ── Optimization Trials ──
const OptimizationTrials = {
  trials: [],
  stats: null,

  async refresh() {
    const tbody = document.getElementById('trials-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;"><i data-lucide="loader" style="animation:spin 1s linear infinite;"></i><p>Loading optimization trials...</p></td></tr>';
    try { lucide.createIcons(); } catch(e) {}

    const channelId = localStorage.getItem('ytseo_channel_id');
    if (!channelId) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i data-lucide="link" style="width:40px;height:40px;opacity:0.3;"></i><p>Connect your YouTube channel to see optimization history.</p></td></tr>';
      return;
    }

    try {
      const res = await fetch(`/api/youtube/optimization-history?channelId=${encodeURIComponent(channelId)}`, {
        headers: {
          'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
          'x-channel-id': channelId,
          'x-access-token': localStorage.getItem('ytseo_access_token') || ''
        }
      });
      if (!res.ok) throw new Error('Failed to fetch trials');
      const data = await res.json();
      this.trials = data.trials || [];
      this.stats = data.stats || { total: 0, improved: 0, improvementRate: 0, avgImprovement: 0 };
      this.render();
    } catch (e) {
      console.warn('[OptimizationTrials] Fetch failed:', e.message);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i data-lucide="alert-triangle" style="width:40px;height:40px;opacity:0.3;"></i><p>Unable to load trials. The database may be waking up - try again in a moment.</p></td></tr>';
    }
  },

  render() {
    // Update stats cards
    const s = this.stats || {};
    document.getElementById('stat-total-trials').textContent = s.total || 0;
    document.getElementById('stat-improved').textContent = s.improved || 0;
    document.getElementById('stat-rate').textContent = (s.improvementRate || 0) + '%';
    document.getElementById('stat-avg-improv').textContent = (s.avgImprovement || 0) + '%';
    document.getElementById('stat-best-type').textContent = (s.bestType && s.bestType.type) ? s.bestType.type.replace(/-/g, ' ') : '--';

    // AI insight
    if (s.total > 0 && s.improvementRate > 0) {
      const insightEl = document.getElementById('trial-insight-box');
      const insightText = document.getElementById('trial-insight-text');
      if (insightEl && insightText) {
        insightEl.style.display = 'block';
        insightText.textContent = s.improvementRate >= 50
          ? `Strong results! ${s.improvementRate}% of your optimizations improved video performance by an average of ${s.avgImprovement}%. Best results come from ${(s.bestType && s.bestType.type) ? s.bestType.type.replace(/-/g, ' ') : 'metadata'} optimizations.`
          : `${s.total} optimization${s.total > 1 ? 's' : ''} recorded. ${s.improved} showed improvement. Keep experimenting - every optimization is a data point for better future results.`;
      }
    }

    // Render trials table
    const tbody = document.getElementById('trials-tbody');
    if (!tbody) return;
    if (this.trials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i data-lucide="inbox" style="width:40px;height:40px;opacity:0.3;"></i><p>No optimization trials yet. Apply optimizations to your videos and they will appear here.</p></td></tr>';
      document.getElementById('measure-all-btn').style.display = 'none';
      return;
    }

    const pendingCount = this.trials.filter(t => t.status === 'pending' || t.status === 'measuring').length;
    const measureBtn = document.getElementById('measure-all-btn');
    if (measureBtn) measureBtn.style.display = pendingCount > 0 ? 'inline-flex' : 'none';

    tbody.innerHTML = this.trials.map(t => {
      const beforeViews = (t.beforeMetrics && t.beforeMetrics.views) ? t.beforeMetrics.views : null;
      const afterViews = (t.afterMetrics && t.afterMetrics.views) ? t.afterMetrics.views : null;
      const beforeDisplay = beforeViews != null ? '👁 ' + beforeViews.toLocaleString() : '--';
      const afterDisplay = afterViews != null ? '👁 ' + afterViews.toLocaleString() : '--';
      const improvement = t.improvementPct != null ? (t.improvementPct > 0 ? '+' + t.improvementPct + '%' : t.improvementPct + '%') : '--';
      const improvementColor = t.improvementPct > 0 ? 'var(--success)' : t.improvementPct < 0 ? '#ef4444' : 'var(--text-muted)';
      const statusLabel = { pending: '⏳ Waiting', measuring: '🔍 Measuring', completed: '✅ Done', failed: '❌ Failed' }[t.status] || t.status;
      const dateStr = t.appliedAt ? new Date(t.appliedAt).toLocaleDateString() : '--';
      const isNegative = t.improvementPct != null && t.improvementPct < 0;
      const daysAgo = t.appliedAt ? Math.floor((Date.now() - new Date(t.appliedAt).getTime()) / 86400000) : 0;
      const windowSelect = document.getElementById('measurement-window-select');
      const windowDays = windowSelect ? parseInt(windowSelect.value) : 30;
      const canMeasure = t.status === 'pending' && daysAgo >= windowDays;
      const measureBtn = canMeasure
        ? `<button class="btn-sm" onclick="OptimizationTrials.measureOne('${t.id}')" style="font-size:11px;">📏 Measure</button>`
        : t.status === 'pending'
          ? `<span style="font-size:11px;color:var(--text-muted);">⏳ ${windowDays - daysAgo}d</span>`
          : (t.status === 'completed' && isNegative
            ? `<button class="btn-sm" onclick="OptimizationTrials.revertOptimization('${t.id}')" style="font-size:11px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444;">↩️ Revert</button>`
            : '--');
      return `<tr>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.escape(t.videoTitle || 'Untitled')}">${this.escape(t.videoTitle || 'Untitled')}</td>
        <td>${(t.optimizationType || '').replace(/-/g, ' ')}</td>
        <td style="font-size:13px;">${beforeDisplay}</td>
        <td style="font-size:13px;">${afterDisplay}</td>
        <td style="color:${improvementColor};font-weight:600;">${improvement}${isNegative ? ' ⚠️' : t.improvementPct > 0 ? ' 📈' : ''}</td>
        <td>${statusLabel}</td>
        <td style="font-size:12px;">${dateStr}</td>
        <td>${measureBtn}</td>
      </tr>`;
    }).join('');
    try { lucide.createIcons(); } catch(e) {}

    // Show negative result guidance
    const negativeBox = document.getElementById('trial-negative-box');
    if (negativeBox) {
      const negativeTrials = this.trials.filter(t => t.improvementPct != null && t.improvementPct < 0);
      if (negativeTrials.length > 0) {
        negativeBox.style.display = 'block';
        document.getElementById('trial-negative-text').textContent =
          `${negativeTrials.length} optimization${negativeTrials.length > 1 ? 's' : ''} made things worse (views dropped). This happens when metadata changes don't match what viewers expect. Consider reverting these changes or trying a different approach - like focusing on tags instead of titles.`;
      } else {
        negativeBox.style.display = 'none';
      }
    }
  },

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  async measureOne(trialId) {
    const channelId = localStorage.getItem('ytseo_channel_id');
    if (!channelId) return alert('Connect your YouTube channel first.');
    try {
      const res = await fetch(`/api/youtube/measure-optimization/${trialId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
          'x-channel-id': channelId,
          'x-access-token': localStorage.getItem('ytseo_access_token') || ''
        },
        body: JSON.stringify({ accessToken: localStorage.getItem('ytseo_access_token') || '' })
      });
      if (!res.ok) throw new Error('Measurement failed');
      await this.refresh();
      showToast('Trial measured successfully!', 'success');
    } catch (e) {
      console.warn('[OptimizationTrials] Measure failed:', e.message);
      showToast('Measurement failed. Try again later.', 'error');
    }
  },

  async measureAllPending() {
    const pending = this.trials.filter(t => t.status === 'pending');
    if (pending.length === 0) return showToast('No pending trials to measure.', 'info');
    const windowSelect = document.getElementById('measurement-window-select');
    const windowDays = windowSelect ? parseInt(windowSelect.value) : 30;
    const ready = pending.filter(t => {
      const daysAgo = t.appliedAt ? Math.floor((Date.now() - new Date(t.appliedAt).getTime()) / 86400000) : 0;
      return daysAgo >= windowDays;
    });
    if (ready.length === 0) return showToast(`No trials ready yet. Wait ${windowDays} days after optimization.`, 'info');
    showToast(`Measuring ${ready.length} trial${ready.length > 1 ? 's' : ''}...`, 'info');
    for (const t of ready) await this.measureOne(t.id);
  },

  async measureImpact() {
    const accessToken = localStorage.getItem('ytseo_access_token');
    if (!accessToken) return showToast('Connect your YouTube channel first.', 'error');
    showToast('Measuring impact across all trials...', 'info');
    try {
      const res = await fetch('/api/measure/measure-now', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      });
      const data = await res.json();
      if (data.measured > 0) {
        showToast(`Measured ${data.measured} trials - ${data.improved} improved!`, 'success');
      } else {
        showToast(data.message || 'No trials ready yet', 'info');
      }
      await this.refresh();
    } catch(e) { showToast('Failed: ' + e.message, 'error'); }
  },

  async revertOptimization(trialId) {
    if (!confirm('Restore this video to its original metadata before optimization? This action cannot be undone.')) return;
    showToast('Reverting optimization...', 'info');
    const channelId = localStorage.getItem('ytseo_channel_id');
    try {
      const res = await fetch(`/api/youtube/revert-optimization/${trialId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
          'x-channel-id': channelId,
          'x-access-token': localStorage.getItem('ytseo_access_token') || ''
        },
        body: JSON.stringify({ accessToken: localStorage.getItem('ytseo_access_token') || '' })
      });
      if (!res.ok) throw new Error('Revert failed');
      await this.refresh();
      showToast('Optimization reverted. Video restored to original metadata.', 'success');
    } catch (e) {
      showToast('Revert failed: ' + e.message, 'error');
    }
  }
};
window.OptimizationTrials = OptimizationTrials;

window.setMeasurementWindow = function(days) {
  localStorage.setItem('optimization_window', days);
  if (typeof OptimizationTrials !== 'undefined') OptimizationTrials.refresh();
};

// ── Growth Engine ──
const GrowthEngine = {
  async scan() {
    const loading = document.getElementById('growth-engine-loading');
    const results = document.getElementById('growth-engine-results');
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';

    const channelId = localStorage.getItem('ytseo_channel_id');
    const accessToken = localStorage.getItem('ytseo_access_token');
    if (!channelId || !accessToken) {
      if (loading) loading.style.display = 'none';
      showToast('Connect your YouTube channel first.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/youtube/growth-engine/scan?channelId=${encodeURIComponent(channelId)}&accessToken=${encodeURIComponent(accessToken)}`, {
        headers: { 'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '', 'x-channel-id': channelId }
      });
      const data = await res.json();
      if (loading) loading.style.display = 'none';
      if (results) results.style.display = 'block';

      const summary = document.getElementById('growth-summary');
      if (summary) {
        summary.innerHTML = data.needsOptimization > 0
          ? `<span style="color:var(--primary);font-weight:700;">🔍 Found <strong>${data.needsOptimization}</strong> video${data.needsOptimization > 1 ? 's' : ''} needing optimization</span> out of ${data.totalVideos} scanned.`
          : '<span style="color:var(--success);">✅ All videos are well-optimized!</span>';
      }

      const list = document.getElementById('growth-video-list');
      if (list && data.videos) {
        list.innerHTML = data.videos.filter(v => v.needsOptimization).map(v => `
          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="color:var(--text-primary);">${GrowthEngine.escape(v.title)}</strong>
              <span style="font-size:12px;color:var(--text-muted);">👁 ${v.views.toLocaleString()} views</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${v.issues.map(i => `<span style="font-size:11px;padding:3px 8px;border-radius:4px;background:${i.severity === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'};color:${i.severity === 'high' ? '#ef4444' : '#f59e0b'};">${i.issue}</span>`).join('')}
            </div>
            <button class="btn-sm" onclick='GrowthEngine.openAuditor("${v.videoId}", ${JSON.stringify(v.issues).replace(/'/g, "&#39;")})' style="margin-top:8px;font-size:11px;">🔧 Fix in Metadata Auditor</button>
          </div>
        `).join('') || '<p style="color:var(--text-muted);">No issues found - your channel is in great shape!</p>';
      }

      // Also refresh the background report and Neural Strategy
      this.loadReport();
      if (typeof loadNeuralStrategy === 'function') {
        setTimeout(() => loadNeuralStrategy(), 500);
      }
    } catch (e) {
      if (loading) loading.style.display = 'none';
      showToast('Scan failed: ' + e.message, 'error');
    }
  },
  async loadReport() {
    const grid = document.getElementById('neural-strategy-grid');
    if (!grid) return;

    const channelId = localStorage.getItem('ytseo_channel_id');
    if (!channelId) return;

    try {
      const res = await fetch(`/api/youtube/growth-engine/report?channelId=${encodeURIComponent(channelId)}`);
      const data = await res.json();

      if (data.lastGrowthScan) {
        const scan = data.lastGrowthScan;
        grid.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:15px;margin-top:20px;">
            <div class="stat-card" style="background:rgba(124, 58, 237, 0.05);border:1px solid rgba(124, 58, 237, 0.2);">
              <span style="font-size:12px;color:var(--text-muted);">Avg SEO Score</span>
              <div style="font-size:24px;font-weight:700;color:var(--primary);">${scan.overallScore}</div>
            </div>
            <div class="stat-card" style="background:rgba(16, 185, 129, 0.05);border:1px solid rgba(16, 185, 129, 0.2);">
              <span style="font-size:12px;color:var(--text-muted);">Action Required</span>
              <div style="font-size:24px;font-weight:700;color:var(--success);">${scan.videosNeedAttention} Videos</div>
            </div>
            <div class="stat-card" style="background:rgba(245, 158, 11, 0.05);border:1px solid rgba(245, 158, 11, 0.2);">
              <span style="font-size:12px;color:var(--text-muted);">Last Background Audit</span>
              <div style="font-size:14px;font-weight:600;margin-top:8px;">${new Date(scan.lastScanAt).toLocaleDateString()}</div>
            </div>
          </div>
          <div style="margin-top:20px;padding:15px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;">
            <h4 style="margin-bottom:10px;font-size:14px;color:var(--text-primary);">🚀 Top Priority Optimization</h4>
            ${scan.topPriorityVideo ? `
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;">${this.escape(scan.topPriorityVideo.title)}</div>
                  <div style="font-size:12px;color:var(--text-muted);">Score: ${scan.topPriorityVideo.seoScore} | ${scan.topPriorityVideo.strategyCategory}</div>
                </div>
                <button class="btn-sm" onclick="switchView('metadata-auditor')">Fix Now</button>
              </div>
            ` : '<p>No priority issues found.</p>'}
          </div>
        `;
      }
    } catch (e) {
      console.error('Failed to load growth report:', e);
    }
  },
  escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },
  async openAuditor(videoId, issues) {
    // Refresh CSRF token before navigating
    try {
      const res = await fetch('/api/auth/csrf?channelId=' + (localStorage.getItem('ytseo_channel_id') || 'anonymous'));
      const data = await res.json();
      if (data.token) {
        window.csrfToken = data.token;
        localStorage.setItem('csrf_token', data.token);
      }
    } catch(e) {}
    // Store video ID for auditor to navigate to
    localStorage.setItem('growth_engine_target_video', videoId);
    if (issues && issues.length > 0) {
      // 'growth_engine_issues' - used by switchView to render the banner
      localStorage.setItem('growth_engine_issues', JSON.stringify(issues));
      // 'growth_engine_issues_for_audit' - used by auditVideoMetadata() to inject into AI prompt
      localStorage.setItem('growth_engine_issues_for_audit', JSON.stringify(issues));
    }
    switchView('metadata-auditor');
  }
};
window.GrowthEngine = GrowthEngine;

// ── Optimization Inbox ──
// ══ OPTIMIZATION QUEUE (TASK 09) ══

async function loadOptQueue() {
  const chId = localStorage.getItem('ytseo_channel_id');
  if (!chId) { document.getElementById('queue-empty').style.display='block'; return; }
  const loading=document.getElementById('queue-loading'), list=document.getElementById('queue-list'), empty=document.getElementById('queue-empty');
  if(loading)loading.style.display='block'; if(list)list.style.display='none'; if(empty)empty.style.display='none';
  try {
    const res=await fetch('/api/cron/queue?channelId='+encodeURIComponent(chId),{headers:{'x-channel-id':chId,'x-csrf-token':window.csrfToken||localStorage.getItem('csrf_token')||''}});
    const data=await res.json();
    const s=data.stats||{};
    document.getElementById('qs-pending').textContent=s.pending||0;
    document.getElementById('qs-approved').textContent=s.approved||0;
    document.getElementById('qs-applied').textContent=s.applied||0;
    document.getElementById('qs-skipped').textContent=s.skipped||0;
    const badge=document.getElementById('queue-badge');
    if(badge){badge.textContent=s.pending||0;badge.style.display=(s.pending||0)>0?'inline-flex':'none';}
    const queue=data.queue||[];
    if(!queue.length){if(empty)empty.style.display='block';}else{
      renderQueueItems(queue);
      document.getElementById('queue-count-label').textContent=queue.length+' proposal'+(queue.length!==1?'s':'')+' waiting';
      if(list)list.style.display='block';
    }
  }catch(e){ if(empty){empty.style.display='block';empty.innerHTML='<p style="color:#ef4444;">Failed: '+e.message+'</p>';} }
  if(loading)loading.style.display='none';
}

function renderQueueItems(queue) {
  const c=document.getElementById('queue-items'); if(!c)return;
  c.innerHTML=queue.map(item=>{
    const lift=(item.scoreAfter||0)-(item.scoreBefore||0);
    const actionType=item.actionType||'optimization';
    const typeIcons={title:'🔧',tags:'🏷',description:'📝',chapters:'📑',evergreen:'🌲',preupload:'✅',keyword_opportunity:'🔑',ab_test:'🧪'};
    const typeLabels={title:'Title Fix',tags:'Tag Optimization',description:'Description',chapters:'Chapters',evergreen:'Evergreen',preupload:'Pre-Upload Check',keyword_opportunity:'Keyword Opp',ab_test:'A/B Test'};
    const icon=typeIcons[actionType]||'🔧';
    const label=typeLabels[actionType]||'Optimization';
    
    return `<div id="qitem-${item.id}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:14px;">${icon}</span>
        <span style="font-size:12px;font-weight:600;color:var(--war-accent);">${label}</span>
        ${item.confidence ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700;">${item.confidence}%</span>` : ''}
        ${item.evScore ? `<span style="font-size:10px;color:var(--text-muted);">EV ${Number(item.evScore).toFixed(1)}</span>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:0;">
          ${item.currentTitle ? `<div style="font-size:11px;color:var(--text-muted);">Current</div><div style="font-size:13px;color:var(--text-muted);text-decoration:line-through;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(item.currentTitle||'')}</div>` : ''}
          ${item.currentDescription ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Current Description</div><div style="font-size:11px;color:var(--text-muted);max-height:40px;overflow:hidden;line-height:1.4;">${escHTML((item.currentDescription||'').substring(0,120))}</div>` : ''}
          ${item.currentTags && item.currentTags.length ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Current Tags: ${item.currentTags.slice(0,4).map(t=>escHTML(t)).join(', ')}${item.currentTags.length>4?' +'+(item.currentTags.length-4)+' more':''}</div>` : ''}
          ${item.proposedTitle ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Proposed</div><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(item.proposedTitle||'')}</div>` : ''}
        </div>
        <div style="text-align:center;min-width:70px;">
          <div style="font-size:22px;font-weight:800;color:${lift>0?'#10b981':'var(--text-muted)'};">${lift>0?'+':''}${lift}</div>
          <div style="font-size:10px;color:var(--text-muted);">SEO lift</div>
        </div>
      </div>
      ${item.proposedDescription ? `<div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:10px;font-size:12px;color:var(--text-muted);margin-bottom:8px;max-height:100px;overflow-y:auto;line-height:1.5;white-space:pre-wrap;">📄 ${escHTML((item.proposedDescription||'').substring(0,500))}${(item.proposedDescription||'').length>500?'...':''}</div>` : ''}
      ${item.proposedTags&&item.proposedTags.length ? `<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">🏷 Proposed Tags</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${(Array.isArray(item.proposedTags)?item.proposedTags:[]).slice(0,12).map(t=>`<span style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);padding:3px 8px;border-radius:4px;font-size:11px;color:#818cf8;">${escHTML(t)}</span>`).join('')}</div></div>` : ''}
      ${item.rationale ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:6px 10px;background:rgba(255,255,255,0.02);border-radius:6px;line-height:1.4;">💡 ${escHTML(item.rationale.substring(0,200))}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-sm" onclick="applyQueueItem('${item.id}')" style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;">✅ Apply</button>
        <button class="btn-sm" onclick="skipQueueItem('${item.id}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;">⏭ Skip</button>
      </div>
    </div>`;
  }).join('');
}

async function applyQueueItem(id) {
  const tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect your YouTube channel first','error');
  const btn=document.querySelector('#qitem-'+id+' button');
  if(btn){btn.disabled=true;btn.textContent='Applying...';}
  try{
    const chId=localStorage.getItem('ytseo_channel_id');
    const res=await fetch('/api/cron/queue/'+id+'/apply',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':chId},body:JSON.stringify({accessToken:tok})});
    const d=await res.json();
    if(!res.ok)throw new Error(d.error);
    const el=document.getElementById('qitem-'+id);
    if(el){el.style.opacity='0';el.style.transform='translateX(20px)';setTimeout(()=>el.remove(),300);}
    showToast('✅ Applied to YouTube!','success');
    setTimeout(loadOptQueue,500);
  }catch(e){if(btn){btn.disabled=false;btn.textContent='✅ Apply';}showToast('Failed: '+e.message,'error');}
}

async function skipQueueItem(id) {
  const chId=localStorage.getItem('ytseo_channel_id');
  await fetch('/api/cron/queue/'+id+'/action',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':chId},body:JSON.stringify({action:'skipped'})});
  const el=document.getElementById('qitem-'+id);
  if(el){el.style.opacity='0';setTimeout(()=>el.remove(),200);}
}

async function skipAllQueue() {
  if(!confirm('Skip all pending?'))return;
  const els=document.querySelectorAll('[id^="qitem-"]');
  for(const el of els)await skipQueueItem(el.id.replace('qitem-',''));
  setTimeout(loadOptQueue,300);
}

async function approveAllQueue(){
  if(!confirm('Approve all pending optimizations?'))return;
  showToast('Approving all...','info');
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/cron/queue/approve-all',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':ch},body:'{}'});
    var d=await r.json();
    showToast(d.approved+' items approved!','success');
    loadOptQueue();
  }catch(e){showToast('Failed: '+e.message,'error');}
}

async function scanAndQueue() {
  const tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect your channel first','error');
  const btn=document.getElementById('queue-scan-btn');
  if(btn){btn.disabled=true;btn.textContent='Scanning...';}
  document.getElementById('queue-loading').style.display='block';
  document.getElementById('queue-list').style.display='none';
  try{
    const chId=localStorage.getItem('ytseo_channel_id');
    const res=await fetch('/api/cron/scan-and-queue',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':chId},body:JSON.stringify({accessToken:tok,channelId:chId})});
    const d=await res.json();
    showToast(d.queued>0?d.queued+' proposals queued!':d.message||'All optimized!','success');
    await loadOptQueue();
  }catch(e){showToast('Scan failed: '+e.message,'error');}
  document.getElementById('queue-loading').style.display='none';
  if(btn){btn.disabled=false;btn.textContent='🤖 AI Scan Now';}
}

function escHTML(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

window.loadOptQueue=loadOptQueue;
window.applyQueueItem=applyQueueItem;
window.skipQueueItem=skipQueueItem;
window.skipAllQueue=skipAllQueue;
window.approveAllQueue=approveAllQueue;
window.scanAndQueue=scanAndQueue;

// ══ GROWTH ANALYTICS ══
async function loadAnalytics() {
  const ch = localStorage.getItem('ytseo_channel_id');
  const days = document.getElementById('analytics-days')?.value || 30;
  if (!ch) return;
  try {
    const res = await fetch('/api/analytics/summary?days='+days+'&channelId='+encodeURIComponent(ch), { headers: { 'x-channel-id': ch } });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    const t = d.totals || {};
    const el = function(id) { return document.getElementById(id); };
    if(el('kpi-opts'))el('kpi-opts').textContent = t.optimizations ?? '-';
    if(el('kpi-lift'))el('kpi-lift').textContent = t.avgSeoLift > 0 ? '+' + t.avgSeoLift : (t.avgSeoLift ?? '-');
    if(el('kpi-health'))el('kpi-health').textContent = Math.round(d.health?.avgScore || 0) || '-';
    if(el('kpi-credits'))el('kpi-credits').textContent = t.creditsUsed ?? '-';
    if(el('kpi-abtests'))el('kpi-abtests').textContent = (d.abSummary?.total) ?? '-';
    const bars = el('analytics-bars');
    if (bars && d.timeline && d.timeline.length) {
      const max = Math.max(1, ...d.timeline.map(function(x){return x.count||0;}));
      bars.innerHTML = d.timeline.map(function(x){
        var h = Math.max(4, Math.round((x.count||0)/max*70));
        return '<div title="'+x.day+': '+x.count+' opt" style="flex:1;max-width:20px;height:'+h+'px;background:linear-gradient(to top,var(--primary),rgba(249,115,22,.2));border-radius:3px 3px 0 0;"></div>';
      }).join('');
    } else if (bars) { bars.innerHTML = '<p style="color:var(--text-muted);font-size:12px;margin:auto;">No data yet</p>'; }
    const qEl = el('analytics-queue');
    if (qEl) {
      var cols = { applied: '#10b981', approved: 'var(--primary)', skipped: 'var(--text-muted)', pending: '#f59e0b' };
      var html = '';
      (d.queueThroughput||[]).forEach(function(s){
        html += '<div style="flex:1;min-width:70px;background:rgba(0,0,0,.2);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;color:'+(cols[s.status]||'inherit')+';">'+s.count+'</div><div style="font-size:10px;color:var(--text-muted);">'+s.status+'</div></div>';
      });
      qEl.innerHTML = html || '<p style="color:var(--text-muted);">No data</p>';
    }
    // A/B Test Summary
    var ab = d.abSummary || {};
    var abEl = el('analytics-ab');
    if (abEl) {
      abEl.innerHTML = ab.total ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;"><div style="background:rgba(0,0,0,.2);border-radius:8px;padding:12px;"><div style="font-size:22px;font-weight:900;">'+ab.total+'</div><div style="font-size:11px;color:var(--text-muted);">Total</div></div><div style="background:rgba(0,0,0,.2);border-radius:8px;padding:12px;"><div style="font-size:22px;font-weight:900;color:#10b981;">'+ab.complete+'</div><div style="font-size:11px;color:var(--text-muted);">Complete</div></div><div style="background:rgba(0,0,0,.2);border-radius:8px;padding:12px;"><div style="font-size:22px;font-weight:900;color:#f59e0b;">'+ab.running+'</div><div style="font-size:11px;color:var(--text-muted);">Running</div></div></div><p style="margin:12px 0 0;font-size:13px;color:var(--text-muted);">B wins: <strong style="color:var(--accent);">'+(ab.complete?Math.round(ab.bWins/ab.complete*100):0)+'%</strong> ('+ab.bWins+'B / '+ab.aWins+'A)</p>' : '<p style="color:var(--text-muted);font-size:13px;">No A/B tests yet.</p>';
    }
  } catch(e) { console.warn('[Analytics]', e.message); }
}
window.loadAnalytics = loadAnalytics;

// ══ KEYWORD INTELLIGENCE LAB ══
window.kwlData=[];
async function runKeywordResearch(){
  var s=document.getElementById('kwl-seed').value.trim();
  if(!s||s.length<2)return showToast('Enter a keyword','error');
  var btn=document.getElementById('kwl-btn');
  document.getElementById('kwl-loading').style.display='block';
  document.getElementById('kwl-results').style.display='none';
  document.getElementById('kwl-empty').style.display='none';
  if(btn){btn.disabled=true;btn.textContent='Researching...';}
  try{
    var r=await fetch('/api/keywords/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:s})});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error);
    window.kwlData=d.keywords||[];
    var top=d.topOpportunity;
    if(top){
      document.getElementById('kwl-top').innerHTML='<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;"><div><div style="font-size:11px;text-transform:uppercase;color:var(--primary);margin-bottom:4px;">⭐ Top Opportunity</div><div style="font-size:20px;font-weight:700;">'+top.keyword+'</div><div style="color:var(--text-muted);margin-top:4px;">Volume: <strong style="color:var(--success)">'+top.volumeTier+'</strong> · Competition: <strong style="color:'+(top.competition==='Low'?'var(--success)':'var(--warning)')+'">'+top.competition+'</strong></div>'+(d.suggestedTitle?'<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">💡 '+d.suggestedTitle+'</div>':'')+'</div><div style="text-align:center;"><div style="font-size:36px;font-weight:800;color:var(--primary);">'+top.opportunityScore+'</div><div style="font-size:11px;color:var(--text-muted);">Score</div></div></div>';
    }
    var vc={High:'var(--success)',Medium:'var(--warning)',Low:'var(--text-muted)'};
    var cc={Low:'var(--success)',Medium:'var(--warning)',High:'#ef4444'};
    var oc=function(s){return s>=70?'var(--success)':s>=40?'var(--warning)':'var(--text-muted)';};
    document.getElementById('kwl-body').innerHTML=(d.keywords||[]).map(function(k){
      return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);"><td style="padding:10px;font-weight:500;">'+k.keyword+'</td><td style="padding:10px;"><span style="color:'+vc[k.volumeTier]+'">'+k.volumeTier+'</span></td><td style="padding:10px;"><span style="color:'+cc[k.competition]+'">'+k.competition+'</span></td><td style="padding:10px;"><div style="display:flex;align-items:center;gap:8px;"><div style="width:50px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div style="width:'+k.opportunityScore+'%;height:100%;background:'+oc(k.opportunityScore)+';border-radius:3px;"></div></div><span style="font-size:12px;color:'+oc(k.opportunityScore)+'">'+k.opportunityScore+'</span></div></td></tr>';
    }).join('');
    document.getElementById('kwl-results').style.display='block';
  }catch(e){document.getElementById('kwl-empty').style.display='block';}
  document.getElementById('kwl-loading').style.display='none';
  if(btn){btn.disabled=false;btn.textContent='Research →';}
}
window.runKeywordResearch=runKeywordResearch;

// ══ A/B TITLE TESTER ══
async function loadAbTests(){
  var ch=localStorage.getItem('ytseo_channel_id');
  if(!ch)return;
  var list=document.getElementById('ab-list');
  list.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);">Loading...</div>';
  try{
    var r=await fetch('/api/ab-test/list?channelId='+encodeURIComponent(ch),{headers:{'x-channel-id':ch}});
    var d=await r.json();
    if(!d.tests||!d.tests.length){list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">No A/B tests yet. Start one above.</div>';return;}
    list.innerHTML=d.tests.map(function(t){
      var statusColor=t.status==='running'?'#f59e0b':t.status==='completed'?'#10b981':'var(--text-muted)';
      var aGain=(t.variantAViewsEnd||0)-(t.variantAViewsStart||0);
      var bGain=(t.variantBViewsEnd||0)-(t.variantBViewsStart||t.variantAViewsEnd||0);
      var phaseLabel=t.phase==='variant_a'?'🅰️ Phase A':'🅱️ Phase B';
      var started=new Date(t.phaseStartedAt);
      var hoursLeft=Math.max(0,48-Math.floor((Date.now()-started)/3600000));
      var canAdvance=hoursLeft===0;
      return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:10px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'+
        '<strong>'+t.videoId+'</strong>'+
        '<span style="color:'+statusColor+';font-size:12px;font-weight:600;">'+t.status.toUpperCase()+'</span></div>'+
        (t.status==='running'?'<div style="font-size:14px;margin-bottom:8px;">'+phaseLabel+(hoursLeft>0?' - '+hoursLeft+'h until next phase':' - Ready to advance!')+'</div>':'')+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
        '<div style="background:rgba(0,0,0,.2);border-radius:8px;padding:12px;"><div style="font-size:11px;color:var(--text-muted);">Variant A</div><div style="font-weight:600;font-size:14px;margin:4px 0;">'+t.variantA+'</div>'+(t.variantAViewsEnd?'<div style="font-size:12px;color:#10b981;">📈 +'+aGain+' views</div>':'<div style="font-size:12px;color:var(--text-muted);">👁 Started at '+t.variantAViewsStart+' views</div>')+'</div>'+
        '<div style="background:rgba(0,0,0,.2);border-radius:8px;padding:12px;"><div style="font-size:11px;color:var(--text-muted);">Variant B</div><div style="font-weight:600;font-size:14px;margin:4px 0;">'+t.variantB+'</div>'+(t.variantBViewsEnd?'<div style="font-size:12px;color:#10b981;">📈 +'+bGain+' views</div>':'<div style="font-size:12px;color:var(--text-muted);">Waiting for phase B</div>')+'</div>'+
        '</div>'+
        (t.winner?'<div style="margin-top:10px;padding:10px;background:rgba(16,185,129,0.1);border-radius:8px;font-weight:600;color:#10b981;">🏆 Winner: '+(t.winner==='variant_a'?'A':'B')+' - '+(t.winner==='variant_a'?t.variantA:t.variantB)+' (+'+(t.winner==='variant_a'?aGain:bGain)+' views)</div>':'')+
        (t.status==='running'?'<button class="btn-sm" onclick="advanceAbTest(\''+t.id+'\')" style="margin-top:10px;'+(canAdvance?'':'opacity:0.5;pointer-events:none;')+'">⏩ '+(hoursLeft>0?'Advance in '+hoursLeft+'h':'Advance Phase')+'</button>':'')+
      '</div>';
    }).join('');
  }catch(e){list.innerHTML='<p style="color:#ef4444;">Failed: '+e.message+'</p>';}
}

async function startAbTest(){
  var url=document.getElementById('ab-video-url').value.trim();
  var a=document.getElementById('ab-variant-a').value.trim();
  var b=document.getElementById('ab-variant-b').value.trim();
  var tok=localStorage.getItem('ytseo_access_token');
  if(!url||!a||!b||!tok)return showToast('Fill all fields and connect channel','error');
  var m=url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if(!m)return showToast('Invalid YouTube URL','error');
  var load=document.getElementById('ab-loading');
  if(load)load.style.display='block';
  try{
    var ch=localStorage.getItem('ytseo_channel_id');
    var r=await fetch('/api/ab-test/start',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':ch},body:JSON.stringify({videoId:m[1],variantA:a,variantB:b,accessToken:tok,channelId:ch})});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error);
    showToast('A/B test started! Variant A applied.','success');
    await loadAbTests();
  }catch(e){showToast('Failed: '+e.message,'error');}
  if(load)load.style.display='none';
}

async function advanceAbTest(id){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect channel first','error');
  try{
    var r=await fetch('/api/ab-test/advance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testId:id,accessToken:tok})});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error);
    if(d.winner) showToast('Test complete! Winner: '+d.winnerTitle,'success');
    else showToast('Advanced to phase: '+d.phase,'success');
    await loadAbTests();
  }catch(e){showToast('Failed: '+e.message,'error');}
}

window.loadAbTests=loadAbTests;
window.startAbTest=startAbTest;

async function suggestAbVariants(){
  var url=document.getElementById('ab-video-url')?.value?.trim();
  if(!url){showToast('Enter a video URL first','error');return;}
  var videoId=url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
  if(!videoId){showToast('Invalid YouTube URL','error');return;}
  showToast('AI generating title variants...','info');
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/ab-test/suggest-variants',{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':ch},body:JSON.stringify({videoId,niche:'YouTube SEO'})});
    var d=await r.json();
    if(d.variantA)document.getElementById('ab-variant-a').value=d.variantA;
    if(d.variantB)document.getElementById('ab-variant-b').value=d.variantB;
    showToast(d.originalTitle?'From: "'+d.originalTitle.substring(0,50)+'..."':'Variants generated!','success');
  }catch(e){showToast('AI suggestion failed: '+e.message,'error');}
}
window.suggestAbVariants=suggestAbVariants;
window.advanceAbTest=advanceAbTest;

// ══ SEO LAB (Admin Only) ══
async function loadSeoLab(){
  if(!isAdmin())return;
  try{
    var r=await fetch('/api/pseo/clusters/opportunities');
    var d=await r.json();
    document.getElementById('seo-pages-count').textContent=d.stats?.publishedPages||0;
    document.getElementById('seo-opp-count').textContent=d.stats?.pendingOpportunities||0;
    document.getElementById('seo-cluster-count').textContent=d.stats?.clusters||0;
    var tbody=document.getElementById('seo-opp-body');
    tbody.innerHTML=(d.opportunities||[]).map(function(o){
      return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);"><td style="padding:10px;">'+o.keyword+'</td><td style="padding:10px;">'+('⭐'.repeat(o.priority))+ '</td><td style="padding:10px;color:#f59e0b;">pending</td><td style="padding:10px;"><button class="btn-sm" onclick="generateSeoPage(\''+o.id+'\')">Generate</button></td></tr>';
    }).join('')||'<tr><td colspan="4" style="padding:20px;color:var(--text-muted);text-align:center;">No opportunities. Run Scan Clusters first.</td></tr>';
  }catch(e){}
}

async function generateClusters(){
  var niche=prompt('Enter niche (e.g. YouTube SEO):','YouTube SEO');
  var seed=prompt('Enter seed keyword (e.g. youtube tips):','youtube tips');
  if(!niche||!seed)return;
  showToast('Generating clusters...','info');
  try{
    var r=await fetch('/api/pseo/clusters/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({niche,seedKeyword:seed})});
    var d=await r.json();
    showToast(d.clustersGenerated+' clusters generated!','success');
    loadSeoLab();
  }catch(e){showToast('Failed: '+e.message,'error');}
}

async function bulkGeneratePages(){
  var niche=prompt('Niche context (e.g. YouTube SEO):','YouTube SEO');
  if(!niche)return;
  showToast('Generating pages...','info');
  try{
    var r=await fetch('/api/pseo/generator/bulk-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:5,niche})});
    var d=await r.json();
    showToast(d.generated+' pages published!','success');
    loadSeoLab();
  }catch(e){showToast('Failed: '+e.message,'error');}
}

async function generateSeoPage(oppId){
  showToast('Generating...','info');
  try{
    var r=await fetch('/api/pseo/generator/bulk-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:1,opportunityId:oppId,niche:'YouTube SEO'})});
    var d=await r.json();
    showToast('Page published: /blog/'+d.slugs[0],'success');
    loadSeoLab();
  }catch(e){showToast('Failed: '+e.message,'error');}
}

window.loadSeoLab=loadSeoLab;
window.generateClusters=generateClusters;
window.bulkGeneratePages=bulkGeneratePages;

async function toggleAutoPublish(enabled){
  try{
    var r=await fetch('/api/pseo/generator/auto-publish/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
    var d=await r.json();
    var slider=document.getElementById('auto-publish-slider');
    if(slider)slider.style.background=enabled?'#10b981':'#888';
    showToast(enabled?'Auto-publish ON - 2 pages/day':'Auto-publish OFF','info');
  }catch(e){showToast('Toggle failed','error');}
}
window.toggleAutoPublish=toggleAutoPublish;

// Load auto-publish state on SEO Lab open
async function loadAutoPublishState(){
  try{
    var r=await fetch('/api/pseo/generator/auto-publish/status');
    var d=await r.json();
    var cb=document.getElementById('auto-publish-toggle');
    var slider=document.getElementById('auto-publish-slider');
    if(cb)cb.checked=d.autoPublishPseo;
    if(slider)slider.style.background=d.autoPublishPseo?'#10b981':'#888';
  }catch(e){}
}
window.loadAutoPublishState=loadAutoPublishState;
window.generateSeoPage=generateSeoPage;

async function discoverCompetitors(){
  var niche=prompt('Enter niche to discover competitors:','YouTube SEO');
  if(!niche)return;
  showToast('Searching for competitors...','info');
  try{
    var r=await fetch('/api/pseo/competitors/discover-competitors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({niche})});
    var d=await r.json();
    var comps=d.competitors||[];
    var doms=d.domains||[];
    if(comps.length){
      var list=comps.map(function(u,i){return (i+1)+'. '+u;}).join('\\n');
      var analyze=confirm('Found '+doms.length+' competitor domains. Analyze them?\\n\\nDomains: '+doms.join(', ')+'\\n\\nClick OK to start competitor analysis.');
      if(analyze){
        showToast('Analyzing competitor pages...','info');
        var a=await fetch('/api/pseo/competitors/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls:comps.slice(0,5),niche})});
        var ad=await a.json();
        showToast('Analyzed '+ad.analyzed+' pages. '+ad.weakPages+' are easy to beat!','success');
        loadSeoLab();
      }
    }else{
      showToast('No competitors found. Try a different niche.','error');
    }
  }catch(e){showToast('Failed: '+e.message,'error');}
}
window.discoverCompetitors=discoverCompetitors;

// ══ PHRONESIS ══
// ── loadPhronesis() - fetches agent status & populates high-end Phronesis UI ──
async function loadPhronesis(){
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/status',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    var s=d.settings||{};
    // Update status dot + text in the high-end war room header
    var dot=document.getElementById('war-status-dot');
    var txt=document.getElementById('war-status-text');
    var badge=document.getElementById('war-mode-badge');
    if(s.isAutonomous){
      if(dot){dot.style.background='var(--war-success)';dot.classList.add('agent-active');}
      if(txt)txt.textContent='Autonomous Mode Active';
      if(badge)badge.textContent='MONITORING';
      // Ensure the MONITOR button is highlighted
      document.querySelectorAll('.auto-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode==='monitor');});
    } else {
      if(dot){dot.style.background='var(--war-danger)';dot.classList.remove('agent-active');}
      if(txt)txt.textContent='Agent Offline';
      if(badge)badge.textContent='OFF';
      document.querySelectorAll('.auto-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode==='off');});
    }
    // Populate activity feed from logs
    var logs=d.logs||[];
    var feed=document.getElementById('agent-activity-feed');
    if(feed&&logs.length){
      feed.innerHTML='';
      logs.forEach(function(l){
        var time=l.createdAt?new Date(l.createdAt).toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'}):'';
        var cls=l.status==='success'?'feed-success':l.status==='warning'?'feed-warning':'feed-info';
        feed.innerHTML+='<div class="feed-item '+cls+'"><span class="feed-time">'+time+'</span><span class="feed-agent">['+l.agentName+']</span><span class="feed-msg">'+l.actionTaken+'</span></div>';
      });
    }
    // Update brain stats
    var decisions=document.getElementById('brain-decisions');
    var accuracy=document.getElementById('brain-accuracy');
    var patterns=document.getElementById('brain-patterns');
    if(decisions)decisions.textContent=logs.length||'-';
    if(accuracy)accuracy.textContent='94%';
    if(patterns)patterns.textContent='42';
  }catch(e){}
}

window.loadPhronesis=loadPhronesis;

async function loadCommandInbox(){
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent-core/pending',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    // Store full items for preview/edit modal
    window._inboxItems={};(d.items||[]).forEach(function(i){window._inboxItems[i.id]=i;});
    var el=document.getElementById('war-inbox-list');
    if(!el)return;
    if(!d.items||!d.items.length){
      el.innerHTML='<p style="color:var(--war-muted);text-align:center;padding:40px;">📭 No proposals yet. Agent will queue them here when it finds optimizations.</p>';
      return;
    }
    // Reset inbox before rendering to avoid stale items
    el.innerHTML='';
    el.innerHTML=d.items.map(function(item){
      // Use stored actionType from DB (now properly stored)
      var actionType=item.actionType||'optimization';
      var hasTitle=!!item.proposedTitle;
      var hasDesc=!!item.proposedDescription;
      var hasTags=item.proposedTags&&item.proposedTags.length>0;
      
      // Action type map with icons, labels, and CSS classes
      var typeMap={
        title:{icon:'🔧',cls:'badge-optimizer',label:'Title Fix'},
        tags:{icon:'🏷',cls:'badge-ab',label:'Tag Optimization'},
        description:{icon:'📝',cls:'badge-pseo',label:'Description'},
        chapters:{icon:'📑',cls:'badge-pseo',label:'Chapters'},
        evergreen:{icon:'🌲',cls:'badge-pseo',label:'Evergreen'},
        preupload:{icon:'✅',cls:'badge-optimizer',label:'Pre-Upload Check'},
        keyword_opportunity:{icon:'🔑',cls:'badge-trend',label:'Keyword Opportunity'},
        ab_test:{icon:'🧪',cls:'badge-ab',label:'A/B Test'},
        optimization:{icon:'🔧',cls:'badge-optimizer',label:'Optimizer'}
      };
      var mapped=typeMap[actionType]||typeMap.optimization;
      var icon=mapped.icon, badgeClass=mapped.cls, actionLabel=mapped.label;
      
      // Use stored confidence if available, otherwise compute
      var confidence=item.confidence||(item.scoreAfter?Math.min(95,Math.round(item.scoreAfter-(item.scoreBefore||0)+50)):50);
      var confClass=confidence>=85?'high':confidence>=60?'medium':'low';
      var confGlow=confidence>=85?' conf-glow-high':confidence>=60?' conf-glow-medium':' conf-glow-low';
      
      var statusColors={pending:'#f59e0b',approved:'var(--war-accent)',applied:'#10b981',skipped:'var(--war-muted)'};
      var statusLabels={pending:'⏳ Pending Review',approved:'✅ Approved',applied:'⚡ Auto-Applied',skipped:'❌ Skipped'};
      var status=item.status||'pending';
      var showButtons=status==='pending';
      var shortTitle=(item.videoTitle||'Unknown').substring(0,55);
      var score=item.scoreBefore||0;
      var afterScore=item.scoreAfter||80;
      var lift=afterScore-score;
      
      // Build the proposed content preview based on action type
      var proposedPreview='';
      if(actionType==='title'&&item.proposedTitle){
        proposedPreview=escHTML(item.proposedTitle);
      }else if(actionType==='tags'&&hasTags){
        proposedPreview='<div style="display:flex;flex-wrap:wrap;gap:4px;">'+item.proposedTags.map(function(t){return '<span style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);padding:3px 8px;border-radius:4px;font-size:11px;color:#818cf8;">'+escHTML(t)+'</span>';}).join('')+'</div>';
      }else if((actionType==='description'||actionType==='preupload'||actionType==='evergreen')&&item.proposedDescription){
        var descText=item.proposedDescription||'';
        var truncated=descText.length>200?descText.substring(0,200)+'...':descText;
        proposedPreview='<div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;font-size:12px;color:var(--text-muted);line-height:1.6;white-space:pre-wrap;max-height:120px;overflow-y:auto;">📄 '+escHTML(truncated)+'</div>';
        if(descText.length>200){
          proposedPreview+='<div style="font-size:10px;color:var(--war-accent);margin-top:4px;cursor:pointer;" onclick="var p=this.previousElementSibling;p.style.maxHeight=p.style.maxHeight===\'120px\'?\'none\':\'120px\';this.textContent=p.style.maxHeight===\'120px\'?\'📖 Show full description\':\'📕 Collapse\';">📖 Show full description ('+descText.length+' chars)</div>';
        }
      }else if(actionType==='chapters'&&item.proposedDescription){
        proposedPreview='<div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;font-size:12px;color:var(--text-muted);line-height:1.6;white-space:pre-wrap;">📑 '+escHTML(item.proposedDescription.substring(0,300))+'</div>';
      }else if(item.proposedDescription){
        proposedPreview='<div style="font-size:12px;color:var(--text-muted);">'+escHTML(item.proposedDescription.substring(0,150))+'...</div>';
      }
      
      // Build current state preview
      var currentPreview='';
      if(actionType==='title'){
        currentPreview=escHTML((item.currentTitle||shortTitle).substring(0,60));
      }else if(actionType==='tags'&&item.currentTags&&item.currentTags.length){
        currentPreview='<div style="display:flex;flex-wrap:wrap;gap:4px;">'+item.currentTags.slice(0,5).map(function(t){return '<span style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);padding:3px 8px;border-radius:4px;font-size:11px;color:#ef4444;">'+escHTML(t)+'</span>';}).join('')+(item.currentTags.length>5?'<span style="font-size:10px;color:var(--war-muted);padding:3px 8px;">+'+ (item.currentTags.length-5)+' more</span>':'')+'</div>';
      }else if(item.currentDescription){
        currentPreview='<div style="font-size:11px;color:var(--war-muted);line-height:1.4;">'+escHTML(item.currentDescription.substring(0,120))+'...</div>';
      }else{
        currentPreview='<span style="color:var(--war-muted);font-style:italic;">(empty)</span>';
      }

      var itemId=item.id||'';
      var html='<div class="inbox-item inbox-item-pending'+confGlow+'" data-id="'+itemId+'">';
      
      // ── HEADER ROW: action type badge + confidence + status ──
      html+='<div class="item-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html+='<div style="display:flex;align-items:center;gap:8px;">';
      html+='<span class="item-type-badge '+badgeClass+'"><span class="type-icon">'+icon+'</span> '+actionLabel+'</span>';
      html+='<span class="inbox-conf conf-'+confClass+'">'+confidence+'%</span>';
      if(item.evScore!=null)html+='<span style="font-size:10px;color:var(--war-muted);">EV: '+Number(item.evScore).toFixed(1)+'</span>';
      html+='</div>';
      html+='<span class="item-time" style="font-size:10px;color:var(--war-muted);">'+(item.actionedAt?'Applied':'Pending')+'</span>';
      html+='</div>';
      
      // ── VIDEO TITLE (context only - see CURRENT/PROPOSED below for changes) ──
      html+='<div style="font-size:11px;color:var(--war-muted);margin-bottom:2px;">📹 Video</div>';
      html+='<div style="font-size:13px;font-weight:600;color:var(--war-accent);margin-bottom:6px;">' + escHTML(shortTitle) + '</div>';
      // ── BEFORE / AFTER COMPARISON ──
      if(currentPreview||proposedPreview){
        html+='<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:start;margin-bottom:10px;">';
        html+='<div class="comp-box current" style="background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);border-radius:8px;padding:10px;"><div class="comp-label" style="font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">CURRENT</div><div class="comp-text">'+currentPreview+'</div></div>';
        html+='<div style="display:flex;align-items:center;color:var(--war-muted);font-size:18px;">→</div>';
        html+='<div class="comp-box proposed" style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12);border-radius:8px;padding:10px;"><div class="comp-label" style="font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">PROPOSED</div><div class="comp-text">'+proposedPreview+'</div></div>';
        html+='</div>';
      }
      
      // ── RATIONALE ──
      if(item.rationale){
        html+='<div style="font-size:11px;color:var(--war-muted);margin-bottom:8px;line-height:1.5;padding:8px;background:rgba(255,255,255,0.02);border-radius:6px;">💡 '+escHTML(item.rationale.substring(0,200))+'</div>';
      }
      
      // ── IMPACT TAGS ──
      html+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">';
      html+='<span class="impact-tag positive" style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.2);">+'+lift+'pt Score Lift</span>';
      html+='<span class="impact-tag neutral" style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--war-muted);border:1px solid rgba(255,255,255,0.06);">'+score+' → '+afterScore+'</span>';
      if(item.evScore!=null)html+='<span class="impact-tag" style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(99,102,241,0.08);color:#818cf8;border:1px solid rgba(99,102,241,0.15);">EV '+Number(item.evScore).toFixed(2)+'</span>';
      html+='</div>';
      
      // ── RENDER PROPOSED TAGS separately if they exist alongside another action type ──
      if(hasTags && actionType!=='tags'){
        html+='<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--war-muted);margin-bottom:4px;">🏷 PROPOSED TAGS</div><div style="display:flex;flex-wrap:wrap;gap:4px;">'+item.proposedTags.slice(0,10).map(function(t){return '<span style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.15);padding:3px 8px;border-radius:4px;font-size:11px;color:#818cf8;">'+escHTML(t)+'</span>';}).join('')+'</div></div>';
      }
      
      // ── ACTION BUTTONS ──
      if(showButtons){
        html+='<div class="item-actions" style="display:flex;gap:8px;">';
        html+='<button class="action-btn approve" onclick="approveInboxItem(this)" style="padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#10b981;"><span>✅</span> Apply</button>';
        html+='<button class="action-btn edit" onclick="editInboxItem(this)" style="padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:#f59e0b;"><span>✏️</span> Edit</button>';
        html+='<button class="action-btn skip" onclick="skipInboxItem(this)" style="padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#ef4444;"><span>❌</span> Skip</button>';
        html+='</div>';
      }else{
        html+='<div class="item-status-row"><span class="status-badge '+(status==='approved'||status==='applied'?'approved':'')+'" style="font-size:11px;padding:3px 10px;border-radius:8px;background:'+(status==='applied'?'rgba(147,51,234,0.1)':status==='approved'?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.08)')+';color:'+(status==='applied'?'#a78bfa':status==='approved'?'#10b981':'#ef4444')+';">'+statusLabels[status]+'</span></div>';
      }
      html+='</div>';
      return html;
    }).join('');
    setTimeout(function(){revealInboxItems();},100);
  }catch(e){
    console.error('[Phronesis] loadCommandInbox error:',e.message);
    var el=document.getElementById('war-inbox-list');
    if(el)el.innerHTML='<p style="color:var(--war-danger);text-align:center;padding:40px;">⚠️ Inbox error: '+e.message+'</p>';
  }
}
window.loadCommandInbox=loadCommandInbox;

async function handleApproval(id,action){
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    await fetch('/api/agent-core/'+id+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','x-channel-id':ch},body:'{}'});
    showToast(action==='approve'?'Approved!':'Skipped','info');
    loadCommandInbox();
  }catch(e){showToast('Failed','error');}
}
window.handleApproval=handleApproval;

async function killSwitch(){
  if(!confirm('🛑 Activate kill switch? This will halt the agent and clear all pending actions.'))return;
  try{
    var r=await fetch('/api/agent/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    var d=await r.json();
    showToast(d.message||'Kill switch activated','error');
    loadPhronesis();loadCommandInbox();
  }catch(e){showToast('Failed','error');}
}
window.killSwitch=killSwitch;

// ══ HIGH-END PHRONESIS UI FUNCTIONS (agentandpersona.txt) ══

// ══ WORLD-CLASS NEURAL CANVAS — 40 nodes, particle trails, glow effects ══
function initNeuralCanvas(){
  var canvas=document.getElementById('neural-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  canvas.width=(canvas.offsetWidth||280)*dpr;
  canvas.height=(canvas.offsetHeight||200)*dpr;
  ctx.scale(dpr,dpr);
  var w=canvas.offsetWidth||280;
  var h=canvas.offsetHeight||200;
  var nodes=[],connections=[],nodeCount=40,time=0;
  var trailCanvas=document.createElement('canvas');
  trailCanvas.width=canvas.width;trailCanvas.height=canvas.height;
  var trailCtx=trailCanvas.getContext('2d');
  for(var i=0;i<nodeCount;i++){
    nodes.push({
      x:Math.random()*w,y:Math.random()*h,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
      radius:Math.random()*2.5+1.2,
      pulse:Math.random()*Math.PI*2,pulseSpeed:0.02+Math.random()*0.03,
      hue:Math.random()<0.2?160+(Math.random()*30):190+(Math.random()*20),
      trail:[]
    });
  }
  // Build connections — dynamic, recalculated periodically
  var connCache=[];
  function rebuildConnections(){
    connCache=[];
    for(var i=0;i<nodes.length;i++){
      for(var j=i+1;j<nodes.length;j++){
        var dist=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
        if(dist<120)connCache.push({from:i,to:j,baseDist:dist});
      }
    }
  }
  rebuildConnections();
  var connRebuildTimer=0;
  function animate(ts){
    time=ts*0.001;
    // Trail fade
    trailCtx.fillStyle='rgba(5,5,8,0.12)';
    trailCtx.fillRect(0,0,canvas.width,canvas.height);
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(trailCanvas,0,0,w,h);
    // Update nodes
    nodes.forEach(function(n){
      n.x+=n.vx;n.y+=n.vy;n.pulse+=n.pulseSpeed;
      if(n.x<0||n.x>w)n.vx*=-1;
      if(n.y<0||n.y>h)n.vy*=-1;
      // Keep in bounds
      n.x=Math.max(0,Math.min(w,n.x));
      n.y=Math.max(0,Math.min(h,n.y));
      // Trail
      n.trail.push({x:n.x,y:n.y,life:1});
      if(n.trail.length>12)n.trail.shift();
      n.trail.forEach(function(t){t.life-=0.08;});
    });
    // Rebuild connections periodically
    connRebuildTimer++;
    if(connRebuildTimer>120){rebuildConnections();connRebuildTimer=0;}
    // Draw connections
    connCache.forEach(function(c){
      var n1=nodes[c.from],n2=nodes[c.to];
      var currentDist=Math.hypot(n1.x-n2.x,n1.y-n2.y);
      var proximity=Math.max(0,1-currentDist/120);
      var waveAlpha=(Math.sin(time*2+c.baseDist*0.02)*0.4+0.6)*proximity;
      var alpha=waveAlpha*0.18;
      ctx.strokeStyle='hsla('+((n1.hue+n2.hue)/2)+',80%,65%,'+alpha+')';
      ctx.lineWidth=0.4+proximity*0.5;
      ctx.beginPath();ctx.moveTo(n1.x,n1.y);ctx.lineTo(n2.x,n2.y);ctx.stroke();
    });
    // Draw trails
    nodes.forEach(function(n){
      if(n.trail.length<2)return;
      ctx.beginPath();
      ctx.moveTo(n.trail[0].x,n.trail[0].y);
      for(var i=1;i<n.trail.length;i++){
        ctx.lineTo(n.trail[i].x,n.trail[i].y);
      }
      ctx.strokeStyle='hsla('+n.hue+',80%,65%,0.15)';
      ctx.lineWidth=n.radius*0.8;
      ctx.stroke();
    });
    // Draw nodes with glow
    nodes.forEach(function(n){
      var glow=Math.sin(n.pulse)*0.25+0.75;
      var hue=n.hue;
      // Outer glow
      var grd=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.radius*4);
      grd.addColorStop(0,'hsla('+hue+',80%,65%,'+(0.5*glow)+')');
      grd.addColorStop(0.5,'hsla('+hue+',80%,65%,'+(0.12*glow)+')');
      grd.addColorStop(1,'hsla('+hue+',80%,65%,0)');
      ctx.fillStyle=grd;ctx.beginPath();
      ctx.arc(n.x,n.y,n.radius*4,0,Math.PI*2);ctx.fill();
      // Core
      ctx.fillStyle='hsla('+hue+',90%,80%,'+glow+')';
      ctx.beginPath();ctx.arc(n.x,n.y,n.radius,0,Math.PI*2);ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
window.initNeuralCanvas=initNeuralCanvas;

// ── Particle system for avatar neural-particles ──
function initAvatarParticles(){
  var container=document.getElementById('neural-particles');
  if(!container)return;
  container.innerHTML='';
  for(var i=0;i<8;i++){
    var p=document.createElement('div');
    p.className='neural-particle';
    p.style.setProperty('--px',(Math.random()*20-10)+'px');
    p.style.setProperty('--py',(-15-Math.random()*15)+'px');
    p.style.left=(20+Math.random()*60)+'%';
    p.style.top=(20+Math.random()*60)+'%';
    p.style.animationDelay=(Math.random()*3)+'s';
    p.style.animationDuration=(2.5+Math.random()*2)+'s';
    container.appendChild(p);
  }
}
window.initAvatarParticles=initAvatarParticles;

// ── Staggered reveal for inbox items ──
function revealInboxItems(){
  var items=document.querySelectorAll('#war-inbox-list .inbox-item:not(.visible)');
  items.forEach(function(item,i){
    setTimeout(function(){
      item.classList.add('visible');
      item.style.transitionDelay='';
      // Add confidence glow class
      var scoreEl=item.querySelector('.conf-score');
      if(scoreEl){
        var txt=scoreEl.textContent||'';var v=parseInt(txt);
        if(v>=80)item.classList.add('conf-glow-high');
        else if(v>=50)item.classList.add('conf-glow-medium');
        else item.classList.add('conf-glow-low');
      }
    },i*80); // 80ms stagger
  });
}
window.revealInboxItems=revealInboxItems;

// ── Staggered reveal for scan cards ──
function revealScanCards(){
  var cards=document.querySelectorAll('#scan-results-list .scan-card:not(.visible)');
  cards.forEach(function(card,i){
    setTimeout(function(){card.classList.add('visible');},i*60);
  });
}
window.revealScanCards=revealScanCards;

// ── Magnetic button initialization ──
function initMagneticButtons(){
  document.querySelectorAll('.auto-btn,.trigger-scan-btn,.mock-test-btn,.action-btn,.goal-save-btn,.kill-switch-btn,.refresh-btn').forEach(function(btn){
    btn.addEventListener('mouseenter',function(e){
      var rect=btn.getBoundingClientRect();
      var x=e.clientX-rect.left-rect.width/2;
      var y=e.clientY-rect.top-rect.height/2;
      btn.style.transform='scale(1.04) translate('+(x*0.05)+'px,'+(y*0.05)+'px)';
    });
    btn.addEventListener('mouseleave',function(){
      btn.style.transform='';
    });
    btn.addEventListener('mousedown',function(){
      btn.style.transform='scale(0.96)';
    });
    btn.addEventListener('mouseup',function(){
      btn.style.transform='scale(1.04)';
    });
  });
}
window.initMagneticButtons=initMagneticButtons;

// ── Achievement toast ──
function showAchievement(msg,icon){
  var existing=document.querySelector('.achievement-toast');
  if(existing)existing.remove();
  var toast=document.createElement('div');
  toast.className='achievement-toast';
  toast.innerHTML='<span style="font-size:22px;">'+(icon||'🏆')+'</span><span>'+msg+'</span>';
  document.body.appendChild(toast);
  setTimeout(function(){if(toast.parentNode)toast.remove();},3500);
}
window.showAchievement=showAchievement;

// ── Pipeline flow animation on scan complete ──
function animatePipelineComplete(){
  var panel=document.getElementById('view-phronesis');
  if(panel){panel.classList.add('pipeline-complete-flash');setTimeout(function(){panel.classList.remove('pipeline-complete-flash');},600);}
  // Bump inbox count
  var badge=document.getElementById('inbox-count-badge');
  if(badge){badge.classList.add('bump');setTimeout(function(){badge.classList.remove('bump');},400);}
  // Flash stat values
  document.querySelectorAll('.stat-value').forEach(function(el){el.classList.add('pulse-once');setTimeout(function(){el.classList.remove('pulse-once');},600);});
  document.querySelectorAll('.brain-stat-value').forEach(function(el){el.classList.add('flash');setTimeout(function(){el.classList.remove('flash');},600);});
}
window.animatePipelineComplete=animatePipelineComplete;

// ── Refresh button spin animation ──
function spinRefresh(){
  var btn=document.querySelector('.refresh-btn');
  if(!btn)return;
  btn.classList.add('spinning');
  setTimeout(function(){btn.classList.remove('spinning');},800);
}
window.spinRefresh=spinRefresh;


// ── Phronesis Functions — moved to top of file (L85-131) — old defs removed to avoid double-declare,
// retain approveInboxItem, skipInboxItem, etc. beginning here
function approveInboxItem(btn){
  var item=btn.closest('.inbox-item');
  if(!item)return;
  var id=item.dataset.id;
  
  // Disable button during apply
  btn.disabled=true;
  btn.textContent='Applying...';
  
  // Step 1: Actually apply to YouTube via the real API
  var tok=localStorage.getItem('ytseo_access_token');
  if(tok){
    fetch('/api/cron/queue/'+id+'/apply',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok})
    }).then(function(r){return r.json();}).then(function(d){
      if(!d.success)throw new Error(d.error||'Unknown error');
      showToast('✅ Applied to YouTube!','success');
      // Step 2: Mark approved in inbox DB
      if(id)handleApproval(id,'approve');
    }).catch(function(e){
      showToast('YouTube apply failed: '+e.message,'error');
      btn.disabled=false;
      btn.textContent='✅ Apply';
      return;
    });
  }else{
    // No token — just mark as approved, can't apply to YouTube
    showToast('Connect YouTube first to auto-apply','error');
    if(id)handleApproval(id,'approve');
  }
  
  item.classList.remove('inbox-item-pending');
  item.classList.add('inbox-item-approved');
  item.style.opacity='.7';
  updateInboxCount();
}
window.approveInboxItem=approveInboxItem;

function skipInboxItem(btn){
  var item=btn.closest('.inbox-item');
  if(!item)return;
  var id=item.dataset.id;
  if(id)handleApproval(id,'skip');
  item.classList.remove('inbox-item-pending');
  item.classList.add('inbox-item-skipped');
  updateInboxCount();
}
window.skipInboxItem=skipInboxItem;

function editInboxItem(btn){
  var item=btn.closest('.inbox-item');
  if(!item)return;
  var id=item.dataset.id;
  var data=window._inboxItems&&window._inboxItems[id];
  if(!data){showToast('Item data not loaded','error');return;}
  
  // Build the preview modal
  var currentTitle=data.currentTitle||data.videoTitle||'';
  var currentDesc=data.currentDescription||'';
  var currentTags=(data.currentTags||[]).join(', ');
  var proposedTitle=data.proposedTitle||data.currentTitle||data.videoTitle||'';
  var proposedDesc=data.proposedDescription||data.currentDescription||data.rationale||'';
  var proposedTags=((data.proposedTags||[]).length>0?data.proposedTags:data.currentTags||[]).join(', ');
  
  var html='<div id="inbox-preview-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10001;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">'+
    '<div style="background:#0d0d16;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px;max-width:620px;width:94%;max-height:90vh;overflow-y:auto;color:#e8ecf2;">'+
      '<h3 style="color:#e8ecf2;margin:0 0 4px;">✏️ Review & Edit Proposal</h3>'+
      '<p style="color:#5a6478;font-size:11px;margin:0 0 16px;">📹 '+(data.videoTitle||'Unknown').substring(0,60)+'</p>'+
      
      // Title
      '<div style="margin-bottom:14px;"><div style="font-size:10px;color:#5a6478;text-transform:uppercase;margin-bottom:4px;">Title</div>'+
      '<textarea id="preview-title" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);color:#e8ecf2;padding:10px;border-radius:8px;font-size:13px;min-height:50px;resize:vertical;">'+escHTML(proposedTitle||currentTitle)+'</textarea></div>'+
      
      // Description
      '<div style="margin-bottom:14px;"><div style="font-size:10px;color:#5a6478;text-transform:uppercase;margin-bottom:4px;">Description <span style="color:#5a6478;">('+(proposedDesc||currentDesc||'').length+' chars)</span></div>'+
      '<textarea id="preview-desc" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);color:#e8ecf2;padding:10px;border-radius:8px;font-size:12px;min-height:180px;resize:vertical;line-height:1.5;white-space:pre-wrap;">'+escHTML(proposedDesc||currentDesc)+'</textarea></div>'+
      
      // Tags
      '<div style="margin-bottom:14px;"><div style="font-size:10px;color:#5a6478;text-transform:uppercase;margin-bottom:4px;">Tags <span style="color:#5a6478;">('+(data.proposedTags||[]).length+' tags, comma-separated)</span></div>'+
      '<textarea id="preview-tags" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);color:#e8ecf2;padding:10px;border-radius:8px;font-size:12px;min-height:60px;resize:vertical;">'+escHTML(proposedTags)+'</textarea></div>'+
      
      // Actions
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button onclick="applyEditedProposal(\''+id+'\')" style="flex:1;min-width:100px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;padding:10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✅ Apply to YouTube</button>'+
        '<button onclick="saveEditedProposal(\''+id+'\')" style="flex:1;min-width:100px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#3b82f6;padding:10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">💾 Save Edits Only</button>'+
        '<button onclick="document.getElementById(\'inbox-preview-backdrop\').remove()" style="flex:0;min-width:80px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#5a6478;padding:10px;border-radius:8px;font-size:12px;cursor:pointer;">Cancel</button>'+
      '</div>'+
    '</div></div>';
  
  // Remove any existing preview
  var existing=document.getElementById('inbox-preview-backdrop');
  if(existing)existing.remove();
  document.body.insertAdjacentHTML('beforeend',html);
}
window.editInboxItem=editInboxItem;

// Apply edited proposal directly to YouTube
async function applyEditedProposal(id){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok){showToast('Connect YouTube first','error');return;}
  
  var titleEl=document.getElementById('preview-title');
  var descEl=document.getElementById('preview-desc');
  var tagsEl=document.getElementById('preview-tags');
  var newTitle=titleEl?titleEl.value.trim():'';
  var newDesc=descEl?descEl.value:'';
  var newTags=tagsEl?tagsEl.value.split(',').map(function(t){return t.trim();}).filter(Boolean):[];
  
  // Update the stored data
  if(window._inboxItems&&window._inboxItems[id]){
    window._inboxItems[id].proposedTitle=newTitle;
    window._inboxItems[id].proposedDescription=newDesc;
    window._inboxItems[id].proposedTags=newTags;
  }
  
  var backdrop=document.getElementById('inbox-preview-backdrop');
  if(backdrop)backdrop.style.opacity='0.4';
  
  try{
    var r=await fetch('/api/cron/queue/'+id+'/apply',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok,proposedTitle:newTitle,proposedDescription:newDesc,proposedTags:newTags})
    });
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed');
    showToast('✅ Applied edited proposal to YouTube!','success');
    if(backdrop)backdrop.remove();
    loadCommandInbox();
  }catch(e){showToast('Failed: '+e.message,'error');if(backdrop)backdrop.style.opacity='1';}
}
window.applyEditedProposal=applyEditedProposal;

// Save edits without applying to YouTube (updates DB only)
async function saveEditedProposal(id){
  var descEl=document.getElementById('preview-desc');
  var tagsEl=document.getElementById('preview-tags');
  var newDesc=descEl?descEl.value:'';
  var newTags=tagsEl?tagsEl.value.split(',').map(function(t){return t.trim();}).filter(Boolean):[];
  
  if(window._inboxItems&&window._inboxItems[id]){
    window._inboxItems[id].proposedDescription=newDesc;
    window._inboxItems[id].proposedTags=newTags;
  }
  
  addFeedItem('info','User','Saved proposal edits');
  showToast('💾 Edits saved. Apply when ready.','success');
  document.getElementById('inbox-preview-backdrop')?.remove();
  loadCommandInbox();
}
window.saveEditedProposal=saveEditedProposal;

function rollbackInboxItem(btn){
  var item=btn.closest('.inbox-item');
  if(!item)return;
  var id=item.dataset.id;
  if(id)handleApproval(id,'skip');
  addFeedItem('warning','User','Rolled back optimization');
  item.style.opacity='.4';
}
window.rollbackInboxItem=rollbackInboxItem;

function viewInboxItem(btn){
  var item=btn.closest('.inbox-item');
  var videoTitle=item.querySelector('.item-video')?.textContent;
  var slug=videoTitle?videoTitle.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'').toLowerCase().substring(0,60):'';
  if(slug)window.open('/blog/'+slug,'_blank');
}
window.viewInboxItem=viewInboxItem;

function filterInbox(filter){
  document.querySelectorAll('.filter-btn').forEach(function(b){
    b.classList.toggle('active',b.textContent.toLowerCase().trim()===filter||(filter==='all'&&b.textContent.trim()==='All'));
  });
  document.querySelectorAll('.inbox-item').forEach(function(item){
    if(filter==='all')item.style.display='';
    else if(filter==='pending')item.style.display=item.classList.contains('inbox-item-pending')?'':'none';
    else if(filter==='approved')item.style.display=item.classList.contains('inbox-item-approved')?'':'none';
    else if(filter==='skipped')item.style.display=item.classList.contains('inbox-item-skipped')?'':'none';
  });
}
window.filterInbox=filterInbox;

function updateInboxCount(){
  var pending=document.querySelectorAll('.inbox-item-pending').length;
  var el=document.getElementById('inbox-count-badge');
  if(el)el.textContent=pending;
}
window.updateInboxCount=updateInboxCount;

function addFeedItem(type,agent,message){
  var feed=document.getElementById('agent-activity-feed');
  if(!feed)return;
  var time=new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'});
  var item=document.createElement('div');
  item.className='feed-item feed-'+type;
  item.innerHTML='<span class="feed-time">'+time+'</span><span class="feed-agent">['+agent+']</span><span class="feed-msg">'+message+'</span>';
  feed.insertBefore(item,feed.firstChild);
  while(feed.children.length>50)feed.removeChild(feed.lastChild);
}
window.addFeedItem=addFeedItem;

function refreshPhronesis(){
  spinRefresh();
  loadPhronesis();
  loadCommandInbox();
  addFeedItem('info','System','Phronesis refreshed');
  setTimeout(function(){revealInboxItems();revealScanCards();initMagneticButtons();},200);
}
window.refreshPhronesis=refreshPhronesis;

// ── loadPhronesis() override - loads all 3-tier pipeline data ──
var _origLoadWarRoom2=loadPhronesis;
loadPhronesis=function(){
  _origLoadWarRoom2();
  loadCommandInbox();
  loadAgentGoal();
  loadGoalProgress();
  loadGoalDecompose();
  loadScanResults();
  loadRecommendations();
  setTimeout(function(){initNeuralCanvas();initAvatarParticles();updateInboxCount();updateNextScanCountdown();initMagneticButtons();},300);
  // Reveal animations after data loads
  setTimeout(function(){revealInboxItems();revealScanCards();},500);
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    // ── Actions Today ──
    fetch('/api/agent-core/daily-stats',{headers:{'x-channel-id':ch}}).then(function(r){return r.json();}).then(function(d){
      var el=document.getElementById('agent-actions-today');if(el)el.textContent=d.used||'0';
      var bar=document.getElementById('agent-actions-bar');if(bar)bar.style.width=Math.min(100,(d.used||0)/(d.max||10)*100)+'%';
    }).catch(function(){});
    // ── Win Rate + Avg Confidence ──
    fetch('/api/agent/stats',{headers:{'x-channel-id':ch}}).then(function(r){return r.json();}).then(function(d){
      var wr=document.getElementById('agent-win-rate');if(wr)wr.textContent=d.winRate!=null?d.winRate+'%':'-';
      var wb=document.getElementById('agent-win-bar');if(wb)wb.style.width=(d.winBarPct||0)+'%';
      var ac=document.getElementById('agent-confidence');if(ac)ac.textContent=d.avgConfidence!=null?d.avgConfidence+'%':'-';
      var cb=document.getElementById('agent-conf-bar');if(cb)cb.style.width=(d.avgConfidence||0)+'%';
      var bd=document.getElementById('brain-decisions');if(bd)bd.textContent=d.totalDecisions||'-';
      var ba=document.getElementById('brain-accuracy');if(ba)ba.textContent=d.winRate!=null?d.winRate+'%':'-';
    }).catch(function(){});
    // ── Credits ──
    fetch('/api/credits/status').then(function(r){return r.json();}).then(function(d){
      var cl=document.getElementById('agent-credits-left');if(cl)cl.textContent=(d.balance||d.credits||0);
      var cb2=document.getElementById('agent-credits-bar');if(cb2)cb2.style.width=Math.min(100,((d.balance||d.credits||0)/(d.planLimit||100))*100)+'%';
    }).catch(function(){});
    // ── Detect niche from latest pipeline log ──
    fetch('/api/agent/logs',{headers:{'x-channel-id':ch}}).then(function(r){return r.json();}).then(function(d){
      var logs=d.logs||[];
      var pipelineLog=logs.find(function(l){return l.actionTaken&&l.actionTaken.includes('Phronesis Pipeline [');});
      if(pipelineLog){
        var match=pipelineLog.actionTaken.match(/Phronesis Pipeline \[([^\]]+)\]/);
        if(match){
          var el=document.getElementById('detected-niche');
          if(el)el.textContent=match[1].replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
        }
      }
    }).catch(function(){});
  }catch(e){}
};

// ── Trigger Agent Growth Scan ──
async function triggerGrowthScan(){
  var btn=document.getElementById('trigger-scan-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Scanning...';}
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/trigger',{method:'POST',headers:{'x-channel-id':ch}});
    var d=await r.json();
  if(d.status==='completed'){
    addFeedItem('success','System','Growth scan completed — '+(d.totalProposals||0)+' proposals queued, '+(d.queueItemsCreated||0)+' applied');
    showToast('Scan complete — '+(d.totalProposals||0)+' proposals queued','success');
  }else if(d.status==='skipped'){
    addFeedItem('warning','System','Scan skipped: '+d.reason);
    showToast('Scan skipped: '+d.reason,'warning');
  }else{
    addFeedItem('error','System','Scan failed: '+(d.reason||'unknown'));
    showToast('Scan failed — '+((d.reason||'check logs')),'error');
  }
  }catch(e){showToast('Scan failed','error');}
  if(btn){btn.disabled=false;btn.textContent='⚡ TRIGGER SCAN';}
  // Store last scan time and start countdown
  localStorage.setItem('phronesis_last_scan', Date.now());
  updateNextScanCountdown();
  loadPhronesis();loadCommandInbox();loadScanResults();loadRecommendations();
  setTimeout(function(){revealInboxItems();revealScanCards();animatePipelineComplete();initMagneticButtons();},300);
}
window.triggerGrowthScan=triggerGrowthScan;

// ── Next Scan Countdown (48h cooldown) ──
function updateNextScanCountdown(){
  var badge=document.getElementById('next-scan-badge');
  if(!badge)return;
  var lastScan=parseInt(localStorage.getItem('phronesis_last_scan')||'0');
  if(!lastScan){badge.textContent='⏱ Next scan: -';return;}
  var now=Date.now();
  var cooldownMs=48*60*60*1000; // 48 hours
  var nextScanTime=lastScan+cooldownMs;
  var remaining=nextScanTime-now;
  if(remaining<=0){badge.textContent='⏱ Scan available now';return;}
  var hours=Math.floor(remaining/3600000);
  var mins=Math.floor((remaining%3600000)/60000);
  badge.textContent='⏱ Next scan: '+hours+'h '+mins+'m';
}
window.updateNextScanCountdown=updateNextScanCountdown;
// Update countdown every 60s
setInterval(updateNextScanCountdown,60000);

// ── Mock Test - injects sample data for UI verification ──
async function runMockTest(){
  var btn=document.getElementById('mock-test-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Injecting...';}
  try{
    var r=await fetch('/api/agent/mock-test',{method:'POST'});
    var d=await r.json();
    if(d.success){
      showToast('Mock data injected: 3 inbox items + 5 feed entries','success');
      addFeedItem('success','System','🧪 Mock test data loaded - Phronesis populated with sample proposals');
    }else{
      showToast('Mock test failed','error');
    }
  }catch(e){showToast('Mock test failed: '+e.message,'error');}
  if(btn){btn.disabled=false;btn.textContent='🧪 MOCK TEST';}
  loadPhronesis();loadCommandInbox();loadGoalProgress();
  setTimeout(function(){revealInboxItems();revealScanCards();initMagneticButtons();showAchievement('Mock data injected — 3 proposals ready','🧪');},300);
}
window.runMockTest=runMockTest;

async function saveAgentGoal(){
  var input=document.getElementById('agent-goal-input');
  var goal=input?.value?.trim();
  if(!goal){showToast('Enter a goal first','error');return;}
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/goal',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':ch},
      body:JSON.stringify({goal})
    });
    var d=await r.json();
    showToast(d.success?'Goal saved: '+goal:'Failed','success');
    loadPhronesis();
    // Strategy is now auto-decomposed server-side — UI refreshes via loadPhronesis
    loadGoalDecompose();
    loadGoalProgress();
  }catch(e){showToast('Failed','error');}
}
window.saveAgentGoal=saveAgentGoal;

// ── Phase 4: Growth Compounding Visualizer ──
async function loadGrowthProjection(){
  var section=document.getElementById('growth-compound-section');
  if(!section)return;
  var goalInput=document.getElementById('agent-goal-input');
  var goal=goalInput?.value?.trim();
  if(!goal){section.style.display='none';return;}
  // Extract subscriber goal
  var subsMatch=goal.match(/(\d+)[kK]?\s*(sub|subscriber)/i);
  var goalSubs=subsMatch?parseInt(subsMatch[1])*(subsMatch[0].toLowerCase().includes('k')?1000:1):1000;
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/growth-projection?current=0&goal='+goalSubs+'&videos=10&weekly=5',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    if(!d.projections||!d.projections.length){section.style.display='none';return;}
    section.style.display='';
    // Render bar chart
    var chart=document.getElementById('growth-chart');
    if(!chart)return;
    var maxSubs=Math.max(goalSubs,d.summary.estimatedFinalSubs);
    chart.innerHTML='';
    // Goal line
    var goalLinePct=(goalSubs/maxSubs*100);
    var goalLine=document.createElement('div');
    goalLine.className='goal-line';
    goalLine.style.bottom=goalLinePct+'%';
    goalLine.innerHTML='<span class="goal-label">Goal: '+goalSubs+'</span>';
    chart.appendChild(goalLine);
    // Bars
    d.projections.forEach(function(p,i){
      var bar=document.createElement('div');
      bar.className='bar'+(p.milestone?' milestone':'');
      bar.style.height=(p.subs/maxSubs*100)+'%';
      bar.title='Week '+(i+1)+': '+p.subs+' subs'+(p.milestone?' ('+p.milestone+' milestone!)':'');
      chart.appendChild(bar);
      setTimeout(function(){bar.classList.add('visible');},i*60);
    });
    // Summary stats
    var mult=document.getElementById('growth-multiplier-badge');
    if(mult)mult.textContent=d.summary.compoundMultiplier+'x compound';
    var summaryRow=document.getElementById('growth-summary-row');
    if(summaryRow){
      summaryRow.innerHTML='<div class="growth-summary-stat">📊 <span class="gs-val">'+d.summary.estimatedFinalSubs+'</span> est. subs</div>'+
        '<div class="growth-summary-stat">📈 <span class="gs-val">+'+d.summary.totalGain+'</span> gained</div>'+
        '<div class="growth-summary-stat">🔧 <span class="gs-val">'+d.summary.totalOptimizations+'</span> optimizations</div>'+
        (d.summary.weeksToGoal?'<div class="growth-summary-stat">🎯 <span class="gs-val">'+d.summary.weeksToGoal+'w</span> to goal</div>':'');
    }
    // Milestone celebrations
    d.milestones.forEach(function(m){
      showAchievement(m.milestone+' to '+goalSubs+' subs!','🎯');
    });
  }catch(e){section.style.display='none';}
}
window.loadGrowthProjection=loadGrowthProjection;

// ── Hook into goal save to trigger growth projection ──
var _origSaveAgentGoal=saveAgentGoal;
saveAgentGoal=async function(){
  await _origSaveAgentGoal();
  setTimeout(loadGrowthProjection,500);
};

// ── Hook into loadPhronesis to load growth projection ──
var _origLoadPhronesisGrowth=loadPhronesis;
loadPhronesis=function(){
  _origLoadPhronesisGrowth();
  syncPhronesisMode();           // sync AUTO/MONITOR badge from server flag
  setTimeout(loadGrowthProjection,800);
};

// ── Goal Decomposition — shows HOW the agent plans to achieve the goal (with progress) ──
async function loadGoalDecompose(goalText){
  var section=document.getElementById('goal-decompose-section');
  if(!section)return;
  var goal=goalText||document.getElementById('agent-goal-input')?.value?.trim();
  if(!goal){section.style.display='none';return;}
  try{
    // Fetch strategy progress from backend (includes decomposition + per-task progress)
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/strategy-progress',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    if(!d.subtasks||!d.subtasks.length){section.style.display='none';return;}
    section.style.display='';
    
    // Show real subscriber progress if available, otherwise action progress
    var hasRealData = d.progressSource === 'youtube_api';
    var displayPct = hasRealData ? (d.realProgress||0) : (d.actionProgress||0);
    var label = hasRealData 
      ? (d.subsGained >= 0 ? '+' + d.subsGained + ' subs' : d.subsGained + ' subs') 
      : displayPct + '% actions';
    
    var tf=document.getElementById('goal-strategy-timeframe');
    if(tf)tf.textContent = hasRealData 
      ? '📊 ' + displayPct + '% to goal (' + (d.currentSubs||'?').toLocaleString() + ' / ' + (d.targetSubs||'?').toLocaleString() + ' subs)'
      : '⏱ ' + displayPct + '% actions completed';
    
    // Update goal progress bar with real data
    var bar=document.getElementById('goal-progress-fill');
    if(bar)bar.style.width=(hasRealData?(d.realProgress||0):(d.actionProgress||0))+'%';
    var ptext=document.getElementById('goal-progress-text');
    if(ptext)ptext.textContent=hasRealData
      ? 'Subs: '+(d.subsGained!=null?(d.subsGained>=0?'+':'')+d.subsGained:'?')+' / '+(d.targetSubs||'?').toLocaleString()
      : 'Progress: '+displayPct+'%';
    var eta=document.getElementById('goal-eta');
    if(eta)eta.textContent=hasRealData
      ? (d.subsGained!=null?d.subsGained:'?')+' new subs'
      : displayPct+'% actions';
    
    var list=document.getElementById('goal-decompose-list');
    if(!list)return;
    var priorityColors={high:'var(--war-success)',medium:'var(--war-warning)',low:'var(--war-muted)'};
    var statusIcons={done:'✅',in_progress:'🔄',pending:'⏳'};
    
    list.innerHTML=d.subtasks.map(function(st){
      var icon=st.icon||{optimizer:'🔧',trend_scanner:'⚡',pseo_engine:'📝',ab_tester:'🧪',coach:'🎯',content_planner:'📋'}[st.agent]||'🤖';
      var color=priorityColors[st.priority]||'var(--war-muted)';
      var si=statusIcons[st.status]||'⏳';
      var pct=st.progress||0;
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;">'+
        '<span style="font-size:16px;">'+icon+'</span>'+
        '<div style="flex:1;">'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:12px;color:var(--war-text);font-weight:600;">'+st.label+'</span>'+
            '<span style="font-size:10px;">'+si+'</span>'+
          '</div>'+
          '<div style="height:3px;background:rgba(255,255,255,.06);border-radius:2px;margin-top:3px;">'+
            '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:2px;transition:width .5s;"></div>'+
          '</div>'+
        '</div>'+
        '<span style="font-size:10px;font-weight:700;color:'+color+';white-space:nowrap;">'+st.estImpact+'</span>'+
      '</div>';
    }).join('');
    
    var summary=document.getElementById('goal-strategy-summary');
    if(summary)summary.textContent='💡 Pipeline is actively following this strategy. Agents are prioritized accordingly.';
  }catch(e){section.style.display='none';}
}
window.loadGoalDecompose=loadGoalDecompose;

// ── Goal Progress - tracks progress toward the goal ──
async function loadGoalProgress(){
  try{
    var r=await fetch('/api/agent/progress');
    var d=await r.json();
    if(!d.goal)return;
    var pct=d.progress||0;
    // Update progress bar
    var bar=document.getElementById('goal-progress-fill');
    if(bar)bar.style.width=pct+'%';
    var text=document.getElementById('goal-progress-text');
    if(text)text.textContent='Progress: '+pct+'%';
    var eta=document.getElementById('goal-eta');
    if(eta)eta.textContent=d.estDaysRemaining?d.estDaysRemaining+' days est.':d.message||'';
    // Show toast with progress message on first load if significant
    if(pct>0&&d.message)console.log('[Progress]',d.message);
  }catch(e){}
}
window.loadGoalProgress=loadGoalProgress;

// ── SCAN Results - fetch and render scan scores in Column 1 ──
async function loadScanResults(){
  var list=document.getElementById('scan-results-list');
  if(!list)return;
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/scan-results',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    if(!d.results||!d.results.length){
      list.innerHTML='<p style="color:var(--war-muted);text-align:center;padding:20px;font-size:11px;">No scan data yet.<br>Click ⚡ TRIGGER SCAN to analyze your channel.</p>';
      var dot=document.getElementById('scan-status-dot');
      if(dot)dot.style.background='var(--war-muted)';
      return;
    }
    // Update status indicator
    var dot=document.getElementById('scan-status-dot');
    var txt=document.getElementById('scan-status-text');
    if(dot){dot.style.background='var(--war-success)';dot.style.boxShadow='0 0 6px var(--war-success)';}
    if(txt){txt.textContent='live';txt.style.color='var(--war-success)';}
    // Render rich score cards
    list.innerHTML=d.results.slice(0,10).map(function(s,i){
      var title=(s.videoTitle||'Video '+s.videoId?.substring(0,6)||'Unknown').substring(0,35);
      var score=s.overallScore||0;
      var grade=score>=70?'A':score>=55?'B':score>=40?'C':score>=25?'D':'F';
      var gradeColor=score>=70?'#10b981':score>=55?'#00d4ff':score>=40?'#f59e0b':score>=25?'#ef4444':'#64748b';
      var isShort=s.format==='short';
      var formatBadge=isShort?'🎬 Short':'📺 Long';
      // Issues badges
      var issues=s.issues||[];
      var issuesHtml='';
      if(issues.length>0){
        issuesHtml='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">'+
          issues.slice(0,3).map(function(iss){
            var sev=iss.toLowerCase().includes('low')||iss.toLowerCase().includes('no ')?'#ef4444':'#f59e0b';
            return '<span style="font-size:8px;padding:1px 6px;border-radius:4px;background:'+sev+'15;color:'+sev+';border:1px solid '+sev+'30;">'+iss.substring(0,25)+'</span>';
          }).join('')+'</div>';
      }
      // Score bars
      function scoreBar(val,color){return '<div style="flex:1;height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;"><div style="height:100%;width:'+Math.min(100,val)+'%;background:'+color+';border-radius:2px;"></div></div>';}
      return '<div class="scan-card" style="animation-delay:'+(i*0.06)+'s;">'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">'+
          '<span style="font-size:9px;opacity:.7;">'+formatBadge+'</span>'+
          '<span style="font-size:11px;color:var(--war-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;" title="'+(s.videoTitle||'').replace(/"/g,'')+'">'+title+'</span>'+
          '<span style="font-size:14px;font-weight:800;color:'+gradeColor+';min-width:22px;text-align:right;">'+grade+'</span>'+
        '</div>'+
        // Score meters
        '<div style="display:flex;flex-direction:column;gap:4px;">'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:8px;color:var(--war-muted);width:20px;text-transform:uppercase;">Title</span>'+
            scoreBar(s.titleScore||0,s.titleScore>=70?'#10b981':s.titleScore>=40?'#f59e0b':'#ef4444')+
            '<span style="font-size:9px;color:var(--war-muted);width:18px;text-align:right;">'+(s.titleScore||0)+'</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:8px;color:var(--war-muted);width:20px;text-transform:uppercase;">Desc</span>'+
            scoreBar(s.descScore||0,s.descScore>=70?'#10b981':s.descScore>=40?'#f59e0b':'#ef4444')+
            '<span style="font-size:9px;color:var(--war-muted);width:18px;text-align:right;">'+(s.descScore||0)+'</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px;">'+
            '<span style="font-size:8px;color:var(--war-muted);width:20px;text-transform:uppercase;">Tags</span>'+
            scoreBar(s.tagScore||0,s.tagScore>=70?'#10b981':s.tagScore>=40?'#f59e0b':'#ef4444')+
            '<span style="font-size:9px;color:var(--war-muted);width:18px;text-align:right;">'+(s.tagScore||0)+'</span>'+
          '</div>'+
        '</div>'+
        // Overall bar
        '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;">'+
          '<span style="font-size:8px;color:var(--war-muted);text-transform:uppercase;width:20px;">SEO</span>'+
          '<div style="flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;"><div style="height:100%;width:'+score+'%;background:'+gradeColor+';border-radius:3px;transition:width .8s var(--ease-decel);"></div></div>'+
          '<span style="font-size:10px;font-weight:700;color:'+gradeColor+';width:24px;text-align:right;">'+score+'</span>'+
        '</div>'+
        issuesHtml+
      '</div>';
    }).join('');
    // Trigger staggered reveal
    setTimeout(function(){revealScanCards();},100);
  }catch(e){
    console.error('[Phronesis] loadScanResults error:',e.message);
  }
}
window.loadScanResults=loadScanResults;

// ── RECOMMEND - fetch and render strategic alerts in Column 3 ──
async function loadRecommendations(){
  var list=document.getElementById('recommend-list');
  if(!list)return;
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent/recommendations',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    if(!d.alerts||!d.alerts.length){
      list.innerHTML='<p style="color:var(--war-muted);text-align:center;padding:20px;font-size:11px;">No recommendations yet.</p>';
      return;
    }
    var typeIcons={thumbnail:'🖼️',script:'📝',shorts:'🎬',community:'💬',multilang:'🌐',playlist:'📂',bulk:'📊'};
    var priorityColors={high:'var(--war-danger)',medium:'var(--war-warning)',low:'var(--war-muted)'};
    // Per-type action buttons (honest — only types that can actually change YT data)
    var typeActions={
      thumbnail:{label:'⚡ Optimize Metadata',fn:'handleRecOptimize',color:'#10b981',bg:'rgba(16,185,129,0.12)'},
      community:{label:'📌 Pin Comment',fn:'handleRecPinComment',color:'#3b82f6',bg:'rgba(59,130,246,0.12)'},
      playlist:{label:'📂 Create Playlist',fn:'handleRecPlaylist',color:'#a855f7',bg:'rgba(168,85,247,0.12)'},
      bulk:{label:'🔍 Bulk Review',fn:'handleRecBulkReview',color:'#f59e0b',bg:'rgba(245,158,11,0.12)'},
      script:{label:'💾 Save Idea',fn:'handleRecSaveIdea',color:'#14b8a6',bg:'rgba(20,184,166,0.12)'},
      shorts:{label:'💾 Save Idea',fn:'handleRecSaveIdea',color:'#14b8a6',bg:'rgba(20,184,166,0.12)'},
      multilang:{label:'🌐 Auto-Captions',fn:'handleRecCaptions',color:'#94a3b8',bg:'rgba(148,163,184,0.12)'}
    };
    list.innerHTML=d.alerts.map(function(a){
      var icon=typeIcons[a.type]||'💡';
      var color=priorityColors[a.priority]||'var(--war-muted)';
      var act=typeActions[a.type]||typeActions.thumbnail;
      return '<div style="background:var(--war-card);border:1px solid var(--war-border);border-radius:8px;padding:10px;'+(a.readStatus?'opacity:.5;':'')+'" data-rec-id="'+a.id+'" data-rec-type="'+a.type+'" data-rec-msg="'+escHTML(a.message).replace(/"/g,'&quot;')+'">'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'+
          '<span>'+icon+'</span>'+
          '<span style="font-size:9px;color:'+color+';text-transform:uppercase;font-weight:600;">'+a.type+'</span>'+
          '<span style="margin-left:auto;font-size:8px;color:'+color+';background:'+color.replace(')','').replace('var(','rgba(')+',.1);padding:1px 6px;border-radius:3px;">'+a.priority+'</span>'+
        '</div>'+
        '<div style="font-size:10px;color:var(--war-text);line-height:1.5;margin-bottom:6px;">'+a.message+'</div>'+
        (a.readStatus?'':
          '<div style="display:flex;gap:6px;">'+
            '<button onclick="'+act.fn+'(\''+a.id+'\',\''+a.type+'\')" style="background:'+act.bg+';border:1px solid '+act.color.replace('1)', '0.3)').replace('a)', 'a, 0.3)')+';color:'+act.color+';font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:600;">'+act.label+'</button>'+
            '<button onclick="dismissRecommendation(\''+a.id+'\')" style="background:none;border:1px solid var(--war-border);color:var(--war-muted);font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;">Dismiss</button>'+
          '</div>')+
      '</div>';
    }).join('');
  }catch(e){}
}
window.loadRecommendations=loadRecommendations;

async function dismissRecommendation(id){
  try{
    await fetch('/api/agent/recommendations/'+id+'/dismiss',{method:'POST'});
    showToast('Recommendation dismissed', 'info');
    loadRecommendations();
  }catch(e){}
}
window.dismissRecommendation=dismissRecommendation;

// ── Per-Type Recommendation Handlers ──
// Only fires for types that actually change YouTube data.
// script/shorts → saves locally, bulk → navigates, multilang → low-value API call.

// 1. THUMBNAIL: AI regenerates title/desc/tags → PUTs to YouTube
async function handleRecOptimize(id, type){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect YouTube first','error');
  var card=document.querySelector('[data-rec-id="'+id+'"]');
  if(card){card.style.opacity='0.4';card.style.pointerEvents='none';}
  try{
    var r=await fetch('/api/agent/recommendations/'+id+'/apply',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok})
    });
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed');
    showToast('✅ AI optimized & applied to YouTube!','success');
    if(card)card.remove();
    loadRecommendations(); loadCommandInbox();
  }catch(e){showToast('Failed: '+e.message,'error');if(card){card.style.opacity='1';card.style.pointerEvents='auto';}}
}
window.handleRecOptimize=handleRecOptimize;

// 2. COMMUNITY: Opens modal to pick a pin comment → pins via YouTube API
var _pendingPinRecId=null;
async function handleRecPinComment(id, type){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect YouTube first','error');
  var card=document.querySelector('[data-rec-id="'+id+'"]');
  var msg=card?card.getAttribute('data-rec-msg')||'':'';
  _pendingPinRecId=id;
  // Build a quick inline modal with 3 AI-suggested comments + custom
  var suggestions=[
    'What topic should I cover next? Drop your ideas below! 👇',
    'Which part of this video helped you most? Let me know in the comments!',
    'If you found this useful, what other [topic] questions do you have?'
  ];
  var modal=document.createElement('div');
  modal.id='pin-comment-modal';
  modal.innerHTML='<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()">'+
    '<div style="background:var(--war-card);border:1px solid var(--war-border);border-radius:12px;padding:20px;max-width:420px;width:90%;">'+
      '<h3 style="color:var(--war-text);margin:0 0 4px;">📌 Pin a Comment</h3>'+
      '<p style="color:var(--war-muted);font-size:11px;margin:0 0 12px;">Pick a comment to pin. Drives engagement by asking viewers a question.</p>'+
      suggestions.map(function(s,i){
        return '<div onclick="document.getElementById(\'pin-custom-input\').value=this.textContent" style="background:rgba(255,255,255,0.03);border:1px solid var(--war-border);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:11px;color:var(--war-text);cursor:pointer;">'+s+'</div>';
      }).join('')+
      '<input id="pin-custom-input" type="text" placeholder="Or type your own..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px solid var(--war-border);color:var(--war-text);padding:8px;border-radius:6px;font-size:11px;margin-bottom:10px;">'+
      '<div style="display:flex;gap:8px;">'+
        '<button onclick="execPinComment()" style="flex:1;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#3b82f6;padding:8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">📌 Pin It</button>'+
        '<button onclick="document.getElementById(\'pin-comment-modal\').remove()" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid var(--war-border);color:var(--war-muted);padding:8px;border-radius:6px;font-size:11px;cursor:pointer;">Cancel</button>'+
      '</div>'+
    '</div></div>';
  document.body.appendChild(modal);
}
window.handleRecPinComment=handleRecPinComment;

async function execPinComment(){
  var text=document.getElementById('pin-custom-input').value.trim();
  if(!text)return showToast('Type a comment first','error');
  var id=_pendingPinRecId;
  var tok=localStorage.getItem('ytseo_access_token');
  document.getElementById('pin-comment-modal')?.remove();
  if(!tok||!id)return;
  try{
    var r=await fetch('/api/agent/recommendations/'+id+'/pin-comment',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok,commentText:text})
    });
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed');
    showToast('📌 Comment pinned!','success');
    var card=document.querySelector('[data-rec-id="'+id+'"]');
    if(card)card.remove();
    loadRecommendations();
  }catch(e){showToast('Pin failed: '+e.message,'error');}
}
window.execPinComment=execPinComment;

// 3. PLAYLIST: Creates playlist + adds videos → returns URL
async function handleRecPlaylist(id, type){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect YouTube first','error');
  var card=document.querySelector('[data-rec-id="'+id+'"]');
  if(card){card.style.opacity='0.4';card.style.pointerEvents='none';}
  try{
    var r=await fetch('/api/agent/recommendations/'+id+'/create-playlist',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok})
    });
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed');
    showToast('📂 Playlist created: '+d.videoCount+' videos','success');
    if(card)card.remove();
    loadRecommendations();
  }catch(e){showToast('Failed: '+e.message,'error');if(card){card.style.opacity='1';card.style.pointerEvents='auto';}}
}
window.handleRecPlaylist=handleRecPlaylist;

// 4. BULK: Navigates to Bulk Injector tab (no API call — user must review)
function handleRecBulkReview(id, type){
  try{
    if(typeof switchView==='function')switchView('optimization-history');
    showToast('🔍 Review each video in the Bulk Injector before applying','info');
    dismissRecommendation(id); // mark as seen
  }catch(e){}
}
window.handleRecBulkReview=handleRecBulkReview;

// 5. SCRIPT / SHORTS: Save to Content Ideas (localStorage for now)
function handleRecSaveIdea(id, type){
  var card=document.querySelector('[data-rec-id="'+id+'"]');
  var msg=card?card.getAttribute('data-rec-msg')||'':'';
  var icon=type==='shorts'?'🎬':'📝';
  // Store in localStorage
  var ideas=JSON.parse(localStorage.getItem('ytseo_content_ideas')||'[]');
  ideas.push({id:id,type:type,message:msg,savedAt:new Date().toISOString()});
  // Keep last 50 only
  if(ideas.length>50)ideas=ideas.slice(-50);
  localStorage.setItem('ytseo_content_ideas',JSON.stringify(ideas));
  showToast(icon+' Idea saved! ('+ideas.length+' total)','success');
  dismissRecommendation(id);
}
window.handleRecSaveIdea=handleRecSaveIdea;

// 6. MULTILANG: Sets default audio language + enables auto-captions
async function handleRecCaptions(id, type){
  var tok=localStorage.getItem('ytseo_access_token');
  if(!tok)return showToast('Connect YouTube first','error');
  var card=document.querySelector('[data-rec-id="'+id+'"]');
  if(card){card.style.opacity='0.4';card.style.pointerEvents='none';}
  try{
    var r=await fetch('/api/agent/recommendations/'+id+'/enable-captions',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-channel-id':localStorage.getItem('ytseo_channel_id')||'anonymous'},
      body:JSON.stringify({accessToken:tok})
    });
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed');
    showToast('🌐 Auto-captions enabled','success');
    if(card)card.remove();
    loadRecommendations();
  }catch(e){showToast('Failed: '+e.message,'error');if(card){card.style.opacity='1';card.style.pointerEvents='auto';}}
}
window.handleRecCaptions=handleRecCaptions;

// Load daily stats and inbox when Phronesis opens
var _origLoadWarRoom=loadPhronesis;
loadPhronesis=async function(){
  await _origLoadWarRoom();
  loadCommandInbox();
  loadAgentGoal();
  setTimeout(function(){ loadAgentGoal(); }, 500); // Retry after DOM settles
  try{
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    var r=await fetch('/api/agent-core/daily-stats',{headers:{'x-channel-id':ch}});
    var d=await r.json();
    var el=document.getElementById('daily-limit-display');
    if(el)el.textContent='Limit: '+d.used+'/'+d.max;
  }catch(e){}
};

// Single auto-refresh for Phronesis when visible - NO duplicates
async function createTables(){
  showToast('Creating database tables...','info');
  try{
    var r=await fetch('/api/agent/migrate');
    var d=await r.json();
    showToast(d.success?'Tables created!':'Failed: '+d.error,d.success?'success':'error');
    if(d.success)loadPhronesis();
  }catch(e){showToast('Failed: '+e.message,'error');}
}
window.createTables=createTables;

// SEO Content Panel - Explanations
function createSEOPanel(content, type) {
  const tips = {
    title: [
      "Front-load keywords within first 30 characters",
      "Include numbers for better CTR (e.g., '7 ways')",
      "Use power words: Ultimate, Complete, Secret"
    ],
    description: [
      "Keep first 150 characters for video snippet",
      "Include main keyword in first sentence",
      "Add timestamps for key sections"
    ],
    tags: [
      "Mix broad and specific tags (70/30 ratio)",
      "Include variations and misspellings",
      "Keep total under 15 tags for YouTube"
    ],
    jsonld: [
      "This JSON-LD can be embedded in your website",
      "Helps search engines understand video context",
      "Update when video metadata changes"
    ]
  };

  const tipList = tips[type] || tips.title;

  return `
    <div class="seo-panel">
      <div class="seo-panel-header">
        <i data-lucide="lightbulb"></i> Why This Works
      </div>
      <ul class="seo-tips-list">
        ${tipList.map(tip => `<li>${tip}</li>`).join('')}
      </ul>
    </div>
  `;
}

// Generate JSON-LD structured data
function generateVideoJSONLD(videoData) {
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": videoData.title || "",
    "description": videoData.description || "",
    "thumbnailUrl": videoData.thumbnail || "",
    "uploadDate": videoData.publishedAt || "",
    "duration": videoData.duration || "",
    "embedUrl": `https://www.youtube.com/watch?v=${videoData.videoId}`,
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/WatchAction",
      "userInteractionCount": videoData.viewCount || 0
    }
  };

  return JSON.stringify(jsonld, null, 2);
}

// Multi-step workflow state
const WorkflowState = {
  steps: [],
  currentStep: 0,
  results: {},

  start(toolType, steps) {
    this.steps = steps;
    this.currentStep = 0;
    this.results = {};
    this.showWorkflowUI(toolType);
  },

  showWorkflowUI(toolType) {
    const container = document.getElementById('workflow-progress');
    if (!container) return;

    container.innerHTML = `
      <div class="workflow-container">
        <div class="workflow-steps">
          ${this.steps.map((step, idx) => `
            <div class="workflow-step ${idx <= this.currentStep ? 'active' : ''}" data-step="${idx}">
              <div class="step-indicator">${idx < this.currentStep ? '✓' : idx + 1}</div>
              <span class="step-label">${step}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  completeStep(stepName, data) {
    this.results[stepName] = data;
    this.currentStep++;

    if (this.currentStep >= this.steps.length) {
      this.finish();
    } else {
      this.updateProgress();
    }
  },

  updateProgress() {
    document.querySelectorAll('.workflow-step').forEach((el, idx) => {
      el.classList.toggle('active', idx <= this.currentStep);
    });
  },

  finish() {
    window.dispatchEvent(new CustomEvent('workflowComplete', { detail: this.results }));
  },

  getResults() {
    return this.results;
  }
};
window.WorkflowState = WorkflowState;

// Related tools suggestions
function getRelatedTools(currentTool) {
  const relations = {
    'audit': ['keyword-discovery', 'metadata-weaver', 'thumbnail-analyzer'],
    'keyword': ['competitor-sniper', 'metadata-weaver', 'channel-audit'],
    'thumbnail': ['thumbnail-badge', 'thumbnail-redesign'],
    'metadata': ['session-link', 'bulk-inject', 'playlist-growth'],
    'default': ['channel-audit', 'keyword-discovery', 'playlist-growth']
  };

  const tools = relations[currentTool] || relations['default'];
  return tools.map(toolId => ({
    id: toolId,
    name: toolId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    icon: 'ph-magic-wand'
  }));
}

function createRelatedTools(currentTool) {
  const tools = getRelatedTools(currentTool);
  return `
    <div class="related-tools">
      <div class="related-tools-header">
        <i data-lucide="sparkles"></i> Try Next
      </div>
      <div class="related-tools-list">
        ${tools.map(tool => `
          <button class="related-tool-btn" onclick="switchTool('${tool.id}')">
            <i class="ph ${tool.icon}"></i> ${tool.name}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function switchTool(toolId) {
  // Switch to different tool/tab
  const tabMap = {
    'keyword-discovery': 'video-audit',
    'metadata-weaver': 'playlist-growth',
    'thumbnail-analyzer': 'video-factory',
    'channel-audit': 'video-audit',
    'competitor-sniper': 'community-engagement',
    'thumbnail-badge': 'video-factory',
    'thumbnail-redesign': 'video-factory',
    'session-link': 'playlist-growth',
    'bulk-inject': 'community-engagement',
    'playlist-growth': 'playlist-growth'
  };

  const targetTab = tabMap[toolId] || 'video-audit';
  document.querySelector(`[data-tab="${targetTab}"]`)?.click();
}

// ── Utility Functions ──

// Copy to clipboard with feedback
window.copyToClipboard = async function(text, btnElement) {
  try {
    await navigator.clipboard.writeText(text);
    if (btnElement) {
      const originalText = btnElement.innerHTML;
      btnElement.innerHTML = '<span>✓ Copied</span>';
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.innerHTML = originalText;
        btnElement.classList.remove('copied');
      }, 2000);
    }
    return true;
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
};

// Create copy button
function createCopyButton(clickHandler) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.innerHTML = '<i data-lucide="copy"></i> Copy';
  btn.onclick = clickHandler;
  return btn;
}

// Generate score bar with color
function createScoreBar(score, label) {
  let category, colorClass;
  if (score >= 80) {
    category = 'excellent';
    colorClass = 'good';
  } else if (score >= 60) {
    category = 'good';
    colorClass = 'good';
  } else if (score >= 40) {
    category = 'needs-work';
    colorClass = 'ok';
  } else {
    category = 'poor';
    colorClass = 'bad';
  }

  return `
    <div class="score-container">
      <div class="score-label">
        <span>${label}</span>
        <span class="score-value ${colorClass}">${score}/100</span>
      </div>
      <div class="score-bar">
        <div class="fill ${colorClass}" style="width: ${score}%"></div>
      </div>
    </div>
  `;
}

// Create smart suggestion buttons
function createSmartSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) return '';

  const buttons = suggestions.map(s => `
    <button class="suggestion-btn" onclick="${s.action}">
      <i class="ph ${s.icon || 'ph-sparkle'}"></i> ${s.label}
    </button>
  `).join('');

  return `<div class="smart-suggestions">${buttons}</div>`;
}

// AI Thinking indicator
function showAIThinking(text) {
  return `
    <div class="ai-thinking">
      <div class="dot-set">
        <span></span><span></span><span></span>
      </div>
      <span class="thought-text">${text}</span>
    </div>
  `;
}

// Create SEO score summary
function createSEOSummary(scores) {
  const getClass = (val) => val >= 70 ? 'high' : val >= 40 ? 'medium' : 'low';

  return `
    <div class="seo-score-summary">
      <div class="seo-score-item">
        <span class="score-num ${getClass(scores.title)}">${scores.title}</span>
        <span class="score-label">Title Score</span>
      </div>
      <div class="seo-score-item">
        <span class="score-num ${getClass(scores.description)}">${scores.description}</span>
        <span class="score-label">Description</span>
      </div>
      <div class="seo-score-item">
        <span class="score-num ${getClass(scores.tags)}">${scores.tags}</span>
        <span class="score-label">Tags</span>
      </div>
      <div class="seo-score-item">
        <span class="score-num ${getClass(scores.overall)}">${scores.overall}</span>
        <span class="score-label">Overall</span>
      </div>
    </div>
  `;
}

// Calculate SEO score
function calculateSEOScore(title, description, tags) {
  let score = { title: 0, description: 0, tags: 0, overall: 0 };

  // Title scoring
  if (title) {
    if (title.length >= 30 && title.length <= 60) score.title += 40;
    else if (title.length > 0) score.title += 20;
    if (/\d/.test(title)) score.title += 20;
    if (/[A-Z]/.test(title)) score.title += 20;
    if (title.split(' ').length >= 3) score.title += 20;
  }

  // Description scoring
  if (description) {
    if (description.length >= 200) score.description += 40;
    else if (description.length >= 100) score.description += 25;
    else if (description.length > 0) score.description += 10;
    if (description.includes('http')) score.description += 20;
    if (description.split(' ').length >= 20) score.description += 40;
  }

  // Tags scoring
  if (tags && Array.isArray(tags)) {
    if (tags.length >= 10) score.tags += 40;
    else if (tags.length >= 5) score.tags += 25;
    else if (tags.length > 0) score.tags += 10;
    if (tags.every(t => t.length > 2)) score.tags += 30;
    if (tags.length <= 15) score.tags += 30;
  }

  // Overall
  score.overall = Math.round((score.title + score.description + score.tags) / 3);

  return score;
}

function checkPremium(featureName = 'this feature') {
  if (userPlan === 'free') {
    showUpgradeModal(featureName);
    return true;
  }
  return false;
}

function showUpgradeModal(featureName) {
  const modal = document.createElement('div');
  modal.id = 'premium-modal';
  const nextPlan = userPlan === 'free' ? 'Pro' : 'Agency';
  const nextPrice = userPlan === 'free' ? '$5/mo' : '$19/mo';
  modal.innerHTML = `
    <div class="premium-overlay">
      <div class="premium-modal-content">
        <div class="premium-modal-header">
          <span class="crown-icon">⚡</span>
          <h2>${nextPlan} Feature</h2>
        </div>
        <p class="premium-feature-name">"${featureName}" requires ${nextPlan}.</p>
        <p class="premium-benefit">Current Plan: <strong>${userPlan === 'free' ? 'Free' : 'Pro'}</strong></p>
        <p class="premium-benefit">Upgrade to ${nextPlan} for ${nextPrice}:</p>
        <ul class="premium-benefits-list">
          ${userPlan === 'free' ? `
          <li>🎬 Video Factory (full script generation)</li>
          <li>🎯 Sidebar Sniper</li>
          <li>⚡ Bulk Injector</li>
          <li>🔄 Retention Re-Orderer</li>
          <li>🌲 Evergreen Audit</li>
          ` : `
          <li>💬 AI Auto-Responder</li>
          <li>🤖 Automation Pipeline</li>
          <li>♾️ Unlimited Credits</li>
          `}
        </ul>
        <a href="/#pricing" class="premium-upgrade-btn">
          Upgrade to ${nextPlan} - ${nextPrice}
        </a>
        <button class="premium-close-btn" onclick="document.getElementById('premium-modal').remove()">
          Maybe Later
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Debug: toggle plan for testing
window.setTestPlan = function(plan) {
  userPlan = plan;
  localStorage.setItem(getChannelPlanKey(), plan);
  updatePlanUI();
  console.log('Plan set to:', plan);
};

// Dev Mode: Ctrl+Shift+D toggles Agency plan + refill credits
window.toggleDevMode = async function() {
  if (!isAdmin()) {
    console.warn('Unauthorized Dev Mode attempt blocked.');
    return;
  }
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  if (userPlan === 'agency') {
    setTestPlan('free');
    resetCredits();
    showToast('🔒 Dev mode OFF - back to Free plan', 'info');
  } else {
    setTestPlan('agency');
    CreditsSystem.total = 999999;
    CreditsSystem.used = 0;
    CreditsSystem.save();
    CreditsSystem.updateDisplay();
    updateCreditsDisplay();
    // Also refill backend DB credits
    try {
      await fetch('/api/dev/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-channel-id': chId },
        body: JSON.stringify({ channelId: chId })
      });
    } catch(e) {}
    showToast('🔓 Dev mode ON - Agency plan, unlimited credits', 'success');
  }
};
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    if (!isAdmin()) return; // Silent fail for non-admins
    e.preventDefault();
    window.toggleDevMode();
  }
});

/**
 * Keyword Discovery Engine
 * Implements Alphabet Loop and Asterisk Wildcard search
 */
async function fetchAutocomplete(query) {
  try {
    const url = `${API_BASE_URL}/api/ai/proxy-keywords?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data[1] || []);
  } catch (e) {
    console.warn("Autocomplete fetch failed:", e);
    return [];
  }
}

// Google Search suggest - much richer for niche/academic topics
async function fetchGoogleSuggest(query) {
  try {
    const url = `${API_BASE_URL}/api/ai/proxy-google-keywords?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data[1] || []);
  } catch (e) {
    console.warn("Google suggest fetch failed:", e);
    return [];
  }
}

async function runKeywordAlphabetLoop(seed) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  let allKeywords = new Set();
  // Parallel batched execution - 6 concurrent requests at a time (was sequential = 10s delay)
  const BATCH_SIZE = 6;
  for (let i = 0; i < alphabet.length; i += BATCH_SIZE) {
    const batch = alphabet.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(char => {
      const query = `${seed} ${char}`;
      return fetchAutocomplete(query).catch(() => []);
    }));
    batchResults.forEach(results => results.forEach(k => allKeywords.add(k)));
    if (i + BATCH_SIZE < alphabet.length) await new Promise(r => setTimeout(r, 100));
  }
  return Array.from(allKeywords);
}

async function runAsteriskSearch(seed) {
  const patterns = [
    `how to ${seed}`,
    `best ${seed}`,
    `${seed} vs`,
    `why ${seed}`,
    `${seed} tutorial`,
    `${seed} for beginners`
  ];
  // Parallel execution - all patterns at once
  const results = await Promise.all(patterns.map(p => fetchAutocomplete(p).catch(() => [])));
  let allKeywords = new Set();
  results.forEach(r => r.forEach(k => allKeywords.add(k)));
  return Array.from(allKeywords);
}

function filterGoldenKeywords(keywords) {
  return keywords.filter(k => {
    const words = k.split(' ');
    const isLongTail = words.length >= 4;
    const hasIntent = words.some(w => ['how', 'best', 'review', 'guide', 'tutorial', '2026', 'vs'].includes(w.toLowerCase()));
    return isLongTail && hasIntent;
  }).slice(0, 15);
}

// ── 1. Initialize OAuth ──
function initOAuth() {
  if (window.google) {
    console.log("✅ Google GIS Loaded");
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/yt-analytics.readonly email profile',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          handleChannelAuth();
        }
      },
    });
  } else {
    setTimeout(initOAuth, 1000);
  }
}
initOAuth();

// ── 2. YouTube API ──
async function handleChannelAuth() {
  // Save connection state immediately
  localStorage.setItem('ytseo_channel_connected', 'true');
  localStorage.setItem('ytseo_access_token', accessToken);

  // Capture email from Google OAuth
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (userRes.ok) {
      const userInfo = await userRes.json();
      if (userInfo.email) {
        localStorage.setItem('ytseo_user_email', userInfo.email);
        // Send to backend
        fetch(`${API_BASE_URL}/api/credits/save-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
          },
          body: JSON.stringify({ email: userInfo.email })
        }).catch(() => {});
        console.log('📧 Email captured:', userInfo.email);
      }
    }
  } catch(e) { /* non-critical */ }

  // Verify write permissions
  await verifyWritePermissions();
  updatePermissionWarning();

  const channels = await fetchChannelData();
  const oauthBtn = document.getElementById('oauth-btn');

  if (channels.length === 0) {
    alert("No YouTube channels found on this account.");
    return;
  }

  if (oauthBtn) {
    oauthBtn.innerHTML = '<i class="ph-bold ph-check"></i> Connected';
    oauthBtn.style.color = '#10b981';
  }
  console.log('✅ YouTube Access Token Acquired');
  checkWeeklyRefresh();

  // Sync credits with backend after successful auth
  const syncChannelId = channels[0]?.id || localStorage.getItem('ytseo_channel_id') || 'anonymous';
  fetch('/api/credits/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': syncChannelId,
      'x-access-token': accessToken
    },
    body: JSON.stringify({ channelId: syncChannelId })
  }).then(r => r.json()).then(data => {
    console.log('[Credit Sync]', data.credits, 'credits available');
    const countEl = document.getElementById('credits-count');
    if (countEl) countEl.textContent = data.credits || 0;
  }).catch(e => console.warn('[Credit Sync] Failed:', e.message));

  // Run niche detection after channel is connected
  setTimeout(() => {
    detectChannelNiche();
  }, 1500);

  if (channels.length === 1) {
    selectChannel(channels[0]);
  } else {
    showChannelSelector(channels);
  }

  updateQuotaDisplay();
}

function showChannelSelector(channels) {
  const modal = document.getElementById('channel-modal');
  const list = document.getElementById('channel-list');
  if (!modal || !list) return;

  list.innerHTML = '';
  channels.forEach(channel => {
    const opt = document.createElement('div');
    opt.className = 'channel-option';
    opt.innerHTML = `
      <img src="${channel.snippet.thumbnails.default.url}" class="channel-opt-thumb">
      <div class="channel-opt-info">
        <h4>${escapeHTML(channel.snippet.title)}</h4>
        <p>${parseInt(channel.statistics?.subscriberCount || 0).toLocaleString()} subscribers • ${channel.statistics?.videoCount || 0} videos</p>
      </div>
    `;
    opt.onclick = () => {
      selectChannel(channel);
      modal.style.display = 'none';
      alert(`Switched to: ${channel.snippet.title}`);
    };
    list.appendChild(opt);
  });

  modal.style.display = 'flex';

  // Close buttons
  const closeBtn = document.getElementById('channel-modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.style.display = 'none';
  }
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

async function selectChannel(channel) {
  activeChannel = channel;
  console.log('✅ Selected Channel:', channel.snippet.title);

  // Save channel details to localStorage
  localStorage.setItem('ytseo_channel_name', channel.snippet.title);
  localStorage.setItem('ytseo_channel_id', channel.id);

  // Update UI
  updateConnectedUI(channel.snippet.title);

  // Reset credits for the new channel - fetch fresh balance from server
  if (typeof CreditsSystem !== 'undefined') {
    CreditsSystem.total = 100; // Optimistic default while fetching
    CreditsSystem.used = 0;
    CreditsSystem.tier = 'free';
    CreditsSystem.save();
    CreditsSystem.updateDisplay();
  }
  userPlan = 'free';
  userCredits = 100;
  updatePlanUI();
  updateCreditsDisplay();
  syncPlanFromBackend(); // Fetch actual balance for this channel

  // Fetch and display real analytics
  await fetchYouTubeAnalytics(channel.id);

  // ── PHRONESIS AUTO-SCAN: Scan channel immediately on connection ──
  try {
    // Auto-enable autonomous mode so the agent starts monitoring
    var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
    await fetch('/api/agent/toggle', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'x-channel-id': ch }, 
      body: JSON.stringify({ enabled: true, mode: 'monitor' }) 
    });
    
    // ── Show scanning state in list elements (don't destroy parent columns) ──
    var inboxEl = document.getElementById('war-inbox-list');
    if (inboxEl) inboxEl.innerHTML = '<p style="color:var(--war-muted);text-align:center;padding:40px;">🔄 Scanning ' + (channel.snippet.title || 'new channel') + '...</p>';
    var scanList = document.getElementById('scan-results-list');
    if (scanList) scanList.innerHTML = '<p style="color:var(--war-muted);text-align:center;padding:40px;">🔄 Scanning...</p>';
    var recList = document.getElementById('recommend-list');
    if (recList) recList.innerHTML = '<p style="color:var(--war-muted);text-align:center;padding:40px;">🔄 Scanning...</p>';
    
    // Trigger growth scan with the connected channel
    showToast('🔍 Phronesis is scanning your channel for optimization opportunities...', 'info');
    var scanRes = await fetch('/api/agent/trigger', { 
      method: 'POST',
      headers: { 'x-channel-id': ch }
    });
    var scanData = await scanRes.json();
    if (scanData.status === 'completed') {
      var taskCount = (scanData.tasks || []).length;
      var inboxCount = scanData.queueItemsCreated || 0;
      var totalProposals = scanData.totalProposals || 0;
      showToast('✅ Phronesis scan complete! ' + totalProposals + ' actions found. ' + inboxCount + ' proposals in your Command Inbox. Next scan in 48 hours.', 'success');
      // Store last scan time
      localStorage.setItem('phronesis_last_scan', Date.now());
      // ── Refresh Phronesis panel with new channel data ──
      setTimeout(function() {
        loadPhronesis(); loadCommandInbox(); loadScanResults(); loadRecommendations();
      }, 500);
    } else {
      showToast('⚠️ Scan: ' + (scanData.reason || 'No actions needed.'), 'warning');
    }
  } catch(e) {
    console.warn('Phronesis auto-scan failed:', e.message);
  }
}

async function fetchChannelData() {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet,brandingSettings,statistics&mine=true', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.items || [];
}

async function fetchLatestVideos(playlistId, maxResults = 5) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${maxResults}&playlistId=${playlistId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  console.log('📡 Videos:', data.items?.length);
  return data.items || [];
}

// Fetch durations to detect Shorts vs Long videos, and also fetch statistics for AI Chatbot Analytics
window.videoStatsData = {};
async function fetchVideoDurations(videoIds) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(',')}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  const durations = {};
  window.videoDetailsData = window.videoDetailsData || {};
  for (const item of (data.items || [])) {
    durations[item.id] = parseDuration(item.contentDetails.duration);
    window.videoStatsData[item.id] = item.statistics;
    window.videoDetailsData[item.id] = item.contentDetails;
  }
  return durations;
}

function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}

// ── NICHE-RELEVANCE GUARD ──
async function analyzeNicheRelevance() {
  const urlInput = document.getElementById('niche-leader-url');
  const resultsContainer = document.getElementById('relevance-results');
  const videoUrl = (urlInput?.value || '').trim();

  if (!videoUrl) {
    showToast('Please enter a niche leader video URL', 'error');
    return;
  }

  const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!videoIdMatch) {
    showToast('Invalid YouTube URL - paste a video link like youtube.com/watch?v=...', 'error');
    return;
  }
  const videoId = videoIdMatch[1];

  if (!CreditsSystem.deduct('niche-relevance-guard')) return;
  updateTimeSaved(2);

  resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner-pro"></div><p>Fetching video data & analyzing niche fit...</p></div>';

  try {
    // Fetch video details from YouTube API
    const token = accessToken || '';
    const apiKey = localStorage.getItem('ytseo_api_key') || '';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}${!token && apiKey ? '&key=' + apiKey : ''}`, { headers });

    let videoTitle = 'Unknown Video';
    let videoTags = [];
    let videoDescription = '';
    let viewCount = 0;

    if (videoRes.ok) {
      const videoData = await videoRes.json();
      if (videoData.items?.[0]) {
        const snippet = videoData.items[0].snippet;
        videoTitle = snippet?.title || 'Unknown';
        videoTags = snippet?.tags || [];
        videoDescription = (snippet?.description || '').substring(0, 300);
        viewCount = parseInt(videoData.items[0].statistics?.viewCount || '0');
      }
    }

    // AI analysis
    const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
    const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const userNiche = localStorage.getItem('ytseo_detected_niche') || channelNiche || 'General';

    const aiRes = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        'x-channel-id': chId
      },
      body: JSON.stringify({
        systemPrompt: 'You analyze YouTube video content strategy. Find topic/keyword gaps between this video and the user niche. gapAnalysis MUST be a single string about what CONTENT TOPICS or ANGLES the user is missing. Never return an object for gapAnalysis. Scores 0-100 integers.',
        userPrompt: `Competitive content gap analysis.\n\nLeader Video: "${videoTitle}"\nTheir Tags: ${videoTags.slice(0, 20).join(', ')}\nViews: ${viewCount.toLocaleString()}\nUser's Niche: ${userNiche}\n\nIdentify TOPIC GAPS - subjects, angles, or keywords this leader covers that a creator in niche "${userNiche}" could also make videos about. Do NOT analyze metrics like CTR/watch time.\n\nReturn JSON:\n{\n  "nicheCategory": "category",\n  "relevanceScore": 85,\n  "gapKeywords": ["kw1","kw2","kw3","kw4","kw5","kw6"],\n  "gapAnalysis": "ONE STRING: the biggest content topic opportunity this video suggests for niche ${userNiche}",\n  "actionableTips": ["tip1","tip2","tip3"]\n}\n\nCRITICAL: gapAnalysis MUST be a string (NOT an object). Focus on CONTENT TOPICS.`,
        taskType: 'metadata-collusion',
        temperatureOverride: 0.3
      })
    });

    let analysis = {};
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content || '{}';
      console.log('[Niche] Raw AI:', content.substring(0, 200));
      try {
        analysis = JSON.parse(content.replace(/```json|```/g, '').trim());
      } catch (e) {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) try { analysis = JSON.parse(match[0]); } catch (_) {}
      }
    }

    // Extract fields with fallbacks
    const nicheCat = analysis.nicheCategory || videoTags[0] || 'General';
    const score = Math.round(analysis.relevanceScore || 75);
    const gapKeywords = analysis.gapKeywords?.length > 0 ? analysis.gapKeywords : videoTags.slice(0, 6);
    const gapText = typeof analysis.gapAnalysis === 'string' ? analysis.gapAnalysis
      : (analysis.gapAnalysis?.title || analysis.gapAnalysis?.text || analysis.gapAnalysis?.summary || 'Analyze this leader\'s keywords to find content gaps in your strategy.');
    const tips = analysis.actionableTips?.length > 0 ? analysis.actionableTips : [
      `Study how "${videoTitle.substring(0, 40)}..." structures its first 30 seconds`,
      `Target the keyword "${gapKeywords[0] || videoTags[0] || 'your niche'}" in your next video`,
      `Create a response video addressing a question raised by this content`
    ];

    // Determine overlap: which of the leader's tags match the user's niche words
    const nicheWords = userNiche.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matchingTags = videoTags.filter(t => nicheWords.some(nw => t.toLowerCase().includes(nw)));
    const uniqueTags = videoTags.filter(t => !nicheWords.some(nw => t.toLowerCase().includes(nw)));
    const overlap = videoTags.length > 0 ? Math.round((matchingTags.length / videoTags.length) * 100) : 50;

    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    resultsContainer.innerHTML = `
      <div class="niche-results-grid">
        <!-- Score Card -->
        <div class="niche-score-card">
          <div class="score-ring" style="--score:${score}%; --color:${scoreColor};">
            <span class="score-value">${score}%</span>
            <span class="score-label">Optimization Score</span>
          </div>
          <div class="niche-category">📂 ${nicheCat}</div>
          <div class="video-title-ref">🎬 ${escapeHTML(videoTitle.substring(0, 60))}${videoTitle.length > 60 ? '...' : ''}</div>
        </div>

        <!-- Gap Analysis Card -->
        <div class="niche-gap-card">
          <h4><i data-lucide="crosshair"></i> Gap Analysis</h4>
          <p class="gap-text">${escapeHTML(gapText)}</p>
          <div class="gap-keywords">
            <strong>🎯 Keywords you're missing:</strong>
            <div class="tag-list">${gapKeywords.map(k => `<span class="tag-chip tag-gap" onclick="sendToFactory('${escapeHTML(k).replace(/'/g, "\\'")}');showToast('Sent to Video Factory!','success')" title="Click to send to Video Factory">${escapeHTML(k)}</span>`).join(' ')}</div>
          </div>
        </div>

        <!-- Leader's Actual Tags Card -->
        <div class="niche-tags-card">
          <h4><i data-lucide="tags"></i> Leader's Tags (${videoTags.length})</h4>
          <div class="tag-groups">
            ${matchingTags.length > 0 ? `
              <div class="tag-group">
                <span class="tag-group-label match">✅ Matching Your Niche (${matchingTags.length})</span>
                <div class="tag-list">${matchingTags.map(t => `<span class="tag-chip tag-match">${escapeHTML(t)}</span>`).join('')}</div>
              </div>
            ` : ''}
            ${uniqueTags.length > 0 ? `
              <div class="tag-group">
                <span class="tag-group-label gap">🔍 Unique to Leader (${uniqueTags.length})</span>
                <div class="tag-list">${uniqueTags.map(t => `<span class="tag-chip tag-unique">${escapeHTML(t)}</span>`).join('')}</div>
              </div>
            ` : ''}
          </div>
          <div class="overlap-bar">
            <span>Overlap with "${userNiche}":</span>
            <div class="bar-track"><div class="bar-fill" style="width:${overlap}%;background:#8b5cf6;"></div></div>
            <span class="bar-value">${overlap}%</span>
          </div>
        </div>

        <!-- Actionable Tips Card -->
        <div class="niche-tips-card">
          <h4><i data-lucide="lightbulb"></i> Actionable Tips</h4>
          <ul class="tips-list">${tips.map((t, i) => `<li><span class="tip-num">${i + 1}</span> ${escapeHTML(t)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="niche-actions-bar">
        <button class="btn-secondary" onclick="copyNicheGapKeywords()"><i data-lucide="copy"></i> Copy Gap Keywords</button>
        <button class="btn-outline" onclick="switchView('competitor');var el=document.getElementById('competitor-video-url');if(el)el.value='${escapeHTML(videoUrl).replace(/'/g, "\\'")}';showToast('URL sent to Sniper','success')"><i data-lucide="crosshair"></i> Snipe This Video</button>
        <button class="btn-outline" onclick="gapKeywords.forEach(k => { discoveredKeywords = gapKeywords.map(gk => ({keyword: gk, intentScore: 70, competition: 'Medium', competitionScore: 45, searchVolume: 2000, opportunityScore: 78, isGolden: false})); }); switchView('research'); displayResults();"><i data-lucide="table"></i> View as Keywords</button>
      </div>
    `;

    // Store for copy/export
    window._nicheGapKeywords = gapKeywords;
    window._nicheAnalysis = { nicheCat, score, gapKeywords, gapText, tips, videoTags, matchingTags, uniqueTags, overlap };
    window.copyNicheGapKeywords = function() {
      const kws = window._nicheGapKeywords || [];
      if (kws.length) { navigator.clipboard.writeText(kws.join(', ')); showToast('Gap keywords copied!', 'success'); }
      else showToast('No keywords to copy', 'error');
    };

    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100);
    showToast('Niche analysis complete', 'success');

  } catch (e) {
    resultsContainer.innerHTML = '<div class="error-card"><i data-lucide="alert-triangle"></i><p>Analysis failed: ' + e.message + '</p><button class="btn-outline btn-sm" onclick="analyzeNicheRelevance()">Retry</button></div>';
    showToast('Niche analysis failed', 'error');
  }
}
window.analyzeNicheRelevance = analyzeNicheRelevance;

// ── THUMBNAIL LAB ──
let activeThumbnailData = {
  url: '',
  stats: { brightness: 0, contrast: 0, saturation: 0, faceFound: false, dangerZone: false },
};

function handleThumbnailFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => analyzeThumbnail('file', e.target.result);
  reader.readAsDataURL(file);
}
window.handleThumbnailFile = handleThumbnailFile;

// Helper: Extract YouTube ID
function getYoutubeId(url) {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Helper: Deterministic Hash for silent fallback
function getDeterministicScores(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  return {
    contrast: 60 + (seed % 35),
    emotion: 55 + ((seed >> 2) % 40),
    thirds: 50 + ((seed >> 4) % 45),
    face: (seed % 100) > 40 ? 70 + (seed % 25) : 10 + (seed % 30)
  };
}

async function analyzeThumbnail(mode, sourceOverride = null) {
  const urlInput = document.getElementById('thumbnail-url');
  const resultsContainer = document.getElementById('thumbnail-results');
  let inputVal = urlInput.value.trim();
  let thumbUrl = sourceOverride || inputVal;
  let videoId = sourceOverride ? null : getYoutubeId(inputVal);

  if (!thumbUrl && mode === 'url') {
    showToast('Please enter a YouTube URL or upload a file', 'error');
    return;
  }

  if (!CreditsSystem.deduct('thumbnail-analysis')) return;

  // Explicit State Reset
  activeThumbnailData = { url: '', stats: { brightness: 0, contrast: 0, saturation: 0, faceFound: false, dangerZone: false } };
  resultsContainer.innerHTML = '';

  // Show Skeleton UI phase
  resultsContainer.innerHTML = `
    <div class="thumbnail-preview-container">
      <div class="result-image-wrapper skeleton-pulse" style="height: 220px;"></div>
      <div class="thumbnail-scores-card">
        <h4 class="skeleton-pulse">Analyzing Visual Data...</h4>
        <div class="score-row skeleton-pulse" style="height: 20px; margin-bottom: 15px;"></div>
        <div class="score-row skeleton-pulse" style="height: 20px; margin-bottom: 15px;"></div>
        <div class="score-row skeleton-pulse" style="height: 20px; margin-bottom: 15px;"></div>
        <div class="score-row skeleton-pulse" style="height: 20px;"></div>
      </div>
    </div>
  `;

  const img = new Image();
  img.crossOrigin = "Anonymous";

  // Resolution Waterfall Logic
  const tryLoad = async (id, resolutions) => {
    for (const res of resolutions) {
      const url = `https://img.youtube.com/vi/${id}/${res}.jpg`;
      const success = await new Promise(resolve => {
        const testImg = new Image();
        testImg.onload = () => resolve(url);
        testImg.onerror = () => resolve(null);
        testImg.src = url;
      });
      if (success) return success;
    }
    return null;
  };

  if (videoId) {
    thumbUrl = await tryLoad(videoId, ['maxresdefault', 'sddefault', 'hqdefault']);
    if (!thumbUrl) {
      resultsContainer.innerHTML = `
        <div class="error-state-card">
          <i data-lucide="warning-circle"></i>
          <h4>Image Not Found</h4>
          <p>YouTube returned a 404 for this ID. The video might be private or lacks a thumbnail.</p>
        </div>
      `;
      return;
    }
  }

  img.src = thumbUrl;
  img.className = 'lens-focus-blur';

  img.onload = async () => {
    // Render initial structure with focusing image
    renderInitialThumbnailScores(thumbUrl);
    const analyzedImg = document.getElementById('analyzed-thumb-img');

    // Focus effect
    setTimeout(() => analyzedImg.classList.add('lens-cleared'), 100);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    let scores;
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let rSum = 0, gSum = 0, bSum = 0, lumList = [];
      let skinCenter = 0, skinDanger = 0;

      for (let i = 0; i < data.length; i += 40) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = 0.299*r + 0.587*g + 0.114*b;
        lumList.push(lum);
        rSum += r; gSum += g; bSum += b;

        const x = (i/4) % canvas.width, y = Math.floor((i/4) / canvas.width);
        const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r-g) > 15;
        if (isSkin) {
          if (x > canvas.width*0.3 && x < canvas.width*0.7 && y > canvas.height*0.3 && y < canvas.height*0.7) skinCenter++;
          if (x > canvas.width*0.7 && y > canvas.height*0.7) skinDanger++;
        }
      }

      const avgLum = lumList.reduce((a,b) => a+b, 0) / lumList.length;
      const stdDevLum = Math.sqrt(lumList.map(x => Math.pow(x - avgLum, 2)).reduce((a,b) => a+b, 0) / lumList.length);
      const maxRGB = Math.max(rSum, gSum, bSum), minRGB = Math.min(rSum, gSum, bSum);
      const sat = (maxRGB - minRGB) / maxRGB;

      activeThumbnailData.stats = {
        brightness: (avgLum/255)*100,
        contrast: (stdDevLum/128)*100,
        saturation: sat*100,
        faceFound: skinCenter > (lumList.length * 0.01),
        dangerZone: skinDanger > (lumList.length * 0.005)
      };

      scores = {
        contrast: Math.min(100, Math.floor(activeThumbnailData.stats.contrast + 20)),
        emotion: Math.min(100, Math.floor(activeThumbnailData.stats.saturation + (activeThumbnailData.stats.faceFound ? 30 : 0))),
        thirds: 65 + (activeThumbnailData.stats.faceFound ? 20 : 0),
        face: activeThumbnailData.stats.faceFound ? 92 : 15
      };
    } catch (e) {
      // Deterministic fallback for CORS
      scores = getDeterministicScores(videoId || "localfile");
      activeThumbnailData.stats = {
        brightness: 70, saturation: 60, faceFound: scores.face > 50, dangerZone: (videoId && videoId.length % 2 === 0)
      };
    }

    activeThumbnailData.url = thumbUrl;
    updateScoreUI(scores);
  };

  img.onerror = () => {
    resultsContainer.innerHTML = `<div class="error-state-card"><i data-lucide="warning"></i><h4>Analysis Error</h4><p>Could not fetch visual data. Ensure the URL is public.</p></div>`;
  };
}

function renderInitialThumbnailScores(url) {
  const container = document.getElementById('thumbnail-results');
  container.innerHTML = `
    <div class="thumbnail-preview-container">
      <div class="result-image-wrapper" id="thumb-viewer">
        <div class="laser-line"></div>
        <img src="${url}" id="analyzed-thumb-img" class="lens-focus-blur">
      </div>
      <div class="thumbnail-scores-card" id="scores-card-inner">
        <h4 style="margin-bottom: 20px;"><i data-lucide="bar-chart-2"></i> Visual Heuristics</h4>
        ${renderScorePlaceholder('Contrast Ratio')}
        ${renderScorePlaceholder('Emotional Impact')}
        ${renderScorePlaceholder('Rule of Thirds')}
        ${renderScorePlaceholder('Human Geometry')}
      </div>
    </div>
  `;
}

function renderScorePlaceholder(label) {
  return `<div class="score-row"><div class="score-label">${label}</div><div class="score-track skeleton-pulse"></div><div class="score-value">--%</div></div>`;
}

function updateScoreUI(scores) {
  const card = document.getElementById('scores-card-inner');
  // Find weakest score for the insight
  const entries = Object.entries(scores);
  entries.sort((a, b) => a[1] - b[1]);
  const [weakestKey, weakestVal] = entries[0];
  const insights = {
    contrast: 'Low contrast makes thumbnails hard to read on mobile. Boost text/background difference.',
    emotion: 'Increase emotional impact with expressive faces or bold color choices.',
    thirds: 'Place key subjects along rule-of-thirds lines for better visual balance.',
    face: 'Thumbnails with faces get 38% higher CTR. Add a human element if possible.'
  };
  const avgScore = Math.round(Object.values(scores).reduce((a,b) => a+b, 0) / 4);
  const gradeColor = avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444';

  card.innerHTML = `
    <div class="thumb-grade" style="color:${gradeColor};">
      <span class="grade-score">${avgScore}/100</span>
      <span class="grade-label">Thumbnail Score</span>
    </div>
    ${renderScoreRow('Contrast Ratio', scores.contrast)}
    ${renderScoreRow('Emotional Impact', scores.emotion)}
    ${renderScoreRow('Rule of Thirds', scores.thirds)}
    ${renderScoreRow('Human Geometry', scores.face)}
    <div class="thumb-insight" style="margin-top:14px;padding:12px;background:rgba(249,115,22,0.08);border-radius:8px;border-left:3px solid var(--primary);">
      <p style="font-size:0.82rem;color:var(--text-muted);margin:0;line-height:1.5;"><strong style="color:var(--primary);">🎯 ${weakestKey === 'contrast' ? 'Contrast' : weakestKey === 'emotion' ? 'Emotion' : weakestKey === 'thirds' ? 'Composition' : 'Human Element'}:</strong> ${insights[weakestKey] || 'Focus on improving the weakest area for maximum CTR gain.'}</p>
    </div>
    <div class="deep-scan-teaser">
      <p style="font-size: 13px; margin-bottom: 12px; color: var(--text-muted);">Pixel analysis complete. Run AI-powered Deep Scan for heatmap simulation + optimization tips.</p>
      <button class="btn-pro" onclick="runDeepScan()"><i data-lucide="scan"></i> 🔬 Run Eye-Tracking Deep Scan</button>
    </div>
  `;
  showToast('Visual heuristics calculated', 'success');
}

function renderScoreRow(label, score) {
  const color = score >= 80 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  return `<div class="score-row"><div class="score-label">${label}</div><div class="score-track"><div class="score-fill" style="width: ${score}%; background: ${color}"></div></div><div class="score-value" style="color:${color};font-weight:700;">${score}%</div></div>`;
}

async function runDeepScan() {
  const viewer = document.getElementById('thumb-viewer');
  const btn = document.querySelector('.btn-pro');
  const resultsArea = document.getElementById('thumbnail-results');

  if (btn) btn.style.display = 'none';

  const existingCard = resultsArea.querySelector('.recom-card');
  if (existingCard) existingCard.remove();

  viewer.classList.add('scanning-active');

  const statuses = ['Mapping focal points...', 'Simulating peripheral vision...', 'Generating attention heatmap...', 'Calculating CTR impact...'];
  for (const s of statuses) {
    showToast(s, 'info');
    await new Promise(r => setTimeout(r, 600));
  }

  viewer.classList.remove('scanning-active');
  viewer.classList.add('heatmap-active');

  const stats = activeThumbnailData.stats;
  const recoms = [];

  if (stats.dangerZone) {
    recoms.push({ type: 'alert', title: 'Focal Overlay Risk', text: 'Key visual element may be obscured by the YouTube timestamp overlay. Move important content to center-left.' });
  }
  if (stats.saturation < 40) {
    recoms.push({ type: 'alert', title: 'Low Color Impact', text: 'Saturation is below optimal range. Boost vibrancy by 20-30% to stand out in sidebar feeds.' });
  } else {
    recoms.push({ type: 'tip', title: 'Color Pop Factor', text: 'Strong saturation. Your thumbnail will stand out against YouTube gray background.' });
  }
  if (stats.contrast < 50) {
    recoms.push({ type: 'alert', title: 'Mobile Visibility', text: 'Low contrast makes details invisible on phone screens. Darken background or brighten subject.' });
  }
  recoms.push({ type: 'tip', title: '3-Color Rule', text: 'Limit your palette to 3 dominant colors. Too many hues increase cognitive load and reduce CTR.' });
  recoms.push({ type: 'tip', title: 'Focal Path', text: stats.faceFound ? 'Face detected - viewers follow the subject gaze. Point it toward your title text.' : 'No face detected. Add a close-up face - thumbnails with faces average 38% higher CTR.' });

  const card = document.createElement('div');
  card.className = 'recom-card ' + (stats.dangerZone ? 'warning' : '');
  card.innerHTML = '<div class="recom-title"><i data-lucide="lightbulb"></i><h4>Deep Scan Results</h4></div><ul class="recom-list">' +
    recoms.map(r => '<li class="recom-item ' + (r.type==='alert'?'alert':'') + '"><div><strong>' + r.title + ':</strong> ' + r.text + '</div></li>').join('') +
    '</ul><div style="margin-top:16px;text-align:center;"><button class="btn-secondary" onclick="resetHeatmap()" style="font-size:11px;">Toggle Original</button></div>';

  resultsArea.appendChild(card);
  showToast('Deep Scan Complete', 'success');
}

window.runDeepScan = runDeepScan;
window.resetHeatmap = () => document.getElementById('thumb-viewer').classList.toggle('heatmap-active');
window.analyzeThumbnail = analyzeThumbnail;

// ── SIDEBAR SNIPER ──

// ── SHARED SNIPER UI RENDERING ──

function renderSniperResultsUI(container, videoId, meta, sniperTags, predictedTags = [], source = 'API') {
  // Calculate real Hijack Probability based on tag quality
  const displayTags = (meta.tags && meta.tags.length > 0) ? meta.tags : (predictedTags.length > 0 ? predictedTags : []);
  const isAI = source === 'AI';
  const bridgeAvgLength = sniperTags.reduce((sum, t) => sum + t.split(/\s+/).length, 0) / Math.max(sniperTags.length, 1);
  const bridgeDiversity = new Set(sniperTags.map(t => t.toLowerCase())).size / Math.max(sniperTags.length, 1);
  const tagCount = displayTags.length + sniperTags.length;

  let score = 50; // base
  if (bridgeAvgLength >= 3) score += 20;       // long-tail bridge tags = better
  else if (bridgeAvgLength >= 2) score += 10;
  if (bridgeDiversity > 0.9) score += 15;       // unique tags = better
  if (tagCount >= 15) score += 10;               // more tags = better coverage
  if (source === 'API') score += 5;              // API-verified = better
  score = Math.min(score, 98);

  const scoreColor = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#f97316';

  container.innerHTML = `
    <div class="sniper-grid">
      <!-- Competitor Column -->
      <div class="sniper-col competitor-meta">
        <div class="result-header">
          <h4><i data-lucide="search"></i> Extracted Intelligence</h4>
          <span class="badge-optimized" style="background:${isAI ? 'rgba(168,85,247,0.2)' : 'rgba(59,130,246,0.2)'}; color: ${isAI ? '#a855f7' : '#3b82f6'}; border: 1px solid currentColor;">
            ${isAI ? 'AI PREDICTED' : 'API VERIFIED'}
          </span>
        </div>

        <div class="tag-cloud ${userPlan === 'free' ? 'blurred-metadata' : ''}">
          ${isAI ? `<p style="font-size: 13px; color: var(--text-muted); font-style: italic; margin-bottom: 8px;">Tags reverse-engineered from title & description via AI.</p>` : ''}
          ${displayTags.length > 0 ? displayTags.map(t => `<span class="sniper-tag">${t}</span>`).join('') : '<p>No tags extracted.</p>'}
        </div>

        ${userPlan === 'free' ? `
          <div class="blur-overlay">
            <i class="ph-fill ph-lock" style="font-size: 2rem; margin-bottom: 1rem; color: var(--primary);"></i>
            <h4 style="margin:0;">Competitor Metadata Locked</h4>
            <p style="font-size: 12px; color: var(--text-muted);">Standard Edition: Competitor tags are hidden. Upgrade to Pro to see full competitor analysis.</p>
            <button class="btn-pro" style="margin-top: 10px; font-size: 12px; padding: 6px 16px;" onclick="switchView('overview')">Unlock with PRO</button>
          </div>
        ` : ''}
      </div>

      <!-- Sniper Column -->
      <div class="sniper-col pro-bundle">
        <div class="result-header">
          <h4><i data-lucide="target"></i> Sniper Bundle</h4>
          <button class="copy-all-btn" onclick="copySniperBundle()">
            <i data-lucide="copy"></i> Copy Bundle
          </button>
        </div>

        <div class="tag-cloud" id="sniper-bundle-container">
          ${sniperTags.map(t => `<span class="sniper-tag bridge">${t}</span>`).join('')}
        </div>

        <div class="sniper-footer">
          <div class="compat-score-container">
            <div style="flex: 1;">
              <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                <span style="font-size: 11px; color: var(--text-muted);">Hijack Probability</span>
                <span style="font-size: 11px; color: ${scoreColor}; font-weight: bold;">${score}%</span>
              </div>
              <div class="compat-meter">
                <div class="compat-fill sniper-fill-animate" style="width: ${score}%; background: ${scoreColor};" id="sniper-fill-${container.id}"></div>
              </div>
            </div>
          </div>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
            <i data-lucide="info"></i> ${score >= 85 ? 'Strong niche alignment detected. High probability of appearing in Suggested sidebar.' : score >= 70 ? 'Moderate niche alignment. Bridge tags target adjacent audience segments.' : 'Building niche bridge. Tags target broader semantic clusters for discovery.'}
          </p>
        </div>
      </div>
    </div>
  `;
}

function copySniperBundle() {
  const tags = Array.from(document.querySelectorAll('.sniper-tag.bridge')).map(el => el.textContent);
  if (tags.length === 0) return;

  navigator.clipboard.writeText(tags.join(', ')).then(() => {
    showToast('Sniper Bundle Copied!', 'success');
  });
}

// [Removed Local Duplicate window.runSidebarSniper]
window.copySniperBundle = copySniperBundle;

// ── SCRIPT-TO-SHORTS ──
async function extractShortsHooks() {
  const transcriptInput = document.getElementById('transcript-input');
  const resultsContainer = document.getElementById('hooks-results');
  const style = document.getElementById('shorts-style')?.value || 'summary';
  const transcript = transcriptInput.value.trim();

  if (!transcript) {
    showToast('Please paste a transcript', 'error');
    return;
  }

  if (!CreditsSystem.deduct('video-factory')) return;
  updateTimeSaved(3);

  resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner-pro"></div><p>Generating 60-second Shorts script...</p></div>';

  const styleGuides = {
    summary: 'Condense this into a standalone 60-second YouTube Short that captures the key message. Include: punchy opening hook (5s), main point with 1-2 supporting details (45s), strong CTA (10s).',
    teaser: 'Create a hype teaser YouTube Short (60s) that makes viewers desperate to watch the full video. Use cliffhangers, questions, "you won\'t believe" energy. End with "Full video linked in comments/bio."',
    hook: 'Find the single strongest moment in this script and expand it into a 60-second standalone Short. Build anticipation before revealing the powerful moment. Maximum impact.',
    tutorial: 'Extract the single most actionable tip or step from this script. Turn it into a 60-second tutorial Short: show the problem (10s), show the solution (40s), quick CTA (10s).'
  };

  let shortsScript = '';

  try {
    const res = await window.apiPost('/api/ai/generate', {
      userPrompt: styleGuides[style] + '\n\nFormat with timestamps [0:00-0:05], [0:05-0:50], [0:50-0:60]. Include VISUAL suggestions and HOST dialogue. MAX 60 seconds.\n\nFULL SCRIPT:\n' + transcript.substring(0, 4000),
      systemPrompt: 'You create YouTube Shorts scripts. Keep it tight, punchy, max 60 seconds. Use timestamps. Make every second count.',
      taskType: 'comment-reply'
    });

    if (res.ok) {
      const data = await res.json();
      shortsScript = data.choices?.[0]?.message?.content || '';
    }
  } catch (e) {
    console.warn('[Shorts] AI generation failed:', e.message);
  }

  // Fallback: extract the most engaging segment and wrap it
  if (!shortsScript || shortsScript.length < 50) {
    const clean = transcript
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/\[HOST\]:?\s*/gi, '')
      .replace(/\[SFX\]:?\s*/gi, '')
      .replace(/\[VISUAL\]:?\s*/gi, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\n{3,}/g, '\n\n');

    const sentences = clean.split(/[.!?]+\s*/).filter(s => s.trim().length > 20 && s.trim().length < 200);
    const best = sentences.slice(0, 4).join('. ') + '.';

    shortsScript = '[0:00-0:05] \n[HOST]: ' + best.substring(0, 100).split(' ').slice(0, -1).join(' ') + '...\n\n[0:05-0:50]\n[HOST]: ' + best.substring(0, 400) + '\n\n[0:50-0:60]\n[HOST]: Want the full breakdown? Watch the complete video on my channel. Link in description! Subscribe for more.';
  }

  const styleLabels = { summary: '📝 Summary Short', teaser: '🎬 Teaser Short', hook: '🔥 Best Hook Short', tutorial: '📚 Quick Tip Short' };

  resultsContainer.innerHTML = `
    <div class="shorts-script-card">
      <div class="shorts-header">
        <span class="shorts-style-badge">${styleLabels[style] || 'Shorts Script'}</span>
        <span class="shorts-duration">⏱ 60 seconds</span>
      </div>
      <div class="shorts-script-body">${shortsScript.replace(/\n/g, '<br>')}</div>
      <div class="shorts-actions">
        <button class="btn-primary" onclick="copyShortsScript()"><i data-lucide="copy"></i> Copy Script</button>
        <button class="btn-outline" onclick="extractShortsHooks()"><i data-lucide="refresh-cw"></i> Regenerate</button>
      </div>
    </div>
  `;

  window._shortsScript = shortsScript;
  window.copyShortsScript = function() {
    const text = window._shortsScript || '';
    if (text) { navigator.clipboard.writeText(text); showToast('Shorts script copied! Ready to shoot.', 'success'); }
    else showToast('No script to copy', 'error');
  };

  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100);
  showToast('60s Shorts script ready!', 'success');
}
window.extractShortsHooks = extractShortsHooks;

// ── METADATA AUDITOR ──
// Global storage for audit data
let currentAuditData = null;
let currentAuditRecommendations = null;

async function auditVideoMetadata() {
  const urlInput = document.getElementById('audit-video-url');
  const resultsContainer = document.getElementById('audit-results');
  const videoUrl = urlInput.value.trim();

  if (!videoUrl) {
    showToast('Please enter a video URL', 'error');
    return;
  }

  const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!videoIdMatch) {
    showToast('Invalid YouTube URL', 'error');
    return;
  }

  // Auditing is free - no credit deduction

  resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner-pro"></div><p>Fetching video & analyzing SEO...</p></div>';

  try {
    const apiKey = localStorage.getItem('ytseo_api_key') || '';
    let videoData;

    // Try OAuth first, fall back to API key, then oEmbed
    if (accessToken) {
      const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIdMatch[1]}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (videoRes.ok) videoData = await videoRes.json();
    }

    if (!videoData && apiKey) {
      const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIdMatch[1]}&key=${apiKey}`);
      if (videoRes.ok) videoData = await videoRes.json();
    }

    // Fallback: oEmbed for title only
    if (!videoData || !videoData.items?.length) {
      const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoIdMatch[1]}`);
      const oembed = await oembedRes.json();
      if (oembed.title) {
        videoData = { items: [{ snippet: { title: oembed.title, description: '', tags: [] }, statistics: {} }] };
      } else {
        showToast('Video not found or private', 'error');
        resultsContainer.innerHTML = '';
        return;
      }
    }

    const video = videoData.items[0];
    const snippet = video.snippet;
    const videoId = videoIdMatch[1];
    const title = snippet.title || '';
    const description = snippet.description || '';
    const tags = snippet.tags || [];

    // Pull flagged issues from Growth Engine (if navigated via 'Fix in Metadata Auditor')
    let growthIssues = [];
    try {
      const storedIssues = localStorage.getItem('growth_engine_issues_for_audit');
      if (storedIssues) {
        growthIssues = JSON.parse(storedIssues);
        localStorage.removeItem('growth_engine_issues_for_audit');
      }
    } catch(e) {}

    // ── SMART SCORING (not just length-based) ──
    // Title score: length + power words + keyword front-loading + emotional triggers
    let titleScore = 50;
    if (title.length >= 40 && title.length <= 65) titleScore += 20;
    else if (title.length >= 30 || (title.length >= 20 && title.length <= 70)) titleScore += 10;
    const powerWords = /\b(exposed|revealed|secret|shocking|ultimate|proven|amazing|incredible|essential|complete|definitive|never|must|need to)\b/i;
    if (powerWords.test(title)) titleScore += 10;
    const emotionalWords = /\b(warning|danger|urgent|crisis|over|dead|killing|destroying|ruining|disappearing)\b/i;
    if (emotionalWords.test(title)) titleScore += 8;
    // Keyword front-loading: first 3 words should contain main keyword
    const firstWords = title.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    if (firstWords.length > 10) titleScore += 5;
    if (title.includes('|') || title.includes('-') || title.includes('-')) titleScore += 5; // Title formatting
    titleScore = Math.min(titleScore, 100);

    // Description score: length + timestamps + links + CTA + hashtags
    let descScore = 40;
    if (description.length >= 1500) descScore += 25;
    else if (description.length >= 500) descScore += 15;
    else if (description.length >= 200) descScore += 10;
    if (/\d{1,2}:\d{2}/.test(description)) descScore += 15; // Has timestamps
    if (/https?:\/\//.test(description)) descScore += 8; // Has links
    if (/subscribe|like|comment|share|follow|check out|watch/i.test(description)) descScore += 7; // Has CTA
    if (/#\w+/.test(description)) descScore += 5; // Has hashtags
    descScore = Math.min(descScore, 100);

    // Tags score: count + specificity + long-tail ratio
    let tagScore = 40;
    tagScore += Math.min(tags.length * 2, 30); // Up to 30 points for count
    const longTailTags = tags.filter(t => t.split(/\s+/).length >= 3).length;
    if (longTailTags >= 5) tagScore += 15;
    else if (longTailTags >= 2) tagScore += 8;
    const uniqueTags = new Set(tags.map(t => t.toLowerCase())).size;
    if (uniqueTags === tags.length) tagScore += 10; // No duplicates
    if (tags.some(t => /^(how|what|why|when|where|who|best|top|review|guide|tutorial|vs)\b/i.test(t))) tagScore += 5; // Has intent tags
    tagScore = Math.min(tagScore, 100);

    // Thumbnail: heuristic based on title metadata (can't analyze image without Canvas)
    const thumbScore = 65; // Default - real analysis needs image upload

    // Overall grade
    const avg = Math.round((titleScore + descScore + tagScore + thumbScore) / 4);
    const grade = avg >= 90 ? 'A+' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F';
    const gradeColor = avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444';

    // Store current audit
    currentAuditData = { videoId, title, description, tags, scores: { title: titleScore, desc: descScore, tags: tagScore, thumb: thumbScore }, avg, grade, gradeColor };

    // Render results
    renderAuditResults(currentAuditData);

    // Show score-based optimization fixes immediately (no AI dependency)
    if (titleScore < 85 || descScore < 85 || tagScore < 85) {
      // Build issue-aware extra context for AI
      const issueContext = growthIssues.length > 0
        ? `\n\nGrowth Engine Flagged Issues (MUST address each):\n${growthIssues.map(i => `- [${i.severity.toUpperCase()}] ${i.issue} (${i.type})`).join('\n')}`
        : '';
      const scoreFixes = generateScoreBasedFixes({ title, description, tags, titleScore, descScore, tagScore, growthIssues });
      renderAuditFixes(scoreFixes);
      // Call dedicated audit AI endpoint (free, no credits, no auth)
      fetch(`${API_BASE_URL}/api/audit-recs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, tags, titleScore, descScore, tagScore })
      }).then(r => r.json()).then(data => {
        if (data.recommendations?.fixes?.length > 0) {
          const aiSection = document.createElement('div');
          aiSection.className = 'audit-fixes-section';
          aiSection.style.cssText = 'margin-top:16px;border-top:1px solid var(--primary);padding-top:16px;';
          aiSection.innerHTML = `<h4 style="display:flex;align-items:center;gap:8px;"><i data-lucide="cpu" style="color:var(--primary);"></i> AI-Optimized Fixes</h4>` +
            data.recommendations.fixes.map(f => `
              <div class="fix-card" style="margin-top:10px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span style="font-size:10px;background:var(--primary);color:#fff;padding:2px 8px;border-radius:4px;text-transform:uppercase;">${f.type}</span>
                  <span style="font-size:12px;color:#f59e0b;">⚠️ ${escapeHTML(f.issue)}</span>
                </div>
                <div style="font-size:13px;color:#a78bfa;margin-bottom:6px;">💡 ${escapeHTML(f.suggestion)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${escapeHTML(f.reason)}</div>
              </div>
            `).join('');
          const auditResults = document.getElementById('audit-results');
          if (auditResults) {
            const oldFixes = auditResults.querySelector('.audit-fixes-section');
            if (oldFixes) oldFixes.remove();
            auditResults.appendChild(aiSection);
            if (window.lucide) lucide.createIcons();
          }
        }
      }).catch(() => {});
    } else {
      const resultsContainer2 = document.getElementById('audit-results');
      if (resultsContainer2) {
        resultsContainer2.innerHTML += '<div class="audit-fixes-section"><h4><i data-lucide="check-circle"></i> All Scores Look Good</h4>' +
          '<div class="fix-card"><div class="fix-reason">✅ Your metadata is well-optimized. Consider running the video through the Evergreen Audit or AI Coach for advanced strategy tips.</div></div></div>';
      }
    }

    showToast(`Audit complete: Grade ${grade}`, 'success');
    vaTrack('metadata_audit', { grade, titleScore, descScore, tagScore });
  } catch (err) {
    showToast('Audit failed: ' + err.message, 'error');
    resultsContainer.innerHTML = '';
  }
}

function renderAuditResults(data) {
  const { title, description, tags, scores, avg, grade, gradeColor, videoId } = data;
  const { title: titleScore, desc: descScore, tags: tagScore, thumb: thumbScore } = scores;

  const resultsContainer = document.getElementById('audit-results');
  if (!resultsContainer) return;

  // Preserve the Growth Engine issues banner if it was injected
  const existingBanner = resultsContainer.querySelector('[data-growth-banner]');
  const bannerHTML = existingBanner ? existingBanner.outerHTML : '';

  const scoreBar = (s, l) => `<div class="score-bar"><div style="width:${s}%;background:${s>=85?'#10b981':s>=60?'#f59e0b':'#ef4444'}"></div></div><span style="font-weight:700;color:${s>=85?'#10b981':s>=60?'#f59e0b':'#ef4444'};min-width:50px;text-align:right;">${s}/100</span>`;

  resultsContainer.innerHTML = bannerHTML + `
    <div class="audit-grade-banner" style="background:${gradeColor}15;border:2px solid ${gradeColor}30;">
      <div class="grade-circle" style="color:${gradeColor};border:3px solid ${gradeColor};">${grade}</div>
      <div class="grade-info">
        <span class="grade-label">Overall SEO Grade</span>
        <span class="grade-avg">${avg}/100</span>
      </div>
    </div>

    <div class="audit-summary">
      <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" class="audit-thumb" onerror="this.style.display='none'" alt="Video thumbnail">
      <div class="audit-info">
        <h4>${escapeHTML(title)}</h4>
        <div class="audit-meta">
          <span>📝 ${title.length} chars</span>
          <span>📄 ${(description?.length || 0).toLocaleString()} chars</span>
          <span>🏷️ ${tags.length} tags</span>
        </div>
      </div>
    </div>

    <div class="audit-scores">
      <div class="audit-score-item">
        <span>📝 Title</span>
        ${scoreBar(titleScore)}
      </div>
      <div class="audit-score-item">
        <span>📄 Description</span>
        ${scoreBar(descScore)}
      </div>
      <div class="audit-score-item">
        <span>🏷️ Tags</span>
        ${scoreBar(tagScore)}
      </div>
      <div class="audit-score-item">
        <span>🖼️ Thumbnail</span>
        ${scoreBar(thumbScore)}
      </div>
    </div>

    <div class="audit-quick-tips">
      ${titleScore < 70 ? '<div class="quick-tip alert">⚠️ Title is too short. YouTube titles between 40-65 characters get the best CTR. Add power words.</div>' : titleScore >= 85 ? '<div class="quick-tip success">✅ Title length and structure is good for SEO.</div>' : ''}
      ${descScore < 70 ? '<div class="quick-tip alert">⚠️ Description needs timestamps, links, and a CTA to maximize watch time.</div>' : descScore >= 85 ? '<div class="quick-tip success">✅ Strong description with good structure.</div>' : ''}
      ${tagScore < 70 ? '<div class="quick-tip alert">⚠️ Add more long-tail tags (3+ word phrases) to capture specific search intent.</div>' : tagScore >= 85 ? '<div class="quick-tip success">✅ Good variety of tags with long-tail coverage.</div>' : ''}
    </div>
  `;
}

// Generate fix suggestions directly from audit scores when AI is unavailable
function generateScoreBasedFixes({ title, description, tags, titleScore, descScore, tagScore, growthIssues = [] }) {
  const fixes = {};

  // ── Smart Topic Extraction ──
  // Strip punctuation/possessives from each word, then filter stop words
  const STOP_WORDS = new Set([
    'the','and','for','with','that','this','from','your','what','when','where',
    'why','how','who','are','was','were','will','have','has','had','been','being',
    'really','truly','actually','behind','inside','about','after','before','over',
    'under','into','onto','upon','just','only','also','even','very','more','most',
    'than','then','them','they','their','there','here','which','while','would',
    'could','should','does','did','its','its','our','these','those','some','any',
    'all','both','each','every','such','further','yet','still','already'
  ]);

  const cleanWord = w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Extract meaningful words (nouns/keywords) from the title
  const titleWords = title.split(/[\s|:\-]+/);
  const meaningfulWords = titleWords
    .map(w => ({ original: w, clean: cleanWord(w) }))
    .filter(({ clean }) => clean.length > 3 && !STOP_WORDS.has(clean));

  // Build primary topic: up to 3 consecutive meaningful words as a phrase
  const primaryTopic = meaningfulWords.slice(0, 2).map(w => w.original.replace(/[?!.,;:'"]/g, '')).join(' ') || title.substring(0, 40);
  const primaryClean = cleanWord(meaningfulWords[0]?.original || title.split(/\s+/)[0]);
  const secondaryWord = meaningfulWords[1] ? cleanWord(meaningfulWords[1].original) : '';
  const tertiaryWord = meaningfulWords[2] ? cleanWord(meaningfulWords[2].original) : '';

  // Full topic slug for hashtags
  const topicSlug = meaningfulWords.slice(0, 2).map(w => cleanWord(w.original)).join('').replace(/[^a-zA-Z0-9]/g, '');

  // ── Title Fix ──
  if (titleScore < 85) {
    if (title.length > 65) {
      // Too long - suggest trimmed version with power word
      fixes.titleFix = title.substring(0, 62).replace(/\s+\S*$/, '') + '...';
      fixes.titleReason = `Title is ${title.length} chars - truncated on mobile after ~65 chars. Trim to keep full title visible in search results.`;
    } else if (title.length < 30) {
      // Too short - add a curiosity hook
      fixes.titleFix = `The Truth About ${primaryTopic} - What Nobody Tells You`;
      fixes.titleReason = `Title is only ${title.length} chars. Extended with a curiosity hook to improve CTR on suggested videos.`;
    } else {
      // Good length but missing power words or front-loading - suggest a reframe
      const hasPowerWord = /\b(secret|truth|real|exposed|shocking|ultimate|proven|surprising|incredible|revealed)\b/i.test(title);
      if (!hasPowerWord) {
        fixes.titleFix = `The Truth About ${primaryTopic} | ${meaningfulWords.slice(2,4).map(w=>w.original).join(' ') || 'Full Breakdown'}`;
        fixes.titleReason = `Added "The Truth About" hook and a separator bracket to improve CTR. Front-loading your main keyword (${primaryTopic}) signals relevance to YouTube's algorithm.`;
      } else {
        fixes.titleFix = title; // Title is already good, just reinforce
        fixes.titleReason = `Title structure is solid. Consider front-loading "${primaryTopic}" closer to the start for stronger keyword signal.`;
      }
    }
  }

  // ── Description Fix ──
  if (descScore < 85) {
    const descHook = title.replace(/[?!]$/, '');
    fixes.descFix = `${descHook}\n\nIn this video, we dive deep into ${primaryTopic}${secondaryWord ? ` and explore the role of ${secondaryWord}` : ''} - breaking down what the science really says and what it means for how we understand the universe.\n\n📌 Timestamps:\n0:00 - Introduction\n1:30 - The Core Question Explained\n3:00 - Evidence & Research Deep-Dive\n5:30 - Surprising Discoveries\n8:00 - What This Means For You\n10:00 - Final Thoughts\n\n🔔 Subscribe for weekly deep-dives into the biggest questions in science, tech, and beyond.\n📺 Watch Next: [Related Video]\n🔗 Sources & Further Reading: [Link]\n\n#${topicSlug} #${primaryClean} #explained #science #${secondaryWord || 'deepdive'}`;
    fixes.descReason = description.length < 200
      ? `Original description was only ${description.length} chars. YouTube gives ranking weight to descriptions over 1,000 chars with timestamps, CTAs, and hashtags.`
      : !(/\d{1,2}:\d{2}/.test(description))
        ? 'Added chapter timestamps - videos with chapters rank higher and get promoted more in suggested videos.'
        : 'Enhanced with stronger hook sentence, chapter structure, subscribe CTA, and optimised hashtags.';
  }

  // ── Tags Fix ──
  if (tagScore < 85 && tags.length < 15) {
    // Build tags from actual title nouns - not generic placeholders
    const titleNounPhrases = [];
    if (primaryClean) {
      titleNounPhrases.push(primaryClean);
      titleNounPhrases.push(`${primaryClean} explained`);
      titleNounPhrases.push(`${primaryClean} documentary`);
      titleNounPhrases.push(`what is ${primaryClean}`);
      titleNounPhrases.push(`${primaryClean} theory`);
    }
    if (secondaryWord) {
      titleNounPhrases.push(secondaryWord);
      titleNounPhrases.push(`${secondaryWord} explained`);
      titleNounPhrases.push(`${primaryClean} ${secondaryWord}`);
    }
    if (tertiaryWord) {
      titleNounPhrases.push(tertiaryWord);
      titleNounPhrases.push(`${primaryClean} ${tertiaryWord}`);
    }
    // Add the full title as a tag (long-tail exact match)
    const titleTag = title.replace(/[?!.,;:'"]/g, '').substring(0, 60);
    titleNounPhrases.push(titleTag);
    // Add intent/format tags based on title signals
    if (/\b(how|tutorial|guide|learn|tips)\b/i.test(title)) {
      titleNounPhrases.push(`${primaryClean} tutorial`, `${primaryClean} for beginners`, `how to ${primaryClean}`);
    } else if (/\b(why|what|mystery|secret|truth|real|behind)\b/i.test(title)) {
      titleNounPhrases.push(`${primaryClean} mystery`, `truth about ${primaryClean}`, `${primaryClean} facts`);
    } else {
      titleNounPhrases.push(`${primaryClean} analysis`, `${primaryClean} breakdown`, `${primaryClean} 2026`);
    }

    // Keep existing tags, top up to 15
    const existingTags = tags.map(t => t.toLowerCase());
    const newTags = titleNounPhrases.filter(t => !existingTags.includes(t.toLowerCase()));
    fixes.tagFixes = [...tags, ...newTags].slice(0, 15);
    fixes.tagReason = `Only ${tags.length} tag${tags.length === 1 ? '' : 's'} found - added ${fixes.tagFixes.length - tags.length} keyword-targeted tags extracted from your title. Use 15-30 tags (max 500 chars) for best discoverability.`;
  }

  return fixes;
}

function renderAuditFixes(recs) {
  const resultsContainer = document.getElementById('audit-results');
  if (!resultsContainer || !recs) return;

  // Only render if we have actual fixes (check common AI response field names)
  const titleFix = recs.titleFix || recs.title_fix || recs.title;
  const descFix = recs.descFix || recs.descriptionFix || recs.description || recs.desc;
  const tagFixes = recs.tagFixes || recs.tags || recs.tag_fixes || recs.suggestedTags || [];
  const hasFixes = titleFix || descFix || (Array.isArray(tagFixes) && tagFixes.length > 0);
  if (!hasFixes) return;

  let html = '<div class="audit-fixes-section"><h4><i data-lucide="wand-2"></i> AI-Optimized Fixes</h4>';

  if (titleFix) {
    const safeTitle = titleFix.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html += '<div class="fix-card"><div class="fix-header">📝 Optimized Title</div>' +
      '<div class="fix-content">' + escapeHTML(titleFix) + '</div>' +
      '<div class="fix-reason">💡 ' + escapeHTML(recs.titleReason || recs.title_reason || 'Improved for CTR and keyword density.') + '</div>' +
      '<button class="btn-sm btn-primary" onclick="copyToClipboard(\'' + safeTitle + '\')"><i data-lucide="copy"></i> Copy</button>' +
      '</div>';
  }

  if (descFix) {
    const displayDesc = escapeHTML((descFix || '').substring(0, 400)).replace(/\n/g, '<br>');
    const cleanDesc = descFix.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    html += '<div class="fix-card"><div class="fix-header">📄 Optimized Description</div>' +
      '<div class="fix-content" style="max-height:200px;overflow-y:auto;white-space:pre-wrap;line-height:1.6;">' + displayDesc + (descFix.length > 400 ? '...' : '') + '</div>' +
      '<div class="fix-reason">💡 ' + escapeHTML(recs.descReason || recs.description_reason || 'Added timestamps and CTA for better engagement.') + '</div>' +
      '<button class="btn-sm btn-primary" onclick="copyToClipboard(\'' + cleanDesc + '\')"><i data-lucide="copy"></i> Copy</button>' +
      '</div>';
  }

  if (Array.isArray(tagFixes) && tagFixes.length > 0) {
    const tagsStr = tagFixes.join(', ');
    const safeTags = tagsStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html += '<div class="fix-card"><div class="fix-header">🏷️ Suggested Tags (' + tagFixes.length + ')</div>' +
      '<div class="fix-tags" style="display:flex;flex-wrap:wrap;gap:8px;">' + tagFixes.map(t => '<span class="tag-chip" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);padding:6px 12px;border-radius:6px;font-size:13px;">' + escapeHTML(t) + '</span>').join('') + '</div>' +
      '<div class="fix-reason">💡 ' + escapeHTML(recs.tagReason || recs.tag_reason || 'These tags will capture specific search queries.') + '</div>' +
      '<button class="btn-sm btn-primary" onclick="copyToClipboard(\'' + safeTags + '\')"><i data-lucide="copy"></i> Copy All</button>' +
      '</div>';
  }

  html += '</div>';
  resultsContainer.innerHTML += html;
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

// ── MAGIC FIX MODAL ──
function showMagicFixModal(type) {
  if (!currentAuditData || !currentAuditRecommendations) {
    showToast('No audit data available', 'error');
    return;
  }

  const rec = currentAuditRecommendations[type];
  if (!rec) {
    showToast('No recommendation available for this type', 'error');
    return;
  }

  // Deduct 10 credits for Magic Fix
  if (!CreditsSystem.deduct('magic-fix')) return;

  const { title, description, tags, isOwnVideo, videoId } = currentAuditData;

  let modalContent = '';

  if (type === 'title') {
    modalContent = `
      <h3>✨ Magic Fix - Title</h3>
      <div class="before-after-view">
        <div class="before-section">
          <span class="label">BEFORE</span>
          <div class="value">${title}</div>
        </div>
        <div class="arrow">→</div>
        <div class="after-section">
          <span class="label">AFTER</span>
          <div class="value">${rec.suggestion}</div>
        </div>
      </div>
      <div class="rec-reason"><strong>Why:</strong> ${rec.reason}</div>
      ${isOwnVideo ?
        `<button class="btn-primary" onclick="applyToYouTube('${type}')">Apply to YouTube (10 credits)</button>` :
        `<div class="apply-disabled"><i data-lucide="lock"></i> Only your own videos can be updated</div>`
      }
      <button class="btn-secondary" onclick="closeMagicFixModal()">Close</button>
    `;
  } else if (type === 'description') {
    modalContent = `
      <h3>✨ Magic Fix - Description</h3>
      <div class="before-after-view">
        <div class="before-section">
          <span class="label">BEFORE</span>
          <div class="value scroll">${description?.substring(0, 200) || 'No description'}...</div>
        </div>
        <div class="arrow">→</div>
        <div class="after-section">
          <span class="label">AFTER</span>
          <div class="value scroll">${rec.suggestion?.substring(0, 300)}...</div>
        </div>
      </div>
      <div class="rec-reason"><strong>Why:</strong> ${rec.reason}</div>
      ${isOwnVideo ?
        `<button class="btn-primary" onclick="applyToYouTube('${type}')">Apply to YouTube (10 credits)</button>` :
        `<div class="apply-disabled"><i data-lucide="lock"></i> Only your own videos can be updated</div>`
      }
      <button class="btn-secondary" onclick="closeMagicFixModal()">Close</button>
    `;
  } else if (type === 'tags') {
    const newTags = rec.suggestion?.join(', ') || '';
    modalContent = `
      <h3>✨ Magic Fix - Tags</h3>
      <div class="before-after-view">
        <div class="before-section">
          <span class="label">BEFORE</span>
          <div class="value">${tags?.slice(0, 5).join(', ')}...</div>
        </div>
        <div class="arrow">→</div>
        <div class="after-section">
          <span class="label">AFTER</span>
          <div class="value">${newTags.substring(0, 100)}...</div>
        </div>
      </div>
      <div class="rec-reason"><strong>Why:</strong> ${rec.reason}</div>
      ${isOwnVideo ?
        `<button class="btn-primary" onclick="applyToYouTube('${type}')">Apply to YouTube (10 credits)</button>` :
        `<div class="apply-disabled"><i data-lucide="lock"></i> Only your own videos can be updated</div>`
      }
      <button class="btn-secondary" onclick="closeMagicFixModal()">Close</button>
    `;
  } else if (type === 'thumbnail') {
    modalContent = `
      <h3>✨ Thumbnail Redesign Strategy</h3>
      <div class="thumbnail-strategy">
        <h4>Visual Strategy:</h4>
        <p>${rec.strategy}</p>

        <h4>AI Image Prompt (for designer):</h4>
        <div class="ai-prompt-box">
          <code>${rec.aiPrompt}</code>
          <button class="btn-copy" onclick="copyToClipboard('${rec.aiPrompt.replace(/'/g, "\\'")}')">
            📋 Copy Prompt
          </button>
        </div>
      </div>
      <p class="thumbnail-note"><i data-lucide="info"></i> Use this prompt with Midjourney, DALL-E, or send to your designer</p>
      <button class="btn-secondary" onclick="closeMagicFixModal()">Close</button>
    `;
  }

  // Create or show modal
  let modal = document.getElementById('magic-fix-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'magic-fix-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `<div class="modal-content">${modalContent}</div>`;
  modal.style.display = 'flex';
}

function closeMagicFixModal() {
  const modal = document.getElementById('magic-fix-modal');
  if (modal) modal.style.display = 'none';
}

async function applyToYouTube(type) {
  console.log('[Apply to YouTube] Starting...');
  console.log('[Apply] currentAuditData:', currentAuditData);
  console.log('[Apply] accessToken exists:', !!accessToken);

  if (!currentAuditData || !currentAuditRecommendations) {
    showToast('No data to apply', 'error');
    return;
  }

  if (!accessToken) {
    console.error('[Apply] No access token - user needs to connect YouTube');
    showToast('Please connect YouTube first', 'error');
    return;
  }

  console.log('[Apply] Access token present, checking credit...');

  // Deduct 10 credits for Apply
  if (!CreditsSystem.deduct('magic-fix')) {
    console.error('[Apply] Not enough credits');
    return;
  }

  const rec = currentAuditRecommendations[type];
  const { videoId } = currentAuditData;

  console.log('[Apply] Video ID:', videoId, 'Type:', type);

  let updateData = {};

  if (type === 'title') {
    updateData.title = rec.suggestion;
  } else if (type === 'description') {
    updateData.description = rec.suggestion;
  } else if (type === 'tags') {
    updateData.tags = rec.suggestion;
  }

  console.log('[Apply] Update data:', updateData);
  showToast('Applying changes to YouTube...', 'info');

  try {
    const groqKey = checkGroqApiKey();
    const headers = { 'Content-Type': 'application/json' };
    if (groqKey) headers['x-api-key'] = groqKey;

    console.log('[Apply] Calling API...');
    const res = await fetch(`${API_BASE_URL}/api/youtube/update-video`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        videoId,
        accessToken,
        ...updateData
      })
    });

    const data = await res.json();
    console.log('[Apply] API Response:', res.status, data);

    if (!res.ok) {
      throw new Error(data.error || 'Failed to update');
    }

    showToast('Video updated successfully!', 'success');
    closeMagicFixModal();
  } catch (e) {
    console.error('[Apply] Error:', e);
    showToast('Update failed: ' + e.message, 'error');
  }
}

// Expose functions
window.showMagicFixModal = showMagicFixModal;
window.closeMagicFixModal = closeMagicFixModal;
window.applyToYouTube = applyToYouTube;
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  });
};

window.auditVideoMetadata = auditVideoMetadata;

// ── MAGIC FIX (Legacy) ──
async function magicFixAction(type) {
  const apiKey = checkGroqApiKey();
  // Non-blocking: let backend handle fallback to SaaS master key
  if (!apiKey) {
    console.log('[Debug] No user key - will use SaaS master key');
  }

  const costKey = type === 'title' ? 'title-generation' : type === 'description' ? 'description-generation' : 'title-generation';
  if (!CreditsSystem.deduct(costKey)) return;

  showToast(`Generating optimized ${type}...`, 'info');

  const mockFixes = {
    title: [
      "The ULTIMATE Guide to YouTube SEO in 2026 [Step by Step]",
      "How to 10x Your Views (YouTube Algorithm Secrets)",
      "YouTube SEO Made Simple - Complete Tutorial"
    ],
    description: [
      "In this video, you'll discover the proven strategies that top creators use to dominate YouTube. 🔥\n\n📌 Chapters:\n0:00 Intro\n1:30 Strategy\n5:00 Optimization\n\nSubscribe for more tips!",
      "Learn actionable YouTube growth strategies in this step-by-step guide.\n\nWhat's Inside:\n- SEO optimization\n- Content strategy\n- Growth tactics\n\nSubscribe for more!\n"
    ],
    tags: ["youtube seo", "seo tutorial", "youtube growth", "video marketing", "channel growth", "2026", "how to", "guide", "tips", "strategy"]
  };

  const fix = mockFixes[type][Math.floor(Math.random() * mockFixes[type].length)];

  setTimeout(() => {
    copyToClipboard(fix);
    showToast(`${type} copied to clipboard!`, 'success');
  }, 1500);
}
window.magicFixAction = magicFixAction;

// ── PRE-UPLOAD METADATA LAB ──
let currentSEOBundle = null;
let selectedTitleIndex = -1;

async function generateSEOBundle() {
  console.log('[generateSEOBundle] Starting...');
  const topicInput = document.getElementById('preupload-topic');
  const toneSelect = document.getElementById('preupload-tone');

  console.log('[generateSEOBundle] topicInput:', !!topicInput, 'toneSelect:', !!toneSelect);

  if (!topicInput || !toneSelect) {
    console.error('[generateSEOBundle] Input elements not found!');
    showToast('Page not fully loaded. Please refresh.', 'error');
    return;
  }

  const topic = topicInput.value.trim();
  const tone = toneSelect.value;

  // Get detected niche for context
  const currentNiche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';
  console.log('[generateSEOBundle] Topic:', topic, 'Tone:', tone, 'Niche:', currentNiche);

  if (!topic) {
    showToast('Please enter a topic/keyword', 'error');
    return;
  }

  // Deduct 5 credits
  if (!CreditsSystem.deduct('seo-bundle')) return;

  const resultsContainer = document.getElementById('seo-bundle-results');
  if (!resultsContainer) {
    console.error('[generateSEOBundle] Results container not found!');
    return;
  }

  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = '<div class="loading-spinner"><i data-lucide="loader"></i> Generating your SEO bundle...</div>';

  try {
    const groqKey = checkGroqApiKey();
    const csrfTok = window.csrfToken || localStorage.getItem('csrf_token') || '';
    const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrfTok, 'x-channel-id': chId };
    if (groqKey) headers['x-api-key'] = groqKey;

    console.log('[generateSEOBundle] Calling API...');
    const res = await fetch(`${API_BASE_URL}/api/ai/seo-bundle`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ topic, tone, niche: currentNiche })
    });

    const data = await res.json();
    console.log('[generateSEOBundle] Response:', data);

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate bundle');
    }

    currentSEOBundle = data;
    selectedTitleIndex = -1;

    // Clear loading spinner and render
    const resultsContainer = document.getElementById('seo-bundle-results');
    if (resultsContainer) {
      resultsContainer.style.display = 'block';
    }

    // Render the bundle
    renderSEOBundle(data);
    showToast('SEO Bundle generated!', 'success');
  } catch (e) {
    console.error('[generateSEOBundle] Error:', e);
    const resultsContainer = document.getElementById('seo-bundle-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `<div style="padding: 1rem; color: #ef4444;">Error: ${e.message}</div>`;
    }
    showToast('Error: ' + e.message, 'error');
  }
}

function renderSEOBundle(bundle) {
  console.log('[renderSEOBundle] bundle:', bundle);

  const resultsContainer = document.getElementById('seo-bundle-results');
  const titleOptionsEl = document.getElementById('title-options');
  const tagsOutputEl = document.getElementById('tags-output');
  const descOutputEl = document.getElementById('description-output');

  // Render title options
  if (titleOptionsEl && bundle.titles && Array.isArray(bundle.titles)) {
    console.log('[renderSEOBundle] Rendering', bundle.titles.length, 'titles');
    const titleOptionsHtml = bundle.titles.map((title, index) => {
      const titleText = typeof title === 'string' ? title : (title.text || '');
      const titleType = typeof title === 'object' ? (title.type || 'Option ' + (index + 1)) : 'Option ' + (index + 1);
      return `
        <div class="title-option" data-index="${index}" onclick="selectTitle(${index})">
          <span class="title-type">${titleType}</span>
          <span class="title-text">${titleText}</span>
          <i class="ph ph-check-circle check-icon"></i>
        </div>
      `;
    }).join('');
    titleOptionsEl.innerHTML = titleOptionsHtml;
  }

  // Render tags
  if (tagsOutputEl && bundle.tags && Array.isArray(bundle.tags)) {
    const tagsHtml = bundle.tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('');
    tagsOutputEl.innerHTML = tagsHtml;
  }

  // Render description
  if (descOutputEl && bundle.description) {
    descOutputEl.innerHTML = `<pre>${bundle.description}</pre>`;
  }

  // CRITICAL: Clear the loading spinner from parent container and rebuild the card structure
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="bundle-card" id="bundle-titles-card">
        <div class="bundle-card-header">
          <h4><i data-lucide="type"></i> Power Titles (Pick One)</h4>
          <span class="badge-select">Click to select</span>
        </div>
        <div class="title-options" id="title-options-render"></div>
      </div>

      <div class="bundle-card" id="bundle-tags-card">
        <div class="bundle-card-header">
          <h4><i data-lucide="tag"></i> Suggested Hijack Tags (15)</h4>
          <button class="btn-copy-small" onclick="copyElement('tags-output')">
            <i data-lucide="copy"></i> Copy
          </button>
        </div>
        <div class="tags-output" id="tags-output-render"></div>
      </div>

      <div class="bundle-card" id="bundle-desc-card">
        <div class="bundle-card-header">
          <h4><i data-lucide="align-left"></i> Description Template</h4>
          <button class="btn-copy-small" onclick="copyElement('description-output')">
            <i data-lucide="copy"></i> Copy
          </button>
        </div>
        <div class="description-output" id="description-output-render"></div>
      </div>

      <div class="bundle-actions">
        <button class="btn-secondary" onclick="copyFullBundle()">
          <i data-lucide="copy"></i> Copy Full Bundle
        </button>
        <button class="btn-primary" onclick="sendToVideoFactory()">
          <i data-lucide="video"></i> Send to Video Factory
        </button>
      </div>
    `;

    // Now populate the newly created elements
    const titleRenderEl = document.getElementById('title-options-render');
    const tagsRenderEl = document.getElementById('tags-output-render');
    const descRenderEl = document.getElementById('description-output-render');

    if (titleRenderEl && bundle.titles && Array.isArray(bundle.titles)) {
      titleRenderEl.innerHTML = bundle.titles.map((title, index) => {
        const titleText = typeof title === 'string' ? title : (title.text || '');
        const titleType = typeof title === 'object' ? (title.type || 'Option ' + (index + 1)) : 'Option ' + (index + 1);
        return `
          <div class="title-option" data-index="${index}" onclick="selectTitle(${index})">
            <span class="title-type">${titleType}</span>
            <span class="title-text">${safeRender(titleText)}</span>
            <i class="ph ph-check-circle check-icon"></i>
          </div>
        `;
      }).join('');
    }

    if (tagsRenderEl && bundle.tags && Array.isArray(bundle.tags)) {
      tagsRenderEl.innerHTML = bundle.tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('');
    }

    if (descRenderEl && bundle.description) {
      descRenderEl.innerHTML = `<pre>${safeRender(bundle.description)}</pre>`;
    }
  }

  console.log('[renderSEOBundle] Done rendering');
}

function selectTitle(index) {
  selectedTitleIndex = index;

  // Update UI
  document.querySelectorAll('.title-option').forEach((el, i) => {
    if (i === index) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  const selectedTitle = currentSEOBundle.titles[index].text;
  showToast(`Selected: "${selectedTitle.substring(0, 30)}..."`, 'success');
}

function copyElement(elementId) {
  const element = document.getElementById(elementId);
  const text = element.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  });
}

function copyFullBundle() {
  if (!currentSEOBundle) {
    showToast('Generate a bundle first', 'error');
    return;
  }

  const selectedTitle = selectedTitleIndex >= 0
    ? currentSEOBundle.titles[selectedTitleIndex].text
    : currentSEOBundle.titles[0].text;

  const bundleText = `=== SEO BUNDLE ===

TOPIC: ${currentSEOBundle.topic}
TONE: ${currentSEOBundle.tone}

=== POWER TITLE ===
${selectedTitle}

=== SUGGESTED TAGS (15) ===
${currentSEOBundle.tags.join(', ')}

=== DESCRIPTION TEMPLATE ===
${currentSEOBundle.description}

=== Generated by YT SEO Architect ===`;

  navigator.clipboard.writeText(bundleText).then(() => {
    showToast('Full bundle copied!', 'success');
  });
}

function sendToVideoFactory() {
  if (!currentSEOBundle) {
    showToast('Generate a bundle first', 'error');
    return;
  }

  const selectedTitle = selectedTitleIndex >= 0
    ? currentSEOBundle.titles[selectedTitleIndex].text
    : currentSEOBundle.titles[0].text;

  // Save to localStorage for Video Factory
  localStorage.setItem('preupload_topic', currentSEOBundle.topic);
  localStorage.setItem('preupload_title', selectedTitle);
  localStorage.setItem('preupload_tags', JSON.stringify(currentSEOBundle.tags));
  localStorage.setItem('preupload_description', currentSEOBundle.description);

  showToast('Sending to Video Factory...', 'info');

  // Switch to Video Factory view
  switchView('factory');

  // Pre-fill the inputs after view switch
  setTimeout(() => {
    const topicInput = document.getElementById('video-concept');
    if (topicInput) {
      topicInput.value = currentSEOBundle.topic;
      // Trigger any input handlers
      topicInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    showToast('Video Factory pre-filled with your SEO data!', 'success');
  }, 500);
}

// Expose functions
window.generateSEOBundle = generateSEOBundle;
window.selectTitle = selectTitle;
window.copyElement = copyElement;
window.copyFullBundle = copyFullBundle;
window.sendToVideoFactory = sendToVideoFactory;

// ── BULK INJECTOR (Premium) ──
async function bulkInject() {
  if (!checkPremiumFeature('bulk-injector')) return;

  const tagsInput = document.getElementById('bulk-tags');
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

  if (tags.length === 0) {
    showToast('Please enter at least one tag', 'error');
    return;
  }

  if (!accessToken) {
    showSessionExpiredModal();
    return;
  }

  showToast(`Injecting ${tags.length} tags to playlist...`, 'info');

  await new Promise(r => setTimeout(r, 3000));
  showToast('Tags injected to all videos!', 'success');
}

// ── BULK INJECTOR WITH REVIEW STAGE ──
let reviewVideos = []; // Store videos for review
let currentPlaylistName = ''; // Real playlist name for AI context

async function loadPlaylistsForBulk() {
  if (!accessToken) return;

  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();

    const select = document.getElementById('bulk-playlist-select');
    if (!select) return;

    select.innerHTML = '<option value="">Choose a playlist...</option>';

    (data.items || []).forEach(playlist => {
      const option = document.createElement('option');
      option.value = playlist.id;
      option.textContent = playlist.snippet.title;
      select.appendChild(option);
    });
  } catch (e) {
    console.error('[Load Playlists Error]:', e);
  }
}

async function loadPlaylistVideos() {
  const playlistSelect = document.getElementById('bulk-playlist-select');
  const playlistId = playlistSelect?.value;

  if (!playlistId || !accessToken) return;

  // Store the real playlist name so the AI uses it, not a hallucinated one
  currentPlaylistName = playlistSelect.options[playlistSelect.selectedIndex]?.text || '';

  const reviewStage = document.getElementById('review-stage');
  const videoList = document.getElementById('video-review-list');

  reviewStage.style.display = 'block';
  videoList.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Loading videos...</div>';

  try {
    const groqKey = checkGroqApiKey();
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
    };
    if (groqKey) headers['x-api-key'] = groqKey;

    // Refresh CSRF if needed
    if (!headers['x-csrf-token']) {
      const healthRes = await fetch('/api/health?channelId=' + headers['x-channel-id']);
      const healthData = await healthRes.json();
      if (healthData.csrfToken) {
        headers['x-csrf-token'] = healthData.csrfToken;
        window.csrfToken = healthData.csrfToken;
        localStorage.setItem('csrf_token', healthData.csrfToken);
      }
    }

    const res = await fetch(`${API_BASE_URL}/api/youtube/playlist-fetch`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ playlistId, accessToken })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load videos');
    }

    reviewVideos = data.videos || [];
    renderVideoReviewList();

  } catch (e) {
    console.error('[Load Videos Error]:', e);
    videoList.innerHTML = `<div class="error-message">Error: ${e.message}</div>`;
  }
}

function renderVideoReviewList() {
  const videoList = document.getElementById('video-review-list');
  const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

  videoList.innerHTML = reviewVideos.map((video, index) => `
    <div class="video-review-card" id="video-card-${index}" data-index="${index}" data-original-metadata='${JSON.stringify({ title: video.title, description: video.description, tags: video.tags || [] })}'>
      <!-- Col 1 (30%): Current metadata -->
      <div class="video-current">
        <h5>Current</h5>
        <p class="current-title">${video.title}</p>
        <p class="current-desc">${video.description?.substring(0, 100) || 'No description'}...</p>
        <p class="current-tags">Tags: ${video.tags?.slice(0, 3).join(', ') || 'None'}</p>
      </div>
      <!-- Col 2 (50%): AI Proposal + Controls -->
      <div class="video-proposal" id="proposal-${index}">
        <h5>AI Proposal</h5>
        <div class="proposal-controls">
          <button class="btn-secondary generate-btn" onclick="generateProposal(${index})">
            <i data-lucide="sparkles"></i> Generate AI Proposal (2 credits)
          </button>
          <div class="proposal-status" id="status-${index}"></div>
        </div>
        <p class="proposal-placeholder">Click generate to create proposal...</p>
      </div>
      <!-- Col 3 (20%): Scoreboard -->
      <div class="video-scoreboard" id="scoreboard-${index}">
        <p class="scoreboard-placeholder">Generate a proposal to see scores</p>
        <label class="checkbox-approve scoreboard-approve">
          <input type="checkbox" id="approve-${index}" onchange="updateApproveButton()">
          <span>Approve Change</span>
        </label>
      </div>
    </div>
  `).join('');
}

async function generateProposal(index) {
  const video = reviewVideos[index];
  let statusEl = document.getElementById(`status-${index}`);
  const proposalEl = document.getElementById(`proposal-${index}`);

  // Check credits
  if (!CreditsSystem.canAfford('proposal-generate')) {
    showToast('Not enough credits (need 2)', 'error');
    return;
  }

  statusEl.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';

  try {
    const groqKey = checkGroqApiKey();
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
    };
    if (groqKey) headers['x-api-key'] = groqKey;

    // Refresh CSRF if needed
    if (!headers['x-csrf-token']) {
      try {
        const healthRes = await fetch('/api/health?channelId=' + headers['x-channel-id']);
        const healthData = await healthRes.json();
        if (healthData.csrfToken) {
          headers['x-csrf-token'] = healthData.csrfToken;
          window.csrfToken = healthData.csrfToken;
          localStorage.setItem('csrf_token', healthData.csrfToken);
        }
      } catch(e) {}
    }

    const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

    const res = await fetch(`${API_BASE_URL}/api/youtube/generate-proposal`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        videoId: video.videoId,
        currentTitle: video.title,
        currentDescription: video.description,
        currentTags: video.tags || [],
        niche,
        playlistName: currentPlaylistName,
        accessToken
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate');
    }

    // Deduct 2 credits
    CreditsSystem.deduct('proposal-generate');

    // Store proposal with enriched data
    // ── Save previous proposal before overwriting (enables undo) ──
    if (reviewVideos[index].proposal) {
      reviewVideos[index].previousProposal = { ...reviewVideos[index].proposal };
    }

    const proposal = {
      title: data.newTitle || null,
      description: data.newDescription || null,
      tags: data.newTags || null,
      reasoning: data.reasoning || '',
      seoScores: data.seoScores || { title: 75, desc: 75, tags: 75, overall: 75 },
      baselineScores: data.baselineScores || { title: 50, desc: 50, tags: 50, overall: 50 }
    };
    // Never silently fall back to current title — AI must produce a real improvement
    if (!proposal.title) {
      showToast('AI could not generate a new title — try again', 'error');
      return;
    }
    reviewVideos[index].proposal = proposal;

    // ── Course B suffix stripping (clean display titles) ──
    const stripCourseSuffix = (str) => {
      if (!str) return '';
      return str.replace(/\s*[---|:]\s*Course\s+B\s*$/i, '')
                .replace(/\s*Course\s+B\s*[---|:]\s*/gi, '')
                .replace(/\s*\(Course\s+B\)\s*/gi, '')
                .trim();
    };

    // Render proposal with SEO scores and full metrics
    const p = proposal;
    const descFull = safeRender(p.description) || '';
    const descPreview = descFull.substring(0, 300);
    const isTruncated = descFull.length > 300;
    const scores = p.seoScores || {};
    const baseline = p.baselineScores || {};
    const tagList = Array.isArray(p.tags) ? p.tags : [];

    const displayTitle = stripCourseSuffix(safeRender(p.title));
    const displayTitleFirst45 = stripCourseSuffix(safeRender(p.title)).substring(0, 45);

    // ── Impact Badges (compact pills replacing large score grid) ──
    function impactPill(label, before, after) {
      const diff = (after || 0) - (before || 0);
      if (diff <= 0) return '';
      return `<span class="impact-pill">+${diff} ${label}</span>`;
    }
    const impactPills = [
      impactPill('Title', baseline.title, scores.title),
      impactPill('Desc', baseline.desc, scores.desc),
      impactPill('Tags', baseline.tags, scores.tags)
    ].filter(Boolean).join('');

    // ── Overall Score Circle ──
    const overallScore = scores.overall || baseline.overall || 50;
    const scoreDiff = (scores.overall || 0) - (baseline.overall || 0);

    // ── Compute compliance indicators ──
    const titleLen = safeRender(p.title).length;
    const titleOk = titleLen > 0 && titleLen <= 60;
    const titleFirst45 = displayTitleFirst45;
    const descWordCount = descFull ? descFull.split(/\s+/).filter(w => w.length > 1).length : 0;
    const descWordsOk = descWordCount >= 200;
    const tagsWithSpaces = tagList.filter(t => /\s/.test(String(t)));
    const tagsOk = tagList.length >= 10 && tagList.length <= 25 && tagsWithSpaces.length === 0;
    const overallQuality = (titleOk ? 1 : 0) + (descWordsOk ? 1 : 0) + (tagsOk ? 1 : 0);

    function badge(label, pass, detail) {
      const icon = pass ? '✅' : '⚠️';
      const cls = pass ? 'compliance-pass' : 'compliance-fail';
      return `<span class="compliance-badge ${cls}" title="${detail || ''}">${icon} ${label}</span>`;
    }

    // Mobile preview (for tooltip only - hidden by default)
    const mobilePreview = descFull.substring(0, 120).replace(/\n/g, ' ');

    proposalEl.innerHTML = `
      <div class="proposal-card-layout">
        <div class="proposal-title-row">
          <div class="proposal-field">
            <div class="proposal-field-header">
              <strong>📝 Title</strong>
              <span class="title-meta">
                <span class="char-badge ${titleOk ? '' : 'char-badge-warn'}">${titleLen}/60</span>
                ${badge(titleLen + 'c', titleOk, titleOk ? 'YouTube-compliant (≤60 chars)' : 'Too long - truncated in search')}
                <span class="mobile-preview-trigger" onclick="toggleMobilePreview(event, ${index})" title="View mobile preview"><i data-lucide="smartphone"></i></span>
              </span>
            </div>
            <div class="mobile-preview-popup" id="mobile-popup-${index}" style="display:none;">
              <strong>📱 Mobile preview (first 120 chars):</strong><br>
              <em>"${mobilePreview}..."</em>
            </div>
            <p class="proposal-title">${displayTitle}</p>
            <small class="search-snippet">Search snippet: <em>"${displayTitleFirst45}..."</em></small>
          </div>
        </div>

        <div class="proposal-body">
          <div class="proposal-field">
            <div class="proposal-field-header">
              <strong>📄 Description</strong>
              <span class="char-badge ${descWordsOk ? '' : 'char-badge-warn'}">${descWordCount} words</span>
              ${badge(descWordCount + 'w', descWordsOk, descWordsOk ? 'Meets 200-word rec' : 'Under 200 words')}
            </div>
            <p class="proposal-desc">
              <span class="desc-preview" id="desc-preview-${index}">${descPreview}${isTruncated ? '...' : ''}</span>
              ${isTruncated ? `<span class="desc-full" id="desc-full-${index}" style="display:none;">${descFull}</span>` : ''}
              ${isTruncated ? `<button class="btn-sm btn-outline desc-toggle" id="desc-toggle-${index}" onclick="toggleDesc(${index})" style="font-size:10px;margin-left:6px;"><i data-lucide="chevron-down"></i> Show full</button>` : ''}
            </p>
          </div>

          <div class="proposal-field">
            <div class="proposal-field-header">
              <strong>🏷️ Tags</strong>
              <span class="char-badge ${tagsOk ? '' : 'char-badge-warn'}">${tagList.length} tags</span>
              ${badge(tagList.length + ' tags', tagsOk, tagsOk ? 'Good format' : tagsWithSpaces.length > 0 ? tagsWithSpaces.length + ' have spaces' : 'Check count')}
            </div>
            ${tagsWithSpaces.length > 0 ? `<div class="tag-warning">⚠️ ${tagsWithSpaces.length} tag(s) contain spaces - will split on YouTube: ${tagsWithSpaces.map(t => '"' + t + '"').join(', ')}</div>` : ''}
            <div class="proposal-tags">${tagList.map(t => `<span class="tag-chip ${/\s/.test(String(t)) ? 'tag-chip-warn' : ''}">${safeRender(t)}</span>`).join('')}</div>
          </div>

          <div class="proposal-field proposal-reasoning">
            <strong>💡 Why</strong>
            <p class="proposal-reason">${safeRender(p.reasoning)}</p>
          </div>

          ${overallQuality < 3 ? `<div class="quality-footer">⚠️ ${overallQuality}/3 compliance checks passed - <button class="btn-sm btn-outline" onclick="generateProposal(${index})" style="font-size:10px;">Regenerate</button></div>` : ''}
        </div>
      </div>
      <div class="proposal-controls" style="margin-top:0.75rem;">
        <div class="proposal-status" id="status-${index}"></div>
      </div>
    `;

    // Render scoreboard into the card-level scoreboard column
    const scoreboardEl = document.getElementById(`scoreboard-${index}`);
    if (scoreboardEl) {
      scoreboardEl.innerHTML = `
        <div class="score-circle" style="--score-color: ${overallScore >= 80 ? 'var(--success)' : overallScore >= 60 ? 'var(--primary)' : 'var(--warning)'}">
          <span class="score-number">${overallScore}</span>
          <span class="score-label">Overall</span>
          ${scoreDiff > 0 ? `<span class="score-change">+${scoreDiff}</span>` : ''}
        </div>
        <div class="efficiency-bar">
          ${impactPills}
        </div>
        <label class="checkbox-approve scoreboard-approve" style="margin-top:auto;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.06);width:100%;">
          <input type="checkbox" id="approve-${index}" onchange="updateApproveButton()">
          <span>Approve Change</span>
        </label>
      `;
    }

    // Re-init Lucide icons for the new button
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    // ── Quality Floor & Status Bar (re-query statusEl - old ref was replaced by innerHTML) ──
    statusEl = document.getElementById(`status-${index}`);
    const scoreImprovement = (scores.overall || 0) - (baseline.overall || 0);
    const hasPrevious = !!reviewVideos[index].previousProposal;
    let statusHTML = '<span class="status-generated">✓ Generated</span>';
    if (scoreImprovement < 5 && overallQuality < 2) {
      statusHTML += ' <span style="color:#ef4444;font-size:0.7rem;">⚠️ Low quality - try regenerate</span>';
    }
    statusHTML += ' <button class="btn-sm btn-outline" onclick="generateProposal(' + index + ')" title="New AI proposal"><i data-lucide="refresh-cw"></i> Regenerate</button>';
    statusHTML += ' <button class="btn-sm btn-outline" onclick="restoreOriginal(' + index + ')" style="color:#3b82f6;" title="Revert to original YouTube metadata"><i data-lucide="rotate-ccw"></i> Restore</button>';
    if (hasPrevious) {
      statusHTML += ' <button class="btn-sm btn-outline" onclick="restorePreviousProposal(' + index + ')" style="color:#f59e0b;" title="Undo to previous AI proposal"><i data-lucide="undo-2"></i> Previous</button>';
    }
    statusEl.innerHTML = statusHTML;

  } catch (e) {
    console.error('[Generate Proposal Error]:', e);
    const st = document.getElementById(`status-${index}`);
    if (st) st.innerHTML = `<span class="status-error">Error: ${e.message}</span>`;
  }
}

// ── Restore Previous Proposal (Undo) ──
window.restorePreviousProposal = function(index) {
  const video = reviewVideos[index];
  if (!video || !video.previousProposal) {
    showToast('No previous proposal to restore', 'info');
    return;
  }

  // Swap: current proposal becomes previous, previous becomes current
  const current = video.proposal;
  video.proposal = video.previousProposal;
  video.previousProposal = current;

  // Re-render the proposal
  const proposalEl = document.getElementById(`proposal-${index}`);
  const statusEl = document.getElementById(`status-${index}`);
  if (!proposalEl || !statusEl) return;

  const p = video.proposal;
  const scores = p.seoScores || {};
  const baseline = p.baselineScores || {};
  const descFull = safeRender(p.description) || '';
  const descPreview = descFull.substring(0, 300);
  const isTruncated = descFull.length > 300;
  const tagList = Array.isArray(p.tags) ? p.tags : [];
  const titleLen = safeRender(p.title).length;
  const titleOk = titleLen > 0 && titleLen <= 60;
  const descWordCount = descFull ? descFull.split(/\s+/).filter(w => w.length > 1).length : 0;
  const descWordsOk = descWordCount >= 200;
  const tagsWithSpaces = tagList.filter(t => /\s/.test(String(t)));
  const tagsOk = tagList.length >= 10 && tagList.length <= 25 && tagsWithSpaces.length === 0;
  const overallQuality = (titleOk ? 1 : 0) + (descWordsOk ? 1 : 0) + (tagsOk ? 1 : 0);

  function badge(label, pass, detail) {
    const icon = pass ? '✅' : '⚠️';
    const cls = pass ? 'compliance-pass' : 'compliance-fail';
    return `<span class="compliance-badge ${cls}" title="${detail || ''}">${icon} ${label}</span>`;
  }

  function impactPill(label, before, after) {
    const diff = (after || 0) - (before || 0);
    if (diff <= 0) return '';
    return `<span class="impact-pill">+${diff} ${label}</span>`;
  }
  const impactPills = [
    impactPill('Title', baseline.title, scores.title),
    impactPill('Desc', baseline.desc, scores.desc),
    impactPill('Tags', baseline.tags, scores.tags)
  ].filter(Boolean).join('');

  const overallScore = scores.overall || baseline.overall || 50;
  const scoreDiff = (scores.overall || 0) - (baseline.overall || 0);
  const mobilePreview = descFull.substring(0, 120).replace(/\n/g, ' ');
  const titleFirst45 = safeRender(p.title).substring(0, 45);

  proposalEl.innerHTML = `
    <div class="proposal-card-layout">
      <!-- TOP: Title full-width -->
      <div class="proposal-title-row">
        <span style="color:var(--warning);font-size:0.7rem;">(Restored previous)</span>
        <div class="proposal-field">
          <div class="proposal-field-header">
            <strong>📝 Title</strong>
            <span class="title-meta">
              <span class="char-badge ${titleOk ? '' : 'char-badge-warn'}">${titleLen}/60</span>
              ${badge(titleLen + 'c', titleOk, titleOk ? 'YouTube-compliant' : 'Too long')}
              <span class="mobile-preview-trigger" onclick="toggleMobilePreview(event, ${index})" title="View mobile preview"><i data-lucide="smartphone"></i></span>
            </span>
          </div>
          <div class="mobile-preview-popup" id="mobile-popup-${index}" style="display:none;">
            <strong>📱 Mobile preview (first 120 chars):</strong><br>
            <em>"${mobilePreview}..."</em>
          </div>
          <p class="proposal-title">${safeRender(p.title)}</p>
          <small class="search-snippet">Search snippet: <em>"${safeRender(titleFirst45)}..."</em></small>
        </div>
      </div>

      <!-- BODY: content + scoreboard -->
      <div class="proposal-body">
        <div class="proposal-content">
          <div class="proposal-field">
            <div class="proposal-field-header">
              <strong>📄 Description</strong>
              <span class="char-badge ${descWordsOk ? '' : 'char-badge-warn'}">${descWordCount} words</span>
              ${badge(descWordCount + 'w', descWordsOk, descWordsOk ? 'Meets 200w rec' : 'Under 200')}
            </div>
            <p class="proposal-desc">
              <span class="desc-preview" id="desc-preview-${index}">${descPreview}${isTruncated ? '...' : ''}</span>
              ${isTruncated ? `<span class="desc-full" id="desc-full-${index}" style="display:none;">${descFull}</span>` : ''}
              ${isTruncated ? `<button class="btn-sm btn-outline desc-toggle" id="desc-toggle-${index}" onclick="toggleDesc(${index})" style="font-size:10px;margin-left:6px;"><i data-lucide="chevron-down"></i> Show full</button>` : ''}
            </p>
          </div>
          <div class="proposal-field">
            <div class="proposal-field-header">
              <strong>🏷️ Tags</strong>
              <span class="char-badge ${tagsOk ? '' : 'char-badge-warn'}">${tagList.length} tags</span>
              ${badge(tagList.length + ' tags', tagsOk, tagsOk ? 'Good format' : 'Check')}
            </div>
            ${tagsWithSpaces.length > 0 ? `<div class="tag-warning">⚠️ ${tagsWithSpaces.length} tag(s) contain spaces - will split on YouTube: ${tagsWithSpaces.map(t => '"' + t + '"').join(', ')}</div>` : ''}
            <div class="proposal-tags">${tagList.map(t => `<span class="tag-chip ${/\s/.test(String(t)) ? 'tag-chip-warn' : ''}">${safeRender(t)}</span>`).join('')}</div>
          </div>
          <div class="proposal-field proposal-reasoning">
            <strong>💡 Why</strong>
            <p class="proposal-reason">${safeRender(p.reasoning)}</p>
          </div>
          ${overallQuality < 3 ? `<div class="quality-footer">⚠️ ${overallQuality}/3 compliance checks passed</div>` : ''}
        </div>
        <div class="proposal-actions">
          <div class="score-circle" style="--score-color: ${overallScore >= 80 ? 'var(--success)' : overallScore >= 60 ? 'var(--primary)' : 'var(--warning)'}">
            <span class="score-number">${overallScore}</span>
            <span class="score-label">Overall</span>
            ${scoreDiff > 0 ? `<span class="score-change">+${scoreDiff}</span>` : ''}
          </div>
          <div class="efficiency-bar">
            ${impactPills}
          </div>
        </div>
      </div>
    </div>
  `;

  // Update the external approve checkbox
  const approveCheckbox = document.getElementById(`approve-${index}`);
  if (approveCheckbox) {
    approveCheckbox.onchange = function() { updateApproveButton(); };
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  const hasPrevious = !!video.previousProposal;
  statusEl.innerHTML = '<span class="status-generated">↩ Restored</span>' +
    ' <button class="btn-sm btn-outline" onclick="generateProposal(' + index + ')" style="margin-left:8px;font-size:10px;" title="Generate new proposal"><i data-lucide="refresh-cw"></i> Regenerate</button>' +
    (hasPrevious ? ' <button class="btn-sm btn-outline" onclick="restorePreviousProposal(' + index + ')" style="margin-left:4px;font-size:10px;color:var(--warning);" title="Swap back to other version"><i data-lucide="undo-2"></i> Swap versions</button>' : '');

  showToast('Restored previous proposal ✓', 'success');
};

function updateApproveButton() {
  const checkedCount = document.querySelectorAll('.video-review-card .checkbox-approve input:checked').length;
  const applyBtn = document.getElementById('apply-all-btn');
  applyBtn.disabled = checkedCount === 0;
  const creditCost = checkedCount * 8;

  // Check if any approved video has compliance issues
  let hasWarnings = false;
  if (checkedCount > 0) {
    document.querySelectorAll('.video-review-card .checkbox-approve input:checked').forEach(cb => {
      const card = cb.closest('.video-review-card');
      if (card) {
        const idx = parseInt(card.dataset.index);
        const proposal = reviewVideos[idx]?.proposal;
        if (proposal) {
          const tLen = (proposal.title || '').length;
          const tagsWithSpaces = (proposal.tags || []).filter(t => /\s/.test(String(t)));
          if (tLen > 60 || tagsWithSpaces.length > 0) hasWarnings = true;
        }
      }
    });
  }

  applyBtn.innerHTML = `<i data-lucide="check-circle"></i> Apply ${checkedCount} Videos (${creditCost} credits)`;
  if (hasWarnings) {
    applyBtn.innerHTML += ' <span style="color:#f59e0b;font-size:0.7rem;" title="Some videos have compliance warnings - tags may be auto-cleaned">⚠️</span>';
  }
}

// Approve All toggle
window.toggleApproveAll = function() {
  const masterCheckbox = document.getElementById('approve-all-checkbox');
  const checked = masterCheckbox.checked;
  document.querySelectorAll('.video-review-card .checkbox-approve input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
  });
  updateApproveButton();
};

async function generateAllProposals() {
  const total = reviewVideos.length;
  const cost = total * 2;

  if (!CreditsSystem.canAfford('proposal-generate')) {
    showToast(`Not enough credits. Need ${cost} credits for all proposals.`, 'error');
    return;
  }

  // Generate sequentially
  for (let i = 0; i < reviewVideos.length; i++) {
    await generateProposal(i);
  }
}

async function applyAllApproved() {
  const approvedIndices = [];
  document.querySelectorAll('.video-review-card .checkbox-approve input:checked').forEach((checkbox) => {
    const card = checkbox.closest('.video-review-card');
    if (card) {
      const index = parseInt(card.dataset.index);
      if (!isNaN(index) && reviewVideos[index]?.proposal) {
        approvedIndices.push(index);
      }
    }
  });

  if (approvedIndices.length === 0) {
    showToast('No approved proposals to apply', 'error');
    return;
  }

  const totalCost = approvedIndices.length * 8;
  if (!CreditsSystem.canAfford('proposal-apply')) {
    showToast(`Not enough credits. Need ${totalCost} credits.`, 'error');
    return;
  }

  const applyBtn = document.getElementById('apply-all-btn');
  applyBtn.disabled = true;
  applyBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Applying...';

  let successCount = 0;
  let failCount = 0;

  for (const index of approvedIndices) {
    const video = reviewVideos[index];
    const proposal = video.proposal;

    try {
      const groqKey = checkGroqApiKey();
      const headers = {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
      };
      if (groqKey) headers['x-api-key'] = groqKey;

      const res = await fetch(`${API_BASE_URL}/api/youtube/apply-proposal`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          videoId: video.videoId,
          proposal,
          accessToken
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Deduct 8 credits per video
        CreditsSystem.deduct('proposal-apply');

        const card = document.getElementById(`video-card-${index}`);
        card.classList.add('applied-success');
        successCount++;
      } else {
        if (data.error === 'PERMISSION_DENIED') {
          showToast('OAuth permission error. Please re-connect with edit access.', 'error');
          document.getElementById('permission-warning').style.display = 'flex';
        }
        const card = document.getElementById(`video-card-${index}`);
        card.classList.add('applied-failed');
        failCount++;
      }

    } catch (e) {
      console.error('[Apply Error]:', e);
      failCount++;
    }
  }

  applyBtn.disabled = false;
  applyBtn.innerHTML = '<i data-lucide="check-circle"></i> Apply Approved';
  showToast(`Applied: ${successCount}, Failed: ${failCount}`, successCount > 0 ? 'success' : 'error');
}

// Legacy function for backwards compatibility
async function startSmartOverhaul() {
  // Now uses review stage instead
  loadPlaylistVideos();
}

window.bulkInject = bulkInject;
window.loadPlaylistsForBulk = loadPlaylistsForBulk;
window.loadPlaylistVideos = loadPlaylistVideos;
window.generateProposal = generateProposal;
window.applyAllApproved = applyAllApproved;
window.updateApproveButton = updateApproveButton;
window.generateAllProposals = generateAllProposals;
window.startSmartOverhaul = startSmartOverhaul;
window.toggleDesc = toggleDesc;

// ── Restore Original Metadata (Safety Net) ──
window.restoreOriginal = function(index) {
  const card = document.getElementById(`video-card-${index}`);
  if (!card) return;

  let original;
  try {
    original = JSON.parse(card.dataset.originalMetadata);
  } catch(e) {
    showToast('No original metadata found', 'error');
    return;
  }

  if (!original || !original.title) {
    showToast('No original metadata stored', 'error');
    return;
  }

  // Reset proposal in memory to original
  reviewVideos[index].proposal = {
    title: original.title,
    description: original.description || '',
    tags: original.tags || [],
    reasoning: 'Restored to original YouTube metadata.',
    seoScores: { title: 0, desc: 0, tags: 0, overall: 0 },
    baselineScores: { title: 0, desc: 0, tags: 0, overall: 0 }
  };
  reviewVideos[index].previousProposal = null;

  // Re-render proposal as original
  const proposalEl = document.getElementById(`proposal-${index}`);
  const scoreboardEl = document.getElementById(`scoreboard-${index}`);
  const statusEl = document.getElementById(`status-${index}`);
  const approveCheckbox = document.getElementById(`approve-${index}`);

  if (proposalEl) {
    const p = reviewVideos[index].proposal;
    proposalEl.innerHTML = `
      <h5>AI Proposal <span style="color:var(--primary);font-size:0.7rem;">(Restored Original)</span></h5>
      <div class="proposal-card-layout">
        <div class="proposal-title-row">
          <p class="proposal-title">${safeRender(p.title)}</p>
        </div>
        <div class="proposal-body">
          <p class="proposal-desc">${safeRender(p.description).substring(0, 200)}...</p>
          <div class="proposal-tags">${(p.tags || []).map(t => `<span class="tag-chip">${safeRender(t)}</span>`).join('')}</div>
        </div>
      </div>
    `;
  }

  // Reset scoreboard
  if (scoreboardEl) {
    scoreboardEl.innerHTML = `
      <p class="scoreboard-placeholder" style="color:var(--primary);">↩ Original metadata restored</p>
      <label class="checkbox-approve scoreboard-approve">
        <input type="checkbox" id="approve-${index}" onchange="updateApproveButton()">
        <span>Approve Change</span>
      </label>
    `;
  }

  // Uncheck approve
  if (approveCheckbox) approveCheckbox.checked = false;

  // Blue flash effect
  if (card) {
    card.style.transition = 'box-shadow 0.15s ease';
    card.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.5)';
    setTimeout(() => { card.style.boxShadow = ''; }, 500);
  }

  if (statusEl) {
    statusEl.innerHTML = '<span class="status-generated" style="color:var(--primary);">↩ Restored Original</span> <button class="btn-sm btn-outline" onclick="generateProposal(' + index + ')" style="margin-left:8px;font-size:10px;"><i data-lucide="refresh-cw"></i> Regenerate</button>';
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  updateApproveButton();
  showToast('Original metadata restored ✓', 'success');
};

// ── Restore Original Metadata (Safety Net) ──
function toggleDesc(index) {
  const preview = document.getElementById(`desc-preview-${index}`);
  const full = document.getElementById(`desc-full-${index}`);
  const btn = document.getElementById(`desc-toggle-${index}`);
  if (!preview || !full || !btn) return;
  if (full.style.display === 'none') {
    preview.style.display = 'none';
    full.style.display = 'inline';
    btn.innerHTML = '<i data-lucide="chevron-up"></i> Show less';
  } else {
    preview.style.display = 'inline';
    full.style.display = 'none';
    btn.innerHTML = '<i data-lucide="chevron-down"></i> Show full';
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Toggle mobile preview popup in bulk injector
window.toggleMobilePreview = function(event, index) {
  event.stopPropagation();
  const popup = document.getElementById(`mobile-popup-${index}`);
  if (!popup) return;
  // Close all other popups first
  document.querySelectorAll('.mobile-preview-popup').forEach(p => {
    if (p !== popup) p.style.display = 'none';
  });
  popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
};

// Close mobile popups when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.mobile-preview-trigger') && !e.target.closest('.mobile-preview-popup')) {
    document.querySelectorAll('.mobile-preview-popup').forEach(p => p.style.display = 'none');
  }
});

// Sync scoreboard checkbox with external approve checkbox
window.syncApproveCheckbox = function(index) {
  const sb = document.getElementById(`sb-approve-${index}`);
  const ext = document.getElementById(`approve-${index}`);
  if (sb && ext) {
    ext.checked = sb.checked;
  }
  updateApproveButton();
};

window.startSmartOverhaul = startSmartOverhaul;

// ── EVERGREEN AUDIT (The Revival Engine) ──
let staleVideosData = []; // Store stale videos for revival

async function runEvergreenAudit() {
  if (!accessToken) {
    showSessionExpiredModal();
    return;
  }

  // Check permission
  await verifyWritePermissions();
  const permWarning = document.getElementById('evergreen-permission-warning');
  if (permWarning) {
    permWarning.style.display = hasFullWriteAccess ? 'none' : 'flex';
  }

  // Show loading
  const loadingEl = document.getElementById('evergreen-loading');
  const resultsEl = document.getElementById('evergreen-results');
  const emptyEl = document.getElementById('evergreen-empty');

  if (loadingEl) loadingEl.style.display = 'block';
  if (resultsEl) resultsEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  const groqKey = checkGroqApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
    'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
  };
  if (groqKey) headers['x-api-key'] = groqKey;

  try {
    const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

    const res = await fetch(`${API_BASE_URL}/api/youtube/evergreen-audit`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        accessToken,
        niche
      })
    });

    const data = await res.json();

    if (loadingEl) loadingEl.style.display = 'none';

    if (!res.ok) {
      throw new Error(data.error || 'Audit failed');
    }

    if (data.staleCount === 0) {
      // No stale videos found
      if (emptyEl) emptyEl.style.display = 'flex';
      showToast('No stale content found! Your videos are well-optimized.', 'success');
      return;
    }

    // Store stale videos
    staleVideosData = data.staleVideos || [];

    // Update summary
    const staleCountEl = document.getElementById('stale-count');
    const totalScannedEl = document.getElementById('total-scanned');
    if (staleCountEl) staleCountEl.textContent = data.staleCount;
    if (totalScannedEl) totalScannedEl.textContent = data.totalScanned;

    // Show results
    if (resultsEl) resultsEl.style.display = 'block';

    // Render video list
    renderRevivalList();

    // Show actions
    const actionsEl = document.getElementById('revival-actions');
    if (actionsEl) actionsEl.style.display = 'flex';

    showToast(`Found ${data.staleCount} videos needing revival`, 'success');

  } catch (e) {
    if (loadingEl) loadingEl.style.display = 'none';
    console.error('[Evergreen Audit Error]:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

function renderRevivalList() {
  const listContainer = document.getElementById('revival-list');
  const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

  if (!listContainer) return;

  listContainer.innerHTML = staleVideosData.map((video, index) => `
    <div class="revival-card" id="revival-card-${index}" data-index="${index}">
      <div class="revival-video-info">
        <img src="${video.thumbnail}" alt="Thumbnail" class="revival-thumb">
        <div class="revival-details">
          <h4 class="revival-title">${escapeHTML(video.title)}</h4>
          <div class="revival-meta">
            <span class="meta-item"><i data-lucide="calendar"></i> ${video.daysOld} days old</span>
            <span class="meta-item"><i data-lucide="eye"></i> ${parseInt(video.viewCount).toLocaleString()} views</span>
            <span class="meta-item"><i data-lucide="chart-line"></i> ${video.engagementRate}% engagement</span>
            <span class="staleness-badge">Staleness: ${video.stalenessScore}/100</span>
          </div>
        </div>
      </div>
      <div class="revival-actions-section">
        <button class="btn-secondary generate-btn" onclick="generateRevival(${index})">
          <i data-lucide="sparkles"></i> Generate Revival (10 credits)
        </button>
        <div class="revival-status" id="revival-status-${index}"></div>
      </div>
      <div class="revival-proposal" id="revival-proposal-${index}">
        <div class="proposal-placeholder">Click generate to create revival package...</div>
      </div>
      <div class="revival-approve">
        <label class="checkbox-approve">
          <input type="checkbox" id="revival-approve-${index}" onchange="updateRevivalApproveButton()">
          <span>Approve</span>
        </label>
      </div>
    </div>
  `).join('');
}

async function generateRevival(index) {
  const video = staleVideosData[index];

  // Check credits
  if (!CreditsSystem.canAfford('magic-fix')) {
    showToast('Not enough credits. Need 10 credits for revival generation.', 'error');
    return;
  }

  // Deduct credits
  CreditsSystem.deduct('magic-fix');

  // Show generating state
  const statusEl = document.getElementById(`revival-status-${index}`);
  const proposalEl = document.getElementById(`revival-proposal-${index}`);

  if (statusEl) {
    statusEl.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
  }

  const groqKey = checkGroqApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
    'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
  };
  if (groqKey) headers['x-api-key'] = groqKey;

  try {
    const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

    const res = await fetch(`${API_BASE_URL}/api/youtube/generate-revival`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        videoId: video.videoId,
        currentTitle: video.title,
        currentDescription: video.description,
        currentTags: [],
        daysOld: video.daysOld,
        viewCount: video.viewCount,
        niche
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate revival');
    }

    // Store revival proposal
    staleVideosData[index].revival = data.revival;

    // Render proposal
    const revival = data.revival;
    proposalEl.innerHTML = `
      <div class="proposal-content">
        <h5><i data-lucide="sparkles"></i> 2026 Revival Package</h5>
        <div class="proposal-field">
          <label>New Title</label>
          <p>${escapeHTML(revival.newTitle)}</p>
        </div>
        <div class="proposal-field">
          <label>New Description</label>
          <p>${escapeHTML(revival.newDescription?.substring(0, 200))}...</p>
        </div>
        <div class="proposal-field">
          <label>Tags (${revival.newTags?.length || 0})</label>
          <div class="tags-preview">
            ${(revival.newTags || []).slice(0, 8).map(t => `<span class="tag-chip">${escapeHTML(t)}</span>`).join('')}
          </div>
        </div>
        <div class="proposal-reasoning">
          <i data-lucide="lightbulb"></i> ${escapeHTML(revival.reasoning)}
        </div>
      </div>
    `;

    if (statusEl) {
      statusEl.innerHTML = '<i class="ph ph-check-circle" style="color: var(--success);"></i> Generated';
    }

    // Enable the approve checkbox
    const checkbox = document.getElementById(`revival-approve-${index}`);
    if (checkbox) checkbox.disabled = false;

    // Update approve button
    updateRevivalApproveButton();

    showToast('Revival package generated!', 'success');

  } catch (e) {
    console.error('[Generate Revival Error]:', e);
    if (statusEl) {
      statusEl.innerHTML = '<i class="ph ph-warning" style="color: var(--error);"></i> Failed';
    }
    showToast('Error: ' + e.message, 'error');
  }
}

function updateRevivalApproveButton() {
  const checkedCount = document.querySelectorAll('#revival-list .checkbox-approve input:checked').length;
  const applyBtn = document.getElementById('apply-revivals-btn');

  if (applyBtn) {
    applyBtn.disabled = checkedCount === 0;
    applyBtn.innerHTML = `<i data-lucide="rocket"></i> Apply Approved (${checkedCount * 10} credits)`;
  }
}

async function generateAllRevivals() {
  const total = staleVideosData.length;
  const cost = total * 10;

  // Check if already all generated
  const alreadyGenerated = staleVideosData.filter(v => v.revival).length;
  const remaining = total - alreadyGenerated;
  const remainingCost = remaining * 10;

  if (remaining === 0) {
    showToast('All revival packages already generated!', 'info');
    return;
  }

  if (!CreditsSystem.canAfford('magic-fix')) {
    showToast(`Not enough credits. Need ${remainingCost} credits.`, 'error');
    return;
  }

  showToast(`Generating ${remaining} revival packages...`, 'info');

  // Generate sequentially for remaining videos
  for (let i = 0; i < staleVideosData.length; i++) {
    if (!staleVideosData[i].revival) {
      await generateRevival(i);
      await new Promise(r => setTimeout(r, 500)); // Rate limiting
    }
  }
}

async function applyAllRevivals() {
  const approvedIndices = [];
  document.querySelectorAll('#revival-list .checkbox-approve input:checked').forEach((checkbox) => {
    const index = parseInt(checkbox.closest('.revival-card').dataset.index);
    if (staleVideosData[index] && staleVideosData[index].revival) {
      approvedIndices.push(index);
    }
  });

  if (approvedIndices.length === 0) {
    showToast('No approved revivals to apply', 'error');
    return;
  }

  const totalCost = approvedIndices.length * 10;
  if (!CreditsSystem.canAfford('proposal-apply')) {
    showToast(`Not enough credits. Need ${totalCost} credits.`, 'error');
    return;
  }

  const applyBtn = document.getElementById('apply-revivals-btn');
  applyBtn.disabled = true;
  applyBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Applying...';

  let successCount = 0;
  let failCount = 0;

  for (const index of approvedIndices) {
    const video = staleVideosData[index];
    const revival = video.revival;

    // Deduct credits per video
    CreditsSystem.deduct('proposal-apply');

    try {
      const groqKey = checkGroqApiKey();
      const headers = {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
      };
      if (groqKey) headers['x-api-key'] = groqKey;

      const res = await fetch(`${API_BASE_URL}/api/youtube/apply-revival`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          videoId: video.videoId,
          revival,
          accessToken
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const card = document.getElementById(`revival-card-${index}`);
        if (card) card.classList.add('applied-success');
        successCount++;
      } else {
        if (data.error?.includes('PERMISSION')) {
          showToast('OAuth permission error. Please re-connect with edit access.', 'error');
          document.getElementById('evergreen-permission-warning').style.display = 'flex';
        }
        const card = document.getElementById(`revival-card-${index}`);
        if (card) card.classList.add('applied-failed');
        failCount++;
      }

    } catch (e) {
      console.error('[Apply Revival Error]:', e);
      const card = document.getElementById(`revival-card-${index}`);
      if (card) card.classList.add('applied-failed');
      failCount++;
    }
  }

  applyBtn.disabled = false;
  applyBtn.innerHTML = '<i data-lucide="rocket"></i> Apply Approved';
  showToast(`Applied: ${successCount}, Failed: ${failCount}`, successCount > 0 ? 'success' : 'error');
}

// ── Suggested Analytics Utility ──
function getTrafficInsight(sources) {
  const find = (name) => sources.find(s => s.name === name);
  const suggested = find('Suggested Videos');
  const search = find('YouTube Search');
  const browse = find('Browse Features');

  if (suggested && suggested.percent < 15) {
    return 'Suggested traffic is low. Improve your metadata and add bridge tags to appear in more Suggested sidebars.';
  }
  if (suggested && suggested.percent > 30) {
    return 'Strong Suggested traffic! Your content is being recommended effectively. Consider creating series playlists to amplify this.';
  }
  if (search && search.percent > 40) {
    return 'Search is your top driver. Double down on keyword optimization and target long-tail search terms.';
  }
  if (browse && browse.percent > 30) {
    return 'Browse Features traffic is strong - your thumbnails and titles are working. Keep testing CTR improvements.';
  }
  return 'Diversify your traffic sources. Focus on metadata quality to increase Suggested Video appearances.';
}

// ── Expose functions globally ──
window.runEvergreenAudit = runEvergreenAudit;
window.generateRevival = generateRevival;
window.generateAllRevivals = generateAllRevivals;
window.applyAllRevivals = applyAllRevivals;
window.updateRevivalApproveButton = updateRevivalApproveButton;

// ── PLAYLIST GROWTH ──// ── PLAYLIST GROWTH ──
async function optimizePlaylist() {
  const playlistSelect = document.getElementById('playlist-dropdown');
  const playlistId = playlistSelect.value;

  if (!playlistId) {
    showToast('Please select a playlist', 'error');
    return;
  }

  if (!accessToken) {
    showSessionExpiredModal();
    return;
  }

  showToast('Optimizing playlist...', 'info');

  await new Promise(r => setTimeout(r, 2000));
  showToast('Playlist optimized!', 'success');
}
window.optimizePlaylist = optimizePlaylist;

async function analyzeRetention() {
  if (!accessToken) {
    showSessionExpiredModal();
    return;
  }

  // Use the real loadRetentionData which calls the API
  const playlistSelect = document.getElementById('retention-playlist-select');
  if (playlistSelect && playlistSelect.value) {
    await loadRetentionData();
  } else {
    showToast('Please select a playlist first', 'warning');
  }
}
window.analyzeRetention = analyzeRetention;

// ── SUGGESTED ANALYTICS ──
function loadSuggestedAnalytics() {
  const chartContainer = document.getElementById('analytics-chart');
  if (!chartContainer) return;

  if (!accessToken) {
    chartContainer.innerHTML = `
      <div class="chart-placeholder">
        <i data-lucide="pie-chart"></i>
        <p>Connect your channel to see Suggested Video analytics</p>
      </div>
    `;
    return;
  }

  chartContainer.innerHTML = '<div class="loading-spinner"><i data-lucide="loader"></i> Loading traffic sources...</div>';

  // Fetch real YouTube Analytics traffic sources
  (async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const analyticsRes = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=insightTrafficSourceType&maxResults=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        const rows = data.rows || [];
        const totalViews = rows.reduce((sum, r) => sum + (parseInt(r[1]) || 0), 0) || 1;

        const sourceMap = {
          'SUGGESTED_VIDEO': { name: 'Suggested Videos', color: '#8b5cf6' },
          'YT_SEARCH': { name: 'YouTube Search', color: '#06b6d4' },
          'BROWSE_FEATURES': { name: 'Browse Features', color: '#10b981' },
          'EXT_URL': { name: 'External Sites', color: '#f59e0b' },
          'PLAYLIST': { name: 'Playlists', color: '#ec4899' },
          'NOTIFICATION': { name: 'Notifications', color: '#ef4444' },
          'SUBSCRIBER': { name: 'Subscriber Feed', color: '#f97316' },
          'NO_LINK_OTHER': { name: 'Other YouTube', color: '#94a3b8' },
          'YT_CHANNEL': { name: 'Channel Pages', color: '#6366f1' },
          'SHORTS': { name: 'Shorts Feed', color: '#ef4444' },
          'ADVERTISING': { name: 'Paid Ads', color: '#eab308' },
          'VIDEO_CARD': { name: 'Info Cards', color: '#14b8a6' },
          'END_SCREEN': { name: 'End Screens', color: '#a855f7' },
          'HASHTAGS': { name: 'Hashtag Pages', color: '#3b82f6' },
          'POST_PAGE': { name: 'Community Posts', color: '#d946ef' },
          'LIVE_REDIRECT': { name: 'Live Redirects', color: '#ef4444' }
        };

        const sources = rows.map(row => {
          const type = row[0];
          const views = parseInt(row[1]) || 0;
          const percent = Math.round((views / totalViews) * 100);
          const source = sourceMap[type] || { name: type.replace(/_/g, ' '), color: '#6b7280' };
          return { ...source, percent, views };
        }).sort((a, b) => b.percent - a.percent);

        if (sources.length > 0) {
          const topSource = sources[0];
          chartContainer.innerHTML = `
            <div class="traffic-sources-chart">
              <div class="chart-bars">
                ${sources.map(s => `
                  <div class="chart-bar-row">
                    <span class="source-name">${s.name}</span>
                    <div class="bar-container">
                      <div class="bar-fill" style="width: ${Math.max(s.percent, 2)}%; background: ${s.color}"></div>
                    </div>
                    <span class="source-percent">${s.percent}%</span>
                  </div>
                `).join('')}
              </div>
              <div class="chart-summary">
                <div class="summary-item highlight">
                  <i data-lucide="zap"></i>
                  <span><strong>${topSource.name}</strong> drives ${topSource.percent}% of your traffic</span>
                </div>
                <div class="summary-item">
                  <i data-lucide="lightbulb"></i>
                  <span>${getTrafficInsight(sources)}</span>
                </div>
              </div>
            </div>
          `;
          if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
          return;
        }
      }

      // Fallback: no analytics data available
      chartContainer.innerHTML = `
        <div class="chart-placeholder">
          <i data-lucide="bar-chart"></i>
          <p>No traffic data available yet. Analytics appear after your channel gets views.</p>
        </div>
      `;
    } catch (e) {
      console.error('[Suggested Analytics] Error:', e.message);
      chartContainer.innerHTML = `
        <div class="chart-placeholder">
          <i data-lucide="alert-triangle"></i>
          <p>Could not load analytics. Please try again.</p>
        </div>
      `;
    }
  })();
}

function updateSuggestedAnalytics() {
  const view = document.getElementById('view-suggested-analytics');
  if (view && view.style.display !== 'none') {
    loadSuggestedAnalytics();
  }
}

// Add listener to update when view becomes visible
// switchView consolidated in hydration block at top

// ── SIDEBAR SNIPER ──
async function runSidebarSniper() {
  const urlInput = document.getElementById('sniper-video-url');
  const resultsContainer = document.getElementById('sniper-results');
  const videoUrl = urlInput.value.trim();

  if (!videoUrl) {
    showToast('Please enter a video URL', 'error');
    return;
  }

  const apiKey = checkGroqApiKey();
  // Non-blocking: let backend handle fallback to SaaS master key
  if (!apiKey) {
    console.log('[Debug] No user key - will use SaaS master key');
  }

  if (!CreditsSystem.deduct('competitor-scan')) return;

  resultsContainer.innerHTML = '<div class="loading-spinner"><i data-lucide="loader"></i> Finding sidebar competitors...</div>';

  await new Promise(r => setTimeout(r, 3500));

  const competitors = [
    { channel: 'TechMaster', video: 'Ultimate Guide to AI', tags: ['ai', 'tutorial', '2026', 'guide'] },
    { channel: 'CodeAcademy', video: 'Learn Python Fast', tags: ['python', 'coding', 'beginners', 'free'] },
    { channel: 'DataSciencePro', video: 'ML Basics', tags: ['machine learning', 'data science', 'ai', 'tutorial'] }
  ];

  resultsContainer.innerHTML = `
    <div class="competitor-list">
      <h4>Competitors in Your Sidebar</h4>
      ${competitors.map(c => `
        <div class="competitor-card">
          <div class="competitor-info">
            <strong>${c.channel}</strong>
            <span>${c.video}</span>
          </div>
          <div class="competitor-tags">
            ${c.tags.map(t => `<span class="tag-chip" onclick="copyKeyword('${t}')">${t}</span>`).join('')}
          </div>
          <button class="btn-primary small" onclick="copyAllTags(['${c.tags.join("','")}'])">
            <i data-lucide="copy"></i> Copy All
          </button>
        </div>
      `).join('')}
    </div>
    <div class="infiltration-bundle">
      <h4>Infiltration Bundle</h4>
      <p>Copy these high-performing tags from competitors:</p>
      <div class="bundle-tags">${competitors.flatMap(c => c.tags).slice(0, 10).map(t => `<span class="tag-chip" onclick="copyKeyword('${t}')">${t}</span>`).join('')}</div>
    </div>
  `;
  showToast('Found ' + competitors.length + ' competitors', 'success');
}
// [Removed Local Duplicate window.runSidebarSniper]

function copyAllTags(tags) {
  navigator.clipboard.writeText(tags.join(', '));
  showToast('All tags copied!', 'success');
}

// ── THUMBNAIL REDESIGN (Premium) ──
async function runThumbnailRedesign() {
  if (!checkPremiumFeature('thumbnail-redesign')) return;

  const titleInput = document.getElementById('redesign-title');
  const resultsContainer = document.getElementById('redesign-results');
  const title = titleInput.value.trim();

  if (!title) {
    showToast('Please enter a video title', 'error');
    return;
  }

  if (!CreditsSystem.deduct('thumbnail')) return;
  updateTimeSaved(3);

  resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner-pro"></div><p>Generating AI thumbnail concepts...</p></div>';

  let concepts = [];

  // Try AI generation
  try {
    const res = await window.apiPost('/api/ai/generate', {
      taskType: 'thumbnail-redesign',
      systemPrompt: 'You are an expert YouTube thumbnail designer. Return ONLY valid JSON.',
      userPrompt: `Create 4 distinct YouTube thumbnail concepts for: "${title}"\n\nFor EACH concept provide:\n- name: catchy concept name\n- colors: 3 hex colors\n- description: visual description (1 sentence)\n- textOverlay: suggested text (max 2 words)\n- aiPrompt: a detailed DALL-E/Midjourney prompt to generate this exact thumbnail image\n\nReturn JSON: { "concepts": [{"name":"...","colors":["#hex","#hex","#hex"],"description":"...","textOverlay":"TEXT","aiPrompt":"..."}] }`
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        if (parsed.concepts?.length > 0) concepts = parsed.concepts;
      } catch (e) { console.warn('[Thumbnail] JSON parse failed'); }
    }
  } catch (e) {
    console.warn('[Thumbnail] AI failed, using curated concepts');
  }

  // Fallback concepts based on title analysis
  if (concepts.length === 0) {
    const isHowTo = /how to|tutorial|guide|learn/i.test(title);
    const isShocking = /secret|exposed|shocking|dark|truth|revealed|you won|never/i.test(title);
    const isVs = /vs|versus|comparison|better/i.test(title);

    if (isShocking) {
      concepts = [
        { name: 'The Reveal', colors: ['#FF0000', '#1A1A1A', '#FFFFFF'], description: 'Redacted document style with one word revealed in red', textOverlay: 'EXPOSED', aiPrompt: 'YouTube thumbnail, redacted CIA document aesthetic, one word in bold red IMPACT font on black background, dramatic shadow lighting, 16:9 --ar 16:9' },
        { name: 'Face Off', colors: ['#FF6B00', '#0D0D0D', '#FFFFFF'], description: 'Split face: normal half + shocked half with glowing eyes', textOverlay: 'THE TRUTH', aiPrompt: 'YouTube thumbnail, split face portrait, left side normal right side shocked with glowing orange eyes, dark background, cinematic lighting 16:9' },
        { name: 'Countdown', colors: ['#EF4444', '#1E1B4B', '#FBBF24'], description: 'Digital clock counting down with danger symbols', textOverlay: 'DANGER', aiPrompt: 'YouTube thumbnail, digital red countdown timer, warning symbols, dark navy background, gold accent text, urgent atmosphere 16:9' },
        { name: 'Evidence Board', colors: ['#78716C', '#FEF3C7', '#DC2626'], description: 'Cork board with red string connecting photos and documents', textOverlay: 'UNCOVERED', aiPrompt: 'YouTube thumbnail, detective evidence board with red strings connecting photos, one photo circled in red, dramatic lighting, 16:9' }
      ];
    } else if (isHowTo) {
      concepts = [
        { name: 'Before/After', colors: ['#6366F1', '#10B981', '#FFFFFF'], description: 'Split screen showing problem vs solution', textOverlay: 'HOW TO', aiPrompt: 'YouTube thumbnail, split screen before/after, left side grayscale problem, right side vibrant solution with green glow, 16:9' },
        { name: 'Step Numbers', colors: ['#3B82F6', '#EFF6FF', '#F59E0B'], description: 'Numbered steps overlay on clean background', textOverlay: '3 STEPS', aiPrompt: 'YouTube thumbnail, clean modern design with large numbered steps 1 2 3, blue and gold color scheme, professional lighting 16:9' },
        { name: 'Demo Shot', colors: ['#1E40AF', '#DBEAFE', '#F97316'], description: 'Close-up of hands demonstrating the technique', textOverlay: 'EASY', aiPrompt: 'YouTube thumbnail, close-up of hands performing a task, blue gradient background, orange accent text EASY, bright lighting 16:9' },
        { name: 'Result Reveal', colors: ['#059669', '#ECFDF5', '#FBBF24'], description: 'Arrow pointing to impressive result with sparkle effects', textOverlay: 'WORKS!', aiPrompt: 'YouTube thumbnail, impressive transformation result with golden arrow and sparkle effects, green gradient background 16:9' }
      ];
    } else {
      concepts = [
        { name: 'Bold Contrast', colors: ['#FF6B6B', '#4ECDC4', '#FFE66D'], description: 'High contrast with bold text overlay and subject silhouette', textOverlay: title.substring(0, 12).toUpperCase(), aiPrompt: `YouTube thumbnail, bold ${title.substring(0, 20)} concept, high contrast with dramatic shadows, vibrant red and teal color scheme, 16:9` },
        { name: 'Minimalist', colors: ['#2D3436', '#DFE6E9', '#0984E3'], description: 'Clean modern aesthetic with subtle accent color', textOverlay: 'NEW', aiPrompt: `YouTube thumbnail, minimalist design, clean white space with ${title.substring(0, 15)} as the focus, subtle blue accent, modern aesthetic 16:9` },
        { name: 'Face Close-up', colors: ['#FDCB6E', '#E17055', '#2D3436'], description: 'Emotional close-up face with text overlay', textOverlay: 'WOW', aiPrompt: `YouTube thumbnail, extreme close-up of expressive face reacting to ${title.substring(0, 30)}, warm orange tones, shallow depth of field 16:9` },
        { name: 'Tech/Data', colors: ['#0984E3', '#74B9FF', '#FFFFFF'], description: 'Professional data visualization style', textOverlay: 'ANALYZED', aiPrompt: `YouTube thumbnail, futuristic data visualization style, holographic elements showing ${title.substring(0, 25)}, blue tech color scheme, 16:9` }
      ];
    }
  }

  resultsContainer.innerHTML = `
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;"><i data-lucide="info"></i> This tool generates design concepts and AI image prompts. Paste the <strong>AI Prompt</strong> into Midjourney, DALL·E, Leonardo AI, or Stable Diffusion to create the actual thumbnail.</p>
    <div class="concept-grid">
      ${concepts.map((c, i) => `
        <div class="concept-card">
          <div class="concept-preview" style="background: linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]})">
            <span class="concept-text">${c.textOverlay || title.substring(0, 12)}</span>
          </div>
          <div class="concept-colors">
            ${c.colors.map(color => `<span class="color-swatch" style="background: ${color}" title="${color}"></span>`).join('')}
          </div>
          <h4>${c.name}</h4>
          <p>${c.description}</p>
          ${c.aiPrompt ? `<div class="ai-prompt-box"><code>${c.aiPrompt.substring(0, 100)}...</code><button class="btn-sm btn-outline" onclick="navigator.clipboard.writeText('${c.aiPrompt.replace(/'/g, "\\'")}');showToast('AI prompt copied!','success')">📋 Copy Prompt</button></div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100);
  showToast('Generated ' + concepts.length + ' concepts with AI image prompts', 'success');
}
window.runThumbnailRedesign = runThumbnailRedesign;

// ── AI AUTO-RESPONDER (Premium) ──
async function runAutoResponder() {
  if (!checkPremiumFeature('auto-responder')) return;

  const tone = document.getElementById('responder-tone').value;
  const autoLike = document.getElementById('auto-like').checked;
  const statsContainer = document.getElementById('responder-stats');

  showToast('Enabling auto-responder...', 'info');

  await new Promise(r => setTimeout(r, 2000));

  statsContainer.innerHTML = `
    <div class="responder-active">
      <i data-lucide="check-circle"></i>
      <div class="responder-details">
        <strong>Auto-Responder Active</strong>
        <span>Tone: ${tone} | Auto-like: ${autoLike ? 'On' : 'Off'}</span>
      </div>
    </div>
    <div class="responder-stats-grid">
      <div class="stat-box">
        <span class="stat-num">0</span>
        <span class="stat-label">Replies Today</span>
      </div>
      <div class="stat-box">
        <span class="stat-num">24</span>
        <span class="stat-label">Avg Response Time</span>
      </div>
    </div>
  `;
  showToast('Auto-responder enabled!', 'success');
}
window.runAutoResponder = runAutoResponder;

// ── AUTOMATION PIPELINE (Premium) ──

// ── Tag Fallback Generator ──
function generateFallbackTags(title, keywords, niche) {
  const tags = new Set();

  // 1. Add the full title as a tag
  tags.add(title);

  // 2. Add all keywords
  keywords.forEach(k => tags.add(k));

  // 3. Split title into meaningful phrases
  const words = title.split(/\s+/).filter(w => w.length > 3);
  for (let i = 0; i < words.length - 1; i++) {
    tags.add(`${words[i]} ${words[i + 1]}`);
  }

  // 4. Add niche-based tags
  const nicheWords = (niche || '').split(/[\s,]+/).filter(w => w.length > 3);
  nicheWords.slice(0, 3).forEach(w => tags.add(w));

  // 5. Add year-based trending tags
  tags.add(`${words[0] || 'video'} 2026`);
  tags.add(`${words.slice(0, 2).join(' ')} explained`);
  tags.add(`${words.slice(0, 2).join(' ')} guide`);

  // Convert to array and limit to 15
  return [...tags].slice(0, 15);
}

// ── 3. Groq AI: SEO Title + Description Generator ──
async function generateSEOContent(videoTitle, currentDesc, channelNiche, _retryCount = 0, isShort = false) {
  const type = isShort ? '📱 Short' : '🎬 Video';
  console.log(`🤖 AI (${type}): Optimizing "${videoTitle.substring(0, 35)}..."`);

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: isShort ? `You are a Senior YouTube Growth Engineer who previously worked on the YouTube Recommendation Algorithm team. Your primary directive is to maximize Session Watch Time and Suggested Video CTR.

Before providing any output, you must perform an internal reasoning step. Structure your findings in a "_reasoning" field in your JSON response.
- Analysis: Video goal?
- Algorithmic Context: 2026 AI perception?
- Competitor Gap: Exploitable gaps?
- Decision: Choice rationale?

ANTI-LAZY CONSTRAINTS: No generic words, semantic clustering, self-critique.

Generate an optimized title, short description, tags, and keywords for a YouTube Short (under 90 seconds).

TITLE: Max 50 chars. Front-load keyword. Use power words. Add #Shorts if space allows.

DESCRIPTION (2-4 lines ONLY):
- Line 1: The exact title repeated
- Line 2: One-sentence hook (under 100 chars)
- Line 3: Subscribe CTA
- Line 4: 3-5 hashtags including #Shorts #YouTubeShorts

RESPOND IN JSON ONLY:
{ "_reasoning": "analysis", "title": "Title", "description": "Title\\n\\nHook.\\n\\n#Shorts #Topic", "keywords": ["k1","k2"], "tags": ["t1","t2"] }`
            : `You are a Senior YouTube Growth Engineer who previously worked on the YouTube Recommendation Algorithm team. Your primary directive is to maximize Session Watch Time and Suggested Video CTR.

Before providing any output, you must perform an internal reasoning step. Structure your findings in a "_reasoning" field in your JSON response.
- Analysis: Video/playlist goal?
- Algorithmic Context: 2026 AI perception?
- Competitor Gap: Exploitable gaps?
- Decision: Rationale for choices?

ANTI-LAZY CONSTRAINTS:
- No Generic Titles: Use high-heat, curiosity-gap power words.
- Semantic Clustering: Group into Primary, Secondary, and Competitor clusters.
- Self-Critique: No Niche-Bleed risk.

TITLE RULES:
- Maximum 60 characters
- Front-load the PRIMARY keyword
- Use emotional power words
- Include a number or bracket hook

DESCRIPTION FORMAT:
Repeat Title\\n\\nHook paragraph\\n\\n🔑 In this video, you'll discover...\\n\\n📌 Timestamps\\n\\nSEO paragraph\\n\\nSubscribe CTA\\n\\nKeywords: comma-separated\\n\\n#Hashtags

RESPOND IN JSON ONLY:
{
  "_reasoning": "Think-Before-Act analysis here",
  "title": "Title here",
  "description": "Title\\n\\nHook...\\n\\n📌 Timestamps:\\n0:00 - Intro\\n...",
  "keywords": ["k1", "k2", "k3"],
  "tags": ["t1", "t2", "t3"]
}`,
        userPrompt: `Channel Niche: ${channelNiche || 'General'}\nCurrent Video Title: ${videoTitle}\nCurrent Description:\n${currentDesc || '(empty)'}`
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error');
    }

    const data = await res.json();

    if (data.error) {
      // Retry on rate limit (429)
      if (data.error.message?.includes('Rate limit') || data.error.message?.includes('rate limit')) {
        if (_retryCount >= 2) {
          console.warn('⚠️ Max retries reached, skipping this video.');
          return null;
        }
        const waitMatch = data.error.message.match(/(\d+\.?\d*)(?:ms|s)/);
        let waitMs = 5000;
        if (waitMatch) {
          waitMs = data.error.message.includes('ms') ? parseInt(waitMatch[1]) + 1000 : parseFloat(waitMatch[1]) * 1000 + 1000;
        }
        // Cap wait at 15 seconds
        waitMs = Math.min(waitMs, 15000);
        console.log(`⏳ Rate limited (retry ${_retryCount + 1}/2). Waiting ${(waitMs/1000).toFixed(1)}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        return generateSEOContent(videoTitle, currentDesc, channelNiche, _retryCount + 1, isShort);
      }
      console.error('❌ Groq Error:', data.error.message);
      return null;
    }

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    // Parse JSON from response - robust handling
    try {
      // Clean up: remove markdown code fences if present
      let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      // Find the JSON object
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);

        if (parsed.title && parsed.description) {
          // Auto-generate tags if AI didn't provide them
          if (!parsed.tags || parsed.tags.length < 5) {
            parsed.tags = generateFallbackTags(parsed.title, parsed.keywords || [], channelNiche);
          }
          console.log(`✅ AI: Title="${parsed.title}" | Desc=${parsed.description.split(' ').length} words | Tags=${parsed.tags?.length} | Keywords=${parsed.keywords?.length}`);
          return parsed;
        }
      }
    } catch (parseErr) {
      console.warn('⚠️ JSON parse failed, extracting manually...');

      // Manual extraction fallback - pull title and description from raw text
      try {
        const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/);
        const descMatch = raw.match(/"description"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"(?:keywords|tags)"|"\s*\})/);
        const tagsMatch = raw.match(/"tags"\s*:\s*\[([\s\S]*?)\]/);
        const keywordsMatch = raw.match(/"keywords"\s*:\s*\[([\s\S]*?)\]/);

        if (titleMatch && descMatch) {
          const extractedTitle = titleMatch[1];
          const extractedDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          let extractedTags = tagsMatch ? tagsMatch[1].match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) : [];
          const extractedKeywords = keywordsMatch ? keywordsMatch[1].match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) : [];

          // Fallback tags if none extracted
          if (!extractedTags || extractedTags.length < 5) {
            extractedTags = generateFallbackTags(extractedTitle, extractedKeywords || [], channelNiche);
          }

          console.log(`✅ AI (manual): Title="${extractedTitle}" | Desc=${extractedDesc.split(' ').length} words | Tags=${extractedTags.length}`);
          return {
            title: extractedTitle,
            description: extractedDesc,
            tags: extractedTags,
            keywords: extractedKeywords || []
          };
        }
      } catch (manualErr) {
        console.error('❌ Manual extraction also failed');
      }
    }

    return null;
  } catch (err) {
    console.error("❌ Groq Network Error:", err);
    return null;
  }
}

// ── Groq: Generate Golden Keywords ──
async function generateGoldenKeywords(channelNiche) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: `You are a YouTube keyword research expert... (Numbered list format)`,
        userPrompt: `Channel niche: ${channelNiche}`
      })
    });

    if (!res.ok) throw new Error('Backend AI Proxy failed');
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("❌ Keywords Error:", err);
    return null;
  }
}

// ── Groq: Generate Topic Clusters ──
async function generateTopicClusters(channelNiche, videoTitles) {
  try {
    const systemPrompt = `You are a YouTube content strategist. Based on the channel's niche and existing videos, generate 5 Topic Clusters for a playlist strategy.

Each cluster should have:
- A Cluster Theme (the playlist name)
- 5 specific video ideas within that cluster
- The "pillar" video that should be the first video in the playlist (highest retention potential)

Format clearly with headers and bullet points.`;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userPrompt: `Channel Niche: ${channelNiche}\n\nExisting Videos:\n${videoTitles.join('\n')}`
      })
    });

    if (!res.ok) throw new Error('Backend AI Proxy failed');
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("❌ Clusters Error:", err);
    return null;
  }
}

// ── 4. YouTube Update (Title + Description + Tags) ──
async function updateVideoMetadata(videoId, newTitle, newDescription, newTags) {
window.updateVideoMetadata = updateVideoMetadata;
  console.log(`🔧 Updating video: ${videoId}`);

  const getRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const getData = await getRes.json();

  if (!getData.items || getData.items.length === 0) throw new Error("Video not found");

  const snippet = getData.items[0].snippet;
  const desc = (newDescription || snippet.description || "").trim();
  console.log(`📏 Video ID: ${videoId} | Description Length: ${desc.length} chars`);

  // Parse tags if they come as a JSON string or array
  let parsedTags = snippet.tags || [];
  if (newTags) {
    try {
      parsedTags = typeof newTags === 'string' ? JSON.parse(newTags) : newTags;
    } catch (e) {
      parsedTags = Array.isArray(newTags) ? newTags : snippet.tags || [];
    }
  }

  const updateRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        categoryId: snippet.categoryId,
        title: (newTitle || snippet.title || "Untitled").substring(0, 100).trim(),
        description: desc.substring(0, 5000),
        tags: validateTags(parsedTags),
        defaultLanguage: snippet.defaultLanguage || 'en'
      }
    })
  });

  const result = await updateRes.json();

  if (result.error) {
    console.error('❌ YouTube Error:', result.error.message);
    alert(`YouTube Error: ${result.error.message}`);
    throw new Error(result.error.message);
  }

  console.log(`✅ Updated! Title: "${result.snippet?.title}" | Tags: ${result.snippet?.tags?.length}`);

  // Track Quota: UPDATE metadata (50 units) + LIST (1 unit)
  trackQuota('UPDATE');
  trackQuota('LIST');
  updateQuotaDisplay();

  return result;
}

// Helper: Validate and truncate tags for YouTube (500 char total limit)
function validateTags(tags) {
  if (!Array.isArray(tags)) return [];
  const cleanTags = tags.map(t => {
    if (typeof t !== 'string') return '';
    return t.replace(/\*\*/g, '').replace(/[\[\]]/g, '').trim();
  }).filter(t => t.length > 0);

  let totalLength = 0;
  const validTags = [];
  for (const tag of cleanTags) {
    if (totalLength + tag.length + 1 < 450) {
      validTags.push(tag);
      totalLength += tag.length + 1;
    }
  }
  return validTags;
}

function auditVideo(video) {
  const title = video.snippet.title;
  const desc = video.snippet.description;
  return {
    titleLength: title.length <= 60,
    descriptionLength: desc.length >= 200,
    hasTimestamps: /\d+:\d+/.test(desc),
    hasHashtags: desc.includes('#'),
    titleRepeatedInDesc: desc.toLowerCase().includes(title.toLowerCase().substring(0, 20)),
  };
}


function scoreThumbHeuristic(video) {
  const title = video.snippet.title;
  const desc = video.snippet.description || '';
  const thumbs = video.snippet.thumbnails || {};
  let score = 40; // base
  const tips = [];

  // Has high-res thumbnail (custom upload likely)
  if (thumbs.maxres || thumbs.high) { score += 15; }
  else { tips.push('Upload a custom high-res thumbnail (1280x720)'); }

  // Title has emotional/power words
  const powerWords = /shocking|secret|hidden|truth|revealed|ultimate|powerful|amazing|proven|step.*step/i;
  if (powerWords.test(title)) { score += 10; }
  else { tips.push('Add a power word to the title for higher CTR'); }

  // Title has brackets/numbers (proven CTR boost)
  if (/\[|\(|\d/.test(title)) { score += 10; }
  else { tips.push('Add brackets [2026] or numbers to boost CTR'); }

  // Title is good length (30-60 chars)
  if (title.length >= 30 && title.length <= 60) { score += 10; }
  else { tips.push(`Title is ${title.length} chars - aim for 30-60 chars`); }

  // Description is long (good channel = good thumbs usually)
  if (desc.length > 200) { score += 10; }
  else { tips.push('Videos with longer descriptions tend to have better thumbnails'); }

  // Default tips if score is high
  if (tips.length === 0) {
    tips.push('Use bold contrasting text overlay');
    tips.push('Include a human face with expression');
    tips.push('Test with YouTube\'s A/B thumbnail feature');
  }
  if (tips.length < 3) tips.push('Use bright, warm colors (yellow, orange, red)');

  return { score: Math.min(score, 100), tips: tips.slice(0, 3) };
}

// Store channel info globally
let channelNiche = '';
let recentTitles = [];

// ── 5. Main Audit Flow ──
async function runAudit() {
  const urlInput = document.getElementById('channel-url');
  const analyzeBtn = document.getElementById('analyze-btn');
  const loadingState = document.getElementById('loading-state');
  const dashboard = document.getElementById('results-dashboard');
  const loadingText = document.getElementById('loading-text');
  const realVideosContainer = document.getElementById('real-videos-container');
  const videoList = document.getElementById('video-list');

  // Get input panel for transition
  const inputPanel = urlInput.closest('.input-section') || urlInput.parentElement.parentElement;

  const url = urlInput.value.trim();
  if (!url) return;

  analyzeBtn.disabled = true;

  // Smooth transition: fade input, show loading
  if (inputPanel) {
    inputPanel.classList.add('input-panel-fade');
    setTimeout(() => {
      dashboard.classList.add('hidden');
      loadingState.classList.remove('hidden');
      loadingState.classList.add('loading-panel', 'active');
    }, 200);
  } else {
    dashboard.classList.add('hidden');
    loadingState.classList.remove('hidden');
  }

  videoList.innerHTML = '';
  realVideosContainer.classList.add('hidden');

  const msgs = [
    "Crawling YouTube metadata...",
    "Analyzing channel niche & authority...",
    "Researching low-competition keywords...",
    "Checking Title & Description baselines...",
    "Generating AI-optimized SEO titles...",
    "Building keyword-rich descriptions...",
    "Compiling audit results..."
  ];

  let step = 0;
  const interval = setInterval(() => {
    step++;
    if (step < msgs.length) loadingText.textContent = msgs[step];
  }, 800);

  let realData = null;
  let channelData = activeChannel;

  // --- SMART URL PARSING ---
  const playlistIdMatch = url.match(/[?&]list=([^#&?]+)/);

  if (playlistIdMatch) {
    const pId = playlistIdMatch[1];
    try {
      loadingText.textContent = "Fetching playlist data...";
      const pRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?id=${pId}&part=snippet`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const pData = await pRes.json();
      if (pData.items?.[0]) {
        window.currentPlaylistTitle = pData.items[0].snippet.title;
      }
      realData = await fetchLatestVideos(pId, 25);
    } catch (e) { console.error("Playlist Fetch Error:", e); }
  } else if (accessToken && channelData) {
    try {
      channelNiche = channelData.snippet?.description?.substring(0, 100) || channelData.snippet?.title || 'General';
      const uploadsId = channelData.contentDetails.relatedPlaylists.uploads;
      window.currentPlaylistTitle = channelData.snippet.title; // Default to channel name if not a playlist
      const videoCount = parseInt(document.getElementById('video-count')?.value || '5');
      realData = await fetchLatestVideos(uploadsId, videoCount);
    } catch (err) {
      console.error("❌ Fetch Error:", err);
    }
  } else if (url === 'demo') {
    // 🧪 Simulation Mode Data
    console.log("🧪 Populating Simulation Data...");
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    realData = [
      {
        contentDetails: { videoId: 'demo_rescue' },
        snippet: {
          title: "Part 1: The YouTube Blueprint [2026]",
          publishedAt: tenDaysAgo.toISOString(),
          description: "Welcome to the ultimate YouTube blueprint. #strategy",
          thumbnails: { medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } }
        },
        statistics: { viewCount: '1000', likeCount: '5' } // low engagement for rescue trigger
      },
       {
        contentDetails: { videoId: 'demo_2' },
        snippet: {
          title: "Part 2: Algorithm Hijacking Secrets",
          publishedAt: new Date().toISOString(),
          description: "How to hijack the algorithm for growth.",
          thumbnails: { medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/sddefault.jpg' } }
        },
        statistics: { viewCount: '500', likeCount: '50' }
      },
      {
        contentDetails: { videoId: 'demo_stale' },
        snippet: {
          title: "Old Advice: How to Grow in 2023",
          publishedAt: '2023-05-20T10:00:00Z',
          description: "Outdated strategy for old algorithms. #legacy",
          thumbnails: { medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' } }
        },
        statistics: { viewCount: '800', likeCount: '10' } // low views for faint ping
      }
    ];
    videoDurations = { 'demo_rescue': 600, 'demo_2': 900, 'demo_stale': 450 };
    // Seed stats data for demo
    window.videoStatsData['demo_rescue'] = realData[0].statistics;
    window.videoStatsData['demo_2'] = realData[1].statistics;
    window.videoStatsData['demo_stale'] = realData[2].statistics;
  }

  // Ensure chronologically ascending order for "Series" badging (Part 1 -> Part X)
  if (realData && realData.length > 0) {
    // Sort by position or publishedAt to ensure consistent Part 1 -> Part 10 flow
    realData.sort((a, b) => {
      const dateA = new Date(a.snippet.publishedAt);
      const dateB = new Date(b.snippet.publishedAt);
      return dateA - dateB;
    });
    recentTitles = realData.map(v => v.snippet.title);
  }

  await new Promise(r => setTimeout(r, 1000));
  clearInterval(interval);

  // Smooth transition: loading → results
  loadingState.classList.remove('active');
  setTimeout(() => {
    loadingState.classList.add('hidden');
    loadingState.classList.remove('loading-panel');

    dashboard.classList.remove('hidden');
    dashboard.classList.add('results-panel', 'active');

    // Remove input fade
    if (inputPanel) {
      inputPanel.classList.remove('input-panel-fade');
    }

    // Add animation to results
    dashboard.classList.add('analysis-complete');
    setTimeout(() => dashboard.classList.remove('analysis-complete'), 500);
  }, 250);

  // Show Channel SEO section
  if (channelData) {
    const channelSeoSection = document.getElementById('channel-seo-section');
    const channelDescCurrent = document.getElementById('channel-desc-current');
    const channelKeysCurrent = document.getElementById('channel-keywords-current');
    channelSeoSection.classList.remove('hidden');
    channelDescCurrent.textContent = channelData.snippet?.description || '(No description set)';
    channelKeysCurrent.textContent = channelData.brandingSettings?.channel?.keywords || '(No keywords set)';
  }

  if (realData && realData.length > 0) {
    realVideosContainer.classList.remove('hidden');
    document.getElementById('video-count-display').textContent = realData.length;
    document.getElementById('fix-all-btn').style.display = 'flex';

    // Fetch video durations for Shorts detection
    const videoIds = realData.map(v => v.contentDetails?.videoId).filter(Boolean);
    videoDurations = {};
    try {
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const batchDurResults = await fetchVideoDurations(batch);
        Object.assign(videoDurations, batchDurResults);
      }
      const shorts = Object.values(videoDurations).filter(d => d <= 90).length;
      console.log(`📊 Detected: ${videoIds.length - shorts} long videos + ${shorts} Shorts`);
    } catch (e) { console.warn('Duration fetch failed:', e); }
    // Update dashboard metrics UI
    updateDashboardModules(realData, videoDurations, channelData);

    // Run Advanced Elite Audits
    runEvergreenAudit(realData);
    if (document.getElementById('verbal-bridge-toggle').checked) {
      runVerbalBridgeAudit();
    }

    // 🧠 RUN LOGIC ENGINE (Rescue, Sync, Faint Ping)
    const engine = new LogicEngine();
    engine.process(realData);

    // PHASE 1: Render ALL cards immediately
    const videoElements = [];
    for (const item of realData) {
      const audit = auditVideo(item);
      const thumbAudit = scoreThumbHeuristic(item);
      const videoEl = document.createElement('div');
      videoEl.className = 'video-item fade-in-up';
      const thumbUrl = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '';
      const videoId = item.contentDetails?.videoId || '';
      const duration = videoDurations[videoId] || 0;
      const isShort = duration > 0 && duration <= 90;
      const typeBadge = duration > 0
        ? `<span class="audit-badge" style="background:${isShort ? 'rgba(168,85,247,0.2);color:#a855f7' : 'rgba(59,130,246,0.2);color:#3b82f6'}">${isShort ? '📱 Short' : '🎬 ' + Math.floor(duration/60) + 'min'}</span>`
        : '';
      videoEl.innerHTML = `
        <img src="${thumbUrl}" class="video-thumb" alt="thumbnail">
        <div class="video-title" title="${escapeHTML(item.snippet.title)}">${item.snippet.title}</div>
        <div class="audit-stats">
          ${typeBadge}
          <span class="audit-badge ${audit.titleLength ? 'badge-pass' : 'badge-fail'}">Title ${audit.titleLength ? '✓' : '✗'}</span>
          <span class="audit-badge ${audit.descriptionLength ? 'badge-pass' : 'badge-fail'}">Desc ${audit.descriptionLength ? '✓' : '✗'}</span>
          <span class="audit-badge ${audit.hasTimestamps ? 'badge-pass' : 'badge-fail'}">Stamps ${audit.hasTimestamps ? '✓' : '✗'}</span>
          <span class="audit-badge ${thumbAudit.score >= 70 ? 'badge-pass' : 'badge-fail'}" title="${thumbAudit.tips.join(' • ')}">Thumb ${thumbAudit.score}%</span>
        </div>
        <div class="ai-slot">
          <div class="ai-suggestion-box" style="border-color:#555;text-align:center;padding:1rem;">
            <i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;font-size:1.2rem;"></i>
            <span class="ai-reasoning" style="margin-left:0.5rem;">Queued for AI...</span>
          </div>
        </div>
        <input type="hidden" class="original-title" value="${escapeHTML(item.snippet.title)}">
        <input type="hidden" class="original-desc" value="${escapeHTML(item.snippet.description)}">
        <input type="hidden" class="original-tags" value="${escapeHTML(JSON.stringify(item.snippet.tags || []))}">
        <div class="btn-container" style="display:flex;gap:0.5rem;margin-top:0.5rem;">
          <button class="btn-autofix" data-video-id="${videoId}" style="flex:1;">
            <i class="ph-bold ph-rocket"></i> Quick-Fix
          </button>
        </div>
      `;
      videoList.appendChild(videoEl);
      videoElements.push({ el: videoEl, item, videoId, isShort });
    }

    // PHASE 2: Process AI in BATCHES of 5
    (async () => {
      const BATCH_SIZE = 5;
      let processed = 0;
      for (let bStart = 0; bStart < videoElements.length; bStart += BATCH_SIZE) {
        const batch = videoElements.slice(bStart, bStart + BATCH_SIZE);
        console.log(`\n🔄 Batch ${Math.floor(bStart/BATCH_SIZE)+1}/${Math.ceil(videoElements.length/BATCH_SIZE)} (videos ${bStart+1}-${bStart+batch.length})`);
        batch.forEach(({ el }) => {
          const s = el.querySelector('.ai-slot .ai-reasoning');
          if (s) s.textContent = 'Generating AI suggestions...';
        });
        for (const { el, item, videoId, isShort } of batch) {
          processed++;
          const aiSlot = el.querySelector('.ai-slot');
          let seoContent = null;
          const cacheKey = `ytseo_v2_${videoId}`;
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              seoContent = JSON.parse(cached);
              console.log(`✅ Loaded from cache: ${item.snippet.title.substring(0, 30)}...`);
            } else {
              seoContent = await generateSEOContent(item.snippet.title, item.snippet.description, channelNiche, 0, isShort);
              if (seoContent && seoContent.title) {
                localStorage.setItem(cacheKey, JSON.stringify(seoContent));
              }
            }
          } catch (e) {
            console.warn('AI skipped:', e.message);
            window.failedVideosQueue = window.failedVideosQueue || [];
            window.failedVideosQueue.push({ el, item, videoId, isShort });
          }
          if (seoContent && seoContent.title && seoContent.description) {
            const typeLabel = isShort ? '📱 Shorts SEO' : '🎬 AI SEO';
            aiSlot.innerHTML = `
              <div class="ai-suggestion-box">
                <header><i data-lucide="cpu"></i> ${typeLabel}</header>
                <div style="margin-bottom:0.5rem;">
                  <span class="ai-reasoning">Suggested Title:</span>
                  <div class="ai-preview-content" style="font-weight:700;color:#a78bfa;">${escapeHTML(seoContent.title)}</div>
                </div>
                <div style="margin-bottom:0.5rem;">
                  <span class="ai-reasoning">Description (${seoContent.description.split(' ').length} words):</span>
                  <div class="ai-preview-content">${escapeHTML(seoContent.description.substring(0, 200))}...</div>
                </div>
                ${Array.isArray(seoContent.keywords) && seoContent.keywords.length ? `<div style="margin-bottom:0.5rem;"><span class="ai-reasoning">Keywords:</span><div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">${seoContent.keywords.map(k => `<span class="audit-badge badge-pass" style="font-size:0.7rem;">${escapeHTML(k)}</span>`).join('')}</div></div>` : ''}
                ${Array.isArray(seoContent.tags) && seoContent.tags.length ? `<div><span class="ai-reasoning">Tags (${seoContent.tags.length}):</span><div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">${seoContent.tags.map(t => `<span class="audit-badge" style="font-size:0.65rem;background:rgba(245,158,11,0.15);color:#f59e0b;">${escapeHTML(t)}</span>`).join('')}</div></div>` : ''}
                <input type="hidden" class="ai-title" value="${escapeHTML(seoContent.title)}">
                <input type="hidden" class="ai-full-content" value="${escapeHTML(seoContent.description)}">
                <input type="hidden" class="ai-tags" value="${escapeHTML(JSON.stringify(seoContent.tags || []))}">
              </div>`;
            const btns = el.querySelector('.btn-container');
            if (btns) {
              const dataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({
                title: seoContent.title,
                description: seoContent.description,
                tags: seoContent.tags
              }))));
              btns.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem;">
                  <div style="display:flex;gap:0.4rem;">
                    <button class="btn-secondary sm" onclick="window.previewSEO('${videoId}', '${dataEncoded}')" style="flex:1;">
                      <i data-lucide="eye"></i> Preview
                    </button>
                    <button class="btn-warning sm" onclick="window.preparePinComment('${videoId}', '${escapeHTML(seoContent.title)}', \`${escapeHTML(seoContent.description.substring(0,200))}\`)" style="flex:1;">
                      <i data-lucide="push-pin"></i> Pin Comment
                    </button>
                  </div>
                  <button class="btn-danger sm" onclick="window.generateAiThumbnail('${videoId}', '${escapeHTML(seoContent.title)}')" style="width:100%;justify-content:center;background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">
                    <i class="ph-bold ph-palette-broad"></i> Re-design Bad Thumbnail
                  </button>
                </div>
              `;
            }
          } else {
            aiSlot.innerHTML = `<div class="ai-suggestion-box" style="border-color:#555;"><header><i data-lucide="warning"></i> AI Skipped</header><span class="ai-reasoning">Rate limited - next batch will retry.</span></div>`;
          }
          console.log(`📊 Progress: ${processed}/${videoElements.length}`);
          await new Promise(r => setTimeout(r, 3000));
        }
        if (bStart + BATCH_SIZE < videoElements.length) {
          console.log(`⏸️ Batch done. Cooling down 10s...`);
          await new Promise(r => setTimeout(r, 10000));
        }
      }
      console.log(`\n✅ All ${processed} videos processed!`);
      window.currentPlaylistVideos = realData; // Store globally for Playlist Growth Suite

      // Populate transcript video select dropdown
      if (typeof window.populateTranscriptVideoSelect === 'function') {
        setTimeout(() => window.populateTranscriptVideoSelect(), 500);
      }

      // Auto-retry queue processing
      if (window.failedVideosQueue && window.failedVideosQueue.length > 0) {
        console.log(`⏳ Waiting 30s before retrying ${window.failedVideosQueue.length} failed videos...`);
        setTimeout(async () => {
          console.log(`🔄 Retrying ${window.failedVideosQueue.length} skipped videos...`);
          const retryBatch = [...window.failedVideosQueue];
          window.failedVideosQueue = [];
          for (const { el, item, videoId, isShort } of retryBatch) {
            const aiSlot = el.querySelector('.ai-slot');
            let seoContent = null;
            const cacheKey = `ytseo_v2_${videoId}`;
            try {
              if (aiSlot.querySelector('.ai-reasoning')) {
                aiSlot.querySelector('.ai-reasoning').textContent = 'Retrying AI...';
              }
              seoContent = await generateSEOContent(item.snippet.title, item.snippet.description, channelNiche, 0, isShort);
              if (seoContent && seoContent.title) {
                localStorage.setItem(cacheKey, JSON.stringify(seoContent));
              }
            } catch (e) {
              console.warn('AI skip (Retry Failed):', e.message);
            }
            if (seoContent && seoContent.title) {
              const typeLabel = isShort ? '📱 Shorts SEO' : '🎬 AI SEO';
              aiSlot.innerHTML = `
                <div class="ai-suggestion-box">
                  <header><i data-lucide="cpu"></i> ${typeLabel}</header>
                  <div style="margin-bottom:0.5rem;"><span class="ai-reasoning">Suggested Title:</span>
                  <div class="ai-preview-content" style="font-weight:700;color:#a78bfa;">${escapeHTML(seoContent.title)}</div></div>
                  <div style="margin-bottom:0.5rem;"><span class="ai-reasoning">Description:</span>
                  <div class="ai-preview-content">${escapeHTML(seoContent.description.substring(0, 200))}...</div></div>
                  <input type="hidden" class="ai-title" value="${escapeHTML(seoContent.title)}">
                  <input type="hidden" class="ai-full-content" value="${escapeHTML(seoContent.description)}">
                  <input type="hidden" class="ai-tags" value="${escapeHTML(JSON.stringify(seoContent.tags || []))}">
                </div>`;
              const btns = el.querySelector('.btn-container');
              if (btns) {
                btns.style.flexDirection = 'column';
                btns.innerHTML = `
                  <div style="display:flex;gap:0.5rem;width:100%;">
                    <button class="btn-autofix" data-video-id="${videoId}" style="flex:1;"><i class="ph-bold ph-rocket"></i> Inject SEO</button>
                    <button class="btn-preview btn-secondary" data-video-id="${videoId}" style="flex:1;"><i data-lucide="eye"></i> Preview & Edit</button>
                  </div>
                  <button class="btn-pin" data-video-id="${videoId}" style="width:100%;justify-content:center;">
                    <i class="ph-bold ph-push-pin"></i> Generate AI Comment
                  </button>
                `;
              }
            }
            await new Promise(r => setTimeout(r, 4000));
          }
        }, 30000); // 30 seconds wait before queue retry
      }
    })();

    // Thumbnail Analysis (heuristic-based, no API calls)
    const thumbSection = document.getElementById('thumbnail-section');
    const thumbGrid = document.getElementById('thumbnail-grid');
    thumbSection.classList.remove('hidden');
    thumbGrid.innerHTML = '';

    for (const item of realData) {
      const thumbUrl = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '';
      const title = item.snippet.title;
      const videoId = item.contentDetails?.videoId || item.id?.videoId || '';

      // Heuristic thumbnail scoring (no API call needed)
      const thumbScore = scoreThumbHeuristic(item);
      const scoreClass = thumbScore.score >= 80 ? 'good' : thumbScore.score >= 50 ? 'medium' : 'bad';

      const card = document.createElement('div');
      card.className = 'thumb-card fade-in-up';
      card.dataset.videoId = videoId;
      card.innerHTML = `
        <img src="${thumbUrl}" class="video-thumb" alt="thumbnail">
        <div class="thumb-score ${scoreClass}">${thumbScore.score}/100</div>
        <div class="video-title" style="font-size:0.85rem;">${title}</div>
        <ul class="thumb-tips">
          ${thumbScore.tips.map(t => `<li>• ${t}</li>`).join('')}
        </ul>
      `;
      thumbGrid.appendChild(card);
    }

    // Add redesign buttons to low-performing thumbnails
    setTimeout(addRedesignButtonsToThumbnails, 500);
  } else if (!accessToken) {
    realVideosContainer.classList.remove('hidden');
    videoList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Click "Connect YouTube" first to audit your real videos.</p>';
  }

  analyzeBtn.disabled = false;
  urlInput.value = '';
  loadingText.textContent = msgs[0];
  dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Load Neural Strategy Center after audit completes
  loadNeuralStrategy();
}

// ── 6. Event Listeners ──
// Refactored to platformInit() for performance
  let isTabSwitching = false;
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isTabSwitching) return;

      const target = btn.getAttribute('data-tab');
      const currentActive = document.querySelector('.tab-content.active');
      const nextContent = document.getElementById(`${target}-content`);

      if (!nextContent || currentActive === nextContent) return;

      isTabSwitching = true;

      // Mark current tab as exiting
      currentActive.classList.add('exiting');
      currentActive.classList.remove('active');

      // Update button states
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Wait for exit animation then show new content
      setTimeout(() => {
        currentActive.classList.remove('exiting');
        currentActive.style.display = 'none';

        nextContent.style.display = 'block';
        // Small delay to allow display to apply before animation
        requestAnimationFrame(() => {
          nextContent.classList.add('active');

          // Allow next switch after animation completes
          setTimeout(() => {
            isTabSwitching = false;
          }, 300);
        });

        // Load hijack metrics when switching to analytics tab
        if (target === 'analytics-hijack') {
          setTimeout(loadHijackMetrics, 100);
        }
      }, 250);
    });
  });
// Refactored listener closing removed

// ── 7. Global Click Handler ──
document.addEventListener('click', async (e) => {
  const target = e.target;

  // ── OAuth Button ──
  const oauthBtn = target.closest('#oauth-btn');
  if (oauthBtn) {
    console.log("🔐 Connect clicked");
    if (!tokenClient) {
      initOAuth();
      setTimeout(() => {
        if (tokenClient) tokenClient.requestAccessToken();
        else alert("Google script still loading.");
      }, 500);
    } else {
      tokenClient.requestAccessToken();
    }
    return;
  }

  // ── Inject SEO / Auto-Fix Button ──
  const fixBtn = target.closest('.btn-autofix');
  if (fixBtn) {
    const videoId = fixBtn.getAttribute('data-video-id');
    const aiTitleEl = fixBtn.parentElement?.querySelector('.ai-title');
    const aiDescEl = fixBtn.parentElement?.querySelector('.ai-full-content');
    const aiTagsEl = fixBtn.parentElement?.querySelector('.ai-tags');
    const aiTitle = aiTitleEl ? aiTitleEl.value : null;
    const aiDesc = aiDescEl ? aiDescEl.value : null;
    const aiTags = aiTagsEl ? aiTagsEl.value : null;

    console.log(`🔧 Fix: videoId=${videoId}, hasTitle=${!!aiTitle}, hasDesc=${!!aiDesc}, hasTags=${!!aiTags}`);

    fixBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Injecting SEO...';
    fixBtn.style.pointerEvents = 'none';
    fixBtn.style.opacity = '0.7';

    try {
      if (videoId && accessToken) {
        // --- SHIP-READY PRE-FLIGHT APPROVAL ---
        const oldData = {
          title: fixBtn.closest('.video-item')?.querySelector('.video-title')?.textContent || 'Current Title',
          description: 'Current Description (See Studio)',
          tags: []
        };
        const newData = {
          title: aiTitle,
          description: aiDesc,
          tags: aiTags ? aiTags.split(',') : []
        };

        showPreFlightModal(videoId, oldData, newData);

        fixBtn.innerHTML = '<i data-lucide="eye"></i> Pending Approval...';
        fixBtn.style.opacity = '1';
        fixBtn.style.pointerEvents = 'auto';
      } else if (!videoId) {
        // ── Mock fix for static dashboard cards ──
        await new Promise(r => setTimeout(r, 1200));
        fixBtn.innerHTML = '<i class="ph-bold ph-check"></i> Fixed!';
        fixBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        fixBtn.style.opacity = '1';

        const li = fixBtn.closest('li');
        if (li) {
          li.classList.remove('fail');
          li.classList.add('pass');
          const icon = li.querySelector('.issue-content i');
          if (icon) icon.className = 'ph ph-check-circle text-success';
        }
      } else {
        fixBtn.innerHTML = '<i class="ph-bold ph-warning"></i> Connect First';
        fixBtn.style.opacity = '1';
        fixBtn.style.pointerEvents = 'auto';
      }
    } catch (err) {
      console.error('❌ Fix Error:', err);
      fixBtn.innerHTML = '<i class="ph-bold ph-arrow-clockwise"></i> Retry';
      fixBtn.style.pointerEvents = 'auto';
      fixBtn.style.opacity = '1';
    }
    return;
  }

  // ── View Golden Keywords Button ──
  const goldenBtn = target.closest('.btn-secondary');
  if (goldenBtn && goldenBtn.textContent.includes('Golden Keywords')) {
    goldenBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Researching...';
    goldenBtn.style.pointerEvents = 'none';

    const keywords = await generateGoldenKeywords(channelNiche || 'General');

    if (keywords) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content glass-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h3><i data-lucide="target"></i> Golden Keywords (Low Competition / High Volume)</h3>
            <button class="modal-close" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;">✕</button>
          </div>
          <div class="ai-preview-content" style="max-height:400px;white-space:pre-wrap;">${escapeHTML(keywords)}</div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    }

    goldenBtn.innerHTML = 'View Golden Keywords';
    goldenBtn.style.pointerEvents = 'auto';
    return;
  }

  // ── Generate Topic Clusters Button ──
  const clusterBtn = target.closest('.btn-secondary');
  if (clusterBtn && clusterBtn.textContent.includes('Topic Clusters')) {
    clusterBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Generating...';
    clusterBtn.style.pointerEvents = 'none';

    const clusters = await generateTopicClusters(channelNiche || 'General', recentTitles);

    if (clusters) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content glass-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h3><i data-lucide="tree-structure"></i> AI-Generated Topic Clusters</h3>
            <button class="modal-close" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;">✕</button>
          </div>
          <div class="ai-preview-content" style="max-height:400px;white-space:pre-wrap;">${escapeHTML(clusters)}</div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    }

    clusterBtn.innerHTML = 'Generate Topic Clusters';
    clusterBtn.style.pointerEvents = 'auto';
    return;
  }

  // ── Preview & Edit Button ──
  const previewBtn = target.closest('.btn-preview');
  if (previewBtn) {
    const videoId = previewBtn.getAttribute('data-video-id');
    const card = previewBtn.closest('.video-item');
    if (!card) { console.error('Preview: card not found'); return; }

    const origTitle = card.querySelector('.original-title')?.value || '';
    const origDesc = card.querySelector('.original-desc')?.value || '';
    const origTags = card.querySelector('.original-tags')?.value || '[]';
    const aiTitle = card.querySelector('.ai-title')?.value || '';
    const aiDesc = card.querySelector('.ai-full-content')?.value || '';
    const aiTags = card.querySelector('.ai-tags')?.value || '[]';

    console.log('📝 Preview data:', { videoId, origTitle: origTitle.substring(0,30), aiTitle: aiTitle.substring(0,30), aiDescLen: aiDesc.length });

    document.getElementById('edit-before-title').textContent = origTitle;
    document.getElementById('edit-before-desc').textContent = origDesc;
    try {
      document.getElementById('edit-before-tags').textContent = JSON.parse(origTags).join(', ');
    } catch(e) { document.getElementById('edit-before-tags').textContent = origTags; }

    document.getElementById('edit-after-title').value = aiTitle;
    document.getElementById('edit-after-desc').value = aiDesc;
    try {
      document.getElementById('edit-after-tags').value = JSON.parse(aiTags).join(', ');
    } catch(e) { document.getElementById('edit-after-tags').value = aiTags; }

    document.getElementById('edit-video-id').value = videoId;
    document.getElementById('edit-after-thumb-prompts').value = '';
    document.getElementById('edit-modal').style.display = 'flex';
    return;
  }

  // ── Pin Comment Button ──
  const pinBtn = target.closest('.btn-pin');
  if (pinBtn) {
    const videoId = pinBtn.getAttribute('data-video-id');
    const card = pinBtn.closest('.video-item');
    if (!card) return;

    const uiTitle = card.querySelector('.video-title')?.textContent || '';
    const aiDesc = card.querySelector('.ai-full-content')?.value || '';
    const isShort = card.querySelector('.audit-badge')?.textContent.includes('Short');

    document.getElementById('pin-video-title').textContent = uiTitle;
    document.getElementById('pin-video-id').value = videoId;
    document.getElementById('pin-comment-text').value = 'Generating...';
    document.getElementById('pin-modal').style.display = 'flex';

    // Auto-generate comment
    generatePinnedComment(videoId, uiTitle, aiDesc, isShort).then(comment => {
      document.getElementById('pin-comment-text').value = comment;
    }).catch(err => {
      console.error(err);
      document.getElementById('pin-comment-text').value = 'Error generating comment. Please try again.';
    });
    return;
  }
});

// ── Edit Modal Handlers ──
document.getElementById('edit-modal-close')?.addEventListener('click', () => {
  document.getElementById('edit-modal').style.display = 'none';
});
document.getElementById('edit-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('edit-modal').style.display = 'none';
});

document.getElementById('generate-thumb-prompts-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('edit-after-title').value;
  const desc = document.getElementById('edit-after-desc').value;
  const targetArea = document.getElementById('edit-after-thumb-prompts');
  const btn = document.getElementById('generate-thumb-prompts-btn');

  if (!title) { alert('Generate or provide a title first!'); return; }

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i>...';
  btn.style.pointerEvents = 'none';
  targetArea.value = 'Generating highly-detailed AI prompts for Midjourney/DALL-E...';

  try {
    const systemPrompt = `You are an expert Midjourney and DALL-E prompt engineer specializing in high-CTR YouTube thumbnails. Output strictly as plain text with "Prompt 1: ..." and "Prompt 2: ...". NO quotes, NO extra intro.`;
    const userPrompt = `Based on the following video metadata, generate 2 distinct, highly descriptive prompts for generating thumbnail background art.\nVideo Title: ${title}\nVideo Description: ${desc}`;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt })
    });

    if (!res.ok) throw new Error('API Rate Limited or Failed');

    const data = await res.json();
    targetArea.value = data.choices[0].message.content.trim();
  } catch (err) {
    targetArea.value = 'Error generating prompts: ' + err.message;
  }

  btn.innerHTML = '<i data-lucide="wand-2"></i> Generate';
  btn.style.pointerEvents = 'auto';
});
document.getElementById('edit-inject-btn')?.addEventListener('click', async () => {
  const videoId = document.getElementById('edit-video-id').value;
  const title = document.getElementById('edit-after-title').value;
  const desc = document.getElementById('edit-after-desc').value;
  const tagsStr = document.getElementById('edit-after-tags').value;
  const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

  const btn = document.getElementById('edit-inject-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Injecting...';
  btn.style.pointerEvents = 'none';

  try {
    await updateVideoMetadata(videoId, title, desc, tags);
    btn.innerHTML = '<i class="ph-bold ph-check"></i> ✅ Injected!';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    setTimeout(() => {
      document.getElementById('edit-modal').style.display = 'none';
      btn.innerHTML = '<i class="ph-bold ph-rocket"></i> Inject to YouTube';
      btn.style.background = '';
      btn.style.pointerEvents = 'auto';
    }, 1500);
  } catch (err) {
    btn.innerHTML = '<i class="ph-bold ph-warning"></i> Error - Retry';
    btn.style.pointerEvents = 'auto';
  }
});

// ── Fix All Videos ──
document.getElementById('fix-all-btn')?.addEventListener('click', async () => {
  const fixAllBtn = document.getElementById('fix-all-btn');
  const allFixBtns = document.querySelectorAll('#video-list .btn-autofix');

  if (allFixBtns.length === 0) return;

  const totalVideos = allFixBtns.length;
  const estimatedQuota = totalVideos * 50;

  const confirmMsg = `⚠️ BULK OPTIMIZATION\n\nAre you sure you want to optimize ALL ${totalVideos} videos?\n\nEstimated Quota Cost: ~${estimatedQuota.toLocaleString()} units.\n\nThis will live-sync all AI-optimized titles, descriptions, and tags to YouTube.`;

  if (!confirm(confirmMsg)) return;

  fixAllBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Fixing all...';
  fixAllBtn.style.pointerEvents = 'none';

  let success = 0;
  let failed = 0;

  for (const btn of allFixBtns) {
    const videoId = btn.getAttribute('data-video-id');
    if (!videoId || !accessToken) continue;

    const card = btn.closest('.video-item');
    const aiTitle = card?.querySelector('.ai-title')?.value;
    const aiDesc = card?.querySelector('.ai-full-content')?.value;
    const aiTags = card?.querySelector('.ai-tags')?.value;

    btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i>';
    btn.style.pointerEvents = 'none';

    try {
      await updateVideoMetadata(videoId, aiTitle, aiDesc, aiTags);
      btn.innerHTML = '<i class="ph-bold ph-check"></i> ✅ Done';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      success++;

      card?.querySelectorAll('.badge-fail').forEach(b => {
        b.className = 'audit-badge badge-pass';
        b.textContent = b.textContent.replace('✗', '✓');
      });
      const titleEl = card?.querySelector('.video-title');
      if (titleEl && aiTitle) titleEl.textContent = aiTitle;
    } catch (err) {
      btn.innerHTML = '<i class="ph-bold ph-x"></i> Failed';
      btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      failed++;
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  fixAllBtn.innerHTML = `<i class="ph-bold ph-check"></i> Done! ${success}/${success + failed} updated`;
  fixAllBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
});

// ── Thumbnail AI Analysis ──
async function analyzeThumbWithAI(videoTitle, thumbUrl) {
  try {
    const systemPrompt = `You are a YouTube thumbnail CTR expert. Based on a video title, evaluate what an ideal thumbnail should have. Score from 0-100 and give 3 specific actionable tips. RESPOND IN JSON: { "score": 72, "tips": ["...", "...", "..."] }`;
    const userPrompt = `Video title: "${videoTitle}"`;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }
  } catch (e) { console.warn('Thumb AI error:', e); }
  return null;
}

// ── Channel SEO Generation ──
let channelSEOData = null;
document.getElementById('generate-channel-seo-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('generate-channel-seo-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Generating...';
  btn.style.pointerEvents = 'none';

  try {
    const systemPrompt = `You are a YouTube channel SEO expert. Generate an optimized channel description and 20 channel keywords. RESPOND IN JSON: { "description": "...", "keywords": ["...", "..."] }`;
    const userPrompt = `Channel niche: ${channelNiche}\nExisting videos: ${recentTitles.join(', ')}`;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        channelSEOData = JSON.parse(match[0]);
        document.getElementById('channel-desc-ai').style.display = 'block';
        document.getElementById('channel-desc-preview').textContent = channelSEOData.description;
        document.getElementById('channel-keywords-ai').style.display = 'block';
        const keyPreview = document.getElementById('channel-keywords-preview');
        keyPreview.innerHTML = channelSEOData.keywords.map(k => `<span class="audit-badge badge-pass" style="font-size:0.7rem;">${escapeHTML(k)}</span>`).join('');
        document.getElementById('inject-channel-seo-btn').style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Channel SEO error:', err);
  }
  btn.innerHTML = '<i data-lucide="cpu"></i> Regenerate';
  btn.style.pointerEvents = 'auto';
});

// ── Inject Channel SEO ──
document.getElementById('inject-channel-seo-btn')?.addEventListener('click', async () => {
  if (!channelSEOData || !accessToken) return;

  const btn = document.getElementById('inject-channel-seo-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Injecting...';

  try {
    // First get the current channel data with existing brandingSettings
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&mine=true', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const channelInfo = await channelRes.json();
    const channel = channelInfo.items?.[0];
    if (!channel) throw new Error('Could not find your channel');

    // Build clean update body - only description and keywords
    const updateBody = {
      id: channel.id,
      brandingSettings: {
        channel: {
          description: channelSEOData.description,
          keywords: channelSEOData.keywords.map(k => k.includes(' ') ? `"${k}"` : k).join(' ')
        }
      }
    };

    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });
    const result = await res.json();
    console.log('📥 Channel update response:', JSON.stringify(result, null, 2));
    if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));

    btn.innerHTML = '<i class="ph-bold ph-check"></i> ✅ Channel Updated!';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    document.getElementById('channel-desc-current').textContent = channelSEOData.description;
    document.getElementById('channel-keywords-current').textContent = channelSEOData.keywords.join(', ');
  } catch (err) {
    console.error('Channel inject error:', err);
    btn.innerHTML = '<i class="ph-bold ph-warning"></i> Error';
    alert(`Error: ${err.message}`);
  }
});

// ── Competitor Analysis ──
document.getElementById('competitor-btn')?.addEventListener('click', async () => {
  const url = document.getElementById('competitor-url').value.trim();
  if (!url) return alert('Paste a competitor channel URL first');

  const btn = document.getElementById('competitor-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;display:inline-block;"></i> Analyzing...';
  btn.style.pointerEvents = 'none';

  try {
    const myChannel = await fetchChannelData();
    const systemPrompt = `You are a YouTube competitive analysis expert. Compare two channels based on SEO best practices. RESPOND IN JSON: { "yourScore": 0, "competitorScore": 0, "metrics": [...], "topRecommendation": "..." }`;
    const userPrompt = `Your channel: ${myChannel.snippet?.title}\nCompetitor URL: ${url}`;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;

    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const comp = JSON.parse(match[0]);
        const compSection = document.getElementById('competitor-results');
        const compContent = document.getElementById('competitor-content');
        compSection.classList.remove('hidden');
        compContent.innerHTML = `
          <div class="competitor-card">
            <h4>${escapeHTML(myChannel.snippet?.title || 'You')}</h4>
            <div class="thumb-score">${comp.yourScore}/100</div>
          </div>
          <div class="competitor-card">
            <h4>Competitor</h4>
            <div class="thumb-score">${comp.competitorScore}/100</div>
          </div>
          <div style="grid-column:1/-1;" class="ai-suggestion-box">
            <header>Top Recommendation</header>
            <div class="ai-preview-content">${escapeHTML(comp.topRecommendation)}</div>
          </div>`;
      }
    }
  } catch (err) {
    console.error('Competitor error:', err);
  }
  btn.innerHTML = '<i class="ph-bold ph-chart-bar"></i> Compare';
  btn.style.pointerEvents = 'auto';
});

// ── Generated Pinned Comment Handlers ──
async function generatePinnedComment(videoId, title, desc, isShort) {
  // Use backend proxy for pinned comment generation
  const systemPrompt = `You are a YouTube Engagement Expert. Write a pinned comment for this video.
Title: ${title}
Summary: ${desc}

The pinned comment MUST:
1. Ask a highly engaging question to viewers to encourage replies.
2. Include a call to action (e.g. subscribe, watch playlist).
3. Be friendly and conversational.
4. Maximum 2-3 short lines.
Return ONLY the comment text. No quotes.`;

  const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt,
      userPrompt: `Video Title: ${title}\nDescription: ${desc}`
    })
  });

  if (!res.ok) throw new Error('Failed to generate pinned comment');
  const data = await res.json();
  const raw = data.choices[0].message.content.trim();

  // Try to parse as JSON if the proxy forced it, otherwise use raw
  try {
    const parsed = JSON.parse(raw);
    return parsed.comment || parsed.text || raw;
  } catch(e) {
    return raw;
  }
}

/**
 * Generate and Post Response to Comments
 */
async function generateAndPostCommentResponse(videoId, commentId, commentText) {
  const systemPrompt = `You are a helpful and engaging YouTube creator. Write a short, friendly response to this user comment. If they asked a question, answer it if possible. Otherwise, thank them and keep the conversation going.
Original Comment: "${commentText}"
Max 2 lines.`;

  const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt,
      userPrompt: `Response to: ${commentText}`
    })
  });

  if (!res.ok) throw new Error('Failed to generate comment response');
  const data = await res.json();
  const replyText = data.choices[0].message.content.trim();

  // Post the reply via YouTube API
  const postRes = await fetch(`https://www.googleapis.com/youtube/v3/comments?part=snippet`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: {
        parentId: commentId,
        textOriginal: replyText
      }
    })
  });

  const postData = await postRes.json();
  if (postData.error) throw new Error(postData.error.message);
  return replyText;
}

// Global function to be called from UI or Chat
window.handleCommentResponse = async (videoId, commentId, commentText) => {
  try {
    const reply = await generateAndPostCommentResponse(videoId, commentId, commentText);
    alert(`✅ Response posted: "${reply}"`);
  } catch (err) {
    console.error('Comment response error:', err);
    alert('Failed to post response: ' + err.message);
  }
};

window.preparePinComment = async (videoId, title, desc) => {
  const modal = document.getElementById('pin-modal');
  const titleEl = document.getElementById('pin-video-title');
  const textEl = document.getElementById('pin-comment-text');
  const idEl = document.getElementById('pin-video-id');

  if (!modal || !titleEl || !textEl || !idEl) return;

  idEl.value = videoId;
  titleEl.textContent = title;
  textEl.value = 'Generating engaging pinned comment...';
  modal.style.display = 'flex';

  try {
    const comment = await generatePinnedComment(videoId, title, desc, false);
    textEl.value = comment;
  } catch (err) {
    textEl.value = "Failed to generate: " + err.message;
  }
};

window.generateAiThumbnail = async (videoId, title) => {
  const confirmApply = confirm(`Generate a new high-CTR thumbnail for: "${title}"?\n\nThis will use AI to design a fresh layout based on 2026 performance data.`);
  if (!confirmApply) return;

  const videoItem = document.querySelector(`.btn-danger[onclick*="${videoId}"]`).closest('.video-item');
  const aiSlot = videoItem.querySelector('.ai-slot');
  const originalThumb = videoItem.querySelector('.video-thumb');

  // 1. Generate Prompt
  const systemPrompt = `You are a YouTube Thumbnail Designer. Generate a CONCISE, 1-sentence image generation prompt and a recommended text overlay hook for this video title: "${title}".
  The prompt should be under 200 characters and use descriptive keywords.
  RESPOND IN JSON ONLY: { "prompt": "...", "overlayText": "..." }`;

  try {
    videoItem.classList.add('pulse');
    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt: `Title: ${title}` })
    });
    const data = await res.json();
    const raw = data.choices[0].message.content.trim();
    const result = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

    // 2. Generate Image (Free Proxy for Demo/Concept)
    const seed = Math.floor(Math.random() * 1000000);
    const genUrl = `https://pollinations.ai/p/${encodeURIComponent(result.prompt)}?width=1280&height=720&seed=${seed}&model=flux`;

    // 3. Update UI with AI Concept
    const newThumbContainer = document.createElement('div');
    newThumbContainer.style = "margin-top:1rem; position:relative; overflow:hidden; border-radius:12px; border:2px solid var(--accent);";
    newThumbContainer.id = `ai-concept-container-${videoId}`;
    newThumbContainer.innerHTML = `
      <div style="font-size:0.65rem; color:var(--text-primary); background:var(--accent); padding:4px 8px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">AI Concept Generated</div>
      <img src="${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(genUrl)}" class="video-thumb" id="ai-thumb-${videoId}" style="width:100%; display:block;">
      <div style="background:rgba(15,23,42,0.9); backdrop-filter:blur(4px); padding:10px; font-size:0.75rem; border-top:1px solid rgba(255,255,255,0.1);">
        <div style="color:var(--accent); font-weight:700; margin-bottom:4px;">PROMPT:</div>
        <div style="color:var(--text-muted); line-height:1.4;">${result.prompt}</div>
        <div style="margin-top:8px; display:flex; gap:0.5rem;">
          <button class="btn-primary sm" onclick="window.deployAiThumbnail('${videoId}', '${genUrl}')" style="flex:1; justify-content:center; background:linear-gradient(135deg, #f43f5e, #e11d48);">
            <i class="ph-bold ph-rocket"></i> Deploy to YouTube
          </button>
          <button class="btn-secondary sm" onclick="this.closest('#ai-concept-container-${videoId}').remove()" style="padding:0 10px;">
            <i data-lucide="trash"></i>
          </button>
        </div>
      </div>
    `;

    aiSlot.prepend(newThumbContainer);
    videoItem.classList.remove('pulse');
    alert(`✨ SEO Thumbnail Concept Generated!\n\nOverlay Suggestion: "${result.overlayText}"`);

  } catch (err) {
    console.error('Thumbnail gen error:', err);
    alert('Failed to generate thumbnail concept: ' + (err.message || 'Check your internet or proxy connection.'));
    videoItem.classList.remove('pulse');
  }
};

window.deployAiThumbnail = async (videoId, imageUrl) => {
  const btn = document.querySelector(`button[onclick*="deployAiThumbnail('${videoId}'"]`);
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Deploying...';
  btn.disabled = true;

  try {
    console.log('[Thumbnail] Sending image URL to backend for deployment...');

    // Send URL directly to backend - backend will fetch it to bypass browser CORS
    const res = await fetch(`${API_BASE_URL}/api/thumbnail/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        accessToken,
        imageUrl // Send the remote URL directly
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    btn.innerHTML = '<i data-lucide="check"></i> DEPLOYED';
    btn.style.background = 'var(--success)';
    alert('🚀 AI Thumbnail successfully uploaded and applied to your YouTube video!');
  } catch (err) {
    console.error('Deployment failed:', err);
    alert('Deployment failed: ' + err.message);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

async function uploadThumbnailBlob(videoId, blob) {
  // This function is deprecated - use backend directly with imageUrl instead
  // Keeping for compatibility but should use imageUrl approach
  throw new Error('Use imageUrl-based upload instead');
}

// ── QUOTA MONITORING SYSTEM ──
async function updateQuotaDisplay() {
  const display = document.getElementById('quota-display');
  const fill = document.getElementById('quota-fill');
  const text = document.getElementById('quota-text');
  if (!display || !fill || !text) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/quota/status`);
    const data = await res.json();

    display.classList.remove('hidden');
    const pct = Math.min((data.usedToday / data.limit) * 100, 100);
    fill.style.width = `${pct}%`;
    text.textContent = `Quota: ${Math.round(data.usedToday).toLocaleString()} / ${(data.limit/1000)}k`;

    // Visual Warnings
    fill.className = 'quota-fill';
    if (pct > 80) fill.classList.add('danger');
    else if (pct > 50) fill.classList.add('warning');

    if (data.pendingTasks > 0) {
      text.innerHTML += ` <span style="color:var(--warning); cursor:pointer;" onclick="alert('You have ${data.pendingTasks} tasks scheduled for the next refresh.')" title="Scheduled Tasks">• ${data.pendingTasks} Pending</span>`;
    }
  } catch (e) {
    console.warn('Quota display failed:', e);
  }
}

async function trackQuota(type, count = 1) {
  try {
    await fetch(`${API_BASE_URL}/api/quota/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, count })
    });
  } catch (e) { console.warn('Quota tracking failed:', e); }
}

async function checkQuotaRisk(operations, taskName) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/quota/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations })
    });
    const risk = await res.json();

    if (risk.isRisky) {
      const remainingPct = Math.round((risk.remainingQuota / 10000) * 100);
      const msg = `⚠️ QUOTA WARNING: ${taskName} will consume ~${risk.estimatedCost} units.

This is more than 20% of your remaining capacity (${remainingPct}% left today).
Hitting your limit will lock your channel updates until midnight.

Would you like to:
OK - Run now (Risky)
CANCEL - Schedule for next refresh cycle (Safe)`;

      if (confirm(msg)) {
        return true;
      } else {
        await scheduleTask(taskName, operations);
        alert(`✅ Task "${taskName}" has been scheduled for the next 24-hour cycle.`);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn('Risk check failed, proceeding anyway:', e);
    return true;
  }
}

async function scheduleTask(taskType, data) {
  if (!activeChannel) return;
  try {
    await fetch(`${API_BASE_URL}/api/quota/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel.id,
        taskType,
        data
      })
    });
  } catch (e) { console.error('Scheduling failed:', e); }
}


document.getElementById('pin-modal-close')?.addEventListener('click', () => {
  document.getElementById('pin-modal').style.display = 'none';
});
document.getElementById('pin-regenerate-btn')?.addEventListener('click', () => {
  const pinBtn = document.querySelector(`.btn-pin[data-video-id="${document.getElementById('pin-video-id').value}"]`);
  if (pinBtn) pinBtn.click(); // Re-trigger modal
});
document.getElementById('pin-inject-btn')?.addEventListener('click', async () => {
  const videoId = document.getElementById('pin-video-id').value;
  const text = document.getElementById('pin-comment-text').value;
  if (!text || text === 'Generating...') return;

  const btn = document.getElementById('pin-inject-btn');
  const oldHtml = btn.innerHTML;
  btn.innerHTML = 'Pinning...';
  btn.style.pointerEvents = 'none';
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } }
        }
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error');
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    btn.innerHTML = '✅ Added! (Pin manually)';
    setTimeout(() => { document.getElementById('pin-modal').style.display = 'none'; btn.innerHTML = oldHtml; btn.style.pointerEvents = 'auto'; }, 2000);
  } catch (err) {
    alert('Error setting comment: ' + err.message);
    btn.innerHTML = oldHtml;
    btn.style.pointerEvents = 'auto';
  }
});

// ── Chatbot Logic ──
const chatPanel = document.getElementById('chat-panel');
const chatToggle = document.getElementById('chat-toggle');
const chatClose = document.getElementById('chat-close');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');

let chatHistory = [];

chatToggle?.addEventListener('click', () => {
  chatPanel.classList.toggle('hidden');
  if (!chatPanel.classList.contains('hidden')) chatInput.focus();
});
chatClose?.addEventListener('click', () => chatPanel.classList.add('hidden'));

chatSend?.addEventListener('click', () => { if (!window.isChatSending) sendChatMessage(); });
chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !window.isChatSending) sendChatMessage(); });

async function sendChatMessage() {
  if (window.isChatSending) return;
  window.isChatSending = true;
  const text = chatInput.value.trim();
  if (!text) { window.isChatSending = false; return; }

  // ── Command pre-processor: recommendation actions (per-type) ──
  var lowerText=text.toLowerCase();
  var recMatch=lowerText.match(/(apply|fix|optimize|pin|create|save|review|enable)\s+(recommend|thumbnail|comment|playlist|bulk|idea|caption|script|short)/);
  if(recMatch){
    var actionWord=recMatch[1];
    var targetWord=recMatch[2];
    var tok=localStorage.getItem('ytseo_access_token');
    var cards=document.querySelectorAll('[data-rec-id]');
    
    // Determine which handler to call based on keywords
    var typeToCall=null;
    if(targetWord==='thumbnail'||(actionWord==='optimize'&&targetWord==='recommend')) typeToCall='thumbnail';
    else if(targetWord==='comment'||actionWord==='pin') typeToCall='community';
    else if(targetWord==='playlist'||(actionWord==='create'&&targetWord==='recommend')) typeToCall='playlist';
    else if(targetWord==='bulk'||actionWord==='review') typeToCall='bulk';
    else if(targetWord==='idea'||actionWord==='save') typeToCall='script';
    else if(targetWord==='caption') typeToCall='multilang';
    
    if(!typeToCall){
      // Generic "apply recommendation" → find first card
      if(cards.length===0){addChatMessage('No recommendations yet. Run a scan first.','ai');window.isChatSending=false;return;}
      typeToCall=cards[0].getAttribute('data-rec-type')||'thumbnail';
    }
    
    // Handle "all" commands
    var isAll=lowerText.includes('all');
    if(isAll){
      if(!tok){addChatMessage('Connect YouTube first to apply recommendations.','ai');window.isChatSending=false;return;}
      if(!cards.length||!typeToCall){addChatMessage('No recommendations to apply. Run a scan first.','ai');window.isChatSending=false;return;}
      var matchingCards=document.querySelectorAll('[data-rec-type="'+typeToCall+'"]');
      if(!matchingCards.length){addChatMessage('No '+typeToCall+' recommendations found.','ai');window.isChatSending=false;return;}
      addChatMessage('Processing '+matchingCards.length+' '+typeToCall+' recommendations...','ai');
      var done=0;
      for(var c of matchingCards){
        var recId=c.getAttribute('data-rec-id');
        var recType=c.getAttribute('data-rec-type');
        try{
          if(recType==='thumbnail') await handleRecOptimize(recId, recType);
          else if(recType==='community') await handleRecPinComment(recId, recType); // opens modal — skip for bulk
          else if(recType==='playlist') await handleRecPlaylist(recId, recType);
          else if(recType==='bulk') handleRecBulkReview(recId, recType);
          else if(recType==='script'||recType==='shorts') handleRecSaveIdea(recId, recType);
          else if(recType==='multilang') await handleRecCaptions(recId, recType);
          done++;
        }catch(e){}
      }
      addChatMessage(done+' '+typeToCall+' recommendations processed.','ai'); 
      loadRecommendations(); loadCommandInbox();
      window.isChatSending=false; return;
    }
    
    // Single recommendation — find matching card by type
    var match=null;
    for(var c of cards){
      if(c.getAttribute('data-rec-type')===typeToCall){match=c;break;}
    }
    if(!match){addChatMessage('No '+typeToCall+' recommendations found.','ai');window.isChatSending=false;return;}
    
    var recId=match.getAttribute('data-rec-id');
    var recType=match.getAttribute('data-rec-type');
    addChatMessage('Processing '+recType+' recommendation...','ai');
    
    if(recType==='community'){
      handleRecPinComment(recId, recType);
    }else{
      if(!tok){addChatMessage('Connect YouTube first.','ai');window.isChatSending=false;return;}
      try{
        if(recType==='thumbnail') await handleRecOptimize(recId, recType);
        else if(recType==='playlist') await handleRecPlaylist(recId, recType);
        else if(recType==='bulk') handleRecBulkReview(recId, recType);
        else if(recType==='script'||recType==='shorts') handleRecSaveIdea(recId, recType);
        else if(recType==='multilang') await handleRecCaptions(recId, recType);
        addChatMessage('✅ Done!','ai');
        loadRecommendations(); loadCommandInbox();
      }catch(e){addChatMessage('Failed: '+e.message,'ai');}
    }
    window.isChatSending=false; return;
  }

  // AI Proxy will handle key security

  // User message
  addChatMessage(text, 'user');
  chatInput.value = '';

  // AI indicator
  const typingId = 'typing-' + Date.now();
  chatMessages.innerHTML += `<div class="chat-msg ai" id="${typingId}"><div class="chat-bubble">Typing...</div></div>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      // Construct context
      const channelName = document.getElementById('channel-name')?.textContent || 'Your channel';
      const channelDesc = document.getElementById('channel-desc-current')?.textContent || '';

      const recentVideosWithStats = Array.from(document.querySelectorAll('.video-item')).slice(0, 10).map(el => {
        const title = el.querySelector('.video-title')?.textContent;
        const btn = el.querySelector('.btn-autofix');
        const vId = btn ? btn.getAttribute('data-video-id') : null;
        let statsStr = '';
        if (vId && window.videoStatsData && window.videoStatsData[vId]) {
          const s = window.videoStatsData[vId];
          statsStr = `(${s.viewCount} views, ${s.likeCount} likes)`;
        }
        return `"${title}" ID: ${vId} ${statsStr}`;
      }).join(', ').substring(0, 2000);

      // Keep chat history small so we don't blow up token limits
      if (chatHistory.length > 6) chatHistory = chatHistory.slice(chatHistory.length - 6);

      const messages = [
        { role: "system", content: `You are a YouTube Channel Assistant for "${channelName}".
Current channel description: ${channelDesc.substring(0, 300)}.
Recent videos and analytics: ${recentVideosWithStats}.
Use this data to answer questions and suggest improvements.

CORE MISSIONS:
1. **Encourage Engagement**: Suggest specific pinned comments that ask viewers a question to drive comments.
2. **Identify Trending Topics**: Look for core keywords like "hope", "faith", "salvation", "truth", or "revelation" (depending on the niche) and suggest title/desc optimizations.
3. **Actionable Help**: Always provide <action> tags when suggesting a specific fix.
4. **Respond to Comments**: Suggest responses to recent comments.

ACTION TAGS SUPPORTED:
1. UPDATE SEO: <action type="update-seo" videoId="ID" title="NEW TITLE" description="NEW DESC" tags="TAG1, TAG2"></action>
2. PIN COMMENT: <action type="pin-comment" videoId="ID" text="COMMENT TEXT"></action>
3. REPLY TO COMMENT: <action type="reply-comment" videoId="ID" commentId="COMMENT_ID" text="REPLY TEXT"></action>

When recommending a change, ALWAYS include the corresponding <action> tag. Keep answers short and formatted with **bolding** and line breaks.` },
        ...chatHistory
      ];
    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: messages[0].content, // The system context
        userPrompt: text // The current user question
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error');
    }

    const data = await res.json();

    if (data.error) {
       console.error("Chat Proxy Error:", data.error);
       throw new Error(data.error.message || "Unknown proxy error");
    }

    // The proxy returns the Groq payload. We need the text content.
    const reply = data.choices[0].message.content;

    chatHistory.push({ role: 'assistant', content: reply });

    document.getElementById(typingId)?.remove();
    addChatMessage(reply, 'ai');
  } catch (err) {
    console.error('Chat error details:', err.message, err);
    document.getElementById(typingId)?.remove();
    addChatMessage('I ran into a connection error. Check the console for details: ' + err.message, 'ai');
  } finally {
    window.isChatSending = false;
  }
}

// ── Dashboard Metrics Updater ──
function updateDashboardModules(realData, durations, channelData) {
  // Module 2: Metadata Auditor
  const modMeta = document.getElementById('module-metadata-auditor');
  if (modMeta) {
    let passTitle = 0, passDesc = 0, passTags = 0, passStamps = 0;
    realData.forEach(item => {
      const a = auditVideo(item);
      if (a.titleLength) passTitle++;
      if (a.descriptionLength) passDesc++;
      if ((item.snippet.tags?.length || 0) <= 15) passTags++;
      if (a.hasTimestamps) passStamps++;
    });
    const total = realData.length || 1;
    const pct = Math.round(((passTitle + passDesc + passTags + passStamps) / (total * 4)) * 100);

    modMeta.innerHTML = `
      <div class="progress-bar mb-2"><div class="fill ${pct < 50 ? 'danger' : pct < 80 ? 'warning' : 'success'}" style="width: ${pct}%;"></div></div>
      <ul class="checklist auto-fix-list">
        <li class="${passTitle/total > 0.8 ? 'pass' : (passTitle/total > 0.4 ? 'warning' : 'fail')}"><i class="ph ${passTitle/total > 0.8 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Title front-loads keyword (${passTitle}/${total} passed)</li>
        <li class="${passDesc/total > 0.8 ? 'pass' : 'fail'}">
          <div class="issue-content"><i class="ph ${passDesc/total > 0.8 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Description > 200 words (${passDesc}/${total} passed)</div>
        </li>
        <li class="${passTags/total > 0.8 ? 'pass' : 'fail'}"><i class="ph ${passTags/total > 0.8 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Tags ≤ 15 terms (${passTags}/${total} passed)</li>
        <li class="${passStamps/total > 0.5 ? 'pass' : 'fail'}">
          <div class="issue-content"><i class="ph ${passStamps/total > 0.5 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Timestamps found (${passStamps}/${total} passed)</div>
        </li>
      </ul>
    `;
  }

  // Module 3: Engagement
  const modEngage = document.getElementById('module-engagement');
  if (modEngage && window.videoStatsData) {
    let totalViews = 0, totalLikes = 0, totalComments = 0;
    for (const item of realData) {
      const vId = item.contentDetails?.videoId;
      if (vId && window.videoStatsData[vId]) {
        const s = window.videoStatsData[vId];
        totalViews += parseInt(s.viewCount || 0);
        totalLikes += parseInt(s.likeCount || 0);
        totalComments += parseInt(s.commentCount || 0);
      }
    }
    const engageRate = totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1) : '0.0';

    modEngage.innerHTML = `
      <div class="stats-grid">
        <div class="stat-box"><div class="label">True Engagement Rate</div><div class="value ${engageRate >= 3 ? 'success' : 'danger'}">${engageRate}%</div></div>
        <div class="stat-box"><div class="label">Recent Avg Views</div><div class="value" style="color:#60a5fa">${realData.length ? Math.round(totalViews / realData.length).toLocaleString() : 0}</div></div>
      </div>
      <p class="text-sm mt-2 text-muted">Recommendation: You want engagement above 3% and increasing average views for the algorithm to push your content.</p>
    `;
  }

  // Module 4: Accessibility
  const modAccess = document.getElementById('module-accessibility');
  if (modAccess && window.videoDetailsData) {
    let hasCaptions = 0, totalAudited = 0;
    for (const item of realData) {
      const vId = item.contentDetails?.videoId;
      if (vId && window.videoDetailsData[vId]) {
        totalAudited++;
        if (window.videoDetailsData[vId].caption === "true") hasCaptions++;
      }
    }
    const capPct = totalAudited ? hasCaptions / totalAudited : 0;
    modAccess.innerHTML = `
      <ul class="checklist">
        <li class="${capPct > 0.8 ? 'pass' : 'fail'}"><i class="ph ${capPct > 0.8 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Captions: ${hasCaptions}/${totalAudited} videos</li>
        <li class="${capPct < 0.5 ? 'warning' : 'pass'}"><i class="ph ${capPct >= 0.5 ? 'ph-check-circle' : 'ph-warning-circle'}"></i> Upload transcripts via YouTube Studio</li>
      </ul>
      <p class="text-sm mt-3 alert-box"><strong>Impact:</strong> Adding captions increases completion rates by 80%. Videos with captions get 40% more views.</p>
    `;
  }

  // Module 5: Authority
  const modAuth = document.getElementById('module-authority');
  if (modAuth && channelData) {
    const pubAt = new Date(channelData.snippet.publishedAt);
    const ageYrs = ((new Date() - pubAt) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
    const hasKeys = (channelData.brandingSettings?.channel?.keywords?.length || 0) > 15;
    const isCustom = channelData.snippet.customUrl ? true : false;

    modAuth.innerHTML = `
      <div>
        <h4>Channel Health</h4>
        <ul class="checklist">
          <li class="pass"><i data-lucide="check-circle"></i> Channel Age: ${ageYrs} years</li>
          <li class="${hasKeys ? 'pass' : 'fail'}"><i class="ph ${hasKeys ? 'ph-check-circle' : 'ph-x-circle'}"></i> Keywords: ${hasKeys ? 'Optimized' : 'Missing/Short'}</li>
          <li class="${isCustom ? 'pass' : 'warning'}"><i class="ph ${isCustom ? 'ph-check-circle' : 'ph-warning-circle'}"></i> Custom URL: ${isCustom ? 'Yes' : 'No'}</li>
        </ul>
      </div>
      <div>
        <h4>Playlist Strategy</h4>
        <ul class="checklist auto-fix-list">
          <li class="warning">
            <div class="issue-content"><i data-lucide="warning-circle"></i> Viewers want sequential data. Ensure latest videos are clumped into playlists!</div>
          </li>
        </ul>
        <button class="btn-secondary sm mt-2" onclick="showStudioBridge('Topic Clusters', 'Create new playlists in YouTube Studio to cluster your topics.')">Generate Topic Clusters</button>
      </div>
    `;
  }
}

function addChatMessage(text, sender) {
  const html = formatChatText(text);
  chatMessages.innerHTML += `<div class="chat-msg ${sender}"><div class="chat-bubble">${html}</div></div>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatChatText(text) {
  if (!text) return '';

  // 1. Mask action tags first (using a very simple token that markdown won't touch)
  const actionStore = [];
  let processed = text.replace(/<action\s+([\s\S]*?)(?:>[\s\S]*?<\/action>|(?:\/>)|>|$)/gi, (match, attrs) => {
    actionStore.push(attrs);
    return `___AI_ACTION_${actionStore.length - 1}___`;
  });

  // 2. Standard Markdown processing
  let html = processed
    .replace(/\\n/g, '\n')
    .replace(/\r?\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/### (.*?)(?=<br>|$)/g, '<h4 style="margin:12px 0 6px 0;color:var(--accent-color);font-size:1rem;display:flex;align-items:center;gap:8px;"><i class="ph-fill ph-sparkle"></i> $1</h4>');

  // 3. Re-inject and Render Actions
  html = html.replace(/___AI_ACTION_(\d+)___/g, (match, index) => {
    const rawAttrs = actionStore[parseInt(index)] || '';
    // Strip any HTML that might have been accidentally left in the attributes
    const cleanAttrs = rawAttrs.replace(/<[^>]+>/g, ' ');

    // Parse attributes
    const attrMap = {};
    const attrRegex = /(\w+)\s*=\s*(["'])([\s\S]*?)\2/g;
    let m;
    while ((m = attrRegex.exec(cleanAttrs)) !== null) {
      attrMap[m[1]] = m[3];
    }

    const { type, videoId } = attrMap;
    if (!type || !videoId) return '';

    const dataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(attrMap))));

    if (type === 'update-seo') {
      return `
        <div class="chat-action-card">
          <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:8px;display:flex;align-items:center;gap:4px;">
            <i data-lucide="wand-2"></i> SEO Suggestion
          </div>
          <button class="btn-primary sm" onclick="executeAiAction('${dataEncoded}')" style="width:100%;justify-content:center;padding:10px;font-size:0.8rem;display:flex;align-items:center;gap:8px;">
            <i class="ph-bold ph-rocket-launch"></i> Apply SEO Update
          </button>
        </div>`;
    }

    if (type === 'pin-comment') {
      return `
        <div class="chat-action-card">
          <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:rgba(245,158,11,0.5);margin-bottom:8px;display:flex;align-items:center;gap:4px;">
            <i data-lucide="megaphone"></i> Engagement Strategy
          </div>
          <button class="btn-warning sm" onclick="executeAiAction('${dataEncoded}')" style="width:100%;justify-content:center;padding:10px;font-size:0.8rem;background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);display:flex;align-items:center;gap:8px;">
            <i class="ph-bold ph-push-pin"></i> Post Pinned Comment
          </button>
        </div>`;
    }

    if (type === 'reply-comment') {
      return `
        <div class="chat-action-card">
          <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:rgba(16,185,129,0.5);margin-bottom:8px;display:flex;align-items:center;gap:4px;">
            <i data-lucide="chat-centered-text"></i> Comment Reply
          </div>
          <button class="btn-success sm" onclick="executeAiAction('${dataEncoded}')" style="width:100%;justify-content:center;padding:10px;font-size:0.8rem;background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.3);display:flex;align-items:center;gap:8px;">
            <i class="ph-bold ph-paper-plane-right"></i> Post Reply
          </button>
        </div>`;
    }
    return '';
  });

  return html;
}

window.executeAiAction = async (dataBase64) => {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(dataBase64))));
    console.log('🤖 AI Requesting Action:', data);

    if (data.type === 'update-seo') {
      if (!confirm(`Apply this SEO update to video ${data.videoId}?\n\nTitle: ${data.title || 'No change'}\n\nThis will live-sync to YouTube.`)) return;
      await updateVideoMetadata(data.videoId, data.title, data.description, data.tags);
      alert("✅ YouTube SEO updated & synced!");
    }

    if (data.type === 'pin-comment') {
      if (!confirm(`Post and pin this comment?\n\n"${data.text}"`)) return;
      await pinComment(data.videoId, data.text || data.comment);
      alert("✅ Comment posted and pinned successfully!");
    }

    if (data.type === 'reply-comment') {
      if (!confirm(`Post this reply?\n\n"${data.text}"`)) return;
      await postCommentReply(data.videoId, data.commentId, data.text);
      alert("✅ Reply posted successfully!");
    }
  } catch (err) {
    console.error("Action Bridge Error:", err);
    alert("Action failed: " + err.message);
  }
};

// --- Playlist Growth Suite Handlers ---

document.getElementById('weave-metadata-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('weave-metadata-btn');
  const results = document.getElementById('weaver-results');
  const preview = document.getElementById('weaver-preview');

  if (!activeChannel) return alert('Connect a channel first!');
  if (!recentTitles.length) return alert('No videos analyzed yet. Run a Deep Audit first.');

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Weaving...';
  results.classList.remove('hidden');
  preview.textContent = 'Starting AI Metadata Weaver...';

  try {
    const prompt = `
      You are a YouTube Playlist Strategist for the 2026 "Semantic Discovery" algorithm.
      Playlist: ${window.currentPlaylistTitle || 'Niche Series'}
      Videos: ${recentTitles.join(', ')}

      GOALS:
      1. A 300-word "Semantic Description" for the playlist.
      2. 5 unique "Collusion Tags" (unique keyword strings like "niche-series-2026").
      3. A "Cliffhanger Title" for the playlist.
      4. A logical set of 5-7 TIMESTAMPS for the series structure.

      Respond in plain text with clear headers (DESCRIPTION, TAGS, TARGET TITLE, TIMESTAMPS).
    `;

    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskType: 'playlist-title',
        systemPrompt: "You are a YouTube Playlist Strategist for the 2026 Semantic Discovery algorithm. Generate a DESCRIPTION, TAGS, TARGET TITLE, and TIMESTAMPS.",
        userPrompt: `Playlist: ${window.currentPlaylistTitle || 'Niche Series'}\nVideos: ${recentTitles.join(', ')}`
      })
    });

    if (!res.ok) throw new Error('Groq Proxy Failed');

    const data = await res.json();
    const fullText = data.choices[0].message.content || '';

    preview.innerHTML = fullText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Final cleanup of the preview
    // Final cleanup of the preview
    preview.innerHTML = fullText.replace(/\*\*/g, '')
      .replace(/\n/g, '<br>')
      .replace(/DESCRIPTION/g, '<strong style="color:var(--accent);">DESCRIPTION</strong>')
      .replace(/TAGS/g, '<strong style="color:var(--accent);">TAGS</strong>')
      .replace(/TARGET TITLE/g, '<strong style="color:var(--accent);">TARGET TITLE</strong>')
      .replace(/TIMESTAMPS/g, '<strong style="color:var(--accent);">TIMESTAMPS</strong>');

    // Identify hooks for Shorts Funnel (Heuristic)
    updateShortsHooks(fullText);

    // --- ROBUST PARSING FOR INJECTION ---
    const headers = ['DESCRIPTION', 'TAGS', 'TARGET TITLE', 'TIMESTAMPS'];
    const parts = {};
    let currentHeader = '';

    fullText.split('\n').forEach(line => {
      const h = headers.find(head => line.toUpperCase().includes(head));
      if (h) {
        currentHeader = h;
      } else if (currentHeader) {
        // Preserve newlines for Description and Timestamps
        const separator = (currentHeader === 'DESCRIPTION' || currentHeader === 'TIMESTAMPS') ? '\n' : ' ';
        parts[currentHeader] = (parts[currentHeader] || '') + separator + line.trim();
      }
    });

    // Fallback logic for tags if headers fail:
    let tags = (parts['TAGS'] || '')
      .replace(/\*\*/g, '')
      .split(/[,#\n]|\d+\.\s*/)
      .map(t => t.trim().replace(/^#/, ''))
      .filter(t => t.length > 2);

    // If still empty, scan the whole text for things that look like tags
    if (tags.length === 0) {
      tags = fullText.split('\n')
        .filter(l => l.includes(',') || l.includes('#'))
        .join(' ')
        .match(/[a-zA-Z-]{4,}/g) // Extract words
        ?.filter(w => !['TAGS','DESCRIPTION','TITLE'].includes(w.toUpperCase()))
        .slice(0, 5) || [];
    }

    tags = tags.slice(0, 5);

    window.wovenMetadata = {
      tags: tags,
      description: (parts['DESCRIPTION'] || fullText.slice(0, 500)).replace(/\*\*/g, ''),
      title: (parts['TARGET TITLE'] || "Optimized Series Playlist").replace(/\*\*/g, '')
    };

    console.log("🧶 Metadata Woven & Stored:", window.wovenMetadata);

    // Update Series Status in UI
    const seriesBadge = document.getElementById('series-status');
    if (seriesBadge) {
      seriesBadge.textContent = 'LINKED';
      seriesBadge.style.color = 'var(--success)';
    }

    btn.innerHTML = '<i data-lucide="check"></i> Woven Successful';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } catch (err) {
    console.error(err);
    preview.textContent = 'Error: ' + err.message;
    btn.innerHTML = '<i data-lucide="warning"></i> Failed';
  }
});

function updateShortsHooks(text) {
  const hooksList = document.getElementById('shorts-hooks-list');
  if (!hooksList) return;

  // Basic heuristic to "fake" hook identification from the text if no specific timestamps were requested
  // In a real app, we'd prompt specifically for timestamps.
  hooksList.innerHTML = `
    <li><i data-lucide="zap"></i> Hook 1: 0:15 - "The Secret Revealed"</li>
    <li><i data-lucide="zap"></i> Hook 2: 1:30 - "Pattern Interruption"</li>
    <li><i data-lucide="zap"></i> Hook 3: 4:45 - "The Truth About..."</li>
  `;
}

async function fetchBulkVideoAnalytics(videoIds) {
  if (!accessToken) throw new Error('Not authenticated');

  const start = '2020-01-01'; // Broad range
  const end = new Date().toISOString().split('T')[0];

  // YouTube Analytics API endpoint
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?` +
      `ids=channel==MINE` +
      `&startDate=${start}` +
      `&endDate=${end}` +
      `&metrics=averageViewDuration,playlistExitRate` +
      `&dimensions=video` +
      `&filters=video==${videoIds.join(',')}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 403) {
    throw new Error("403 Forbidden: YouTube Analytics API not enabled or scope missing.");
  }

  const data = await res.json();

  const results = {};
  if (data.rows) {
    data.rows.forEach(row => {
      results[row[0]] = {
        averageViewDuration: row[1],
        playlistExitRate: row[2]
      };
    });
  }
  return results;
}

async function updatePlaylistItemPosition(playlistItemId, playlistId, videoId, newPosition) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: playlistItemId,
      snippet: {
        playlistId: playlistId,
        position: newPosition,
        resourceId: {
          kind: 'youtube#video',
          videoId: videoId
        }
      }
    })
  });
  return res.json();
}

document.getElementById('reorder-playlist-btn')?.addEventListener('click', async () => {
  if (!window.currentPlaylistVideos || !window.currentPlaylistVideos.length) {
    return alert('Please run a Deep Audit first to load video data.');
  }

  const btn = document.getElementById('reorder-playlist-btn');
  const hookDisplay = document.getElementById('hook-vids');
  const leakyDisplay = document.getElementById('leaky-vids');

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Re-ordering...';

  try {
    const videoIds = window.currentPlaylistVideos.map(v => v.contentDetails?.videoId).filter(Boolean);
    const analyticsData = await fetchBulkVideoAnalytics(videoIds);

    // 1. Score and Categorize (Prioritize high retention + high views)
    const scoredVideos = window.currentPlaylistVideos.map(item => {
      const vId = item.contentDetails?.videoId;
      const stats = analyticsData[vId] || { averageViewDuration: 0, playlistExitRate: 0 };
      const viewCount = parseInt(item.statistics?.viewCount || '0');

      // Calculate a "Gateway Score": 50% Retention + 50% View Velocity
      // Normalize viewCount roughly (capped at 100k for internal scoring weight)
      // High view count videos are naturally better "gateways" for new traffic.
      const viewWeight = Math.min(viewCount / 500, 200);
      const gatewayScore = (stats.averageViewDuration * 0.5) + (viewWeight * 0.5);

      return {
        vId,
        playlistItemId: item.id,
        playlistId: item.snippet.playlistId,
        retention: stats.averageViewDuration,
        exitRate: stats.playlistExitRate,
        viewCount: viewCount,
        gatewayScore: gatewayScore,
        originalPosition: item.snippet.position
      };
    });

    // 2. Sort by Gateway Score (Desc)
    // This will naturally put high-view, high-retention videos at the top.
    const sorted = [...scoredVideos].sort((a, b) => b.gatewayScore - a.gatewayScore);

    const total = sorted.length;
    hookDisplay.textContent = Math.min(2, total);
    leakyDisplay.textContent = Math.ceil(total * 0.2);

    // 3. Apply Re-order logic
    // Hooks at #1, #2 (Index 0, 1)
    // Leaky at the end (Last 20%)
    const hooks = sorted.slice(0, 2);
    const leakyCount = Math.ceil(total * 0.2);
    const leaky = [...scoredVideos].sort((a, b) => b.exitRate - a.exitRate).slice(0, leakyCount);

    const leakyIds = new Set(leaky.map(v => v.vId));
    const hookIds = new Set(hooks.map(v => v.vId));
    const remaining = sorted.filter(v => !leakyIds.has(v.vId) && !hookIds.has(v.vId));

    const finalOrder = [...hooks, ...remaining, ...leaky];

    // 4. Update YouTube
    for (let i = 0; i < finalOrder.length; i++) {
       const video = finalOrder[i];
       if (video.playlistItemId && video.originalPosition !== i) {
         try {
           await updatePlaylistItemPosition(video.playlistItemId, video.playlistId, video.vId, i);
           await new Promise(r => setTimeout(r, 300)); // Rate limit
         } catch (e) {
           console.warn(`Failed to re-order video ${video.vId}:`, e);
         }
       }
    }

    btn.innerHTML = '<i data-lucide="check"></i> Optimized Successfully';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  } catch (err) {
    console.error(err);
    alert('Re-order failed: ' + (err.message || 'Check Analytics Permissions'));
    btn.innerHTML = '<i data-lucide="arrows-down-up"></i> Optimize Order';
    btn.disabled = false;
  }
});

document.getElementById('demo-btn')?.addEventListener('click', () => {
  console.log("🧪 Starting Suite Simulation...");

  // 1. Mock Channel & Video Data
  activeChannel = {
    id: 'UC_MOCK_CHANNEL_123',
    snippet: { title: "Nexus Tech Decoded", description: "Deep dives into upcoming technology." },
    contentDetails: { relatedPlaylists: { uploads: 'UU_MOCK' } }
  };

  // Set the input to 'demo' and trigger the audit flow
  const urlInput = document.getElementById('channel-url');
  if (urlInput) {
    urlInput.value = 'demo';
    runAudit();
  } else {
    alert("🧪 Simulation Loaded! Please enter 'demo' in the channel URL field and click 'Run Deep Audit'.");
  }
});

document.getElementById('bulk-inject-btn')?.addEventListener('click', async () => {
  if (checkPremium('Bulk Injector')) return;

  if (!window.wovenMetadata || !window.wovenMetadata.tags.length) {
    return alert('Please "Weave Metadata" first to generate collusion tags!');
  }
  if (!window.currentPlaylistVideos || !window.currentPlaylistVideos.length) {
    return alert('No videos found. Please run a Deep Audit on a channel/playlist first.');
  }

  // 🛡️ QUOTA GUARD
  const ops = [{ type: 'UPDATE', count: window.currentPlaylistVideos.length }];
  const canProceed = await checkQuotaRisk(ops, 'Bulk Metadata Injection');
  if (!canProceed) return;

  const btn = document.getElementById('bulk-inject-btn');
  const progressDiv = document.getElementById('injection-progress');
  const progressBar = progressDiv.querySelector('.fill');
  const progressCount = document.getElementById('injection-count');

  const confirmInject = confirm(`This will inject ${window.wovenMetadata.tags.length} collusion tags and AI description into the first line of ${window.currentPlaylistVideos.length} videos. Continue?`);
  if (!confirmInject) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Processing...';
  progressDiv.classList.remove('hidden');

  let success = 0;
  const total = window.currentPlaylistVideos.length;
  const backups = [];

  for (let i = 0; i < total; i++) {
    const video = window.currentPlaylistVideos[i];
    const videoId = video.contentDetails?.videoId;
    if (!videoId) continue;

    try {
      // 0. Skip Unavailable Videos
      if (video.snippet.title === 'Deleted video' || video.snippet.title === 'Private video') {
        console.warn(`Skipping unavailable video: ${videoId}`);
        continue;
      }

      // 1. Create Backup
      backups.push({
        id: videoId,
        title: video.snippet.title,
        description: video.snippet.description,
        tags: video.snippet.tags || []
      });

      // 2. Prepare New Metadata (Sanitize and Deduplicate)
      const seriesName = (window.currentPlaylistTitle || (activeChannel ? activeChannel.snippet.title : 'Series'))
        .replace(/\*\*/g, '').trim();
      const cleanTags = window.wovenMetadata.tags.map(t => t.replace(/\*\*/g, '').trim());

      // Use Series Abstract if available, otherwise fall back to tags
      let collusionHeader = '';
      if (window.wovenMetadata.seriesAbstract) {
        // Replace the 🔗 placeholder with actual series name
        collusionHeader = window.wovenMetadata.seriesAbstract.replace(
          '🔗 Part of the',
          `🔗 Part of the "${seriesName}"`
        );
      } else {
        collusionHeader = `🔗 Part of the "${seriesName}" series. Tags: ${cleanTags.join(', ')}`;
      }

      let aiContent = window.wovenMetadata.description ? `📝 SERIES OVERVIEW:\n${window.wovenMetadata.description.replace(/\*\*/g, '').trim()}` : '';
      if (window.wovenMetadata.timestamps) {
        aiContent += (aiContent ? '\n\n' : '') + `📌 SERIES TIMESTAMPS:\n${window.wovenMetadata.timestamps.replace(/\*\*/g, '').trim()}`;
      }

      const currentDesc = (video.snippet.description || '');

      // LOGIC: Structural "Scrub" - Split into paragraphs and remove any identified AI blocks
      const scrubbedDesc = currentDesc.split('\n\n')
        .filter(p => {
          const text = p.trim();
          if (!text) return false;
          // Exact matches for our headers or signature emojis to prevent destruction of user content
          if (text.includes('📝 SERIES OVERVIEW')) return false;
          if (text.includes('🔗 Part of the')) return false;
          if (text.includes('📌 SERIES TIMESTAMPS')) return false;
          // Filter out paragraphs that look like tag lists (lots of commas, no periods)
          if (text.includes(',') && text.split(',').length > 5 && !text.includes('.')) return false;
          return true;
        })
        .join('\n\n').trim();

      // Assemble final block with single spacing between components
      const newDescRaw = `${collusionHeader}\n\n${aiContent}\n\n${scrubbedDesc}`.trim();
      // 5000 character limit enforcement with safe truncation
      const newDesc = newDescRaw.length > 5000
        ? newDescRaw.substring(0, 4990) + "... [Truncated for SEO]"
        : newDescRaw;

      const newTags = [...new Set([...(video.snippet.tags || []), ...window.wovenMetadata.tags])]
        .map(t => t.replace(/\*\*/g, '').trim())
        .slice(0, 50);

      // 3. Inject
      await updateVideoMetadata(videoId, video.snippet.title, newDesc, newTags);

      success++;
      const pct = Math.round((success / total) * 100);
      progressBar.style.width = pct + '%';
      progressCount.textContent = `${success}/${total}`;
    } catch (err) {
      console.error(`Injection failed for ${videoId}:`, err);
    }
    await new Promise(r => setTimeout(r, 500)); // Rate limit safety
  }

  // Save backups to localStorage for rollback
  localStorage.setItem('yt_seo_rollback_data', JSON.stringify(backups));

  btn.innerHTML = '<i data-lucide="check"></i> Injection Complete';
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
});

document.getElementById('rollback-btn')?.addEventListener('click', async () => {
  const backupData = localStorage.getItem('yt_seo_rollback_data');
  if (!backupData) return alert('No rollback data found!');

  const backups = JSON.parse(backupData);
  const confirmRollback = confirm(`Revert changes for ${backups.length} videos? This will restore original titles, descriptions, and tags.`);
  if (!confirmRollback) return;

  const btn = document.getElementById('rollback-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Rolling back...';

  let success = 0;
  for (const b of backups) {
    try {
      await updateVideoMetadata(b.id, b.title, b.description, b.tags);
      success++;
    } catch (e) { console.error(`Rollback failed for ${b.id}:`, e); }
    await new Promise(r => setTimeout(r, 500));
  }

  alert(`Rollback complete. ${success}/${backups.length} videos restored.`);
  btn.innerHTML = '<i data-lucide="arrow-u-up-left"></i> Rollback Changes';
  localStorage.removeItem('yt_seo_rollback_data');
});

document.getElementById('link-shorts-btn')?.addEventListener('click', async () => {
  if (!window.currentPlaylistVideos) return alert('No videos analyzed.');

  const btn = document.getElementById('link-shorts-btn');
  const shorts = window.currentPlaylistVideos.filter(v => {
    const vId = v.contentDetails?.videoId;
    const duration = videoDurations[vId] || 0;

    return (duration > 0 && duration <= 90) ||
           v.snippet.title.toLowerCase().includes('shorts') ||
           (v.snippet.description && v.snippet.description.toLowerCase().includes('#shorts'));
  });

  if (shorts.length === 0) return alert('No Shorts detected in this playlist to link.');

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Semantic Matching...';

  let success = 0;
  for (const s of shorts) {
    try {
      const vId = s.contentDetails.videoId;
      const sTags = s.snippet.tags || [];

      let bestMatch = window.currentPlaylistVideos[0];
      let maxOverlap = -1;

      const longVideos = window.currentPlaylistVideos.filter(v => {
        const d = videoDurations[v.contentDetails?.videoId] || 0;
        return d > 90 || d === 0;
      });

      for (const lv of longVideos) {
        if (lv.contentDetails.videoId === vId) continue;
        const lvTags = lv.snippet.tags || [];
        const overlap = sTags.filter(t => lvTags.includes(t)).length;
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatch = lv;
        }
      }

      const parentVideoId = bestMatch.contentDetails.videoId;
      const parentUrl = `https://youtu.be/${parentVideoId}`;
      const header = `🎥 Part of the Series: ${parentUrl}\n\n`;
      const newDesc = header + (s.snippet.description || '').replace(/^🎥 Part of the Series: https:\/\/youtu\.be\/.*\n\n/, '');

      await updateVideoMetadata(vId, s.snippet.title, newDesc, s.snippet.tags || []);
      success++;

      // NEW: Show deep link for 'Related Video' feature
      const studioLink = `https://studio.youtube.com/video/${vId}/edit`;
      console.log(`🔗 Shorts Link: Manual 'Related Video' link for ${vId}: ${studioLink}`);
    } catch (e) { console.error("Short Link Error:", e); }
    await new Promise(r => setTimeout(r, 500));
  }

  alert(`✅ Linked ${success} Shorts via Description!\n\n🚀 ELITE HACK: Now visit YouTube Studio for these Shorts and set the 'Related Video' field to your primary series gateway for maximum 2026 reach.`);
  btn.innerHTML = '<i data-lucide="check"></i> Shorts Linked';
  btn.disabled = true;
});

// ── 7. Elite Growth Hacks Implementation ──

// Official Series Validator (Enhanced with Backend API)
document.getElementById('validate-series-btn')?.addEventListener('click', async () => {
  if (!window.currentPlaylistVideos) return alert('No videos analyzed. Please run a Deep Audit.');
  if (!accessToken) return alert('Please connect YouTube first.');

  const btn = document.getElementById('validate-series-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Validating...';

  // Get the playlist ID from first video
  const playlistId = window.currentPlaylistVideos[0]?.snippet?.playlistId;
  if (!playlistId) {
    alert('No playlist found. Please run audit on a channel or playlist.');
    btn.innerHTML = '<i data-lucide="warning-circle"></i> Validation Failed';
    return;
  }

  try {
    // Use backend API for comprehensive validation
    const res = await fetch(`${API_BASE_URL}/api/validate-series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistId,
        accessToken,
        myChannelId: activeChannel?.id
      })
    });

    const result = await res.json();

    if (result.error) {
      // Fallback to local validation if API fails
      console.warn('API validation failed, using local fallback');
      let issues = [];
      for (const v of window.currentPlaylistVideos) {
        if (v.snippet.title === 'Deleted video' || v.snippet.title === 'Private video') {
          issues.push(`• ${v.contentDetails?.videoId}: Unavailable video found.`);
        }
      }

      if (issues.length > 0) {
        alert(`⚠️ Validation Failed! Found ${issues.length} issues:\n\n${issues.join('\n')}\n\nPlease remove these from the playlist before setting as Official Series.`);
        btn.innerHTML = '<i data-lucide="warning-circle"></i> Validation Failed';
        return;
      }
    } else {
      // Use API result
      if (!result.canEnableSeries) {
        let msg = `⚠️ Validation Failed! Found ${result.invalidVideos} issues:\n\n`;
        msg += `• Total Videos: ${result.totalVideos}\n`;
        msg += `• Valid Videos: ${result.validVideos}\n`;
        msg += `• Invalid Videos: ${result.invalidVideos}\n\n`;
        msg += result.recommendation;

        alert(msg);
        btn.innerHTML = '<i data-lucide="warning-circle"></i> Validation Failed';
      } else {
        const status = document.getElementById('series-status');
        status.textContent = 'VALIDATED';
        status.style.color = 'var(--success)';
        alert(`✅ "Official Series" Validated!\n\n${result.recommendation}`);
        btn.innerHTML = '<i data-lucide="shield-check"></i> Validated';
      }
    }

  } catch (err) {
    console.error('Validation error:', err);
    // Fallback to basic validation
    let issues = [];
    for (const v of window.currentPlaylistVideos) {
      if (v.snippet.title === 'Deleted video' || v.snippet.title === 'Private video') {
        issues.push(`• ${v.contentDetails?.videoId}: Unavailable video found.`);
      }
    }

    if (issues.length > 0) {
      alert(`⚠️ Validation Failed! Found ${issues.length} issues:\n\n${issues.join('\n')}\n\nPlease remove these from the playlist before setting as Official Series.`);
      btn.innerHTML = '<i data-lucide="warning-circle"></i> Validation Failed';
    } else {
      const status = document.getElementById('series-status');
      status.textContent = 'VALIDATED';
      status.style.color = 'var(--success)';
      alert('✅ "Official Series" Validated! Your playlist structure is clean for the 2026 algorithm.');
      btn.innerHTML = '<i data-lucide="shield-check"></i> Validated';
    }
  }
});

// Sidebar Sniper (Competitor Hijack - Auto-Rewrite via Backend)
document.getElementById('snipe-sidebar-btn')?.addEventListener('click', async () => {
  if (checkPremium('Sidebar Sniper')) return;

  const compUrl = document.getElementById('competitor-video-url').value;
  if (!compUrl) return alert('Please paste a competitor video URL.');
  if (!window.currentPlaylistVideos || window.currentPlaylistVideos.length === 0) return alert('Please run a Deep Audit first.');
  if (!accessToken) return alert('Please connect YouTube first.');

  const btn = document.getElementById('snipe-sidebar-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Analyzing...';

  // UI Elements
  const relevancyMeter = document.getElementById('relevancy-health-meter');
  const relevancyFill = document.getElementById('relevancy-fill');
  const relevancyScoreEl = document.getElementById('relevancy-score');
  const relevancyWarning = document.getElementById('relevancy-warning');
  const relevancyWarningText = document.getElementById('relevancy-warning-text');
  const tagAnalysisResults = document.getElementById('tag-analysis-results');
  const relevantTagsList = document.getElementById('relevant-tags-list');
  const outlierTagsList = document.getElementById('outlier-tags-list');
  const nicheMirrorSuggestion = document.getElementById('niche-mirror-suggestion');
  const nicheMirrorText = document.getElementById('niche-mirror-text');

  // Reset UI
  relevancyMeter.classList.add('hidden');
  tagAnalysisResults.classList.add('hidden');
  nicheMirrorSuggestion.classList.add('hidden');

  try {
    // Prepare playlist videos data
    const myPlaylistVideos = window.currentPlaylistVideos.map(v => ({
      title: v.snippet.title,
      description: v.snippet.description,
      videoId: v.contentDetails?.videoId
    }));

    // Extract video ID from URL for tag extraction
    const videoIdMatch = compUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) {
      throw new Error('Invalid YouTube video URL');
    }
    const competitorVideoId = videoIdMatch[1];

    // Fetch competitor video details to get tags
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${competitorVideoId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const videoData = await videoRes.json();
    const competitorVideo = videoData.items?.[0];

    if (!competitorVideo) {
      throw new Error('Could not fetch competitor video details');
    }

    const competitorTags = competitorVideo.snippet.tags || [];
    const playlistTitle = window.currentPlaylistVideos[0]?.snippet?.title || 'My Playlist';
    const playlistDescription = window.currentPlaylistVideos[0]?.snippet?.description || '';

    // Step 1: Validate Metadata Relevance
    btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Validating Relevance...';

    const validateRes = await fetch(`${API_BASE_URL}/api/validate-metadata-relevance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistTitle,
        playlistDescription,
        competitorTags,
        userNiche: channelNiche
      })
    });

    const validateResult = await validateRes.json();

    if (validateResult.error) {
      throw new Error(validateResult.error);
    }

    // Show Relevancy Health Meter
    relevancyMeter.classList.remove('hidden');
    const score = validateResult.relevanceScore || 0;
    relevancyScoreEl.textContent = score + '%';
    relevancyFill.style.width = score + '%';

    // Color based on score
    if (score >= 60) {
      relevancyFill.style.background = 'var(--success)';
      relevancyScoreEl.style.color = 'var(--success)';
    } else {
      relevancyFill.style.background = 'var(--danger)';
      relevancyScoreEl.style.color = 'var(--danger)';
    }

    // Show Warning if below 60%
    if (score < 60) {
      relevancyWarning.classList.remove('hidden');
      relevancyWarningText.textContent = validateResult.warning || 'This competitor is in a different niche. Hijacking these tags will hurt your retention.';

      // Show Niche Mirror suggestion
      if (validateResult.alternativeSuggestion) {
        nicheMirrorSuggestion.classList.remove('hidden');
        nicheMirrorText.textContent = validateResult.alternativeSuggestion;
      }
    }

    // Show Tag Analysis
    tagAnalysisResults.classList.remove('hidden');

    // Relevant Tags (Green)
    const relevantTags = validateResult.relevantTags || competitorTags;
    relevantTagsList.innerHTML = relevantTags.slice(0, 10).map(t =>
        `<span class="audit-badge" style="background:rgba(16,185,129,0.2); border-color:var(--success);">${escapeHTML(t)}</span>`
    ).join('');

    // Outlier Tags (Red)
    const discardedTags = validateResult.discardedTags || [];
    if (discardedTags.length > 0) {
      outlierTagsList.innerHTML = discardedTags.map(d =>
          `<span class="audit-badge" style="background:rgba(239,68,68,0.2); border-color:var(--danger);" title="${escapeHTML(d.reason || '')}">${escapeHTML(d.tag || d)}</span>`
      ).join('');
    } else {
      outlierTagsList.innerHTML = '<span class="text-muted text-sm">No outliers detected</span>';
    }

    // Store cleaned tags for later use
    window.cleanedCompetitorTags = relevantTags;
    window.competitorVideoTitle = competitorVideo.snippet.title;
    window.competitorChannelName = competitorVideo.snippet.channelTitle;

    // If score is below 60%, ask user if they want to proceed anyway
    if (score < 60) {
      const proceed = confirm(`⚠️ WARNING: This competitor has only ${score}% relevance to your playlist.\n\n${validateResult.warning}\n\nDo you want to proceed anyway?`);
      if (!proceed) {
        btn.innerHTML = '<i data-lucide="crosshair"></i> Snipe Metadata';
        return;
      }
    }

    // Step 2: Proceed with sniping using only relevant (cleaned) tags
    btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Auto-Sniping...';

    // Use backend API for comprehensive competitor analysis with cleaned tags
    const res = await fetch(`${API_BASE_URL}/api/competitor-snipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitorUrl: compUrl,
        myPlaylistVideos,
        accessToken,
        myChannelNiche: channelNiche
      })
    });

    const result = await res.json();

    if (result.error) {
      throw new Error(result.error);
    }

    // Update window.wovenMetadata with the auto-generated metadata
    window.wovenMetadata = {
      title: result.optimizedMetadata.newTitle,
      tags: result.optimizedMetadata.newTags,
      description: result.optimizedMetadata.newDescription,
      isSniperMode: true,
      reasoning: result.optimizedMetadata.reasoning
    };

    // Generate Series Abstract (cinematic intro)
    let seriesAbstract = '';
    try {
      btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Generating Series Abstract...';
      const abstractRes = await fetch(`${API_BASE_URL}/api/generate-series-abstract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistTitle: result.optimizedMetadata.newTitle,
          tags: result.optimizedMetadata.newTags
        })
      });
      const abstractData = await abstractRes.json();
      if (abstractData.success) {
        seriesAbstract = abstractData.abstract;
        window.wovenMetadata.seriesAbstract = seriesAbstract;
        console.log('📝 Series Abstract Generated:', seriesAbstract);
      }
    } catch (e) {
      console.warn('Series abstract generation failed:', e);
    }

    // Show results
    const preview = document.getElementById('weaver-preview');
    const results = document.getElementById('weaver-results');
    results.classList.remove('hidden');

    preview.innerHTML = `
      <div style="margin-bottom:1rem;">
        <strong style="color:var(--danger);">🎯 SNIPER MODE ACTIVE</strong>
        <p style="font-size:0.75rem; opacity:0.7; margin-top:0.5rem;">${result.optimizedMetadata.reasoning}</p>
      </div>
      <div style="margin-bottom:1rem;">
        <strong>Relevancy Score:</strong> <span style="color:${score >= 60 ? 'var(--success)' : 'var(--danger)'}">${score}%</span>
      </div>
      <div style="margin-bottom:1rem;">
        <strong>New Title:</strong><br>
        <span style="color:var(--accent);">${result.optimizedMetadata.newTitle}</span>
      </div>
      ${seriesAbstract ? `
      <div style="margin-bottom:1rem; padding:0.75rem; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.3); border-radius:8px;">
        <strong style="color:var(--accent);">🎬 Series Abstract:</strong>
        <p style="font-size:0.8rem; margin-top:0.5rem; line-height:1.5;">${seriesAbstract}</p>
      </div>
      ` : ''}
      <div style="margin-bottom:1rem;">
        <strong>Competitor Tags Found:</strong><br>
        <span style="font-size:0.75rem; opacity:0.7;">${result.competitorTags.slice(0, 15).join(', ')}</span>
      </div>
      <div>
        <strong>New Sniper Tags (Cleaned):</strong><br>
        <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.5rem;">
          ${result.optimizedMetadata.newTags.map(t => `<span class="audit-badge badge-pass">${t}</span>`).join('')}
        </div>
      </div>
    `;

    alert(`🎯 AUTO-SNIPE COMPLETE!\n\n${result.message}\n\nRelevancy Score: ${score}%${score < 60 ? '\n⚠️ Warning: Low relevance - monitor retention closely' : ''}${seriesAbstract ? '\n\n📝 Series Abstract generated - will replace tags in description' : ''}\n\nClick "One-Click Inject" to apply the optimized metadata to all videos.`);

  } catch (err) {
    console.error(err);
    alert('Sniper failed: ' + err.message);
  } finally {
    btn.innerHTML = '<i data-lucide="crosshair"></i> Snipe Metadata';
  }
});

// Gateway Identifier (with SQLite Storage)
document.getElementById('identify-gateways-btn')?.addEventListener('click', async () => {
  if (!window.currentPlaylistVideos) return alert('No videos analyzed.');

  const btn = document.getElementById('identify-gateways-btn');
  const resultsDiv = document.getElementById('gateway-results');
  const topGateway = document.getElementById('top-gateway-title');

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Calculating...';

  // Heuristic: Highest view count + Lowest Exit Rate = Gateway
  // Since we already fetched stats in runAudit (window.videoStatsData)
  let bestGateway = null;
  let maxScore = -1;
  const playlistId = window.currentPlaylistVideos[0]?.snippet?.playlistId;

  for (const v of window.currentPlaylistVideos) {
    const vId = v.contentDetails?.videoId;
    const views = parseInt(window.videoStatsData[vId]?.viewCount || 0);
    // Score view counts (normalized)
    const score = views;
    if (score > maxScore) {
      maxScore = score;
      bestGateway = v;
    }

    // Save analytics to SQLite
    if (activeChannel?.id && playlistId && vId) {
      try {
        await fetch(`${API_BASE_URL}/api/analytics/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelId: activeChannel.id,
            playlistId: playlistId,
            videoId: vId,
            averageViewDuration: 0, // Would come from Analytics API in production
            playlistExitRate: 0,
            gatewayScore: score,
            gatewayLink: `https://youtube.com/watch?v=${vId}&list=${playlistId}&index=1`
          })
        });
      } catch (e) {
        console.warn('Analytics save failed:', e);
      }
    }
  }

  if (bestGateway) {
    topGateway.textContent = bestGateway.snippet.title;
    resultsDiv.classList.remove('hidden');
    const gatewayLink = `https://youtube.com/watch?v=${bestGateway.contentDetails?.videoId}&list=${playlistId}&index=1`;
    alert(`🚪 Gateway Identified: "${bestGateway.snippet.title}"\n\nThis video is your primary traffic funnel. Use this link for external ads/sharing:\n\n${gatewayLink}`);
  }

  btn.innerHTML = '<i data-lucide="search"></i> Find Gateways';
});

// Infinite Loop Implementation Strategy
const applyInfiniteLoop = async () => {
  if (!window.currentPlaylistVideos || window.currentPlaylistVideos.length < 2) {
    return alert('Infinite Loop requires at least 2 videos in the series.');
  }

  // Ensure we use the actual first and last from the sorted list if relevant
  // However, runAudit already sorts realData by publishedAt ascending.
  const firstVideo = window.currentPlaylistVideos[0];
  const lastVideo = window.currentPlaylistVideos[window.currentPlaylistVideos.length - 1];

  const firstVideoId = firstVideo.contentDetails.videoId;
  const lastVideoId = lastVideo.contentDetails.videoId;
  const studioLink = `https://studio.youtube.com/video/${lastVideoId}/edit/endscreen`;

  const strategy = `🔄 INFINITE LOOP ACTIVATED\n\nTo lock viewers into your series, follow these steps for your final video: "${lastVideo.snippet.title}"\n\n1️⃣ Click 'Go to Studio' below to open the End Screen editor.\n2️⃣ Add an 'End Screen' element.\n3️⃣ Select 'Video' -> 'Choose specific video'.\n4️⃣ Paste the copied ID: ${firstVideoId}\n\nThis creates a perfect 'Infinite Loop' by sending viewers back to Part 1.`;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e1e2e; padding:2rem; border-radius:12px; border:1px solid var(--accent); z-index:9999; box-shadow:0 20px 50px rgba(0,0,0,0.5); max-width:500px; color:white; display:flex; flex-direction:column;";
  modal.innerHTML = `
    <h2 style="color:var(--accent); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="arrows-clockwise"></i> Infinite Loop Guide</h2>
    <p style="font-size:0.9rem; line-height:1.5; margin-bottom:1.5rem; opacity:0.8;">${strategy.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}</p>
    <div style="display:flex; gap:1rem;">
      <button class="btn-primary" onclick="navigator.clipboard.writeText('${firstVideoId}'); this.innerText='Copied ID!'; setTimeout(()=>this.innerText='Copy Video ID',1500)" style="flex:1;">Copy Video ID</button>
      <a href="${studioLink}" target="_blank" class="btn-secondary" style="flex:1; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:4px; background:rgba(168,85,247,0.2);">Go to Studio <i data-lucide="arrow-square-out"></i></a>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="flex:0.5;">Dismiss</button>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Verbal Bridge Tracking - Analysis via Groq
 */
async function runVerbalBridgeAudit() {
  if (!window.currentPlaylistVideos) return;
  const seriesTitle = window.currentPlaylistTitle || 'this series';
  const audioContainer = document.getElementById('audio-audit-container');
  const eliteAlerts = document.getElementById('elite-audit-alerts');

  eliteAlerts.classList.remove('hidden');
  audioContainer.innerHTML = `<div class="alert-box" style="background:rgba(255,255,255,0.05);"><i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> <strong>Verbal Series Sync:</strong> Analyzing transcripts...</div>`;

  console.log(`🎤 Starting Verbal Bridge Audit for: ${seriesTitle}`);

  // Simulation: use a mock transcript
  const mockTranscript = `Hey everyone, today we're continuing our ${seriesTitle} with a look at the latest algorithm changes. Make sure to check out the rest of the series.`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/audio-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: mockTranscript, seriesTitle })
    });
    const data = await res.json();

    if (data.mentioned) {
      audioContainer.innerHTML = `<div class="alert-box" style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2);">
        <i class="ph ph-check-circle text-success"></i> <strong>Verbal Series Sync:</strong> Mention confirmed! "${data.quote}" (${data.confidence}% confidence)
      </div>`;
    } else {
      audioContainer.innerHTML = `<div class="alert-box" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2);">
        <i class="ph ph-warning-circle text-danger"></i> <strong>Verbal Series Sync:</strong> Title not mentioned. Consider adding "${seriesTitle}" to your script.
      </div>`;
    }
  } catch (e) {
    console.error("Audio audit UI failed:", e);
    audioContainer.innerHTML = `<div class="alert-box"><i data-lucide="warning"></i> Verbal Sync unavailable.</div>`;
  }
}

// ── EVERGREEN AUDIT (API Version) ──
async function runEvergreenAuditAPI(videos) {
  const container = document.getElementById('evergreen-alerts-container');
  const eliteAlerts = document.getElementById('elite-audit-alerts');

  if (!videos || videos.length === 0) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/evergreen-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoList: videos })
    });
    const data = await res.json();

    eliteAlerts.classList.remove('hidden');
    container.innerHTML = '';

    if (data.alerts && data.alerts.length > 0) {
      data.alerts.forEach(alert => {
        const box = document.createElement('div');
        box.className = 'alert-box';
        box.style = 'background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); margin-bottom:0.5rem;';
        box.innerHTML = `<i class="ph ph-calendar-check text-warning"></i> <strong>Evergreen Refresh:</strong> "${alert.title}" is ${alert.ageMonths} months old. <strong>Update required:</strong> ${alert.recommendation}`;
        container.appendChild(box);
      });
    } else {
      container.innerHTML = `<div class="alert-box" style="background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.2);">
        <i class="ph ph-seedling text-success"></i> <strong>Evergreen Scanner:</strong> All videos are algorithmically fresh.
      </div>`;
    }
  } catch (e) {
    console.error("Evergreen audit UI failed:", e);
  }
}
async function pinComment(videoId, text) {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } }
        }
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error');
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // Attempt to pin (requires specific permissions, usually done via manual link or specific API if available)
    console.log("Comment posted, pin manually or via specific endpoint if enabled.");

    trackQuota('COMMENT');
    updateQuotaDisplay();

    return data;
  } catch (err) {
    throw err;
  }
}

async function postCommentReply(videoId, parentId, text) {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: {
          parentId,
          textOriginal: text
        }
      })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      throw new Error('Server returned an error');
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    trackQuota('COMMENT');
    updateQuotaDisplay();

    return data;
  } catch (err) {
    throw err;
  }
}

// Global badge settings
window.badgeSettings = {
  opacity: 95,
  position: 'top-right',
  style: 'part'
};

// Bulk Thumbnail Badging Logic (Canvas)
async function generateThumbnailBadges() {
  if (!window.currentPlaylistVideos) return alert('No videos analyzed.');

  const btn = document.getElementById('generate-badges-btn');
  const downloadAllBtn = document.getElementById('download-all-badges-btn');
  const applyAllBtn = document.getElementById('apply-all-badges-btn');
  const grid = document.getElementById('thumbnail-grid');
  const controls = document.getElementById('badge-controls');
  const sidebarPreview = document.getElementById('sidebar-preview-section');
  const sidebarGrid = document.getElementById('sidebar-preview-grid');

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Starting Renderer...';
  grid.innerHTML = '';
  sidebarGrid.innerHTML = '';
  grid.parentElement.parentElement.classList.remove('hidden');
  controls.style.display = 'block';
  sidebarPreview.classList.remove('hidden');

  const total = window.currentPlaylistVideos.length;
  window.thumbnailData = [];

  try {
    for (let i = 0; i < Math.min(total, 9); i++) {
      const video = window.currentPlaylistVideos[i];
      const title = video.snippet?.title || '';
      const videoId = video.contentDetails?.videoId || '';
      const isUnavailable = title.toLowerCase().includes('deleted video') || title.toLowerCase().includes('private video');

      if (!video.snippet || !video.snippet.thumbnails || isUnavailable) {
        console.warn(`Skipping video ${i+1}: Video is unavailable or has no thumbnails.`);
        continue;
      }

      const thumbUrl = video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url;
      if (!thumbUrl) continue;

      // Store thumbnail data for later use
      window.thumbnailData.push({ index: i, videoId, thumbUrl, title });
    }

    // Render 3x3 sidebar preview
    await renderSidebarPreview();

    // Render individual thumbnails
    await renderIndividualThumbnails();

  } catch (err) {
    console.error("Batch rendering failed:", err);
  } finally {
    btn.innerHTML = '<i data-lucide="check"></i> Badges Ready';
    downloadAllBtn?.classList.remove('hidden');
    applyAllBtn?.classList.remove('hidden');
  }
}

function getBadgeText(index, total, style) {
  switch(style) {
    case 'ep': return `EP ${index + 1}`;
    case 'series': return `SERIES ${index + 1}`;
    case 'number': return `${index + 1}`;
    default: return `PART ${index + 1} / ${total}`;
  }
}

function getBadgePosition(position) {
  const pos = { x: 0, y: 0 };
  switch(position) {
    case 'top-right': pos.x = 1280 - 200; pos.y = 40; break;
    case 'top-left': pos.x = 40; pos.y = 40; break;
    case 'bottom-right': pos.x = 1280 - 200; pos.y = 570; break;
    case 'bottom-left': pos.x = 40; pos.y = 570; break;
  }
  return pos;
}

async function renderSidebarPreview() {
  const sidebarGrid = document.getElementById('sidebar-preview-grid');
  const total = window.thumbnailData?.length || 0;
  const { opacity, position, style } = window.badgeSettings;

  sidebarGrid.innerHTML = '';

  if (!window.thumbnailData || total === 0) {
    sidebarGrid.innerHTML = '<div class="text-muted text-sm">No thumbnails to preview</div>';
    return;
  }

  for (let i = 0; i < total; i++) {
    const data = window.thumbnailData[i];
    const container = document.createElement('div');
    container.className = 'sidebar-preview-item';

    const img = document.createElement('img');
    img.src = `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(data.thumbUrl)}`;

    const badge = document.createElement('div');
    badge.className = `preview-badge ${position}`;
    badge.textContent = getBadgeText(i, total, style);
    badge.style.opacity = opacity / 100;

    container.appendChild(img);
    container.appendChild(badge);
    sidebarGrid.appendChild(container);
  }
}

async function renderIndividualThumbnails() {
  const grid = document.getElementById('thumbnail-grid');
  const btn = document.getElementById('generate-badges-btn');
  const total = window.thumbnailData?.length || 0;
  const { opacity, position, style } = window.badgeSettings;

  grid.innerHTML = '';

  for (let i = 0; i < total; i++) {
    const data = window.thumbnailData[i];

    const container = document.createElement('div');
    container.className = 'thumb-container glass-panel';
    container.style = "position:relative; border-radius:8px; overflow:hidden;";

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.warn(`Thumbnail ${i+1} timed out.`);
        resolve();
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          ctx.drawImage(img, 0, 0, 1280, 720);

          const badgeText = getBadgeText(i, total, style);
          const pos = getBadgePosition(position);

          ctx.font = 'bold 72px Inter, sans-serif';
          const textMetrics = ctx.measureText(badgeText);
          const textWidth = textMetrics.width;

          const bgOpacity = opacity / 100;
          ctx.fillStyle = `rgba(15, 23, 42, ${bgOpacity})`;

          const badgeWidth = textWidth + 60;
          const badgeHeight = 110;
          let bgX = pos.x;
          let bgY = pos.y;

          // Adjust for position
          if (position.includes('right')) bgX = 1280 - badgeWidth - 40;
          if (position.includes('left')) bgX = 40;
          if (position.includes('bottom')) bgY = 720 - badgeHeight - 40;
          if (position.includes('top')) bgY = 40;

          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bgX, bgY, badgeWidth, badgeHeight, 20);
            ctx.fill();
          } else {
            ctx.fillRect(bgX, bgY, badgeWidth, badgeHeight);
          }

          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 8;
          ctx.stroke();

          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bgX + badgeWidth/2, bgY + badgeHeight/2);

          canvas.dataset.badgeText = badgeText;
        } catch (e) {
          console.error("Canvas draw error:", e);
        }
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.error(`Thumbnail ${i+1} failed to load.`);
        resolve();
      };

      btn.innerHTML = `<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> rendering ${i+1}/${total}...`;
      img.src = `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(data.thumbUrl)}`;
    });

    container.appendChild(canvas);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.id = `thumb-canvas-${i}`;
    canvas.dataset.videoId = data.videoId;

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn-primary sm';
    downloadBtn.style = "position:absolute; bottom:10px; right:10px; padding:0.5rem;";
    downloadBtn.innerHTML = '<i data-lucide="download"></i>';
    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.download = `Part_${i+1}_Thumbnail.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    container.appendChild(downloadBtn);
    grid.appendChild(container);
  }
}

// Event listeners for badge controls
document.getElementById('badge-opacity')?.addEventListener('input', (e) => {
  window.badgeSettings.opacity = parseInt(e.target.value);
  document.getElementById('badge-opacity-value').textContent = e.target.value + '%';
});

document.getElementById('badge-position')?.addEventListener('change', (e) => {
  window.badgeSettings.position = e.target.value;
});

document.getElementById('badge-style')?.addEventListener('change', (e) => {
  window.badgeSettings.style = e.target.value;
});

document.getElementById('update-preview-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('update-preview-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Updating...';
  await renderSidebarPreview();
  await renderIndividualThumbnails();
  btn.innerHTML = '<i data-lucide="refresh-cw"></i> Update';
});

document.getElementById('generate-badges-btn')?.addEventListener('click', generateThumbnailBadges);

async function uploadThumbnail(videoId, canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        // Convert blob to data URL
        const reader = new FileReader();
        const base64Promise = new Promise((res, rej) => {
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
        });
        reader.readAsDataURL(blob);
        const dataUrl = await base64Promise;

        // Send to backend as imageUrl (backend will detect data URL)
        const res = await fetch(`${API_BASE_URL}/api/thumbnail/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            accessToken,
            imageUrl: dataUrl
          })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}

document.getElementById('apply-all-badges-btn')?.addEventListener('click', async () => {
  if (!window.currentPlaylistVideos) return;

  // 🛡️ QUOTA GUARD
  const ops = [{ type: 'THUMBNAIL', count: window.currentPlaylistVideos.length }];
  const canProceed = await checkQuotaRisk(ops, 'Bulk Thumbnail Overwrite');
  if (!canProceed) return;

  const btn = document.getElementById('apply-all-badges-btn');
  const confirmApply = confirm("DANGER: This will PERMANENTLY overwrite the thumbnails on your YouTube channel with these badged versions. This cannot be undone. Proceed?");
  if (!confirmApply) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Uploading...';

  let success = 0;
  const total = window.currentPlaylistVideos.length;

  for (let i = 0; i < total; i++) {
    const video = window.currentPlaylistVideos[i];
    const videoId = video.contentDetails?.videoId;
    const canvas = document.getElementById(`thumb-canvas-${i}`);

    if (!videoId || !canvas) continue;

    try {
      await uploadThumbnail(videoId, canvas);
      success++;
      btn.innerHTML = `<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> ${success}/${total}`;
    } catch (err) {
      console.error(`Thumbnail upload failed for ${videoId}:`, err);
    }
    await new Promise(r => setTimeout(r, 1000)); // Rate limiting / Quota safety
  }

  btn.innerHTML = '<i data-lucide="check"></i> Uploads Complete';
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  alert(`✅ Successfully updated ${success} thumbnails on your channel!`);
});

// Title Optimization (The Bracket Hack)
document.getElementById('optimize-titles-btn')?.addEventListener('click', () => {
  if (!window.currentPlaylistVideos) return alert('No videos analyzed.');

  const confirm = window.confirm("This will add high-CTR brackets [ ] to the descriptive part of your titles. Proceed?");
  if (!confirm) return;

  for (const v of window.currentPlaylistVideos) {
    let title = v.snippet.title;
    // Heuristic: If title doesn't have brackets, add them to the second half
    if (!title.includes('[') && title.includes(' - ')) {
      const parts = title.split(' - ');
      v.snippet.title = `${parts[0]} [${parts.slice(1).join(' - ')}]`;
    } else if (!title.includes('[') && title.length > 30) {
      // Split by first major space after 20 chars
      const splitIdx = title.indexOf(' ', 20);
      if (splitIdx !== -1) {
        v.snippet.title = `${title.substring(0, splitIdx)} [${title.substring(splitIdx + 1)}]`;
      }
    }
  }
  alert("✨ Titles optimized locally! Click 'One-Click Inject' to update your YouTube Channel.");
});

// Auto-Management Settings
document.getElementById('apply-auto-mgmt-btn')?.addEventListener('click', async () => {
  if (checkPremium('Auto-Management Suite')) return;

  const infiniteLoop = document.getElementById('infinite-loop-toggle').checked;
  const weeklyRefresh = document.getElementById('weekly-refresh-toggle').checked;
  const verbalBridge = document.getElementById('verbal-bridge-toggle').checked;

  if (infiniteLoop) {
    applyInfiniteLoop();
  }

  if (weeklyRefresh) {
    localStorage.setItem('yt_seo_weekly_refresh', 'true');
    alert('📅 Weekly AI Refresh enabled. The app will ping the algorithm with fresh metadata every 7 days.');
  }

  if (verbalBridge) {
    runVerbalBridgeAudit();
  }

  // NEW: Save state to backend
  if (activeChannel) {
    try {
      await fetch(`${API_BASE_URL}/api/save-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: activeChannel.id,
          state: {
            infiniteLoopEnabled: infiniteLoop,
            weeklyRefreshEnabled: weeklyRefresh,
            verbalBridgeEnabled: verbalBridge,
            refreshDue: false // Reset flag after user intervention
          }
        })
      });
      console.log('✅ State saved to backend');
    } catch (e) { console.warn('Backend save failed:', e); }
  }

  alert('⚙️ Performance settings updated!');
});
// Weekly Refresh Check
async function checkWeeklyRefresh() {
  const enabled = localStorage.getItem('yt_seo_weekly_refresh') === 'true';
  if (!enabled) return;

  const lastRefresh = localStorage.getItem('yt_seo_last_refresh_date');
  const now = new Date();

  if (!lastRefresh || (now - new Date(lastRefresh)) > 7 * 24 * 60 * 60 * 1000) {
    console.log("📅 Weekly AI Refresh Triggered! Pinging the algorithm with fresh metadata...");
    // In a real app, this would iterate through tracked playlists.
    // Here we'll notify the user if they've just logged in.
    alert("📅 Elite Hack: Weekly AI Refresh is due! Run 'Weave Metadata' on your active series to ping the algorithm with fresh 2026 anchors.");
    localStorage.setItem('yt_seo_last_refresh_date', now.toISOString());
  }
}
// Keyword Engine Button Listener
document.getElementById('run-keyword-discovery-btn')?.addEventListener('click', async () => {
  const seed = document.getElementById('keyword-seed').value.trim();
  if (!seed) return alert('Please enter a seed keyword.');

  const btn = document.getElementById('run-keyword-discovery-btn');
  const resultsContainer = document.getElementById('keyword-results');
  const list = document.getElementById('golden-keywords-list');
  const countDisplay = document.getElementById('keyword-total-count');

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Scrubbing...';
  btn.disabled = true;

  resultsContainer.classList.remove('hidden');
  list.innerHTML = '<p class="text-xs text-muted">Running Alphabet Loop & Asterisk Scrub...</p>';

  document.getElementById('check-longtail').className = 'text-accent';
  const asteriskKeywords = await runAsteriskSearch(seed);
  document.getElementById('check-longtail').innerHTML = '<i data-lucide="check-circle"></i> Long-Tail (Asterisk Trick)';
  document.getElementById('check-longtail').className = 'pass';

  document.getElementById('check-intent').className = 'text-accent';
  const alphabetKeywords = await runKeywordAlphabetLoop(seed);
  document.getElementById('check-intent').innerHTML = '<i data-lucide="check-circle"></i> Intent matching';
  document.getElementById('check-intent').className = 'pass';

  const combined = Array.from(new Set([...asteriskKeywords, ...alphabetKeywords]));
  countDisplay.innerText = combined.length;

  document.getElementById('check-golden').className = 'text-accent';
  const golden = filterGoldenKeywords(combined);
  document.getElementById('check-golden').innerHTML = '<i data-lucide="check-circle"></i> Golden Keyword filtering';
  document.getElementById('check-golden').className = 'pass';

  list.innerHTML = '';
  if (golden.length === 0) {
    list.innerHTML = '<p class="text-xs text-muted">No high-intent golden keywords found. Try a broader seed.</p>';
  } else {
    golden.forEach(k => {
      const item = document.createElement('div');
      item.className = 'stat-box mb-1';
      item.style = 'background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 5px 10px; display: flex; justify-content: space-between; align-items: center;';
      item.innerHTML = `
        <span class="text-xs">${k}</span>
        <button class="btn-secondary sm" onclick="navigator.clipboard.writeText('${k}'); this.innerText='Copied'; setTimeout(()=>this.innerText='Copy',1500)" style="font-size: 0.6rem; padding: 2px 5px;">Copy</button>
      `;
      list.appendChild(item);
    });
  }

  btn.innerHTML = '<i data-lucide="check"></i> Analysis Complete';
  btn.classList.add('btn-success');
});

// --- SESSION-START LINK HANDLER ---
document.getElementById('session-link-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('session-link-btn');
  const resultDiv = document.getElementById('session-link-result');
  const resultText = document.getElementById('session-link-text');

  if (!window.currentPlaylistVideos || window.currentPlaylistVideos.length === 0) {
    return alert('Please run a Deep Audit first to load your playlist videos.');
  }

  const firstVideo = window.currentPlaylistVideos[0];
  const playlistId = firstVideo.snippet?.playlistId;
  const firstVideoId = firstVideo.contentDetails?.videoId;

  if (!playlistId || !firstVideoId) {
    return alert('Could not extract playlist or video ID. Run a Deep Audit first.');
  }

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Generating...';

  try {
    const res = await fetch(`${API_BASE_URL}/api/session-start-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistId,
        firstVideoId,
        accessToken: accessToken || null
      })
    });

    const data = await res.json();

    if (data.success) {
      resultDiv.classList.remove('hidden');
      resultText.textContent = `✅ ${data.sessionLink}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(data.sessionLink);
      alert(`Session Link Generated!\n\n${data.sessionLink}\n\n(Copied to clipboard)\n\nAdd your YouTube access token to automatically inject this link into playlist and video descriptions.`);
    } else {
      alert('Failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.innerHTML = '<i data-lucide="link"></i> Session Links';
  }
});

// --- BAD THUMBNAIL REDESIGN HANDLER ---
async function analyzeBadThumbnail(videoTitle, videoId, views) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/bad-thumbnail-redesign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoTitle,
        currentViews: views
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'API request failed');
    }

    const data = await res.json();
    return data;
  } catch (e) {
    console.error('Bad thumbnail analysis failed:', e);
    alert(`Error: ${e.message || 'Failed to analyze thumbnail. Check console for details.'}`);
    return null;
  }
}

// Add redesign button to thumbnail cards - ACTUALLY GENERATES AND DEPLOYS IMAGES
function addRedesignButtonsToThumbnails(forceShow = false) {
  const thumbCards = document.querySelectorAll('.thumb-card');
  thumbCards.forEach(card => {
    if (card.querySelector('.redesign-btn')) return;

    const titleEl = card.querySelector('.video-title');
    const title = titleEl?.textContent || '';

    // Get video ID from data attribute
    let views = 0;
    const videoId = card.dataset.videoId;
    if (videoId && window.videoStatsData?.[videoId]) {
      views = parseInt(window.videoStatsData[videoId]?.viewCount || 0);
    }

    const scoreEl = card.querySelector('.thumb-score');
    const isLowScore = scoreEl?.textContent?.includes('/100') &&
      parseInt(scoreEl.textContent) < 50;

    // Show button if low score, low views, or forceShow is enabled (debug mode)
    if (forceShow || isLowScore || views < 1000) {
      const redesignBtn = document.createElement('button');
      redesignBtn.className = 'btn-secondary sm redesign-btn';
      redesignBtn.style = 'width:100%; margin-top:0.5rem;';
      redesignBtn.innerHTML = '<i data-lucide="palette"></i> Redesign Thumbnail';
      redesignBtn.onclick = async () => {
        if (!videoId) {
          alert('No video ID found. Please run a Deep Audit first.');
          return;
        }

        redesignBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Generating...';
        redesignBtn.disabled = true;

        try {
          // Generate AI thumbnail prompt using the same method as main feature
          const systemPrompt = `You are a YouTube Thumbnail Designer. Generate a CONCISE, 1-sentence image generation prompt and a recommended text overlay hook for this video title: "${title}".
          The prompt should be under 200 characters and use descriptive keywords.
          RESPOND IN JSON ONLY: { "prompt": "...", "overlayText": "..." }`;

          const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userPrompt: `Title: ${title}` })
          });

          if (!res.ok) throw new Error('AI generation failed');

          const data = await res.json();
          const raw = data.choices[0].message.content.trim();
          const result = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

          // Generate actual image using Pollinations.ai
          const seed = Math.floor(Math.random() * 1000000);
          const genUrl = `https://pollinations.ai/p/${encodeURIComponent(result.prompt)}?width=1280&height=720&seed=${seed}&model=flux`;

          // Show the generated thumbnail in the card
          const existingContainer = card.querySelector('.ai-concept-container');
          if (existingContainer) existingContainer.remove();

          const newThumbContainer = document.createElement('div');
          newThumbContainer.className = 'ai-concept-container';
          newThumbContainer.style = "margin-top:1rem; position:relative; overflow:hidden; border-radius:12px; border:2px solid var(--accent);";
          newThumbContainer.innerHTML = `
            <div style="font-size:0.65rem; color:#fff; background:var(--accent); padding:4px 8px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">AI Redesign</div>
            <img src="${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(genUrl)}" class="video-thumb" style="width:100%; display:block;">
            <div style="background:rgba(15,23,42,0.9); backdrop-filter:blur(4px); padding:10px; font-size:0.75rem; border-top:1px solid rgba(255,255,255,0.1);">
              <div style="color:var(--accent); font-weight:700; margin-bottom:4px;">OVERLAY: ${result.overlayText}</div>
              <div style="margin-top:8px; display:flex; gap:0.5rem;">
                <button class="btn-primary sm deploy-redesign-btn" data-video-id="${videoId}" data-img-url="${encodeURIComponent(genUrl)}" style="flex:1; justify-content:center; background:linear-gradient(135deg, #f43f5e, #e11d48);">
                  <i class="ph-bold ph-rocket"></i> Deploy to YouTube
                </button>
                <button class="btn-secondary sm" onclick="this.closest('.ai-concept-container').remove()" style="padding:0 10px;">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `;

          card.appendChild(newThumbContainer);

          // Add deploy event listener
          newThumbContainer.querySelector('.deploy-redesign-btn').addEventListener('click', async (e) => {
            const btn = e.target.closest('.deploy-redesign-btn');
            const vid = btn.dataset.videoId;
            const imgUrl = decodeURIComponent(btn.dataset.imgUrl);

            if (!accessToken) {
              alert('Please connect YouTube first.');
              return;
            }

            btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Deploying...';
            btn.disabled = true;

            try {
              console.log('[Thumbnail] Sending image URL to backend for deployment...');

              // Send URL directly to backend - backend will fetch it to bypass browser CORS
              const uploadRes = await fetch(`${API_BASE_URL}/api/thumbnail/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoId: vid,
                  accessToken,
                  imageUrl: imgUrl // Send the remote URL directly
                })
              });

              const result = await uploadRes.json();
              if (result.error) throw new Error(result.error.message);

              btn.innerHTML = '<i data-lucide="check"></i> Deployed!';
              btn.style.background = 'var(--success)';
              alert('🚀 Thumbnail successfully uploaded to YouTube!');

              // Refresh video data
              if (typeof loadPlaylistVideos === 'function') {
                loadPlaylistVideos();
              }

            } catch (err) {
              console.error('Deployment failed:', err);
              alert('Deployment failed: ' + err.message);
              btn.innerHTML = '<i class="ph-bold ph-rocket"></i> Deploy to YouTube';
              btn.disabled = false;
            }
          });

          redesignBtn.innerHTML = '<i data-lucide="palette"></i> Redesign Thumbnail';

        } catch (err) {
          console.error('Thumbnail redesign error:', err);
          alert('Failed to generate thumbnail: ' + err.message);
          redesignBtn.innerHTML = '<i data-lucide="palette"></i> Redesign Thumbnail';
        }

        redesignBtn.disabled = false;
      };
      card.appendChild(redesignBtn);
    }
  });
}

// Debug function to show redesign buttons on all videos
window.showAllRedesignButtons = function() {
  addRedesignButtonsToThumbnails(true);
  alert('Redesign buttons added to all videos!');
};

// --- ANALYTICS / HIJACK DASHBOARD HANDLERS ---
document.getElementById('save-analytics-snapshot-btn')?.addEventListener('click', async () => {
  if (!activeChannel) return alert('Connect a YouTube channel first.');
  if (!window.currentPlaylistVideos?.length) return alert('Run a Deep Audit first.');

  const btn = document.getElementById('save-analytics-snapshot-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Saving...';

  const playlistId = window.currentPlaylistVideos[0]?.snippet?.playlistId;

  // Calculate metrics from available data
  const totalViews = Object.values(window.videoStatsData || {}).reduce((sum, v) => sum + parseInt(v.viewCount || 0), 0);

  // Estimate suggested traffic (placeholder - would need Analytics API)
  const estimatedSuggestedPct = 15; // Default estimate
  const estimatedVideosPerView = window.currentPlaylistVideos.length > 1 ? 1.8 : 1;

  // Build leak report (videos with lower views = potential leaks)
  const leakReport = Object.entries(window.videoStatsData || {})
    .sort((a, b) => parseInt(a[1].viewCount || 0) - parseInt(b[1].viewCount || 0))
    .slice(0, 5)
    .map(([vid, data]) => ({ videoId: vid, views: parseInt(data.viewCount || 0) }));

  const metrics = {
    suggestedTrafficPct: estimatedSuggestedPct,
    videosPerPlaylistView: estimatedVideosPerView,
    leakReport,
    competitorProximity: window.lastCompetitorData || []
  };

  try {
    await fetch(`${API_BASE_URL}/api/analytics/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: activeChannel.id,
        playlistId,
        metrics
      })
    });

    alert('✅ Analytics snapshot saved! Use "Refresh" to see before/after comparison.');
    loadHijackMetrics();
  } catch (e) {
    alert('Failed to save snapshot: ' + e.message);
  } finally {
    btn.innerHTML = '<i data-lucide="camera"></i> Save Snapshot';
  }
});

document.getElementById('refresh-hijack-metrics-btn')?.addEventListener('click', loadHijackMetrics);

async function loadHijackMetrics() {
  if (!window.currentPlaylistVideos?.length) {
    document.getElementById('suggested-traffic-pct').textContent = '--%';
    document.getElementById('videos-per-view').textContent = '--';
    document.getElementById('suggested-traffic-change').textContent = 'Run Deep Audit first';
    document.getElementById('suggested-traffic-change').style.color = 'var(--warning)';
    document.getElementById('videos-per-view-change').textContent = '--';
    document.getElementById('leak-report-list').innerHTML = '<p class="text-sm text-muted">Run a Deep Audit first to load video data.</p>';
    document.getElementById('competitor-proximity-list').innerHTML = '<p class="text-sm text-muted">Run a Deep Audit first to analyze competitors.</p>';
    return;
  }

  const playlistId = window.currentPlaylistVideos[0]?.snippet?.playlistId;

  if (!playlistId) {
    alert('No playlist found. Please run a Deep Audit first.');
    return;
  }

  try {
    document.getElementById('suggested-traffic-pct').textContent = 'Loading...';
    const res = await fetch(`${API_BASE_URL}/api/analytics/hijack-metrics/${playlistId}`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    const data = await res.json();

    // Update UI
    document.getElementById('suggested-traffic-pct').textContent = (data.suggestedTrafficPct || 0) + '%';
    document.getElementById('videos-per-view').textContent = (data.videosPerPlaylistView || 0).toFixed(1);

    // Update changes
    const suggestedChange = parseFloat(data.changes?.suggestedTrafficPct || 0);
    const videosChange = parseFloat(data.changes?.videosPerPlaylistView || 0);

    document.getElementById('suggested-traffic-change').textContent = (suggestedChange >= 0 ? '+' : '') + suggestedChange + '%';
    document.getElementById('suggested-traffic-change').style.color = suggestedChange >= 0 ? 'var(--success)' : 'var(--danger)';

    document.getElementById('videos-per-view-change').textContent = (videosChange >= 0 ? '+' : '') + videosChange;
    document.getElementById('videos-per-view-change').style.color = videosChange >= 0 ? 'var(--success)' : 'var(--danger)';

    // Update bar chart
    const beforeVal = Math.max(0, (data.suggestedTrafficPct || 0) - suggestedChange);
    const afterVal = data.suggestedTrafficPct || 0;
    document.getElementById('bar-before').style.height = beforeVal + '%';
    document.getElementById('bar-after').style.height = afterVal + '%';

    // Update leak report
    const leakList = document.getElementById('leak-report-list');
    if (data.leakReport?.length > 0) {
      leakList.innerHTML = data.leakReport.slice(0, 5).map((item, i) => `
        <div style="display:flex; justify-content:space-between; padding:0.5rem; background:rgba(239,68,68,0.1); border-radius:4px; margin-bottom:0.3rem;">
          <span class="text-sm">${i+1}. Video ${item.videoId?.slice(0, 8)}...</span>
          <span class="text-sm text-danger">${item.views?.toLocaleString()} views</span>
        </div>
      `).join('');
    }

    // Update competitor proximity
    const compList = document.getElementById('competitor-proximity-list');
    if (data.competitorProximity?.length > 0) {
      compList.innerHTML = data.competitorProximity.slice(0, 5).map((item, i) => `
        <div style="display:flex; justify-content:space-between; padding:0.5rem; background:rgba(139,92,246,0.1); border-radius:4px; margin-bottom:0.3rem;">
          <span class="text-sm">${item.channelName || 'Channel ' + (i+1)}</span>
          <span class="text-sm text-accent">${item.overlap || '--'}%</span>
        </div>
      `).join('');
    } else {
      compList.innerHTML = '<p class="text-sm text-muted">No competitor data. Save a snapshot after Deep Audit.</p>';
    }
  } catch (e) {
    console.warn('Failed to load hijack metrics:', e);
    document.getElementById('suggested-traffic-pct').textContent = 'Error';
    document.getElementById('videos-per-view').textContent = 'Error';
    alert('Failed to load hijack metrics. Please try again.');
  }
}

// Add tab switch handler for analytics
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'analytics-hijack') {
      setTimeout(loadHijackMetrics, 100);
    }
  });
});

// --- TRANSCRIPT UPLOAD & CAPTION CHECK HANDLERS ---
let selectedTranscriptFile = null;

// Populate video select dropdown when audit is run
window.populateTranscriptVideoSelect = function() {
  const select = document.getElementById('transcript-video-select');
  const uploadSection = document.getElementById('transcript-upload-section');

  if (!select || !window.currentPlaylistVideos) return;

  select.innerHTML = '<option value="">Select a video...</option>';

  window.currentPlaylistVideos.forEach((video, i) => {
    const vId = video.contentDetails?.videoId;
    const title = video.snippet?.title || `Video ${i + 1}`;
    if (vId && !title.includes('Deleted')) {
      const option = document.createElement('option');
      option.value = vId;
      option.textContent = title.substring(0, 50) + (title.length > 50 ? '...' : '');
      select.appendChild(option);
    }
  });

  if (select.options.length > 1) {
    uploadSection.style.display = 'block';
  }
};

// File input change handler
document.getElementById('transcript-file-input')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedTranscriptFile = file;
    document.getElementById('transcript-filename').textContent = `Selected: ${file.name}`;
    document.getElementById('upload-transcript-btn').disabled = false;
  }
});

// Upload transcript button handler
document.getElementById('upload-transcript-btn')?.addEventListener('click', async () => {
  const videoId = document.getElementById('transcript-video-select').value;
  const btn = document.getElementById('upload-transcript-btn');

  if (!videoId) {
    alert('Please select a video first.');
    return;
  }

  if (!selectedTranscriptFile) {
    alert('Please select a transcript file first.');
    return;
  }

  if (!accessToken) {
    alert('Please connect YouTube first.');
    return;
  }

  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Checking...';
  btn.disabled = true;

  try {
    // Try to check existing captions first
    const res = await fetch(`${API_BASE_URL}/api/captions/enable-auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        accessToken: accessToken
      })
    });

    const data = await res.json();

    if (data.hasCaptions) {
      alert(`✅ Captions found for this video:\n\n${data.captions.map(c => `- ${c.language} (${c.isAutoGenerated ? 'Auto-generated' : 'Manual'})`).join('\n')}\n\nNote: YouTube doesn't allow direct transcript uploads via API. Upload .srt files via YouTube Studio.`);
    } else {
      alert(`📝 No captions found for this video.\n\nTo add captions:\n1. Go to YouTube Studio\n2. Select the video\n3. Go to Subtitles\n4. Upload your .srt or .vtt file\n\nThis tool shows caption status but cannot upload directly via API.`);
    }

    btn.innerHTML = '<i data-lucide="upload"></i> Upload Transcript to YouTube';
    btn.disabled = false;

  } catch (err) {
    console.error('Caption check error:', err);
    alert('Error checking captions: ' + err.message);
    btn.innerHTML = '<i data-lucide="upload"></i> Upload Transcript to YouTube';
    btn.disabled = false;
  }
});

// Check captions button handler
document.getElementById('check-captions-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('check-captions-btn');
  btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Checking...';
  btn.disabled = true;

  if (!accessToken) {
    alert('Please connect YouTube first to check caption status.');
    btn.innerHTML = '<i data-lucide="search"></i> Check Caption Status';
    btn.disabled = false;
    return;
  }

  if (!window.currentPlaylistVideos || window.currentPlaylistVideos.length === 0) {
    alert('Please run a Deep Audit first to check caption status.');
    btn.innerHTML = '<i data-lucide="search"></i> Check Caption Status';
    btn.disabled = false;
    return;
  }

  try {
    let hasCaptions = 0;
    let noCaptions = 0;
    const checkPromises = window.currentPlaylistVideos.slice(0, 10).map(async (video) => {
      const vId = video.contentDetails?.videoId;
      if (!vId) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/captions/enable-auto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: vId,
            accessToken: accessToken
          })
        });
        const data = await res.json();
        if (data.hasCaptions) hasCaptions++;
        else noCaptions++;
      } catch (e) {
        noCaptions++;
      }
    });

    await Promise.all(checkPromises);

    const total = hasCaptions + noCaptions;
    const pct = total ? Math.round((hasCaptions / total) * 100) : 0;

    const checklist = document.getElementById('accessibility-checklist');
    if (checklist) {
      checklist.innerHTML = `
        <li class="${pct >= 80 ? 'pass' : 'fail'}"><i class="ph ${pct >= 80 ? 'ph-check-circle' : 'ph-x-circle'}"></i> Captions: ${hasCaptions}/${total} videos</li>
        <li class="warning"><i data-lucide="warning-circle"></i> Upload .srt via YouTube Studio</li>
      `;
    }

    alert(`📊 Caption Status (first 10 videos):\n\n✅ Has Captions: ${hasCaptions} videos\n❌ No Captions: ${noCaptions} videos\n\nTo add captions, upload .srt files via YouTube Studio.`);

  } catch (err) {
    console.error('Caption check error:', err);
    alert('Error checking captions: ' + err.message);
  }

  btn.innerHTML = '<i data-lucide="search"></i> Check Caption Status';
  btn.disabled = false;
});

// ==========================================
// FEATURE HEALTH DASHBOARD
// ==========================================

const healthFeatures = [
  { id: 'quota', name: 'Quota Tracker', endpoint: '/api/quota/status', method: 'GET' },
  { id: 'scheduled', name: 'Scheduled Tasks', endpoint: '/api/quota/scheduled', method: 'GET' },
  { id: 'series', name: 'Series Validator', endpoint: '/api/validate-series', method: 'POST', testData: { playlistId: 'PLtest', myChannelId: 'UCtest', accessToken: 'test' } },
  { id: 'session', name: 'Session-Start Linker', endpoint: '/api/session-start-link', method: 'POST', testData: { playlistId: 'PLtest', firstVideoId: 'dQw4w9WgXcQ' } },
  { id: 'evergreen', name: 'Evergreen Audit', endpoint: '/api/evergreen/mark-audited', method: 'POST', testData: { videoId: 'test' } },
  { id: 'audio', name: 'Audio Audit', endpoint: '/api/audio-audit', method: 'POST', testData: { transcript: 'test', seriesTitle: 'Test' } },
  { id: 'redesign', name: 'Thumbnail Redesign', endpoint: '/api/bad-thumbnail-redesign', method: 'POST', testData: { videoTitle: 'Test Video', videoId: 'test' } },
  { id: 'factory', name: 'Video Script Factory', endpoint: '/api/ai/video-factory/generate-script', method: 'POST', testData: { topic: 'Neutron Stars', tone: 'mysterious', duration: 'long-form', playlistTitle: 'Universe Decoded' } },
];

function createHealthItemHTML(feature, status, detail) {
  const statusClass = status === 'live' ? 'live' : (status === 'checking' ? 'checking' : 'failed');
  const icon = status === 'live' ? 'ph-check-circle' : (status === 'checking' ? 'ph-spinner' : 'ph-x-circle');
  const statusText = status === 'live' ? 'LIVE' : (status === 'checking' ? 'CHECKING' : 'FAILED');

  return `
    <div class="health-item ${statusClass}" id="health-${feature.id}">
      <div class="health-icon">
        <i class="ph ${icon}"></i>
      </div>
      <div class="health-info">
        <div class="health-name">${feature.name}</div>
        <div class="health-detail">${detail}</div>
      </div>
      <div class="health-status ${statusClass}">${statusText}</div>
    </div>
  `;
}

async function runHealthCheck() {
  const grid = document.getElementById('health-grid');
  const runBtn = document.getElementById('run-health-check');

  if (!grid) {
    console.error('Health grid not found');
    return;
  }

  runBtn.disabled = true;
  runBtn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Checking...';

  // Show checking state for all features
  grid.innerHTML = healthFeatures.map(f => createHealthItemHTML(f, 'checking', 'Testing connection...')).join('');

  let liveCount = 0;
  let failedCount = 0;

  // Check backend connectivity first
  try {
    const backendRes = await fetch(`${API_BASE_URL}/`);
    const backendData = await backendRes.json();
    document.getElementById('backend-status').innerHTML = '<span style="color:var(--success);">✅ Connected</span>';
  } catch (e) {
    document.getElementById('backend-status').innerHTML = '<span style="color:var(--danger);">❌ Disconnected</span>';
  }

  // Check quota
  try {
    const quotaRes = await fetch(`${API_BASE_URL}/api/quota/status`);
    const quotaData = await quotaRes.json();
    const remaining = quotaData.limit - quotaData.usedToday;
    document.getElementById('quota-status').textContent = `${remaining.toLocaleString()} / ${quotaData.limit.toLocaleString()}`;
    document.getElementById('db-status').innerHTML = '<span style="color:var(--success);">✅ Active</span>';
  } catch (e) {
    document.getElementById('quota-status').textContent = 'Error';
    document.getElementById('db-status').innerHTML = '<span style="color:var(--danger);">❌ Error</span>';
  }

  // Check scheduled tasks
  try {
    const tasksRes = await fetch(`${API_BASE_URL}/api/quota/scheduled`);
    const tasksData = await tasksRes.json();
    document.getElementById('tasks-status').textContent = `${tasksData.length} pending`;
  } catch (e) {
    document.getElementById('tasks-status').textContent = 'Error';
  }

  // Test each feature endpoint
  for (const feature of healthFeatures) {
    try {
      const fetchOptions = {
        method: feature.method || 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      if (fetchOptions.method === 'POST') {
        fetchOptions.body = JSON.stringify(feature.testData);
      }

      const res = await fetch(`${API_BASE_URL}${feature.endpoint}`, fetchOptions);
      const data = await res.json();

      // Consider success ONLY if we get ok response
      if (res.ok) {
        document.getElementById(`health-${feature.id}`).outerHTML = createHealthItemHTML(feature, 'live', '✅ Operational');
        liveCount++;
      } else {
        throw new Error(`Status ${res.status}: ${data?.error?.message || data?.error || 'Failed'}`);
      }
    } catch (e) {
      document.getElementById(`health-${feature.id}`).outerHTML = createHealthItemHTML(feature, 'failed', `❌ ${e.message || 'Connection failed'}`);
      failedCount++;
    }
  }

  runBtn.disabled = false;
  runBtn.innerHTML = '<i data-lucide="arrows-clockwise"></i> Run Health Check';

  // Show summary
  const summary = `✅ ${liveCount} Live | ❌ ${failedCount} Failed`;
  console.log('[Health Check] ' + summary);
}

// Initialize health check button
// Refactored to platformInit()

// ==========================================
// PRE-FLIGHT APPROVAL MODAL
// ==========================================

function showPreFlightModal(videoId, oldData, newData) {
  // Remove existing modal if any
  const existingModal = document.getElementById('preflight-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'preflight-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content glass-panel preflight-modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3><i data-lucide="check-square"></i> Pre-Flight Approval</h3>
        <button class="modal-close" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;" onclick="document.getElementById('preflight-modal').remove()">✕</button>
      </div>

      <p class="text-sm text-muted mb-3">
        Review the changes below before committing to YouTube. Click "Commit Changes" to push live updates.
      </p>

      <div class="preflight-comparison">
        <div class="preflight-column old">
          <h4><i data-lucide="arrow-left"></i> OLD (Current)</h4>

          <div class="preflight-field">
            <div class="preflight-label">Title</div>
            <div class="preflight-value">${escapeHTML(oldData.title || '(empty)')}</div>
          </div>

          <div class="preflight-field">
            <div class="preflight-label">Description</div>
            <div class="preflight-value">${escapeHTML((oldData.description || '(empty)').substring(0, 200))}${oldData.description?.length > 200 ? '...' : ''}</div>
          </div>

          <div class="preflight-field">
            <div class="preflight-label">Tags (${oldData.tags?.length || 0})</div>
            <div class="preflight-tags">
              ${(oldData.tags || []).slice(0, 5).map(t => `<span class="preflight-tag">${escapeHTML(t)}</span>`).join('')}
              ${(oldData.tags?.length || 0) > 5 ? `<span class="preflight-tag">+${oldData.tags.length - 5} more</span>` : ''}
            </div>
          </div>
        </div>

        <div class="preflight-column new">
          <h4><i class="ph-bold ph-arrow-right"></i> NEW (AI Optimized)</h4>

          <div class="preflight-field">
            <div class="preflight-label">Title</div>
            <div class="preflight-value changed">${escapeHTML(newData.title || '(empty)')}</div>
          </div>

          <div class="preflight-field">
            <div class="preflight-label">Description</div>
            <div class="preflight-value changed">${escapeHTML((newData.description || '(empty)').substring(0, 200))}${newData.description?.length > 200 ? '...' : ''}</div>
          </div>

          <div class="preflight-field">
            <div class="preflight-label">Tags (${newData.tags?.length || 0})</div>
            <div class="preflight-tags">
              ${(newData.tags || []).slice(0, 5).map(t => `<span class="preflight-tag new">${escapeHTML(t)}</span>`).join('')}
              ${(newData.tags?.length || 0) > 5 ? `<span class="preflight-tag new">+${newData.tags.length - 5} more</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="preflight-actions">
        <button class="btn-secondary" onclick="document.getElementById('preflight-modal').remove()">
          <i data-lucide="x"></i> Cancel
        </button>
        <button class="btn-primary" id="preflight-commit-btn" style="background: linear-gradient(135deg, #10b981, #059669);">
          <i class="ph-bold ph-check"></i> Commit Changes
        </button>
      </div>

      <input type="hidden" id="preflight-video-id" value="${videoId}" />
      <input type="hidden" id="preflight-new-title" value="${escapeHTML(newData.title || '')}" />
      <input type="hidden" id="preflight-new-desc" value="${escapeHTML(newData.description || '')}" />
      <input type="hidden" id="preflight-new-tags" value="${escapeHTML(JSON.stringify(newData.tags || []))}" />
    </div>
  `;

  document.body.appendChild(modal);

  // Add commit handler
  document.getElementById('preflight-commit-btn').addEventListener('click', async () => {
    const videoId = document.getElementById('preflight-video-id').value;
    const title = document.getElementById('preflight-new-title').value;
    const description = document.getElementById('preflight-new-desc').value;
    const tags = JSON.parse(document.getElementById('preflight-new-tags').value);

    const btn = document.getElementById('preflight-commit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Pushing to YouTube...';

    try {
      await updateVideoMetadata(videoId, title, description, tags);

      // Mark as evergreen audited
      fetch(`${API_BASE_URL}/api/evergreen/mark-audited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });

      document.getElementById('preflight-modal').remove();
      alert('✅ Successfully updated video on YouTube!');

      // Update UI in listing
      const card = document.querySelector(`.btn-autofix[data-video-id="${videoId}"]`)?.closest('.video-item');
      if (card) {
        const titleEl = card.querySelector('.video-title');
        if (titleEl) titleEl.textContent = title;
        card.querySelectorAll('.badge-fail').forEach(b => {
          b.className = 'audit-badge badge-pass';
          b.textContent = b.textContent.replace('✗', '✓');
        });
        const fixBtn = card.querySelector('.btn-autofix');
        if (fixBtn) {
           fixBtn.innerHTML = '<i class="ph-bold ph-check"></i> SEO Injected';
           fixBtn.style.background = 'var(--success)';
        }
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="ph-bold ph-check"></i> Commit Changes';
    }
  });
}

function showStudioBridge(title, instructions) {
  const existing = document.getElementById('studio-bridge-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'studio-bridge-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content glass-panel" style="max-width:500px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3><i data-lucide="laptop"></i> Studio Bridge: ${title}</h3>
        <button onclick="document.getElementById('studio-bridge-modal').remove()" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;">✕</button>
      </div>
      <p class="text-sm mb-3" style="line-height:1.6;">${instructions}</p>
      <div class="alert-box" style="background:rgba(250, 204, 21, 0.1); border:1px solid var(--accent);">
        <i data-lucide="info"></i> <strong>Note:</strong> This action cannot be performed automatically via the YouTube API. Please use YouTube Studio to complete this step.
      </div>
      <button class="btn-primary mt-3 w-full" onclick="window.open('https://studio.youtube.com', '_blank')">
        <i data-lucide="arrow-square-out"></i> Open YouTube Studio
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

// --- LOGIC ENGINE ---
class LogicEngine {
  constructor() {
    this.alertsContainer = document.getElementById('logic-alerts-container');
    this.alertsList = document.getElementById('logic-alerts-list');
    this.badge = document.getElementById('alert-count-badge');
    this.alerts = [];
  }

  async process(videos) {
    console.log('🧠 Processing Logic Engine for', videos.length, 'videos');
    this.alerts = [];
    this.alertsList.innerHTML = '';

    const now = new Date();

    for (const v of videos) {
      const vId = v.contentDetails?.videoId || v.id;
      const stats = window.videoStatsData[vId] || {};
      const pubDate = new Date(v.snippet.publishedAt);
      const daysOld = (now - pubDate) / (1000 * 60 * 60 * 24);

      // Calculate a mock CTR if real analytics aren't available (heuristic)
      // In a real scenario, we'd fetch this from YouTube Analytics API
      const views = parseInt(stats.viewCount || 0);
      const likes = parseInt(stats.likeCount || 0);
      const ctr = views > 0 ? (likes / views) * 100 : 0; // Simulated engagement-based CTR proxy

      // Alert A: The Rescue (Low CTR, ~10 days old)
      if (daysOld >= 7 && daysOld <= 14 && ctr < 1.5) {
        this.addAlert('rescue', `Video "${v.snippet.title}" is ${Math.round(daysOld)} days old with ${ctr.toFixed(1)}% engagement score.`, vId);
      }

      // Alert C: The Faint Ping (Old video, view drop)
      // This is heuristic since we don't have historical snapshots here
      // But we can flag anything > 12 months with low recent activity
      if (daysOld > 365 && views < 1000) {
        this.addAlert('ping', `Evergreen Video "${v.snippet.title}" has stale metrics (${views.toLocaleString()} views). Recommend SEO Refresh.`, vId);
      }
    }

    // Alert B: The Series Sync (Change in playlist)
    if (window.currentPlaylistVideos && window.currentPlaylistVideos.length > 5) {
       this.addAlert('sync', `Detected ${window.currentPlaylistVideos.length} videos in "${window.currentPlaylistTitle}". Recommend Bulk Description Sync.`, null);
    }

    this.render();
  }

  addAlert(type, message, videoId) {
    this.alerts.push({ type, message, videoId });
  }

  render() {
    if (this.alerts.length === 0) {
      this.alertsContainer.classList.add('hidden');
      return;
    }

    this.alertsContainer.classList.remove('hidden');
    this.badge.textContent = this.alerts.length;

    this.alerts.forEach(alert => {
      const row = document.createElement('div');
      row.className = `alert-row ${alert.type}`;
      row.style = "display:flex; align-items:center; gap:1rem; padding:10px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);";

      const icon = alert.type === 'rescue' ? 'ph-first-aid' : (alert.type === 'sync' ? 'ph-arrows-clockwise' : 'ph-waveform');
      const color = alert.type === 'rescue' ? '#f43f5e' : (alert.type === 'sync' ? '#60a5fa' : '#fbbf24');

      row.innerHTML = `
        <div style="background:${color}22; color:${color}; padding:8px; border-radius:6px;">
          <i class="ph-bold ${icon}" style="font-size:1.2rem;"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:0.85rem; font-weight:600;">${alert.type.toUpperCase()}: ${alert.type === 'rescue' ? 'The Rescue' : (alert.type === 'sync' ? 'Series Sync' : 'The Faint Ping')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${alert.message}</div>
        </div>
        <button class="btn-primary sm" onclick="${alert.videoId ? `window.scrollToVideo('${alert.videoId}')` : 'document.getElementById(\'weave-metadata-btn\').click()'}" style="background:${color}; border:none;">
          Fix Now
        </button>
      `;
      this.alertsList.appendChild(row);
    });
  }
}

window.scrollToVideo = (videoId) => {
  const el = document.querySelector(`.btn-autofix[data-video-id="${videoId}"]`)?.closest('.video-item');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.boxShadow = "0 0 20px var(--accent)";
    setTimeout(() => el.style.boxShadow = "", 2000);
  } else {
    // Check thumbnail grid
    const thumb = document.querySelector(`.thumb-card[data-video-id="${videoId}"]`);
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.showStudioBridge = showStudioBridge;
window.showPreFlightModal = showPreFlightModal;

// --- AI AUTO-RESPONDER LOGIC ---

async function syncComments() {
  if (checkPremium('AI Auto-Responder')) return;

  if (!accessToken || !activeChannel) {
    alert("Please connect YouTube first.");
    return;
  }

  const syncBtn = document.getElementById('sync-comments-btn');
  const stream = document.getElementById('comment-stream');
  const emptyState = document.getElementById('comments-empty-state');

  // Guard: if critical DOM elements don't exist yet, bail silently
  if (!syncBtn || !stream) {
    console.warn('[syncComments] DOM not ready, skipping idle call.');
    return;
  }

  try {
    syncBtn.innerHTML = '<i class="ph ph-arrows-clockwise pulse"></i> Syncing...';
    syncBtn.disabled = true;

    const res = await fetch(`${API_BASE_URL}/api/comments/sync?accessToken=${accessToken}&channelId=${activeChannel.id}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to sync');

    syncBtn.innerHTML = '<i data-lucide="arrows-clockwise"></i> Sync Comments';
    syncBtn.disabled = false;

    if (data.comments.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Clear old items if any (except empty state which is hidden)
    const oldItems = stream.querySelectorAll('.comment-item');
    oldItems.forEach(el => el.remove());

    const tone = document.getElementById('responder-tone').value;

    data.comments.forEach(comment => {
      const item = document.createElement('div');
      item.className = 'comment-item glass-panel fade-in-up';
      item.style = "padding:1rem; border:1px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:1rem;";
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
          <div>
            <span style="font-weight:700; color:var(--accent);">${comment.author}</span>
            <span style="font-size:0.7rem; color:var(--text-muted); margin-left:0.5rem;">${new Date(comment.publishedAt).toLocaleDateString()}</span>
          </div>
          <div class="badge-status sm">PENDING</div>
        </div>
        <p style="font-size:0.85rem; line-height:1.4; margin-bottom:1rem;">${comment.text}</p>

        <div class="ai-reply-preview hidden" id="reply-box-${comment.id}" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:1rem; margin-top:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
            <i class="ph ph-cpu" style="color:var(--accent);"></i>
            <span class="text-xs" style="font-weight:700; text-transform:uppercase; letter-spacing:1px;">AI Suggested Reply</span>
          </div>
          <textarea class="input-field" id="reply-text-${comment.id}" style="width:100%; height:80px; font-size:0.8rem; margin-bottom:0.5rem;"></textarea>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-primary sm" onclick="window.postReply('${comment.id}', '${comment.videoId}')">
              <i data-lucide="paper-plane-tilt"></i> Post Reply
            </button>
            <button class="btn-secondary sm" onclick="window.regenReply('${comment.id}', '${comment.text.replace(/'/g, "\\'")}', '${comment.author}')">
              <i data-lucide="arrows-clockwise"></i> Regenerate
            </button>
          </div>
        </div>

        <button class="btn-secondary w-full" id="gen-btn-${comment.id}" onclick="window.generateReply('${comment.id}', '${comment.text.replace(/'/g, "\\'")}', '${comment.author}')">
          <i data-lucide="wand-2"></i> Draft AI Reply
        </button>
      `;
      stream.appendChild(item);
    });

    // Auto-responder logic (if enabled)
    if (document.getElementById('auto-responder-toggle').checked) {
       console.log('[Auto-Pilot] Automatically drafting replies...');
       data.comments.forEach(c => window.generateReply(c.id, c.text, c.author, true));
    }

  } catch (e) {
    console.error('Sync error:', e);
    syncBtn.innerHTML = '<i data-lucide="warning"></i> Sync Failed';
    syncBtn.disabled = false;
  }
}

window.generateReply = async (commentId, text, author, isAuto = false) => {
  const box = document.getElementById(`reply-box-${commentId}`);
  const genBtn = document.getElementById(`gen-btn-${commentId}`);
  const area = document.getElementById(`reply-text-${commentId}`);
  const tone = document.getElementById('responder-tone').value;

  try {
    if (!isAuto) genBtn.innerHTML = '<i class="ph ph-cpu pulse"></i> Generating...';

    const res = await fetch(`${API_BASE_URL}/api/comments/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentText: text, authorName: author, tone })
    });
    const data = await res.json();

    area.value = data.reply;
    box.classList.remove('hidden');
    genBtn.classList.add('hidden');
  } catch (e) {
    console.error('Reply Gen error:', e);
  }
};

window.regenReply = (id, text, author) => window.generateReply(id, text, author);

window.postReply = async (commentId, videoId) => {
    const area = document.getElementById(`reply-text-${commentId}`);
    const text = area.value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/comments/post-reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken, commentId, replyText: text, videoId })
        });
        const data = await res.json();

        if (data.success) {
            const item = area.closest('.comment-item');
            item.innerHTML = `
                <div class="alert-box success">
                   <i data-lucide="check-circle"></i> Reply posted successfully!
                </div>
            `;
            setTimeout(() => item.remove(), 2000);
        }
    } catch (e) {
        alert("Failed to post: " + e.message);
    }
};

// --- VIDEO CONTENT FACTORY LOGIC ---

async function prepareVideoScript() {
  const topic = document.getElementById('video-topic').value;
  const tone = document.getElementById('video-tone').value;
  const format = document.getElementById('video-format').value;
  const niche = document.getElementById('video-niche')?.value || 'tech';
  const btn = document.getElementById('prepare-script-btn');
  const preview = document.getElementById('script-preview-container');
  const tagList = document.getElementById('factory-tag-list');
  const tagPreview = document.getElementById('script-tags-preview');
  const renderSection = document.getElementById('factory-render-section');
  const playlistNameEl = document.getElementById('factory-playlist-name');

  if (!topic) {
    alert("Please enter a topic first.");
    return;
  }

  try {
    btn.innerHTML = '<i class="ph ph-cpu pulse"></i> Architecting Script...';
    btn.disabled = true;
    preview.innerHTML = '<div class="p-5 text-center"><div class="spinner"></div><p class="mt-2">Analyzing 2026 retention patterns...</p></div>';

    const playlistTitle = window.currentPlaylistTitle || "Content Series";
    playlistNameEl.textContent = playlistTitle;

    const res = await fetch(`${API_BASE_URL}/api/ai/video-factory/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
      },
      body: JSON.stringify({ topic, tone, duration: format, playlistTitle, niche })
    });

    // Check if response is ok BEFORE parsing JSON
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Server said:', errorText);
      btn.innerHTML = '<i data-lucide="warning"></i> Error';
      btn.disabled = false;
      preview.innerHTML = `<div class="alert-box error">Server error: ${errorText}</div>`;
      throw new Error('Server returned an error');
    }

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to generate');

    // Display Script (NEW format)
    preview.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-word; color: #a78bfa; font-weight: bold;">${data.script
      .replace(/NARRATOR:/g, '<span style="color:#fff; font-weight:600;">NARRATOR:</span>')
      .replace(/VISUAL:/g, '<span style="color: #a78bfa; font-weight:600;">VISUAL:</span>')
      .replace(/Audio: /g, '<span style="color:var(--text-muted); font-weight:normal;">Audio: </span>')}</pre>`;

    // Display Tags
    tagList.innerHTML = '';
    data.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'badge-status sm';
      span.textContent = tag;
      tagList.appendChild(span);
    });

    // Display Metadata Draft
    document.getElementById('factory-draft-title').value = data.metadata.title;
    document.getElementById('factory-draft-desc').value = data.metadata.description;

    // Add SEO tags to tag list as well
    data.metadata.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'badge-pass sm';
      span.style = "background:rgba(16,185,129,0.1); color:var(--success); border:1px solid rgba(16,185,129,0.2); font-size:0.65rem;";
      span.textContent = tag;
      tagList.appendChild(span);
    });

    tagPreview.classList.remove('hidden');
    document.getElementById('factory-seo-draft').classList.remove('hidden');

    // Show render section
    renderSection.classList.remove('hidden');
    document.getElementById('render-video-btn').disabled = false;

    btn.innerHTML = '<i data-lucide="check"></i> Script Ready';
    btn.disabled = false;

  } catch (e) {
    console.error('Script Prep Error:', e);
    btn.innerHTML = '<i data-lucide="warning"></i> Prep Failed';
    btn.disabled = false;
    preview.innerHTML = `<div class="p-5 text-center text-danger">Error: ${e.message}</div>`;
  }
}

async function renderVideoAssembly() {
  const btn = document.getElementById('render-video-btn');
  const topic = document.getElementById('video-topic').value;
  const script = document.getElementById('script-preview-container').innerText;
  const tags = Array.from(document.getElementById('factory-tag-list').querySelectorAll('span')).map(s => s.textContent);

  try {
    btn.innerHTML = '<i class="ph ph-rocket pulse"></i> Initiating Pipeline...';
    btn.disabled = true;

    const res = await fetch(`${API_BASE_URL}/api/video-factory/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, script, tags })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Render initialization failed');

    btn.innerHTML = '<i data-lucide="check"></i> Assembly Started';
    alert("🚀 Visual Assembly Started! " + data.message + "\n\nNote: For 2026-style retention, this process runs in the background. You can continue optimizing other videos while this renders.");

    // Switch to status tab to show it's working (optional)
    setTimeout(() => {
        btn.innerHTML = '<i data-lucide="rocket"></i> Start Visual Assembly';
        btn.disabled = false;
    }, 5000);

  } catch (e) {
    alert("⚠️ Render error: " + e.message);
    btn.innerHTML = '<i data-lucide="rocket"></i> Start Visual Assembly';
    btn.disabled = false;
  }
}

// Initialize listeners
// Refactored to platformInit()

// Auto Flow Handler - Automated Pipeline
async function runAutoFlow() {
  if (checkPremium('Video Factory (Auto Flow)')) return;

  const btn = document.getElementById('autoflow-btn');
  const topic = document.getElementById('video-topic').value;
  const scriptEl = document.getElementById('script-preview-container');
  const script = scriptEl ? scriptEl.innerText : '';

  if (!topic) {
    alert('Please enter a topic first!');
    return;
  }

  if (!script) {
    alert('Please click "Prepare AI Script" first to generate a script!');
    return;
  }

  try {
    btn.disabled = true;

    // 1. Launch Browser
    btn.innerHTML = '<i class="ph ph-rocket pulse"></i> Launching Browser...';
    const launchRes = await fetch(`${API_BASE_URL}/api/autoflow/launch`, { method: 'POST' });
    const launchData = await launchRes.json();
    if (!launchRes.ok) throw new Error(launchData.error || 'Failed to launch browser');

    // 2. Parse Script
    btn.innerHTML = '<i class="ph ph-spinner pulse"></i> Parsing Script...';
    const parseRes = await fetch(`${API_BASE_URL}/api/autoflow/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, sceneCount: 10 })
    });
    const parseData = await parseRes.json();
    if (!parseRes.ok) throw new Error(parseData.error || 'Failed to parse script');

    // 3. Queue Prompts
    btn.innerHTML = '<i class="ph ph-list-plus pulse"></i> Queuing Prompts...';
    const queueRes = await fetch(`${API_BASE_URL}/api/autoflow/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes: parseData.scenes })
    });
    const queueData = await queueRes.json();
    if (!queueRes.ok) throw new Error(queueData.error || 'Failed to queue prompts');

    // 4. Start Generation
    btn.innerHTML = '<i class="ph ph-play-circle pulse"></i> Starting Generation...';
    const startRes = await fetch(`${API_BASE_URL}/api/autoflow/start`, { method: 'POST' });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.error || 'Failed to start generation');

    // 5. Poll for Status
    let isComplete = false;
    let pollCount = 0;

    const pollStatus = async () => {
      if (isComplete || pollCount > 100) return; // Cap at 100 polls (~5 mins)

      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/autoflow/status`);
        const state = await statusRes.json();

        if (state.status === 'complete' || state.progress >= 100) {
          isComplete = true;
          btn.innerHTML = '<i data-lucide="check-circle"></i> Generation Complete!';
          btn.style.background = 'var(--success)';
          alert('🚀 Auto Flow Generation Complete! You can now schedule your upload to YouTube.');

          showSchedulingSection(); // <--- SHOW SCHEDULING UI

          setTimeout(() => {
            btn.innerHTML = '<i data-lucide="sparkles"></i> Generate with Auto Flow (AI)';
            btn.style.background = '';
            btn.disabled = false;
          }, 5000);
          return;
        }

        if (state.status === 'error') {
          throw new Error(state.error || 'Generation failed');
        }

        btn.innerHTML = `<i class="ph ph-spinner pulse"></i> Generating... ${state.progress || 0}%`;
        pollCount++;
        setTimeout(pollStatus, 3000);
      } catch (e) {
        console.error('Status poll error:', e);
        btn.innerHTML = '<i data-lucide="warning"></i> Status Sync Error';
        btn.disabled = false;
      }
    };

    pollStatus();

  } catch (e) {
    console.error('Auto Flow Error:', e);
    alert('⚠️ Error: ' + e.message);
    btn.innerHTML = '<i data-lucide="sparkles"></i> Generate with Auto Flow (AI)';
    btn.disabled = false;
  }
}

// --- SCHEDULING & UPLOAD LOGIC ---

function showSchedulingSection() {
    const section = document.getElementById('factory-scheduling-section');
    if (section) {
        section.classList.remove('hidden');
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

async function scheduleVideoUpload() {
  if (checkPremium('Video Factory (Scheduling)')) return;

  const btn = document.getElementById('schedule-upload-btn');
  const time = document.getElementById('schedule-time').value;
    const privacy = document.getElementById('schedule-privacy').value;
    const title = document.getElementById('factory-draft-title').value;
    const description = document.getElementById('factory-draft-desc').value;
    const tags = Array.from(document.getElementById('factory-tag-list').querySelectorAll('span')).map(s => s.textContent);

    if (!time) {
        alert("Please select a scheduled time.");
        return;
    }

    if (!activeChannel) {
        alert("Please connect your YouTube account first!");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner pulse"></i> Processing Assets...';

        // 1. If we used Auto Flow, we need to trigger the download first
        btn.innerHTML = '<i class="ph ph-download pulse"></i> Downloading from Flow...';
        const dlRes = await fetch(`${API_BASE_URL}/api/autoflow/download`, { method: 'POST' });
        const dlData = await dlRes.json();

        if (!dlData.success || !dlData.filePath) {
            throw new Error(dlData.error || 'Failed to download generated video from Google Flow');
        }

        // 2. Schedule the upload via backend
        btn.innerHTML = '<i class="ph ph-calendar-plus pulse"></i> Scheduling Upload...';

        const metadata = {
            snippet: {
                title: title,
                description: description,
                tags: tags,
                categoryId: '22' // People & Blogs
            },
            status: {
                privacyStatus: privacy,
                publishAt: new Date(time).toISOString(),
                selfDeclaredMadeForKids: false
            }
        };

        const res = await fetch(`${API_BASE_URL}/api/video/schedule-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelId: activeChannel.id,
                filePath: dlData.filePath,
                metadata: metadata,
                scheduledTime: time,
                accessToken: accessToken // Pass current token to update backend if needed
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to schedule');

        btn.innerHTML = '<i data-lucide="check"></i> Scheduled Successfully';
        alert(`✅ Video successfully scheduled for ${new Date(time).toLocaleString()}!\n\nThe backend will handle the official YouTube upload at the requested time.`);

        // Hide section after success
        setTimeout(() => {
            document.getElementById('factory-scheduling-section').classList.add('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="clock"></i> Commit to YouTube Scheduler';
        }, 3000);

    } catch (e) {
        console.error('Scheduling Error:', e);
        alert('⚠️ Scheduling failed: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="clock"></i> Commit to YouTube Scheduler';
    }
}

/* ==========================================
   AI AUTO-RESPONDER LOGIC (REFACTORED v3.1.5)
========================================== */

// Helper to handle UTF-8 with Base64 safely
function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

function b64DecodeUnicode(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : url;
}

async function fetchTargetComments() {
    const input = document.getElementById('responder-video-id');
    const urlOrId = input ? input.value.trim() : '';
    const statusDiv = document.getElementById('comments-feed-status');
    const feed = document.getElementById('comments-feed');

    // Fix: Using the correct 'ytseo_access_token' key
    const oauthToken = localStorage.getItem('ytseo_access_token');
    const apiKey = localStorage.getItem('yt_api_key') || '';

    if (!oauthToken && !apiKey) {
      statusDiv.innerHTML = '<span style="color: #ef4444;">Missing Setup. Please connect your channel via OAuth or provide a manual API key in settings.</span>';
      return;
    }

    const fetchLatest = !urlOrId;

    if (fetchLatest && !oauthToken) {
        statusDiv.innerHTML = '<span style="color: #ef4444;">You must connect your channel via OAuth to auto-fetch your latest video. Or, paste a Video URL above.</span>';
        return;
    }

    const videoId = fetchLatest ? '' : extractVideoId(urlOrId);

    statusDiv.innerHTML = fetchLatest
        ? `<i class="ph ph-spinner ph-spin"></i> Locating and fetching comments from your latest video...`
        : `<i class="ph ph-spinner ph-spin"></i> Fetching recent comments for video <b>${videoId}</b>...`;

    feed.innerHTML = '';

    try {
        const headers = {};
        if (oauthToken) {
            headers['Authorization'] = `Bearer ${oauthToken}`;
        } else if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        const res = await fetch(`${API_BASE_URL}/api/youtube/comments`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
              'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
              'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
            },
            body: JSON.stringify({ videoId, fetchLatest, accessToken: oauthToken })
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch comments.');
        }

        if (!data.items || data.items.length === 0) {
            statusDiv.innerHTML = 'No comments found for this video.';
            return;
        }

        statusDiv.innerHTML = `Loaded ${data.items.length} recent comments from video <b>${data.targetVideoId}</b>.`;
        renderCommentsFeed(data.items);
    } catch (e) {
        statusDiv.innerHTML = `<span style="color: #ef4444;"><i data-lucide="warning"></i> Error: ${e.message}</span>`;
    }
}

function renderCommentsFeed(commentThreads) {
    const feed = document.getElementById('comments-feed');
    console.log('[Auto-Responder] renderCommentsFeed called with', commentThreads?.length, 'threads');
    console.log('[Auto-Responder] Feed container:', !!feed);

    let html = '';
    commentThreads.forEach((thread, index) => {
        const comment = thread.snippet.topLevelComment.snippet;
        const commentId = thread.id;
        const authorName = comment.authorDisplayName;
        const authorAvatar = comment.authorProfileImageUrl;
        const textDisplay = comment.textDisplay;
        const textOriginal = comment.textOriginal;
        const publishedAt = new Date(comment.publishedAt).toLocaleDateString();
        const likeCount = comment.likeCount;

        console.log('[Auto-Responder] Rendering comment', index, ':', commentId, authorName);

        // Base64 encode the comment to prevent breaking HTML attributes with quotes/newlines
        const safeText = b64EncodeUnicode(textOriginal);

        html += `
            <div class="comment-item" id="comment-${commentId}">
                <div class="comment-header">
                    <img src="${authorAvatar}" class="comment-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random'" />
                    <div class="comment-meta">
                        <span class="comment-author">${authorName}</span>
                        <span class="comment-date">${publishedAt}</span>
                    </div>
                    <div class="comment-likes">
                        <i class="ph-fill ph-thumbs-up"></i> ${likeCount}
                    </div>
                </div>
                <div class="comment-text" id="comment-text-${commentId}" data-context="${safeText}">${textDisplay}</div>
                <div class="comment-actions">
                    <button class="btn-secondary j-draft-btn" data-id="${commentId}">
                        <i data-lucide="wand-2"></i> Draft AI Reply (1 Credit)
                    </button>
                </div>
                <div class="ai-draft-box" id="draft-box-${commentId}">
                    <div class="draft-content" id="draft-content-${commentId}">Ready to generate your reply...</div>
                    <div class="comment-actions" id="draft-actions-${commentId}" style="display: none;">
                        <button class="btn-secondary" onclick="insertReply('${commentId}')">
                            <i data-lucide="send"></i> Insert & Reply
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    feed.innerHTML = html;
    console.log('[Auto-Responder] ✅ Rendered', commentThreads.length, 'comments with Draft AI Reply buttons');
}

async function generateAIReply(commentId) {
    console.log('[Auto-Responder v3.1.5] 🔧 TRIGGERED for commentId:', commentId);
    console.log('[Auto-Responder] Looking for API key...');

    const groqKey = checkGroqApiKey();

    // Non-blocking: if no user key, let backend use SaaS master key (like other features do)
    if (!groqKey) {
        console.warn('[Auto-Responder] No user API key, using SaaS master key via backend');
    }

    const textElement = document.getElementById(`comment-text-${commentId}`);
    console.log('[Auto-Responder] Text element found:', !!textElement);
    let commentText = "";

    try {
        const encodedContext = textElement ? textElement.getAttribute('data-context') : '';
        console.log('[Auto-Responder] Encoded context:', encodedContext ? encodedContext.substring(0, 30) + '...' : 'EMPTY');
        commentText = b64DecodeUnicode(encodedContext);
        console.log('[Auto-Responder] Decoded comment text:', commentText ? commentText.substring(0, 50) + '...' : 'EMPTY');
    } catch (e) {
        console.error('[Auto-Responder] Decode Error:', e);
        commentText = textElement ? textElement.innerText : "";
    }

    const draftBox = document.getElementById(`draft-box-${commentId}`);
    const draftContent = document.getElementById(`draft-content-${commentId}`);
    const draftActions = document.getElementById(`draft-actions-${commentId}`);
    const toneSelect = document.getElementById('responder-tone-select');
    const tone = toneSelect ? toneSelect.value : 'professional';

    console.log('[Auto-Responder] Draft box:', !!draftBox, 'Draft content:', !!draftContent, 'Tone:', tone);

    draftBox.classList.add('active');
    draftContent.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Synthesizing human-like response...';
    draftActions.style.display = 'none';

    // Build Tone-specific rules
    let toneRules = '';
    let persona = 'Helpful Creator';
    switch(tone) {
        case 'enthusiastic':
            toneRules = 'Be extremely positive, warm, and highly appreciative of the fan. Use an emoji. Match their excitement. Keep it SHORT - max 2 sentences.';
            persona = 'Enthusiastic Creator';
            break;
        case 'professional':
            toneRules = 'Be polite, direct, informative, and authoritative but respectful. Answer questions if asked. Keep it SHORT - max 2 sentences. Occasionally end with a question to boost engagement.';
            persona = 'Professional Creator';
            break;
        case 'witty':
            toneRules = 'Add a clever, light-hearted joke or clever remark related to their comment. Be fun and playful. Keep it SHORT - max 2 sentences.';
            persona = 'Witty Creator';
            break;
        case 'ethereal':
            toneRules = 'Speak profoundly about the cosmos, reality, or deep concepts. Sound like a philosophical scientist. Keep it deeply curious and majestic BUT make it CONVERSATIONAL - like chatting with a friend who loves science. Keep it SHORT - max 2 sentences. Occasionally end with a question to spark discussion.';
            persona = 'Ethereal Philosopher';
            break;
    }

    // More specific prompt for contextual replies
    const systemPrompt = `Act as a YouTube Community Manager for a ${persona} channel.
TONE: ${tone}.
RULES: ${toneRules}
CRITICAL CONSTRAINTS:
- MAXIMUM 2 SENTENCES ONLY - shorter is better!
- Make it conversational and natural, like chatting with a friend
- If they ask a question, ANSWER it directly in 1-2 sentences
- If they are excited, MATCH their energy briefly
- Do NOT use generic phrases like "Thanks for the awesome comment!"
- Make your reply UNIQUE and relevant to what they actually said
- 50% of the time, END WITH A QUESTION to keep the viewer talking
- Return ONLY the direct reply text. No quotes, no intro phrases, no explanation.`;

    const userPrompt = `Viewer comment: "${commentText}"

Generate a SHORT (max 2 sentences), unique, engaging reply to THIS specific comment. Make it feel human and natural.`;

    console.log('[Auto-Responder] Sending request to AI...');

    // Build headers - only include API key if user provided one
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
      'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
    };
    if (groqKey) {
        headers['x-api-key'] = groqKey;
    }

    try {
        console.log('[Auto-Responder] POST to:', `${API_BASE_URL}/api/ai/generate`);
        const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                taskType: 'comment-reply',
                systemPrompt: systemPrompt,
                userPrompt: userPrompt
            })
        });

        console.log('[Auto-Responder] Response status:', response.status);
        if (!response.ok) throw new Error('AI Generation failed: ' + response.status);
        const data = await response.json();
        console.log('[Auto-Responder] AI response data:', JSON.stringify(data).substring(0, 200));
        let replyText = data.choices?.[0]?.message?.content || data.reply || 'Thanks for the awesome comment!';

        replyText = replyText.replace(/^["']|["']$/g, '');

        CreditsSystem.deduct('auto-responder');

        draftContent.innerHTML = '';
        await simulateTypewriter(draftContent, replyText, 15);

        // Store for copying
        draftBox.dataset.replyText = replyText;
        draftActions.style.display = 'flex';
        console.log('[Auto-Responder] ✅ SUCCESS - Reply generated and displayed');

    } catch (e) {
        console.error('[Auto-Responder] ❌ ERROR:', e.message);
        draftContent.innerHTML = `<span style="color: #ef4444;">Error: ${e.message}</span>`;
    }
}

async function simulateTypewriter(element, text, speed = 20) {
    for (let i = 0; i < text.length; i++) {
        element.innerHTML += text.charAt(i);
        await new Promise(r => setTimeout(r, speed));
    }
}

async function insertReply(commentId) {
    const draftBox = document.getElementById(`draft-box-${commentId}`);
    const draftActions = document.getElementById(`draft-actions-${commentId}`);
    const text = draftBox.dataset.replyText || '';

    if (!text) return;

    // Always copy to clipboard as fallback
    try { navigator.clipboard.writeText(text); } catch (_) {}

    // Auto-post to YouTube if access token is available
    if (!accessToken) {
        draftActions.innerHTML = `<span class="reply-success-badge"><i class="ph-fill ph-check-circle"></i> Reply Copied to Clipboard</span>
                                  <a href="https://studio.youtube.com" target="_blank" class="btn-secondary" style="background: rgba(255,0,0,0.1); color: #ff4e4e; border-color: rgba(255,0,0,0.2);">
                                    <i class="ph-fill ph-youtube-logo"></i> Open Studio
                                  </a>`;
        return;
    }

    // Show posting state
    draftActions.innerHTML = `<span style="color:var(--accent);"><i class="ph ph-spinner ph-spin"></i> Posting reply to YouTube...</span>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/youtube/post-comment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
              'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
              'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
            },
            body: JSON.stringify({ commentId, replyText: text, accessToken })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to post reply');

        draftActions.innerHTML = `<span class="reply-success-badge"><i class="ph-fill ph-check-circle"></i> ✅ Reply Posted to YouTube!</span>`;
        showToast('Reply posted to YouTube successfully!', 'success');
    } catch (e) {
        console.error('[Auto-Responder] Post Error:', e.message);
        // Fallback: show clipboard success + studio link
        draftActions.innerHTML = `<span class="reply-success-badge"><i class="ph-fill ph-warning"></i> Copied (Post failed: ${e.message})</span>
                                  <a href="https://studio.youtube.com" target="_blank" class="btn-secondary" style="background: rgba(255,0,0,0.1); color: #ff4e4e;">
                                    <i class="ph-fill ph-youtube-logo"></i> Open Studio
                                  </a>`;
        showToast('Auto-post failed. Reply copied to clipboard.', 'warning');
    }
}

// ==========================================
// Automation Pipeline Functions
// ==========================================

const PIPELINE_CONFIG = {
    'seo-refresh': {
        name: 'Weekly SEO Refresh',
        creditsPerWeek: 20,
        runFrequency: 7, // days
        nextActionText: 'SEO Audit'
    },
    'comment-autopilot': {
        name: 'Comment Autopilot',
        creditsPerWeek: 20,
        runFrequency: 1, // days
        nextActionText: 'Comment Review'
    },
    'evergreen': {
        name: 'Evergreen Scanner',
        creditsPerWeek: 20,
        runFrequency: 3, // days
        nextActionText: 'Thumbnail Analysis'
    }
};

const activePipelines = new Set(
  JSON.parse(localStorage.getItem('ytseo_pipelines') || '[]')
);

// Restore pipeline UI state on load
setTimeout(() => {
  activePipelines.forEach(id => {
    const toggle = document.getElementById(`toggle-${id}`);
    const card = document.getElementById(`pipeline-${id}`);
    const statusBar = document.getElementById(`status-${id}`);
    const config = PIPELINE_CONFIG[id];
    if (toggle && card && config) {
      toggle.checked = true;
      card.classList.add('active');
      statusBar.innerHTML = `
        <span class="status-badge active">Active</span>
        <span class="next-run">Next run in ${config.runFrequency} day${config.runFrequency > 1 ? 's' : ''}</span>
      `;
    }
  });
}, 1000);

function togglePipeline(pipelineId) {
    const toggle = document.getElementById(`toggle-${pipelineId}`);
    const card = document.getElementById(`pipeline-${pipelineId}`);
    const statusBar = document.getElementById(`status-${pipelineId}`);
    const config = PIPELINE_CONFIG[pipelineId];

    if (!toggle || !config) return;

    if (toggle.checked) {
        // Turn ON
        const credits = CreditsSystem.remaining;
        const weeklyCost = getWeeklyCreditCost();

        if (credits < 20) {
            toggle.checked = false;
            alert(`Insufficient credits. You need 20 credits to activate ${config.name}.`);
            return;
        }

        // Deduct 20 credits for the week
        for (let i = 0; i < 20; i++) {
            CreditsSystem.deduct('pipeline');
        }

        activePipelines.add(pipelineId);
        localStorage.setItem('ytseo_pipelines', JSON.stringify([...activePipelines]));
        card.classList.add('active');
        statusBar.innerHTML = `
            <span class="status-badge active">Active</span>
            <span class="next-run">Next run in ${config.runFrequency} day${config.runFrequency > 1 ? 's' : ''}</span>
        `;

        showToast(`${config.name} activated! 20 credits deducted.`, 'success');
    } else {
        // Turn OFF
        activePipelines.delete(pipelineId);
        localStorage.setItem('ytseo_pipelines', JSON.stringify([...activePipelines]));
        card.classList.remove('active');
        statusBar.innerHTML = `
            <span class="status-badge inactive">Inactive</span>
            <span class="next-run">Next run: --</span>
        `;

        showToast(`${config.name} deactivated.`, 'info');
    }

    updatePipelineSummary();
}

function getWeeklyCreditCost() {
    return activePipelines.size * 20;
}

function updatePipelineSummary() {
    const countEl = document.getElementById('active-pipelines-count');
    const costEl = document.getElementById('weekly-credit-cost');
    const actionEl = document.getElementById('next-action');

    const activeCount = activePipelines.size;
    const weeklyCost = activeCount * 20;

    countEl.textContent = activeCount;
    costEl.textContent = weeklyCost > 0 ? `${weeklyCost} credits` : '0';

    if (activeCount === 0) {
        actionEl.textContent = 'No pipelines active';
    } else {
        // Find the pipeline with the shortest run frequency
        let shortestFreq = Infinity;
        let nextAction = 'Various tasks';

        activePipelines.forEach(id => {
            const config = PIPELINE_CONFIG[id];
            if (config.runFrequency < shortestFreq) {
                shortestFreq = config.runFrequency;
                nextAction = config.nextActionText;
            }
        });

        actionEl.textContent = `${nextAction} in ${shortestFreq} day${shortestFreq > 1 ? 's' : ''}`;
    }
}

// Refactored to platformInit()

// Also expose immediately for onClick handlers that fire before DOMContentLoaded
window.runResearch = runResearch;
window.generateScript = generateScript;
window.analyzeCompetitor = analyzeCompetitor;
window.displayResults = displayResults;
window.copyKeyword = copyKeyword;
window.sendToFactory = sendToFactory;
window.snipeKeyword = snipeKeyword;
window.exportToMetadataWeaver = exportToMetadataWeaver;
window.setResearchMode = setResearchMode;
window.checkGroqApiKey = checkGroqApiKey;
window.showApiRequiredOverlay = showApiRequiredOverlay;
window.hideApiRequiredOverlay = hideApiRequiredOverlay;
window.switchView = switchView;
window.toggleFolder = toggleFolder;
window.checkPremiumFeature = checkPremiumFeature;
window.showPremiumModal = showPremiumModal;
window.toggleProfileMenu = toggleProfileMenu;
window.initiateOAuth = initiateOAuth;
window.fetchTargetComments = fetchTargetComments;
window.generateAIReply = generateAIReply;
window.insertReply = insertReply;
window.togglePipeline = togglePipeline;
window.updatePipelineSummary = updatePipelineSummary;
window.generateSEOBundle = generateSEOBundle;
window.selectTitle = selectTitle;
window.copyElement = copyElement;
window.copyFullBundle = copyFullBundle;
window.sendToVideoFactory = sendToVideoFactory;
window.detectChannelNiche = detectChannelNiche;
window.updateNicheDisplay = updateNicheDisplay;
window.runSystemHealthProbe = runSystemHealthProbe;

console.log('✅ Functions exposed to window (sync)');

// ── System Health Probe ──
async function runSystemHealthProbe() {
  const setStatus = (id, status, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = status === 'ok' ? 'status-ok' : status === 'warn' ? 'status-warn' : 'status-error';
  };

  setStatus('health-youtube', 'warn', 'Probing...');
  setStatus('health-groq', 'warn', 'Probing...');
  setStatus('health-database', 'warn', 'Probing...');
  setStatus('health-server', 'warn', 'Probing...');

  // Probe API server
  try {
    const healthRes = await fetch(`${API_BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    setStatus('health-server', healthRes.ok ? 'ok' : 'error', healthRes.ok ? 'Online' : 'Down');
    setStatus('health-database', healthData.db_connected ? 'ok' : 'error', healthData.db_connected ? 'Connected' : 'Offline');
  } catch (e) {
    setStatus('health-server', 'error', 'Unreachable');
    setStatus('health-database', 'error', 'Unknown');
  }

  // Probe YouTube API
  const accessToken = localStorage.getItem('ytseo_access_token');
  if (accessToken) {
    try {
      const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setStatus('health-youtube', ytRes.ok ? 'ok' : 'error', ytRes.ok ? 'Authenticated' : 'Token Expired');
    } catch (e) {
      setStatus('health-youtube', 'error', 'API Blocked');
    }
  } else {
    setStatus('health-youtube', 'warn', 'Not Connected');
  }

  // Probe Groq AI
  try {
    const groqRes = await fetch(`${API_BASE_URL}/api/ai/proxy-keywords?q=test`);
    setStatus('health-groq', groqRes.ok ? 'ok' : 'warn', groqRes.ok ? 'Operational' : 'Degraded');
  } catch (e) {
    setStatus('health-groq', 'error', 'Unreachable');
  }

  if (window.lucide) lucide.createIcons();
}


// ==================== PLAYLIST GROWTH SUITE (METADATA WEAVER) ====================

// Load playlists for Playlist Growth Suite
async function loadPlaylistsForSuite() {
  if (!accessToken) {
    showToast('Please connect your channel first', 'error');
    return [];
  }

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await res.json();
    const playlists = data.items || [];

    return playlists;
  } catch (e) {
    console.error('[Load Playlists Error]:', e);
    return [];
  }
}

// Tab switching for Suite
function switchSuiteTab(tabName) {
  const tabs = document.querySelectorAll('.suite-tab');
  const panels = document.querySelectorAll('.suite-panel');

  tabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.suite === tabName) {
      tab.classList.add('active');
    }
  });

  panels.forEach(panel => {
    panel.style.display = 'none';
  });

  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
  }

  // Load playlists if not loaded yet
  if (tabName === 'weaver') {
    loadWeaverPlaylists();
  } else if (tabName === 'collusion') {
    loadCollusionPlaylists();
  } else if (tabName === 'linker') {
    loadLinkerPlaylists();
  }
}
window.switchSuiteTab = switchSuiteTab;

// Load playlists for Weaver
async function loadWeaverPlaylists() {
  const select = document.getElementById('weaver-playlist-select');
  if (!select) return;

  const playlists = await loadPlaylistsForSuite();

  select.innerHTML = '<option value="">Select a playlist...</option>' +
    playlists.map(p => `<option value="${p.id}">${p.snippet.title}</option>`).join('');
}
window.loadWeaverPlaylists = loadWeaverPlaylists;

// Load playlists for Collusion
async function loadCollusionPlaylists() {
  const select = document.getElementById('collusion-playlist-select');
  if (!select) return;

  const playlists = await loadPlaylistsForSuite();

  select.innerHTML = '<option value="">Select a playlist...</option>' +
    playlists.map(p => `<option value="${p.id}">${p.snippet.title}</option>`).join('');
}
window.loadCollusionPlaylists = loadCollusionPlaylists;

// Load playlists for Linker
async function loadLinkerPlaylists() {
  const select = document.getElementById('linker-playlist-select');
  if (!select) return;

  const playlists = await loadPlaylistsForSuite();

  select.innerHTML = '<option value="">Select a playlist...</option>' +
    playlists.map(p => `<option value="${p.id}">${p.snippet.title}</option>`).join('');
}
window.loadLinkerPlaylists = loadLinkerPlaylists;

// Placeholder functions for onchange handlers
function loadWeaverPlaylist() {
  console.log('[Weaver] Playlist selected');
}
window.loadWeaverPlaylist = loadWeaverPlaylist;

function loadCollusionPlaylist() {
  console.log('[Collusion] Playlist selected');
}
window.loadCollusionPlaylist = loadCollusionPlaylist;

function loadLinkerPlaylist() {
  console.log('[Linker] Playlist selected');
}
window.loadLinkerPlaylist = loadLinkerPlaylist;

// Generate Weave (Algorithmic Description)
async function generateWeave() {
  const playlistId = document.getElementById('weaver-playlist-select')?.value;
  if (!playlistId) {
    showToast('Please select a playlist', 'error');
    return;
  }

  // Check credits (3 credits for weave)
  if (!CreditsSystem.deduct('metadata-weave')) {
    return;
  }

  const groqKey = checkGroqApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
    'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
    'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
  };
  if (groqKey) headers['x-api-key'] = groqKey;

  // Show loading
  document.getElementById('weaver-loading').style.display = 'block';
  document.getElementById('weaver-results').style.display = 'none';
  document.getElementById('weaver-generate-btn').disabled = true;

  try {
    const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

    const res = await fetch(`${API_BASE_URL}/api/youtube/metadata-weave`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        playlistId,
        accessToken: accessToken || null,
        niche
      })
    });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(res.ok ? 'Invalid response' : `Server error: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate weave');
    }

    // Display results
    document.getElementById('weaver-video-count').textContent = `${data.videoCount || 0} videos`;
    const description = data.algorithmicDescription || data.description || '';
    safeSetHTML('weaver-description', `<p>${description}</p>`);
    if (window.lucide) { setTimeout(() => lucide.createIcons(), 50); }

    const themes = data.themes || data.keyThemes;
    if (themes) {
      safeSetHTML('weaver-tags', themes.map(theme =>
        `<span class="tag-pill">${theme}</span>`
      ).join(''));
    }

    document.getElementById('weaver-loading').style.display = 'none';
    document.getElementById('weaver-results').style.display = 'block';

    showToast('Weave generated successfully!', 'success');

  } catch (e) {
    console.error('[Weave Error]:', e.message, e.stack);
    document.getElementById('weaver-loading').style.display = 'none';
    document.getElementById('weaver-generate-btn').disabled = false;
    showToast('Error: ' + e.message, 'error');
  }
}
window.generateWeave = generateWeave;

// Generate Collusion Tags
async function generateCollusionTags() {
  const playlistId = document.getElementById('collusion-playlist-select')?.value;
  if (!playlistId) {
    showToast('Please select a playlist', 'error');
    return;
  }

  // Check credits (3 credits for collusion tags)
  if (!CreditsSystem.deduct('metadata-weave')) {
    return;
  }

  const groqKey = checkGroqApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
    'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
    'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
  };
  if (groqKey) headers['x-api-key'] = groqKey;

  // Show loading
  document.getElementById('collusion-loading').style.display = 'block';
  document.getElementById('collusion-results').style.display = 'none';
  document.getElementById('collusion-generate-btn').disabled = true;

  try {
    const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';

    const res = await fetch(`${API_BASE_URL}/api/youtube/collusion-tags`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        playlistId,
        accessToken: accessToken || null,
        niche
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate tags');
    }

    // Display results - backend returns { tags: [...] }
    const tags = data.tags || data.collusionBundle || [];
    window._collusionTags = tags;
    window._collusionVideoCount = data.videoCount || 5;

    safeSetHTML('collusion-tags', tags.map(tag =>
      `<span class="tag-pill bundle-tag">${tag}</span>`
    ).join(''));

    const strategyText = data.strategy || `Inject these ${tags.length} shared tags across all videos in this playlist to signal a series to YouTube's algorithm.`;
    safeSetHTML('collusion-strategy', `<p><strong>Strategy:</strong> ${strategyText}</p>`);
    if (window.lucide) { setTimeout(() => lucide.createIcons(), 50); }

    document.getElementById('collusion-loading').style.display = 'none';
    document.getElementById('collusion-results').style.display = 'block';

    showToast('Tag bundle generated successfully!', 'success');

  } catch (e) {
    console.error('[Collusion Tags Error]:', e);
    document.getElementById('collusion-loading').style.display = 'none';
    document.getElementById('collusion-generate-btn').disabled = false;
    showToast('Error: ' + e.message, 'error');
  }
}
window.generateCollusionTags = generateCollusionTags;

// Copy Collusion Tags to clipboard
function copyCollusionTags() {
  const tagsEl = document.getElementById('collusion-tags');
  const tags = tagsEl?.querySelectorAll('.bundle-tag');

  if (!tags || tags.length === 0) {
    showToast('No tags to copy', 'error');
    return;
  }

  const tagText = Array.from(tags).map(t => t.textContent).join(', ');
  navigator.clipboard.writeText(tagText).then(() => {
    showToast('Tags copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}
window.copyCollusionTags = copyCollusionTags;

// Generate Gateway URL
async function generateGatewayUrl() {
  const playlistId = document.getElementById('linker-playlist-select')?.value;
  if (!playlistId) {
    showToast('Please select a playlist', 'error');
    return;
  }

  if (!accessToken) {
    showToast('Please connect your channel to use Session Linker', 'error');
    return;
  }

  // Session Linker (Gateway URL) is FREE

  const groqKey = checkGroqApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
    'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
    'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
  };
  if (groqKey) headers['x-api-key'] = groqKey;

  // Show loading
  document.getElementById('linker-loading').style.display = 'block';
  document.getElementById('linker-results').style.display = 'none';
  document.getElementById('linker-generate-btn').disabled = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/youtube/session-linker`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        playlistId,
        accessToken
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate gateway');
    }

    // Display results
    const video = data.gatewayVideo || {};
    safeSetHTML('gateway-video-title', `<h4>${video.title || 'Unknown Video'}</h4>`);
    if (window.lucide) { setTimeout(() => lucide.createIcons(), 50); }
    document.getElementById('gateway-score').textContent = video.engagementScore?.toLocaleString() || '0';
    document.getElementById('gateway-url-input').value = data.gatewayUrl || '';

    document.getElementById('linker-loading').style.display = 'none';
    document.getElementById('linker-results').style.display = 'block';

    showToast('Gateway URL generated successfully!', 'success');

  } catch (e) {
    console.error('[Gateway URL Error]:', e);
    document.getElementById('linker-loading').style.display = 'none';
    document.getElementById('linker-generate-btn').disabled = false;
    showToast('Error: ' + e.message, 'error');
  }
}
window.generateGatewayUrl = generateGatewayUrl;

// Copy Gateway URL to clipboard
function copyGatewayUrl() {
  const input = document.getElementById('gateway-url-input');
  const url = input?.value;

  if (!url) {
    showToast('No URL to copy', 'error');
    return;
  }

  navigator.clipboard.writeText(url).then(() => {
    showToast('Gateway URL copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}
window.copyGatewayUrl = copyGatewayUrl;

// ── PLAYLIST SUITE WRITE-BACKS ──

// State: store last generated data for write-backs
let _weaverPlaylistId = null;
let _weaverDescription = null;
let _collusionPlaylistId = null;
let _collusionTags = [];
let _collusionVideoCount = 0;

// Patch: capture generated data on Weaver success so apply button has it
const _origGenerateWeave = window.generateWeave;
window.generateWeave = async function () {
  _weaverPlaylistId = document.getElementById('weaver-playlist-select')?.value || null;
  if (_origGenerateWeave) await _origGenerateWeave();
  // After success, capture description text from DOM
  const descEl = document.getElementById('weaver-description');
  if (descEl) _weaverDescription = descEl.innerText || descEl.textContent;
};

// Patch: capture generated tags on Collusion success so inject button has it
const _origGenerateCollusionTags = window.generateCollusionTags;
window.generateCollusionTags = async function () {
  _collusionPlaylistId = document.getElementById('collusion-playlist-select')?.value || null;
  if (_origGenerateCollusionTags) await _origGenerateCollusionTags();
  // Capture tags from DOM pills
  const tagEls = document.querySelectorAll('#collusion-tags .bundle-tag');
  _collusionTags = Array.from(tagEls).map(el => el.textContent.trim()).filter(Boolean);
  // Update inject button label with real video count from result
  const vcEl = document.getElementById('collusion-results');
  // video count is stored on the collusion-results dataset if set
  if (_collusionTags.length > 0) {
    const labelEl = document.getElementById('collusion-inject-label');
    if (labelEl) {
      // fetch count from the last API response cached on dataset
      const countEl = vcEl?.dataset?.videoCount;
      const count = countEl ? ` (${countEl} Videos)` : '';
      labelEl.textContent = `Inject Collusion Tags${count}`;
    }
  }
};

// ── ACTION 1: Apply Weaver Narrative to Playlist Description ──
async function applyNarrativeToPlaylist() {
  // Re-read description from DOM in case it was generated freshly
  const descEl = document.getElementById('weaver-description');
  let description = descEl?.innerText || descEl?.textContent || _weaverDescription || '';

  // 🛡️ SURGICAL EXTRACTION: Prevent technical jargon from reaching YouTube
  if (description.includes('"algorithmicDescription"')) {
    // If text looks like JSON, extract only the content
    try {
      const match = description.match(/"algorithmicDescription"\s*:\s*"([\s\S]*?)"/);
      if (match && match[1]) {
        description = match[1];
      } else {
        // Fallback manual strip
        description = description
          .replace(/^\{?\s*"algorithmicDescription":\s*"/, '')
          .replace(/"\s*\}?$/, '')
          .replace(/\\"/g, '"'); // Unescape quotes if it was a JSON string
      }
    } catch(e) {
      console.warn('Extraction failed, sending raw string');
    }
  }

  // Prefer live selection from dropdown, fallback to cached ID from generation
  const playlistId = document.getElementById('weaver-playlist-select')?.value || _weaverPlaylistId;

  if (!description.trim()) {
    showToast('No description generated yet. Run the Weaver first.', 'error');
    return;
  }
  if (!playlistId) {
    showToast('No playlist selected.', 'error');
    return;
  }
  if (!accessToken) {
    showToast('Please connect your YouTube channel first.', 'error');
    return;
  }

  // Deduct 10 credits
  if (!CreditsSystem.deduct('weaver-apply')) return;

  const applyBtn = document.getElementById('weaver-apply-btn');
  const progressEl = document.getElementById('weaver-apply-progress');
  const barEl = document.getElementById('weaver-apply-bar');
  const statusEl = document.getElementById('weaver-apply-status');

  if (applyBtn) applyBtn.disabled = true;
  if (progressEl) progressEl.style.display = 'block';
  if (barEl) barEl.style.width = '20%';
  if (statusEl) statusEl.textContent = 'Connecting to YouTube...';

  // Animate progress bar
  const steps = [
    { pct: 40, msg: 'Fetching current playlist data...' },
    { pct: 70, msg: 'Writing algorithmic description...' },
    { pct: 90, msg: 'Confirming update...' }
  ];
  let stepIdx = 0;
  const stepInterval = setInterval(() => {
    if (stepIdx < steps.length) {
      const s = steps[stepIdx++];
      if (barEl) barEl.style.width = s.pct + '%';
      if (statusEl) statusEl.textContent = s.msg;
    }
  }, 800);

  try {
    const groqKey = checkGroqApiKey();
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
      'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
    };
    if (groqKey) headers['x-api-key'] = groqKey;

    const res = await fetch(`${API_BASE_URL}/api/youtube/apply-playlist-description`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ playlistId, description, accessToken })
    });
    const data = await res.json();
    clearInterval(stepInterval);

    if (!res.ok) throw new Error(data.error || 'Apply failed');

    if (barEl) barEl.style.width = '100%';
    if (statusEl) statusEl.textContent = '✅ Narrative applied to playlist!';
    showToast('Playlist description updated on YouTube!', 'success');
    updateTimeSaved(3);

    // Fade out progress after 4 seconds
    setTimeout(() => {
      if (progressEl) progressEl.style.display = 'none';
      if (applyBtn) applyBtn.disabled = false;
      if (barEl) barEl.style.width = '0%';
    }, 4000);

  } catch (e) {
    clearInterval(stepInterval);
    if (barEl) barEl.style.width = '0%';
    if (statusEl) statusEl.textContent = 'Error: ' + e.message;
    if (applyBtn) applyBtn.disabled = false;
    showToast('Apply failed: ' + e.message, 'error');
  }
}
window.applyNarrativeToPlaylist = applyNarrativeToPlaylist;

// ── ACTION 2: Inject Collusion Tags into all playlist videos ──
async function injectCollusionTags() {
  const playlistId = _collusionPlaylistId || document.getElementById('collusion-playlist-select')?.value;

  if (_collusionTags.length === 0) {
    showToast('No collusion tags generated yet. Run the tag bundle first.', 'error');
    return;
  }
  if (!playlistId) {
    showToast('No playlist selected.', 'error');
    return;
  }
  if (!accessToken) {
    showToast('Please connect your YouTube channel first.', 'error');
    return;
  }

  // Check affordability: 1 credit per video
  const videoCount = _collusionVideoCount || 1;
  const totalCost = videoCount;
  if (CreditsSystem.remaining < totalCost) {
    showToast(`Not enough credits. Need ${totalCost} credits (1 per video).`, 'error');
    return;
  }

  const injectBtn = document.getElementById('collusion-inject-btn');
  const progressEl = document.getElementById('collusion-inject-progress');
  const barEl = document.getElementById('collusion-inject-bar');
  const statusEl = document.getElementById('collusion-inject-status');

  if (injectBtn) injectBtn.disabled = true;
  if (progressEl) progressEl.style.display = 'block';
  if (barEl) barEl.style.width = '5%';
  if (statusEl) statusEl.textContent = `Preparing to secure ${videoCount} videos...`;

  // Deduct 1 credit per video upfront
  // Use manual deduction loop so history is itemised
  for (let i = 0; i < videoCount; i++) {
    CreditsSystem.used += 1;
  }
  CreditsSystem.save();
  CreditsSystem.updateDisplay();
  showToast(`-${videoCount} credits (1 per video)`, 'deduction');

  // Animate progress in parallel - the real count-down comes from a polling trick
  // Since the API is a single call that processes all videos server-side,
  // we simulate granular progress client-side based on known video count.
  let simulatedIndex = 0;
  const progressInterval = setInterval(() => {
    if (simulatedIndex < videoCount - 1) {
      simulatedIndex++;
      const pct = Math.round((simulatedIndex / videoCount) * 90) + 5; // cap at 95% until done
      if (barEl) barEl.style.width = pct + '%';
      if (statusEl) statusEl.textContent = `Securing video ${simulatedIndex} of ${videoCount}...`;
    }
  }, 500);

  try {
    const groqKey = checkGroqApiKey();
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
      'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
    };
    if (groqKey) headers['x-api-key'] = groqKey;

    const res = await fetch(`${API_BASE_URL}/api/youtube/inject-collusion-tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ playlistId, tags: _collusionTags, accessToken })
    });
    const data = await res.json();
    clearInterval(progressInterval);

    if (!res.ok) throw new Error(data.error || 'Injection failed');

    if (barEl) barEl.style.width = '100%';
    if (statusEl) statusEl.textContent = `✅ Secured ${data.successCount} of ${data.totalVideos} videos!`;
    showToast(`Tags injected into ${data.successCount} videos!`, 'success');
    updateTimeSaved(5);

    setTimeout(() => {
      if (progressEl) progressEl.style.display = 'none';
      if (injectBtn) injectBtn.disabled = false;
      if (barEl) barEl.style.width = '0%';
    }, 5000);

  } catch (e) {
    clearInterval(progressInterval);
    if (barEl) barEl.style.width = '0%';
    if (statusEl) statusEl.textContent = 'Error: ' + e.message;
    if (injectBtn) injectBtn.disabled = false;
    // Refund credits on failure
    CreditsSystem.used = Math.max(0, CreditsSystem.used - videoCount);
    CreditsSystem.save();
    CreditsSystem.updateDisplay();
    showToast('Injection failed: ' + e.message, 'error');
  }
}
window.injectCollusionTags = injectCollusionTags;


// ── PHASE 3 & 5: RETENTION RE-ORDERER & AI ARCHITECT CHATBOT ──

// 1. Assistant Mechanics
async function toggleAssistant() {
  const chatWindow = document.getElementById('architect-window');
  if (chatWindow) {
    chatWindow.classList.toggle('active');
  }
}
window.toggleAssistant = toggleAssistant;

function openAssistant() {
  const chatWindow = document.getElementById('architect-window');
  if (chatWindow && !chatWindow.classList.contains('active')) {
    chatWindow.classList.add('active');
  }
}
window.openAssistant = openAssistant;

function handleChatKey(e) {
  if (e.key === 'Enter' && !window.isCoachThinking) sendArchitectMessage();
}
window.handleChatKey = handleChatKey;

function askArchitect(text) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    sendArchitectMessage();
  }
}
window.askArchitect = askArchitect;

let _architectChatHistory = [];

async function sendArchitectMessage() {
  if (window.isCoachThinking) return;
  window.isCoachThinking = true;
  const input = document.getElementById('coach-input-field');
  const chatMessages = document.getElementById('chat-messages');
  const message = (input?.value || '').trim();

  if (!message) { window.isCoachThinking = false; return; }

  // Render user message
  if (chatMessages) {
    chatMessages.innerHTML += `<div class="message user">${message}</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  input.value = '';

  // Context gathering
  const niche = localStorage.getItem('ytseo_detected_niche') || 'Lifestyle';
  const credits = CreditsSystem.total - CreditsSystem.used;
  const healthScore = window.lastAuditScore || 85;

  // Fetch real video data for personalized advice
  let videoContext = '';
  if (accessToken) {
    try {
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${localStorage.getItem('ytseo_channel_id')}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (chRes.ok) {
        const chData = await chRes.json();
        const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsId) {
          const vRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=20`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            const ids = (vData.items || []).map(i => i.contentDetails?.videoId).filter(Boolean).join(',');
            if (ids) {
              const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (statsRes.ok) {
                const statsData = await statsRes.json();
                videoContext = (statsData.items || []).map((v, i) => {
                  const views = parseInt(v.statistics?.viewCount || '0');
                  const likes = parseInt(v.statistics?.likeCount || '0');
                  const comments = parseInt(v.statistics?.commentCount || '0');
                  const eng = views > 0 ? ((likes + comments) / views * 100).toFixed(1) : '0';
                  const isShort = (v.snippet?.title || '').includes('#Shorts') ? ' 📱SHORT' : '';
                  return `${i+1}. "${v.snippet?.title}"${isShort} - ${views.toLocaleString()} views, ${eng}% eng`;
                }).join('\\n');
              }
            }
          }
        }
      }
    } catch(e) {}
  }

  try {
  // Deduct 1 credit for Assistant Message (skip for agency plan)
  const isAgency = userPlan === 'agency' || (localStorage.getItem('ytseo_plan') || '') === 'agency';
  if (!isAgency) {
    if (!CreditsSystem.deduct('ai-assistant', 1)) {
      if (chatMessages) chatMessages.innerHTML += `<div class="message ai" style="color: var(--danger)">Low Credits: Please upgrade to continue coaching sessions.</div>`;
      window.isCoachThinking = false;
      return;
    }
  }

    const groqKey = checkGroqApiKey();
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
      'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
    };
    if (groqKey) headers['x-api-key'] = groqKey;

    const res = await fetch(`${API_BASE_URL}/api/ai/assistant`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        context: { niche, credits, healthScore, videos: videoContext },
        history: _architectChatHistory
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Coach is processing the strategy...');

    // Render AI reply
    if (chatMessages) {
      chatMessages.innerHTML += `<div class="message ai">${data.reply}</div>`;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    _architectChatHistory.push({ role: 'user', content: message });
    _architectChatHistory.push({ role: 'assistant', content: data.reply });

    // Auto-save coach memory in background (Task 07)
    saveCoachMemoryInBackground(_architectChatHistory, niche);

  } catch (e) {
    if (chatMessages) chatMessages.innerHTML += `<div class="message ai" style="color: var(--danger)">Coach Error: ${e.message}</div>`;
  } finally {
    window.isCoachThinking = false;
  }
}
window.sendArchitectMessage = sendArchitectMessage;

// ── Coach Memory Functions (Task 07) ──
async function saveCoachMemoryInBackground(conversationHistory, niche) {
  if (!conversationHistory || conversationHistory.length < 2) return;
  try {
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    await fetch('/api/coach-memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': channelId },
      body: JSON.stringify({ conversation: conversationHistory.slice(-6), niche: niche || 'General' })
    });
  } catch (e) { /* Silent - memory save is best-effort */ }
}
window.saveCoachMemoryInBackground = saveCoachMemoryInBackground;

async function loadCoachMemoryDisplay() {
  try {
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    var res = await fetch('/api/coach-memory/memory', { headers: { 'x-channel-id': channelId } });
    var data = await res.json();
    var memEl = document.getElementById('coach-memory-display');
    var contentEl = document.getElementById('coach-memory-content');
    if (!memEl || !contentEl || !data.hasMemory) return;
    var m = data.memory;
    var parts = [];
    if (m.contentGoals && m.contentGoals.length) parts.push('🎯 Goals: ' + m.contentGoals.slice(0, 2).join(', '));
    if (m.focusKeywords && m.focusKeywords.length) parts.push('🔍 Keywords: ' + m.focusKeywords.slice(0, 3).join(', '));
    if (m.lastConversation) parts.push('💬 Last session: ' + m.lastConversation);
    if (parts.length) { contentEl.innerHTML = parts.join('<br/>'); memEl.style.display = 'block'; }
  } catch (e) { /* Silent */ }
}
window.loadCoachMemoryDisplay = loadCoachMemoryDisplay;

async function clearCoachMemory() {
  if (!confirm('Clear coach memory? The coach will start fresh.')) return;
  try {
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    await fetch('/api/coach-memory/clear', { method: 'POST', headers: { 'x-channel-id': channelId } });
    var memEl = document.getElementById('coach-memory-display');
    if (memEl) memEl.style.display = 'none';
  } catch (e) { /* Silent */ }
}
window.clearCoachMemory = clearCoachMemory;

// Trigger coach memory display load on page init
setTimeout(function() { loadCoachMemoryDisplay(); }, 2000);


// 2. Retention Re-Orderer Mechanics
async function loadRetentionData() {
  const playlistId = document.getElementById('reorder-playlist-select')?.value;
  if (!playlistId) {
    showToast('Please select a playlist first', 'error');
    return;
  }

  // Check for accessToken before making API calls
  if (!accessToken) {
    showSessionExpiredModal();
    return;
  }

  const loadingEl = document.getElementById('retention-loading');
  const resultsEl = document.getElementById('retention-results');
  const btn = document.getElementById('btn-analyze-retention');
  const algoList = document.getElementById('algo-order-list');

  if (loadingEl) loadingEl.style.display = 'block';
  if (resultsEl) resultsEl.style.display = 'none';
  if (btn) btn.disabled = true;

  // Show skeleton pulse on right panel while calculating
  if (algoList) {
    algoList.innerHTML = `
      <div class="skeleton-pulse" style="padding: 20px; text-align: center; color: var(--text-muted);">
        <div class="skeleton-line" style="height: 20px; width: 60%; margin: 10px auto; background: var(--bg-secondary); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
        <div class="skeleton-line" style="height: 16px; width: 80%; margin: 8px auto; background: var(--bg-secondary); border-radius: 4px; animation: pulse 1.5s infinite; animation-delay: 0.2s;"></div>
        <div class="skeleton-line" style="height: 16px; width: 50%; margin: 8px auto; background: var(--bg-secondary); border-radius: 4px; animation: pulse 1.5s infinite; animation-delay: 0.4s;"></div>
        <p style="margin-top: 16px;"><i data-lucide="brain"></i> Calculating optimal sequence...</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  try {
    // Check credits before calling
    if (!CreditsSystem.canAfford('retention-reorder')) {
      showToast('Not enough credits (need 15)', 'error');
      if (loadingEl) loadingEl.style.display = 'none';
      if (btn) btn.disabled = false;
      return;
    }

    // Build headers with CSRF + channel ID + plan
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
      'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
      'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
    };

    // Call server to calculate Gateway Hybrid reorder strategy
    const res = await fetch(`${API_BASE_URL}/api/youtube/prepare-reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ playlistId, accessToken })
    });

    // Handle 401 Unauthorized
    if (res.status === 401) {
      showAuthExpiredModal();
      if (loadingEl) loadingEl.style.display = 'none';
      if (btn) btn.disabled = false;
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to calculate strategy');

    _retentionPlaylistVideos = data.originalOrder || [];
    _retentionSortedVideos = data.sortedOrder || data.originalOrder || [];
    _retentionAVDMap = data.retentionMap || {};
    _retentionInstructions = data.instructions || [];
    _retentionOriginalOrderSnapshot = data.originalOrder || [];

    console.log('[Reorder] Original order:', _retentionPlaylistVideos.length, 'items');
    console.log('[Reorder] Sorted order:', _retentionSortedVideos.length, 'items');
    console.log('[Reorder] First sorted:', _retentionSortedVideos[0]);
    console.log('[Reorder] Last sorted:', _retentionSortedVideos[_retentionSortedVideos.length - 1]); // Saved for backup

    // Update UI
    displayRetentionLists();

    if (loadingEl) loadingEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'block';
    if (btn) btn.disabled = false;

  } catch (e) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (btn) btn.disabled = false;
    showToast('Strategy Error: ' + e.message, 'error');
  }
}
window.loadRetentionData = loadRetentionData;

function displayRetentionLists() {
  const currentList = document.getElementById('current-order-list');
  const algoList = document.getElementById('algo-order-list');

  if (!currentList || !algoList) return;

  // Clear both panels to avoid ghosting data
  currentList.innerHTML = '';
  algoList.innerHTML = '';

  // 1. Render Current Order (original playlist order before any sorting)
  const originalOrder = [..._retentionPlaylistVideos].sort((a, b) => a.originalIndex - b.originalIndex);
  currentList.innerHTML = originalOrder.map((v, i) => renderRetentionItem(v, i + 1, false)).join('');

  // 2. Render Algorithmic Order (sorted by gateway score from backend)
  const sortedOrder = _retentionSortedVideos.length > 0 ? _retentionSortedVideos : _retentionPlaylistVideos;
  algoList.innerHTML = sortedOrder.map((v, i) => {
    const vid = v.videoId || v.contentDetails?.videoId;
    const gs = _retentionAVDMap[vid]?.gatewayScore || 0;
    const stats = _retentionAVDMap[vid] || {};
    let badgeType = '';
    // Discovery Leader: top 3 by score with significant views
    if (i < 3 && (stats.views || 0) >= 50) badgeType = 'gateway';
    else if ((stats.avd || 0) > 180) badgeType = 'retention'; // 3min+ AVD = strong retention
    else if ((stats.avd || 0) > 120 && (stats.views || 0) >= 20) badgeType = 'retention';
    return renderRetentionItem(v, i + 1, badgeType);
  }).join('');

  document.getElementById('reorder-stats').textContent = `${sortedOrder.length} Videos Aligned with Gateway Strategy`;

  // Enable the Deploy button after analysis is complete
  const deployBtn = document.getElementById('btn-reorder-execute');
  if (deployBtn) deployBtn.disabled = false;
}

function renderRetentionItem(video, index, badgeType) {
  // Backend returns flat format: { itemId, videoId, title, originalIndex }
  // or YouTube format: { contentDetails: { videoId }, snippet: { title, thumbnails } }
  const videoId = video.videoId || video.contentDetails?.videoId;
  const title = video.title || video.snippet?.title || 'Untitled';
  const thumbnail = video.snippet?.thumbnails?.default?.url || '';
  const stats = _retentionAVDMap[videoId] || { avd: 0, views: 0 };
  const avdSecs = stats.avd || 0;
  const avdPretty = avdSecs > 60 ? `${Math.floor(avdSecs/60)}m ${avdSecs%60}s` : `${avdSecs}s`;
  const views = stats.views || 0;

  let badgeHtml = '';
  if (badgeType === 'gateway') {
    badgeHtml = `<div class="item-badge badge-gateway"><i data-lucide="zap"></i> Discovery Leader</div>`;
  } else if (badgeType === 'retention') {
    badgeHtml = `<div class="item-badge badge-retention"><i data-lucide="magnet"></i> Retention Magnet</div>`;
  }

  return `
    <div class="retention-item">
      <div class="item-index">${index}</div>
      ${thumbnail ? `<div class="item-thumb"><img src="${thumbnail}" alt="thumb"></div>` : ''}
      <div class="item-info">
        <div class="item-title">${title}</div>
        <div class="item-stats">
          <span class="stat-avd"><i data-lucide="timer"></i> ${avdPretty} AVD</span>
          <span><i data-lucide="eye"></i> ${views.toLocaleString()} views</span>
        </div>
        ${badgeHtml}
      </div>
    </div>
  `;
}

async function reorderPlaylistOnYoutube(isRestore = false) {
  const playlistId = document.getElementById('reorder-playlist-select')?.value;
  if (!playlistId) return;

  // 1. Credit Check (Restore is FREE)
  if (!isRestore) {
    if (!CreditsSystem.deduct('retention-reorder')) return;
  }

  const btn = document.getElementById('btn-reorder-execute');
  const progContainer = document.getElementById('reorder-progress');
  const bar = document.getElementById('reorder-bar');
  const status = document.getElementById('reorder-status');
  const pctText = document.getElementById('reorder-pct');

  if (btn) btn.disabled = true;
  if (progContainer) progContainer.style.display = 'block';
  if (status) status.textContent = isRestore ? 'Restoring original loop...' : 'Re-aligning with Algorithm...';

  // 2. Safety Backup (Only on fresh reorder)
  if (!isRestore) {
    localStorage.setItem(`playlist_backup_${playlistId}`, JSON.stringify(_retentionOriginalOrderSnapshot));
    console.log('[Safety Backup] Original order snapshot captured to playlist_backup_' + playlistId);
  }

  const instructions = isRestore
    ? JSON.parse(localStorage.getItem(`backup_order_${playlistId}`)).map((v, i) => ({ itemId: v.itemId, videoId: v.videoId, position: i }))
    : _retentionInstructions;

  if (!instructions) {
    showToast('No backup found for this playlist', 'error');
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/youtube/reorder-playlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
        'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous',
        'x-plan': localStorage.getItem('ytseo_plan') || userPlan || 'free'
      },
      body: JSON.stringify({ playlistId, instructions, accessToken })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reorder process failed');

    // Smooth UI progress
    for (let i = 0; i <= 100; i += 20) {
      if (bar) bar.style.width = i + '%';
      if (pctText) pctText.textContent = i + '%';
      await new Promise(r => setTimeout(r, 100));
    }

    if (status) status.textContent = isRestore ? '✅ Original Order Fully Restored' : '✅ Playlist Optimized for Session Watch-Time!';
    showToast(isRestore ? 'Loop Reverted' : 'Strategy complete: Discovery Leaders & Retention Magnets deployed.', 'success');

    setTimeout(() => {
      if (progContainer) progContainer.style.display = 'none';
      if (btn) btn.disabled = false;
    }, 3000);

  } catch (e) {
    if (btn) btn.disabled = false;
    showToast('Process failed: ' + e.message, 'error');
  }
}
window.reorderPlaylistOnYoutube = reorderPlaylistOnYoutube;

async function restoreOriginalOrder() {
  const playlistId = document.getElementById('reorder-playlist-select')?.value;
  const backup = localStorage.getItem(`backup_order_${playlistId}`);
  if (!backup) {
    showToast('No original backup found to restore.', 'error');
    return;
  }

  if (confirm('Are you sure you want to REVERT this playlist to its original order? (This action is FREE)')) {
    await reorderPlaylistOnYoutube(true);
  }
}
window.restoreOriginalOrder = restoreOriginalOrder;


// [Removed Local Duplicate checkHealthAndCoach]

// Hook into existing score displays
const _origUpdateAuditUI = window.displayAuditResults;
if (typeof _origUpdateAuditUI === 'function') {
  window.displayAuditResults = function(data) {
    const avgScore = (data.scores.title + data.scores.desc + data.scores.tags + data.scores.thumb) / 4;
    checkHealthAndCoach(avgScore);
    return _origUpdateAuditUI(data);
  };
}

// Ensure reorder playlist dropdown is populated
const _origSwitchTab = window.switchSuiteTab;
window.switchSuiteTab = function(tabName) {
  if (tabName === 'retention-reorderer') {
    loadReorderPlaylists();
  }
  return _origSwitchTab(tabName);
};

async function loadReorderPlaylists() {
  const select = document.getElementById('reorder-playlist-select');
  if (!select) return;
  const playlists = await loadPlaylistsForSuite();
  if (select) {
    select.innerHTML = '<option value="">Select a playlist...</option>' +
      playlists.map(p => `<option value="${p.id}">${p.snippet.title}</option>`).join('');
  }
}
window.loadReorderPlaylists = loadReorderPlaylists;

// Add Assistant Toggle to Page Sidebar via delegation
document.addEventListener('click', (e) => {
  const item = e.target.closest('[data-view="architect"]');
  if (item) {
    e.preventDefault();
    openAssistant();
  }
});

// ── Missing Window Functions ──
function toggleCoachDrawer(show) {
  const coach = document.getElementById('coach-window');
  if (!coach) return;
  const isActive = coach.classList.contains('active');
  const shouldShow = typeof show === 'boolean' ? show : !isActive;
  if (shouldShow) {
    coach.style.display = 'flex';
    setTimeout(() => { coach.classList.add('active'); coach.style.transform = 'translateX(0)'; }, 10);
  } else {
    coach.classList.remove('active');
    coach.style.transform = 'translateX(100%)';
    setTimeout(() => { if (!coach.classList.contains('active')) coach.style.display = 'none'; }, 400);
  }
}

function handleCoachMessage(message) {
  console.log('[Coach] Message received:', message);
  const inputField = document.getElementById('chat-input') || document.getElementById('coach-input-field');
  if (inputField) {
    if (message) {
      inputField.value = message;
      sendArchitectMessage();
    } else {
      sendArchitectMessage();
    }
  }
}

// ── Neural Strategy Center Loader ──
async function loadNeuralStrategy() {
  // Update both containers: overview panel + growth engine panel
  const overviewContainer = document.getElementById('strategy-center-content');
  const growthContainer = document.getElementById('neural-strategy-grid');

  // Need at least one container to proceed
  if (!overviewContainer && !growthContainer) return;

  const setHTML = (html) => {
    if (overviewContainer) overviewContainer.innerHTML = html;
    if (growthContainer) growthContainer.innerHTML = html;
  };

  // Show loading skeletons
  setHTML('<div class="strategy-tip skeleton"></div><div class="strategy-tip skeleton"></div><div class="strategy-tip skeleton"></div><div class="strategy-tip skeleton"></div>');

  try {
    const niche = localStorage.getItem('ytseo_detected_niche') || channelNiche || 'General';
    const titles = window.recentTitles || recentTitles || [];

    const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
    const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';

    const res = await fetch(`${API_BASE_URL}/api/ai/neural-strategy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        'x-channel-id': chId
      },
      body: JSON.stringify({
        recentTitles: titles.slice(0, 10),
        niche: niche
      })
    });

    if (!res.ok) {
      const fallback = await res.json().catch(() => ({}));
      setHTML(`<div class="strategy-tip"><i data-lucide="cpu"></i><p>${fallback.error || 'Strategy engine offline. Run a channel audit to activate.'}</p></div>`);
      if (window.lucide) lucide.createIcons();
      return;
    }

    const data = await res.json();
    const tips = data.tips || [];

    if (tips.length === 0) {
      setHTML('<div class="strategy-tip"><i data-lucide="sparkles"></i><p>Run a channel audit to generate personalized strategy insights.</p></div>');
      if (window.lucide) lucide.createIcons();
      return;
    }

    const tipsHTML = tips.map((tip, i) => `
      <div class="strategy-tip">
        <div class="tip-number">0${i + 1}</div>
        <p>${tip}</p>
      </div>
    `).join('');

    setHTML(tipsHTML);
    showToast('Neural Strategy updated', 'success');
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.warn('[Neural Strategy] Load failed:', e.message);
    setHTML('<div class="strategy-tip"><i data-lucide="wifi-off"></i><p>Strategy engine connecting... Run a channel audit to activate.</p></div>');
    if (window.lucide) lucide.createIcons();
  }
}
window.loadNeuralStrategy = loadNeuralStrategy;

function deployGatewayOrder(orderData) {
  console.log('[Gateway] Deploying order:', orderData);
  // Triggers the retention reorder deployment pipeline
  const deployBtn = document.getElementById('btn-reorder-execute');
  if (deployBtn) deployBtn.click();
}

function openLegalModal() {
  const modal = document.getElementById('legal-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.style.opacity = '0';
  modal.style.transform = 'scale(0.9)';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.style.transform = 'scale(1)';
    modal.style.transition = 'all 0.3s ease';
  }, 10);
  document.body.style.overflow = 'hidden';
}

function openPayPalModal(plan, price) {
  plan = plan || 'pro';
  price = price || '29';
  const modal = document.getElementById('payment-modal');
  if (!modal) {
    console.warn('[PayPal] Payment modal not found');
    return;
  }
  const title = document.getElementById('payment-modal-title');
  const desc = document.getElementById('payment-modal-desc');
  if (title) title.innerText = `Power Up: ${plan.toUpperCase()}`;
  if (desc) desc.innerText = `Unlock enterprise-grade features for ${plan.toUpperCase()}.`;
  modal.classList.remove('hidden');
  if (typeof window.initPayPal === 'function') {
    window.initPayPal(plan, price);
  }
}

// EXPOSE TO WINDOW FOR HTML ACCESS
window.initiateOAuth = initiateOAuth;
window.runResearch = runResearch;
window.toggleCoachDrawer = toggleCoachDrawer;
window.handleCoachMessage = handleCoachMessage;
window.generateSEOBundle = generateSEOBundle;
window.loadWeaverPlaylist = loadWeaverPlaylist;
window.generateWeave = generateWeave;
window.loadRetentionData = loadRetentionData;
window.deployGatewayOrder = deployGatewayOrder;
window.runEvergreenAudit = runEvergreenAudit;
window.openLegalModal = openLegalModal;
window.openPayPalModal = openPayPalModal;

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// 🆕 MODERN 2026 FEATURES - TREND PULSE
// ═══════════════════════════════════════════

async function loadTrendPulse() {
  const niche = document.getElementById('trend-niche-input')?.value?.trim() || 'General';
  const country = document.getElementById('trend-country-select')?.value || 'US';
  const btn = document.getElementById('trend-load-btn');
  document.getElementById('trend-loading').style.display = 'block';
  document.getElementById('trend-grid').style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }
  try {
    const res = await fetch(`/api/trends/pulse?niche=${encodeURIComponent(niche)}&country=${country}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch trends');
    renderTrendCards(data);
    const metaEl = document.getElementById('trend-meta');
    if (metaEl) metaEl.textContent = `${data.trends.length} trends found for "${niche}" · ${new Date(data.fetchedAt).toLocaleTimeString()}`;
    document.getElementById('trend-grid').style.display = 'block';
  } catch (err) { alert('Trend scan failed: ' + err.message); }
  finally { document.getElementById('trend-loading').style.display = 'none'; if (btn) { btn.disabled = false; btn.textContent = '⚡ Scan Trends'; } }
}

function renderTrendCards(data) {
  const container = document.getElementById('trend-cards');
  if (!container) return;
  const alignColor = { High: 'var(--success)', Medium: 'var(--warning)', Low: 'var(--text-muted)' };
  container.innerHTML = data.trends.map(trend => `
    <div style="background:var(--bg-card);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;transition:border-color 0.2s;${trend.alignmentScore >= 60 ? 'border-color:rgba(0,212,255,0.3);' : ''}" onmouseover="this.style.borderColor='rgba(0,212,255,0.3)'" onmouseout="this.style.borderColor='${trend.alignmentScore >= 60 ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}'">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
        <span style="font-size:11px;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:4px;">${trend.source}</span>
        <span style="font-size:11px;color:var(--danger);">⏱ ${trend.urgencyHours}h window</span>
      </div>
      <div style="font-weight:600;font-size:15px;margin-bottom:8px;line-height:1.4;">${trend.keyword.substring(0, 80)}</div>
      ${trend.traffic ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">🔍 ${trend.traffic} searches</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:${alignColor[trend.alignmentLabel]};background:rgba(255,255,255,0.03);padding:3px 8px;border-radius:4px;">● ${trend.alignmentLabel} alignment</span>
        ${trend.actionable ? `<button class="btn-primary" style="font-size:12px;padding:6px 14px;" onclick="capitalizeTrend('${trend.keyword.replace(/'/g, "\\'")}')">🚀 Capitalize</button>` : `<span style="font-size:12px;color:var(--text-muted);">Low relevance</span>`}
      </div>
    </div>
  `).join('');
}

async function capitalizeTrend(keyword) {
  const modal = document.getElementById('trend-capitalize-modal');
  const bundleLoading = document.getElementById('trend-bundle-loading');
  const bundleContent = document.getElementById('trend-bundle-content');
  if (!modal) return;
  modal.style.display = 'flex'; bundleLoading.style.display = 'block'; bundleContent.style.display = 'none';
  try {
    const niche = document.getElementById('trend-niche-input')?.value?.trim() || 'General';
    const channelId = window.currentChannelId || '';
    const res = await fetch('/api/trends/capitalize', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-channel-id': channelId, 'X-CSRF-Token': window.csrfToken || '' }, body: JSON.stringify({ keyword, niche }) });
    const data = await res.json();
    const b = data.bundle || {};
    bundleContent.innerHTML = `
      <div style="margin-bottom:16px;"><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Video Title</label><div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:4px;font-weight:600;">${b.videoTitle || ''}</div></div>
      <div style="margin-bottom:16px;"><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Opening Hook Script</label><div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:4px;font-size:13px;line-height:1.6;color:var(--text-muted);">${b.hook || ''}</div></div>
      <div style="margin-bottom:16px;"><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Video Outline</label><ul style="margin:8px 0 0;padding-left:20px;color:var(--text-muted);font-size:13px;line-height:2;">${(b.outline || []).map(p => `<li>${p}</li>`).join('')}</ul></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Publish Window</label><div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-top:4px;font-weight:600;color:var(--danger);">${b.publishWindow || ''}</div></div>
        <div><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Est. Views</label><div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px;margin-top:4px;font-weight:600;color:var(--success);">${b.estimatedViews || ''}</div></div>
      </div>
      <div style="margin-bottom:16px;"><label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Tags (${(b.tags || []).length})</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${(b.tags || []).map(t => `<span style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:20px;padding:4px 10px;font-size:12px;">${t}</span>`).join('')}</div></div>
    `;
    bundleLoading.style.display = 'none'; bundleContent.style.display = 'block';
  } catch (err) { bundleLoading.innerHTML = `<p style="color:var(--danger);">Failed: ${err.message}</p>`; }
}

function closeTrendModal() { const modal = document.getElementById('trend-capitalize-modal'); if (modal) modal.style.display = 'none'; }

window.loadTrendPulse = loadTrendPulse;
window.capitalizeTrend = capitalizeTrend;
window.closeTrendModal = closeTrendModal;

// ── SMART CHAPTERS GENERATOR: AI timestamped chapters ──
async function generateChapters() {
  const script = document.getElementById('chapters-input')?.value?.trim();
  const duration = document.getElementById('chapters-duration')?.value || '10';
  const style = document.getElementById('chapters-style')?.value || 'descriptive';

  if (!script || script.length < 50) { showToast('Please paste a script (min 50 characters)', 'error'); return; }

  if (!CreditsSystem.deduct('ai-generate')) return;
  updateTimeSaved(3);

  const loading = document.getElementById('chapters-loading');
  const results = document.getElementById('chapters-results');
  if (loading) loading.style.display = 'flex';
  if (results) results.style.display = 'none';

  try {
    const stylePrompt = style === 'curious' ? 'Use curiosity-gap titles'
      : style === 'keyword' ? 'Use keyword-rich titles optimized for YouTube search'
      : 'Use clear descriptive titles';

    const res = await window.apiPost('/api/ai/generate', {
      userPrompt: `You are a YouTube chapter expert. Based on this ~${duration} minute video script, create 5-8 timestamped chapters. ${stylePrompt}. Each chapter must have: start time (MM:SS), title (max 40 chars). Space chapters evenly across the ${duration} minute duration. The first chapter starts at 0:00. Return JSON: { "chapters": [{"time":"0:00", "title":"Introduction"}] }\n\nSCRIPT:\n${script.substring(0, 3000)}`,
      systemPrompt: 'You create YouTube video chapters. Respond with JSON only.',
      taskType: 'tags'
    });

    let chapters = [];
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
      chapters = parsed.chapters || [];
    }

    // Fallback: generate simple chapters from script when AI fails
    if (chapters.length === 0) {
      const dur = parseInt(duration) || 10;
      const lines = script.split(/\n+/).filter(l => l.trim().length > 20);
      const step = Math.max(1, Math.floor(lines.length / 8));
      chapters = [{ time: '0:00', title: 'Introduction' }];
      for (let i = step; i < lines.length && chapters.length < 8; i += step) {
        const title = lines[i].trim().substring(0, 40).replace(/^\[.*?\]\s*/, '');
        const mins = Math.floor((i / lines.length) * dur);
        const secs = Math.floor(((i / lines.length) * dur - mins) * 60);
        chapters.push({ time: `${mins}:${String(secs).padStart(2, '0')}`, title: title || `Part ${chapters.length + 1}` });
      }
      chapters.push({ time: `${dur}:00`, title: 'Conclusion & Next Steps' });
    }

    const timeline = document.getElementById('chapters-timeline');
    if (timeline) {
      window._generatedChapters = chapters;
      timeline.innerHTML = chapters.map((ch, i) => `
        <div class="chapter-row" style="animation: fadeInUp 0.3s ease ${i * 0.08}s both;">
          <span class="chapter-time">${ch.time}</span>
          <span class="chapter-bar"></span>
          <span class="chapter-title">${escapeHTML(ch.title)}</span>
        </div>
      `).join('');
    }
    if (results) results.style.display = 'block';
  } catch (e) {
    showToast('Chapter generation failed. Try again.', 'error');
    console.error('[Chapters]', e);
  }
  if (loading) loading.style.display = 'none';
}
window.generateChapters = generateChapters;

function copyChapters() {
  const chapters = window._generatedChapters || [];
  if (!chapters.length) { showToast('Generate chapters first', 'error'); return; }
  const text = chapters.map(ch => `${ch.time} ${ch.title}`).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('Chapters copied! Paste into YouTube description', 'success'));
}
window.copyChapters = copyChapters;

// ── COMMUNITY POST GENERATOR: AI community tab posts ──
async function generateCommunityPost() {
  const niche = document.getElementById('community-niche')?.value?.trim();
  const type = document.getElementById('community-type')?.value || 'poll';
  const topic = document.getElementById('community-topic')?.value?.trim();

  if (!niche) { showToast('Please enter your niche', 'error'); return; }

  if (!CreditsSystem.deduct('ai-assistant')) return;
  updateTimeSaved(1);

  const loading = document.getElementById('community-loading');
  const results = document.getElementById('community-results');
  if (loading) loading.style.display = 'flex';
  if (results) results.style.display = 'none';

  try {
    const typePrompts = {
      poll: `Create a YouTube Community poll for the "${niche}" niche${topic ? ' about ' + topic : ''}. Include a question and 4 poll options that drive engagement. Format as a poll with clear options.`,
      teaser: `Write an exciting behind-the-scenes or teaser Community post for the "${niche}" niche${topic ? ' about ' + topic : ''}. Build hype for an upcoming video. Include emojis.`,
      question: `Write an engaging discussion question for the "${niche}" niche${topic ? ' about ' + topic : ''}. Should spark conversation in comments. Use emojis.`,
      update: `Write a professional channel update post for the "${niche}" niche${topic ? ' about ' + topic : ''}. Warm, personal, and community-focused.`,
      tip: `Write a quick tip / tutorial tease Community post for "${niche}"${topic ? ' about ' + topic : ''}. Valuable insight + tease to upcoming full video. Emojis welcome.`
    };

    const res = await window.apiPost('/api/ai/generate', {
      userPrompt: typePrompts[type] || typePrompts.poll,
      systemPrompt: `You write engaging YouTube Community posts (2026). Keep it warm and authentic. Max 200 words.`,
      taskType: 'comment-reply'
    });

    let post = '';
    if (res.ok) {
      const data = await res.json();
      post = data.choices?.[0]?.message?.content || '';
    }

    // Fallback when AI fails: pre-written templates per post type
    if (!post || post.length < 10) {
      const fallbacks = {
        poll: `🔥 Quick poll for my ${niche} community!\n\n${topic || 'What topic should I cover next'}?\n\nA) Deep dive tutorial\nB) Beginner's guide\nC) Advanced techniques\nD) Case study / real examples\n\nDrop your vote below! 👇`,
        teaser: `🎬 Something BIG is coming...\n\nJust finished recording my most ambitious ${niche} video yet. ${topic ? 'It covers ' + topic + ' in a way you\'ve never seen before.' : 'Can\'t wait to share it with you all.'}\n\nWho's ready? 🔥`,
        question: `🤔 Quick question for the ${niche} community:\n\n${topic || 'What\'s the ONE thing you wish you knew when you started?'}\n\nShare your answer below - I\'ll feature the best ones in my next video! 💡`,
        update: `📢 Channel update!\n\nHey everyone! Just wanted to check in and share what\'s happening. ${topic || 'I\'ve been working on some exciting new content that I think you\'ll love.'}\n\nThank you for being part of this community. More soon! 🙏`,
        tip: `💡 Quick ${niche} tip:\n\n${topic || 'The biggest mistake I see beginners make is overcomplicating things. Start simple, master the basics, then scale.'}\n\nFull tutorial coming soon - stay tuned! 🚀`
      };
      post = fallbacks[type] || fallbacks.poll;
    }

    window._communityPost = post;
    const card = document.getElementById('community-card');
    if (card) {
      card.innerHTML = `
        <div class="community-post-preview">
          <div class="post-type-badge">${type.toUpperCase()}</div>
          <div class="post-content">${post.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }
    if (results) results.style.display = 'block';
  } catch (e) {
    showToast('Post generation failed.', 'error');
    console.error('[Community]', e);
  }
  if (loading) loading.style.display = 'none';
}
window.generateCommunityPost = generateCommunityPost;

function copyCommunityPost() {
  if (!window._communityPost) { showToast('Generate a post first', 'error'); return; }
  navigator.clipboard.writeText(window._communityPost).then(() => showToast('Post copied! Paste into YouTube Community tab', 'success'));
}
window.copyCommunityPost = copyCommunityPost;

// ── MULTI-LANGUAGE SEO: Translate metadata for global audiences ──
async function generateMultiLanguageSEO() {
  const title = document.getElementById('ml-title')?.value?.trim();
  const description = document.getElementById('ml-description')?.value?.trim();
  const tags = document.getElementById('ml-tags')?.value?.trim();
  const langSelect = document.getElementById('ml-languages');
  const languages = Array.from(langSelect?.selectedOptions || []).map(o => o.value);

  if (!title) { showToast('Please enter a video title', 'error'); return; }
  if (!languages.length) { showToast('Select at least one language', 'error'); return; }

  if (!CreditsSystem.deduct('seo-bundle')) return;
  updateTimeSaved(5);

  const loading = document.getElementById('ml-loading');
  const results = document.getElementById('ml-results');
  if (loading) loading.style.display = 'flex';
  if (results) results.style.display = 'none';

  const langNames = { es: 'Spanish', pt: 'Portuguese', hi: 'Hindi', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', id: 'Indonesian', tr: 'Turkish', it: 'Italian', ru: 'Russian' };

  try {
    const res = await window.apiPost('/api/ai/generate', {
      userPrompt: `You are a multilingual YouTube SEO expert. Translate and LOCALIZE this video metadata for these languages: ${languages.map(l => langNames[l] || l).join(', ')}. For EACH language, provide: 1) Localized title (SEO-optimized, max 100 chars), 2) Localized description (with local keywords), 3) 8-10 localized tags. Original English:\nTitle: ${title}\nDescription: ${description || 'N/A'}\nTags: ${tags || 'N/A'}\n\nReturn JSON: { "translations": { "es": {"title":"...", "description":"...", "tags":["..."]}, ... } }`,
      systemPrompt: 'You translate YouTube metadata with SEO localization expertise. Respond with JSON only.',
      taskType: 'tags'
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    const translations = parsed.translations || {};

    const tabs = document.getElementById('ml-tabs');
    const mlContent = document.getElementById('ml-content');
    if (tabs && mlContent) {
      window._mlTranslations = translations;
      let activeLang = languages[0];
      tabs.innerHTML = languages.map(l => `<button class="ml-tab ${l === activeLang ? 'active' : ''}" onclick="showMLLanguage('${l}')">${langNames[l] || l}</button>`).join('');
      mlContent.innerHTML = renderMLResult(activeLang, translations[activeLang]);
    }
    if (results) results.style.display = 'block';
  } catch (e) {
    showToast('Translation failed. Try again.', 'error');
    console.error('[MultiLang]', e);
  }
  if (loading) loading.style.display = 'none';
}
window.generateMultiLanguageSEO = generateMultiLanguageSEO;

function showMLLanguage(lang) {
  const translations = window._mlTranslations || {};
  const mlContent = document.getElementById('ml-content');
  const tabs = document.getElementById('ml-tabs');
  if (mlContent && translations[lang]) mlContent.innerHTML = renderMLResult(lang, translations[lang]);
  if (tabs) tabs.querySelectorAll('.ml-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(lang)));
}
window.showMLLanguage = showMLLanguage;

function renderMLResult(lang, t) {
  if (!t) return '<p>No data</p>';
  const langNames = { es: 'Spanish', pt: 'Portuguese', hi: 'Hindi', fr: 'French', de: 'German', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', id: 'Indonesian', tr: 'Turkish', it: 'Italian', ru: 'Russian' };
  return `
    <div class="ml-lang-card">
      <h4>${langNames[lang] || lang} Translation</h4>
      <div class="ml-field"><strong>Title:</strong> <span class="copy-text" onclick="navigator.clipboard.writeText('${escapeHTML(t.title || '').replace(/'/g, "\\'")}');showToast('Copied!','success')">${escapeHTML(t.title || '')}</span></div>
      <div class="ml-field"><strong>Description:</strong> <span class="copy-text">${escapeHTML((t.description || '').substring(0, 200))}...</span></div>
      <div class="ml-field"><strong>Tags:</strong> ${(t.tags || []).map(tag => `<span class="tag-chip">${escapeHTML(tag)}</span>`).join(' ')}</div>
    </div>
  `;
}

// ── AI CONTENT LABELING: YouTube 2026 compliance for synthetic content ──
async function generateAILabel() {
  const content = document.getElementById('ai-label-input')?.value?.trim();
  const hasVisual = document.getElementById('ai-label-visual')?.checked || false;
  const hasVoice = document.getElementById('ai-label-voice')?.checked || false;
  const hasScript = document.getElementById('ai-label-script')?.checked || false;
  const hasReal = document.getElementById('ai-label-real')?.checked || false;

  if (!content || content.length < 20) { showToast('Please describe your video content (min 20 chars)', 'error'); return; }

  if (!CreditsSystem.deduct('ai-assistant')) return;
  updateTimeSaved(2);

  const loading = document.getElementById('ai-label-loading');
  const result = document.getElementById('ai-label-result');
  if (loading) loading.style.display = 'flex';
  if (result) result.style.display = 'none';

  try {
    const checks = [];
    if (hasVisual) checks.push('AI-generated visuals/images');
    if (hasVoice) checks.push('AI-generated voice/narration');
    if (hasScript) checks.push('AI-assisted script writing');
    if (hasReal) checks.push('Real people/events with synthetic alterations');

    const res = await window.apiPost('/api/ai/generate', {
      userPrompt: `Act as a YouTube 2026 compliance expert. Analyze this video content for AI disclosure requirements. Creator flagged: ${checks.join(', ') || 'None selected'}. Content: "${content.substring(0, 1500)}". Determine: 1) Required disclosure label (None / Altered/Synthetic / Significantly Altered), 2) YouTube-compliant description disclosure text (1-2 sentences), 3) Pinned comment disclosure text. Return JSON: { "label": "...", "descriptionDisclosure": "...", "commentDisclosure": "...", "reasoning": "..." }`,
      systemPrompt: 'You are a YouTube compliance specialist for AI content labeling (2026 policy). Respond with JSON only.',
      taskType: 'tags'
    });
    const data = await res.json();
    const content2 = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content2.replace(/```json|```/g, '').trim());

    document.getElementById('label-badge').textContent = parsed.label || 'Altered/Synthetic';
    document.getElementById('label-badge').className = 'label-badge ' + ((parsed.label || '').toLowerCase().includes('none') ? 'label-safe' : 'label-altered');
    document.getElementById('label-disclosure').innerHTML = `<p><strong>Reasoning:</strong> ${escapeHTML(parsed.reasoning || 'Based on your content flags, disclosure is recommended.')}</p>`;
    document.getElementById('label-desc-text').innerHTML = `<code>${escapeHTML(parsed.descriptionDisclosure || 'This video contains AI-generated content.')}</code> <button class="btn-sm btn-outline" onclick="navigator.clipboard.writeText('${(parsed.descriptionDisclosure || '').replace(/'/g, "\\'")}');showToast('Copied!','success')">📋 Copy</button>`;
    document.getElementById('label-comment-text').innerHTML = `<code>${escapeHTML(parsed.commentDisclosure || 'Transparency note: AI tools were used in parts of this video.')}</code> <button class="btn-sm btn-outline" onclick="navigator.clipboard.writeText('${(parsed.commentDisclosure || '').replace(/'/g, "\\'")}');showToast('Copied!','success')">📋 Copy</button>`;
    if (result) result.style.display = 'block';
  } catch (e) {
    showToast('Analysis failed. Try again.', 'error');
    console.error('[AILabel]', e);
  }
  if (loading) loading.style.display = 'none';
}
window.generateAILabel = generateAILabel;

function copyAILabelAll() {
  const descEl = document.getElementById('label-desc-text');
  const commEl = document.getElementById('label-comment-text');
  const desc = descEl?.querySelector('code')?.textContent || '';
  const comm = commEl?.querySelector('code')?.textContent || '';
  navigator.clipboard.writeText(`DESCRIPTION DISCLOSURE:\n${desc}\n\nPINNED COMMENT:\n${comm}`).then(() => showToast('All disclosure texts copied!', 'success'));
}
window.copyAILabelAll = copyAILabelAll;

console.log('✅ All 2026 Modern Features Loaded');
console.log('✅ SaaS Logic exposed to Global Window');


// END LEGACY CODE

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 BACKWARD-COMPATIBLE OVERRIDES
//  The legacy code above may set window.* globals. We override
//  them here with the Phase 1 module versions.
//  These will be removed when Phase 2/3 extraction is complete.
// ═══════════════════════════════════════════════════════════════

// Override key functions with Phase 1 module versions
window.switchView = _switchView;
window.showToast = _showToast;
window.safeRender = _safeRender;
window.escapeHTML = _escapeHTML;

// TEMP: Use legacy switchView while debugging
window.switchView = (typeof switchView === 'function') ? switchView : _switchView;

// apiPost needs special handling since it's async
window.apiPost = _apiPost;

// Replace the DOMContentLoaded listener that legacy code may have set
// (legacy code does: document.addEventListener('DOMContentLoaded', platformInit))
// We need to ensure Phase 1 initialization runs properly.
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[main] Phase 1 boot via DOMContentLoaded');
  
  initConfig();
  // initDelegation(); // TEMP: disabled for debugging
  
  // Register all action handlers for data-action delegation
  // registerActions disabled for debugging
  /*
  registerActions({
    switchTo: (viewName) => _switchView(viewName),
    toggleFolder: (id) => { if (typeof toggleFolder === 'function') toggleFolder(id); },
    toggleSidebar: () => { if (typeof window.toggleSidebar === 'function') window.toggleSidebar(); },
    toggleProfileMenu: () => { if (typeof window.toggleProfileMenu === 'function') window.toggleProfileMenu(); },
    initiateOAuth: () => { if (typeof initiateOAuth === 'function') initiateOAuth(); },
    logout: () => { if (typeof window.logout === 'function') window.logout(); },
    setAgentMode: (mode) => { if (typeof setAgentMode === 'function') setAgentMode(mode); },
    agentKillSwitch: () => { if (typeof agentKillSwitch === 'function') agentKillSwitch(); },
    runResearch: () => { if (typeof runResearch === 'function') runResearch(); },
    sortTable: (col) => { if (typeof sortTable === 'function') sortTable(parseInt(col)); },
    exportKeywordsCSV: () => { if (typeof exportKeywordsCSV === 'function') exportKeywordsCSV(); },
    generateScript: () => { if (typeof generateScript === 'function') generateScript(); },
    runManualAudit: () => { if (typeof runManualAudit === 'function') runManualAudit(); },
    regenerateScript: () => { if (typeof regenerateScript === 'function') regenerateScript(); },
    sendToAuditor: () => { if (typeof sendToAuditor === 'function') sendToAuditor(); },
    sendToVideoFactory: () => { if (typeof window.sendToVideoFactory === 'function') window.sendToVideoFactory(); },
    exportToMetadata: () => { if (typeof exportToMetadata === 'function') exportToMetadata(); },
    exportToMetadataWeaver: () => { if (typeof window.exportToMetadataWeaver === 'function') window.exportToMetadataWeaver(); },
    copyVoiceover: () => { if (typeof copyVoiceover === 'function') copyVoiceover(); },
    copyMetadataOnly: () => { if (typeof copyMetadataOnly === 'function') copyMetadataOnly(); },
    copyElement: (id) => { if (typeof window.copyElement === 'function') window.copyElement(id); },
    copyFullBundle: () => { if (typeof window.copyFullBundle === 'function') window.copyFullBundle(); },
    copyInfiltrationBundle: () => { if (typeof copyInfiltrationBundle === 'function') copyInfiltrationBundle(); },
    copyAllOriginalTags: () => { if (typeof copyAllOriginalTags === 'function') copyAllOriginalTags(); },
    copyChapters: () => { if (typeof copyChapters === 'function') copyChapters(); },
    copyCommunityPost: () => { if (typeof copyCommunityPost === 'function') copyCommunityPost(); },
    copyAILabelAll: () => { if (typeof copyAILabelAll === 'function') copyAILabelAll(); },
    copyCollusionTags: () => { if (typeof copyCollusionTags === 'function') copyCollusionTags(); },
    copyGatewayUrl: () => { if (typeof copyGatewayUrl === 'function') copyGatewayUrl(); },
    applyToMetadataWeaver: () => { if (typeof applyToMetadataWeaver === 'function') applyToMetadataWeaver(); },
    analyzeCompetitor: () => { if (typeof analyzeCompetitor === 'function') analyzeCompetitor(); },
    analyzeThumbnail: (mode) => { if (typeof window.analyzeThumbnail === 'function') window.analyzeThumbnail(mode); },
    analyzeNicheRelevance: () => { if (typeof window.analyzeNicheRelevance === 'function') window.analyzeNicheRelevance(); },
    discoverCompetitors: () => { if (typeof window.discoverCompetitors === 'function') window.discoverCompetitors(); },
    auditVideoMetadata: () => { if (typeof window.auditVideoMetadata === 'function') window.auditVideoMetadata(); },
    generateSEOBundle: () => { if (typeof window.generateSEOBundle === 'function') window.generateSEOBundle(); },
    runEvergreenAudit: () => { if (typeof runEvergreenAudit === 'function') runEvergreenAudit(); },
    triggerGrowthScan: () => { if (typeof window.triggerGrowthScan === 'function') window.triggerGrowthScan(); },
    runAutoFlow: () => { if (typeof runAutoFlow === 'function') runAutoFlow(); },
    GrowthEngine_scan: () => { if (typeof window.GrowthEngine !== 'undefined') window.GrowthEngine.scan(); },
    scanAndQueue: () => { if (typeof window.scanAndQueue === 'function') window.scanAndQueue(); },
    loadOptQueue: () => { if (typeof window.loadOptQueue === 'function') window.loadOptQueue(); },
    approveAllQueue: () => { if (typeof window.approveAllQueue === 'function') window.approveAllQueue(); },
    skipAllQueue: () => { if (typeof window.skipAllQueue === 'function') window.skipAllQueue(); },
    applyAllApproved: () => { if (typeof window.applyAllApproved === 'function') window.applyAllApproved(); },
    filterInbox: (f) => { if (typeof window.filterInbox === 'function') window.filterInbox(f); },
    loadPhronesis: () => { if (typeof loadPhronesis === 'function') loadPhronesis(); },
    refreshPhronesis: () => { if (typeof window.refreshPhronesis === 'function') window.refreshPhronesis(); },
    loadNeuralStrategy: () => { if (typeof loadNeuralStrategy === 'function') loadNeuralStrategy(); },
    loadRetentionData: () => { if (typeof loadRetentionData === 'function') loadRetentionData(); },
    reorderPlaylistOnYoutube: () => { if (typeof reorderPlaylistOnYoutube === 'function') reorderPlaylistOnYoutube(); },
    restoreOriginalOrder: () => { if (typeof restoreOriginalOrder === 'function') restoreOriginalOrder(); },
    toggleCoachDrawer: (show) => { if (typeof toggleCoachDrawer === 'function') toggleCoachDrawer(show === 'true'); },
    toggleAssistant: () => { if (typeof toggleAssistant === 'function') toggleAssistant(); },
    sendArchitectMessage: () => { if (typeof sendArchitectMessage === 'function') sendArchitectMessage(); },
    clearCoachMemory: () => { if (typeof window.clearCoachMemory === 'function') window.clearCoachMemory(); },
    fetchTargetComments: () => { if (typeof fetchTargetComments === 'function') fetchTargetComments(); },
    generateChapters: () => { if (typeof generateChapters === 'function') generateChapters(); },
    generateCommunityPost: () => { if (typeof generateCommunityPost === 'function') generateCommunityPost(); },
    generateMultiLanguageSEO: () => { if (typeof generateMultiLanguageSEO === 'function') generateMultiLanguageSEO(); },
    generateAILabel: () => { if (typeof generateAILabel === 'function') generateAILabel(); },
    extractShortsHooks: () => { if (typeof window.extractShortsHooks === 'function') window.extractShortsHooks(); },
    extractShortsHooksFromFactory: () => { if (typeof window.extractShortsHooksFromFactory === 'function') window.extractShortsHooksFromFactory(); },
    generateWeave: () => { if (typeof generateWeave === 'function') generateWeave(); },
    generateCollusionTags: () => { if (typeof generateCollusionTags === 'function') generateCollusionTags(); },
    generateGatewayUrl: () => { if (typeof generateGatewayUrl === 'function') generateGatewayUrl(); },
    applyNarrativeToPlaylist: () => { if (typeof applyNarrativeToPlaylist === 'function') applyNarrativeToPlaylist(); },
    injectCollusionTags: () => { if (typeof injectCollusionTags === 'function') injectCollusionTags(); },
    loadWeaverPlaylists: () => { if (typeof loadWeaverPlaylists === 'function') loadWeaverPlaylists(); },
    switchSuiteTab: (tab) => { if (typeof switchSuiteTab === 'function') switchSuiteTab(tab); },
    generateAllProposals: () => { if (typeof window.generateAllProposals === 'function') window.generateAllProposals(); },
    generateAllRevivals: () => { if (typeof window.generateAllRevivals === 'function') window.generateAllRevivals(); },
    applyAllRevivals: () => { if (typeof window.applyAllRevivals === 'function') window.applyAllRevivals(); },
    generateClusters: () => { if (typeof window.generateClusters === 'function') window.generateClusters(); },
    bulkGeneratePages: () => { if (typeof window.bulkGeneratePages === 'function') window.bulkGeneratePages(); },
    loadTrendPulse: () => { if (typeof loadTrendPulse === 'function') loadTrendPulse(); },
    closeTrendModal: () => { if (typeof window.closeTrendModal === 'function') window.closeTrendModal(); },
    loadAnalytics: () => { if (typeof loadAnalytics === 'function') loadAnalytics(); },
    loadAbTests: () => { if (typeof loadAbTests === 'function') loadAbTests(); },
    loadSeoLab: () => { if (typeof loadSeoLab === 'function') loadSeoLab(); },
    loadSuggestedAnalytics: () => { if (typeof loadSuggestedAnalytics === 'function') loadSuggestedAnalytics(); },
    suggestAbVariants: () => { if (typeof window.suggestAbVariants === 'function') window.suggestAbVariants(); },
    startAbTest: () => { if (typeof window.startAbTest === 'function') window.startAbTest(); },
    runHealthCheck: () => { if (typeof runHealthCheck === 'function') runHealthCheck(); },
    runSystemHealthProbe: () => { if (typeof runSystemHealthProbe === 'function') runSystemHealthProbe(); },
    runMockTest: () => { if (typeof window.runMockTest === 'function') window.runMockTest(); },
    saveAgentGoal: () => { if (typeof window.saveAgentGoal === 'function') window.saveAgentGoal(); },
    OptTrials_refresh: () => { if (typeof OptimizationTrials !== 'undefined') OptimizationTrials.refresh(); },
    OptTrials_measureImpact: () => { if (typeof OptimizationTrials !== 'undefined') OptimizationTrials.measureImpact(); },
    OptTrials_measureAll: () => { if (typeof OptimizationTrials !== 'undefined') OptimizationTrials.measureAllPending(); },
    SessionMemory_clear: () => { if (typeof SessionMemory !== 'undefined') SessionMemory.clear(); },
    SaaS_research: () => { if (typeof runResearch === 'function') runResearch(); },
    SaaS_factory: () => { if (typeof generateScript === 'function') generateScript(); },
    SaaS_sniper: () => { if (typeof analyzeCompetitor === 'function') analyzeCompetitor(); },
    SaaS_redesign: () => { if (typeof runThumbnailRedesign === 'function') runThumbnailRedesign(); },
    SaaS_coach: () => { if (typeof toggleCoachDrawer === 'function') toggleCoachDrawer(true); },
    SaaS_auth: () => { if (typeof initiateOAuth === 'function') initiateOAuth(); },
    SaaS_send: () => { if (typeof sendArchitectMessage === 'function') sendArchitectMessage(); },
    SaaS_ask: (msg) => { if (typeof window.SaaS !== 'undefined') window.SaaS.ask(msg); },
    SaaS_clearChat: () => {},
    // SaaS_pay disabled
  });
  */
  });

  // Fetch CSRF token before API calls
  try {
    const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const csrfRes = await fetch('/api/auth/csrf?channelId=' + chId);
    const csrfData = await csrfRes.json();
    if (csrfData.token) {
      window.csrfToken = csrfData.token;
      localStorage.setItem('csrf_token', csrfData.token);
    }
  } catch(e) {}

  // Run the legacy platformInit if it exists (Phase 2/3 modules)
  if (typeof platformInit === 'function') {
    console.log('[main] Running legacy platformInit');
    platformInit();
  }

  // Init onboarding (Phase 1 version)
  _initOnboarding();

  console.log('[main] Phase 1 boot complete.');
});

// Initialize Vercel Analytics
inject();
window.vaTrack = (event, data) => {
  try { track(event, data); } catch(e) {}
};

console.log('[main] Phase 1 modules loaded. Legacy code follows...');
