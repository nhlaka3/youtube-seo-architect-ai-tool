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

    var toolDefinitions = `AVAILABLE TOOLS — You MUST use one of these when the user's request matches. Return ONLY valid JSON: {"tool":"tool_name","args":{},"message":"brief confirmation message"}

1. goal_status — Check current goal progress. No args needed.
2. set_goal — Set a new goal. Args: type (subscribers/views/watch_hours), target (number), deadline (optional date string).
3. scan_channel — Scan channel for underperforming videos. Args: videoId (optional, to target one video).
4. get_inbox — Show pending optimization proposals. No args needed.
5. apply_fixes — Apply approved optimizations to YouTube. Args: autoApply (boolean, default true).
6. optimize_video — Optimize a specific video. Args: videoId (string) or title (string).
7. get_activity — Show recent agent activity. Args: limit (number, default 5).
8. chat — None of the above fits. Args: message (your conversational response).

RULES:
- If the user asks about their goal or progress → use goal_status
- If the user wants to scan, find issues, check for problems → use scan_channel
- If the user wants to see proposals, inbox, pending items → use get_inbox
- If the user wants to apply, push, or fix things → use apply_fixes
- If the user asks to optimize a specific video → use optimize_video
- If the user asks what's been happening, recent activity → use get_activity
- If the user wants to set a goal → use set_goal
- If none of the above clearly match → use chat with a helpful conversational response
- If the request is ambiguous, use chat and ask a clarifying question`;

    var systemPrompt = `You are Phronesis, an AI YouTube SEO coach in YT SEO Architect. You help creators grow their channels through SEO optimization and strategic guidance.

GOAL CONTEXT:
${goalContext || 'No active goal set.'}

AGENT CONTEXT (recent activity):
${agentCtx || 'No recent agent activity.'}
${conversationContext}

${toolDefinitions}

Return ONLY valid JSON. No markdown, no code blocks, no extra text. Just the JSON object.`;

    var { askAI } = await import('../_lib/ai-provider.js');
    var rawAnswer = await askAI(systemPrompt, question, { temperature: 0.3, maxTokens: 500, forceJson: true });

    // Parse the AI response
    var parsed;
    try {
      var cleaned = (rawAnswer || '').replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      // If JSON parsing fails, treat as chat
      parsed = { tool: 'chat', args: { message: rawAnswer || fallbackResponse(goal, question) } };
    }

    // Dispatch to tool executor
    var { executeTool } = await import('./tool-executor.js');
    var toolResult = await executeTool(parsed.tool || 'chat', parsed.args || {}, channelId);

    var finalAnswer;
    if (toolResult && toolResult.instant) {
      finalAnswer = toolResult.response;
    } else if (toolResult && !toolResult.instant) {
      finalAnswer = toolResult.message;
    } else {
      // Fallback: use the message from chat tool or raw response
      finalAnswer = (parsed.args && parsed.args.message) || parsed.message || rawAnswer || fallbackResponse(goal, question);
    }

    // Store assistant response in history
    if (finalAnswer && typeof finalAnswer === 'string') {
      var trimmed = finalAnswer.trim();
      var historyEntry = { role: 'assistant', content: trimmed };
      if (toolResult && toolResult.jobId) {
        historyEntry.jobId = toolResult.jobId;
      }
      history.push(historyEntry);
      if (history.length > MAX_HISTORY * 2) {
        history.splice(0, history.length - MAX_HISTORY * 2);
      }
      // Persist conversation to coach_memory (best-effort, fire-and-forget)
      persistConversationMemory(channelId, history).catch(function(){});
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

// ── Conversation Persistence (best-effort, fire-and-forget) ──
async function persistConversationMemory(channelId, history) {
  try {
    if (!history || history.length < 2) return;
    const { default: dbService } = await import('../../src/database/services.js');
    const lastMessages = history.slice(-6);
    const extracted = await extractKeyFacts(lastMessages);
    await dbService.upsertCoachMemory(channelId, {
      lastConversation: extracted.lastConversation || 'Coaching session',
      contentGoals: extracted.contentGoals || [],
      focusKeywords: extracted.focusKeywords || [],
      painPoints: extracted.painPoints || [],
      wins: extracted.wins || []
    });
  } catch(e) { /* best-effort — don't block chat on memory persistence */ }
}

async function extractKeyFacts(messages) {
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    var transcript = messages.map(function(m) {
      return (m.role === 'user' ? 'Creator' : 'Coach') + ': ' + m.content;
    }).join('\n');
    var raw = await askAI(
      'Extract key facts from this coaching conversation. Return ONLY valid JSON.',
      'Extract facts:\n\n' + transcript.substring(0, 2000) + '\n\nJSON: {"contentGoals":[],"focusKeywords":[],"painPoints":[],"wins":[],"lastConversation":"one sentence summary"}',
      { temperature: 0.3, maxTokens: 400, forceJson: true }
    );
    var cleaned = (raw || '{}').replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch(e) {
    return { lastConversation: 'Coaching session' };
  }
}
