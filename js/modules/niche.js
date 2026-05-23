// js/modules/niche.js — Niche detection, agent mode, channel analysis
// Extracted from main.js (Phronesis Agent Utilities + Niche Detection System)
import { apiPost, showToast } from './core.js';
import { config } from './config.js';

var _phronesisAutoTimer = null;

export function setAgentMode(mode) {
  document.querySelectorAll('.auto-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
  var badge=document.getElementById('war-mode-badge');
  var labels={off:'OFF',monitor:'MONITORING',suggest:'SUGGESTING',auto:'AUTO'};
  if(badge)badge.textContent=labels[mode]||mode.toUpperCase();
  var dot=document.getElementById('war-status-dot');
  if(mode==='off'){if(dot){dot.style.background='var(--war-danger)';dot.classList.remove('agent-active');}}
  else{if(dot){dot.style.background='var(--war-success)';dot.classList.add('agent-active');}}
  var statusText=document.getElementById('war-status-text');
  if(statusText)statusText.textContent=mode==='off'?'Agent Offline':mode==='auto'?'Autonomous Mode Active':'Agent '+labels[mode];
  var ch=localStorage.getItem('ytseo_channel_id')||'anonymous';
  fetch('/api/agent/toggle',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-channel-id':ch},
    body:JSON.stringify({enabled:mode!=='off',mode:mode})
  }).then(function(r){return r.json();}).then(function(){
    showToast('Agent ' + mode, 'success');
  }).catch(function(){
    showToast('Failed to toggle agent mode', 'error');
  });
  document.querySelectorAll('.stat-value').forEach(function(el){el.classList.add('pulse-once');setTimeout(function(){el.classList.remove('pulse-once');},600);});
  if(mode==='auto'){
    if(!_phronesisAutoTimer && typeof loadPhronesis === 'function') loadPhronesis();
    if(_phronesisAutoTimer) clearInterval(_phronesisAutoTimer);
    _phronesisAutoTimer = setInterval(function(){
      if(typeof loadPhronesis === 'function') loadPhronesis();
      if(typeof loadCommandInbox === 'function') loadCommandInbox();
      if(typeof loadScanResults === 'function') loadScanResults();
      if(typeof loadRecommendations === 'function') loadRecommendations();
    }, 90000);
  } else {
    if(_phronesisAutoTimer){ clearInterval(_phronesisAutoTimer); _phronesisAutoTimer=null; }
  }
}

export async function syncPhronesisMode() {
  try{
    var r = await fetch('/api/agent/status');
    var d = await r.json();
    var enabled = d && d.settings && d.settings.isAutonomous;
    setAgentMode(enabled ? 'auto' : 'monitor');
  }catch(e){}
}

export function agentKillSwitch() {
  if(!confirm('🛑 Kill Switch: Halt all autonomous actions and clear pending queues?'))return;
  fetch('/api/agent/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
    .then(function(){
      setAgentMode('off');
      showToast('Agent halted', 'success');
      if(typeof addFeedItem === 'function') addFeedItem('warning','System','Kill switch activated - agent halted');
      var killBtn=document.querySelector('.kill-switch-btn');
      if(killBtn){killBtn.classList.add('activated');setTimeout(function(){killBtn.classList.remove('activated');},500);}
    })
    .catch(function(){
      showToast('Kill failed — try again', 'error');
    });
}

let detectedNiche = localStorage.getItem('ytseo_detected_niche') || null;

export function checkHealthAndCoach(avgScore) {
  console.log('[AI Architect] Site Health: ' + avgScore + '%');
  if (avgScore < 70) {
    showToast('AI Architect: Your channel stability is low. Consider running a Smart Overhaul.', 'warning');
  }
}

export async function detectChannelNiche() {
  const token = localStorage.getItem('ytseo_access_token');
  if (!token) {
    console.log('[Niche Detection] No access token, skipping');
    return;
  }

  try {
    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) return;
    const channel = channelData.items[0];
    const channelAbout = channel.snippet.description || '';
    const channelId = channel.id;

    const videosRes = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=' + channelId + '&order=date&maxResults=5&type=video', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const videosData = await videosRes.json();
    const recentTitles = (videosData.items || []).map(function(v) { return v.snippet.title; });

    const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
    const chId = channelId || localStorage.getItem('ytseo_channel_id') || 'anonymous';

    const classifyRes = await fetch(config.API_BASE_URL + '/api/youtube/classify-niche', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf, 'x-channel-id': chId },
      body: JSON.stringify({ channelAbout, recentTitles })
    });

    const classifyData = await classifyRes.json();
    let niche = classifyData.niche || 'Lifestyle';

    if (!classifyRes.ok) {
      const descWords = channelAbout.toLowerCase();
      if (descWords.includes('science') || descWords.includes('physics')) niche = 'Science';
      else if (descWords.includes('tech') || descWords.includes('coding')) niche = 'Tech';
      else if (descWords.includes('finance') || descWords.includes('money')) niche = 'Finance';
      else if (descWords.includes('gaming') || descWords.includes('game')) niche = 'Gaming';
      else if (descWords.includes('music') || descWords.includes('song')) niche = 'Music';
      else if (descWords.includes('vlog') || descWords.includes('daily')) niche = 'Vlog';
    }

    localStorage.setItem('ytseo_detected_niche', niche);
    detectedNiche = niche;
    updateNicheDisplay(niche);
    showToast('✨ Intelligence Engine: Niche detected as ' + niche, 'success');
  } catch (e) {
    console.error('[Niche Detection] Error:', e);
  }
}

export function updateNicheDisplay(niche) {
  var nicheLabels = document.querySelectorAll('[data-niche-label]');
  nicheLabels.forEach(function(el) {
    if (el) {
      el.innerHTML = '<span class="niche-detected">' + niche + '</span> <span class="ai-verified">⚡ AI Verified</span>';
    }
  });
  var nicheSelect = document.getElementById('niche-select');
  if (nicheSelect) {
    nicheSelect.value = niche;
    nicheSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Backward compat globals
window.setAgentMode = setAgentMode;
window.syncPhronesisMode = syncPhronesisMode;
window.agentKillSwitch = agentKillSwitch;
window.detectChannelNiche = detectChannelNiche;
window.updateNicheDisplay = updateNicheDisplay;
window.checkHealthAndCoach = checkHealthAndCoach;
