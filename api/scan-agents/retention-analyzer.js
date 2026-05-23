// api/scan-agents/retention-analyzer.js — YouTube retention curve analysis
// Detects drop-off points, suggests content fixes for retention optimization
// Integrates: youtube-automation for pulling real retention data

/**
 * Analyze retention data and identify drop-off patterns
 */
export function analyzeRetention(videoId, title, duration, retentionData) {
  // retentionData: array of { second, percentage } or null if not available
  const analysis = {
    videoId,
    title,
    duration,
    overallRetention: 0,
    dropOffPoints: [],
    hookStrength: 0,    // First 30 seconds retention
    bodyStrength: 0,    // Middle section retention
    endingStrength: 0,  // Last 15% retention
    grade: 'C',
    suggestions: []
  };

  if (!retentionData || retentionData.length === 0) {
    // Heuristic fallback based on video metadata
    analysis.overallRetention = estimateRetentionFromMetadata(title, duration);
    analysis.suggestions.push('Connect YouTube Analytics to get precise retention data');
    return analysis;
  }

  // Parse duration to seconds
  const durationSec = parseDuration(duration);
  if (durationSec <= 0) return analysis;

  // Calculate overall retention
  const avgRetention = retentionData.reduce((s, p) => s + p.percentage, 0) / retentionData.length;
  analysis.overallRetention = +avgRetention.toFixed(1);

  // Analyze hook (first 30 seconds or first 15% of video)
  const hookEnd = Math.min(30, durationSec * 0.15);
  const hookPoints = retentionData.filter(p => p.second <= hookEnd);
  analysis.hookStrength = hookPoints.length 
    ? hookPoints.reduce((s, p) => s + p.percentage, 0) / hookPoints.length 
    : 0;

  // Analyze body (middle 60%)
  const bodyStart = durationSec * 0.15;
  const bodyEnd = durationSec * 0.75;
  const bodyPoints = retentionData.filter(p => p.second >= bodyStart && p.second <= bodyEnd);
  analysis.bodyStrength = bodyPoints.length
    ? bodyPoints.reduce((s, p) => s + p.percentage, 0) / bodyPoints.length
    : 0;

  // Analyze ending (last 25%)
  const endStart = durationSec * 0.75;
  const endPoints = retentionData.filter(p => p.second >= endStart);
  analysis.endingStrength = endPoints.length
    ? endPoints.reduce((s, p) => s + p.percentage, 0) / endPoints.length
    : 0;

  // Find drop-off points (where retention drops >15% between consecutive points)
  for (let i = 1; i < retentionData.length; i++) {
    const drop = retentionData[i - 1].percentage - retentionData[i].percentage;
    if (drop > 15) {
      analysis.dropOffPoints.push({
        timestamp: retentionData[i].second,
        drop: +drop.toFixed(1),
        retentionBefore: retentionData[i - 1].percentage,
        retentionAfter: retentionData[i].percentage
      });
    }
  }

  // Grade the retention
  if (analysis.overallRetention >= 70) analysis.grade = 'A';
  else if (analysis.overallRetention >= 55) analysis.grade = 'B';
  else if (analysis.overallRetention >= 40) analysis.grade = 'C';
  else if (analysis.overallRetention >= 25) analysis.grade = 'D';
  else analysis.grade = 'F';

  // Generate suggestions
  if (analysis.hookStrength < 60) {
    analysis.suggestions.push('Weak hook: Open with pattern interrupt in first 5 seconds — state the promise immediately');
  }
  if (analysis.dropOffPoints.length > 0) {
    const biggestDrop = analysis.dropOffPoints.sort((a, b) => b.drop - a.drop)[0];
    analysis.suggestions.push(`Major drop at ${formatTime(biggestDrop.timestamp)}: ${biggestDrop.drop}% of viewers left — add a teaser or chapter marker here`);
  }
  if (analysis.bodyStrength < 50) {
    analysis.suggestions.push('Mid-video fatigue: Add chapter markers, B-roll changes, or pattern interrupts every 2-3 minutes');
  }
  if (analysis.endingStrength < 30 && durationSec > 300) {
    analysis.suggestions.push('Weak ending: Tease whats coming next or add end screen cards to retain viewers');
  }
  if (analysis.overallRetention < 40) {
    analysis.suggestions.push('Overall retention critical: Consider shorter format or restructuring content pacing');
  }

  return analysis;
}

/**
 * Batch analyze retention for multiple videos
 */
export function batchRetentionAnalysis(videos) {
  return videos.map(v => {
    const retentionData = v.retentionData || v.retention || null;
    return analyzeRetention(v.videoId, v.title, v.duration, retentionData);
  }).sort((a, b) => a.overallRetention - b.overallRetention); // Worst first
}

/**
 * Fallback retention estimation from metadata
 */
function estimateRetentionFromMetadata(title, duration) {
  let estimate = 45; // Base
  
  const titleLower = (title || '').toLowerCase();
  if (/\d+/.test(title)) estimate += 8; // List videos retain better
  if (/how|tutorial|guide|learn/i.test(titleLower)) estimate += 10; // Educational retains
  if (/reaction|challenge|prank/i.test(titleLower)) estimate += 5;
  
  const durSec = parseDuration(duration);
  if (durSec < 60) estimate += 15; // Shorts retain better
  else if (durSec < 300) estimate += 5; // Short form
  else if (durSec > 1200) estimate -= 10; // Long form harder to retain
  
  return Math.max(10, Math.min(90, estimate));
}

function parseDuration(duration) {
  if (!duration) return 0;
  // ISO 8601: PT4M13S, PT1H2M10S
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  return h * 3600 + m * 60 + s;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
