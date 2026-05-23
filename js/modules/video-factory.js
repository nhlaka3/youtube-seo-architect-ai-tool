// js/modules/video-factory.js — Script generation and metadata
// Phase 2: Module boundary. Legacy code still defines these as window.* globals.

export let generatedScript = '';
export let generatedMetadata = { title: '', description: '', tags: [] };

export async function generateScript() {
  if (typeof window.generateScript === 'function') return window.generateScript();
}
export function runManualAudit() {
  if (typeof window.runManualAudit === 'function') window.runManualAudit();
}
export async function sendToAuditor() {
  if (typeof window.sendToAuditor === 'function') return window.sendToAuditor();
}
export function regenerateScript() {
  if (typeof window.regenerateScript === 'function') window.regenerateScript();
}
export function showMetadataModal() {
  if (typeof window.showMetadataModal === 'function') window.showMetadataModal();
}
export function exportToMetadata() {
  if (typeof window.exportToMetadata === 'function') window.exportToMetadata();
}
