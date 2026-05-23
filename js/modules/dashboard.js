// js/modules/dashboard.js — Phronesis Dashboard UI
// Phase 3 bridge: re-exports from legacy window.* globals

export function loadPhronesis() {
  if (typeof window.loadPhronesis === 'function') window.loadPhronesis();
}

export function loadScanResults() {
  if (typeof window.loadScanResults === 'function') window.loadScanResults();
}

export function loadRecommendations() {
  if (typeof window.loadRecommendations === 'function') window.loadRecommendations();
}

export function loadCommandInbox() {
  if (typeof window.loadCommandInbox === 'function') window.loadCommandInbox();
}

export function loadNeuralStrategy() {
  if (typeof window.loadNeuralStrategy === 'function') window.loadNeuralStrategy();
}

export function loadSuggestedAnalytics() {
  if (typeof window.loadSuggestedAnalytics === 'function') window.loadSuggestedAnalytics();
}
