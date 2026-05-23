// api/coach-memory.js — AI Coach Persistent Memory (Task 07)
// Spacing artifacts fixed: sta tus→status, memo ry→memory, conten tGoals→contentGoals, etc.
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

const requireChannelId = (req, res, next) => {
  const channelId = req.headers['x-channel-id'] || req.body?.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel connection required' });
  req.channelId = channelId;
  next();
};

// ── Extract memory from conversation using AI ──
async function extractMemoryFromConversation(conversation, niche) {
  const { askAI } = await import('./_lib/ai-provider.js');
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'Creator' : 'Coach'}: ${m.content}`)
    .join('\n');

  try {
    const raw = await askAI(
      'You extract structured memory from YouTube creator coaching conversations. Return ONLY valid JSON.',
      `Extract key facts from this coaching conversation to remember for next time.\n\nCONVERSATION:\n${transcript.substring(0, 3000)}\n\nJSON (use empty arrays if nothing found): {"contentGoals":["goal1"],"problemVideos":["video title creator struggles with"],"focusKeywords":["keyword they want to rank for"],"uploadFrequency":"once a week / etc (null if not mentioned)","painPoints":["specific problem"],"wins":["success mentioned"],"lastConversation":"One sentence summary of this session"}`,
      { temperature: 0.3, maxTokens: 600, forceJson: true }
    );
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    return { contentGoals: [], problemVideos: [], focusKeywords: [], uploadFrequency: null, painPoints: [], wins: [], lastConversation: '' };
  }
}

// ── GET /memory — Get coach memory ──
router.get('/memory', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const memory = await dbService.getCoachMemory(req.channelId);
    sendRes(res, 200, { memory: memory || null, hasMemory: !!memory });
  } catch (e) {
    console.error('[CoachMemory] get error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /save — Save memory after conversation ──
router.post('/save', requireChannelId, async (req, res) => {
  try {
    const { conversation, niche } = req.body || {};
    if (!conversation || !conversation.length) return sendRes(res, 400, { error: 'conversation array required' });

    const { default: dbService } = await import('../src/database/services.js');
    const extracted = await extractMemoryFromConversation(conversation, niche);
    await dbService.upsertCoachMemory(req.channelId, {
      niche: niche || extracted.niche,
      contentGoals: extracted.contentGoals,
      problemVideos: extracted.problemVideos,
      focusKeywords: extracted.focusKeywords,
      uploadFrequency: extracted.uploadFrequency,
      painPoints: extracted.painPoints,
      wins: extracted.wins,
      lastConversation: extracted.lastConversation
    });
    sendRes(res, 200, { success: true, extracted });
  } catch (e) {
    console.error('[CoachMemory] save error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /clear — Clear memory ──
router.post('/clear', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    await dbService.clearCoachMemory(req.channelId);
    sendRes(res, 200, { success: true });
  } catch (e) {
    console.error('[CoachMemory] delete error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
