// api/agent-core/coach.js
// Proactive coach chat — agent initiates messages, user responds

const coachInbox = new Map(); // channelId → system messages
const conversationHistory = new Map(); // channelId → [{role, content}, ...]
const MAX_HISTORY = 10;

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

    // Get agent context (recent activity, proposals, scans)
    const agentCtx = await getAgentContext(channelId);

    // Get or create conversation history
    if (!conversationHistory.has(channelId)) {
      conversationHistory.set(channelId, []);
    }
    const history = conversationHistory.get(channelId);

    // Add user question to history
    history.push({ role: 'user', content: question });

    // Build goal context
    let goalContext = '';
    if (goal) {
      goalContext = `The user has an active goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}% done). `;
      goalContext += `Weekly progress: +${goal.progress?.weeklyRate || 0}. `;
      if (goal.progress?.eta) goalContext += `ETA: ${goal.progress.eta}. `;
      if (goal.phases?.length) {
        var activePhase = goal.phases.find(function(p) { return p.status === 'active'; }) || goal.phases[0];
        goalContext += `Current phase: ${activePhase?.name || 'AUDIT'}.`;
      }
    }

    // Build conversation context from history
    var conversationContext = '';
    if (history.length > 1) {
      conversationContext = '\n\nPREVIOUS CONVERSATION:\n';
      var recentHistory = history.slice(-MAX_HISTORY);
      for (var i = 0; i < recentHistory.length; i++) {
        var h = recentHistory[i];
        conversationContext += (h.role === 'user' ? 'User' : 'Phronesis') + ': ' + h.content + '\n';
      }
    }

    var systemPrompt = `You are Phronesis, an AI YouTube SEO coach in YT SEO Architect.

Your role:
- Help creators grow their YouTube channels
- Give specific, actionable SEO and growth advice
- Track goal progress and suggest next steps
- Be concise but helpful (2-4 sentences)
- Reference previous conversation when relevant
- Use the goal and channel context provided

GOAL CONTEXT:
${goalContext || 'No active goal set.'}

AGENT CONTEXT (recent activity):
${agentCtx || 'No recent agent activity.'}
${conversationContext}

Respond conversationally. Reference earlier parts of the conversation if the user asks a follow-up. If the user asks about proposals, scans, or optimizations, use the AGENT CONTEXT above. Do NOT use markdown or emoji.`;

    var { askAI } = await import('../_lib/ai-provider.js');
    var answer = await askAI(systemPrompt, question);

    // Store assistant response in history
    if (answer && typeof answer === 'string') {
      var trimmed = answer.trim();
      history.push({ role: 'assistant', content: trimmed });
      // Trim history if too long
      if (history.length > MAX_HISTORY * 2) {
        history.splice(0, history.length - MAX_HISTORY * 2);
      }
      return trimmed;
    }

    var fallback = fallbackResponse(goal, question);
    history.push({ role: 'assistant', content: fallback });
    return fallback;
  } catch(e) {
    console.error('[Coach] AI error:', e.message);
    var fb = fallbackResponse(null, question);
    return fb;
  }
}

/**
 * Query recent Phronesis agent activity to give the coach real context
 */
async function getAgentContext(channelId) {
  try {
    var { default: dbService } = await import('../../src/database/services.js');
    var s = await import('../../src/database/schema.js');
    var logs = await dbService.db.select().from(s.agentActivityLogs)
      .where({ channelId })
      .orderBy(s.agentActivityLogs.createdAt, 'desc')
      .limit(20);

    if (!logs || !logs.length) return 'No recent agent activity.';

    var recent = logs.slice(0, 10);
    var summary = 'Recent Phronesis activity:\n';
    for (var i = 0; i < recent.length; i++) {
      var log = recent[i];
      var time = new Date(log.createdAt).toLocaleString();
      summary += '- [' + time + '] ' + log.agentName + ': ' + (log.actionTaken || '').substring(0, 150) + '\n';
    }
    return summary;
  } catch(e) {
    return 'Agent activity data unavailable.';
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
