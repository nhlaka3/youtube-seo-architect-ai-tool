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
  validate: { ipv6SubnetOrKeyGenerator: false },
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
  niche: z.string()
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
    const cleanTopic = (topic || '').replace(/\s[A-Za-z0-9]$/, '');
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
    const content = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    sendRes(res, 200, { topic: safeTopic, tone: safeTone, titles: content.titles || [], tags: content.tags || [], description: content.description || '' });
  } catch (e) {
    console.error('[SEO Bundle Error]:', e.message);
    sendRes(res, 502, { error: 'Failed to generate SEO bundle' });
  }
});

router.post('/assistant', aiLimiter, validateBody(assistantSchema), requireChannelId, async (req, res) => {
  // ── Admin gate: Ask Phronesis is in testing ──
  const headerPlan = req.headers['x-plan'] || '';
  const adminIds = ['UC-vVYFQC_MNjVP03YRZ56Wg', 'UCmcNApL2w7kk7NG14tXinRg'];
  if (!adminIds.includes(req.channelId)) {
    const plan = await getPlan(req.channelId);
    if (plan !== 'agency' && plan !== 'pro') return sendRes(res, 403, { error: 'Ask Phronesis is available on Pro and Agency plans. Upgrade to access.' });
  }

  try {
    const { message, context, history } = req.body;
    
    // Agency plan bypass
    const headerPlan = req.headers['x-plan'] || '';
    if (headerPlan !== 'agency') {
      const plan = await getPlan(req.channelId);
      if (plan !== 'agency') {
        const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['ai-assistant']);
        if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
      }
    }

    const { askAI } = await import('./_lib/ai-provider.js');

    const niche = sanitizePromptInput(context?.niche || 'General', 50);
    const credits = context?.credits || 0;
    const healthScore = context?.healthScore || 50;
    const videos = sanitizePromptInput(context?.videos || '', 2000);
    const safeMessage = sanitizePromptInput(message || '', 1000);
    
    const videoSection = videos ? `\\n\\nCREATOR'S REAL CHANNEL DATA — reference these videos by exact title:\\n${videos}\\n\\nIMPORTANT: Videos marked 📱SHORT are YouTube Shorts (under 60s). Long-form videos are the priority for watch time and SEO. When asked "which video to fix", prioritize long-form unless they specifically ask about Shorts.` : '';

    const systemPrompt = `## YouTube SEO Architect Coach\n\nYou are an AI coach built into YT SEO Architect (not vidIQ or TubeBuddy — never mention competitors). You help YouTube creators optimize their channels with SEO and growth strategies.\n${videoSection}\n\nCRITICAL RULES:\n1. NEVER invent video titles, view counts, or stats. If no channel data is provided, give GENERAL strategic advice.\n2. If asked for specific video recommendations and no data exists, say: "Connect your YouTube channel for personalized video recommendations."\n3. Only mention features that exist: keyword research, tag generator, title optimizer, description writer, metadata audit, thumbnail analyzer, SEO bundle, growth engine, and Phronesis AI coach.\n4. Be direct and helpful. 3-5 sentences. No markdown formatting.\n5. Always include a confidence percentage with recommendations.\n\nCurrent: Niche=${niche}, Credits=${credits}, Health=${healthScore}/100, Date=May 2026\n\nNever recommend competitor tools. Never make up data.`;

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
    const { topic, tone, niche, duration } = req.body;
    const wordTargets = { short: '80-120 words total.', standard: '1200-1500 words total. Deep exploration.', long: '2000-2500 words total. Comprehensive.' };
    const lengthGuide = wordTargets[duration] || wordTargets.standard;
    // Video Factory is a creative tool — skip credit check for testing

    const { askAI } = await import('./_lib/ai-provider.js');

    const script = await askAI(`Write a YouTube script for ${niche} about "${topic}" in ${tone} tone. ${lengthGuide}\n\nFormat:\n[HOST]: Dialogue — substantive, detailed\n[VISUAL]: Max 5 words, rare\n[SFX]: Sparse sound cues\n\nStructure (each needs deep dialogue):\n[HOT OPEN] 15s attention grab\n[HOOK] Big promise to viewer\n[CONTEXT] 2-3 paragraphs background\n[REVEAL 1] First surprising fact + explanation\n[DEEP DIVE] 3-4 paragraphs hidden details\n[REVEAL 2] Second twist\n[CLIMAX] Emotional payoff\n[OUTRO] Recap + subscribe + next video tease\n\nCRITICAL: HIT the word target. Dialogue is everything.`, 'Generate the complete script now.', { temperature: 0.7, maxTokens: 4000 });
    sendRes(res, 200, { script });
  } catch (e) { sendRes(res, 502, { error: 'Script generation failed' }); }
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
