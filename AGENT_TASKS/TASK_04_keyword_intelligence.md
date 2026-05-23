# TASK 04 — Keyword Intelligence Engine

## Goal
Build a keyword research tool that scores keywords by opportunity (search
volume tier, competition, content gap) and surfaces the best keywords for
a creator's niche. Add a "Keyword Intelligence Lab" panel to the dashboard.

---

## STEP 1 — Create the keyword intelligence API

**Create file: `api/keyword-intelligence.js`**

```js
import express from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from './middleware/validate.js';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

const keywordResearchSchema = z.object({
  seed: z.string().min(2).max(100),
  niche: z.string().optional(),
});

/**
 * Fetch YouTube autocomplete suggestions.
 */
async function getYTSuggestions(seed) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[1] || [];
  } catch { return []; }
}

/**
 * Fetch Google search autocomplete (broader intent signals).
 */
async function getGoogleSuggestions(seed) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[1] || [];
  } catch { return []; }
}

/**
 * Score a keyword based on heuristics.
 * Returns: { volumeTier, competition, opportunityScore }
 */
function scoreKeyword(keyword, seed, allKeywords) {
  const kw = keyword.toLowerCase();
  const seedWords = seed.toLowerCase().split(' ');
  
  // Volume tier heuristics
  let volumeTier = 'Low';
  const highVolumePatterns = /\b(how to|best|top|vs|review|tutorial|guide|tips|2024|2025|2026|free|easy|fast|make money|for beginners)\b/i;
  const medVolumePatterns = /\b(what is|why|when|where|explained|ideas|examples|without)\b/i;
  if (highVolumePatterns.test(kw)) volumeTier = 'High';
  else if (medVolumePatterns.test(kw)) volumeTier = 'Medium';
  else if (kw.split(' ').length >= 4) volumeTier = 'Medium'; // long-tail = medium volume

  // Competition heuristic: shorter = more competitive
  let competition = 'High';
  const wordCount = kw.split(' ').length;
  if (wordCount >= 5) competition = 'Low';
  else if (wordCount >= 3) competition = 'Medium';

  // Opportunity score (0-100)
  let opportunity = 0;
  if (volumeTier === 'High') opportunity += 40;
  else if (volumeTier === 'Medium') opportunity += 25;
  else opportunity += 10;
  
  if (competition === 'Low') opportunity += 40;
  else if (competition === 'Medium') opportunity += 20;
  else opportunity += 5;
  
  // Bonus: contains seed keyword (relevance)
  const containsSeed = seedWords.some(w => kw.includes(w));
  if (containsSeed) opportunity += 10;
  
  // Bonus: long-tail (easier to rank)
  if (wordCount >= 4) opportunity += 10;
  
  // Bonus: question format (high CTR)
  if (/^(how|why|what|when|where|can|do|does|is|are)/i.test(kw)) opportunity += 5;

  return {
    volumeTier,
    competition,
    opportunityScore: Math.min(100, opportunity),
  };
}

// ── Route: Keyword research ──
router.post('/research', validateBody(keywordResearchSchema), async (req, res) => {
  try {
    const { seed, niche = 'General' } = req.body;
    
    // Use cache if available (from Task 01)
    let cacheModule;
    try {
      cacheModule = await import('./_lib/cache.js');
    } catch { cacheModule = null; }

    const cacheKey = `kw-research:${seed.toLowerCase().trim()}`;
    
    const doResearch = async () => {
      // Fetch suggestions from both sources in parallel
      const [ytSuggestions, googleSuggestions] = await Promise.all([
        getYTSuggestions(seed),
        getGoogleSuggestions(seed),
      ]);

      // Merge and deduplicate
      const allRaw = [...new Set([...ytSuggestions, ...googleSuggestions])];
      
      // Score each keyword
      const keywords = allRaw.map(kw => ({
        keyword: kw,
        ...scoreKeyword(kw, seed, allRaw),
        source: ytSuggestions.includes(kw) ? 'youtube' : 'google',
      }));

      // Sort by opportunity score descending
      keywords.sort((a, b) => b.opportunityScore - a.opportunityScore);

      // Generate a suggested title for the top opportunity
      const topKeyword = keywords[0]?.keyword || seed;
      
      return {
        seed,
        niche,
        keywords: keywords.slice(0, 30),
        topOpportunity: keywords[0] || null,
        suggestedTitle: generateTitleFromKeyword(topKeyword, niche),
      };
    };

    const result = cacheModule
      ? await cacheModule.cached(cacheKey, cacheModule.TTL.KEYWORD_SUGGESTIONS, doResearch)
      : await doResearch();

    sendRes(res, 200, result);
  } catch (e) {
    console.error('[Keyword Intelligence]', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

function generateTitleFromKeyword(keyword, niche) {
  const templates = [
    `${keyword} (Complete Guide ${new Date().getFullYear()})`,
    `${keyword}: What Nobody Tells You`,
    `The Truth About ${keyword}`,
    `${keyword} — Explained Simply`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ── Route: Quick keyword score (single keyword) ──
router.get('/score', async (req, res) => {
  try {
    const { keyword, seed = keyword, niche = 'General' } = req.query;
    if (!keyword) return sendRes(res, 400, { error: 'keyword required' });
    const score = scoreKeyword(keyword, seed, [keyword]);
    sendRes(res, 200, { keyword, niche, ...score });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get winning keywords from DB (from Task 03 feedback loop) ──
router.get('/wins', async (req, res) => {
  try {
    const { niche = 'General' } = req.query;
    const { default: dbService } = await import('../src/database/services.js');
    // Gracefully handle if getTopKeywordWins doesn't exist yet
    const wins = dbService.getTopKeywordWins 
      ? dbService.getTopKeywordWins(niche, 20)
      : [];
    sendRes(res, 200, { wins, niche });
  } catch (e) {
    sendRes(res, 200, { wins: [], niche: req.query.niche || 'General' });
  }
});

export default router;
```

---

## STEP 2 — Register in main.js

**Modify file: `main.js`**:

```js
// Import:
import { router as keywordRouter } from './api/keyword-intelligence.js';

// Register:
app.use('/api/keywords', keywordRouter);
```

---

## STEP 3 — Add "Keyword Intelligence Lab" panel to dashboard.html

**Modify file: `dashboard.html`**

### 3a — Add sidebar nav item

Find the sidebar navigation list (look for `<nav` or `<ul` with class like
`sidebar-nav` or similar). Add a new list item among the existing tools:

```html
<li class="nav-item" onclick="showPanel('keyword-lab')" id="nav-keyword-lab">
  <span class="nav-icon">🔍</span>
  <span class="nav-label">Keyword Lab</span>
</li>
```

### 3b — Add the panel HTML

Find the section where other panels are defined (look for `id="panel-bulk-injector"`
or similar pattern). Add the new panel:

```html
<!-- ══ KEYWORD INTELLIGENCE LAB PANEL ══ -->
<div id="panel-keyword-lab" class="panel" style="display:none;">
  <div class="panel-header">
    <h2>🔍 Keyword Intelligence Lab</h2>
    <p class="panel-subtitle">Discover high-opportunity keywords before your competitors do</p>
  </div>

  <div class="keyword-lab-search" style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
    <input 
      type="text" 
      id="kwl-seed-input" 
      placeholder="Enter seed keyword (e.g. 'YouTube SEO')" 
      class="input-field"
      style="flex:1;min-width:200px;"
      onkeydown="if(event.key==='Enter') runKeywordResearch()"
    />
    <input 
      type="text" 
      id="kwl-niche-input" 
      placeholder="Your niche (optional)" 
      class="input-field"
      style="width:180px;"
    />
    <button 
      class="btn-primary" 
      onclick="runKeywordResearch()" 
      id="kwl-search-btn"
    >Research →</button>
  </div>

  <div id="kwl-loading" style="display:none;text-align:center;padding:40px;">
    <div class="loading-spinner"></div>
    <p style="margin-top:12px;color:var(--text-muted);">Analyzing keyword opportunities...</p>
  </div>

  <div id="kwl-results" style="display:none;">
    <div id="kwl-top-opportunity" class="kwl-hero-card" style="
      background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1));
      border: 1px solid var(--accent);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    "></div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="margin:0;">Keyword Opportunities</h3>
      <button class="btn-secondary btn-sm" onclick="exportKeywordsCSV()">Export CSV</button>
    </div>

    <div class="kwl-table-wrapper" style="overflow-x:auto;">
      <table class="kwl-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:rgba(255,255,255,0.05);text-align:left;">
            <th style="padding:10px 12px;">Keyword</th>
            <th style="padding:10px 12px;">Volume</th>
            <th style="padding:10px 12px;">Competition</th>
            <th style="padding:10px 12px;">Opportunity</th>
            <th style="padding:10px 12px;">Action</th>
          </tr>
        </thead>
        <tbody id="kwl-table-body"></tbody>
      </table>
    </div>
  </div>

  <div id="kwl-empty" style="display:none;text-align:center;padding:60px;color:var(--text-muted);">
    <p style="font-size:48px;margin:0;">🔍</p>
    <p>Enter a seed keyword above to discover opportunities</p>
  </div>
</div>
```

---

## STEP 4 — Add JavaScript logic to main.js

**Modify file: `main.js`** — add these functions near the bottom (before the
closing of the main IIFE or module, wherever other panel functions are defined):

```js
// ══ KEYWORD INTELLIGENCE LAB ══

window.kwlData = [];

async function runKeywordResearch() {
  const seed = document.getElementById('kwl-seed-input')?.value?.trim();
  const niche = document.getElementById('kwl-niche-input')?.value?.trim() || 'General';
  const btn = document.getElementById('kwl-search-btn');
  
  if (!seed || seed.length < 2) {
    alert('Please enter a keyword to research (min 2 characters)');
    return;
  }

  // Show loading
  document.getElementById('kwl-loading').style.display = 'block';
  document.getElementById('kwl-results').style.display = 'none';
  document.getElementById('kwl-empty').style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Researching...'; }

  try {
    const channelId = window.currentChannelId || getChannelId?.() || '';
    const response = await fetch('/api/keywords/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({ seed, niche }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Research failed');

    window.kwlData = data.keywords || [];
    renderKeywordResults(data);
  } catch (err) {
    console.error('[KWL] Error:', err.message);
    document.getElementById('kwl-empty').style.display = 'block';
    document.getElementById('kwl-empty').innerHTML = `
      <p style="font-size:48px;margin:0;">⚠️</p>
      <p>Research failed: ${err.message}</p>
    `;
  } finally {
    document.getElementById('kwl-loading').style.display = 'none';
    if (btn) { btn.disabled = false; btn.textContent = 'Research →'; }
  }
}

function renderKeywordResults(data) {
  const resultsEl = document.getElementById('kwl-results');
  const topEl = document.getElementById('kwl-top-opportunity');
  const tbodyEl = document.getElementById('kwl-table-body');
  
  // Top opportunity card
  const top = data.topOpportunity;
  if (top) {
    topEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--accent);margin-bottom:4px;">⭐ Top Opportunity</div>
          <div style="font-size:20px;font-weight:700;">${top.keyword}</div>
          <div style="color:var(--text-muted);margin-top:4px;">
            Volume: <strong style="color:var(--success)">${top.volumeTier}</strong> &nbsp;•&nbsp;
            Competition: <strong style="color:${top.competition === 'Low' ? 'var(--success)' : top.competition === 'Medium' ? 'var(--warning)' : 'var(--danger)'}">${top.competition}</strong>
          </div>
          ${data.suggestedTitle ? `<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">💡 Suggested title: <em>${data.suggestedTitle}</em></div>` : ''}
        </div>
        <div style="text-align:center;">
          <div style="font-size:36px;font-weight:900;color:var(--accent);">${top.opportunityScore}</div>
          <div style="font-size:11px;color:var(--text-muted);">Opportunity Score</div>
        </div>
      </div>
    `;
  }

  // Table rows
  const volumeColor = { High: 'var(--success)', Medium: 'var(--warning)', Low: 'var(--text-muted)' };
  const compColor = { Low: 'var(--success)', Medium: 'var(--warning)', High: 'var(--danger)' };
  const oppColor = s => s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--text-muted)';

  tbodyEl.innerHTML = (data.keywords || []).map((kw, i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.2s;"
        onmouseover="this.style.background='rgba(255,255,255,0.03)'"
        onmouseout="this.style.background='transparent'">
      <td style="padding:10px 12px;font-weight:500;">${kw.keyword}</td>
      <td style="padding:10px 12px;"><span style="color:${volumeColor[kw.volumeTier]}">${kw.volumeTier}</span></td>
      <td style="padding:10px 12px;"><span style="color:${compColor[kw.competition]}">${kw.competition}</span></td>
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:60px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
            <div style="width:${kw.opportunityScore}%;height:100%;background:${oppColor(kw.opportunityScore)};border-radius:3px;"></div>
          </div>
          <span style="font-size:12px;color:${oppColor(kw.opportunityScore)}">${kw.opportunityScore}</span>
        </div>
      </td>
      <td style="padding:10px 12px;">
        <button class="btn-secondary btn-sm" 
          style="font-size:11px;padding:4px 10px;"
          onclick="useKeywordInBulkInjector('${kw.keyword.replace(/'/g, "\\'")}')">
          Use Keyword
        </button>
      </td>
    </tr>
  `).join('');

  resultsEl.style.display = 'block';
}

function useKeywordInBulkInjector(keyword) {
  // Switch to bulk injector panel and pre-fill the search/niche
  showPanel?.('bulk-injector');
  const nicheInput = document.getElementById('niche-input') || document.querySelector('[placeholder*="niche"]');
  if (nicheInput) {
    nicheInput.value = keyword;
    nicheInput.dispatchEvent(new Event('input'));
  }
  // Show toast
  showToast?.(`Keyword "${keyword}" set. Now select your videos to optimize.`);
}

function exportKeywordsCSV() {
  if (!window.kwlData?.length) return;
  const header = 'Keyword,Volume Tier,Competition,Opportunity Score\n';
  const rows = window.kwlData.map(k => 
    `"${k.keyword}",${k.volumeTier},${k.competition},${k.opportunityScore}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keywords-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Make runKeywordResearch globally accessible
window.runKeywordResearch = runKeywordResearch;
window.exportKeywordsCSV = exportKeywordsCSV;
window.useKeywordInBulkInjector = useKeywordInBulkInjector;
```

---

## Acceptance Criteria

1. `POST /api/keywords/research` with `{ "seed": "youtube seo", "niche": "Education" }`
   returns `{ keywords: [...], topOpportunity: {...}, suggestedTitle: "..." }`
2. Each keyword has: `keyword`, `volumeTier` (High/Medium/Low), `competition`,
   `opportunityScore` (0-100), `source`
3. Keywords sorted by `opportunityScore` descending
4. Dashboard: "Keyword Lab" appears in sidebar nav
5. Clicking sidebar item shows the panel
6. Searching a keyword renders the results table with progress bars
7. "Export CSV" downloads a valid CSV file

## Files Changed
- `api/keyword-intelligence.js` — NEW
- `main.js` — MODIFIED (router registration + JS functions)
- `dashboard.html` — MODIFIED (sidebar item + panel HTML)
