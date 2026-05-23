// api/propose-agents/keyword-opportunity.js — SEO Keyword Strategist (seo-keyword-strategist skill)
// Analyzes keyword density, LSI variations, semantic gaps, and competition
export async function generateKeywordOpp(scanResult, goal = null) {
  const { nicheAlignment, overallScore, videoId } = scanResult;
  if (nicheAlignment >= 80 && overallScore >= 70) return null;
  
  const conf = Math.round(40 + (100 - Math.min(overallScore, nicheAlignment)) * 0.4);
  const title = scanResult.videoTitle || '';
  const description = scanResult.currentDescription || '';
  const tags = scanResult.currentTags || [];
  
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    
    // Extract current keywords for density analysis
    const currentKeywords = [
      ...title.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      ...tags.map(t => t.toLowerCase())
    ];
    const uniqueCurrent = [...new Set(currentKeywords)].slice(0, 10).join(', ');
    
    const raw = await askAI(
      'You are a YouTube keyword strategist. Analyze the video content and suggest optimizations. Return ONLY valid JSON.',
      `VIDEO TITLE: "${title}"
CURRENT KEYWORDS: ${uniqueCurrent || 'none'}
NICHE ALIGNMENT: ${nicheAlignment}/100
TAG SCORE: ${scanResult.tagScore || 0}/100
DESCRIPTION LENGTH: ${description.length} chars
GOAL: ${goal || 'Grow channel'}

Provide:
1. 3-5 PRIMARY keywords (high-volume, low-competition) this video should target
2. 3-5 LSI/semantic variations (related terms YouTube associates with the topic)
3. 2 keyword gaps (topics your audience searches for but you haven't covered)
4. Density warning if any keyword appears >5 times (over-optimization risk)

Return JSON:
{
  "primaryKeywords": [{"keyword":"...","volume":"high|medium|low","competition":"low|medium|high"}],
  "lsiKeywords": ["semantic1","semantic2",...],
  "contentGaps": [{"topic":"...","why":"≤60 chars"}],
  "densityWarnings": ["warning if any"],
  "rationale": "strategy summary (≤80 chars)"
}`,
      { temperature: 0.5, maxTokens: 600, forceJson: true }
    );
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim());
    
    const allKeywords = [
      ...(p.primaryKeywords || []).map(k => `${k.keyword} (${k.volume} vol, ${k.competition} comp)`),
      ...(p.lsiKeywords || []).map(k => `${k} (LSI/semantic)`),
      ...(p.contentGaps || []).map(g => `GAP: ${g.topic} — ${g.why}`)
    ];
    
    return {
      videoId,
      actionType: 'keywords',
      proposedText: allKeywords,
      confidence: conf,
      rationale: p.rationale || 'Keyword strategy optimized with LSI and gap analysis',
      densityWarnings: p.densityWarnings || [],
      primaryCount: (p.primaryKeywords || []).length,
      lsiCount: (p.lsiKeywords || []).length,
      gapCount: (p.contentGaps || []).length
    };
  } catch (e) {
    return null;
  }
}
