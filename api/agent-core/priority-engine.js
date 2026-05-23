// ─── Phronesis Priority Engine ───
// Ranks proposals by goal-fit + EV + confidence, then selects top-N for auto-approve.
// Usage: const { scoreProposals, selectTopN, dailyCap } = await import('./priority-engine.js');

const GOAL_BOOST = {
  subscribers: {
    boosters: { first48h:2.0, title:1.6, thumbnail:1.5, shorts:1.4, description:0.8, tags:0.6, chapters:0.3 },
    suppressors: { multilang:0.3, playlist:0.5, community:0.7 },
  },
  watch_time: {
    boosters: { chapters:2.0, description:1.2, playlist:1.3 },
    suppressors: { title:0.8, tags:0.4, shorts:0.5 },
  },
  revenue: {
    boosters: { first48h:2.0, title:1.6, shorts:1.6 },
    suppressors: { chapters:0.3, multilang:0.3, playlist:0.5 },
  },
};

function matchGoal(text) {
  if (!text) return 'subscribers';
  const t = String(text).toLowerCase();
  if (t.includes('sub') || t.includes('follower')) return 'subscribers';
  if (t.includes('watch time') || t.includes('retention') || t.includes('view duration')) return 'watch_time';
  if (t.includes('revenue') || t.includes('monetiz') || t.includes('cpm') || t.includes('ad')) return 'revenue';
  return 'subscribers';
}

function goalProfile(goal) {
  return GOAL_BOOST[matchGoal(goal)] || GOAL_BOOST.subscribers;
}

function confidenceOf(ev, val) {
  if (val === undefined) return 60;
  return val;
}

function actionFit(action, boosters) {
  const a = action.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(boosters)) {
    if (k.includes(a) || a.includes(k)) return v;
  }
  return 1.0;
}

function suppressScore(item, suppressors) {
  const a = (item.type || item.actionType || 'proposal').toLowerCase().replace(/[^a-z]/g, '');
  for (const k of Object.keys(suppressors)) {
    if (a.includes(k) || k.includes(a)) return 0.01; // nearly eliminated
  }
  return 1.0;
}

function recencyWeight(proposedAt) {
  const ageH = proposedAt ? (Date.now() - new Date(proposedAt).getTime()) / 3600000 : 72;
  if (ageH < 24) return 1.2;
  if (ageH < 48) return 1.0;
  if (ageH < 96) return 0.8;
  return 0.5;
}

/**
 * Score a single proposal. Returns 0 if below confidence floor.
 */
function scoreOne(item, goal) {
  const profile = goalProfile(goal);
  const ev = item.ev ?? item.estimatedValue ?? 0;
  const conf = item.confidence ?? item.confidenceScore ?? 50;
  if (conf < 40) return 0;

  const gFit = actionFit(item.actionType || item.type || '', profile.boosters);
  const suppress = suppressScore(item, profile.suppressors);
  const recency = recencyWeight(item.proposedAt || item.createdAt);
  const risk = item.metadata?.descriptionChanged ? 0.95 : 1.0;

  const confBonus = conf >= 80 ? 1.15 : conf >= 65 ? 1.05 : 1.0;
  return Math.round(ev * gFit * suppress * recency * risk * confBonus * 100) / 100;
}

/**
 * Rank all pending items by goal-fit score, highest first.
 */
export function scoreProposals(items, goal) {
  return items
    .map(item => ({ item, scored: scoreOne(item, goal) }))
    .filter(x => x.scored > 0)
    .sort((a, b) => b.scored - a.scored);
}

/**
 * Pick top-N from a scored list.
 */
export function selectTopN(scored, n = 3) {
  return scored.slice(0, n);
}

/**
 * Auto-approve cap by channel maturity.
 */
export function dailyCap(totalActions) {
  if (totalActions < 100) return 2;
  if (totalActions < 500) return 5;
  if (totalActions < 2000) return 8;
  return 12;
}

/**
 * Human-readable label for score bucket.
 */
export function priorityLabel(score) {
  if (score >= 5) return '🔥 High';
  if (score >= 2) return '⚡ Medium';
  if (score > 0) return '📌 Low';
  return '⛔ Skip';
}
