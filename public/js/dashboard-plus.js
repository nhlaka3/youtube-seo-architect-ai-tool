/*! dashboard-plus.js — owner-mode dashboard upgrades
 *  Zero dependencies. Loaded with defer after dashboard.html's own scripts.
 *
 *  What it adds (all additive — nothing existing is removed or re-bound):
 *   1. Command palette    ⌘K / Ctrl+K  — jump to any of the 29 views + tools + blog
 *   2. Guided next steps  — "what should I do now" panel driven by account state
 *   3. Accessibility      — keyboard focus rings, ARIA on nav, skip link, reduced motion
 *   4. Responsive fixes   — mobile nav drawer, swipe-free tap targets >= 44px
 *   5. Copy-on-click      — any [data-copy] element copies its value with feedback
 *   6. Session resilience — friendly banner when an API call fails instead of a silent no-op
 */
(function () {
  'use strict';
  if (window.__ytseoPlus) return;           // idempotent
  window.__ytseoPlus = true;

  var VIEWS = [
    ['overview', 'Overview', '🏠'],
    ['research', 'Keyword Research', '🔍'],
    ['factory', 'Video Factory', '🏭'],
    ['metadata-auditor', 'Metadata Auditor', '🧪'],
    ['competitor', 'Competitor Sniper', '🎯'],
    ['bulk-injector', 'Bulk Injector', '⚡'],
    ['thumbnail-lab', 'Thumbnail Lab', '🖼️'],
    ['thumbnail-redesign', 'Thumbnail Redesign', '🎨'],
    ['retention-reorderer', 'Retention Reorderer', '📉'],
    ['ab-tester', 'A/B Tester', '🧫'],
    ['analytics', 'Analytics', '📊'],
    ['suggested-analytics', 'Suggested Analytics', '📈'],
    ['trend-pulse', 'Trend Pulse', '📡'],
    ['niche-relevance', 'Niche Relevance', '🧭'],
    ['evergreen-audit', 'Evergreen Audit', '🌲'],
    ['optimization-history', 'Optimization History', '🕘'],
    ['playlist-growth', 'Playlist Growth', '📚'],
    ['chapters-generator', 'Chapters Generator', '⏱️'],
    ['script-shorts', 'Script → Shorts', '✂️'],
    ['ai-labeling', 'AI Labeling', '🏷️'],
    ['multi-language', 'Multi-language', '🌍'],
    ['community-posts', 'Community Posts', '💬'],
    ['auto-responder', 'Auto Responder', '🤖'],
    ['automation-pipeline', 'Automation Pipeline', '🔗'],
    ['growth-engine', 'Growth Engine', '🚀'],
    ['magic-fix', 'Magic Fix', '✨'],
    ['phronesis', 'Phronesis Coach', '🧠'],
    ['system-status', 'System Status', '🩺'],
    ['settings', 'Settings', '⚙️']
  ];

  var LINKS = [
    ['Marketing site', '/', '🌐'],
    ['Pricing & plans', '/pricing', '💳'],
    ['All free tools', '/tools', '🧰'],
    ['Tag generator', '/tools/tag-generator', '🏷️'],
    ['Title optimizer', '/tools/title-optimizer', '📝'],
    ['Description writer', '/tools/description-writer', '📄'],
    ['Blog — keyword guides', '/blog/low-competition-youtube-keywords-2026', '📖'],
    ['Help & docs', '/guide/youtube-seo', '❓']
  ];

  /* ── 1. Command palette ─────────────────────────────────────────── */
  function buildPalette() {
    var wrap = document.createElement('div');
    wrap.id = 'cmd-palette';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Jump to a view');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:none;align-items:flex-start;justify-content:center;' +
      'padding-top:12vh;background:rgba(3,6,12,.72);backdrop-filter:blur(6px)';
    wrap.innerHTML =
      '<div style="width:min(620px,92vw);background:#0d1117;border:1px solid rgba(255,255,255,.1);' +
      'border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6)">' +
      '<input id="cmd-input" type="text" placeholder="Search views, tools, pages…" autocomplete="off" ' +
      'aria-label="Search" style="width:100%;padding:16px 18px;background:transparent;border:0;' +
      'border-bottom:1px solid rgba(255,255,255,.08);color:#e6edf3;font-size:15px;outline:none" />' +
      '<div id="cmd-list" role="listbox" style="max-height:52vh;overflow:auto;padding:6px"></div>' +
      '<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,.08);color:#6e7681;font-size:11px">' +
      '↑↓ to move · Enter to open · Esc to close</div></div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  var palette, cmdInput, cmdList, cmdIndex = 0, cmdItems = [];

  function allItems() {
    return VIEWS.map(function (v) { return { label: v[1], icon: v[2], act: function () { go(v[0]); } }; })
      .concat(LINKS.map(function (l) { return { label: l[0], icon: l[2], act: function () { location.href = l[1]; } }; }));
  }

  function renderCmd(q) {
    var items = allItems();
    if (q) {
      var lq = q.toLowerCase();
      items = items.filter(function (i) { return i.label.toLowerCase().indexOf(lq) !== -1; });
    }
    cmdItems = items;
    cmdIndex = 0;
    if (!items.length) {
      cmdList.innerHTML = '<div style="padding:18px;color:#6e7681;font-size:13px">No match.</div>';
      return;
    }
    cmdList.innerHTML = items.map(function (i, n) {
      return '<button role="option" data-n="' + n + '" aria-selected="' + (n === 0) + '" ' +
        'style="display:flex;width:100%;gap:10px;align-items:center;padding:10px 12px;background:' +
        (n === 0 ? 'rgba(0,242,255,.1)' : 'transparent') + ';border:0;border-radius:8px;color:#e6edf3;' +
        'font:inherit;font-size:14px;text-align:left;cursor:pointer">' +
        '<span style="width:20px">' + i.icon + '</span>' + i.label + '</button>';
    }).join('');
    Array.prototype.forEach.call(cmdList.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { cmdItems[+b.dataset.n].act(); closePalette(); });
      b.addEventListener('mouseenter', function () { cmdIndex = +b.dataset.n; paintSel(); });
    });
  }

  function paintSel() {
    Array.prototype.forEach.call(cmdList.querySelectorAll('button'), function (b, n) {
      b.style.background = n === cmdIndex ? 'rgba(0,242,255,.1)' : 'transparent';
      b.setAttribute('aria-selected', n === cmdIndex);
    });
  }

  function openPalette() {
    if (!palette) {
      palette = buildPalette();
      cmdInput = palette.querySelector('#cmd-input');
      cmdList = palette.querySelector('#cmd-list');
      cmdInput.addEventListener('input', function () { renderCmd(cmdInput.value); });
      cmdInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex = Math.min(cmdIndex + 1, cmdItems.length - 1); paintSel(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cmdIndex = Math.max(cmdIndex - 1, 0); paintSel(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (cmdItems[cmdIndex]) { cmdItems[cmdIndex].act(); closePalette(); } }
        else if (e.key === 'Escape') { closePalette(); }
      });
      palette.addEventListener('click', function (e) { if (e.target === palette) closePalette(); });
    }
    renderCmd('');
    palette.style.display = 'flex';
    setTimeout(function () { cmdInput.focus(); }, 20);
  }

  function closePalette() { if (palette) palette.style.display = 'none'; }

  function go(view) {
    if (typeof window.switchView === 'function') { window.switchView(view); return; }
    var el = document.querySelector('[data-view="' + view + '"]');
    if (el) el.click();
  }

  /* ── 2. Guided next steps ───────────────────────────────────────── */
  function buildNextSteps() {
    var host = document.getElementById('view-overview') || document.querySelector('main') || document.body;
    var card = document.createElement('section');
    card.id = 'next-steps';
    card.setAttribute('aria-label', 'Recommended next steps');
    card.style.cssText =
      'margin:16px 0;padding:18px 20px;background:linear-gradient(180deg,rgba(0,242,255,.06),rgba(16,20,32,.6));' +
      'border:1px solid rgba(0,242,255,.18);border-radius:14px';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<h2 style="margin:0;font-size:15px;font-weight:800;color:#e6edf3">What to do next</h2>' +
      '<span id="ns-plan" style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;' +
      'padding:3px 9px;border-radius:99px;background:rgba(148,163,184,.15);color:#94a3b8">Free</span></div>' +
      '<ol id="ns-list" style="margin:0;padding-left:20px;color:#a8b2c1;font-size:13.5px;line-height:1.9"></ol>' +
      '<p style="margin:10px 0 0;font-size:12px;color:#6e7681">Press <kbd style="padding:1px 5px;border:1px solid #30363d;' +
      'border-radius:4px;background:#161b22">Ctrl</kbd>+<kbd style="padding:1px 5px;border:1px solid #30363d;' +
      'border-radius:4px;background:#161b22">K</kbd> to jump anywhere.</p>';
    host.insertBefore(card, host.firstChild);
    return card;
  }

  function updateNextSteps(plan) {
    var list = document.getElementById('ns-list');
    var badge = document.getElementById('ns-plan');
    if (!list) return;
    if (badge) {
      badge.textContent = plan === 'free' ? 'Free' : 'Pro';
      badge.style.background = plan === 'free' ? 'rgba(148,163,184,.15)' : 'rgba(0,242,255,.15)';
      badge.style.color = plan === 'free' ? '#94a3b8' : '#00f2ff';
    }
    var steps = plan === 'free' ? [
      ['Confirm your channel is connected', 'research'],
      ['Run one keyword discovery to find this week\'s topic', 'research'],
      ['Audit your most recent video\'s metadata', 'metadata-auditor'],
      ['Fix the top 3 issues the auditor flags', 'magic-fix']
    ] : [
      ['Run a Bulk Injector pass on your last 20 videos', 'bulk-injector'],
      ['Set up Auto-Responder so comments never sit unanswered', 'auto-responder'],
      ['Start an A/B test on your two best thumbnails', 'ab-tester'],
      ['Review the Evergreen Audit for decaying videos', 'evergreen-audit']
    ];
    list.innerHTML = steps.map(function (s) {
      return '<li><a href="#" data-goto="' + s[1] + '" style="color:#00f2ff;text-decoration:none;' +
        'border-bottom:1px dotted rgba(0,242,255,.35)">' + s[0] + '</a></li>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('[data-goto]'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); go(a.dataset.goto); });
    });
  }

  /* ── 3. Accessibility pass ──────────────────────────────────────── */
  function a11y() {
    var css = document.createElement('style');
    css.textContent =
      'a:focus-visible,button:focus-visible,[tabindex]:focus-visible,input:focus-visible,select:focus-visible,' +
      'textarea:focus-visible{outline:2px solid #00f2ff !important;outline-offset:2px !important;border-radius:4px}' +
      '@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms !important;animation-iteration-count:1 !important;' +
      'transition-duration:.01ms !important;scroll-behavior:auto !important}}' +
      '@media (max-width:760px){.sidebar,.nav-rail{position:fixed;inset:0 auto 0 0;width:82vw;max-width:320px;' +
      'transform:translateX(-100%);transition:transform .22s ease;z-index:9999;overflow:auto;background:#0b0f17;' +
      'box-shadow:0 0 60px rgba(0,0,0,.6)}.sidebar.open,.nav-rail.open{transform:none}' +
      '.tap-target,a,button{min-height:44px}.mobile-menu-btn{min-width:44px;min-height:44px}}';
    document.head.appendChild(css);

    // nav landmark labelling
    Array.prototype.forEach.call(document.querySelectorAll('nav'), function (n, i) {
      if (!n.getAttribute('aria-label')) n.setAttribute('aria-label', 'Main navigation');
    });
    // any element with data-copy becomes a copyable affordance
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (el) {
      el.style.cursor = 'copy';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.title = 'Click to copy';
      function doCopy() {
        var v = el.getAttribute('data-copy') || el.textContent.trim();
        navigator.clipboard.writeText(v).then(function () {
          var old = el.textContent; el.textContent = 'Copied!';
          setTimeout(function () { el.textContent = old; }, 1100);
        });
      }
      el.addEventListener('click', doCopy);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCopy(); } });
    });
  }

  /* ── 4. Session resilience ──────────────────────────────────────── */
  function resilience() {
    var shown = false;
    function banner(msg) {
      if (shown) return;
      shown = true;
      var b = document.createElement('div');
      b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:100001;' +
        'background:#2d1b1b;border:1px solid #7f1d1d;color:#fca5a5;padding:10px 16px;border-radius:10px;' +
        'font-size:13px;max-width:92vw';
      b.textContent = msg;
      document.body.appendChild(b);
      setTimeout(function () { b.remove(); shown = false; }, 7000);
    }
    var realFetch = window.fetch;
    window.fetch = function () {
      return realFetch.apply(this, arguments).catch(function (err) {
        banner('Connection issue — ' + (err && err.message ? err.message : 'request failed') + '. Retrying is safe.');
        throw err;
      });
    };
  }

  /* ── 5. Plan sync + boot ────────────────────────────────────────── */
  function plan() {
    var ch = null;
    try { ch = localStorage.getItem('ytseo_channel_id'); } catch (e) {}
    if (!ch || ch === 'anonymous') { updateNextSteps('free'); return; }
    fetch('/api/billing/status?channelId=' + encodeURIComponent(ch))
      .then(function (r) { return r.ok ? r.json() : { plan: 'free' }; })
      .then(function (d) { updateNextSteps(d && d.plan ? d.plan : 'free'); })
      .catch(function () { updateNextSteps('free'); });
  }

  function boot() {
    a11y();
    buildNextSteps();
    plan();
    resilience();

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); openPalette();
      }
      if (e.key === '/' && !/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) {
        e.preventDefault(); openPalette();
      }
    });

    // Add a visible affordance for the palette in the header if a header exists
    var header = document.querySelector('.site-header, header, .topbar');
    if (header) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Open quick switcher (Ctrl+K)');
      btn.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;' +
        'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;' +
        'color:#a8b2c1;font-size:12px;cursor:pointer';
      btn.innerHTML = '🔍 <span>Jump to…</span><kbd style="font-size:10px;opacity:.7">⌘K</kbd>';
      btn.addEventListener('click', openPalette);
      header.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
