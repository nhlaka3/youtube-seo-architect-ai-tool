// js/modules/tools.js — Thumbnail Lab, Sidebar Sniper, Script-to-Shorts
// Phase 3 bridge: re-exports from legacy window.* globals

export function runThumbnailRedesign() {
  if (typeof window.runThumbnailRedesign === 'function') window.runThumbnailRedesign();
}

export function runSidebarSniper() {
  if (typeof window.runSidebarSniper === 'function') window.runSidebarSniper();
}

export function scriptToShorts() {
  if (typeof window.scriptToShorts === 'function') window.scriptToShorts();
}

export async function generateChapters() {
  if (typeof window.generateChapters === 'function') return window.generateChapters();
}

export async function renderVideoAssembly() {
  if (typeof window.renderVideoAssembly === 'function') return window.renderVideoAssembly();
}

export async function prepareVideoScript() {
  if (typeof window.prepareVideoScript === 'function') return window.prepareVideoScript();
}
