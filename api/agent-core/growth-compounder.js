// api/agent-core/growth-compounder.js — Predictive growth modeling & milestone tracking
// Shows how small daily optimizations compound into exponential growth
// Tracks milestones (25%, 50%, 75%, 100%) and celebrates achievements

/**
 * Calculate the compounding effect of daily optimizations
 * Models: SEO improvements → higher CTR → more impressions → more views → more subs
 */
export function compoundGrowthModel(params) {
  const {
    currentSubs = 0,
    goalSubs = 1000,
    currentVideos = 10,
    weeklyOptimizations = 5,
    avgCTRLift = 0.12,       // 12% average CTR improvement per optimization
    currentAvgViews = 100,   // Average views per video
    subConversionRate = 0.02, // 2% of viewers subscribe
    algorithmicBoost = 0.15,  // 15% extra impressions from improved CTR
    weeks = 12
  } = params;

  const projections = [];
  let subs = currentSubs;
  let cumulativeViews = 0;
  let videosOptimized = 0;
  let totalOptimizations = 0;

  for (let w = 0; w < weeks; w++) {
    const optimizationsThisWeek = weeklyOptimizations;
    totalOptimizations += optimizationsThisWeek;
    videosOptimized = Math.min(currentVideos, videosOptimized + optimizationsThisWeek);
    
    // Each optimization improves CTR on one video
    // Higher CTR → YouTube algorithm recommends more → more impressions
    const baseViewsThisWeek = currentAvgViews * videosOptimized;
    const ctrBoost = 1 + (optimizationsThisWeek * avgCTRLift);
    const algoBoost = 1 + (algorithmicBoost * Math.min(1, w / 4)); // Ramps up over 4 weeks
    const totalViewsThisWeek = Math.round(baseViewsThisWeek * ctrBoost * algoBoost);
    
    cumulativeViews += totalViewsThisWeek;
    const newSubs = Math.round(totalViewsThisWeek * subConversionRate);
    subs += newSubs;

    projections.push({
      week: w + 1,
      subs: subs,
      newSubsThisWeek: newSubs,
      viewsThisWeek: totalViewsThisWeek,
      cumulativeViews,
      videosOptimized,
      totalOptimizations,
      ctrMultiplier: +(ctrBoost * algoBoost).toFixed(2),
      milestone: null
    });
  }

  // Mark milestones
  const milestones = [0.25, 0.5, 0.75, 1.0];
  const subsNeeded = goalSubs - currentSubs;
  
  for (const m of milestones) {
    const targetSubs = currentSubs + Math.round(subsNeeded * m);
    for (const p of projections) {
      if (p.subs >= targetSubs && !p.milestone) {
        p.milestone = Math.round(m * 100) + '%';
        break;
      }
    }
  }

  const finalSubs = projections[projections.length - 1]?.subs || currentSubs;
  const weeksToGoal = subsNeeded > 0 
    ? projections.findIndex(p => p.subs >= goalSubs) + 1 
    : 0;

  return {
    baseline: { subs: currentSubs, goalSubs, videos: currentVideos },
    projections,
    summary: {
      estimatedFinalSubs: finalSubs,
      totalGain: finalSubs - currentSubs,
      totalViewsGenerated: cumulativeViews,
      totalOptimizations,
      weeksToGoal: weeksToGoal > 0 ? weeksToGoal : null,
      goalAchievable: weeksToGoal > 0 && weeksToGoal <= weeks,
      compoundMultiplier: +(finalSubs / Math.max(1, currentSubs)).toFixed(2)
    },
    milestones: projections.filter(p => p.milestone).map(p => ({
      week: p.week,
      milestone: p.milestone,
      subsAtMilestone: p.subs
    }))
  };
}

/**
 * Generate milestone celebration message
 */
export function getMilestoneMessage(milestone, goalSubs, currentSubs) {
  const messages = {
    '25%': [
      `🎯 Quarter way to ${goalSubs} subscribers! Momentum is building.`,
      `⚡ 25% milestone hit! Your channel is gaining traction.`,
      `📈 ${currentSubs} subs — the compounding is starting. Keep going!`
    ],
    '50%': [
      `🏆 Halfway to ${goalSubs}! The strategy is working.`,
      `🔥 50% there! Every optimization compounds — you're seeing the results.`,
      `💪 ${currentSubs} subscribers — past the tipping point. Full speed ahead!`
    ],
    '75%': [
      `🚀 75% to ${goalSubs}! Almost at the finish line.`,
      `⭐ ${currentSubs} subs — the goal is in sight. Don't stop now.`,
      `🎪 Three quarters done! Your consistency is paying off massively.`
    ],
    '100%': [
      `🎉 GOAL ACHIEVED! ${goalSubs} subscribers! The Phronesis Agent delivered.`,
      `👑 ${goalSubs} SUBS! You did it. Time to set the next goal.`,
      `🏅 MISSION COMPLETE: ${goalSubs} subscribers. This is just the beginning.`
    ]
  };

  const options = messages[milestone] || [`Milestone: ${milestone} toward ${goalSubs}`];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Track milestone achievements in activity log
 */
export async function trackMilestone(channelId, milestone, goalSubs, currentSubs) {
  try {
    const message = getMilestoneMessage(milestone, goalSubs, currentSubs);
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `MILESTONE:${milestone}`,
      impactDescription: message,
      status: 'success'
    });
    return { milestone, message };
  } catch (e) { return null; }
}
