// api/agent-core/outcome-tracker.js — Programmatic learning signals
// No express router; called directly from orchestrator, dismiss routes, and apply routes.
// Reads / writes agent_learning table via the db service.

let _cache = null;
let _cacheTime = 0;

/**
 * Record an outcome for a proposal / recommendation.
 * @param {string} actionType  e.g. 'title', 'description', 'tags', 'thumbnail'
 * @param {string} outcome     'applied' | 'skipped' | 'dismissed' | 'rejected'
 * @param {string} niche       e.g. 'General', 'Christian', 'Gaming', …
 */
export async function trackOutcome(actionType, outcome, niche = 'General') {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const row = await dbService.db
      .select()
      .from(s.agentLearning)
      .where(and(eq(s.agentLearning.actionType, actionType), eq(s.agentLearning.niche, niche)))
      .limit(1);

    const now = new Date();
    if (row.length) {
      const existing = row[0];
      const newSample = (existing.sampleSize || 0) + 1;
      const isGood = outcome === 'applied';
      const newRate = ((existing.successRate || 0.5) * (existing.sampleSize || 0) + (isGood ? 1 : 0)) / newSample;

      await dbService.db.update(s.agentLearning).set({
        successRate: +newRate.toFixed(3),
        sampleSize: newSample,
        recentSuccesses: isGood ? (existing.recentSuccesses || 0) + 1 : 0,
        recentSkips: (outcome === 'dismissed' || outcome === 'rejected') ? (existing.recentSkips || 0) + 1 : 0,
        lastUpdated: now,
      }).where(eq(s.agentLearning.id, existing.id));
    } else {
      await dbService.db.insert(s.agentLearning).values({
        actionType,
        niche,
        successRate: outcome === 'applied' ? 1 : 0,
        sampleSize: 1,
        recentSuccesses: outcome === 'applied' ? 1 : 0,
        recentSkips: outcome === 'dismissed' || outcome === 'rejected' ? 1 : 0,
        lastUpdated: now,
      });
    }
    // Invalidate cache
    _cache = null;
  } catch (e) {
    console.warn('[LEARN] trackOutcome failed:', e.message);
  }
}

/**
 * Return success-rate table keyed by actionType.
 * Cached per-call (in-memory); callers invalidate by re-calling.
 * @param {string} [niche='General']
 */
export async function getLearningAdjustments(niche = 'General') {
  const now = Date.now();
  if (_cache && now - _cacheTime < 60_000) return _cache; // 1-min cache

  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const rows = await dbService.db.select().from(s.agentLearning);
    _cache = rows.reduce((acc, r) => {
      acc[r.actionType] = {
        successRate: r.successRate,
        sampleSize: r.sampleSize,
        recentSkips: r.recentSkips,
        recentSuccesses: r.recentSuccesses,
      };
      return acc;
    }, {});
    _cacheTime = now;
    return _cache;
  } catch (e) {
    console.warn('[LEARN] getLearningAdjustments failed:', e.message);
    return {};
  }
}

/**
 * Given a score and proposed actionType, apply a learning-derived multiplier
 * so historically-rejected action types score proportionally lower.
 * score ∈ 0..100 → returns adjusted score 0..100.
 */
export function applyLearningWeight(score, actionType, adjustments, niche = 'General') {
  const key = (niche !== 'General') ? `${actionType}:${niche}` : actionType;
  const entry = adjustments[key] || adjustments[actionType];
  if (!entry || !entry.sampleSize) return score;
  // Below 50% success rate → penalise; above 75% → boost slightly
  const factor = entry.successRate < 0.5
    ? 0.6 + entry.successRate * 0.8       // 0%→0.6, 50%→1.0
    : 0.9 + (entry.successRate - 0.5) * 0.4; // 50%→1.0, 100%→1.2
  return Math.min(100, Math.max(0, Math.round(score * factor)));
}
