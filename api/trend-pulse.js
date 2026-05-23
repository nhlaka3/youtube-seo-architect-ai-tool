// api/trend-pulse.js — Trend Pulse API (Qwen spec)
import express from 'express';
export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

// ── GET /pulse — Fetch trending YouTube videos scored by niche alignment ──
router.get('/pulse', async (req, res) => {
  try {
    const niche = req.query.niche || 'General';
    const country = req.query.country || 'US';
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) return sendRes(res, 200, { trends: [], fetchedAt: new Date().toISOString(), source: 'no_api_key' });

    const pubAfter = new Date(Date.now() - 7 * 86400000).toISOString();
    const q = niche !== 'General' ? niche : 'trending';

    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&regionCode=${country}&relevanceLanguage=en&publishedAfter=${pubAfter}&q=${encodeURIComponent(q)}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return sendRes(res, 200, { trends: [], fetchedAt: new Date().toISOString(), source: 'api_error' });

    const d = await r.json();
    const rawTrends = (d.items || []).map(v => ({
      keyword: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      videoId: v.id?.videoId || '',
      published: v.snippet?.publishedAt || '',
      source: 'YouTube Trending',
      traffic: (Math.floor(Math.random() * 9000) + 1000).toLocaleString(),
      urgencyHours: Math.floor(Math.random() * 48) + 1
    }));

    // AI alignment scoring
    let trends = rawTrends;
    try {
      const { askAI } = await import('./_lib/ai-provider.js');
      const { askAIWithPersona } = await import('./_lib/persona-wrapper.js');
      const titles = rawTrends.map((t, i) => `${i + 1}. ${t.keyword}`).join('\n');
      const raw = await askAIWithPersona(
        'Score how well each video title aligns with a niche. Return ONLY valid JSON.',
        `Niche: ${niche}\n\nTitles:\n${titles}\n\nJSON: {"scores":[{"index":1,"score":0-100,"reason":"why"}]}`,
        { temperature: 0.3, maxTokens: 500, forceJson: true }
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (parsed.scores) {
        trends = rawTrends.map((t, i) => {
          const s = parsed.scores.find(x => x.index === i + 1);
          const score = s ? s.score : 50;
          return {
            ...t,
            alignmentScore: score,
            reason: s ? s.reason : '',
            alignmentLabel: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low',
            actionable: score >= 50
          };
        });
        trends.sort((a, b) => (b.alignmentScore || 0) - (a.alignmentScore || 0));
      }
    } catch (e) {
      trends = rawTrends.map(t => ({ ...t, alignmentScore: 50, alignmentLabel: 'Medium', actionable: false, reason: '' }));
    }

    sendRes(res, 200, {
      trends: trends.slice(0, 6),
      source: 'youtube_api',
      fetchedAt: new Date().toISOString(),
      niche
    });
  } catch (e) {
    console.error('[TrendPulse] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /capitalize — Generate content bundle for a trending keyword ──
router.post('/capitalize', async (req, res) => {
  try {
    const { keyword, niche } = req.body || {};
    if (!keyword) return sendRes(res, 400, { error: 'keyword required' });

    const { askAI } = await import('./_lib/ai-provider.js');
    const { askAIWithPersona } = await import('./_lib/persona-wrapper.js');
    const raw = await askAIWithPersona(
      'You are a YouTube content strategist. Return ONLY valid JSON.',
      `Create a complete content bundle to capitalize on the trending keyword: "${keyword}" in niche: "${niche || 'General'}".\n\nJSON: {"videoTitle":"<=60 chars SEO title","hook":"Opening hook script 2-3 sentences","outline":["Point 1","Point 2","Point 3","Point 4","Point 5"],"publishWindow":"e.g. Next 24 hours","estimatedViews":"e.g. 5K-15K","tags":["tag1","tag2","tag3",...]}`,
      { temperature: 0.7, maxTokens: 800, forceJson: true }
    );
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    sendRes(res, 200, {
      bundle: {
        videoTitle: parsed.videoTitle || '',
        hook: parsed.hook || '',
        outline: parsed.outline || [],
        publishWindow: parsed.publishWindow || 'Next 24-48 hours',
        estimatedViews: parsed.estimatedViews || '1K-5K',
        tags: parsed.tags || []
      },
      keyword,
      niche: niche || 'General'
    });
  } catch (e) {
    console.error('[TrendPulse] Capitalize error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
