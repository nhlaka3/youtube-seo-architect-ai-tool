// api/agent-core/retrospective.js — LAYER 4: Continuous Learning & Calibration
// Weekly calibration, dynamic threshold adjustment, exponential decay model
// Formula: effective_win = base_lift * e^(-λ * days_since)
// Integrates: phronesismind.txt Phase 4

/**
 * Run weekly retrospective — analyze predicted vs actual, adjust thresholds
 */
export async function runWeeklyRetrospective() {
  const report = {
    runAt: new Date().toISOString(),
    calibrations: [],
    thresholdAdjustments: {},
    decayResults: null,
    recommendations: []
  };

  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, gte } = await import('drizzle-orm');

    // ── STEP 1: Analyze calibration data (predicted vs actual) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    let calibrationData = [];
    try {
      calibrationData = await dbService.db.select()
        .from(s.agentCalibration)
        .where(gte(s.agentCalibration.updatedAt, sevenDaysAgo))
        .orderBy(desc(s.agentCalibration.updatedAt));
    } catch (e) { /* table may not exist */ }

    if (calibrationData.length > 0) {
      // Group by action type
      const byAction = {};
      for (const cal of calibrationData) {
        if (!byAction[cal.actionType]) byAction[cal.actionType] = [];
        byAction[cal.actionType].push(cal);
      }

      for (const [actionType, cals] of Object.entries(byAction)) {
        const avgPredicted = cals.reduce((s, c) => s + (c.predictedConf || 0), 0) / cals.length;
        const avgActual = cals.reduce((s, c) => s + (c.actualSuccess || 0), 0) / cals.length;
        const accuracy = avgPredicted > 0 ? avgActual / (avgPredicted / 100) : 0;
        
        // Determine if we're over-confident or under-confident
        const overConfident = avgPredicted > avgActual + 15;
        const underConfident = avgActual > avgPredicted + 15;
        
        report.calibrations.push({
          actionType,
          sampleSize: cals.length,
          avgPredicted: +avgPredicted.toFixed(1),
          avgActual: +avgActual.toFixed(1),
          accuracy: +(accuracy * 100).toFixed(1),
          overConfident,
          underConfident,
          adjustment: overConfident ? 'decrease_confidence_by_10' : underConfident ? 'increase_confidence_by_5' : 'maintain'
        });

        // Apply threshold adjustments
        if (overConfident) {
          report.thresholdAdjustments[actionType] = {
            previousThreshold: 50,
            newThreshold: 55,
            reason: `Over-confident: predicted ${avgPredicted.toFixed(0)}% but actual ${avgActual.toFixed(0)}%`
          };
          report.recommendations.push(
            `Decrease confidence estimates for ${actionType} by 10% — predicted higher than actual outcomes`
          );
        } else if (underConfident) {
          report.thresholdAdjustments[actionType] = {
            previousThreshold: 50,
            newThreshold: 48,
            reason: `Under-confident: actual outcomes ${avgActual.toFixed(0)}% exceeded predictions ${avgPredicted.toFixed(0)}%`
          };
          report.recommendations.push(
            `Slightly increase confidence for ${actionType} — agent is more accurate than it thinks`
          );
        }
      }

      // Global adjustment recommendation
      const globalAccuracy = calibrationData.reduce((s, c) => {
        const acc = c.predictedConf > 0 ? (c.actualSuccess || 0) / (c.predictedConf / 100) : 0;
        return s + acc;
      }, 0) / calibrationData.length;

      report.globalAccuracy = +(globalAccuracy * 100).toFixed(1);
      
      if (globalAccuracy > 1.2) {
        report.recommendations.push('Global: Agent is under-confident — increase base confidence by 5%');
      } else if (globalAccuracy < 0.8) {
        report.recommendations.push('Global: Agent is over-confident — decrease base confidence by 10%');
      }
    } else {
      report.calibrations.push({ note: 'No calibration data yet — need more actions to calibrate' });
    }

    // ── STEP 2: Apply exponential decay to keyword wins ──
    // Formula: effective_win = base_lift * e^(-λ * days_since)
    // λ = 0.05 (50% weight after ~14 days)
    try {
      await dbService.decayOldWins();
      
      // Query post-decay state
      const wins = await dbService.db.select()
        .from(s.keywordWins)
        .orderBy(desc(s.keywordWins.avgViewsLift))
        .limit(10);
      
      report.decayResults = {
        decayApplied: true,
        lambda: 0.05,
        topWinsAfterDecay: wins.map(w => ({
          keyword: w.keyword,
          viewsLift: +(w.avgViewsLift || 0).toFixed(2),
          ctrLift: +(w.avgCtrLift || 0).toFixed(2),
          lastSeen: w.lastUpdated
        }))
      };
    } catch (e) {
      report.decayResults = { error: e.message };
    }

    // ── STEP 3: Update agent_learning with retrospective insights ──
    if (calibrationData.length > 0) {
      try {
        const { recordLearningOutcome } = await import('./confidence-engine.js');
        for (const cal of report.calibrations.filter(c => c.actionType)) {
          const wasSuccessful = cal.accuracy > 70;
          await recordLearningOutcome(cal.actionType, 'General', wasSuccessful, cal.avgActual || 0);
        }
      } catch (e) { /* non-critical */ }
    }

    // ── STEP 4: Log retrospective summary ──
    try {
      await dbService.db.insert(s.agentActivityLogs).values({
        agentName: 'system',
        actionTaken: `RETROSPECTIVE:${JSON.stringify(report)}`,
        impactDescription: `Weekly calibration: ${report.calibrations.length} action types analyzed, ${Object.keys(report.thresholdAdjustments).length} thresholds adjusted`,
        status: 'success'
      });
    } catch (e) { /* non-critical */ }

  } catch (e) {
    report.error = e.message;
  }

  return report;
}

/**
 * Apply decay to a single keyword win
 * effective_win = base_lift * e^(-λ * days_since)
 * λ = 0.05 for standard 14-day half-life
 */
export function applyDecay(baseLift, daysSince, lambda = 0.05) {
  const effectiveWin = baseLift * Math.exp(-lambda * daysSince);
  return {
    originalLift: baseLift,
    daysSince,
    decayedLift: +effectiveWin.toFixed(4),
    retentionPercent: +((effectiveWin / baseLift) * 100).toFixed(1),
    halfLifeReached: effectiveWin < baseLift / 2
  };
}

/**
 * Batch apply decay to multiple keyword wins
 */
export function batchApplyDecay(wins, lambda = 0.05) {
  const now = new Date();
  return wins.map(w => {
    const daysSince = (now - new Date(w.lastSeen)) / 86400000;
    const decay = applyDecay(w.viewsLift || w.lift || 10, Math.max(0, daysSince), lambda);
    return {
      keyword: w.keyword,
      ...decay,
      isStale: decay.retentionPercent < 25
    };
  }).sort((a, b) => b.decayedLift - a.decayedLift);
}

/**
 * Calculate optimal lambda based on niche volatility
 * Higher lambda = faster decay (for fast-moving niches like gaming)
 * Lower lambda = slower decay (for evergreen niches like education)
 */
export function calculateNicheLambda(niche) {
  const nicheLambdas = {
    gaming: 0.08,              // Very fast decay — meta changes weekly
    entertainment_vlog: 0.07,  // Fast decay — trends are fleeting
    tech_coding: 0.06,         // Moderate — tech evolves monthly
    finance_business: 0.04,    // Slower — principles are durable
    religious_spiritual: 0.03, // Very slow — evergreen content
    science_education: 0.04,   // Slow — educational content is durable
  };

  return nicheLambdas[niche] || 0.05;
}

/**
 * Check if agent needs recalibration based on recent performance
 */
export function needsRecalibration(calibrationData, threshold = 15) {
  if (!calibrationData || calibrationData.length < 5) return false;
  
  const recentCals = calibrationData.slice(0, 10);
  const avgError = recentCals.reduce((s, c) => {
    const predicted = c.predictedConf || 50;
    const actual = (c.actualSuccess || 0) * 100;
    return s + Math.abs(predicted - actual);
  }, 0) / recentCals.length;
  
  return avgError > threshold;
}
