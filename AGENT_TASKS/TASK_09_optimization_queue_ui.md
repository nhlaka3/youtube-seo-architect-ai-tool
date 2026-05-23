# TASK 09 — Optimization Queue UI Panel

## Goal
Build the "Optimization Inbox" — a dedicated dashboard panel that shows all
AI-generated optimization proposals waiting for the user's approval. Users can
review, approve, skip, or apply proposals with one click. This turns the
autonomous cron scanner (Task 02) into a usable product feature.

## Prerequisites
- Task 02 (cron-optimizer) must be complete — this UI consumes its endpoints.

---

## STEP 1 — Add batch-apply endpoint to cron-optimizer.js

**Modify file: `api/cron-optimizer.js`**

Add this route before `export default router`:

```js
// ── Route: Apply an approved queue item to YouTube ──
router.post('/queue/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { accessToken } = req.body;
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });

    const { default: dbService } = await import('../src/database/services.js');
    const items = dbService.getQueueByChannel(
      req.headers['x-channel-id'] || req.body?.channelId, 'pending'
    );
    const item = items.find(i => i.id === id);
    if (!item) return sendRes(res, 404, { error: 'Queue item not found' });

    // Apply the proposal to YouTube
    const cleanTags = (item.proposedTags || [])
      .map(t => String(t).replace(/\s+/g, ''))
      .filter(t => t.length > 1)
      .slice(0, 25);

    // Fetch current snippet (needed for PUT)
    const getRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${item.video_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!getRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video data' });
    const getData = await getRes.json();
    const currentSnippet = getData.items?.[0]?.snippet;
    if (!currentSnippet) return sendRes(res, 404, { error: 'Video not found' });

    const updateRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: item.video_id,
          snippet: {
            ...currentSnippet,
            title: (item.proposed_title || item.current_title).substring(0, 100),
            description: item.proposed_description || item.current_description || '',
            tags: cleanTags,
          },
        }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      return sendRes(res, 502, { error: err.error?.message || 'YouTube update failed' });
    }

    // Mark as applied
    dbService.updateQueueItemStatus(id, 'applied');

    // Record in optimization_trials for feedback loop measurement
    try {
      await dbService.createOptimizationTrial({
        channelId: item.channel_id,
        videoId: item.video_id,
        videoTitle: item.proposed_title,
        optimizationType: 'auto-queued',
        beforeMetrics: {},
        appliedData: {
          oldTitle: item.current_title,
          oldDescription: item.current_description,
          oldTags: item.currentTags,
          newTitle: item.proposed_title,
          newDescription: item.proposed_description,
          newTags: cleanTags,
        },
        seoScoreBefore: item.score_before,
        notes: 'Applied from optimization queue',
      });
    } catch { /* Non-critical */ }

    sendRes(res, 200, { success: true, message: 'Optimization applied to YouTube' });
  } catch (e) {
    console.error('[Queue Apply]', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Batch approve all pending items ──
router.post('/queue/approve-all', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required' });
    const { default: dbService } = await import('../src/database/services.js');
    const items = dbService.getQueueByChannel(channelId, 'pending');
    items.forEach(i => dbService.updateQueueItemStatus(i.id, 'approved'));
    sendRes(res, 200, { success: true, approved: items.length });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});
```

---

## STEP 2 — Add "Optimization Queue" sidebar item to dashboard.html

Find the sidebar navigation. Add:

```html
<li class="nav-item" onclick="showPanel('opt-queue')" id="nav-opt-queue">
  <span class="nav-icon">📥</span>
  <span class="nav-label">Opt. Queue</span>
  <span id="queue-badge" style="
    background:var(--danger);color:#fff;font-size:10px;font-weight:700;
    padding:2px 6px;border-radius:10px;margin-left:auto;display:none;
  ">0</span>
</li>
```

---

## STEP 3 — Add panel HTML to dashboard.html

```html
<!-- ══ OPTIMIZATION QUEUE PANEL ══ -->
<div id="panel-opt-queue" class="panel" style="display:none;">
  <div class="panel-header" style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;">
    <div>
      <h2>📥 Optimization Queue</h2>
      <p class="panel-subtitle">AI-generated proposals ready for your review. One click to apply.</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button class="btn-secondary" onclick="loadOptQueue()" id="queue-refresh-btn">
        🔄 Refresh
      </button>
      <button class="btn-primary" onclick="scanAndQueue()" id="queue-scan-btn">
        🤖 AI Scan Now
      </button>
    </div>
  </div>

  <!-- Stats bar -->
  <div id="queue-stats" style="
    display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
    margin-bottom:24px;
  ">
    <div class="stat-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:16px;">
      <div id="qs-pending" style="font-size:28px;font-weight:900;color:var(--warning);">0</div>
      <div style="font-size:12px;color:var(--text-muted);">Pending</div>
    </div>
    <div class="stat-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:16px;">
      <div id="qs-approved" style="font-size:28px;font-weight:900;color:var(--accent);">0</div>
      <div style="font-size:12px;color:var(--text-muted);">Approved</div>
    </div>
    <div class="stat-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:16px;">
      <div id="qs-applied" style="font-size:28px;font-weight:900;color:var(--success);">0</div>
      <div style="font-size:12px;color:var(--text-muted);">Applied</div>
    </div>
    <div class="stat-card" style="text-align:center;background:var(--bg-card);border-radius:10px;padding:16px;">
      <div id="qs-skipped" style="font-size:28px;font-weight:900;color:var(--text-muted);">0</div>
      <div style="font-size:12px;color:var(--text-muted);">Skipped</div>
    </div>
  </div>

  <div id="queue-loading" style="display:none;text-align:center;padding:40px;">
    <div class="loading-spinner"></div>
    <p style="color:var(--text-muted);margin-top:12px;" id="queue-loading-text">Loading queue...</p>
  </div>

  <div id="queue-empty" style="display:none;text-align:center;padding:60px;">
    <p style="font-size:48px;margin:0;">✅</p>
    <p style="font-weight:600;margin-top:12px;">Queue is empty</p>
    <p style="color:var(--text-muted);">Click "AI Scan Now" to find videos to optimize</p>
  </div>

  <div id="queue-list" style="display:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span id="queue-count-label" style="color:var(--text-muted);font-size:13px;"></span>
      <button class="btn-secondary btn-sm" onclick="skipAllQueue()">Skip All</button>
    </div>
    <div id="queue-items"></div>
  </div>
</div>
```

---

## STEP 4 — Add JavaScript to main.js

```js
// ══ OPTIMIZATION QUEUE ══

async function loadOptQueue() {
  const channelId = window.currentChannelId || '';
  if (!channelId) {
    document.getElementById('queue-empty').style.display = 'block';
    return;
  }

  document.getElementById('queue-loading').style.display = 'block';
  document.getElementById('queue-list').style.display = 'none';
  document.getElementById('queue-empty').style.display = 'none';

  try {
    const res = await fetch(`/api/cron/queue?channelId=${channelId}`, {
      headers: { 'x-channel-id': channelId }
    });
    const data = await res.json();

    // Update stats
    const s = data.stats || {};
    document.getElementById('qs-pending').textContent = s.pending || 0;
    document.getElementById('qs-approved').textContent = s.approved || 0;
    document.getElementById('qs-applied').textContent = s.applied || 0;
    document.getElementById('qs-skipped').textContent = s.skipped || 0;

    // Update badge
    const badge = document.getElementById('queue-badge');
    if (badge) {
      const count = s.pending || 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    const queue = data.queue || [];
    if (!queue.length) {
      document.getElementById('queue-empty').style.display = 'block';
    } else {
      renderQueueItems(queue);
      document.getElementById('queue-count-label').textContent =
        `${queue.length} proposal${queue.length !== 1 ? 's' : ''} waiting for review`;
      document.getElementById('queue-list').style.display = 'block';
    }
  } catch (err) {
    document.getElementById('queue-empty').style.display = 'block';
    document.getElementById('queue-empty').innerHTML =
      `<p style="color:var(--danger);">Failed to load queue: ${err.message}</p>`;
  } finally {
    document.getElementById('queue-loading').style.display = 'none';
  }
}

function renderQueueItems(queue) {
  const container = document.getElementById('queue-items');
  if (!container) return;

  container.innerHTML = queue.map(item => {
    const lift = (item.score_after || 0) - (item.score_before || 0);
    const liftColor = lift > 0 ? 'var(--success)' : 'var(--text-muted)';

    return `
    <div id="queue-item-${item.id}" style="
      background:var(--bg-card);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:12px;
      padding:20px;
      margin-bottom:12px;
      transition:all 0.3s;
    ">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Current Title</div>
          <div style="font-size:13px;color:var(--text-muted);text-decoration:line-through;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${item.current_title || ''}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin:6px 0 4px;">Proposed Title</div>
          <div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${item.proposed_title || ''}
          </div>
        </div>
        <div style="text-align:center;min-width:80px;">
          <div style="font-size:24px;font-weight:900;color:${liftColor};">
            ${lift > 0 ? '+' : ''}${lift}
          </div>
          <div style="font-size:11px;color:var(--text-muted);">SEO lift</div>
          <div style="font-size:12px;margin-top:4px;">
            <span style="color:var(--text-muted);">${item.score_before || 0}</span>
            <span style="color:var(--text-muted);"> → </span>
            <span style="color:var(--success);">${item.score_after || 0}</span>
          </div>
        </div>
      </div>

      <div style="
        background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;
        font-size:12px;color:var(--text-muted);margin-bottom:12px;
        max-height:60px;overflow:hidden;line-height:1.5;
      ">
        ${(item.proposed_description || '').substring(0, 200)}...
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-primary" style="flex:1;min-width:120px;"
          onclick="applyQueueItem('${item.id}')">
          ✅ Apply to YouTube
        </button>
        <button class="btn-secondary" style="flex:1;min-width:80px;"
          onclick="skipQueueItem('${item.id}')">
          Skip
        </button>
        <button class="btn-secondary" style="padding:8px 12px;"
          onclick="previewQueueItem('${item.id}')">
          👁 Preview
        </button>
      </div>
    </div>`;
  }).join('');
}

async function applyQueueItem(itemId) {
  const accessToken = window.currentAccessToken || window.ytAccessToken;
  if (!accessToken) {
    alert('Please connect your YouTube channel first (OAuth required to apply changes).');
    return;
  }

  const btn = document.querySelector(`#queue-item-${itemId} button`);
  if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }

  try {
    const channelId = window.currentChannelId || '';
    const res = await fetch(`/api/cron/queue/${itemId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({ accessToken, channelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Animate removal
    const itemEl = document.getElementById(`queue-item-${itemId}`);
    if (itemEl) {
      itemEl.style.opacity = '0';
      itemEl.style.transform = 'translateX(20px)';
      setTimeout(() => itemEl.remove(), 300);
    }
    showToast?.('✅ Optimization applied to YouTube!');
    setTimeout(loadOptQueue, 500);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Apply to YouTube'; }
    alert('Apply failed: ' + err.message);
  }
}

async function skipQueueItem(itemId) {
  const channelId = window.currentChannelId || '';
  try {
    await fetch(`/api/cron/queue/${itemId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({ action: 'skipped', channelId }),
    });
    const itemEl = document.getElementById(`queue-item-${itemId}`);
    if (itemEl) {
      itemEl.style.opacity = '0';
      setTimeout(() => itemEl.remove(), 200);
    }
  } catch (err) {
    console.error('[Queue Skip]', err.message);
  }
}

async function skipAllQueue() {
  if (!confirm('Skip all pending proposals?')) return;
  const items = document.querySelectorAll('[id^="queue-item-"]');
  const ids = Array.from(items).map(el => el.id.replace('queue-item-', ''));
  for (const id of ids) await skipQueueItem(id);
  setTimeout(loadOptQueue, 300);
}

async function scanAndQueue() {
  const accessToken = window.currentAccessToken || window.ytAccessToken;
  if (!accessToken) {
    alert('Connect your YouTube channel first to enable AI scanning.');
    return;
  }

  const btn = document.getElementById('queue-scan-btn');
  const loadingEl = document.getElementById('queue-loading');
  const loadingText = document.getElementById('queue-loading-text');

  if (btn) { btn.disabled = true; btn.textContent = '🤖 Scanning...'; }
  if (loadingEl) loadingEl.style.display = 'block';
  if (loadingText) loadingText.textContent = 'AI is scanning your channel for optimization opportunities...';
  document.getElementById('queue-list').style.display = 'none';
  document.getElementById('queue-empty').style.display = 'none';

  try {
    const channelId = window.currentChannelId || '';
    const res = await fetch('/api/cron/scan-and-queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-channel-id': channelId,
        'X-CSRF-Token': window.csrfToken || '',
      },
      body: JSON.stringify({ accessToken, channelId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast?.(data.queued > 0
      ? `✅ ${data.queued} optimization${data.queued !== 1 ? 's' : ''} queued from ${data.total} videos`
      : '✅ All your videos are already well-optimized!'
    );
    await loadOptQueue();
  } catch (err) {
    alert('Scan failed: ' + err.message);
    if (loadingEl) loadingEl.style.display = 'none';
    document.getElementById('queue-empty').style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 AI Scan Now'; }
  }
}

function previewQueueItem(itemId) {
  // Expand/collapse description preview
  const itemEl = document.getElementById(`queue-item-${itemId}`);
  if (!itemEl) return;
  const desc = itemEl.querySelector('[style*="max-height:60px"]');
  if (desc) {
    desc.style.maxHeight = desc.style.maxHeight === '60px' ? 'none' : '60px';
  }
}

// Load queue on panel show
const _origShowPanel = window.showPanel;
if (_origShowPanel) {
  window.showPanel = function(panelId) {
    _origShowPanel(panelId);
    if (panelId === 'opt-queue') loadOptQueue();
    if (panelId === 'trend-pulse') loadTrendPulse?.();
    if (panelId === 'keyword-lab') {
      document.getElementById('kwl-empty').style.display = 'block';
    }
  };
}

// Expose globally
window.loadOptQueue = loadOptQueue;
window.applyQueueItem = applyQueueItem;
window.skipQueueItem = skipQueueItem;
window.skipAllQueue = skipAllQueue;
window.scanAndQueue = scanAndQueue;
window.previewQueueItem = previewQueueItem;
```

---

## STEP 5 — Load queue badge on dashboard init

**Modify `main.js`** — find the channel connection / init code (search for
`currentChannelId` being set or the OAuth callback). After channel connects,
call a lightweight badge update:

```js
// Add this function:
async function updateQueueBadge() {
  try {
    const channelId = window.currentChannelId || '';
    if (!channelId) return;
    const res = await fetch(`/api/cron/queue?channelId=${channelId}`, {
      headers: { 'x-channel-id': channelId }
    });
    const data = await res.json();
    const badge = document.getElementById('queue-badge');
    if (badge) {
      const count = data.stats?.pending || 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  } catch { /* Silent */ }
}
window.updateQueueBadge = updateQueueBadge;

// Call after channel connects (find the channel connect success handler and append):
// updateQueueBadge();
```

---

## Acceptance Criteria

1. Sidebar shows "📥 Opt. Queue" with a red badge showing pending count
2. Clicking the nav item shows the panel and auto-loads queue
3. Stats bar shows Pending / Approved / Applied / Skipped counts
4. "AI Scan Now" button triggers `/api/cron/scan-and-queue` and shows results
5. Each queue card shows: current title (strikethrough) → proposed title,
   SEO score lift, description preview
6. "Apply to YouTube" button calls `/api/cron/queue/:id/apply`, animates card out
7. "Skip" button removes the card from view
8. Queue empties gracefully when all items actioned

## Files Changed
- `api/cron-optimizer.js` — MODIFIED (2 new routes: apply + approve-all)
- `dashboard.html` — MODIFIED (sidebar item + panel HTML)
- `main.js` — MODIFIED (all JS functions + panel hook)
