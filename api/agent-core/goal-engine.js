// api/agent-core/goal-engine.js
// Goal lifecycle: set → plan → track → adapt
// Uses in-memory storage (Map) — DB migration TBD

const goalStore = new Map(); // channelId → goal

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

  // Generate plan using existing planner
  try {
    const plan = await generateGoalPlan(goal);
    goal.phases = plan;
  } catch(e) {
    goal.phases = getFallbackPhases(goal);
  }

  // Deactivate old goal, store new one
  goalStore.set(channelId, goal);
  return goal;
}

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
  } catch(e) { return getFallbackPhases(goal); }
}

function getFallbackPhases(goal) {
  return [
    { phase: 1, name: 'AUDIT', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.1)} ${goal.type}` },
    { phase: 2, name: 'OPTIMIZE', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.4)} ${goal.type}` },
    { phase: 3, name: 'GROWTH', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.3)} ${goal.type}` },
    { phase: 4, name: 'COMPOUND', status: 'pending', estimatedImpact: `+${Math.round(goal.target * 0.2)} ${goal.type}` }
  ];
}

function estimatePhaseImpact(phase, goalType, target) {
  const weights = { AUDIT: 0.1, OPTIMIZE: 0.4, GROWTH: 0.3, COMPOUND: 0.2 };
  const name = (phase.name || '').toUpperCase();
  const key = Object.keys(weights).find(k => name.includes(k));
  return `+${Math.round(target * (key ? weights[key] : 0.2))} ${goalType}`;
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
  const goal = goalStore.get(channelId);
  if (!goal || goal.status !== 'active') return null;

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
}
