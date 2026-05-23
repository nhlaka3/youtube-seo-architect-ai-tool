// api/_lib/seo-analyzer.js

/**
 * Compute baseline SEO scores (vidIQ-style 0-100 grading)
 * @param {string} title 
 * @param {string} description 
 * @param {string[]} tags 
 * @returns {Object}
 */
export function computeSEOScores(title, description, tags) {
  const t = (title || '').trim();
  const d = (description || '').trim();
  const tg = (tags || []).filter(x => x && String(x).trim());
  const wordCount = d ? d.split(/\s+/).filter(w => w.length > 1).length : 0;

  // ── Title scoring (0-100) ── YouTube 2026: ≤60 chars is mandatory for search visibility
  let titleScore = 30;
  // LENGTH: Hard penalty if over 60 (YouTube truncates in search/related)
  if (t.length > 0 && t.length <= 60) titleScore += 25;
  else if (t.length > 60 && t.length <= 70) titleScore += 8;
  else titleScore -= 10; // over 70 = clipped badly
  // Front-loaded keyword: first 45 chars are the visible portion in search
  if (t.length >= 15 && t.substring(0, 45).length >= 10) titleScore += 8;
  // Power words / emotional triggers
  if (/[0-9]/.test(t)) titleScore += 8;
  if (/[\[\]\(\)]/.test(t)) titleScore += 6;
  if (/[!?]/.test(t)) titleScore += 3;
  const powerWords = /how|why|what|when|top|best|secret|shocking|proven|revealed|exposed|uncovered|hidden|truth|insane|ultimate|essential|surprising|you.need|must.watch|never.knew/i;
  if (powerWords.test(t)) titleScore += 10;
  // Avoid clickbait penalty (all-caps, excessive !!!)
  if (/[A-Z]{15,}/.test(t)) titleScore -= 8;
  if (/!!+|\?\?+/.test(t)) titleScore -= 5;
  titleScore = Math.max(0, Math.min(100, titleScore));

  // ── Description scoring (0-100) ── YouTube 2026: ≥200 words strongly recommended
  let descScore = 20;
  // Word count is the primary signal (YouTube recommends 200+ words)
  if (wordCount >= 200) descScore += 30;
  else if (wordCount >= 150) descScore += 20;
  else if (wordCount >= 100) descScore += 10;
  else if (wordCount >= 50) descScore += 5;
  // Character length as secondary signal
  if (d.length >= 1500) descScore += 10;
  else if (d.length >= 1000) descScore += 6;
  // Hashtags (YouTube allows up to 3 in description)
  if (/#[a-zA-Z0-9_]+/.test(d)) descScore += 5;
  // CTA presence
  if (/subscribe|watch|follow|check.out|learn more|like|comment|share|hit the/i.test(d)) descScore += 8;
  // Links (external or internal)
  if (/http[s]?:\/\//.test(d)) descScore += 5;
  // Keyword integration in description body
  if (tg.length > 0 && tg.some(tag => d.toLowerCase().includes(tag.toLowerCase()))) descScore += 10;
  // Timestamps/chapters (YouTube 2026 ranking factor)
  if (/\d{1,2}:\d{2}/.test(d)) descScore += 7;
  descScore = Math.max(0, Math.min(100, descScore));

  // ── Tags scoring (0-100) ── YouTube 2026: 500 char total limit, no spaces within tags
  let tagScore = 15;
  // Count check (10-25 is sweet spot; YouTube stores them as comma-separated)
  if (tg.length >= 10 && tg.length <= 25) tagScore += 25;
  else if (tg.length >= 5 && tg.length <= 30) tagScore += 15;
  else if (tg.length > 30) tagScore += 5; // overstuffing
  // Penalty for tags with internal spaces (they become separate tags on YouTube)
  const spacedTags = tg.filter(tag => /\s/.test(String(tag)));
  if (spacedTags.length === 0) tagScore += 15;
  else tagScore -= spacedTags.length * 3;
  // Long-tail coverage (3+ word phrases)
  const longTailTags = tg.filter(tag => String(tag).split(/\s+/).length >= 3);
  if (longTailTags.length >= 5) tagScore += 15;
  else if (longTailTags.length >= 2) tagScore += 8;
  // Broad + specific mix: penalize if all tags are 1-word (too generic)
  const singleWordTags = tg.filter(tag => String(tag).split(/\s+/).length === 1);
  if (singleWordTags.length > tg.length * 0.6) tagScore -= 10;
  // Total tag character utilization (YouTube 500 char limit)
  const totalTagChars = tg.join('').length;
  if (totalTagChars >= 200 && totalTagChars <= 500) tagScore += 10;
  else if (totalTagChars > 500) tagScore -= 5;
  // Duplicate detection
  const uniqueTags = new Set(tg.map(t => t.toLowerCase()));
  if (uniqueTags.size < tg.length) tagScore -= (tg.length - uniqueTags.size) * 3;
  tagScore = Math.max(0, Math.min(100, tagScore));

  const overall = Math.round((titleScore * 0.35 + descScore * 0.35 + tagScore * 0.30));

  return {
    title: titleScore, desc: descScore, tags: tagScore, overall,
    compliance: {
      titleLength: t.length <= 60 ? 'pass' : 'fail',
      titleLengthChars: t.length,
      descWordCount: wordCount,
      descMinWordsMet: wordCount >= 200,
      tagsHaveSpaces: spacedTags.length > 0,
      tagsSpaceCount: spacedTags.length,
      tagsDuplicateCount: tg.length - uniqueTags.size
    }
  };
}
