// api/agent-core/goal-engine.js
// Goal lifecycle: set → plan → track → adapt
import { goals } from '../../src/database/schema.js';

/**
 * Set a new goal. Deactivates any existing active goal.
 */
export async function setGoal({ channelId, type, target, deadline }) {
  const current = await getCurrentMetric(channelId, type);
  const goal = {
    id: 'goal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    channelId,
    type,
    target,
    current,
    initialCurrent: current,
    deadline: deadline || null,
    status: 'active',
    phases: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Deactivate existing goals
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.update(s.goals)
      .set({ status: 'completed', updatedAt: new Date().toISOString() })
      .where({ channelId, status: 'active' }).execute().catch(() => {});
    
    // Generate plan using existing planner
    const plan = await generateGoalPlan(goal);
    goal.phases = plan;
    
    await dbService.db.insert(goals).values(goal).execute().catch(() => {});
  } catch(e) {
    console.error('[Goal Engine] DB error:', e.message);
  }

  return goal;
}

/**
 * Generate a phased plan for the goal using the existing planner
 */
async function generateGoalPlan(goal) {
  try {
    const { generatePlan } = await import('./planner.js');
    const plan = await generatePlan(goal.id, 
      `Grow channel ${goal.type} to ${goal.target}` + (goal.deadline ? ` by ${goal.deadline}` : ''),
      'channel-growth');
    return (plan.phases || []).map(p => ({
      ...p,
      status: 'pending',
      estimatedImpact: estimatePhaseImpact(p, goal.type, goal.target)
    }));
  } catch(e) {
    // Fallback: basic phases if planner unavailable
    return [
      { phase: 1, name: 'AUDIT', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.1)} ${goal.type}` },
      { phase: 2, name: 'OPTIMIZE', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.4)} ${goal.type}` },
      { phase: 3, name: 'GROWTH', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.3)} ${goal.type}` },
      { phase: 4, name: 'COMPOUND', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.2)} ${goal.type}` }
    ];
  }
}

function estimatePhaseImpact(phase, goalType, target) {
  const weights = { AUDIT: 0.1, OPTIMIZE: 0.4, GROWTH: 0.3, COMPOUND: 0.2 };
  const name = (phase.name || '').toUpperCase();
  const matchedWeight = Object.keys(weights).find(k => name.includes(k));
  const weight = matchedWeight ? weights[matchedWeight] : 0.2;
  return `+${Math.round(target * weight)} ${goalType}`;
}

/**
 * Get current metric for a channel
 */
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

/**
 * Get current active goal + progress
 */
export async function getGoalStatus(channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const results = await dbService.db.select().from(s.goals)
      .where({ channelId, status: 'active' }).limit(1).execute().catch(() => []);
    
    if (!results || !results.length) return null;
    const goal = results[0];
    
    // Update current metric
    goal.current = await getCurrentMetric(channelId, goal.type);
    
    // Calculate progress
    const created = new Date(goal.createdAt);
    const weeks = Math.max(0.1, (Date.now() - created.getTime()) / (7 * 86400000));
    const initial = goal.initialCurrent || 0;
    const weeklyRate = Math.round((goal.current - initial) / weeks);
    
    goal.progress = {
      percent: goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0,
      remaining: Math.max(0, goal.target - goal.current),
      weeklyRate
    };
    
    if (weeklyRate > 0 && goal.progress.remaining > 0) {
      const weeksLeft = goal.progress.remaining / weeklyRate;
      goal.progress.eta = new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().split('T')[0];
    }
    
    return goal;
  } catch(e) {
    console.error('[Goal Engine] Status error:', e.message);
    return null;
  }
}
