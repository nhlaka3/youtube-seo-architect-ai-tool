// api/agent-core/scoring-engine.js — LAYER 2: Advanced Reasoning & Scoring (Better Logic)
// Replaces simple confidence heuristics with Expected Value (EV) scoring
// EV = (Confidence * Impact) - (Cost * RiskMultiplier)
// Integrates: phronesismind.txt Phase 2

/**
 * Calculate Expected Value for a proposed action
 * EV = (Confidence * ImpactScore) - (CostFactor * RiskMultiplier)
 * Higher EV = better return on action
 */
export function calculateExpectedValue(actionType, confidence, impactScore, context = {}) {
  // Base impact per action type (subscriber potential)
  const impactMap = {
    title: 8,        // Title optimization — high impact
    description: 6,  // Description — medium impact
    tags: 5,         // Tags — moderate impact
    thumbnail: 9,    // Thumbnail redesign — highest impact
    chapters: 4,     // Chapters — lower impact
    evergreen: 7,    // Evergreen optimization — long-term
    preupload: 6,    // Pre-upload check — preventive
    trend: 10,       // Trend exploitation — very high (time-limited)
    ab_test: 7,      // A/B testing — data-driven improvement
    content_gap: 6,  // Content gap — strategic
    bulk: 3,         // Bulk operations — lower per-item impact
    playlist: 5,     // Playlist — moderate
    community: 4,    // Community — engagement focused
    multi_lang: 7,   // Multi-language — reach expansion
  };

  const baseImpact = impactMap[actionType] || 5;

  // Cost factors
  const costMap = {
    api: 0.001,      // API call cost (negligible per call)
    quota: 0.5,      // Quota consumption (YouTube API units)
    risk: 1.0,       // Risk of negative impact
    time: 0.2,       // Time/attention cost
  };

  // Risk multiplier — increases based on context
  let riskMultiplier = 1.0;

  // Risk increases when nearing quota limits
  if (context.quotaUsed && context.quotaMax) {
    const quotaRatio = context.quotaUsed / context.quotaMax;
    if (quotaRatio > 0.8) riskMultiplier += 0.8;  // Near limit — high risk
    else if (quotaRatio > 0.5) riskMultiplier += 0.3;
  }

  // Risk increases with trend volatility
  if (context.trendVolatility && context.trendVolatility > 50) {
    riskMultiplier += 0.5;  // Highly volatile trend — risky bet
  }

  // Risk increases with recent skip rate
  if (context.recentSkipRate && context.recentSkipRate > 0.3) {
    riskMultiplier += 0.4;  // User keeps skipping similar actions
  }

  // Risk decreases with historical success
  if (context.historicalWinRate && context.historicalWinRate > 0.7) {
    riskMultiplier -= 0.3;  // Proven action type — lower risk
  }

  // Risk for sensitive operations
  const sensitiveActions = ['title', 'thumbnail', 'trend'];
  if (sensitiveActions.includes(actionType)) {
    riskMultiplier += 0.2;  // Higher stakes
  }

  // Brand safety check
  if (context.brandSafety === 'high') {
    riskMultiplier += 0.5;  // Conservative channel — be careful
  }

  // Calculate EV
  const normalizedConfidence = confidence / 100;
  const combinedImpact = baseImpact * (impactScore || 1);
  const totalCost = (costMap.api + costMap.quota + costMap.risk * riskMultiplier + costMap.time);
  const ev = (normalizedConfidence * combinedImpact) - totalCost;

  return {
    ev: +ev.toFixed(3),
    confidence: normalizedConfidence,
    baseImpact,
    combinedImpact: +combinedImpact.toFixed(1),
    riskMultiplier: +riskMultiplier.toFixed(2),
    totalCost: +totalCost.toFixed(4),
    components: {
      confidenceContribution: +(normalizedConfidence * combinedImpact).toFixed(3),
      riskDeduction: +(costMap.risk * riskMultiplier).toFixed(3),
      costDeduction: +totalCost.toFixed(4)
    },
    verdict: ev > 2 ? 'high_value' : ev > 1 ? 'medium_value' : ev > 0 ? 'low_value' : 'negative_value',
    thresholdPassed: ev > 0.5  // Minimum EV threshold for queue inclusion
  };
}

/**
 * Get risk modifier for an action based on current system state
 */
export function getRiskModifier(actionType, systemState = {}) {
  let modifier = 1.0;

  // Quota proximity risk
  if (systemState.quotaRemaining !== undefined && systemState.quotaTotal) {
    const quotaPct = systemState.quotaRemaining / systemState.quotaTotal;
    if (quotaPct < 0.1) modifier += 1.0;   // Critical — almost out
    else if (quotaPct < 0.25) modifier += 0.5;
    else if (quotaPct < 0.5) modifier += 0.2;
  }

  // Error rate risk
  if (systemState.errorRate && systemState.errorRate > 0.15) {
    modifier += 0.8;  // High error rate — pause risky actions
  }

  // Daily limit proximity
  if (systemState.actionsToday && systemState.maxDaily) {
    const usedPct = systemState.actionsToday / systemState.maxDaily;
    if (usedPct > 0.9) modifier += 0.6;
    else if (usedPct > 0.7) modifier += 0.3;
  }

  // Action-specific risks
  const highRiskActions = ['title', 'thumbnail'];
  if (highRiskActions.includes(actionType)) {
    modifier += 0.15;
  }

  // Time-based risk (late night = fewer users to catch errors)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 23) {
    modifier += 0.1;  // Slightly more risk during off-hours
  }

  return +modifier.toFixed(2);
}

/**
 * Calculate Circuit Breaker status
 * If error_rate > 15% in last 24h, pause all sub-agents
 */
export async function checkCircuitBreaker() {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { gte, eq } = await import('drizzle-orm');
    
    const last24h = new Date(Date.now() - 24 * 3600000);
    const recentLogs = await dbService.db.select()
      .from(s.agentActivityLogs)
      .where(gte(s.agentActivityLogs.createdAt, last24h));
    
    const realAgents = ['optimizer', 'trend_scanner', 'pseo_engine', 'ab_tester', 'coach', 'content_planner'];
    const agentLogs = recentLogs.filter(l => realAgents.includes(l.agentName));
    // Count ONLY 'error' status logs as failures. 'warning' is intentional system
    // awareness (kill switch triggers, depth capacity alerts, coach notifications)
    // and must NOT trip the circuit breaker.
    const errorLogs = agentLogs.filter(l => l.status === 'error');
    
    const errorRate = agentLogs.length > 0 ? errorLogs.length / agentLogs.length : 0;
    const tripped = errorRate > 0.15;
    
    return {
      tripped,
      errorRate: +(errorRate * 100).toFixed(1),
      totalActions: agentLogs.length,
      errors: errorLogs.length,
      recommendation: tripped 
        ? '⚠️ CIRCUIT BREAKER TRIPPED — Pausing all sub-agents. Review error logs and reset after investigation.'
        : '✅ Circuit OK — system operating within safe thresholds'
    };
  } catch (e) {
    return { tripped: false, errorRate: 0, error: e.message };
  }
}

/**
 * Sort proposals by Expected Value (highest first)
 */
export function sortByEV(proposals) {
  return proposals
    .map(p => ({
      ...p,
      ev: calculateExpectedValue(
        p.actionType || 'title',
        p.confidence || 50,
        1,
        {
          quotaUsed: p.context?.quotaUsed || 0,
          quotaMax: p.context?.quotaMax || 10000,
          recentSkipRate: p.context?.recentSkipRate || 0,
          historicalWinRate: p.context?.winRate || 0.5
        }
      )
    }))
    .sort((a, b) => b.ev.ev - a.ev.ev);
}

/**
 * Filter proposals — only keep those above EV threshold
 */
export function filterBelowThreshold(proposals, threshold = 0.5) {
  return proposals.filter(p => {
    const ev = calculateExpectedValue(
      p.actionType || 'title',
      p.confidence || 50,
      1
    );
    return ev.ev >= threshold;
  });
}
