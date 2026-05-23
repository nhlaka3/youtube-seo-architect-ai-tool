// api/recommend-agents/thumbnail-alert.js — CTR drop alerts + redesign tips
export async function checkThumbnailAlert(scanResult) {
  if (scanResult.ctrSignal >= 40 || scanResult.views < 200) return null;
  
  const priority = scanResult.ctrSignal < 20 ? 'high' : 'medium';
  return {
    type: 'thumbnail',
    priority,
    message: `⚠️ Low CTR signal (${scanResult.ctrSignal}/100) on "${scanResult.videoTitle || 'video'}". Consider: high-contrast thumbnail, 3-word max text, one clear focal point, test 2 variants.`,
    readStatus: false
  };
}
