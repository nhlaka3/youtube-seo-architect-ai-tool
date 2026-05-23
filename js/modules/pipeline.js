// js/modules/pipeline.js — AutoFlow, Playlist Suite, Collusion Tags
// Phase 3 bridge: re-exports from legacy window.* globals

export async function runAutoFlow() {
  if (typeof window.runAutoFlow === 'function') return window.runAutoFlow();
}

export const PIPELINE_CONFIG = {
  get() {
    return typeof window.PIPELINE_CONFIG !== 'undefined' ? window.PIPELINE_CONFIG : {};
  }
};

export async function generateWeave() {
  if (typeof window.generateWeave === 'function') return window.generateWeave();
}

export async function generateCollusionTags() {
  if (typeof window.generateCollusionTags === 'function') return window.generateCollusionTags();
}

export function applyNarrativeToPlaylist() {
  if (typeof window.applyNarrativeToPlaylist === 'function') window.applyNarrativeToPlaylist();
}

export function injectCollusionTags() {
  if (typeof window.injectCollusionTags === 'function') window.injectCollusionTags();
}

export function generateGatewayUrl() {
  if (typeof window.generateGatewayUrl === 'function') window.generateGatewayUrl();
}

export function scheduleVideoUpload() {
  if (typeof window.scheduleVideoUpload === 'function') window.scheduleVideoUpload();
}
