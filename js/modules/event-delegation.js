// js/modules/event-delegation.js
// Single delegated click listener — replaces all HTML onclick handlers
// Usage: <button data-action="runResearch" data-arg="gaming">Run</button>

const actionHandlers = new Map();

/**
 * Register action handlers. Called by main.js after all modules load.
 * @param {Object<string, Function>} handlers — { actionName: handlerFunction }
 */
export function registerActions(handlers) {
  for (const [action, fn] of Object.entries(handlers)) {
    actionHandlers.set(action, fn);
  }
}

/**
 * Initialize the delegation system. One listener at document level.
 */
export function initDelegation() {
  document.addEventListener('click', (e) => {
    // Walk up the DOM to find a [data-action] ancestor
    let target = e.target;
    while (target && target !== document) {
      if (!target.hasAttribute) { target = target.parentNode; continue; }
      const action = target.getAttribute('data-action');
      if (action && actionHandlers.has(action)) {
        e.preventDefault();
        const arg = target.getAttribute('data-arg');
        const fn = actionHandlers.get(action);
        try {
          fn(arg, target, e);
        } catch (err) {
          console.error(`[action] Error in handler "${action}":`, err);
        }
        return;
      }
      target = target.parentNode;
    }
  });

  console.log('[delegation] Initialized with', actionHandlers.size, 'handlers');
}
