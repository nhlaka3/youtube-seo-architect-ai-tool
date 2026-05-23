// api/recommend-agents/shorts-clips.js — Long-form repurposing suggestions
export async function suggestShortsClips(scanResults) {
  const candidates = scanResults.filter(s => 
    s.views > 200 && (s.retentionScore < 50 || s.ctrSignal < 35)
  );
  if (candidates.length === 0) return null;
  
  return candidates.slice(0, 2).map(s => ({
    type: 'shorts',
    priority: 'low',
    message: `🎬 Shorts opportunity: Extract a 30-60s clip from "${s.videoTitle?.substring(0, 40) || 'video'}" (${s.views} views). Repurpose the strongest hook moment as a standalone Short to drive channel traffic.`,
    readStatus: false
  }));
}
