// js/modules/growth.js — Growth Engine + Optimization Queue
// Phase 3 bridge: re-exports from legacy window.* globals

export const GrowthEngine = {
  loadReport() {
    if (typeof window.GrowthEngine !== 'undefined' && typeof window.GrowthEngine.loadReport === 'function') {
      window.GrowthEngine.loadReport();
    }
  }
};

export function loadGrowthReport() {
  if (typeof window.loadGrowthReport === 'function') window.loadGrowthReport();
}

export const OptimizationInbox = {
  refresh() {
    if (typeof window.OptimizationInbox !== 'undefined' && typeof window.OptimizationInbox.refresh === 'function') {
      window.OptimizationInbox.refresh();
    }
  }
};

export function loadOptimizationQueue() {
  if (typeof window.loadOptimizationQueue === 'function') window.loadOptimizationQueue();
}
