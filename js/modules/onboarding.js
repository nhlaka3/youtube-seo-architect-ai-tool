// js/modules/onboarding.js
// First-Time User Onboarding — extracted from main.js lines 651-687

export function initOnboarding() {
  const hasOnboarded = localStorage.getItem('ytseo_onboarded');
  const isConnected = localStorage.getItem('ytseo_channel_connected') === 'true';
  if (hasOnboarded || isConnected) return;

  setTimeout(() => {
    const steps = [
      { el: '#oauth-btn', title: 'Connect Your Channel', text: 'Sign in with Google to unlock all 17 tools. Official OAuth - no password required.' },
      { el: '#credits-display', title: '100 Free Credits/Month', text: 'Get 100 credits every month. Tools cost 1-5 credits. No credit card required.' },
      { el: '.sidebar', title: 'Explore Tools', text: 'Use the sidebar to navigate between 17 AI-powered tools. Audit videos, research keywords, generate scripts - all from one dashboard.' },
      { el: '#page-title', title: 'You\'re All Set!', text: 'Start by connecting your channel, then explore the tools in the sidebar. Happy optimizing! 🚀' }
    ];

    let cur = -1, ov, tt;
    function show(i) {
      if (ov) { ov.remove(); ov = null; }
      if (tt) { tt.remove(); tt = null; }
      if (i >= steps.length) { localStorage.setItem('ytseo_onboarded', '1'); return; }
      cur = i;
      const s = steps[i];
      const tgt = document.querySelector(s.el);
      if (!tgt || tgt.offsetParent === null) { show(i + 1); return; }
      ov = document.createElement('div');
      ov.className = 'onboard-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;';
      ov.addEventListener('click', () => show(cur + 1));
      document.body.appendChild(ov);
      const r = tgt.getBoundingClientRect();
      tt = document.createElement('div');
      tt.className = 'onboard-tt';
      tt.style.cssText = `position:fixed;top:${r.bottom+12}px;left:${Math.max(12,r.left)}px;max-width:320px;background:#1a1a2e;border:1px solid var(--primary);border-radius:12px;padding:16px 20px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
      tt.innerHTML = `<div style="font-weight:700;color:var(--primary);margin-bottom:6px;">${s.title}</div><div style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:12px;">${s.text}</div><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11px;color:#94a3b8;">${cur+1}/${steps.length}</span><div><button class="onboard-skip" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;margin-right:12px;">Skip</button><button class="onboard-next" style="background:var(--primary);color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">Next →</button></div></div>`;
      document.body.appendChild(tt);
      tt.querySelector('.onboard-next').addEventListener('click', (e) => { e.stopPropagation(); show(cur + 1); });
      tt.querySelector('.onboard-skip').addEventListener('click', (e) => { e.stopPropagation(); if(ov)ov.remove();if(tt)tt.remove();localStorage.setItem('ytseo_onboarded','1'); });
      tgt.style.position = 'relative';
      tgt.style.zIndex = '9999';
      tgt.style.boxShadow = '0 0 0 4px var(--primary)';
    }
    show(0);
  }, 2000);
}
