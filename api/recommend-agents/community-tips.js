// api/recommend-agents/community-tips.js — Pain points → engagement tactics
export async function suggestCommunityTips(scanResults) {
  const lowEngagement = scanResults.filter(s => s.engagement < 2 && s.views > 100);
  if (lowEngagement.length === 0) return null;
  
  return [{
    type: 'community',
    priority: 'medium',
    message: `💬 Community tip: ${lowEngagement.length} videos have low engagement. Post a community poll asking viewers what content they want next. Pin a comment asking a specific question. Reply to every comment within 48h.`,
    readStatus: false
  }];
}
