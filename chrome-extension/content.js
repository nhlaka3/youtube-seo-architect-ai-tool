/**
 * content.js — Injects SEO score panel into YouTube video pages
 *
 * Runs on every YouTube page. Detects video pages, extracts the
 * video ID, calls the API for SEO analysis, and displays a floating
 * score panel with title analysis, tag suggestions, and tips.
 */

(function () {
  'use strict';

  const API_BASE = 'https://yt-seo-architect.vercel.app';
  const PANEL_ID = 'yt-seo-panel';
  let currentVideoId = null;
  let panelVisible = true;

  // ─── Utility ────────────────────────────────────────────────

  function getVideoId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('v');
  }

  function getVideoTitle() {
    const el = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string');
    return el ? el.textContent.trim() : document.title.replace(' - YouTube', '').trim();
  }

  function getChannelName() {
    const el = document.querySelector('#channel-name a, ytd-channel-name a');
    return el ? el.textContent.trim() : 'Unknown';
  }

  function getChannelSubs() {
    const el = document.querySelector('#owner-sub-count');
    return el ? el.textContent.trim() : '';
  }

  function getVideoViews() {
    const el = document.querySelector('#info span.view-count, ytd-video-primary-info-renderer #info-text span');
    return el ? el.textContent.trim() : '';
  }

  function getVideoDate() {
    const el = document.querySelector('#info-strings yt-formatted-string, #description .ytd-video-primary-info-renderer');
    return el ? el.textContent.trim() : '';
  }

  // ─── Score Calculation (client-side, instant) ───────────────

  function calculateTitleScore(title) {
    let score = 0;
    const len = title.length;

    // Length sweet spot (40-70 chars)
    if (len >= 40 && len <= 70) score += 30;
    else if (len >= 30 && len <= 80) score += 20;
    else if (len >= 20 && len <= 100) score += 10;

    // Contains numbers (listicles perform better)
    if (/\d/.test(title)) score += 15;

    // Contains power words
    const powerWords = ['how', 'best', 'top', 'why', 'secret', 'hack', 'tip', 'guide', 'review', '2026', '2025', 'free', 'easy', 'fast', 'ultimate'];
    const lower = title.toLowerCase();
    const matches = powerWords.filter(w => lower.includes(w));
    score += Math.min(matches.length * 5, 20);

    // Contains colon or dash (structured title)
    if (/[:\-|]/.test(title)) score += 10;

    // ALL CAPS (bad)
    if (title === title.toUpperCase() && title.length > 5) score -= 15;

    // Excessive punctuation
    if ((title.match(/[!?]/g) || []).length > 2) score -= 10;

    // Starts with keyword (good for SEO)
    if (/^(how|what|why|best|top|\d+)/i.test(title)) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  function calculateDescriptionScore(description) {
    if (!description) return 10;
    let score = 0;
    const len = description.length;

    // Length
    if (len >= 200) score += 20;
    if (len >= 500) score += 15;
    if (len >= 1000) score += 10;

    // Contains links
    if (/https?:\/\//.test(description)) score += 10;

    // Contains timestamps
    if (/\d{1,2}:\d{2}/.test(description)) score += 15;

    // Contains hashtags
    if (/#\w+/.test(description)) score += 10;

    // Contains social links
    if (/instagram|twitter|tiktok|discord|patreon/i.test(description)) score += 10;

    // Paragraphs (structured)
    if (description.split('\n').length >= 3) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  function calculateTagScore(tags) {
    if (!tags || tags.length === 0) return 5;
    let score = 0;

    // Has tags at all
    score += 20;

    // Reasonable count (5-15 tags)
    if (tags.length >= 5 && tags.length <= 15) score += 30;
    else if (tags.length >= 3) score += 15;

    // Mix of short and long-tail
    const shortTags = tags.filter(t => t.split(' ').length <= 2);
    const longTags = tags.filter(t => t.split(' ').length >= 3);
    if (shortTags.length >= 2 && longTags.length >= 1) score += 20;

    // Tags include channel name
    const channelName = getChannelName().toLowerCase();
    if (tags.some(t => t.toLowerCase().includes(channelName))) score += 10;

    // Total character count reasonable
    const totalChars = tags.join('').length;
    if (totalChars >= 50 && totalChars <= 500) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  function calculateEngagementScore() {
    // Approximate based on what we can see
    let score = 50; // Default middle score

    // Check for likes
    const likeEl = document.querySelector('#top-level-buttons-computed button:first-child');
    if (likeEl) {
      const likeText = likeEl.textContent.trim();
      if (likeText && likeText !== '0') score += 10;
    }

    // Check for comments count
    const commentEl = document.querySelector('#count .count-text');
    if (commentEl) {
      const commentText = commentEl.textContent.trim();
      if (commentText && !commentText.includes('0')) score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ─── UI Rendering ───────────────────────────────────────────

  function getScoreColor(score) {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#fb923c';
    return '#f87171';
  }

  function getScoreLabel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  }

  function getBarColor(score) {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#fb923c';
    return '#f87171';
  }

  function renderBar(label, score) {
    const color = getBarColor(score);
    return `
      <div class="yt-seo-bar-row">
        <div class="yt-seo-bar-label">${label}</div>
        <div class="yt-seo-bar-track">
          <div class="yt-seo-bar-fill" style="width:${score}%;background:${color}"></div>
        </div>
        <div class="yt-seo-bar-value">${score}</div>
      </div>`;
  }

  function generateSuggestions(titleScore, descScore, tagScore, title) {
    const tips = [];

    if (titleScore < 60) {
      if (title.length < 30) tips.push('💡 Title is too short — aim for 40-70 characters');
      if (title.length > 80) tips.push('💡 Title is too long — keep it under 70 characters');
      if (!/\d/.test(title)) tips.push('💡 Add a number to your title (listicles get 36% more clicks)');
      if (!/[:\-|]/.test(title)) tips.push('💡 Use a colon or dash to structure your title');
    }

    if (descScore < 50) {
      tips.push('📝 Add timestamps to your description');
      tips.push('📝 Include links to your social media');
    }

    if (tagScore < 50) {
      tips.push('🏷️ Add more tags — aim for 8-12 relevant tags');
      tips.push('🏷️ Mix short tags ("youtube seo") with long-tail ("how to optimize youtube videos")');
    }

    if (tips.length === 0) {
      tips.push('✅ Great metadata! Keep it up.');
    }

    return tips.slice(0, 4).map(t => `<div class="yt-seo-tip">${t}</div>`).join('');
  }

  function renderPanel(titleScore, descScore, tagScore, engScore, overall, title) {
    const color = getScoreColor(overall);
    const label = getScoreLabel(overall);

    return `
      <div class="yt-seo-panel-header">
        <div class="yt-seo-logo">⚡ YT SEO</div>
        <button class="yt-seo-close" id="yt-seo-close">✕</button>
      </div>

      <div class="yt-seo-score-ring" style="--score-color: ${color}">
        <div class="yt-seo-score-number">${overall}</div>
        <div class="yt-seo-score-label">${label}</div>
      </div>

      <div class="yt-seo-breakdown">
        ${renderBar('Title', titleScore)}
        ${renderBar('Description', descScore)}
        ${renderBar('Tags', tagScore)}
        ${renderBar('Engagement', engScore)}
      </div>

      <div class="yt-seo-tips">
        ${generateSuggestions(titleScore, descScore, tagScore, title)}
      </div>

      <div class="yt-seo-footer">
        <a href="${API_BASE}" target="_blank" class="yt-seo-analyze-link">
          Full Analysis →
        </a>
      </div>`;
  }

  // ─── Panel Injection ────────────────────────────────────────

  function createPanel() {
    // Remove existing panel
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    const title = getVideoTitle();
    const description = document.querySelector('#description-inner, #description')?.textContent || '';

    // Try to get tags from meta tag
    const tagsMeta = document.querySelector('meta[name="keywords"]');
    const tags = tagsMeta ? tagsMeta.content.split(',').map(t => t.trim()).filter(Boolean) : [];

    const titleScore = calculateTitleScore(title);
    const descScore = calculateDescriptionScore(description);
    const tagScore = calculateTagScore(tags);
    const engScore = calculateEngagementScore();
    const overall = Math.round((titleScore + descScore + tagScore + engScore) / 4);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'yt-seo-panel';
    panel.innerHTML = renderPanel(titleScore, descScore, tagScore, engScore, overall, title);

    document.body.appendChild(panel);

    // Close button
    document.getElementById('yt-seo-close').addEventListener('click', () => {
      panelVisible = false;
      panel.style.display = 'none';
    });
  }

  function showMinimalPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'yt-seo-panel yt-seo-panel-mini';
    panel.innerHTML = `
      <div class="yt-seo-panel-header">
        <div class="yt-seo-logo">⚡ YT SEO</div>
        <button class="yt-seo-close" id="yt-seo-close">✕</button>
      </div>
      <div class="yt-seo-mini-content">
        <div class="yt-seo-mini-icon">📊</div>
        <div>Score this video on YT SEO Architect</div>
        <a href="${API_BASE}" target="_blank" class="yt-seo-mini-link">Open Tool →</a>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('yt-seo-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }

  // ─── Navigation Detection ───────────────────────────────────

  function onNavigate() {
    const videoId = getVideoId();
    if (videoId && videoId !== currentVideoId) {
      currentVideoId = videoId;
      // Small delay to let YouTube render
      setTimeout(() => {
        if (panelVisible) {
          createPanel();
        }
      }, 1500);
    } else if (!videoId) {
      // Not on a video page — remove panel
      const existing = document.getElementById(PANEL_ID);
      if (existing) existing.remove();
      currentVideoId = null;
    }
  }

  // Listen for YouTube SPA navigation
  let lastUrl = '';
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      onNavigate();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (back/forward)
  window.addEventListener('popstate', onNavigate);

  // Initial check
  onNavigate();

})();
