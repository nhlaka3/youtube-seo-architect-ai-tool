# TASK 10 — Growth Analytics Dashboard

## Goal
Build a "Growth Analytics" panel visualising everything the platform has done:
optimizations applied, SEO score lift over time, A/B test win rates, queue
throughput and credits consumed. All powered by local SQLite — zero extra API cost.

---

## STEP 1 — Add analytics query methods to services.js

```js
// In src/database/services.js — add these methods:

getOptimizationTimeline(channelId, days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  try {
    return db.prepare(`
      SELECT date(applied_at) as day, COUNT(*) as count,
             AVG(seo_score_after - seo_score_before) as avg_lift
      FROM optimization_trials
      WHERE channel_id = ? AND applied_at >= ?
      GROUP BY day ORDER BY day ASC
    `).all(channelId, since);
  } catch { return []; }
},

getAbTestSummary(channelId) {
  try {
    const rows = db.prepare(
      `SELECT status, winner FROM ab_tests WHERE channel_id = ?`
    ).all(channelId);
    const s = { total: rows.length, complete: 0, running: 0, bWins: 0, aWins: 0 };
    rows.forEach(r => {
      if (r.status === 'complete') {
        s.complete++;
        r.winner === 'variant_b' ? s.bWins++ : s.aWins++;
      } else if (r.status === 'running') s.running++;
    });
    return s;
  } catch { return { total:0, complete:0, running:0, bWins:0, aWins:0 }; }
},

getQueueThroughput(channelId, days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  try {
    return db.prepare(`
      SELECT status, COUNT(*) as count FROM optimization_queue
      WHERE channel_id = ? AND created_at >= ? GROUP BY status
    `).all(channelId, since);
  } catch { return []; }
},

getChannelHealthScore(channelId) {
  try {
    return db.prepare(`
      SELECT AVG(seo_score_after) as avgScore, COUNT(*) as trials
      FROM optimization_trials
      WHERE channel_id = ? AND applied_at >= date('now','-30 days')
    `).get(channelId) || { avgScore: 0, trials: 0 };
  } catch { return { avgScore: 0, trials: 0 }; }
},

getCreditsHistory(channelId, days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  try {
    return db.prepare(`
      SELECT date(created_at) as day, SUM(ABS(amount)) as total_used
      FROM credits_transactions
      WHERE channel_id = ? AND amount < 0 AND created_at >= ?
      GROUP BY day ORDER BY day ASC
    `).all(channelId, since);
  } catch { return []; }
},
```

---

## STEP 2 — Create `api/analytics.js`

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

router.get('/summary', async (req, res) => {
  const channelId = req.headers['x-channel-id'] || req.query.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel required' });
  const days = Number(req.query.days) || 30;

  try {
    const { default: db } = await import('../src/database/services.js');
    const [timeline, abSummary, queueThroughput, health, credits] = [
      db.getOptimizationTimeline?.(channelId, days) || [],
      db.getAbTestSummary?.(channelId) || {},
      db.getQueueThroughput?.(channelId, days) || [],
      db.getChannelHealthScore?.(channelId) || {},
      db.getCreditsHistory?.(channelId, days) || [],
    ];

    const totalOptimizations = timeline.reduce((s, d) => s + (d.count || 0), 0);
    const avgLift = timeline.length
      ? Math.round(timeline.reduce((s, d) => s + (d.avg_lift || 0), 0) / timeline.length)
      : 0;
    const totalCredits = credits.reduce((s, d) => s + (d.total_used || 0), 0);

    sendRes(res, 200, {
      channelId, days,
      timeline, abSummary, queueThroughput, health, credits,
      totals: {
        optimizations: totalOptimizations,
        avgSeoLift: avgLift,
        creditsUsed: Math.round(totalCredits),
        abTests: abSummary.total || 0,
      },
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Register in main.js

```js
import { router as analyticsRouter } from './api/analytics.js';
app.use('/api/analytics', analyticsRouter);
```

---

## STEP 4 — Dashboard panel

### Sidebar item (add in sidebar nav)

```html
<li class="nav-item" onclick="showPanel('growth-analytics')" id="nav-growth-analytics">
  <span class="nav-icon">📈</span>
  <span class="nav-label">Analytics</span>
</li>
```

### Panel HTML (add alongside other panels)

```html
<div id="panel-growth-analytics" class="panel" style="display:none;">
  <div class="panel-header" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center;">
    <div>
      <h2>📈 Growth Analytics</h2>
      <p class="panel-subtitle">Every optimization tracked. Every win measured.</p>
    </div>
    <div style="display:flex;gap:8px;">
      <select id="analytics-days" class="input-field" style="width:140px;" onchange="loadAnalytics()">
        <option value="7">Last 7 days</option>
        <option value="30" selected>Last 30 days</option>
        <option value="90">Last 90 days</option>
      </select>
      <button class="btn-secondary" onclick="loadAnalytics()">🔄</button>
    </div>
  </div>

  <!-- KPI Row -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:28px;">
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;text-align:center;">
      <div id="kpi-opts" style="font-size:36px;font-weight:900;color:var(--accent);">—</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Optimizations</div>
    </div>
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;text-align:center;">
      <div id="kpi-lift" style="font-size:36px;font-weight:900;color:var(--success);">—</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Avg SEO Lift</div>
    </div>
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;text-align:center;">
      <div id="kpi-abtests" style="font-size:36px;font-weight:900;color:#a78bfa;">—</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">A/B Tests</div>
    </div>
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;text-align:center;">
      <div id="kpi-health" style="font-size:36px;font-weight:900;color:var(--success);">—</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Health Score</div>
    </div>
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;text-align:center;">
      <div id="kpi-credits" style="font-size:36px;font-weight:900;color:var(--text-muted);">—</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Credits Used</div>
    </div>
  </div>

  <!-- Timeline bar chart -->
  <div style="background:var(--bg-card);border-radius:12px;padding:24px;margin-bottom:20px;">
    <h3 style="margin:0 0 16px;">📅 Optimization Activity</h3>
    <div id="analytics-bars" style="display:flex;align-items:flex-end;gap:3px;height:100px;min-height:100px;"></div>
  </div>

  <!-- A/B Summary + Queue side by side -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;">
      <h3 style="margin:0 0 12px;">🔬 A/B Test Summary</h3>
      <div id="analytics-ab"></div>
    </div>
    <div style="background:var(--bg-card);border-radius:12px;padding:20px;">
      <h3 style="margin:0 0 12px;">📥 Queue Throughput</h3>
      <div id="analytics-queue" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
    </div>
  </div>
</div>
```

### JavaScript (add to main.js)

```js
// ══ GROWTH ANALYTICS ══
async function loadAnalytics() {
  const channelId = window.currentChannelId || '';
  const days = document.getElementById('analytics-days')?.value || 30;

  try {
    const res = await fetch(`/api/analytics/summary?days=${days}&channelId=${channelId}`, {
      headers: { 'x-channel-id': channelId }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);

    const t = d.totals || {};
    document.getElementById('kpi-opts').textContent   = t.optimizations ?? '—';
    document.getElementById('kpi-lift').textContent   = t.avgSeoLift > 0 ? `+${t.avgSeoLift}` : (t.avgSeoLift ?? '—');
    document.getElementById('kpi-abtests').textContent = t.abTests ?? '—';
    document.getElementById('kpi-health').textContent  = Math.round(d.health?.avgScore || 0) || '—';
    document.getElementById('kpi-credits').textContent = t.creditsUsed ?? '—';

    // Bar chart
    const bars = document.getElementById('analytics-bars');
    if (bars && d.timeline?.length) {
      const max = Math.max(...d.timeline.map(x => x.count || 0), 1);
      bars.innerHTML = d.timeline.map(x => {
        const h = Math.max(4, Math.round(((x.count || 0) / max) * 90));
        return `<div title="${x.day}: ${x.count} opt." style="
          flex:1;max-width:20px;height:${h}px;
          background:linear-gradient(to top,var(--accent),rgba(0,212,255,.3));
          border-radius:3px 3px 0 0;cursor:default;"></div>`;
      }).join('');
    } else if (bars) {
      bars.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin:auto;">No data yet</p>';
    }

    // A/B summary
    const ab = d.abSummary || {};
    const abEl = document.getElementById('analytics-ab');
    if (abEl) abEl.innerHTML = ab.total ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
        <div style="background:rgba(0,0,0,.3);border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:900;">${ab.total}</div>
          <div style="font-size:11px;color:var(--text-muted);">Total</div>
        </div>
        <div style="background:rgba(0,0,0,.3);border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:900;color:var(--success);">${ab.complete}</div>
          <div style="font-size:11px;color:var(--text-muted);">Complete</div>
        </div>
        <div style="background:rgba(0,0,0,.3);border-radius:8px;padding:12px;">
          <div style="font-size:22px;font-weight:900;color:var(--warning);">${ab.running}</div>
          <div style="font-size:11px;color:var(--text-muted);">Running</div>
        </div>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:var(--text-muted);">
        B wins: <strong style="color:var(--accent);">
          ${ab.complete ? Math.round(ab.bWins/ab.complete*100) : 0}%
        </strong> (${ab.bWins}B / ${ab.aWins}A)
      </p>
    ` : '<p style="color:var(--text-muted);font-size:13px;">No A/B tests yet.</p>';

    // Queue throughput
    const qEl = document.getElementById('analytics-queue');
    if (qEl) {
      const statusCol = { applied:'var(--success)', approved:'var(--accent)',
                          skipped:'var(--text-muted)', pending:'var(--warning)' };
      qEl.innerHTML = (d.queueThroughput || []).map(s => `
        <div style="flex:1;min-width:80px;background:rgba(0,0,0,.3);border-radius:8px;padding:14px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:${statusCol[s.status]||'inherit'};">${s.count}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:capitalize;">${s.status}</div>
        </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;">No queue data yet.</p>';
    }
  } catch (err) {
    console.error('[Analytics]', err.message);
  }
}

// Auto-load when panel opens
const _spAnalytics = window.showPanel;
if (_spAnalytics) {
  window.showPanel = panelId => {
    _spAnalytics(panelId);
    if (panelId === 'growth-analytics') loadAnalytics();
  };
}

window.loadAnalytics = loadAnalytics;
```

---

## Acceptance Criteria

1. `GET /api/analytics/summary?channelId=X&days=30` returns `{ totals, timeline, abSummary, queueThroughput, health }`
2. KPI cards show correct values (zeros are fine for empty state)
3. Bar chart renders with one bar per day of activity
4. A/B summary shows win rate % when tests exist
5. Queue throughput breaks down applied / approved / skipped / pending
6. Changing the days dropdown re-fetches with new period

## Files Changed
- `src/database/services.js` — MODIFIED (5 new read-only methods)
- `api/analytics.js` — NEW
- `main.js` — MODIFIED (router + `loadAnalytics`)
- `dashboard.html` — MODIFIED (sidebar item + panel HTML)
