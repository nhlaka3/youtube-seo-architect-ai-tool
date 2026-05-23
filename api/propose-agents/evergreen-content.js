// api/propose-agents/evergreen-content.js — Wraps Task 11B PSEO — suggests SEO pages for low-score videos
export async function generateEvergreen(scanResult, goal = null) {
  const { overallScore, videoId } = scanResult;
  if (overallScore >= 80) return null;
  
  const title = scanResult.videoTitle || '';
  const conf = Math.round(45 + (55 - overallScore) * 0.8);
  
  return {
    videoId,
    actionType: 'evergreen',
    proposedText: `SEO page targeting keywords from "${title}"`,
    confidence: conf,
    rationale: 'Low-scoring video — SEO page can capture search traffic independently',
    scoreBefore: overallScore,
    scoreAfter: Math.min(80, overallScore + 25)
  };
}
