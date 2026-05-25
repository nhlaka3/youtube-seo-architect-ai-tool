// api/agent-core/goal-engine.js
// Goal lifecycle: set → plan → track → adapt
// Persisted to Neon Postgres `goals` table (replaces in-memory Map)

export async function setGoal({ channelId, type, target, deadline }) {
  const current = await getCurrentMetric(channelId, type);
  const goal = {
    channelId,
    type,
    target: parseInt(target),
    current,
    initialCurrent: current,
    deadline: deadline || null,
    status: 'active',
    phases: [],
    progress: {},
    updatedAt: new Date()
  };

  // Generate plan using existing planner
  try {
    const { generatePlan } = await import('./planner.js');
    const plan = await generatePlan(
      'goal_' + Date.now(),
      'Grow channel ' + type + ' to ' + target + (deadline ? ' by ' + deadline : ''),
      'channel-growth'
    );
    goal.phases = (plan.phases || []).map(p => ({
      ...p,
      status: 'pending',
      estimatedImpact: estimatePhaseImpact(p, type, parseInt(target))
    }));
  } catch(e) {
    goal.phases = getFallbackPhases(goal);
  }

  // Persist to DB
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.upsertGoal(channelId, goal);
  } catch(e) {
    console.error('[GoalEngine] DB persist failed:', e.message);
  }

  return goal;
}

function estimatePhaseImpact(phase, goalType, target) {
  const weights = { AUDIT: 0.1, OPTIMIZE: 0.4, GROWTH: 0.3, COMPOUND: 0.2 };
  const name = (phase.name || '').toUpperCase();
  const key = Object.keys(weights).find(k => name.includes(k));
  return '+' + Math.round(target * (key ? weights[key] : 0.2)) + ' ' + goalType;
}

function getFallbackPhases(goal) {
  return [
    { phase: 1, name: 'AUDIT', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.1) + ' ' + goal.type },
    { phase: 2, name: 'OPTIMIZE', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.4) + ' ' + goal.type },
    { phase: 3, name: 'GROWTH', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.3) + ' ' + goal.type },
    { phase: 4, name: 'COMPOUND', status: 'pending', estimatedImpact: '+' + Math.round(goal.target * 0.2) + ' ' + goal.type }
  ];
}

async function getCurrentMetric(channelId, type) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const users = await dbService.getAllUsers(100).catch(() => []);
    const user = users.find(u => u.channelId === channelId);
    if (!user) return 0;
    if (type === 'subscribers') return parseInt(user.subscriberCount) || 0;
    if (type === 'views') return parseInt(user.viewCount) || 0;
    if (type === 'watch_hours') return parseInt(user.watchHours) || 0;
    return 0;
  } catch(e) { return 0; }
}

export async function getGoalStatus(channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const goal = await dbService.getGoal(channelId);
    if (!goal || goal.status !== 'active') return null;

    // Update current metric
    const current = await getCurrentMetric(channelId, goal.type);

    // Calculate progress
    const created = new Date(goal.createdAt);
    const weeks = Math.max(0.1, (Date.now() - created.getTime()) / (7 * 86400000));
    const initial = goal.initialCurrent || 0;
    const weeklyRate = Math.round((current - initial) / weeks);

    const progress = {
      percent: goal.target > 0 ? Math.round((current / goal.target) * 100) : 0,
      remaining: Math.max(0, goal.target - current),
      weeklyRate
    };

    if (weeklyRate > 0 && progress.remaining > 0) {
      const weeksLeft = progress.remaining / weeklyRate;
      progress.eta = new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().split('T')[0];
    }

    // Persist updated current + progress
    try {
      await dbService.upsertGoal(channelId, { current, progress, updatedAt: new Date() });
    } catch(e) { /* non-critical */ }

    return { ...goal, current, progress };
  } catch(e) {
    console.error('[GoalEngine] getGoalStatus failed:', e.message);
    return null;
  }
}
