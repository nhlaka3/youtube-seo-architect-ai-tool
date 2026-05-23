// api/agent-core/memory-engine.js — Persistent agent memory with pattern learning
// Stores: per-channel performance, action outcomes, niche insights, trend memory
// Integrates: autonomous-agent-harness + continuous-learning-v2 patterns

/**
 * Record a scan snapshot for before/after impact measurement
 */
export async function captureScanSnapshot(channelId, videos) {
  try {
    const snapshot = {
      channelId,
      timestamp: new Date().toISOString(),
      videoCount: videos.length,
      videos: videos.map(v => ({
        videoId: v.videoId,
        title: v.title?.substring(0, 120),
        views: v.views || 0,
        engagement: v.engagementRate || 0,
        tagsCount: v.tags?.length || 0,
        issues: v.issues || []
      })),
      avgEngagement: videos.length ? videos.reduce((s,v) => s + (v.engagementRate||0), 0) / videos.length : 0,
      avgViews: videos.length ? Math.round(videos.reduce((s,v) => s + (v.views||0), 0) / videos.length) : 0,
      totalIssues: videos.reduce((s,v) => s + (v.issues?.length||0), 0)
    };
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `SNAPSHOT:${JSON.stringify(snapshot)}`,
      impactDescription: `Pre-scan baseline: ${snapshot.videoCount} videos, ${snapshot.avgEngagement.toFixed(2)}% avg engagement`,
      status: 'success'
    });
    return snapshot;
  } catch (e) {
    console.error('[MEMORY] Snapshot failed:', e.message);
    return null;
  }
}

/**
 * Measure impact delta between pre-scan and post-optimization
 */
export async function measureImpactDelta(channelId, snapshot, currentMetrics) {
  if (!snapshot) return { delta: 0, significant: false };
  try {
    const delta = (currentMetrics?.avgEngagement || 0) - (snapshot.avgEngagement || 0);
    const significant = Math.abs(delta) > 0.5;
    const result = {
      delta: +delta.toFixed(2),
      significant,
      direction: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      beforeEngagement: snapshot.avgEngagement,
      afterEngagement: currentMetrics?.avgEngagement || 0,
      issuesResolved: snapshot.totalIssues - (currentMetrics?.totalIssues || 0)
    };
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `IMPACT_DELTA:${JSON.stringify(result)}`,
      impactDescription: `${result.direction === 'positive' ? '📈' : result.direction === 'negative' ? '📉' : '➡️'} Engagement delta: ${result.delta >= 0 ? '+' : ''}${result.delta}% | ${result.issuesResolved} issues resolved`,
      status: result.direction === 'negative' ? 'warning' : 'success'
    });
    return result;
  } catch (e) {
    console.error('[MEMORY] Delta measurement failed:', e.message);
    return { delta: 0, significant: false };
  }
}

/**
 * Store pattern discovered from agent decisions
 */
export async function storePattern(pattern) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `PATTERN:${JSON.stringify(pattern)}`,
      impactDescription: `Discovered pattern: ${pattern.type} — ${pattern.insight}`,
      status: 'success'
    });
  } catch (e) { /* non-critical */ }
}

/**
 * Retrieve recent patterns for a niche
 */
export async function getPatterns(niche, limit = 10) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc } = await import('drizzle-orm');
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(200);
    return logs
      .filter(l => l.actionTaken?.startsWith('PATTERN:'))
      .map(l => { try { return JSON.parse(l.actionTaken.replace('PATTERN:','')); } catch(e) { return null; } })
      .filter(Boolean)
      .slice(0, limit);
  } catch (e) { return []; }
}

/**
 * Build growth compounding model — projects future growth based on current trends
 */
export function projectGrowth(baseline, weeklyActionRate, avgImpactPerAction, weeks = 12) {
  const projections = [];
  let current = baseline;
  for (let w = 0; w < weeks; w++) {
    const weeklyGain = weeklyActionRate * avgImpactPerAction * (1 + w * 0.05); // compounding 5%
    current += weeklyGain;
    projections.push({
      week: w + 1,
      estimated: Math.round(current),
      weeklyGain: Math.round(weeklyGain),
      cumulativeGain: Math.round(current - baseline)
    });
  }
  return {
    baseline,
    projections,
    totalEstimated: Math.round(current),
    totalGain: Math.round(current - baseline),
    weeksToGoal: null // filled in by caller
  };
}

/**
 * Calculate time-to-goal estimate
 */
export function estimateTimeToGoal(currentSubs, goalSubs, weeklyActionRate, avgSubsPerAction) {
  if (goalSubs <= currentSubs) return { achieved: true, weeksRemaining: 0 };
  const weeklyGain = weeklyActionRate * avgSubsPerAction;
  if (weeklyGain <= 0) return { achievable: false, weeksRemaining: Infinity };
  const subsNeeded = goalSubs - currentSubs;
  const weeks = Math.ceil(subsNeeded / weeklyGain);
  const confidence = weeks <= 4 ? 90 : weeks <= 8 ? 70 : weeks <= 16 ? 50 : 30;
  return {
    achievable: true,
    weeksRemaining: weeks,
    estimatedDate: new Date(Date.now() + weeks * 7 * 86400000).toISOString().split('T')[0],
    confidence,
    weeklyGainEstimate: Math.round(weeklyGain)
  };
}
