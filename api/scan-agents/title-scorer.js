// api/scan-agents/title-scorer.js — Wraps Task 02 SEO scoring for silent background scanning
import { computeSEOScores } from '../_lib/seo-analyzer.js';

/**
 * Score a single video's title silently — no UI, no queue, no alerts.
 * Called by the unified scan runner.
 */
export async function scoreTitle(video) {
  const title = video.title || '';
  const description = video.description || '';
  const tags = video.tags || [];
  const isShort = video.format === 'short';
  
  // Shorts use different scoring — titles up to 100 chars, description less important
  const scores = computeSEOScores(title, description, tags);
  
  if (isShort) {
    // Shorts adjustments: title leniency (100 char limit), tags matter less, #shorts hashtag bonus
    let shortTitle = scores.title;
    if (title.length <= 100) shortTitle += 10; // Shorts allow longer titles
    if (/#shorts/i.test(title + ' ' + description)) shortTitle += 15;
    shortTitle = Math.min(100, shortTitle);
    
    return {
      videoId: video.videoId,
      channelId: video.channelId,
      titleScore: shortTitle,
      descScore: Math.min(100, scores.desc + 5), // desc less critical for Shorts
      tagScore: Math.min(100, scores.tags - 10), // tags nearly irrelevant
      overallScore: Math.round(shortTitle * 0.4 + (scores.desc + 5) * 0.2 + (scores.tags - 10) * 0.1 + 30),
      views: video.views || 0,
      engagement: video.engagementRate || 0,
      issues: video.issues || [],
      compliance: { ...scores.compliance, isShort: true }
    };
  }
  
  return {
    videoId: video.videoId,
    channelId: video.channelId,
    titleScore: scores.title,
    descScore: scores.desc,
    tagScore: scores.tags,
    overallScore: scores.overall,
    views: video.views || 0,
    engagement: video.engagementRate || 0,
    issues: video.issues || [],
    compliance: scores.compliance || {}
  };
}
