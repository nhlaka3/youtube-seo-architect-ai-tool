/**
 * popup.js — Popup logic for the YT SEO Architect Chrome extension
 */

(async function () {
  'use strict';

  // Check if we're on YouTube
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isYouTube = tab?.url?.includes('youtube.com');

  if (!isYouTube) {
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('not-youtube-view').classList.remove('hidden');
    return;
  }

  // Load stats from storage
  const data = await chrome.storage.local.get(['videosScored', 'panelVisible']);
  document.getElementById('count').textContent = data.videosScored || 0;

  const panelVisible = data.panelVisible !== false;
  document.getElementById('panel-status').textContent = panelVisible ? 'Visible' : 'Hidden';
  document.getElementById('toggle-panel').textContent = panelVisible
    ? 'Hide Panel on This Page'
    : 'Show Panel on This Page';

  // Toggle panel visibility
  document.getElementById('toggle-panel').addEventListener('click', async () => {
    const newState = !panelVisible;
    await chrome.storage.local.set({ panelVisible: newState });

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_PANEL',
      visible: newState,
    });

    document.getElementById('panel-status').textContent = newState ? 'Visible' : 'Hidden';
    document.getElementById('toggle-panel').textContent = newState
      ? 'Hide Panel on This Page'
      : 'Show Panel on This Page';
  });

  // Listen for score updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SCORE_UPDATED') {
      document.getElementById('count').textContent = msg.count;
    }
  });
})();
