// api/scan-agents/analytics-sync.js — Background data pull for analytics
export async function syncAnalytics(videos) {
  // Summarize analytics across all videos
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const avgEngagement = videos.length > 0
    ? videos.reduce((s, v) => s + (v.engagementRate || 0), 0) / videos.length
    : 0;
  const lowEngagementCount = videos.filter(v => (v.engagementRate || 0) < 1.5 && (v.views || 0) > 100).length;
  const noChaptersCount = videos.filter(v => !/\d{1,2}:\d{2}/.test(v.description || '')).length;
  const shortDescCount = videos.filter(v => (v.description || '').length < 200).length;
  
  return {
    totalVideos: videos.length,
    totalViews,
    avgEngagement: +avgEngagement.toFixed(2),
    lowEngagementCount,
    noChaptersCount,
    shortDescCount,
    summary: `${videos.length} videos scanned (${videos.filter(v=>v.format==='short').length} Shorts, ${videos.filter(v=>v.format!=='short').length} long-form) | ${totalViews.toLocaleString()} total views | ${avgEngagement.toFixed(1)}% avg engagement | ${lowEngagementCount} need CTR work | ${noChaptersCount} missing timestamps`
  };
}
