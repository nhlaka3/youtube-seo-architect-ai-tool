// js/modules/competitor.js — Competitor analysis and sniper engine
// Phase 2: Module boundary. Legacy code still defines these as window.* globals.

export async function executeSniperInfiltration(inputId, resultsId, creditType) {
  if (typeof window.executeSniperInfiltration === 'function') return window.executeSniperInfiltration(inputId, resultsId, creditType);
}
export function analyzeCompetitor() {
  if (typeof window.analyzeCompetitor === 'function') window.analyzeCompetitor();
}
export async function fetchVideoTags(videoId) {
  if (typeof window.fetchVideoTags === 'function') return window.fetchVideoTags(videoId);
}
export async function generateBridgeTags(meta) {
  if (typeof window.generateBridgeTags === 'function') return window.generateBridgeTags(meta);
}
export function displayCompetitorResults() {
  if (typeof window.displayCompetitorResults === 'function') window.displayCompetitorResults();
}
