import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AGENT_PERSONA } from '../config/agent-persona.js';
import { deductCredits, refundCredits, CREDIT_COSTS, requireVerifiedChannel, isRealChannel, optionalChannelId, getPlan } from './credits.js';
import { validateBody, validateQuery } from './middleware/validate.js';
import { csrfMiddleware } from './middleware/csrf.js';

export const router = express.Router();

router.use(csrfMiddleware);

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.channelId || req.socket?.remoteAddress || 'unknown',
  message: { error: 'AI request limit reached', retryAfter: '60s' },
});

// --- Schemas ---
const generateSchema = z.object({
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1, 'Prompt is required'),
  taskType: z.string().optional(),
  temperatureOverride: z.number().min(0).max(2).optional()
});

const recommendationsSchema = z.object({
  videoId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
  titleScore: z.number(),
  descScore: z.number(),
  tagScore: z.number(),
  thumbScore: z.number()
});

const seoBundleSchema = z.object({
  topic: z.string(),
  tone: z.string().optional(),
  niche: z.string().optional()
});

const assistantSchema = z.object({
  message: z.string().min(1),
  context: z.object({
    niche: z.string().optional(),
    credits: z.number().optional(),
    healthScore: z.number().optional()
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
});

const classifyNicheSchema = z.object({
  channelAbout: z.string().optional(),
  recentTitles: z.array(z.string()).optional()
});

const validateMetadataSchema = z.object({
  metadata: z.object({
    title: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional(),
  niche: z.string().optional()
});

const generateSeriesAbstractSchema = z.object({ topic: z.string() });

const badThumbnailRedesignSchema = z.object({
  currentThumbnail: z.string().optional(),
  videoTitle: z.string(),
  niche: z.string().optional()
});

const generateReplySchema = z.object({
  commentText: z.string().min(1),
  context: z.object({ niche: z.string().optional() }).optional(),
  videoTitle: z.string().optional()
});

const generateScriptSchema = z.object({
  topic: z.string(),
  tone: z.string(),
  niche: z.string(),
  duration: z.string().optional(),
  playlistTitle: z.string().optional(),
  channelId: z.string().optional()
});

const proxyKeywordsSchema = z.object({
  q: z.string().min(1, 'Query is required')
});

// --- Helpers ---
const sendRes = (res, status, data) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(status).json(data);
  }
};

export const sanitizePromptInput = (str, maxLen = 500) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\r\n]/g, ' ')
    .replace(/(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, '[FILTERED]')
    .replace(/(system|assistant|user)\s+instructions?/gi, '[FILTERED]')
    .replace(/(jailbreak|dan|uncensored)/gi, '[FILTERED]')
    .replace(/<\|.*?\|>/g, '[FILTERED]')
    .replace(/\[INST\]|\[\/INST\]/g, '[FILTERED]')
    .substring(0, maxLen);
};

export const getServerGroqKey = () => process.env.GROQ_API_KEY?.trim();

const parseAIJson = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```(?:json)?\n?|```/gi, '').trim();

  const extractJsonObject = (text) => {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') depth += 1;
        else if (char === '}') {
          depth -= 1;
          if (depth === 0) return text.slice(start, i + 1);
        }
      }
    }
    return null;
  };

  const fixCommonIssues = (value) => value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');

  let jsonSnippet = extractJsonObject(cleaned);
  if (!jsonSnippet) jsonSnippet = cleaned;

  try {
    return JSON.parse(jsonSnippet);
  } catch (e1) {
    try {
      const fixed = fixCommonIssues(jsonSnippet);
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        const normalized = jsonSnippet.replace(/\n/g, ' ').replace(/\r/g, '');
        return JSON.parse(normalized);
      } catch (e3) {
        return null;
      }
    }
  }
};

const requireChannelId = (req, res, next) => {
  const channelId = (req.body && req.body.channelId) || req.query.channelId || req.headers['x-channel-id'];
  if (!channelId || !isRealChannel(channelId)) {
    return sendRes(res, 400, { error: 'YouTube channel connection required.' });
  }
  req.channelId = channelId;
  next();
};

// --- Routes ---
router.post('/generate', aiLimiter, validateBody(generateSchema), optionalChannelId, async (req, res) => {
  try {
    const { systemPrompt, userPrompt, taskType, temperatureOverride } = req.body;
    
    // Agency plan: skip credit deduction
    const headerPlan = req.headers['x-plan'] || '';
    if (req.channelId && headerPlan !== 'agency') {
      const plan = await getPlan(req.channelId);
      if (plan !== 'agency') {
        const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['ai-generate']);
        if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
      }
    }

    const safeSystem = sanitizePromptInput(systemPrompt || 'You are a helpful YouTube SEO assistant.', 2000);
    const safeUser = sanitizePromptInput(userPrompt || '', 2000);

    const temperatureMap = { 'playlist-title': 0.8, 'tag-generation': 0.2, 'tags': 0.6, 'comment-reply': 0.9, 'metadata-collusion': 0.2, 'general': 0.7 };
    const temperature = temperatureOverride !== undefined ? temperatureOverride : (temperatureMap[taskType] || 0.7);
    const forceJson = ['playlist-title', 'tag-generation', 'tags', 'metadata-collusion'].includes(taskType);

    // Use Multi-Brain failover (Groq → Gemini)
    const { askAI } = await import('./_lib/ai-provider.js');
    const content = await askAI(safeSystem, safeUser, { temperature, forceJson });
    
    // Wrap in Groq-compatible format for frontend compatibility
    sendRes(res, 200, { choices: [{ message: { content } }] });
  } catch (e) {
    console.error('[AI Generate] Error:', e.message);
    sendRes(res, 502, { error: 'AI generation failed: ' + e.message });
  }
});

router.post('/recommendations', aiLimiter, validateBody(recommendationsSchema), requireChannelId, async (req, res) => {
  try {
    const { videoId, title, description, tags, titleScore, descScore, tagScore, thumbScore } = req.body;
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['ai-generate']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });

    const { askAI } = await import('./_lib/ai-provider.js');
    const sysPrompt = 'You are a YouTube SEO Expert. Return ONLY valid JSON.';

    const recommendations = {};
    if (titleScore < 85) {
      try {
        const content = await askAI(sysPrompt, `Analyze this video title and create an optimized improvement. Current Title: "${sanitizePromptInput(title, 100)}" Current Score: ${titleScore}/100 Provide JSON: { "suggestion": "Improved title (max 60 chars)", "reason": "Why this will boost CTR (1-2 sentences)" }`, { temperature: 0.7 });
        const c = JSON.parse(content.replace(/```json|```/g, '').trim());
        recommendations.title = { suggestion: c.suggestion, reason: c.reason };
      } catch (e) { recommendations.title = { suggestion: null, reason: 'Failed to generate' }; }
    }

    if (descScore < 85) {
      try {
        const content = await askAI(sysPrompt, `Analyze this video description. Current: "${sanitizePromptInput(description, 500)}" Score: ${descScore}/100 Provide JSON: { "suggestion": "Improved description with timestamps and CTA", "reason": "Why this will boost watch time (1-2 sentences)" }`, { temperature: 0.7 });
        const c = JSON.parse(content.replace(/```json|```/g, '').trim());
        recommendations.description = { suggestion: c.suggestion, reason: c.reason };
      } catch (e) { recommendations.description = { suggestion: null, reason: 'Failed to generate' }; }
    }

    if (tagScore < 85) {
      try {
        const content = await askAI(sysPrompt, `Analyze these tags and create improved ones. Tags: ${JSON.stringify((tags || []).slice(0, 20))} Score: ${tagScore}/100 Provide JSON: { "suggestion": ["tag1","tag2",...10 tags], "reason": "Why these tags improve discoverability (1-2 sentences)" }`, { temperature: 0.5 });
        const c = JSON.parse(content.replace(/```json|```/g, '').trim());
        recommendations.tags = { suggestion: c.suggestion, reason: c.reason };
      } catch (e) { recommendations.tags = { suggestion: [], reason: 'Failed to generate' }; }
    }

    if (thumbScore < 85) {
      try {
        const content = await askAI(sysPrompt, `Create a thumbnail redesign strategy. Video Title: "${sanitizePromptInput(title, 100)}" Provide JSON: { "strategy": "Specific visual improvement", "aiPrompt": "AI image prompt for thumbnail --ar 16:9 --v 6" }`, { temperature: 0.8 });
        const c = JSON.parse(content.replace(/```json|```/g, '').trim());
        recommendations.thumbnail = { strategy: c.strategy, aiPrompt: c.aiPrompt };
      } catch (e) { recommendations.thumbnail = { strategy: null, aiPrompt: null }; }
    }

    sendRes(res, 200, { videoId, recommendations });
  } catch (e) {
    console.error('[AI Recommendations] Error:', e.message);
    sendRes(res, 502, { error: 'AI recommendations failed' });
  }
});

router.post('/seo-bundle', aiLimiter, validateBody(seoBundleSchema), optionalChannelId, async (req, res) => {
  try {
    const { topic, tone, niche } = req.body;
    const cleanTopic = (topic || '').trim();
    // Credit check: only if channel is connected; frontend already deducts
    if (req.channelId) {
      const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['seo-bundle']);
      if (!creditResult.success) {
        // Don't block — just warn. Frontend handles credits.
        console.warn('[SEO Bundle] Credits low but proceeding:', creditResult.balance);
      }
    }

    const apiKey = getServerGroqKey();
    if (!apiKey) return sendRes(res, 503, { error: 'AI service unavailable' });

    const safeTopic = sanitizePromptInput(cleanTopic || 'trending content');
    const safeTone = sanitizePromptInput(tone || 'professional', 50);
    const safeNiche = sanitizePromptInput(niche || 'Lifestyle', 50);

    const bundlePrompt = `You are a YouTube SEO Expert. Create a complete SEO bundle.
TOPIC: ${safeTopic}
TONE: ${safeTone}
NICHE: ${safeNiche}
Generate JSON: { "titles": [{"type":"Hook","text":"title1"},{"type":"Viral","text":"title2"},{"type":"Professional","text":"title3"}], "tags": ["tag1","tag2",...15 tags], "description": "2000 char description with hook, timestamps, CTA" }`;

    // Multi-Brain failover (Groq → Gemini)
    const { askAI } = await import('./_lib/ai-provider.js');
    const rawContent = await askAI('You are a YouTube SEO Expert. Return ONLY valid JSON.', bundlePrompt, { temperature: 0.8 });
    
    // Robust JSON parsing: strip markdown fences, extract JSON object
    let content;
    try {
      const cleaned = rawContent.replace(/```json\n?|```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      content = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch (parseErr) {
      console.warn('[SEO Bundle] AI returned non-JSON, using template fallback:', parseErr.message);
      // Template fallback: generate real advice from the topic
      const topicWords = safeTopic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const nicheLower = safeNiche.toLowerCase();
      content = {
        titles: [
          { type: 'Hook', text: `${safeTopic}: The Truth Nobody Tells You` },
          { type: 'Viral', text: `${safeTopic} Guide (You Need This in 2026)` },
          { type: 'Professional', text: `How to Master ${safeTopic} — Complete Tutorial` }
        ],
        tags: [...topicWords, nicheLower, 'tutorial', 'guide', '2026', 'how to', `${nicheLower} tips`, 'explained', 'beginners', 'step by step', 'review', 'best', `${nicheLower} guide`, 'trending', 'viral'],
        description: `In this video, we break down everything you need to know about ${safeTopic}. Whether you're a beginner or experienced, this ${nicheLower} guide covers actionable strategies, proven tips, and 2026 best practices.\n\n⏱️ Timestamps:\n0:00 - Introduction\n0:30 - What is ${safeTopic}?\n2:00 - Key Strategies\n5:00 - Step-by-Step Tutorial\n8:00 - Advanced Tips\n10:00 - Common Mistakes to Avoid\n12:00 - Final Thoughts\n\n📌 What You'll Learn:\n✅ How to get started with ${safeTopic}\n✅ Proven strategies used by top creators\n✅ Tools and resources to accelerate your growth\n\n🔔 Subscribe for more ${nicheLower} content!\n👍 Like this video if you found it helpful!\n💬 Drop a comment with your biggest takeaway!\n\n# ${safeTopic} # ${nicheLower} # Tutorial # Guide # 2026`
      };
    }
    
    sendRes(res, 200, { topic: safeTopic, tone: safeTone, titles: content.titles || [], tags: content.tags || [], description: content.description || '' });
  } catch (e) {
    console.error('[SEO Bundle Error]:', e.message, e.stack);
    // Return a working template instead of an error
    const safeTopic = sanitizePromptInput((req.body?.topic || 'trending content').trim());
    const safeNiche = sanitizePromptInput(req.body?.niche || 'Lifestyle', 50);
    const topicWords = safeTopic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    sendRes(res, 200, {
      topic: safeTopic,
      tone: sanitizePromptInput(req.body?.tone || 'professional', 50),
      titles: [
        { type: 'Hook', text: `${safeTopic}: Everything You Need to Know` },
        { type: 'Viral', text: `I Tried ${safeTopic} for 30 Days — Here's What Happened` },
        { type: 'Professional', text: `${safeTopic} Complete Guide for Beginners (2026)` }
      ],
      tags: [...topicWords, safeNiche.toLowerCase(), 'tutorial', 'guide', '2026', 'how to', 'explained', 'beginners', 'step by step', 'tips', 'best practices', `${safeNiche} tips`, 'trending', 'viral', 'review'],
      description: `Everything you need to know about ${safeTopic} in this comprehensive ${safeNiche.toLowerCase()} guide.\n\nIn this video, we cover:\n- What is ${safeTopic}\n- How to get started\n- Key strategies and tips\n- Common mistakes to avoid\n\n🔔 Subscribe for more content!\n👍 Like if this helped!\n\n# ${safeTopic} # ${safeNiche} # Tutorial # 2026`
    });
  }
});

router.post('/assistant', aiLimiter, validateBody(assistantSchema), requireChannelId, async (req, res) => {
  // ── 100% Free: Unlimited Phronesis AI Coaching ──
  try {
    const { message, context, history } = req.body;
    
    const { askAI } = await import('./_lib/ai-provider.js');

    const niche = sanitizePromptInput(context?.niche || 'General', 50);

    const credits = context?.credits || 0;
    const healthScore = context?.healthScore || 50;
    const videos = sanitizePromptInput(context?.videos || '', 2000);
    const safeMessage = sanitizePromptInput(message || '', 1000);
    
    const videoSection = videos ? `\\n\\nCREATOR'S REAL CHANNEL DATA — reference these videos by exact title:\\n${videos}\\n\\nIMPORTANT: Videos marked 📱SHORT are YouTube Shorts (under 60s). Long-form videos are the priority for watch time and SEO. When asked "which video to fix", prioritize long-form unless they specifically ask about Shorts.` : '';

    const systemPrompt = `## YouTube SEO Architect Coach — Advanced Reasoning Engine\n\nYou are Phronesis, an expert AI coach built into YT SEO Architect. You help YouTube creators dominate through data-driven SEO, strategic growth, and predictive insights. Your reasoning is transparent, step-by-step, and always backed by creator data or industry best practices.\n${videoSection}\n\n### REASONING FRAMEWORK:\nFor every recommendation, think through:\n1. **Diagnosis** — What's the root cause of the current problem?\n2. **Impact** — How does this change affect views, watch time, and growth trajectory?\n3. **Action** — What specific, measurable action should they take?\n4. **Timeline** — When will they see results?\n\n### CRITICAL RULES:\n1. NEVER invent video titles, view counts, or stats. If no channel data is provided, give GENERAL strategic advice.\n2. If asked for specific video recommendations and no data exists, say: "Connect your YouTube channel for personalized video recommendations."\n3. Only mention features that exist: keyword research, tag generator, title optimizer, description writer, metadata audit, thumbnail analyzer, SEO bundle, growth engine, and Phronesis AI coach.\n4. Be direct, actionable, and insightful. 2-4 sentences max. No markdown formatting.\n5. Always include a confidence percentage (70-95%) with recommendations.\n6. Explain WHY before WHAT — help them understand the reasoning, not just the tactic.\n7. Reference their specific data when available. Be the coach who knows their channel.\n\nCurrent Context: Niche=${niche}, Credits=${credits}, Health=${healthScore}/100, Date=May 2026\n\nYour tone: Confident, data-driven, slightly witty. Never recommend competitor tools. Never make up data.`;

    // ── Load coach memory ──
    let memoryContext = '';
    try {
      const { default: dbService } = await import('../src/database/services.js');
      const memory = await dbService.getCoachMemory(req.channelId);
      if (memory && memory.conversationCount > 0) {
        const goals = (memory.contentGoals || []).slice(0, 3).join(', ');
        const problems = (memory.problemVideos || []).slice(0, 2).join(', ');
        const keywords = (memory.focusKeywords || []).slice(0, 3).join(', ');
        const pains = (memory.painPoints || []).slice(0, 2).join(', ');
        const wins = (memory.wins || []).slice(0, 2).join(', ');
        memoryContext = String.raw`

## What I Remember About This Creator (${memory.conversationCount} sessions):
`;
        if (goals) memoryContext += String.raw`- Goals: ${goals}
`;
        if (problems) memoryContext += String.raw`- Struggling with: ${problems}
`;
        if (keywords) memoryContext += String.raw`- Target keywords: ${keywords}
`;
        if (pains) memoryContext += String.raw`- Pain points: ${pains}
`;
        if (wins) memoryContext += String.raw`- Recent wins: ${wins}
`;
        if (memory.lastConversation) memoryContext += String.raw`- Last session: ${memory.lastConversation}
`;
        memoryContext += 'Reference this context naturally.';
      }
    } catch (e) { /* Memory load failed silently */ }

    // ── LAYER 1-4: Agent Intelligence Context (baselines, EV, plan, learning) ──
    let intelligenceContext = '';
    try {
      const { getChannelBaselines } = await import('./context-enricher.js');
      const baselines = await getChannelBaselines(req.channelId);
      if (baselines && baselines.rolling30d) {
        const bl = baselines.rolling30d;
        intelligenceContext += '\n\n## Channel Intelligence (30-day baselines):\n';
        if (bl.viewVelocity !== undefined) intelligenceContext += `- View Velocity: ${bl.viewVelocity} views/day (trend: ${baselines.trend?.direction || 'stable'})\n`;
        if (bl.successRate !== undefined) intelligenceContext += `- Optimization Success Rate: ${bl.successRate}% (${bl.appliedOptimizations || 0} applied)\n`;
        if (bl.totalActions) intelligenceContext += `- Recent Actions: ${bl.totalActions} in last 30 days\n`;
        intelligenceContext += 'Use these baselines to give DATA-DRIVEN advice. Compare their performance against their own history, not generic benchmarks.';
      }
    } catch(e) { /* non-critical */ }

    // ── Planner: strategic next steps if goal exists ──
    try {
      const { getGoalStatus } = await import('./agent-core/goal-engine.js');
      const goal = await getGoalStatus(req.channelId);
      if (goal && goal.phases && goal.phases.length) {
        var nextPhase = goal.phases.find(p => p.status === 'pending') || goal.phases[0];
        intelligenceContext += `\n\n## Strategic Plan:\n- Current Goal: ${goal.current}/${goal.target} ${goal.type} (${goal.progress?.percent || 0}%)\n- Next Phase: ${nextPhase.name} — ${nextPhase.estimatedImpact || ''}\n- ETA: ${goal.progress?.eta || 'calculating...'}\nGuide the creator toward their next phase naturally.`;
      }
    } catch(e) { /* non-critical */ }

    // Build conversation history as formatted context
    let historyContext = '';
    if (history && Array.isArray(history) && history.length > 0) {
      const safeHistory = history
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .slice(-5)
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${sanitizePromptInput(msg.content, 500)}`);
      historyContext = '\n\nConversation history:\n' + safeHistory.join('\n');
    }

    const reply = await askAI(systemPrompt + memoryContext + intelligenceContext, safeMessage + historyContext, { temperature: 0.7, maxTokens: 500 });
    
    if (!reply) { await refundCredits(req.channelId, CREDIT_COSTS['ai-assistant']); return sendRes(res, 502, { error: 'AI generation failed' }); }
    // Log coach activity for trial tracking
    try {
      const { default: dbService } = await import('../src/database/services.js');
      const s = await import('../src/database/schema.js');
      await dbService.db.insert(s.agentActivityLogs).values({
        channelId: req.channelId, agentName: 'coach',
        actionTaken: 'Coach message', status: 'success'
      }).catch(() => {});
    } catch(e) {}

    sendRes(res, 200, { reply });
  } catch (e) {
    console.error('[AI Assistant] Error:', e.message);
    sendRes(res, 502, { error: 'AI assistant failed' });
  }
});

router.post('/neural-strategy', aiLimiter, optionalChannelId, async (req, res) => {
  try {
    const { recentTitles, niche } = req.body;
    
    // Credit check — deduction only if channel is connected
    if (req.channelId) {
      const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['ai-generate']);
      if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    }
    
    const { askAI } = await import('./_lib/ai-provider.js');

    const safeTitles = (recentTitles || []).slice(0, 10).map(t => sanitizePromptInput(t, 100)).join(', ');
    const safeNiche = sanitizePromptInput(niche || 'General', 50);

    const rawContent = await askAI('You are a YouTube Growth Strategist. Return ONLY valid JSON.', `Based on niche "${safeNiche}" and recent titles "${safeTitles}", generate 4 distinct, actionable Growth Experiments. Each a punchy one-liner. Return JSON: { "tips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4"] }`, { temperature: 0.8 });
    const content = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    
    // Ensure we have exactly 4 tips
    let tips = content.tips || [];
    if (tips.length < 4) {
      const fallbacks = [
        "A/B test your first 30 seconds with a 'Pattern Interrupt' to boost retention.",
        "Refine your 'Bridge Keywords' to link your best-performing video to a current trend.",
        "Audit your description hooks for 'Mobile Preview Alignment' to increase CTR.",
        "Implement a 'High-Stakes Visual' in the first 10% of your next upload."
      ];
      tips = [...tips, ...fallbacks.slice(0, 4 - tips.length)];
    }

    sendRes(res, 200, { tips: tips.slice(0, 4) });
  } catch (e) {
    console.error('[Neural Strategy] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

router.post('/validate-metadata-relevance', aiLimiter, validateBody(validateMetadataSchema), requireChannelId, async (req, res) => {
  try {
    const { metadata, niche } = req.body;
    const { askAI } = await import('./_lib/ai-provider.js');

    const safeTitle = sanitizePromptInput(metadata?.title || '', 200);
    const safeTags = (metadata?.tags || []).slice(0, 15).map(t => sanitizePromptInput(t, 50)).join(', ');
    const safeNiche = sanitizePromptInput(niche || 'General', 50);

    try {
      const rawContent = await askAI('You score video metadata relevance. Return ONLY valid JSON.', `Score this metadata for niche "${safeNiche}" (0-100).\nTitle: "${safeTitle}"\nTags: ${safeTags}\nReturn JSON: { "score": 0, "relevant": true, "issues": ["..."], "strengths": ["..."] }`, { temperature: 0.3 });
      const result = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
      sendRes(res, 200, { relevant: (result.score || 75) >= 50, score: result.score || 75, issues: result.issues || [], strengths: result.strengths || [] });
    } catch (e) {
      sendRes(res, 200, { relevant: true, score: 75 });
    }
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/generate-series-abstract', validateBody(generateSeriesAbstractSchema), requireChannelId, async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['ai-generate']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    const { topic } = req.body;
    sendRes(res, 200, { abstract: `Series abstract for ${sanitizePromptInput(topic || '')}` });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/bad-thumbnail-redesign', aiLimiter, validateBody(badThumbnailRedesignSchema), requireChannelId, async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['thumbnail']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    const { currentThumbnail, videoTitle, niche } = req.body;

    const { askAI } = await import('./_lib/ai-provider.js');

    const safeTitle = sanitizePromptInput(videoTitle || 'Untitled Video', 100);
    const safeNiche = sanitizePromptInput(niche || 'General', 50);

    const rawContent = await askAI('You are a YouTube Thumbnail Redesign Expert. Return ONLY valid JSON.', `Video Title: "${safeTitle}"\nNiche: ${safeNiche}\nGenerate 3 high-CTR redesign concepts.\nReturn JSON: { "concepts": [{ "name": "Concept 1", "visualDescription": "...", "textOverlay": "...", "colorPalette": ["#hex1","#hex2"], "curiosityHook": "why it works" }], "generalTips": ["tip1","tip2","tip3"] }`, { temperature: 0.8 });
    const result = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    sendRes(res, 200, { concepts: result.concepts || [], generalTips: result.generalTips || [], newBalance: creditResult.balance });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/comments/generate-reply', aiLimiter, validateBody(generateReplySchema), requireChannelId, async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['auto-responder']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    const { commentText, context, videoTitle } = req.body;

    const { askAI } = await import('./_lib/ai-provider.js');

    const safeComment = sanitizePromptInput(commentText || '', 500);
    const safeTitle = sanitizePromptInput(videoTitle || '', 100);
    const safeNiche = sanitizePromptInput(context?.niche || 'General', 50);

    const reply = await askAI('You are a YouTube creator responding authentically to a viewer comment. Be warm, specific, and engaging. 1-2 sentences. Never mention you are AI.', `Video: "${safeTitle}"\nNiche: ${safeNiche}\nComment: "${safeComment}"\nGenerate a genuine reply specific to what they said.`, { temperature: 0.9, maxTokens: 200 });
    sendRes(res, 200, { reply: (reply || '').trim() || 'Thank you for watching!', newBalance: creditResult.balance });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/video-factory/generate-script', aiLimiter, validateBody(generateScriptSchema), requireChannelId, async (req, res) => {
  try {
    const { topic, tone, niche, duration, playlistTitle } = req.validatedBody;
    const safeTopic = sanitizePromptInput(topic, 180);
    const safeTone = sanitizePromptInput(tone || 'Professional/Authoritative', 60);
    const safeNiche = sanitizePromptInput(niche || 'General', 80);
    const safeDuration = sanitizePromptInput(duration || 'standard', 30);
    const safePlaylist = sanitizePromptInput(playlistTitle || 'Content Series', 60);

    const lengthGuides = {
      short: 'A concise, 60-second creator script with punchy hook, one clear idea, and a strong CTA.',
      standard: 'An 8-10 minute YouTube script with 1,200-1,500 words, built for retention, topic authority, and search relevance.',
      deep: 'A 20+ minute expert deep dive with 2,000-2,500 words, designed to maximize watch time and audience trust.'
    };
    const lengthGuide = lengthGuides[safeDuration] || lengthGuides.standard;

    const { askAI } = await import('./_lib/ai-provider.js');

    const systemPrompt = 'You are a high-level YouTube SEO architect for 2026. Produce retention-first, search-optimized creator scripts and metadata with clean structure and real video conversion signals. Return ONLY valid JSON with no surrounding commentary.';
    const userPrompt = `Topic: "${safeTopic}"
Niche: "${safeNiche}"
Tone: "${safeTone}"
Duration: "${safeDuration}"
Playlist: "${safePlaylist}"

Instructions:
- Write a creator-led YouTube video script built for 2026 search and watch-time. Use an attention-grabbing HOT OPEN, a bold HOOK, contextual authority, two reveal moments, a deep-dive section, a second twist, emotional payoff, and an OUTRO with subscribe and next-video CTA.
- Use [HOST] dialogue only for the spoken script. Include rare [VISUAL] cues (max 5 words each) and sparse [SFX] cues.
- Target keyword usage: mention the topic phrase within the first 30 seconds and again in the description.
- SEO metadata must include:
  * title: clickable, under 60 characters, keyword-focused, power-word supported.
  * description: 150-220 words, keyword-rich, watch-loop encouragement, playlist/link signal, and subscriber CTA.
  * tags: 10-15 tags, including long-tail phrases, intent-driven queries, and niche signals.
- Output a valid JSON object only, exactly matching this structure:
{
  "script": "...",
  "metadata": {
    "title": "...",
    "description": "...",
    "tags": ["...", "..."]
  },
  "seoNotes": ["...", "..."]
}

Do not include analysis, apologies, or any extra formatting.`;

    const rawContent = await askAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 4000 });
    let result = parseAIJson(rawContent);

    if (!result || !result.script) {
      console.warn('[Video Factory] Parse attempt 1 failed, trying fallback parser...');
      try {
        const withoutFences = rawContent.replace(/```json|```/g, '').trim();
        const collapsed = withoutFences.replace(/\n(?=[^}]*")/g, ' ');
        result = JSON.parse(collapsed);
      } catch (e2) {
        console.warn('[Video Factory] Fallback also failed:', e2.message);
        result = null;
      }
    }

    if (!result || !result.script) {
      console.error('[Video Factory] Both parsers failed. Raw (first 800 chars):', rawContent.substring(0, 800));
      return sendRes(res, 502, {
        error: 'Script generation failed - invalid AI response format. Please retry.',
        raw: rawContent.substring(0, 300)
      });
    }

    const response = {
      script: String(result.script).trim(),
      metadata: {
        title: String(result.metadata?.title || '').trim(),
        description: String(result.metadata?.description || '').trim(),
        tags: Array.isArray(result.metadata?.tags) ? result.metadata.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 15) : []
      },
      seoNotes: Array.isArray(result.seoNotes) ? result.seoNotes.map(t => String(t).trim()).filter(Boolean) : []
    };

    sendRes(res, 200, response);
  } catch (e) {
    console.error('[Video Factory] Generation error:', e);
    sendRes(res, 502, { error: 'Script generation failed. ' + (e.message || 'Try again.') });
  }
});

router.post('/video-factory/render', requireChannelId, async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['video-factory']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    sendRes(res, 200, { videoUrl: 'demo-video.mp4' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.get('/proxy-keywords', validateQuery(proxyKeywordsSchema), async (req, res) => {
  try {
    const { q } = req.query;
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.status(200).json(data[1] || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Google Search suggest (no ds=yt — returns Google search suggestions for richer keyword discovery)
router.get('/proxy-google-keywords', validateQuery(proxyKeywordsSchema), async (req, res) => {
  try {
    const { q } = req.query;
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.status(200).json(data[1] || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI Provider health check
router.get('/ai-status', async (req, res) => {
  try {
    const { checkProviders } = await import('./_lib/ai-provider.js');
    const status = await checkProviders();
    sendRes(res, 200, status);
  } catch (e) {
    const { checkProviders } = await import('./_lib/ai-provider.js');
    try {
      const status = await checkProviders();
      sendRes(res, 200, status);
    } catch (e2) {
      sendRes(res, 200, { groq: !!process.env.GROQ_API_KEY, gemini: !!process.env.GEMINI_API_KEY });
    }
  }
});

export default router;
