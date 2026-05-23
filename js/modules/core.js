// js/modules/core.js
// Core utilities — no module imports needed, used by all other modules
import { config } from './config.js';

/**
 * API fetch helper — auto-includes CSRF + channelId headers.
 * Replaces window.apiPost from main.js.
 */
export async function apiPost(path, body = {}) {
  const csrf = window.csrfToken || localStorage.getItem('csrf_token') || '';
  const chId = localStorage.getItem('ytseo_channel_id') || 'anonymous';
  const res = await fetch(`${config.API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrf,
      'x-channel-id': chId
    },
    body: JSON.stringify(body)
  });
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error?.includes('CSRF')) {
      const healthRes = await fetch('/api/health?channelId=' + chId);
      const healthData = await healthRes.json();
      if (healthData.csrfToken) {
        window.csrfToken = healthData.csrfToken;
        localStorage.setItem('csrf_token', healthData.csrfToken);
        return fetch(`${config.API_BASE_URL}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': healthData.csrfToken,
            'x-channel-id': chId
          },
          body: JSON.stringify(body)
        });
      }
    }
  }
  return res;
}

/**
 * Safe render — escapes HTML to prevent XSS.
 * Replaces window.safeRender and the duplicate in ui-engine.js.
 */
export function safeRender(data) {
  if (typeof data !== 'string') return data;
  return data
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escape HTML string using DOM textContent.
 * Replaces window.escapeHTML.
 */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Toast notification.
 * Replaces window.showToast.
 */
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:99999;
    padding:12px 24px; border-radius:8px; font-size:14px;
    color:#fff; animation:toastSlideIn 0.3s ease;
    ${type === 'success' ? 'background:#16a34a;' :
      type === 'error' ? 'background:#dc2626;' :
      type === 'warning' ? 'background:#f59e0b;' :
      'background:#3b82f6;'}
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

/**
 * Credits deduction animation.
 * Replaces window.animateCreditsDeduction.
 */
export function animateCreditsDeduction(amount) {
  const el = document.getElementById('bento-credits-value') || document.getElementById('credits-count');
  if (!el) return;
  el.style.transform = 'scale(1.3)';
  el.style.color = '#f97316';
  el.textContent = Math.max(0, parseInt(el.textContent || '0') - amount);
  setTimeout(() => { el.style.transform = 'scale(1)'; el.style.color = ''; }, 300);
}
