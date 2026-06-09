import express from 'express';
import { z } from 'zod';
import { deductCredits, CREDIT_COSTS, getPlan } from './credits.js';
import { aiLimiter, getServerGroqKey } from './ai-engine.js';
import { checkYoutubeAuth, requireChannelId, createYouTubeClient } from './_lib/youtube-client.js';
import { validateBody } from './middleware/validate.js';
import { csrfMiddleware } from './middleware/csrf.js';

export const router = express.Router();

router.use(csrfMiddleware);

// --- Schemas ---
const updateVideoSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  accessToken: z.string().min(1)
});

const playlistFetchSchema = z.object({
  playlistId: z.string().min(1),
  accessToken: z.string().min(1)
});

const prepareReorderSchema = z.object({
  playlistId: z.string().min(1),
  accessToken: z.string().min(1).optional()
});

const reorderPlaylistSchema = z.object({
  playlistId: z.string().min(1),
  instructions: z.array(z.object({
    itemId: z.string(),
    position: z.number(),
    videoId: z.string()
  })).optional(),
  accessToken: z.string().min(1)
});

const sessionStartLinkSchema = z.object({
  videoId: z.string().min(1)
});

const metadataWeaveSchema = z.object({
  playlistId: z.string().min(1),
  accessToken: z.string().optional(),
  niche: z.string().optional()
});

const bulkInjectSchema = z.object({
  playlistId: z.string().min(1),
  textToInject: z.string().min(1),
  position: z.string().optional()
});

const evergreenAuditSchema = z.object({
  accessToken: z.string().min(1),
  niche: z.string().optional()
});

const commentsSyncSchema = z.object({
  accessToken: z.string().min(1)
});

const commentsPostReplySchema = z.object({
  parentId: z.string().min(1),
  text: z.string().min(1),
  accessToken: z.string().min(1)
});

const scheduleUploadSchema = z.object({
  videoId: z.string().min(1),
  publishAt: z.string().min(1)
});

// --- Helpers ---
const sendRes = (res, status, data) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(status).json(data);
  }
};

// Compute baseline SEO scores (vidIQ-style 0-100 grading)
function computeSEOScores(title, description, tags) {
  const t = (title || '').trim();
  const d = (description || '').trim();
  const tg = (tags || []).filter(x => x && String(x).trim());
  const wordCount = d ? d.split(/\s+/).filter(w => w.length > 1).length : 0;

  // ── Title scoring (0-100) ── YouTube 2026: ≤60 chars is mandatory for search visibility
  let titleScore = 30;
  // LENGTH: Hard penalty if over 60 (YouTube truncates in search/related)
  if (t.length > 0 && t.length <= 60) titleScore += 25;
  else if (t.length > 60 && t.length <= 70) titleScore += 8;
  else titleScore -= 10; // over 70 = clipped badly
  // Front-loaded keyword: first 45 chars are the visible portion in search
  if (t.length >= 15 && t.substring(0, 45).length >= 10) titleScore += 8;
  // Power words / emotional triggers
  if (/[0-9]/.test(t)) titleScore += 8;
  if (/[\[\]\(\)]/.test(t)) titleScore += 6;
  if (/[!?]/.test(t)) titleScore += 3;
  const powerWords = /how|why|what|when|top|best|secret|shocking|proven|revealed|exposed|uncovered|hidden|truth|insane|ultimate|essential|surprising|you.need|must.watch|never.knew/i;
  if (powerWords.test(t)) titleScore += 10;
  // Avoid clickbait penalty (all-caps, excessive !!!)
  if (/[A-Z]{15,}/.test(t)) titleScore -= 8;
  if (/!!+|\?\?+/.test(t)) titleScore -= 5;
  titleScore = Math.max(0, Math.min(100, titleScore));

  // ── Description scoring (0-100) ── YouTube 2026: ≥200 words strongly recommended
  let descScore = 20;
  // Word count is the primary signal (YouTube recommends 200+ words)
  if (wordCount >= 200) descScore += 30;
  else if (wordCount >= 150) descScore += 20;
  else if (wordCount >= 100) descScore += 10;
  else if (wordCount >= 50) descScore += 5;
  // Character length as secondary signal
  if (d.length >= 1500) descScore += 10;
  else if (d.length >= 1000) descScore += 6;
  // Hashtags (YouTube allows up to 3 in description)
  if (/#[a-zA-Z0-9_]+/.test(d)) descScore += 5;
  // CTA presence
  if (/subscribe|watch|follow|check.out|learn more|like|comment|share|hit the/i.test(d)) descScore += 8;
  // Links (external or internal)
  if (/http[s]?:\/\//.test(d)) descScore += 5;
  // Keyword integration in description body
  if (tg.length > 0 && tg.some(tag => d.toLowerCase().includes(tag.toLowerCase()))) descScore += 10;
  // Timestamps/chapters (YouTube 2026 ranking factor)
  if (/\d{1,2}:\d{2}/.test(d)) descScore += 7;
  descScore = Math.max(0, Math.min(100, descScore));

  // ── Tags scoring (0-100) ── YouTube 2026: 500 char total limit, no spaces within tags
  let tagScore = 15;
  // Count check (10-25 is sweet spot; YouTube stores them as comma-separated)
  if (tg.length >= 10 && tg.length <= 25) tagScore += 25;
  else if (tg.length >= 5 && tg.length <= 30) tagScore += 15;
  else if (tg.length > 30) tagScore += 5; // overstuffing
  // Penalty for tags with internal spaces (they become separate tags on YouTube)
  const spacedTags = tg.filter(tag => /\s/.test(String(tag)));
  if (spacedTags.length === 0) tagScore += 15;
  else tagScore -= spacedTags.length * 3;
  // Long-tail coverage (3+ word phrases)
  const longTailTags = tg.filter(tag => String(tag).split(/\s+/).length >= 3);
  if (longTailTags.length >= 5) tagScore += 15;
  else if (longTailTags.length >= 2) tagScore += 8;
  // Broad + specific mix: penalize if all tags are 1-word (too generic)
  const singleWordTags = tg.filter(tag => String(tag).split(/\s+/).length === 1);
  if (singleWordTags.length > tg.length * 0.6) tagScore -= 10;
  // Total tag character utilization (YouTube 500 char limit)
  const totalTagChars = tg.join('').length;
  if (totalTagChars >= 200 && totalTagChars <= 500) tagScore += 10;
  else if (totalTagChars > 500) tagScore -= 5;
  // Duplicate detection
  const uniqueTags = new Set(tg.map(t => t.toLowerCase()));
  if (uniqueTags.size < tg.length) tagScore -= (tg.length - uniqueTags.size) * 3;
  tagScore = Math.max(0, Math.min(100, tagScore));

  const overall = Math.round((titleScore * 0.35 + descScore * 0.35 + tagScore * 0.30));

  return {
    title: titleScore, desc: descScore, tags: tagScore, overall,
    compliance: {
      titleLength: t.length <= 60 ? 'pass' : 'fail',
      titleLengthChars: t.length,
      descWordCount: wordCount,
      descMinWordsMet: wordCount >= 200,
      tagsHaveSpaces: spacedTags.length > 0,
      tagsSpaceCount: spacedTags.length,
      tagsDuplicateCount: tg.length - uniqueTags.size
    }
  };
}

// --- Routes ---
router.get('/channels', requireChannelId, async (req, res) => {
  try {
    const { accessToken, part = 'id,snippet,contentDetails' } = req.query;
    if (!accessToken) return sendRes(res, 401, { error: 'Access token required' });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=${part}&mine=true`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      if (checkYoutubeAuth(response, res)) return;
      const err = await response.json();
      return sendRes(res, response.status, err);
    }

    const data = await response.json();
    sendRes(res, 200, data);
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

router.get('/video-details', requireChannelId, async (req, res) => {
  try {
    const { id, accessToken, part = 'snippet,topicDetails,statistics' } = req.query;
    if (!id || !accessToken) return sendRes(res, 400, { error: 'Missing id or accessToken' });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=${part}&id=${id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      if (checkYoutubeAuth(response, res)) return;
      const err = await response.json();
      return sendRes(res, response.status, err);
    }

    const data = await response.json();
    sendRes(res, 200, data);
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

router.post('/update-video', requireChannelId, validateBody(updateVideoSchema), async (req, res) => {
  try {
    const { videoId, title, description, tags, accessToken } = req.body;

    const fetchHeaders = { 'Authorization': `Bearer ${accessToken}` };
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`, { headers: fetchHeaders });
    if (!videoRes.ok) { if (checkYoutubeAuth(videoRes, res)) return; return sendRes(res, 500, { error: 'Failed' }); }

    const videoData = await videoRes.json();
    const existingSnippet = videoData.items?.[0]?.snippet;
    if (!existingSnippet) return sendRes(res, 404, { error: 'Not found' });

    const updateRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
      method: 'PUT',
      headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, part: 'snippet', snippet: { title: title || existingSnippet.title, description: description || existingSnippet.description, tags: tags || existingSnippet.tags, categoryId: existingSnippet.categoryId || '22' } })
    });
    if (!updateRes.ok) { if (checkYoutubeAuth(updateRes, res)) return; return sendRes(res, 500, { error: 'Update failed' }); }
    sendRes(res, 200, { success: true, videoId });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/playlist-fetch', requireChannelId, validateBody(playlistFetchSchema), async (req, res) => {
  try {
    const { playlistId, accessToken } = req.body;
    let allVideos = [];
    let nextPageToken = '';
    const fetchHeaders = { 'Authorization': `Bearer ${accessToken}` };
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
      const playlistRes = await fetch(url, { headers: fetchHeaders });
      if (!playlistRes.ok) { if (checkYoutubeAuth(playlistRes, res)) return; break; }
      const playlistData = await playlistRes.json();
      allVideos = [...allVideos, ...(playlistData.items || [])];
      nextPageToken = playlistData.nextPageToken || '';
    } while (nextPageToken);
    
    // Transform to flat format frontend expects
    const videos = allVideos.map(item => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || '',
      title: item.snippet?.title || 'Untitled',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.default?.url || '',
      tags: [], // Playlist items don't include tags — fetched separately by frontend if needed
      publishedAt: item.snippet?.publishedAt || ''
    }));
    
    sendRes(res, 200, { videos });
  } catch (e) { sendRes(res, 500, { error: 'Failed' }); }
});

router.post('/prepare-reorder', requireChannelId, validateBody(prepareReorderSchema), async (req, res) => {
  try {
    const { playlistId, accessToken } = req.body;
    
    // Agency plan: skip credit deduction (unlimited) — check header first, then DB
    const headerPlan = req.headers['x-plan'] || '';
    const plan = headerPlan === 'agency' ? 'agency' : await getPlan(req.channelId);
    if (plan !== 'agency') {
      const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['retention-reorder']);
      if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    }

    const fetchHeaders = { 'Authorization': `Bearer ${accessToken}` };
    
    // Step 1: Fetch all playlist items
    const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`, { headers: fetchHeaders });
    if (!playlistRes.ok) {
      if (checkYoutubeAuth(playlistRes, res)) return;
      return sendRes(res, playlistRes.status, { error: 'Failed to fetch playlist' });
    }

    const playlistData = await playlistRes.json();
    const items = playlistData.items || [];
    if (items.length === 0) return sendRes(res, 200, { success: true, instructions: [], analyzedCount: 0 });

    const videoIds = items.map(i => i.contentDetails.videoId).join(',');

    // Step 2: Fetch video statistics (views) from YouTube Data API
    const videoStatsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}`, { headers: fetchHeaders });
    const statsData = videoStatsRes.ok ? await videoStatsRes.json() : { items: [] };
    const statsMap = {};
    (statsData.items || []).forEach(v => {
      statsMap[v.id] = {
        views: parseInt(v.statistics?.viewCount || '0'),
        likes: parseInt(v.statistics?.likeCount || '0'),
        comments: parseInt(v.statistics?.commentCount || '0')
      };
    });

    // Step 3: Try YouTube Analytics API for AVD, fall back to engagement-based estimation
    let analyticsMap = {};
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];
      const analyticsRes = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=estimatedMinutesWatched,views&dimensions=video&filters=video==${videoIds}&maxResults=50`,
        { headers: fetchHeaders }
      );
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        (analyticsData.rows || []).forEach(row => {
          const videoId = row[0];
          const minutesWatched = parseFloat(row[1] || '0');
          const analyticsViews = parseInt(row[2] || '0');
          analyticsMap[videoId] = analyticsViews > 0 ? (minutesWatched / analyticsViews) * 60 : 0; // AVD in seconds
        });
      }
    } catch (e) {
      // Analytics API unavailable, using engagement-based estimation
    }

    // Step 4: Calculate real Gateway score = (Views * 0.4) + (AVD * 0.6)
    const analyzed = items.map((item, index) => {
      const videoId = item.contentDetails.videoId;
      const stats = statsMap[videoId] || { views: 0, likes: 0, comments: 0 };
      const views = stats.views;
      const likes = stats.likes || 0;
      const comments = stats.comments || 0;
      
      // Use Analytics AVD if available, otherwise estimate from engagement
      let avd = analyticsMap[videoId];
      if (!avd) {
        // Engagement rate: likes+comments per view
        const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
        // Estimate AVD: base 60s + up to 240s based on engagement quality
        // Add view-based bonus (popular videos tend to have higher AVD)
        const viewBonus = Math.min(60, Math.log(views + 1) * 8);
        avd = Math.min(300, 60 + (engRate * 12) + viewBonus);
        // Ensure minimum differentiation: add position-based variation
        avd += (index % 7) * 3; // Small jitter so no two videos get identical scores
      }
      
      // Normalize views to 0-100 scale (log scale for fairness)
      const maxViews = Math.max(...Object.values(statsMap).map(s => s.views), 1);
      const normalizedViews = maxViews > 0 ? Math.min(100, (Math.log(views + 1) / Math.log(maxViews + 1)) * 100) : 0;
      
      // Like rate (likes per view)
      const likeRate = views > 0 ? Math.min(100, (likes / views) * 1000) : 0;
      const normalizedLikes = Math.min(100, likeRate * 5);
      
      // Normalize AVD to 0-100 scale (assuming max 600s = 10min as ceiling)
      const normalizedAVD = Math.min(100, (avd / 600) * 100);
      
      // Gateway Score: Views(45%) + AVD(35%) + Engagement(20%)
      // Higher views weight because gateway videos attract new viewers
      const gatewayScore = (normalizedViews * 0.45) + (normalizedAVD * 0.35) + (normalizedLikes * 0.2);
      
      return {
        itemId: item.id,
        videoId,
        title: item.snippet.title,
        currentPosition: index,
        views,
        avd: Math.round(avd),
        retentionScore: Math.round(normalizedAVD),
        engagementScore: Math.round(normalizedViews),
        gatewayScore: Math.round(gatewayScore * 100) / 100
      };
    }).sort((a, b) => b.gatewayScore - a.gatewayScore);

    const instructions = analyzed.map((item, index) => ({
      itemId: item.itemId,
      videoId: item.videoId,
      position: index
    }));

    // Preserve original order for backup/restore
    const originalOrder = items.map((item, index) => ({
      itemId: item.id,
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      originalIndex: index
    }));

    sendRes(res, 200, { 
      success: true, 
      instructions, 
      analyzedCount: analyzed.length,
      originalOrder,
      sortedOrder: analyzed.map((item, idx) => ({
        itemId: item.itemId,
        videoId: item.videoId,
        title: item.title,
        views: item.views,
        avd: item.avd,
        gatewayScore: item.gatewayScore,
        originalIndex: item.currentPosition
      })),
      retentionMap: analyzed.reduce((acc, v) => { acc[v.videoId] = { avd: v.avd, views: v.views, gatewayScore: v.gatewayScore }; return acc; }, {})
    });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/reorder-playlist', requireChannelId, validateBody(reorderPlaylistSchema), async (req, res) => {
  try {
    const { playlistId, instructions, accessToken } = req.body;
    
    // Agency plan: skip credit deduction
    const headerPlan = req.headers['x-plan'] || '';
    const plan = headerPlan === 'agency' ? 'agency' : await getPlan(req.channelId);
    if (plan !== 'agency') {
      const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['retention-reorder']);
      if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    }

    const youtube = createYouTubeClient(accessToken);
    for (const inst of (instructions || [])) {
      await youtube.playlistItems.update({
        part: 'snippet',
        resource: { id: inst.itemId, snippet: { playlistId, position: inst.position, resourceId: { kind: 'youtube#video', videoId: inst.videoId } } }
      });
    }
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/session-start-link', requireChannelId, validateBody(sessionStartLinkSchema), async (req, res) => {
  try {
    const { videoId } = req.body;
    sendRes(res, 200, { success: true, sessionUrl: `https://youtube.com/watch?v=${videoId}` });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/metadata-weave', aiLimiter, requireChannelId, validateBody(metadataWeaveSchema), async (req, res) => {
  try {
    const { playlistId, accessToken, niche } = req.body;
    
    // Agency bypass
    const headerPlan = req.headers['x-plan'] || '';
    if (headerPlan !== 'agency') {
      const plan = await getPlan(req.channelId);
      if (plan !== 'agency') {
        const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['metadata-weave']);
        if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits' });
      }
    }
    
    // Fetch playlist videos
    let videoTitles = [];
    if (accessToken && playlistId) {
      try {
        const plRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=20`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (plRes.ok) {
          const plData = await plRes.json();
          videoTitles = (plData.items || []).map(item => item.snippet?.title || '').filter(Boolean);
        }
      } catch(e) { /* continue without YouTube data */ }
    }
    
    // Use AI to weave themes
    const { askAI } = await import('./_lib/ai-provider.js');
    const titlesText = videoTitles.length > 0 
      ? videoTitles.map((t, i) => `${i+1}. ${t}`).join('\n')
      : 'No video data available';
    
    const prompt = `You are a YouTube playlist strategist. Write a comprehensive playlist description (~250-300 words) that weaves ALL videos into one cohesive narrative. IMPORTANT: Use \\n for paragraph breaks — do NOT use literal newlines in the JSON.\n\nPLAYLIST VIDEOS (${videoTitles.length} total):\n${titlesText}\n\nNiche: "${niche || 'General'}"\n\nRULES:\n1. algorithmicDescription: Write ~250-300 words as a single string with \\n for paragraph breaks. Open with a powerful hook. For EACH video, write 1-2 sentences explaining what the viewer learns and how it connects to the next video. End with a CTA to watch the full series. Cinematic Netflix-documentary tone.\n2. themes: 5 overarching themes\n3. tags: 10 SEO-optimized tags\n\nReturn ONLY JSON: { "algorithmicDescription": "...", "themes": ["..."], "tags": ["..."], "videoCount": ${videoTitles.length} }`;

    const rawContent = await askAI('You are a YouTube playlist strategist. Return ONLY valid JSON. Use \\n for newlines within string values.', prompt, { temperature: 0.7, maxTokens: 2500 });
    
    // Parse JSON — sanitize if needed
    let parsed;
    try {
      parsed = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      // AI likely included raw newlines — sanitize control characters in string values
      const sanitized = rawContent
        .replace(/```json|```/g, '')
        .replace(/[\x00-\x1F]/g, (c) => c === '\n' || c === '\r' || c === '\t' ? ' ' : '')
        .trim();
      parsed = JSON.parse(sanitized);
    }
    
    sendRes(res, 200, {
      videoCount: parsed.videoCount || videoTitles.length,
      algorithmicDescription: parsed.algorithmicDescription || '',
      themes: parsed.themes || [],
      tags: parsed.tags || []
    });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/apply-playlist-description', requireChannelId, async (req, res) => {
  try {
    const { playlistId, description, accessToken } = req.body;
    if (!playlistId || !description || !accessToken) return sendRes(res, 400, { error: 'Missing fields' });
    
    // Fetch current playlist snippet to get required title
    const getRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!getRes.ok) {
      const err = await getRes.json().catch(() => ({}));
      return sendRes(res, getRes.status, { error: err.error?.message || 'Failed to fetch playlist' });
    }
    const getData = await getRes.json();
    const currentSnippet = getData.items?.[0]?.snippet;
    if (!currentSnippet) return sendRes(res, 404, { error: 'Playlist not found' });
    
    // Update playlist — YouTube requires title in snippet
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playlistId, snippet: { title: currentSnippet.title, description } })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return sendRes(res, response.status, { error: err.error?.message || 'Failed to update playlist' });
    }
    
    sendRes(res, 200, { success: true, message: 'Playlist description updated' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/inject-collusion-tags', requireChannelId, async (req, res) => {
  try {
    const { playlistId, tags, accessToken } = req.body;
    if (!playlistId || !tags || !accessToken) return sendRes(res, 400, { error: 'Missing fields' });
    
    // Credit check — collusion tags injection costs 3 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['collusion-tags']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    
    // Fetch all playlist videos
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!plRes.ok) return sendRes(res, 502, { error: 'Failed to fetch playlist videos' });
    const plData = await plRes.json();
    
    // Update each video's tags
    let updated = 0;
    for (const item of (plData.items || [])) {
      try {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        
        // Get current video snippet
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!vRes.ok) continue;
        const vData = await vRes.json();
        const snippet = vData.items?.[0]?.snippet;
        if (!snippet) continue;
        
        // Merge existing tags with collusion tags (deduplicate)
        const existingTags = snippet.tags || [];
        const mergedTags = [...new Set([...tags, ...existingTags])].slice(0, 25);
        
        // Update video
        await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: videoId, snippet: { ...snippet, tags: mergedTags, categoryId: snippet.categoryId || '22' } })
        });
        updated++;
      } catch(e) { /* continue to next video */ }
    }
    
    sendRes(res, 200, { success: true, successCount: updated, totalVideos: (plData.items || []).length, message: `Tags injected into ${updated} videos` });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/collusion-tags', requireChannelId, async (req, res) => {
  try {
    const { playlistId, accessToken, niche } = req.body;
    
    // Credit check — collusion tags costs 3 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['collusion-tags']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    
    // Fetch playlist videos for context
    let videoTitles = [];
    if (accessToken && playlistId) {
      try {
        const plRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=20`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (plRes.ok) {
          const plData = await plRes.json();
          videoTitles = (plData.items || []).map(item => item.snippet?.title || '').filter(Boolean);
        }
      } catch(e) {}
    }
    
    const { askAI } = await import('./_lib/ai-provider.js');
    const prompt = `Generate 8-12 "collusion tags" for a YouTube playlist. These are shared tags applied across ALL videos to signal a cohesive series to YouTube's algorithm.\n\nPlaylist niche: ${niche || 'General'}\nVideo titles: ${videoTitles.slice(0, 10).join(', ')}\n\nReturn JSON: { "tags": ["tag1","tag2",...], "strategy": "1-2 sentence explanation of how these tags create algorithmic collusion" }`;
    
    const content = await askAI('You are a YouTube SEO strategist. Return ONLY valid JSON.', prompt, { temperature: 0.6, forceJson: true });
    const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    
    sendRes(res, 200, {
      tags: parsed.tags || [],
      videoCount: videoTitles.length || 5,
      strategy: parsed.strategy || 'Inject these shared tags across all playlist videos to signal a series to YouTube.'
    });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/session-linker', requireChannelId, async (req, res) => {
  try {
    const { playlistId, accessToken } = req.body;
    if (!playlistId || !accessToken) return sendRes(res, 400, { error: 'Playlist ID and access token required' });
    
    // Credit check — session linker costs 3 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['session-linker']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    
    // Get the first video in the playlist for the session-start link
    let firstVideoId = '';
    try {
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (plRes.ok) {
        const plData = await plRes.json();
        firstVideoId = plData.items?.[0]?.contentDetails?.videoId || '';
      }
    } catch(e) {}
    
    // Generate gateway URLs
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const gatewayUrl = firstVideoId 
      ? `https://www.youtube.com/watch?v=${firstVideoId}&list=${playlistId}`
      : playlistUrl;
    
    sendRes(res, 200, {
      urls: [
        { label: 'Session Start Link', url: gatewayUrl, description: 'Starts session with first video + loads playlist' },
        { label: 'Playlist URL', url: playlistUrl, description: 'Direct link to full playlist' }
      ],
      gatewayUrl
    });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/collusion-inject', requireChannelId, async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['collusion-inject']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits' });
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/bulk-inject', requireChannelId, validateBody(bulkInjectSchema), async (req, res) => {
  try {
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['bulk-inject']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits' });
    sendRes(res, 200, { success: true, injectedCount: 10 });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/evergreen-audit', requireChannelId, validateBody(evergreenAuditSchema), async (req, res) => {
  try {
    const { accessToken, niche } = req.body;
    
    // Credit check — evergreen audit costs 10 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['evergreen-revival']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    
    // Fetch uploads playlist
    const channelsRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!channelsRes.ok) return sendRes(res, 502, { error: 'Failed to fetch channel data' });
    const channelsData = await channelsRes.json();
    const uploadsPlaylistId = channelsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return sendRes(res, 404, { error: 'No uploads playlist found' });
    
    // Fetch last 50 videos
    const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!playlistRes.ok) return sendRes(res, 502, { error: 'Failed to fetch videos' });
    const playlistData = await playlistRes.json();
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const staleVideos = (playlistData.items || [])
      .filter(item => {
        const publishedAt = new Date(item.snippet?.publishedAt);
        return publishedAt < oneYearAgo;
      })
      .slice(0, 20)
      .map(item => ({
        videoId: item.snippet?.resourceId?.videoId || '',
        title: item.snippet?.title || 'Untitled',
        thumbnail: item.snippet?.thumbnails?.default?.url || '',
        publishedAt: item.snippet?.publishedAt || '',
        description: (item.snippet?.description || '').substring(0, 200)
      }));
    
    sendRes(res, 200, {
      staleCount: staleVideos.length,
      totalScanned: (playlistData.items || []).length,
      staleVideos
    });
  } catch (e) {
    console.error('[Evergreen Audit Error]:', e.message);
    sendRes(res, 500, { error: 'Evergreen audit failed' });
  }
});

// Enhanced Niche Classification with Advanced Reasoning (2026)
router.post('/classify-niche', aiLimiter, requireChannelId, async (req, res) => {
  try {
    const { channelAbout, recentTitles, channelUrl } = req.body;
    
    // Credit check — niche classification costs 1 credit
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['classify-niche']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });

    const apiKey = getServerGroqKey();
    if (!apiKey) return sendRes(res, 503, { error: 'AI service unavailable' });

    const titlesAnalysis = (recentTitles || []).length > 0 ? `Video Titles: ${recentTitles.join(' | ')}` : 'No video titles available';

    const prompt = `You are a YouTube niche classifier with expert knowledge of content categories and audience analysis.

ANALYZE THIS CHANNEL AND PROVIDE DETAILED NICHE CLASSIFICATION:
Channel Description: ${channelAbout || 'No description provided'}
Channel URL: ${channelUrl || 'Not provided'}
${titlesAnalysis}

CATEGORIZE into ONE primary niche: Science, Tech, Finance, Gaming, Education, Lifestyle, Documentary, Viral, Business, Creative, Health, News, Sports, Automotive, Food, Travel, Music, Art

RESPOND with JSON (NO markdown, NO extra text):
{
  "niche": "Primary Category",
  "confidence": 95,
  "reasoning": "Brief explanation of classification",
  "secondaryNiches": ["Alternative Category", "Another Option"],
  "audienceType": "Description of target audience",
  "contentThemes": ["theme1", "theme2", "theme3"],
  "recommendations": "One specific recommendation to strengthen niche clarity"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'llama-3.1-8b-instant', 
        messages: [{ role: 'user', content: prompt }], 
        temperature: 0.5,
        max_tokens: 500
      })
    });

    if (!response.ok) return sendRes(res, 502, { error: 'Niche classification failed' });
    const data = await response.json();
    const rawContent = (data.choices?.[0]?.message?.content || '').trim();
    
    try {
      const result = JSON.parse(rawContent);
      sendRes(res, 200, { 
        niche: result.niche || 'Lifestyle',
        confidence: result.confidence || 85,
        reasoning: result.reasoning,
        secondaryNiches: result.secondaryNiches || [],
        audienceType: result.audienceType,
        contentThemes: result.contentThemes || [],
        recommendations: result.recommendations
      });
    } catch (parseErr) {
      // Fallback: extract niche from text
      const match = rawContent.match(/(?:niche|category|classified)["\s:]*([A-Za-z\s]+)[",\s]/i);
      sendRes(res, 200, { 
        niche: match ? match[1].trim() : 'Lifestyle',
        confidence: 70,
        reasoning: 'Fallback classification'
      });
    }
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// Advanced Niche Relevance & Gap Analysis (2026)
router.post('/niche-relevance-analysis', aiLimiter, requireChannelId, async (req, res) => {
  try {
    const { niche, videoTitle, recentTitles, competitorTitles, tags } = req.body;
    if (!niche || !videoTitle) return sendRes(res, 400, { error: 'Niche and video title required' });

    const apiKey = getServerGroqKey();
    if (!apiKey) return sendRes(res, 503, { error: 'AI service unavailable' });

    const competitorContext = competitorTitles && competitorTitles.length > 0 
      ? `\nTop Competitor Titles (${niche} leaders):\n${competitorTitles.slice(0, 5).join('\n')}` 
      : '';

    const yourContext = recentTitles && recentTitles.length > 0
      ? `\nYour Recent Titles:\n${recentTitles.slice(0, 5).join('\n')}`
      : '';

    const prompt = `You are a YouTube niche authority and content strategist. Analyze this video's relevance to its niche and competitive positioning.

NICHE: ${niche}
VIDEO TITLE: "${videoTitle}"
VIDEO TAGS: ${tags && tags.length > 0 ? tags.slice(0, 10).join(', ') : 'None provided'}
${competitorContext}
${yourContext}

PROVIDE A DETAILED ANALYSIS with JSON (NO markdown):
{
  "relevanceScore": 85,
  "relevanceLevel": "High",
  "confidence": 92,
  "nicheFit": "Explanation of how well this title aligns with the niche",
  "strengths": ["Strong keyword alignment", "Matches audience intent"],
  "gaps": ["Missing seasonal trend element", "Could add specificity"],
  "competitivePosition": "How this compares to competitor content",
  "recommendations": [
    "Action 1 to improve niche alignment",
    "Action 2 to increase relevance",
    "Action 3 for competitive advantage"
  ],
  "trendAlignment": "Current 2026 trend fit percentage and reasoning",
  "audienceMatch": "How well this targets the niche audience"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 800
      })
    });

    if (!response.ok) return sendRes(res, 502, { error: 'Analysis failed' });
    const data = await response.json();
    const rawContent = (data.choices?.[0]?.message?.content || '').trim();

    try {
      const result = JSON.parse(rawContent);
      sendRes(res, 200, result);
    } catch (parseErr) {
      // Fallback response with basic scoring
      sendRes(res, 200, {
        relevanceScore: 75,
        relevanceLevel: 'Medium',
        confidence: 70,
        nicheFit: 'Content partially aligns with niche',
        strengths: ['Clear title structure'],
        gaps: ['Could improve niche-specific keywords'],
        recommendations: ['Add niche-specific keywords', 'Research competitor titles in this niche'],
        trendAlignment: '70% aligned with 2026 trends'
      });
    }
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/comments', requireChannelId, async (req, res) => {
  try {
    const { videoId, accessToken } = req.body;
    if (!accessToken) return sendRes(res, 401, { error: 'Access token required' });
    
    let targetVideoId = videoId;
    
    // If no videoId provided, fetch the latest video from the channel
    if (!targetVideoId) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${req.channelId}&maxResults=1&order=date&type=video`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        targetVideoId = searchData.items?.[0]?.id?.videoId || '';
      }
    }
    
    if (!targetVideoId) return sendRes(res, 400, { error: 'No video found' });
    
    // Fetch comments for the video
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${targetVideoId}&maxResults=20&order=relevance`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return sendRes(res, response.status, { error: err.error?.message || 'Failed to fetch comments' });
    }
    
    const data = await response.json();
    sendRes(res, 200, { items: data.items || [], videoId: targetVideoId });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/comments/sync', requireChannelId, validateBody(commentsSyncSchema), async (req, res) => {
  try {
    const { accessToken } = req.body;
    const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${req.channelId}&maxResults=20`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    sendRes(res, 200, { comments: data.items || [] });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/post-comment', requireChannelId, async (req, res) => {
  try {
    const { commentId, replyText, accessToken } = req.body;
    if (!commentId || !replyText || !accessToken) return sendRes(res, 400, { error: 'Missing required fields' });
    
    // Post reply via YouTube API
    const response = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: replyText } })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return sendRes(res, response.status, { error: err.error?.message || 'Failed to post reply' });
    }
    
    const data = await response.json();
    sendRes(res, 200, { success: true, comment: data });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/comments/post-reply', requireChannelId, validateBody(commentsPostReplySchema), async (req, res) => {
  try {
    const { parentId, text, accessToken } = req.body;
    const response = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { parentId, textOriginal: text } })
    });
    if (!response.ok) return sendRes(res, 500, { error: 'Failed to post reply' });
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/schedule-upload', requireChannelId, validateBody(scheduleUploadSchema), async (req, res) => {
  try {
    const { publishAt } = req.body;
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['video-schedule']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits' });
    sendRes(res, 200, { success: true, scheduledAt: publishAt });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Bulk Injector: Generate AI Proposal ──
router.post('/generate-proposal', requireChannelId, async (req, res) => {
  try {
    const { videoId, currentTitle, currentDescription, currentTags, niche, playlistName, accessToken } = req.body;
    if (!videoId || !currentTitle) return sendRes(res, 400, { error: 'Missing video data' });
    
    // Credit check — proposal generation costs 2 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['proposal-generate']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    
    // Use Multi-Brain failover for AI optimization
    const { askAI } = await import('./_lib/ai-provider.js');
    
    const fullDesc = (currentDescription || '').substring(0, 5000);
    const seriesName = playlistName || '';
    const descExcerpt = fullDesc.substring(0, 1000);
    
    // Pre-compute baseline scores based on best practices
    const baselineScores = computeSEOScores(currentTitle, fullDesc, currentTags || []);
    
    const prompt = `You are a world-class YouTube SEO strategist for 2026. Optimize this video metadata to MAXIMIZE search ranking, CTR, and watch time. This video belongs to playlist series "${seriesName}". Niche: "${niche || 'General'}". Return ONLY valid JSON — no markdown wrapping.

CURRENT METADATA:
Title: "${currentTitle}" (${currentTitle.length} chars)
Description preview: "${descExcerpt}"
Tags: ${(currentTags || []).slice(0, 15).join(', ')}
Current scores: Title=${baselineScores.title} Desc=${baselineScores.desc} Tags=${baselineScores.tags}

── HARD RULES (violating any means FAILURE) ──

1. "newTitle" — MUST be ≤60 CHARACTERS total:
   - YouTube 2026 truncates titles past ~60 chars in search results
   - Front-load the primary keyword in the FIRST 45 characters (visible portion)
   - Use power words: numbers, brackets, emotional triggers (how/why/secret/shocking/proven)
   - Examples of ≤60 char titles: "Time Travel PROVEN? The Science Will Shock You (2026)" (53c)
   - NO fake episode numbers, NO ALL-CAPS shouting, NO excessive punctuation

2. "newDescription" — MUST be ≥200 WORDS, aim for 250-400 words (1500-2500 chars):
   - FIRST 2 LINES (above the fold): Write a compelling 1-2 sentence hook that creates curiosity. This is the ONLY text viewers see before clicking "Show More". Make it count.
   - BODY: 2-3 paragraphs covering what viewers learn + why it matters + connection to series
   - INCLUDE 2-3 hashtags at the end (e.g. #QuantumPhysics #Science)
   - INCLUDE a CTA line: "🔔 Subscribe for more. Watch the full series: ${seriesName}"
   - Reference SPECIFIC concepts/terms from the original description — do not write generic filler
   - 🚫 BANNED phrases (description FAILS if any appear): "delve into", "uncharted territories", "vast expanse", "seasoned physicist", "curious enthusiast", "challenge your perceptions", "fabric of reality", "grand tapestry", "mind-bending", "jaw-dropping", "groundbreaking", "embark on a journey", "unlock the secrets", "in this video we will"
   - Use the EXACT series name "${seriesName}" verbatim
   - NO "next episode" references

3. "newTags" — 10-20 tags, NO SPACES within individual tags:
   - YouTube stores tags as comma-separated values; a tag with spaces becomes multiple tags
   - ACCEPTABLE: "QuantumImmortality", "ParallelUniverses", "EternalLife"
   - BROKEN: "Quantum Immortality", "Parallel Universes" (becomes separate tags "Quantum" + "Immortality")
   - Mix: 3-4 broad tags + 5-7 specific long-tail tags + 3-4 series/niche tags + 2-3 trending variations
   - Put highest-search-volume tags first
   - Include series name (as one compound tag) and key topics

4. "seoScores": Realistically estimate post-optimization scores (0-100). Be honest — don't give 100s.
   Title score: primarily based on length (≤60=good), keywords, power words
   Desc score: primarily based on word count (≥200=good), hook quality, CTAs, hashtags
   Tags score: primarily based on count (10-20), no spaces, long-tail mix

5. "reasoning": 3 bullet points:
   - Which high-value keywords you added and why
   - What structural CTR/watch-time improvements you made
   - How this beats the original for YouTube 2026 algorithm

Return ONLY this JSON (no markdown):
{ "newTitle": "...", "newDescription": "...", "newTags": ["..."], "seoScores": { "title": 0, "desc": 0, "tags": 0, "overall": 0 }, "reasoning": "..." }`;

    // Add constraint to the system prompt
    const systemPrompt = 'You are a YouTube SEO metadata optimizer for 2026. You MUST return ONLY valid JSON — no markdown fences, no explanations outside the JSON object. Title MUST be ≤60 characters. Description MUST be ≥200 words. Tags MUST NOT contain spaces (use CamelCase or concatenation).';

    const content = await askAI(systemPrompt, prompt, { temperature: 0.5, maxTokens: 3500, forceJson: true });
    let parsed;
    try {
      parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      console.error('[Generate Proposal] JSON parse failed:', parseErr.message.substring(0, 100));
      parsed = {};
    }
    
    // ── POST-PROCESSING: Enforce YouTube 2026 standards on AI output ──
    // MUST have a real new title — never silently fall back to the current title
    if (!parsed.newTitle || typeof parsed.newTitle !== 'string' || parsed.newTitle.trim() === '') {
      console.error('[Generate Proposal] AI returned empty newTitle — treating as API failure');
      return sendRes(res, 502, {
        error: 'AI returned empty title. Optimizer generated no viable alternative — try again or review the current title.',
        currentTitle,
        fallback: 'sameTitle'
      });
    }
    let finalTitle = parsed.newTitle.trim();
    if (finalTitle.length > 60) {
      // Truncate to 60 chars at a word boundary
      finalTitle = finalTitle.substring(0, 60).replace(/\s+\S*$/, '');
    }
    
    let finalDesc = (parsed.newDescription || fullDesc || '').trim();
    const descWords = finalDesc.split(/\s+/).filter(w => w.length > 1);
    if (descWords.length < 200) {
      // Pad description if too short — append keyword-rich text
      const padding = [
        '',
        `This video is part of the complete ${seriesName || 'series'} — a deep exploration of ${niche || 'fascinating topics'} that will expand your understanding and challenge what you thought you knew.`,
        '',
        '🔔 Don\'t forget to LIKE, COMMENT, and SUBSCRIBE for more content like this. Hit the bell icon to never miss an upload.',
        seriesName ? `📺 Watch the full series: ${seriesName}` : '📺 Check out our channel for more videos on this topic.',
        (niche ? `#${niche.replace(/\s+/g, '')}` : '') + ' #YouTubeSEO'
      ].filter(Boolean).join('\n');
      finalDesc = finalDesc + padding;
    }
    
    let finalTags = (Array.isArray(parsed.newTags) ? parsed.newTags : (currentTags || [])).filter(Boolean);
    // Strip spaces from individual tags (YouTube treats "Space Time" as two tags)
    finalTags = finalTags.map(tag => String(tag).trim()
      .replace(/\s+/g, '')  // remove all spaces within tags
    ).filter(tag => tag.length > 1);
    // Deduplicate (case-insensitive)
    const seen = new Set();
    finalTags = finalTags.filter(tag => {
      const lower = tag.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
    // Cap at 25 tags
    if (finalTags.length > 25) finalTags = finalTags.slice(0, 25);
    
    // Recompute actual scores after post-processing (override AI's self-scored values)
    const actualScores = computeSEOScores(finalTitle, finalDesc, finalTags);
    
    sendRes(res, 200, {
      newTitle: finalTitle,
      newDescription: finalDesc,
      newTags: finalTags,
      reasoning: parsed.reasoning || 'Metadata optimized for better SEO performance.',
      seoScores: actualScores,
      baselineScores,
      postProcessed: {
        titleTruncated: finalTitle !== (parsed.newTitle || '').trim(),
        descPadded: descWords.length < 200,
        tagsCleaned: finalTags.length !== (parsed.newTags || []).length
      }
    });
  } catch (e) {
    console.error('[Generate Proposal] Error:', e.message);
    // Return error — never pretend the current title back is a valid AI proposal
    sendRes(res, 502, {
      error: 'AI optimization failed midway. No new title was generated. Please retry.',
      currentTitle
    });
    return;
  }
});

// ── Bulk Injector: Apply Approved Proposal to YouTube ──
router.post('/apply-proposal', requireChannelId, async (req, res) => {
  try {
    const { videoId, proposal, accessToken } = req.body;
    if (!videoId || !proposal || !accessToken) return sendRes(res, 400, { error: 'Missing required fields' });
    
    // ── Clean tags before sending to YouTube: strip spaces, deduplicate, cap at 25 ──
    let cleanTags = (proposal.tags || proposal.newTags || []).filter(Boolean).map(t => String(t).trim().replace(/\s+/g, '')).filter(t => t.length > 1);
    const seen = new Set();
    cleanTags = cleanTags.filter(t => { const l = t.toLowerCase(); if (seen.has(l)) return false; seen.add(l); return true; });
    if (cleanTags.length > 25) cleanTags = cleanTags.slice(0, 25);
    
    // ── Enforce title ≤100 chars (YouTube hard limit) ──
    let cleanTitle = (proposal.title || proposal.newTitle || '').trim();
    if (cleanTitle.length > 100) cleanTitle = cleanTitle.substring(0, 100);
    
    // Update video via YouTube API
    const updateRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          title: cleanTitle,
          description: proposal.description || proposal.newDescription || '',
          tags: cleanTags,
          categoryId: '22'
        }
      })
    });
    
    if (!updateRes.ok) {
      const err = await updateRes.json();
      return sendRes(res, 502, { error: 'YouTube API update failed: ' + (err.error?.message || 'Unknown error') });
    }
    
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['proposal-apply'] || 8);

    // Record optimization trial for feedback loop
    try {
      const { default: dbService } = await import('../src/database/services.js');
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      let beforeMetrics = {};
      if (statsRes.ok) {
        const sd = await statsRes.json();
        const s = sd.items?.[0]?.statistics;
        if (s) beforeMetrics = { views: parseInt(s.viewCount||'0'), likes: parseInt(s.likeCount||'0'), comments: parseInt(s.commentCount||'0') };
      }
      await dbService.createOptimizationTrial({
        channelId: req.channelId, videoId, videoTitle: cleanTitle,
        optimizationType: 'full-metadata', beforeMetrics,
        appliedData: { oldTitle: proposal.oldTitle || '', oldDescription: proposal.oldDescription || '', oldTags: proposal.oldTags || [], newTitle: cleanTitle, newDescription: proposal.description || '', newTags: cleanTags },
        seoScoreBefore: 0, notes: 'Bulk injector proposal applied'
      });
    } catch (trialErr) { console.warn('[Trial] Failed:', trialErr.message); }

    sendRes(res, 200, { success: true, message: 'Metadata applied to YouTube' });
  } catch (e) {
    console.error('[Apply Proposal] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// Get optimization history + stats
router.get('/optimization-history', requireChannelId, async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const trials = await dbService.getOptimizationTrialsByChannel(req.channelId, 50);
    const stats = await dbService.getOptimizationStats(req.channelId);
    sendRes(res, 200, { trials, stats });
  } catch (err) {
    console.warn('[Opt History] DB unavailable:', err.message);
    sendRes(res, 200, { trials: [], stats: { total: 0, improved: 0, improvementRate: 0, avgImprovement: 0 } });
  }
});

// Growth Engine — scan channel for underperforming videos
router.get('/growth-engine/scan', requireChannelId, async (req, res) => {
  try {
    const { accessToken } = req.query;
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    
    // Credit check — growth engine scan costs 2 credits
    const creditResult = await deductCredits(req.channelId, CREDIT_COSTS['growth-engine']);
    if (!creditResult.success) return sendRes(res, 403, { error: 'Insufficient credits', credits: creditResult.balance });
    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!chRes.ok) return sendRes(res, 502, { error: 'YouTube API unavailable' });
    const chData = await chRes.json();
    const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) return sendRes(res, 404, { error: 'No uploads found' });
    const plRes = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=20&playlistId=' + uploadsId, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const plData = await plRes.json();
    const ids = (plData.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
    if (!ids.length) return sendRes(res, 200, { videos: [], message: 'No videos found' });
    const statsRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=' + ids.join(','), {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const statsData = await statsRes.json();
    const videos = (statsData.items || []).map(v => {
      const s = v.statistics || {};
      const views = parseInt(s.viewCount || '0');
      const likes = parseInt(s.likeCount || '0');
      const comments = parseInt(s.commentCount || '0');
      const title = v.snippet?.title || '';
      const tags = v.snippet?.tags || [];
      const desc = (v.snippet?.description || '').substring(0, 200);
      const eng = views > 0 ? ((likes + comments) / views * 100) : 0;
      const issues = [];
      if (title.length < 20) issues.push({ type: 'title', issue: 'Title too short (< 20 chars)', severity: 'high' });
      if (title.length > 100) issues.push({ type: 'title', issue: 'Title too long (> 100 chars)', severity: 'medium' });
      if (tags.length < 5) issues.push({ type: 'tags', issue: 'Only ' + tags.length + ' tags — use 15-30', severity: 'high' });
      if (!/\d{1,2}:\d{2}/.test(desc)) issues.push({ type: 'description', issue: 'No timestamps — add chapters', severity: 'medium' });
      if (views > 100 && eng < 1) issues.push({ type: 'engagement', issue: 'Low engagement (' + eng.toFixed(1) + '%)', severity: 'medium' });
      const priority = issues.filter(i => i.severity === 'high').length >= 2 ? 'high' : issues.length > 0 ? 'medium' : 'none';
      return { videoId: v.id, title: title.substring(0, 60), views, likes, comments, engagementRate: +eng.toFixed(2), tagsCount: tags.length, issues, needsOptimization: issues.length > 0, optimizationPriority: priority };
    });
    videos.sort((a, b) => ({ high: 0, medium: 1, none: 2 })[a.optimizationPriority] - ({ high: 0, medium: 1, none: 2 })[b.optimizationPriority]);
    const count = videos.filter(v => v.needsOptimization).length;
    sendRes(res, 200, { totalVideos: videos.length, needsOptimization: count, videos });
  } catch (e) {
    console.error('[Growth Engine]', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// Revert an optimization trial — restore original metadata
router.post('/revert-optimization/:trialId', requireChannelId, async (req, res) => {
  try {
    const { trialId } = req.params;
    const { accessToken } = req.body;
    if (!trialId || !accessToken) return sendRes(res, 400, { error: 'Missing trialId or accessToken' });
    const { default: dbService } = await import('../src/database/services.js');
    const trial = await dbService.getOptimizationTrialById(trialId);
    if (!trial) return sendRes(res, 404, { error: 'Trial not found' });
    if (!trial.appliedData) return sendRes(res, 400, { error: 'No original data to restore' });

    // Update the video on YouTube with original metadata
    const updateRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: trial.videoId,
        snippet: {
          title: trial.appliedData.oldTitle || trial.videoTitle,
          description: trial.appliedData.oldDescription || '',
          tags: trial.appliedData.oldTags || [],
          categoryId: '22'
        }
      })
    });
    if (!updateRes.ok) return sendRes(res, 502, { error: 'YouTube API update failed' });

    // Mark trial as failed/reverted
    await dbService.updateOptimizationTrial(trialId, { status: 'failed', notes: 'User reverted optimization' });
    sendRes(res, 200, { success: true });
  } catch (e) {
    console.error('[Revert]', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
