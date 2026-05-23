// js/modules/views.js
// View system — ModuleRegistry, hydrate functions, switchView, platformInit
// Extracted from main.js lines 688-1035

export const ModuleRegistry = {
  studio: false,
  optics: false,
  autopilot: false,
  coach_history: false
};

export const utils = {
  renderIcon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}"><use xlink:href="#lucide-${name}"></use></svg>`;
  },
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  toggleSkeleton(show) {
    const overlay = document.getElementById('hydration-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  }
};

async function hydrateStudio() {
  if (ModuleRegistry.studio) return;
  const container = document.getElementById('view-factory');
  if (!container) return;
  console.log('🧪 Hydrating Studio Module...');
  const prepBtn = document.getElementById('prepare-script-btn');
  if (prepBtn) prepBtn.addEventListener('click', () => { if (typeof prepareVideoScript === 'function') prepareVideoScript(); });
  const renderBtn = document.getElementById('render-video-btn');
  if (renderBtn) renderBtn.addEventListener('click', () => { if (typeof renderVideoAssembly === 'function') renderVideoAssembly(); });
  const autoFlowBtn = document.getElementById('autoflow-btn');
  if (autoFlowBtn) autoFlowBtn.addEventListener('click', () => { if (typeof runAutoFlow === 'function') runAutoFlow(); });
  ModuleRegistry.studio = true;
}

async function hydrateOptics() {
  if (ModuleRegistry.optics) return;
  const container = document.getElementById('view-playlist-growth');
  if (!container) return;
  console.log('🔬 Hydrating Optics Module...');
  if (typeof loadPlaylistsForBulk === 'function') await loadPlaylistsForBulk();
  ModuleRegistry.optics = true;
}

async function hydrateAutopilot() {
  if (ModuleRegistry.autopilot) return;
  const container = document.getElementById('view-retention-reorderer');
  if (!container) return;
  console.log('🤖 Hydrating Autopilot Module...');
  const scheduleBtn = document.getElementById('schedule-upload-btn');
  if (scheduleBtn) scheduleBtn.addEventListener('click', () => { if (typeof scheduleVideoUpload === 'function') scheduleVideoUpload(); });
  const feedContainer = document.getElementById('comments-feed');
  if (feedContainer) {
    feedContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.j-draft-btn');
      if (btn) {
        const cid = btn.getAttribute('data-id');
        if (cid && typeof generateAIReply === 'function') generateAIReply(cid);
      }
    });
  }
  if (typeof loadReorderPlaylists === 'function') await loadReorderPlaylists();
  ModuleRegistry.autopilot = true;
}

export async function switchView(viewName) {
  const isLazy = ['factory', 'thumbnail-lab', 'script-shorts', 'metadata-auditor', 'bulk-injector', 'evergreen-audit', 'retention-reorderer', 'auto-responder'].includes(viewName);

  let moduleToHydrate = null;
  if (['factory', 'thumbnail-lab', 'script-shorts'].includes(viewName)) moduleToHydrate = 'studio';
  if (['metadata-auditor', 'bulk-injector', 'evergreen-audit'].includes(viewName)) moduleToHydrate = 'optics';
  if (['retention-reorderer', 'auto-responder', 'automation-pipeline'].includes(viewName)) moduleToHydrate = 'autopilot';

  if (moduleToHydrate && !ModuleRegistry[moduleToHydrate]) {
    utils.toggleSkeleton(true);
    await utils.wait(300);
    if (moduleToHydrate === 'studio') await hydrateStudio();
    if (moduleToHydrate === 'optics') await hydrateOptics();
    if (moduleToHydrate === 'autopilot') await hydrateAutopilot();
    utils.toggleSkeleton(false);
  }

  document.querySelectorAll('.nav-item, .folder-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === viewName) item.classList.add('active');
  });

  const titles = {
    'overview': 'Overview', 'research': 'Research Engine', 'niche-relevance': 'Niche-Relevance Guard',
    'sidebar-sniper': 'Sidebar Sniper', 'suggested-analytics': 'Suggested Analytics',
    'trend-pulse': 'Trend Pulse', 'factory': 'Video Factory', 'thumbnail-lab': 'Thumbnail Lab',
    'script-shorts': 'Script-to-Shorts', 'thumbnail-redesign': 'Thumbnail Redesign',
    'chapters-generator': 'Chapters Generator', 'community-posts': 'Community Posts',
    'metadata-auditor': 'Metadata Auditor', 'magic-fix': 'Magic Fix', 'bulk-injector': 'Bulk Injector',
    'evergreen-audit': 'Evergreen Audit', 'multi-language': 'Multi-Language SEO',
    'ai-labeling': 'AI Content Label', 'playlist-growth': 'Playlist Growth',
    'retention-reorderer': 'Retention Re-Orderer', 'auto-responder': 'AI Auto-Responder',
    'system-status': 'System Status', 'optimization-history': 'Optimization History',
    'growth-engine': 'Growth Engine', 'cron-inbox': 'Opt. Queue', 'analytics': 'Analytics',
    'keyword-lab': 'Keyword Lab', 'ab-tester': 'A/B Tester', 'seo-lab': 'SEO Lab',
    'phronesis': 'Phronesis', 'automation-pipeline': 'Automation Pipeline',
    'competitor': 'Competitor Sniper', 'settings': 'Settings'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[viewName] || viewName;

  Object.keys(titles).forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === viewName ? 'block' : 'none';
  });

  if (viewName === 'overview' && localStorage.getItem('ytseo_channel_connected') === 'true') {
    const channelId = localStorage.getItem('ytseo_channel_id');
    if (channelId && typeof fetchYouTubeAnalytics === 'function') fetchYouTubeAnalytics(channelId);
  }
  if (viewName === 'overview') {
    setTimeout(() => { if (typeof loadNeuralStrategy === 'function') loadNeuralStrategy(); }, 300);
  }
  if (viewName === 'growth-engine') {
    setTimeout(() => {
      if (typeof loadNeuralStrategy === 'function') loadNeuralStrategy();
      if (typeof GrowthEngine !== 'undefined' && typeof GrowthEngine.loadReport === 'function') GrowthEngine.loadReport();
    }, 300);
  }
  if (viewName === 'suggested-analytics' && typeof loadSuggestedAnalytics === 'function') {
    setTimeout(() => loadSuggestedAnalytics(), 200);
  }
  if (viewName === 'system-status' && typeof runSystemHealthProbe === 'function') {
    setTimeout(() => runSystemHealthProbe(), 200);
  }
  if (viewName === 'metadata-auditor') {
    const targetVideoId = localStorage.getItem('growth_engine_target_video');
    const issuesJson = localStorage.getItem('growth_engine_issues');
    if (targetVideoId) {
      localStorage.removeItem('growth_engine_target_video');
      localStorage.removeItem('growth_engine_issues');
      setTimeout(() => {
        const urlInput = document.getElementById('audit-video-url');
        if (urlInput) {
          urlInput.value = `https://www.youtube.com/watch?v=${targetVideoId}`;
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (issuesJson) {
          try {
            const issues = JSON.parse(issuesJson);
            const resultsEl = document.getElementById('audit-results');
            if (resultsEl && issues.length > 0) {
              resultsEl.innerHTML = `
                <div data-growth-banner="1" style="background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(251,146,60,0.04));border:1px solid rgba(249,115,22,0.2);border-radius:12px;padding:16px 20px;margin-bottom:16px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="font-size:20px;">🔍</span>
                    <strong style="color:var(--primary);">Growth Engine - Issues Detected</strong>
                  </div>
                  ${issues.map(i => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i.severity==='high'?'#ef4444':'#f59e0b'};"></span>
                    <span style="font-size:12px;color:${i.severity==='high'?'#ef4444':'#f59e0b'};">${i.issue}</span>
                    <span style="font-size:10px;color:var(--text-muted);margin-left:auto;">${i.type}</span>
                  </div>`).join('')}
                </div>`;
            }
          } catch(e) {}
        }
      }, 500);
    }
  }

  if (viewName === 'optimization-history' && typeof OptimizationTrials !== 'undefined') {
    setTimeout(() => OptimizationTrials.refresh(), 100);
  }
  if (viewName === 'analytics' && typeof loadAnalytics === 'function') {
    setTimeout(() => loadAnalytics(), 100);
  }
  if (viewName === 'ab-tester' && typeof loadAbTests === 'function') {
    setTimeout(() => loadAbTests(), 100);
  }
  if (viewName === 'seo-lab' && typeof loadSeoLab === 'function') {
    setTimeout(() => loadSeoLab(), 100);
    if (typeof loadAutoPublishState === 'function') setTimeout(() => loadAutoPublishState(), 200);
  }
  if (viewName === 'phronesis' && typeof loadPhronesis === 'function') {
    setTimeout(() => loadPhronesis(), 100);
  }
  if (!ModuleRegistry.coach_history && typeof syncComments === 'function') {
    ModuleRegistry.coach_history = true;
    requestIdleCallback(() => {
      if (document.getElementById('comments-container')) syncComments();
    });
  }
  if ((viewName === 'playlist-growth' || viewName === 'optics') && typeof loadWeaverPlaylists === 'function') {
    loadWeaverPlaylists();
  }
  if (window.lucide) window.lucide.createIcons();
}

// Backward-compatible global during transition
window.switchView = switchView;

export function platformInit() {
  console.log('🚀 Platform Initialization (Tier 1) starting...');

  // Admin access check
  (function checkAdminAccess() {
    var params = new URLSearchParams(window.location.search);
    var isAdminParam = params.get('admin');
    var storedAdmin = localStorage.getItem('ytseo_admin_access');
    if (isAdminParam === 'true' || storedAdmin === 'true') {
      if (isAdminParam === 'true') localStorage.setItem('ytseo_admin_access', 'true');
      var tab = document.getElementById('nav-seo-lab');
      if (tab) { tab.style.display = 'flex'; tab.style.pointerEvents = ''; tab.style.opacity = ''; }
    }
  })();

  // CSRF Token
  fetch('/api/auth/csrf?channelId=' + (localStorage.getItem('ytseo_channel_id') || 'anonymous'))
    .then(r => r.json())
    .then(data => {
      if (data.token) {
        window.csrfToken = data.token;
        localStorage.setItem('csrf_token', data.token);
      }
    })
    .catch(() => console.warn('[CSRF] Token fetch failed'));

  // Credits & Persistence
  if (typeof CreditsSystem !== 'undefined') CreditsSystem.init();
  if (typeof initTimeSaved === 'function') initTimeSaved();
  if (typeof checkSavedConnection === 'function') checkSavedConnection();

  // UI & Premium State
  if (typeof updatePremiumUI === 'function') updatePremiumUI();
  if (typeof updateCreditsDisplay === 'function') updateCreditsDisplay();

  // Event bindings
  const healthBtn = document.getElementById('run-health-check');
  if (healthBtn && typeof runHealthCheck === 'function') healthBtn.addEventListener('click', runHealthCheck);
  const syncBtn = document.getElementById('sync-comments-btn');
  if (syncBtn && typeof syncComments === 'function') syncBtn.addEventListener('click', syncComments);
  const auditForm = document.getElementById('analyze-form');
  if (auditForm) {
    auditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof runAudit === 'function') runAudit();
    });
  }

  // Default View
  setTimeout(() => switchView('overview'), 100);

  // Lucide Icons
  if (window.lucide) { lucide.createIcons(); }

  console.log('✅ Tier 1 Initialization Complete.');
  if (typeof checkAIStatus === 'function') setTimeout(checkAIStatus, 2000);
}
