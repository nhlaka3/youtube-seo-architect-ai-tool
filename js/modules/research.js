// js/modules/research.js — Keyword research engine
// Phase 2: Module boundary. Legacy code still defines these as window.* globals.
// Phase 3: Actual function bodies will be moved here from main.js.

// Re-export from legacy globals (Phase 2 bridge)
export const researchMode = 'alphabet';
export let discoveredKeywords = [];

export function setResearchMode(mode) {
  if (typeof window.setResearchMode === 'function') window.setResearchMode(mode);
}
export async function runResearch() {
  if (typeof window.runResearch === 'function') return window.runResearch();
}
export function displayResults() {
  if (typeof window.displayResults === 'function') window.displayResults();
}
export function sortTable(col) {
  if (typeof window.sortTable === 'function') window.sortTable(col);
}
export function copyKeyword(kw) {
  if (typeof window.copyKeyword === 'function') window.copyKeyword(kw);
}
export async function snipeKeyword(kw) {
  if (typeof window.snipeKeyword === 'function') return window.snipeKeyword(kw);
}
export function exportKeywordsCSV() {
  if (typeof window.exportKeywordsCSV === 'function') window.exportKeywordsCSV();
}
