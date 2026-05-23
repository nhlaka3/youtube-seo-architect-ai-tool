// api/propose-agents/chapter-suggester.js — Rule-based chapter generation (fast)
export async function generateChapters(scanResult) {
  const { retentionScore, videoId } = scanResult;
  if (retentionScore >= 60) return null;

  const title = scanResult.videoTitle || '';
  const description = scanResult.currentDescription || '';
  if (/\d{1,2}:\d{2}/.test(description)) return null;

  const conf = Math.round(60 + (60 - retentionScore) * 0.7);
  const suggestion = 'Add chapter timestamps (e.g., 0:00 Intro, 2:15 Main Point, 5:30 Key Takeaway). Chapters boost retention and search visibility by 7-15%.';

  return {
    videoId,
    actionType: 'chapters',
    proposedText: suggestion,
    confidence: conf,
    rationale: 'Chapters improve retention and YouTube indexes them for search',
    scoreBefore: retentionScore,
    scoreAfter: Math.min(85, retentionScore + 20),
    needsAI: false
  };
}
