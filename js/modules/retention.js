// js/modules/retention.js — Retention Re-Orderer + AI Coach + Chatbot
// Phase 3 bridge: re-exports from legacy window.* globals

export async function loadRetentionData() {
  if (typeof window.loadRetentionData === 'function') return window.loadRetentionData();
}

export async function reorderPlaylistOnYoutube(isRestore) {
  if (typeof window.reorderPlaylistOnYoutube === 'function') return window.reorderPlaylistOnYoutube(isRestore);
}

export async function restoreOriginalOrder() {
  if (typeof window.restoreOriginalOrder === 'function') return window.restoreOriginalOrder();
}

export function toggleCoachDrawer(show) {
  if (typeof window.toggleCoachDrawer === 'function') window.toggleCoachDrawer(show);
}

export function toggleAssistant() {
  if (typeof window.toggleAssistant === 'function') window.toggleAssistant();
}

export async function sendArchitectMessage() {
  if (typeof window.sendArchitectMessage === 'function') return window.sendArchitectMessage();
}

export function handleCoachMessage(msg) {
  if (typeof window.handleCoachMessage === 'function') window.handleCoachMessage(msg);
}

export async function fetchTargetComments() {
  if (typeof window.fetchTargetComments === 'function') return window.fetchTargetComments();
}

export async function runSystemHealthProbe() {
  if (typeof window.runSystemHealthProbe === 'function') return window.runSystemHealthProbe();
}
