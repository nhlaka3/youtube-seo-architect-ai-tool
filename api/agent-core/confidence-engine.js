// api/agent-core/confidence-engine.js — Continuous-learning powered confidence routing (continuous-learning-v2 skill)
// Self-improving: tracks per-niche, per-action success rates and adjusts confidence dynamically

export function calculateConfidence(actionType, historicalData, currentMetrics) {
  let score = 50;
  
  // Historical learning (strongest signal)
  if (historicalData?.winRate > 0.7) score += 20;
  else if (historicalData?.winRate > 0.5) score += 12;
  else if (historicalData?.winRate > 0.3) score += 5;
  else score -= 5; // poor track record
  
  // Recent performance (recency-weighted)
  if (historicalData?.recentSuccesses >= 5) score += 12;
  else if (historicalData?.recentSuccesses >= 2) score += 6;
  if (historicalData?.recentSkips >= 3) score -= 15;
  else if (historicalData?.recentSkips >= 1) score -= 8;
  
  // Current metrics
  if (currentMetrics?.seoScore < 50) score += 18; // very weak — high urgency
  else if (currentMetrics?.seoScore < 65) score += 10;
  if (currentMetrics?.videoAgeDays < 30) score += 8; // fresh video
  if (currentMetrics?.engagementRate < 1.5) score += 10; // needs help
  if (currentMetrics?.views > 500) score += 5; // high-impact potential
  
  // Sample size confidence — more data = more reliable
  if (historicalData?.sampleSize >= 20) score += 5;
  else if (historicalData?.sampleSize < 3) score -= 8; // not enough data
  
  return Math.max(0, Math.min(100, score));
}

export async function getHistoricalData(actionType, niche) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, and, desc } = await import('drizzle-orm');
    const rows = await dbService.db.select().from(s.agentLearning)
      .where(and(eq(s.agentLearning.actionType, actionType), eq(s.agentLearning.niche, niche || 'General')))
      .limit(1);
    if (rows.length) {
      const r = rows[0];
      return { 
        winRate: r.successRate || 0.5, 
        recentSkips: r.recentSkips || 0, 
        recentSuccesses: r.recentSuccesses || 0,
        sampleSize: r.sampleSize || 0,
        avgLift: r.avgLift || 0
      };
    }
  } catch (e) { /* table may not exist yet */ }
  return { winRate: 0.5, recentSkips: 0, recentSuccesses: 0, sampleSize: 0, avgLift: 0 };
}

// Record learning outcome after an action is applied/skipped (continuous-learning-v2)
export async function recordLearningOutcome(actionType, niche, wasSuccessful, liftValue = 0) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, and } = await import('drizzle-orm');
    
    const existing = await dbService.db.select().from(s.agentLearning)
      .where(and(eq(s.agentLearning.actionType, actionType), eq(s.agentLearning.niche, niche || 'General')))
      .limit(1);
    
    if (existing.length) {
      const e = existing[0];
      const newSample = (e.sampleSize || 0) + 1;
      const newRate = wasSuccessful 
        ? ((e.successRate || 0) * (e.sampleSize || 0) + 1) / newSample
        : ((e.successRate || 0) * (e.sampleSize || 0)) / newSample;
      const newLift = liftValue ? ((e.avgLift || 0) * (e.sampleSize || 0) + liftValue) / newSample : e.avgLift;
      
      await dbService.db.update(s.agentLearning).set({
        successRate: +newRate.toFixed(3),
        sampleSize: newSample,
        avgLift: +newLift.toFixed(2),
        recentSkips: wasSuccessful ? 0 : (e.recentSkips || 0) + 1,
        recentSuccesses: wasSuccessful ? (e.recentSuccesses || 0) + 1 : 0,
        lastUpdated: new Date()
      }).where(eq(s.agentLearning.id, e.id));
    } else {
      await dbService.db.insert(s.agentLearning).values({
        actionType, niche: niche || 'General',
        successRate: wasSuccessful ? 1 : 0,
        sampleSize: 1,
        avgLift: liftValue || 0,
        recentSkips: wasSuccessful ? 0 : 1,
        recentSuccesses: wasSuccessful ? 1 : 0
      });
    }
  } catch (e) { /* non-critical */ }
}
