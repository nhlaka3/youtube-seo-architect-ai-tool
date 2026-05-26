// api/context-enricher.js — LAYER 1: Context Enrichment (Better Inputs)
// Upgrades inputs from static snapshots to dynamic historical baselines
// 30-day rolling averages for CTR, Retention, View Velocity + trend velocity tracking
// Integrates: phronesismind.txt Phase 1

/**
 * Get 30-day rolling channel baselines for dynamic comparison
 * Returns CTR, retention, view velocity, and engagement norms
 */
export async function getChannelBaselines(channelId) {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { sql, gte, eq, and } = await import('drizzle-orm');
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    
    // Query optimization trials for rolling averages (THIS CHANNEL ONLY)
    let trials = [];
    try {
      trials = await dbService.db.select({
        ctr: s.optimizationQueue.scoreAfter,
        appliedAt: s.optimizationQueue.createdAt,
        status: s.optimizationQueue.status,
        actionType: s.optimizationQueue.actionType
      }).from(s.optimizationQueue)
        .where(and(gte(s.optimizationQueue.createdAt, thirtyDaysAgo), eq(s.optimizationQueue.channelId, channelId)));
    } catch (e) { /* table may not exist */ }

    // Query agent activity for engagement data (THIS CHANNEL ONLY)
    let activities = [];
    try {
      activities = await dbService.db.select()
        .from(s.agentActivityLogs)
        .where(and(gte(s.agentActivityLogs.createdAt, thirtyDaysAgo), eq(s.agentActivityLogs.channelId, channelId)));
    } catch (e) { /* fallback */ }

    // Calculate rolling averages
    const appliedTrials = trials.filter(t => t.status === 'applied' || t.status === 'approved');
    const avgCTR = appliedTrials.length 
      ? +(appliedTrials.reduce((sum, t) => sum + (t.ctr || 0), 0) / appliedTrials.length).toFixed(1) 
      : null;
    
    // View velocity — actions per day over 30 days
    const daysWithData = new Set(activities.map(a => {
      const d = new Date(a.createdAt);
      return d.toISOString().split('T')[0];
    })).size || 1;
    const viewVelocity = +(activities.length / daysWithData).toFixed(1);
    
    // Success rate
    const successes = activities.filter(a => a.status === 'success').length;
    const successRate = activities.length 
      ? +(successes / activities.length * 100).toFixed(1) 
      : null;
    
    // Recent trend — last 7 days vs previous 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    
    const recentActivities = activities.filter(a => new Date(a.createdAt) >= sevenDaysAgo).length;
    const prevActivities = activities.filter(a => {
      const d = new Date(a.createdAt);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;
    
    const trendDirection = prevActivities > 0 
      ? recentActivities > prevActivities ? 'up' : recentActivities < prevActivities ? 'down' : 'stable'
      : 'new';
    const trendDelta = prevActivities > 0 
      ? +(((recentActivities - prevActivities) / prevActivities) * 100).toFixed(1)
      : 0;
    
    // Attempt to get actual subscriber baseline from stored snapshots
    let subsBaseline = null;
    const snapshotLogs = activities.filter(a => a.actionTaken?.startsWith('SNAPSHOT:'));
    if (snapshotLogs.length > 0) {
      try {
        const latest = JSON.parse(snapshotLogs[0].actionTaken.replace('SNAPSHOT:', ''));
        subsBaseline = {
          videoCount: latest.videoCount,
          avgEngagement: latest.avgEngagement,
          avgViews: latest.avgViews,
          capturedAt: latest.timestamp
        };
      } catch (e) { /* parse error */ }
    }

    return {
      channelId,
      rolling30d: {
        avgCTR,
        viewVelocity,
        successRate,
        totalActions: activities.length,
        appliedOptimizations: appliedTrials.length
      },
      trend: {
        direction: trendDirection,
        weekOverWeekDelta: trendDelta,
        recent7d: recentActivities,
        previous7d: prevActivities
      },
      subsBaseline,
      calculatedAt: new Date().toISOString()
    };
  } catch (e) {
    console.error('[CONTEXT] Baseline fetch failed:', e.message);
    return { channelId, error: e.message, rolling30d: {}, trend: { direction: 'unknown' } };
  }
}

/**
 * Calculate trend velocity for a topic/keyword
 * Measures growth rate (delta) instead of just volume
 * Formula: (current_traffic - prev_traffic) / prev_traffic
 */
export function calculateTrendVelocity(topic, currentTraffic, previousTraffic) {
  if (!previousTraffic || previousTraffic === 0) {
    return {
      topic,
      velocity: currentTraffic > 0 ? 100 : 0,
      direction: currentTraffic > 0 ? 'emerging' : 'dormant',
      absoluteGrowth: currentTraffic,
      recommendation: currentTraffic > 0 
        ? 'New topic — monitor for 48h before committing resources'
        : 'No detectable traffic'
    };
  }

  const velocity = ((currentTraffic - previousTraffic) / previousTraffic) * 100;
  const absoluteGrowth = currentTraffic - previousTraffic;

  let direction, urgency;
  if (velocity >= 50) {
    direction = 'surging';
    urgency = 'high — act within 24h';
  } else if (velocity >= 20) {
    direction = 'rising';
    urgency = 'medium — act within 72h';
  } else if (velocity >= 5) {
    direction = 'growing';
    urgency = 'low — add to content calendar';
  } else if (velocity >= -5) {
    direction = 'stable';
    urgency = 'maintain — no urgent action';
  } else if (velocity >= -20) {
    direction = 'declining';
    urgency = 'caution — avoid heavy investment';
  } else {
    direction = 'crashing';
    urgency = 'avoid — topic is fading';
  }

  // Calculate half-life: how many days until volume doubles/halves
  const halfLife = velocity !== 0 
    ? Math.abs(Math.round(Math.log(2) / Math.log(1 + Math.abs(velocity) / 100) * 7))
    : Infinity;

  return {
    topic,
    velocity: +velocity.toFixed(1),
    direction,
    absoluteGrowth,
    halfLifeDays: halfLife === Infinity ? null : halfLife,
    urgency,
    recommendation: direction === 'surging' 
      ? `⚡ Topic surging ${velocity.toFixed(0)}% — strike now for maximum exposure`
      : direction === 'declining' || direction === 'crashing'
        ? `📉 Topic fading — deprioritize, focus on rising alternatives`
        : `${direction.charAt(0).toUpperCase() + direction.slice(1)} — ${urgency}`
  };
}

/**
 * Batch calculate trend velocities for multiple topics
 */
export function batchTrendVelocity(topics) {
  return topics.map(t => 
    calculateTrendVelocity(t.topic, t.currentTraffic || 0, t.previousTraffic || 0)
  ).sort((a, b) => b.velocity - a.velocity); // Fastest growing first
}

/**
 * Generate niche context for scan enrichment
 * Returns day-of-week patterns, seasonal insights, and content-type performance
 */
export function getNicheContext(niche, dayOfWeek) {
  const contexts = {
    gaming: {
      peakDays: ['Friday', 'Saturday', 'Sunday'],
      contentTypePerformance: { liveStreams: 1.5, highlights: 1.2, tutorials: 0.9 },
      seasonalSpikes: ['November', 'December'],
      audienceBehavior: 'Evenings 6PM-11PM — younger demographic',
      strategy: 'Publish Friday evening for weekend binge-watching'
    },
    religious_spiritual: {
      peakDays: ['Sunday', 'Wednesday'],
      contentTypePerformance: { sermons: 1.3, devotionals: 1.4, music: 1.1 },
      seasonalSpikes: ['December', 'April'],
      audienceBehavior: 'Sunday mornings and evenings — reflective content',
      strategy: 'Publish Saturday night for Sunday morning consumption'
    },
    tech_coding: {
      peakDays: ['Monday', 'Tuesday', 'Wednesday'],
      contentTypePerformance: { tutorials: 1.5, reviews: 1.1, news: 1.3 },
      seasonalSpikes: ['January', 'September'],
      audienceBehavior: 'Weekday lunch breaks and evenings',
      strategy: 'Publish Monday morning for weekday learning'
    },
    entertainment_vlog: {
      peakDays: ['Friday', 'Saturday', 'Sunday'],
      contentTypePerformance: { vlogs: 1.2, challenges: 1.4, reactions: 1.3 },
      seasonalSpikes: ['June', 'July', 'December'],
      audienceBehavior: 'Evenings and weekends — casual browsing',
      strategy: 'Publish Thursday evening to capture weekend traffic'
    },
    finance_business: {
      peakDays: ['Monday', 'Tuesday', 'Thursday'],
      contentTypePerformance: { analysis: 1.4, news: 1.3, tutorials: 1.1 },
      seasonalSpikes: ['January', 'April', 'October'],
      audienceBehavior: 'Weekday mornings 7AM-9AM — pre-market',
      strategy: 'Publish Sunday night for Monday morning consumption'
    },
    science_education: {
      peakDays: ['Monday', 'Wednesday', 'Friday'],
      contentTypePerformance: { explainers: 1.4, experiments: 1.3, documentaries: 1.0 },
      seasonalSpikes: ['September', 'January'],
      audienceBehavior: 'Afternoons and evenings — curiosity-driven',
      strategy: 'Publish weekdays for consistent educational traffic'
    }
  };

  const context = contexts[niche] || {
    peakDays: ['Monday', 'Wednesday', 'Friday'],
    contentTypePerformance: { default: 1.0 },
    seasonalSpikes: [],
    audienceBehavior: 'General — spread across week',
    strategy: 'Publish mid-week for broad reach'
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[dayOfWeek];
  const isPeakDay = context.peakDays.includes(today);
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const isPeakSeason = context.seasonalSpikes.includes(currentMonth);

  return {
    niche,
    ...context,
    today,
    isPeakDay,
    isPeakSeason,
    publishingAdvice: isPeakDay 
      ? `✅ Today (${today}) is a peak day for ${niche.replace(/_/g, ' ')} — maximize visibility`
      : `📅 Today is not a peak day. Best days: ${context.peakDays.join(', ')}`,
    seasonalAdvice: isPeakSeason
      ? `🔥 ${currentMonth} is peak season — increase publishing frequency`
      : `📆 Standard season — maintain consistent schedule`
  };
}
