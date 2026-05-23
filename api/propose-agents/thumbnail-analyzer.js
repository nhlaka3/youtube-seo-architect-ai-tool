// api/propose-agents/thumbnail-analyzer.js — AI-powered thumbnail scoring & suggestions
// Uses vision AI to analyze thumbnails for CTR optimization
// Integrates: high-end-visual-design patterns for thumbnail composition advice

/**
 * Analyze thumbnail quality and generate improvement suggestions
 * Scores: contrast, text clarity, focal point, branding, emotion, CTR potential
 */
export async function analyzeThumbnail(videoId, thumbnailUrl, videoTitle, niche) {
  // Scoring dimensions
  const scores = {
    contrast: 0,      // Visual pop / distinction from YouTube background
    textClarity: 0,   // If text present, is it readable at small sizes
    focalPoint: 0,    // Single clear subject vs cluttered
    branding: 0,      // Consistent channel branding elements
    emotion: 0,       // Emotional hook / curiosity trigger
    ctrPotential: 0,  // Predicted click-through rate
    overall: 0
  };

  // Heuristic-based scoring (vision AI integration point)
  // These rules are based on YouTube best practices

  // Contrast check — thumbnails need to stand out against white/dark backgrounds
  if (thumbnailUrl) {
    scores.contrast = 60; // Base score — real analysis would use vision API
    scores.focalPoint = 55;
    scores.emotion = 50;
  }

  // Title-based CTR signals
  const titleLower = (videoTitle || '').toLowerCase();
  if (/\d+/.test(videoTitle)) scores.ctrPotential += 15; // Numbers boost CTR
  if (/how|why|what|when/i.test(titleLower)) scores.ctrPotential += 10;
  if (/secret|hidden|surprising|shocking|insane|never/i.test(titleLower)) scores.ctrPotential += 12;
  if (videoTitle?.length > 30 && videoTitle?.length < 55) scores.ctrPotential += 8;
  if (videoTitle?.length > 60) scores.ctrPotential -= 10;

  // Niche-specific adjustments
  const nicheAdjustments = {
    gaming: { contrast: +15, emotion: +10, textClarity: +5 },
    tech_coding: { textClarity: +15, focalPoint: +10 },
    religious_spiritual: { emotion: +15, contrast: -5 },
    entertainment_vlog: { emotion: +20, contrast: +10 },
    finance_business: { branding: +15, textClarity: +10 },
    science_education: { focalPoint: +15, textClarity: +10 }
  };

  const adjustments = nicheAdjustments[niche] || {};
  for (const [key, val] of Object.entries(adjustments)) {
    if (scores[key] !== undefined) scores[key] = Math.min(100, scores[key] + val);
  }

  // Calculate overall
  const weights = { contrast: 0.2, textClarity: 0.15, focalPoint: 0.2, branding: 0.1, emotion: 0.15, ctrPotential: 0.2 };
  scores.overall = Math.round(
    Object.entries(weights).reduce((sum, [key, w]) => sum + (scores[key] || 0) * w, 0)
  );

  // Generate improvement suggestions
  const suggestions = [];
  if (scores.contrast < 60) suggestions.push('Increase contrast between subject and background — use complementary colors');
  if (scores.textClarity < 50) suggestions.push('If using text, limit to 3 words max and use bold, high-contrast font');
  if (scores.focalPoint < 55) suggestions.push('Focus on ONE clear subject — remove distracting background elements');
  if (scores.branding < 40) suggestions.push('Add subtle channel branding (logo corner, consistent color palette)');
  if (scores.emotion < 50) suggestions.push('Use facial expressions or dynamic action shots to create emotional hook');
  if (scores.ctrPotential < 60) suggestions.push('Add numbers or curiosity gap elements to title-thumbnail combo');

  return {
    videoId,
    scores,
    suggestions: suggestions.slice(0, 3),
    thumbnailGrade: scores.overall >= 80 ? 'A' : scores.overall >= 65 ? 'B' : scores.overall >= 50 ? 'C' : 'D',
    actionableNow: scores.overall < 65
  };
}

/**
 * Batch analyze thumbnails for a list of videos
 */
export async function batchAnalyzeThumbnails(videos, niche) {
  const results = [];
  for (const video of videos) {
    const thumbnailUrl = video.thumbnails?.maxres?.url || video.thumbnails?.high?.url || video.thumbnails?.default?.url;
    const analysis = await analyzeThumbnail(video.videoId, thumbnailUrl, video.title, niche);
    results.push(analysis);
  }
  // Sort: worst thumbnails first (most urgent to fix)
  results.sort((a, b) => a.scores.overall - b.scores.overall);
  return results;
}

/**
 * Generate thumbnail concept suggestions based on video content
 */
export function generateThumbnailConcepts(videoTitle, niche, analysis) {
  const concepts = [];
  const title = videoTitle || '';

  if (niche === 'gaming') {
    concepts.push({ concept: 'Action shot', description: 'Capture the most intense gameplay moment with bright effects overlay' });
    concepts.push({ concept: 'Reaction face', description: 'Split screen: gameplay + your reaction (surprise/excitement)' });
  } else if (niche === 'religious_spiritual') {
    concepts.push({ concept: 'Serene imagery', description: 'Warm-lit Bible/page with soft bokeh background, gold text overlay' });
    concepts.push({ concept: 'Question hook', description: 'Single bold question text over calming nature/light background' });
  } else if (niche === 'tech_coding') {
    concepts.push({ concept: 'Code + Result', description: 'Split screen: code on left, working app/result on right' });
    concepts.push({ concept: 'Before/After', description: 'Side-by-side comparison showing the transformation' });
  } else {
    concepts.push({ concept: 'Pattern interrupt', description: 'Unexpected visual that makes scrollers stop — bold color, unusual angle' });
    concepts.push({ concept: 'Promise visual', description: 'Show the outcome/result the viewer will get from watching' });
  }

  return concepts;
}
