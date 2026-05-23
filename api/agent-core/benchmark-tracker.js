// api/agent-core/benchmark-tracker.js — CTR before/after measurement (benchmark skill)
// Closes the feedback loop: did applied optimizations actually improve metrics?

export async function trackBenchmark(proposalId, videoId, accessToken) {
  if (!accessToken) return { measured: false, reason: 'No access token' };

  try {
    // Fetch current video stats
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
      { headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return { measured: false, reason: 'API unavailable' };

    const data = await res.json();
    const stats = data.items?.[0]?.statistics || {};
    const views = parseInt(stats.viewCount || '0');
    const likes = parseInt(stats.likeCount || '0');
    const comments = parseInt(stats.commentCount || '0');
    const engagement = views > 0 ? ((likes + comments) / views * 100) : 0;

    return {
      measured: true,
      videoId,
      proposalId,
      views,
      likes,
      comments,
      engagementRate: +engagement.toFixed(2),
      measuredAt: new Date().toISOString()
    };
  } catch (e) {
    return { measured: false, reason: e.message };
  }
}

// Compare before/after benchmarks and compute lift
export function computeLift(before, after) {
  if (!before || !after || !before.measured || !after.measured) return null;

  const viewLift = before.views > 0 
    ? ((after.views - before.views) / before.views * 100).toFixed(1) 
    : 'N/A';
  const engLift = before.engagementRate > 0 
    ? ((after.engagementRate - before.engagementRate) / before.engagementRate * 100).toFixed(1) 
    : 'N/A';

  return {
    viewLift: `${viewLift}%`,
    engLift: `${engLift}%`,
    viewsBefore: before.views,
    viewsAfter: after.views,
    engagementBefore: before.engagementRate,
    engagementAfter: after.engagementRate,
    significant: Math.abs(parseFloat(viewLift)) > 5 || Math.abs(parseFloat(engLift)) > 5
  };
}
