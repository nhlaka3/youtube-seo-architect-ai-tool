// api/scan-agents/ctr-scanner.js — Pulls CTR signals from video engagement data
export async function scanCTR(video) {
  const views = video.views || 0;
  const engagement = video.engagementRate || 0;
  // CTR signal: 0-100 scale based on engagement rate
  // <1% = poor, 1-3% = moderate, 3-5% = good, >5% = excellent
  let ctrSignal = 0;
  if (views > 0) {
    if (engagement >= 5) ctrSignal = 95;
    else if (engagement >= 3) ctrSignal = 75;
    else if (engagement >= 1.5) ctrSignal = 50;
    else if (engagement >= 0.5) ctrSignal = 25;
    else ctrSignal = 10;
  }
  if (views < 100) ctrSignal = Math.min(ctrSignal, 30); // not enough data
  
  return {
    videoId: video.videoId,
    ctrSignal,
    views,
    engagement,
    needsAttention: ctrSignal < 40 && views > 100
  };
}
