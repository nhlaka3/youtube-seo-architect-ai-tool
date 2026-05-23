/**
 * UX Enhancements Module
 * Handles real-time UI feedback, dynamic dashboard elements, and premium animations.
 */

export const UXEnhancements = {
  /**
   * Initializes the dashboard pulse and activity simulation
   */
  init() {
    this.startActivityPulse();
    this.setupHoverGlows();
  },

  /**
   * Simulates real-time activity for a more "alive" feel
   */
  startActivityPulse() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    const activities = [
      { icon: 'search', text: 'Analyzing keyword clusters for "Passive Income"', color: 'primary' },
      { icon: 'wand-2', text: 'Optimizing metadata for "How to grow on YouTube"', color: 'success' },
      { icon: 'target', text: 'Competitor infiltration bundle generated', color: 'accent' },
      { icon: 'zap', text: 'Credits refilled via subscription', color: 'warning' },
      { icon: 'bot', text: 'AI Coach analyzing your retention patterns', color: 'primary' }
    ];

    setInterval(() => {
      if (Math.random() > 0.7) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        this.addActivityItem(activity);
      }
    }, 15000);
  },

  /**
   * Adds an item to the activity list
   */
  addActivityItem({ icon, text, color }) {
    const list = document.getElementById('activity-list');
    if (!list) return;

    // Remove empty state if present
    const empty = list.querySelector('.activity-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'activity-item fade-in-up';
    item.innerHTML = `
      <div class="activity-icon ${color}">
        <i data-lucide="${icon}"></i>
      </div>
      <div class="activity-details">
        <div class="activity-title">${text}</div>
        <div class="activity-time">Just now</div>
      </div>
    `;

    list.prepend(item);
    if (list.children.length > 5) {
      list.lastElementChild.remove();
    }

    if (window.lucide) window.lucide.createIcons();
  },

  /**
   * Adds dynamic glow effects to cards on mouse move
   */
  setupHoverGlows() {
    document.querySelectorAll('.bento-card, .glass-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }
};

// Auto-init if on dashboard
if (document.getElementById('view-overview')) {
  window.addEventListener('load', () => UXEnhancements.init());
}
