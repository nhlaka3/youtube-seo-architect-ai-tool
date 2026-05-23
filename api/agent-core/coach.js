// api/agent-core/coach.js
// Proactive coach chat — agent initiates messages, user responds

const coachInbox = new Map();

export function addCoachMessage(channelId, message) {
  if (!coachInbox.has(channelId)) coachInbox.set(channelId, []);
  coachInbox.get(channelId).push({
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    ...message,
    timestamp: new Date().toISOString(),
    read: false
  });
}

export function getCoachInbox(channelId) {
  return coachInbox.get(channelId) || [];
}

export function markRead(channelId, messageId) {
  const msgs = coachInbox.get(channelId);
  if (!msgs) return;
  const msg = msgs.find(m => m.id === messageId);
  if (msg) msg.read = true;
}

export function clearInbox(channelId) {
  coachInbox.delete(channelId);
}

export function buildMessage({ type, title, body, goalImpact, actions }) {
  return { type, title, body, goalImpact, actions: actions || [] };
}

export function buildRankingAlert(video, goal) {
  return buildMessage({
    type: 'alert',
    title: `🚨 ${(video.title || '').substring(0, 40)}... dropped in ranking`,
    body: `Dropped from #${video.oldRank || '?'} to #${video.newRank || '?'} for "${video.keyword || 'unknown'}". Found ${(video.issues || []).length} issues.`,
    goalImpact: goal ? `Estimated impact: -${Math.round(video.estimatedSubscribers || 0)} ${goal.type}` : null,
    actions: [
      { label: 'Optimize Now', action: 'approve', proposalId: video.proposalId },
      { label: 'Show Details', action: 'details', videoId: video.videoId },
      { label: 'Dismiss', action: 'dismiss' }
    ]
  });
}

export function buildProgressSummary(goal) {
  if (!goal || !goal.progress) return null;
  return buildMessage({
    type: 'summary',
    title: '📊 Progress Report',
    body: `Goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress.percent || 0}%). This week: +${goal.progress.weeklyRate || 0}. ETA: ${goal.progress.eta || 'calculating...'}`,
    goalImpact: goal.progress.weeklyRate > 0
      ? `At this rate, goal reached by ${goal.progress.eta}`
      : 'Progress slower than projected.',
    actions: [
      { label: 'Adjust Goal', action: 'adjust_goal' },
      { label: 'Dismiss', action: 'dismiss' }
    ]
  });
}

export async function handleQuestion(channelId, question) {
  try {
    const { getGoalStatus } = await import('./goal-engine.js');
    const goal = await getGoalStatus(channelId);
    
    const q = question.toLowerCase();
    if (q.includes('progress') || q.includes('goal') || q.includes('status')) {
      if (!goal) return "No active goal set. Would you like to set one?";
      return `Your goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}%). Weekly rate: +${goal.progress?.weeklyRate || 0}. ETA: ${goal.progress?.eta || 'calculating...'}`;
    }
    if (q.includes('optimiz') || q.includes('fix') || q.includes('improve')) {
      return "I'll scan your channel for optimization opportunities. Run a scan from the Phronesis dashboard or wait for the next scheduled scan (every 6 hours).";
    }
    if (q.includes('recommend') || q.includes('suggest') || q.includes('what should')) {
      return "Based on your channel data, I recommend: 1) Check your latest videos' SEO scores, 2) Review tagging strategy, 3) Consider A/B testing thumbnails on underperforming videos. Want me to help with any of these?";
    }
    return "I'm your Phronesis coach. I can help with: tracking your goal progress, finding optimization opportunities, reviewing your channel metrics, and suggesting growth strategies. What would you like to know?";
  } catch(e) {
    return "I encountered an error processing your question. Please try again.";
  }
}
