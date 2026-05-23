// api/scan-agents/retention-tracker.js — Retention/drop-off analysis from video metadata
export async function trackRetention(video) {
  const description = video.description || '';
  const views = video.views || 0;
  const engagement = video.engagementRate || 0;
  
  // Retention score based on available signals
  let retentionScore = 50;
  
  // Timestamps/chapters = better retention
  if (/\d{1,2}:\d{2}/.test(description)) retentionScore += 20;
  
  // High engagement relative to views = good retention
  if (views > 100 && engagement > 2) retentionScore += 15;
  
  // Description length signals effort (longer = likely better structure)
  if (description.length > 500) retentionScore += 10;
  if (description.length > 1000) retentionScore += 5;
  
  // Penalize: short descriptions with low engagement
  if (description.length < 100 && views > 100 && engagement < 1) retentionScore -= 20;
  
  retentionScore = Math.max(0, Math.min(100, retentionScore));
  
  return {
    videoId: video.videoId,
    retentionScore,
    hasChapters: /\d{1,2}:\d{2}/.test(description),
    descLength: description.length,
    needsChapters: retentionScore < 60 && !/\d{1,2}:\d{2}/.test(description)
  };
}
