// api/propose-agents/tag-optimizer.js — Rule-based tag proposals (fast)
export async function generateTagFix(scanResult) {
  const { tagScore, videoId } = scanResult;
  if (tagScore >= 60) return null;

  const title = scanResult.videoTitle || '';
  const currentTags = scanResult.currentTags || [];
  const conf = Math.min(90, Math.round(50 + (60 - tagScore) * 1.4));

  // Extract keywords from title as seed tags
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','in','on','at','to','for','of','and','or','but','this','that','with','you','your','my','our','their','its','it','he','she','they','we','i']);
  const titleWords = title.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  
  // Generate seed tags from title + common YouTube tag patterns
  const seedTags = [...new Set([
    ...titleWords.map(w => w.replace(/\s+/g, '-')),
    ...titleWords.slice(0, 3).map(w => `${w}-explained`),
    ...titleWords.slice(0, 2).map(w => `${w}-2026`),
    title.toLowerCase().replace(/[^\w\s]/g,' ').replace(/\s+/g, '-').substring(0, 50),
  ])].filter(t => t.length > 2).slice(0, 10);
  
  // Merge with existing tags, deduplicate
  const mergedTags = [...new Set([...seedTags, ...currentTags.map(t => String(t).toLowerCase().replace(/\s+/g, '-'))])].slice(0, 20);

  // Rule-based improvement notes
  const issues = [];
  if (currentTags.length < 10) issues.push(`add ${Math.max(5, 15 - mergedTags.length)} more tags (currently ${currentTags.length})`);
  if (currentTags.some(t => /\s/.test(String(t)))) issues.push('remove spaces from tags (use hyphens)');
  if (mergedTags.filter(t => t.split('-').length >= 3).length < 3) issues.push('add long-tail tags (3+ word phrases)');
  
  const suggestion = issues.length > 0 ? issues.join('; ') : 'Expand tag strategy';

  return {
    videoId,
    actionType: 'tags',
    proposedText: mergedTags,  // ← ARRAY of actual tags, not a suggestion string
    currentText: currentTags,
    confidence: conf,
    rationale: suggestion,
    scoreBefore: tagScore,
    scoreAfter: Math.min(90, tagScore + 30),
    needsAI: mergedTags.length < 10  // Flag for AI enrichment if too few
  };
}
