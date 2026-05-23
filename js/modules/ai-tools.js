// js/modules/ai-tools.js — Trend Pulse, Chapters, Community Posts, Multi-Language, AI Labeling
// Phase 3 bridge: re-exports from legacy window.* globals

export async function loadTrendPulse() {
  if (typeof window.loadTrendPulse === 'function') return window.loadTrendPulse();
}

export async function capitalizeTrend(keyword) {
  if (typeof window.capitalizeTrend === 'function') return window.capitalizeTrend(keyword);
}

export async function generateCommunityPost() {
  if (typeof window.generateCommunityPost === 'function') return window.generateCommunityPost();
}

export function copyCommunityPost() {
  if (typeof window.copyCommunityPost === 'function') window.copyCommunityPost();
}

export async function generateMultiLanguageSEO() {
  if (typeof window.generateMultiLanguageSEO === 'function') return window.generateMultiLanguageSEO();
}

export async function generateAILabel() {
  if (typeof window.generateAILabel === 'function') return window.generateAILabel();
}

export function copyChapters() {
  if (typeof window.copyChapters === 'function') window.copyChapters();
}

export function copyAILabelAll() {
  if (typeof window.copyAILabelAll === 'function') window.copyAILabelAll();
}

export function loadAnalytics() {
  if (typeof window.loadAnalytics === 'function') window.loadAnalytics();
}

export function loadAbTests() {
  if (typeof window.loadAbTests === 'function') window.loadAbTests();
}

export function loadSeoLab() {
  if (typeof window.loadSeoLab === 'function') window.loadSeoLab();
}
