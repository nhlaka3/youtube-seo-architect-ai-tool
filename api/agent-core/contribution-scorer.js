// api/agent-core/contribution-scorer.js
// Scores every agent action by how much it contributes to the active goal

export function scoreAction(action, goal) {
  if (!goal) return { score: 0.5, reasoning: 'No active goal' };

  const base = scoreByType(action.type, goal.type);
  const urgency = calculateUrgency(goal);
  const volume = normalizeVolume(action.estimatedViews || 0);
  const score = Math.min(1.0, base * urgency * volume);

  return {
    score,
    reasoning: buildReasoning(action, goal, base, urgency),
    estimatedImpact: estimateImpact(action, goal)
  };
}

function scoreByType(actionType, goalType) {
  const matrix = {
    subscribers: {
      'title-fix': 0.7, 'tag-optimize': 0.5, 'description-update': 0.4,
      'thumbnail-redesign': 0.8, 'retention-fix': 0.6, 'bulk-update': 0.3,
      'competitor-analysis': 0.4, 'seo-audit': 0.5, 'trend-capitalize': 0.6
    },
    views: {
      'title-fix': 0.6, 'tag-optimize': 0.7, 'description-update': 0.5,
      'thumbnail-redesign': 0.9, 'retention-fix': 0.4, 'bulk-update': 0.3,
      'competitor-analysis': 0.5, 'seo-audit': 0.4, 'trend-capitalize': 0.8
    },
    watch_hours: {
      'title-fix': 0.5, 'tag-optimize': 0.4, 'description-update': 0.4,
      'thumbnail-redesign': 0.6, 'retention-fix': 0.9, 'bulk-update': 0.3,
      'competitor-analysis': 0.3, 'seo-audit': 0.4, 'trend-capitalize': 0.5
    }
  };
  return (matrix[goalType] && matrix[goalType][actionType]) || 0.3;
}

function calculateUrgency(goal) {
  if (!goal.deadline) return 1.0;
  const deadline = new Date(goal.deadline).getTime();
  const created = new Date(goal.createdAt).getTime();
  const now = Date.now();
  const total = deadline - created;
  if (total <= 0) return 1.0;
  const elapsed = now - created;
  const expected = elapsed / total;
  const actual = (goal.current || 0) / (goal.target || 1);
  if (actual < expected) return 1.0 + Math.min(2, (expected - actual) * 3);
  return 1.0;
}

function normalizeVolume(views) {
  return Math.min(1.0, Math.max(0.1, Math.log10(views + 1) / 6));
}

function estimateImpact(action, goal) {
  const base = { subscribers: 40, views: 500, watch_hours: 100 };
  return Math.round((base[goal.type] || 50) * scoreAction(action, goal).score);
}

function buildReasoning(action, goal, base, urgency) {
  const parts = [`${action.type} action`];
  if (urgency > 1.2) parts.push('urgent (behind schedule)');
  if (action.estimatedViews > 1000) parts.push(`affects ${action.estimatedViews}+ views`);
  parts.push(`~${estimateImpact(action, goal)} ${goal.type}`);
  return parts.join(', ') + '.';
}

export function prioritizeActions(actions, goal) {
  return actions
    .map(a => ({ ...a, contribution: scoreAction(a, goal) }))
    .sort((a, b) => b.contribution.score - a.contribution.score)
    .slice(0, 10);
}
