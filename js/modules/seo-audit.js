// js/modules/seo-audit.js — SEO scoring, plan gating, optimization trials
// Phase 2: Module boundary. Legacy code still defines these as window.* globals.

export function calculateSEOScore(title, description, tags) {
  if (typeof window.calculateSEOScore === 'function') return window.calculateSEOScore(title, description, tags);
  return 0;
}
export function runAudit() {
  if (typeof window.runAudit === 'function') window.runAudit();
}
export function runEvergreenAudit() {
  if (typeof window.runEvergreenAudit === 'function') window.runEvergreenAudit();
}
export function checkPremiumFeature(featureId) {
  if (typeof window.checkPremiumFeature === 'function') return window.checkPremiumFeature(featureId);
  return true; // Allow by default
}
export function showPremiumModal() {
  if (typeof window.showPremiumModal === 'function') window.showPremiumModal();
}

// OptimizationTrials bridge
export const OptimizationTrials = {
  refresh() {
    if (typeof window.OptimizationTrials !== 'undefined' && typeof window.OptimizationTrials.refresh === 'function') {
      window.OptimizationTrials.refresh();
    }
  }
};
