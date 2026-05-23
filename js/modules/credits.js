// js/modules/credits.js — Credits system + PayPal integration
// Merges CreditsSystem from main.js + PayPal from credit-system.js
// Phase 2: Module boundary established. Legacy code still runs in main.js.
// Phase 3: Legacy code will be removed when all consumers use imports.

import { config } from './config.js';
import { showToast, animateCreditsDeduction } from './core.js';

// ── Credits System ──
export const CreditsSystem = {
  total: 100,
  used: 0,
  tier: 'standard',
  history: [],

  costs: {
    'deep-research': 5, 'video-factory': 10, 'channel-audit': 10,
    'keyword-discovery': 3, 'title-generation': 1, 'description-generation': 2,
    'thumbnail': 5, 'thumbnail-analysis': 5, 'metadata-weave': 3,
    'weaver-apply': 10, 'collusion-inject': 1, 'competitor-scan': 5,
    'sidebar-sniper': 5, 'auto-responder': 1, 'pipeline': 20,
    'magic-fix': 10, 'seo-bundle': 5, 'smart-overhaul': 10,
    'proposal-generate': 2, 'proposal-apply': 8, 'retention-reorder': 15,
    'ai-assistant': 1, 'video-schedule': 3, 'bulk-inject': 5,
    'auto-mgmt': 10, 'ai-generate': 1, 'classify-niche': 1,
    'niche-relevance-guard': 5, 'evergreen-revival': 10,
    'collusion-tags': 3, 'session-linker': 3
  },

  init() {
    const channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    const creditsKey = 'ytseo_user_credits_' + channelId;
    const planCredits = parseInt(localStorage.getItem(creditsKey) || '0');
    const savedLegacy = localStorage.getItem('ytseo_credits');

    if (planCredits > 0) {
      this.total = planCredits; this.used = 0;
      this.tier = localStorage.getItem('ytseo_user_plan_' + channelId) || 'free';
      this.history = [];
    } else if (savedLegacy) {
      var data = JSON.parse(savedLegacy);
      this.total = data.total || 100; this.used = data.used || 0;
      this.tier = data.tier || 'standard'; this.history = data.history || [];
      localStorage.setItem(creditsKey, String(this.remaining));
    } else {
      this.total = 100; this.used = 0;
      this.save();
      localStorage.setItem(creditsKey, '100');
    }
    this.updateDisplay();
    this.checkLowCredits();
  },

  save() {
    var remaining = this.total - this.used;
    var channelId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
    localStorage.setItem('ytseo_credits', JSON.stringify({
      total: this.total, used: this.used, tier: this.tier, history: this.history
    }));
    localStorage.setItem('ytseo_user_credits_' + channelId, String(remaining));
  },

  get remaining() { return this.total - this.used; },

  canAfford(action) {
    var cost = this.costs[action] || 1;
    return this.remaining >= cost;
  },

  deduct(action) {
    var cost = this.costs[action] || 1;
    if (!this.canAfford(action)) {
      showToast('No credits left! Upgrade to continue.', 'error');
      return false;
    }
    this.used += cost;
    this.history.push({ action, cost, timestamp: new Date().toISOString() });
    if (this.history.length > 50) this.history = this.history.slice(-50);
    this.save(); this.updateDisplay();
    showToast('-' + cost + ' credits', 'deduction');
    if (this.remaining <= 0) {
      setTimeout(function() {
        if (confirm("You've used all your credits! Upgrade to get more. Go to pricing?")) {
          window.location.href = '/#pricing';
        }
      }, 500);
    }
    return true;
  },

  updateDisplay() {
    var countEl = document.getElementById('credits-count');
    var totalEl = document.getElementById('credits-total');
    if (countEl) countEl.textContent = this.remaining;
    if (totalEl) totalEl.textContent = this.total;
    var display = document.getElementById('credits-display');
    if (display) {
      if (this.remaining <= 10) {
        display.style.background = 'rgba(239, 68, 68, 0.15)';
        display.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      } else if (this.remaining <= 25) {
        display.style.background = 'rgba(245, 158, 11, 0.15)';
        display.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      }
    }
  },

  checkLowCredits() {
    if (this.remaining <= 10 && this.remaining > 0) {
      window.dispatchEvent(new CustomEvent('creditsLow', { detail: { remaining: this.remaining } }));
    } else if (this.remaining === 0) {
      window.dispatchEvent(new CustomEvent('creditsEmpty'));
    }
  },

  reset() { this.used = 0; this.save(); this.updateDisplay(); },

  sync(newBalance, newPlan) {
    if (typeof newBalance === 'number') { this.total = newBalance; this.used = 0; }
    if (newPlan) this.tier = newPlan;
    this.save(); this.updateDisplay();
  },

  addCredits(amount, tier) {
    this.total += amount;
    if (tier) this.tier = tier;
    this.save(); this.updateDisplay();
  }
};

// ── Plan syncing ──
export async function syncCredits() {
  var channelId = localStorage.getItem('ytseo_channel_id');
  if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) return;
  try {
    var res = await fetch(config.API_BASE_URL + '/api/credits/status?channelId=' + channelId);
    var data = await res.json();
    CreditsSystem.sync(data.credits, data.plan);
    localStorage.setItem('ytseo_user_credits', data.credits);
    localStorage.setItem('userPlan', data.plan);
    window.isPremium = ['pro', 'agency'].includes(data.plan);
    if (typeof window.updatePremiumUI === 'function') window.updatePremiumUI();
  } catch(e) {}
}

export function openPayPalModal(plan, price) {
  var modal = document.getElementById('payment-modal');
  if (!modal) return;
  var plans = { pro: { name: 'Pro', credits: '1,000 Credits/month' }, agency: { name: 'Agency', credits: 'Unlimited' } };
  var cfg = plans[plan] || plans.pro;
  var titleEl = document.getElementById('payment-modal-title');
  var descEl = document.getElementById('payment-modal-desc');
  if (titleEl) titleEl.textContent = 'Upgrade to ' + cfg.name;
  if (descEl) descEl.textContent = cfg.name + ' - $' + (price || (plan === 'agency' ? '19' : '5')) + ' (' + cfg.credits + ')';
  modal.classList.remove('hidden');
  modal.style.zIndex = '2147483647';
}

export function closePaymentModal() {
  var modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('hidden');
}

// Backward compat — legacy code uses window.*
window.CreditsSystem = CreditsSystem;
window.syncCredits = syncCredits;
window.openPayPalModal = openPayPalModal;
