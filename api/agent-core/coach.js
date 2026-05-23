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

    // Build context for the AI
    let context = '';
    if (goal) {
      context = `The user has an active goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}% complete). `;
      context += `Weekly progress: +${goal.progress?.weeklyRate || 0}. `;
      if (goal.progress?.eta) context += `ETA: ${goal.progress.eta}. `;
      if (goal.phases?.length) {
        const activePhase = goal.phases.find(p => p.status === 'active') || goal.phases[0];
        context += `Current phase: ${activePhase?.name || 'AUDIT'}. `;
      }
    } else {
      context = 'The user has not set a channel growth goal yet.';
    }

    const systemPrompt = `You are Phronesis, an AI YouTube SEO coach embedded in YT SEO Architect.

Your role:
- Help creators grow their YouTube channels
- Give specific, actionable SEO advice
- Track goal progress and suggest next steps
- Be concise (2-4 sentences max per response)
- Use channel data and goal context when available

${context}

Respond conversationally. If the user asks about progress, give specific numbers. If they ask for advice, give 1-2 actionable tips. Do NOT use markdown formatting.`;

    // Import and call the AI provider
    const { askAI } = await import('../_lib/ai-provider.js');
    const answer = await askAI(systemPrompt, question);

    if (answer && typeof answer === 'string') return answer.trim();
    return fallbackResponse(goal, question);
  } catch(e) {
    console.error('[Coach] AI error:', e.message);
    return fallbackResponse(null, question);
  }
}

function fallbackResponse(goal, question) {
  const q = (question || '').toLowerCase();
  if (goal) {
    if (q.includes('progress') || q.includes('goal') || q.includes('status')) {
      return `Your goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}%). Weekly rate: +${goal.progress?.weeklyRate || 0}.${goal.progress?.eta ? ` ETA: ${goal.progress.eta}.` : ''}`;
    }
  }
  if (q.includes('optimiz') || q.includes('fix') || q.includes('improve')) {
    return 'I recommend: 1) Check your latest videos SEO scores, 2) Review tags for missing keywords, 3) A/B test thumbnails on low-CTR videos. Want me to run a full scan?';
  }
  if (q.includes('recommend') || q.includes('suggest')) {
    return 'Based on general best practices: focus on title optimization first (biggest CTR impact), then tags, then descriptions. Consistency matters more than perfection.';
  }
  return 'I am your Phronesis coach. Ask me about your channel progress, optimization tips, or growth strategies. What would you like to know?';
}
