# TASK 08 — Trend Pulse: Real-Time Trend Alerts

## Goal
Show creators trending topics in their niche with a 48-hour urgency window.
Data comes from YouTube's trending search + Google Trends RSS. AI scores
alignment with the creator's existing content and generates a ready-to-use
SEO bundle for each trend.

---

## STEP 1 — Create the Trend Pulse API

**Create file: `api/trend-pulse.js`**

```js
import express from 'express';
import { z } from 'zod';
import { validateQuery } from './middleware/validate.js';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

const trendSchema = z.object({
  niche: z.string().optional(),
  country: z.string().length(2).optional(), // ISO 2-letter country code
});

/**
 * Fetch trending YouTube search topics via YouTube Data API public search.
 * Uses the free `search.list` endpoint filtering for recent high-view content.
 */
async function fetchYouTubeTrends(niche, apiKey) {
  const q = niche && niche !== 'General' ? niche : '';
  const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    maxResults: '10',
    publishedAfter,
    key: apiKey,
    ...(q ? { q } : {}),
  });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => ({
      title: item.snippet?.title || '',
      channelTitle: item.snippet?.channelTitle || '',
      publishedAt: item.snippet?.publishedAt || '',
      videoId: item.id?.videoId || '',
      thumbnail: item.snippet?.thumbnails?.medium?.url || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch Google Trends RSS for a country (free, no API key needed).
 */
async function fetchGoogleTrendsRSS(country = 'US') {
  try {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${country.toUpperCase()}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Parse RSS items with regex (no XML parser needed)
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const trafficMatch = itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
      if (titleMatch) {
        items.push({
          keyword: titleMatch[1].trim(),
          traffic: trafficMatch ? trafficMatch[1].trim() : 'Unknown',
        });
      }
      if (items.length >= 15) break;
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Score how well a trending topic aligns with a creator's niche.
 */
function alignmentScore(trendKeyword, niche) {
  if (!niche || niche === 'General') return 50;
  const kw = trendKeyword.toLowerCase();
  const n = niche.toLowerCase();
  const nicheWords = n.split(/\s+/);
  
  let score = 0;
  // Direct niche match
  if (kw.includes(n)) score += 60;
  // Partial word match
  nicheWords.forEach(w => { if (w.length > 3 && kw.includes(w)) score += 20; });
  // Broad relevance heuristics
  const techNiches = ['tech', 'software', 'ai', 'coding', 'programming'];
  const financeNiches = ['finance', 'money', 'invest', 'crypto', 'business'];
  const healthNiches = ['health', 'fitness', 'workout', 'diet', 'wellness'];

  if (techNiches.some(t => n.includes(t)) && techNiches.some(t => kw.includes(t))) score += 30;
  if (financeNiches.some(t => n.includes(t)) && financeNiches.some(t => kw.includes(t))) score += 30;
  if (healthNiches.some(t => n.includes(t)) && healthNiches.some(t => kw.includes(t))) score += 30;

  return Math.min(100, score);
}

// ── Route: Get trending topics ──
router.get('/pulse', validateQuery(trendSchema), async (req, res) => {
  try {
    const { niche = 'General', country = 'US' } = req.query;

    // Try cache first
    let cacheModule;
    try { cacheModule = await import('./_lib/cache.js'); } catch { cacheModule = null; }
    const cacheKey = `trend-pulse:${niche.toLowerCase()}:${country}`;

    const doFetch = async () => {
      const apiKey = process.env.YOUTUBE_API_KEY;

      // Fetch from both sources in parallel
      const [ytTrends, googleTrends] = await Promise.all([
        apiKey ? fetchYouTubeTrends(niche, apiKey) : [],
        fetchGoogleTrendsRSS(country),
      ]);

      // Merge: Google Trends RSS gives keyword names, YT gives actual videos
      const trends = [];

      // Process Google Trends
      googleTrends.slice(0, 10).forEach(t => {
        const alignment = alignmentScore(t.keyword, niche);
        trends.push({
          type: 'search_trend',
          keyword: t.keyword,
          traffic: t.traffic,
          alignmentScore: alignment,
          alignmentLabel: alignment >= 60 ? 'High' : alignment >= 30 ? 'Medium' : 'Low',
          urgencyHours: Math.floor(Math.random() * 24) + 24, // 24-48h urgency window
          source: 'Google Trends',
          actionable: alignment >= 30,
        });
      });

      // Process YT trending videos
      ytTrends.slice(0, 5).forEach(v => {
        const alignment = alignmentScore(v.title, niche);
        trends.push({
          type: 'youtube_video',
          keyword: v.title,
          channelTitle: v.channelTitle,
          videoId: v.videoId,
          thumbnail: v.thumbnail,
          alignmentScore: alignment,
          alignmentLabel: alignment >= 60 ? 'High' : alignment >= 30 ? 'Medium' : 'Low',
          urgencyHours: 48,
          source: 'YouTube Trending',
          actionable: alignment >= 20,
        });
      });

      // Sort: high alignment first, then by urgency
      trends.sort((a, b) => b.alignmentScore - a.alignmentScore);

      return {
        niche,
        country,
        trends: trends.slice(0, 12),
        fetchedAt: new Date().toISOString(),
        nextRefresh: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    };

    const result = cacheModule
      ? await cacheModule.cached(cacheKey, cacheModule.TTL.TREND_PULSE, doFetch)
      : await doFetch();

    sendRes(res, 200, result);
  } catch (e) {
    console.error('[Trend Pulse]', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Generate SEO bundle for a trend ──
router.post('/capitalize', async (req, res) => {
  try {
    const { keyword, niche } = req.body;
    if (!keyword) return sendRes(res, 400, { error: 'keyword required' });

    const { askAI } = await import('./_lib/ai-provider.js');

    const raw = await askAI(
      'You are a YouTube trend capitalization expert. Return ONLY valid JSON.',
      `A trending topic has emerged: "${keyword}" 
Creator niche: "${niche || 'General'}"
The creator has a 48-hour window to publish on this trend.

Generate a complete YouTube video brief to capitalize on this trend NOW.
Return JSON:
{
  "videoTitle": "SEO-optimized title ≤60 chars that rides this trend",
  "hook": "Opening 30 seconds script to grab attention",
  "outline": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "description": "Full description 200+ words with hook, points, CTA, hashtags",
  "thumbnailConcept": "Visual concept for thumbnail",
  "publishWindow": "Publish within X hours for maximum impact",
  "competitionLevel": "Low/Medium/High",
  "estimatedViews": "Rough estimate range"
}`,
      { temperature: 0.7, maxTokens: 1200 }
    );

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    sendRes(res, 200, { keyword, niche, bundle: parsed });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 2 — Register in main.js

```js
// Import:
import { router as trendPulseRouter } from './api/trend-pulse.js';

// Register:
app.use('/api/trends', trendPulseRouter);
```

---

## STEP 3 — Add Trend Pulse panel to dashboard.html

### 3a — Add sidebar nav item

```html
<li class="nav-item" onclick="showPanel('trend-pulse')" id="nav-trend-pulse">
  <span class="nav-icon">⚡</span>
  <span class="nav-label">Trend Pulse</span>
</li>
```

### 3b — Add panel HTML

```html
<!-- ══ TREND PULSE PANEL ══ -->
<div id="panel-trend-pulse" class="panel" style="display:none;">
  <div class="panel-header">
    <h2>⚡ Trend Pulse</h2>
    <p class="panel-subtitle">Catch trending topics before your competitors. 48-hour opportunity windows.</p>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center;">
    <input 
      type="text" 
      id="trend-niche-input" 
      placeholder="Your niche (e.g. Finance, Gaming)" 
      class="input-field"
      style="flex:1;min-width:180px;"
    />
    <select id="trend-country-select" class="input-field" style="width:120px;">
      <option value="US">🇺🇸 US</option>
      <option value="GB">🇬🇧 UK</option>
      <option value="AU">🇦🇺 AU</option>
      <option value="CA">🇨🇦 CA</option>
      <option value="ZA">🇿🇦 ZA</option>
      <option value="NG">🇳🇬 NG</option>
    </select>
    <button class="btn-primary" onclick="loadTrendPulse()" id="trend-load-btn">
      ⚡ Scan Trends
    </button>
  </div>

  <div id="trend-loading" style="display:none;text-align:center;padding:40px;">
    <div class="loading-spinner"></div>
    <p style="color:var(--text-muted);margin-top:12px;">Scanning trending topics...</p>
  </div>

  <div id="trend-grid" style="display:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span id="trend-meta" style="color:var(--text-muted);font-size:13px;"></span>
      <span style="font-size:12px;color:var(--text-muted);">🔄 Cached 1h</span>
    </div>
    <div id="trend-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;"></div>
  </div>

  <!-- Capitalize Modal -->
  <div id="trend-capitalize-modal" style="
    display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);
    z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;
  ">
    <div style="background:var(--bg-card);border:1px solid rgba(255,255,255,0.1);border-radius:16px;max-width:700px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;">🚀 Capitalize on Trend</h3>
        <button onclick="closeTrendModal()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div id="trend-bundle-loading" style="text-align:center;padding:40px;">
        <div class="loading-spinner"></div>
        <p style="color:var(--text-muted);margin-top:12px;">Generating your content brief...</p>
      </div>
      <div id="trend-bundle-content" style="display:none;"></div>
    </div>
  </div>
</div>
```

### 3c — Add JavaScript to main.js

```js
// ══ TREND PULSE ══

async function loadTrendPulse() {
  const niche = document.getElementById('trend-niche-input')?.value?.trim() || 'General';
  const country = document.getElementById('trend-country-select')?.value || 'US';
  const btn = document.getElementById('trend-load-btn');

  document.getElementById('trend-loading').style.display = 'block';
  document.getElementById('trend-grid').style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }

  try {
    const res = await fetch(`/api/trends/pulse?niche=${encodeURIComponent(niche)}&country=${country}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch trends');

    renderTrendCards(data);
    const metaEl = document.getElementById('trend-meta');
    if (metaEl) metaEl.textContent = `${data.trends.length} trends found for "${niche}" · ${new Date(data.fetchedAt).toLocaleTimeString()}`;
    document.getElementById('trend-grid').style.display = 'block';
  } catch (err) {
    alert('Trend scan failed: ' + err.message);
  } finally {
    document.getElementById('trend-loading').style.display = 'none';
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Scan Trends'; }
  }
}

function renderTrendCards(data) {
  const container = document.getElementById('trend-cards');
  if (!container) return;

  const alignColor = { High: 'var(--success)', Medium: 'var(--warning)', Low: 'var(--text-muted)' };

  container.innerHTML = data.trends.map(trend => `
    <div style="
      background:var(--bg-card);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:12px;
      padding:18px;
      transition:border-color 0.2s;
      ${trend.alignmentScore >= 60 ? 'border-color:rgba(0,212,255,0.3);' : ''}
    " 
    onmouseover="this.style.borderColor='rgba(0,212,255,0.3)'"
    onmouseout="this.style.borderColor='${trend.alignmentScore >= 60 ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}'">
      
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
        <span style="font-size:11px;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:4px;">
          ${trend.source}
        </span>
        <span style="font-size:11px;color:var(--danger);">⏱ ${trend.urgencyHours}h window</span>
      </div>

      <div style="font-weight:600;font-size:15px;margin-bottom:8px;line-height:1.4;">
        ${trend.keyword.substring(0, 80)}
      </div>

      ${trend.traffic ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">🔍 ${trend.traffic} searches</div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:${alignColor[trend.alignmentLabel]};">
          ● ${trend.alignmentLabel} alignment
        </span>
        ${trend.actionable ? `
          <button class="btn-primary" style="font-size:12px;padding:6px 14px;"
            onclick="capitalizeTrend('${trend.keyword.replace(/'/g, "\\'")}')">
            🚀 Capitalize
          </button>
        ` : `<span style="font-size:12px;color:var(--text-muted);">Low relevance</span>`}
      </div>
    </div>
  `).join('');
}

async function capitalizeTrend(keyword) {
  const modal = document.getElementById('trend-capitalize-modal');
  const bundleLoading = document.getElementById('trend-bundle-loading');
  const bundleContent = document.getElementById('trend-bundle-content');
  
  if (!modal) return;
  modal.style.display = 'flex';
  bundleLoading.style.display = 'block';
  bundleContent.style.display = 'none';

  try {
    const niche = document.getElementById('trend-niche-input')?.value?.trim() || 'General';
    const channelId = window.currentChannelId || '';
    
    const res = await fetch('/api/trends/capitalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({ keyword, niche }),
    });
    const data = await res.json();
    const b = data.bundle || {};

    bundleContent.innerHTML = `
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Video Title</label>
        <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:4px;font-weight:600;">
          ${b.videoTitle || ''}
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Opening Hook Script</label>
        <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:4px;font-size:13px;line-height:1.6;color:var(--text-muted);">
          ${b.hook || ''}
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Video Outline</label>
        <ul style="margin:8px 0 0;padding-left:20px;color:var(--text-muted);font-size:13px;line-height:2;">
          ${(b.outline || []).map(p => `<li>${p}</li>`).join('')}
        </ul>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Publish Window</label>
          <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px;margin-top:4px;font-weight:600;color:var(--danger);">
            ${b.publishWindow || ''}
          </div>
        </div>
        <div>
          <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Est. Views</label>
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:10px;margin-top:4px;font-weight:600;color:var(--success);">
            ${b.estimatedViews || ''}
          </div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;text-transform:uppercase;color:var(--accent);letter-spacing:1px;">Tags (${(b.tags || []).length})</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${(b.tags || []).map(t => `<span style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:20px;padding:4px 10px;font-size:12px;">${t}</span>`).join('')}
        </div>
      </div>
    `;
    bundleLoading.style.display = 'none';
    bundleContent.style.display = 'block';
  } catch (err) {
    bundleLoading.innerHTML = `<p style="color:var(--danger);">Failed: ${err.message}</p>`;
  }
}

function closeTrendModal() {
  const modal = document.getElementById('trend-capitalize-modal');
  if (modal) modal.style.display = 'none';
}

window.loadTrendPulse = loadTrendPulse;
window.capitalizeTrend = capitalizeTrend;
window.closeTrendModal = closeTrendModal;
```

---

## Acceptance Criteria

1. `GET /api/trends/pulse?niche=Finance&country=US` returns
   `{ trends: [...], fetchedAt, niche, country }`
2. Each trend has: `keyword, alignmentScore, alignmentLabel, urgencyHours, source, actionable`
3. `POST /api/trends/capitalize` with `{ keyword, niche }` returns
   `{ bundle: { videoTitle, hook, outline, tags, publishWindow, estimatedViews } }`
4. Dashboard panel shows trend cards with urgency timers
5. "Capitalize" button opens modal with full video brief
6. Second call to `/api/trends/pulse` with same params is instant (cache hit)

## Files Changed
- `api/trend-pulse.js` — NEW
- `main.js` — MODIFIED (router + JS functions)
- `dashboard.html` — MODIFIED (sidebar item + panel + modal)
