/**
 * UI Engine - Core UI utilities for the application
 * Signal Orange theme implementation
 */

// UI helper to get DOM elements by ID
export function ui(id) {
  return document.getElementById(id);
}

// Safe rendering - escapes HTML to prevent XSS
export function safeRender(data) {
  if (typeof data !== 'string') {
    return data;
  }
  return data
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Toast notification system with Signal Orange theme
export function showToast(msg, type = 'info') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${getToastIcon(type)}</span>
      <span class="toast-message">${safeRender(msg)}</span>
      <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
  `;

  // Apply theme colors based on type
  const colors = getSignalOrangeColors(type);
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    min-width: 300px;
    max-width: 500px;
    background: ${colors.background};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `;

  // Style content
  const content = toast.querySelector('.toast-content');
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    color: ${colors.text};
  `;

  const icon = toast.querySelector('.toast-icon');
  icon.style.cssText = `
    font-size: 20px;
    flex-shrink: 0;
  `;

  const message = toast.querySelector('.toast-message');
  message.style.cssText = `
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: ${colors.text};
    opacity: 0.7;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Add to DOM
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Helper functions for toast system
function getToastIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    default: return 'ℹ';
  }
}

function getSignalOrangeColors(type) {
  // Signal Orange theme colors
  const baseOrange = '#ff6b35';
  const lightOrange = '#ff8555';
  const darkOrange = '#e55a2b';

  switch (type) {
    case 'success':
      return {
        background: `linear-gradient(135deg, ${baseOrange}, ${lightOrange})`,
        border: baseOrange,
        text: '#ffffff'
      };
    case 'warning':
      return {
        background: `linear-gradient(135deg, ${baseOrange}, ${lightOrange})`,
        border: baseOrange,
        text: '#ffffff'
      };
    case 'error':
      return {
        background: '#ffebee',
        border: '#f44336',
        text: '#c62828'
      };
    default: // info
      return {
        background: '#e3f2fd',
        border: '#2196f3',
        text: '#1565c0'
      };
  }
}

// Modal handling functions
export function openLegal() {
  const modal = ui('legal-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
      modal.style.transition = 'all 0.3s ease';
    }, 10);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }
}

export function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }
}

// AI Coach Drawer Toggle
export function toggleCoachDrawer(state) {
  const drawer = document.getElementById('coach-window');
  if (drawer) {
    const currentState = drawer.classList.contains('active');
    const newState = typeof state === 'boolean' ? state : !currentState;
    
    if (newState) {
      drawer.style.display = 'flex';
      setTimeout(() => {
        drawer.classList.add('active');
        drawer.style.transform = 'translateX(0)';
      }, 10);
    } else {
      drawer.classList.remove('active');
      drawer.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (!drawer.classList.contains('active')) {
          drawer.style.display = 'none';
        }
      }, 400);
    }
  }
}

// Enhanced View Switcher with Transition Effects
export function switchView(viewName) {
  const isLazy = ['factory', 'thumbnail-lab', 'script-shorts', 'metadata-auditor', 'bulk-injector', 'evergreen-audit', 'retention-reorderer', 'auto-responder'].includes(viewName);

  const mainContent = ui('main-content');
  if (mainContent) {
    mainContent.style.opacity = '0';
    mainContent.style.transform = 'translateY(10px)';
    mainContent.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  setTimeout(() => {
    // Update nav items
    document.querySelectorAll('.nav-item, .folder-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Update page title
    const titles = {
      'overview': 'Overview',
      'research': 'Research Engine',
      'niche-relevance': 'Niche-Relevance Guard',
      'sidebar-sniper': 'Sidebar Sniper',
      'suggested-analytics': 'Suggested Analytics',
      'factory': 'Video Factory',
      'thumbnail-lab': 'Thumbnail Lab',
      'script-shorts': 'Script-to-Shorts',
      'thumbnail-redesign': 'Thumbnail Redesign',
      'metadata-auditor': 'Metadata Auditor',
      'magic-fix': 'Magic Fix',
      'bulk-injector': 'Bulk Injector',
      'evergreen-audit': 'Evergreen Audit',
      'playlist-growth': 'Playlist Growth',
      'retention-reorderer': 'Retention Re-Orderer',
      'auto-responder': 'AI Auto-Responder',
      'system-status': 'System Status',
      'automation-pipeline': 'Automation Pipeline',
      'competitor': 'Competitor Sniper',
      'billing': 'Power Up Station',
      'settings': 'Settings'
    };
    const titleEl = ui('page-title');
    if (titleEl) titleEl.textContent = titles[viewName] || viewName;

    // Show/hide views
    Object.keys(titles).forEach(v => {
      const el = ui(`view-${v}`);
      if (el) {
        el.style.display = v === viewName ? 'block' : 'none';
      }
    });

    if (mainContent) {
      mainContent.style.opacity = '1';
      mainContent.style.transform = 'translateY(0)';
    }

    // Final Icon Refresh
    if (window.lucide) window.lucide.createIcons();
  }, 300);
}

// Folder Toggle
export function toggleFolder(folderId) {
  const folder = ui(`folder-${folderId}`);
  if (folder) {
    folder.classList.toggle('open');
  }
}