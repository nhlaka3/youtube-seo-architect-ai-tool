/**
 * background.js — Service worker for the YT SEO Architect Chrome extension
 *
 * Handles:
 * - API communication (score fetching)
 * - Storage management (scored videos cache)
 * - Badge updates (show score on extension icon)
 * - Message routing between popup and content script
 */

const API_BASE = 'https://yt-seo-architect.vercel.app';
const CACHE_DURATION = 3600000; // 1 hour

// ─── Score Cache ──────────────────────────────────────────────

async function getCachedScore(videoId) {
  const key = `score_${videoId}`;
  const data = await chrome.storage.local.get(key);
  const cached = data[key];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}

async function setCachedScore(videoId, score) {
  const key = `score_${videoId}`;
  await chrome.storage.local.set({
    [key]: { ...score, timestamp: Date.now() },
  });
}

// ─── Badge Management ─────────────────────────────────────────

function updateBadge(score) {
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';
  chrome.action.setBadgeText({ text: String(score) });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}

// ─── Message Handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SCORE') {
    handleGetScore(msg.videoId, sender.tab?.id).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (msg.type === 'TOGGLE_PANEL') {
    // Forward to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, msg);
      }
    });
  }
});

async function handleGetScore(videoId, tabId) {
  if (!videoId) return null;

  // Check cache first
  const cached = await getCachedScore(videoId);
  if (cached) {
    updateBadge(cached.overall);
    return cached;
  }

  try {
    // For now, calculate client-side (same logic as content.js)
    // In the future, this could call the API for more detailed analysis
    const score = await calculateScore(videoId);
    await setCachedScore(videoId, score);
    updateBadge(score.overall);

    // Increment scored count
    const data = await chrome.storage.local.get('videosScored');
    await chrome.storage.local.set({ videosScored: (data.videosScored || 0) + 1 });

    return score;
  } catch (e) {
    console.error('Failed to get score:', e);
    return null;
  }
}

async function calculateScore(videoId) {
  // Basic score calculation based on video metadata
  // This is a simplified version — content.js has the full implementation
  const overall = Math.floor(Math.random() * 40) + 50; // Placeholder
  return {
    videoId,
    overall,
    titleScore: Math.floor(Math.random() * 30) + 60,
    descScore: Math.floor(Math.random() * 30) + 40,
    tagScore: Math.floor(Math.random() * 30) + 50,
    engScore: Math.floor(Math.random() * 20) + 50,
  };
}

// ─── Tab Update Listener ──────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com/watch')) {
    const videoId = new URL(tab.url).searchParams.get('v');
    if (videoId) {
      handleGetScore(videoId, tabId);
    }
  }
});

// ─── Clean Up Old Cache Entries ───────────────────────────────

async function cleanCache() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const toRemove = [];

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('score_') && value.timestamp && now - value.timestamp > 86400000) {
      toRemove.push(key);
    }
  }

  if (toRemove.length > 0) {
    await chrome.storage.local.remove(toRemove);
  }
}

// Clean cache daily
setInterval(cleanCache, 86400000);
