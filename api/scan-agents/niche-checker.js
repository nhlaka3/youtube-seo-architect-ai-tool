// api/scan-agents/niche-checker.js — Niche alignment scoring
export async function checkNiche(video, niche = 'General') {
  const title = (video.title || '').toLowerCase();
  const tags = (video.tags || []).map(t => t.toLowerCase());
  const description = (video.description || '').toLowerCase();
  
  const nicheTerms = niche.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (nicheTerms.length === 0) return { videoId: video.videoId, nicheAlignment: 70, niche };
  
  let matches = 0;
  const allText = title + ' ' + description + ' ' + tags.join(' ');
  
  nicheTerms.forEach(term => {
    if (allText.includes(term)) matches++;
  });
  
  const alignment = nicheTerms.length > 0 
    ? Math.round((matches / nicheTerms.length) * 100)
    : 70;
  
  return {
    videoId: video.videoId,
    nicheAlignment: Math.max(20, alignment),
    niche,
    offNiche: alignment < 40
  };
}
