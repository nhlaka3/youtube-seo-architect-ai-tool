// api/propose-agents/title-fixer.js — Rule-based + AI-fallback title proposals
// NOTE: proposedText MUST be a real optimized title string, not an instruction list.

const POWER_WORDS = ['Proven', 'Secret', 'Ultimate', 'Essential', 'Complete', 'Definitive', 'Powerful', 'Critical'];
const NUMBER_CHOICES = [4, 5, 7, 10, 12];
const BRACKET_VARIANTS = ['(2026)', '[FULL GUIDE]', '(Step by Step)', 'Ultimate Edition'];

/** Clean a title: strip appended qualifiers and trailing whitespace */
function cleanForTemplate(raw) {
  return raw.split(/\s*\|\s*/)[0].replace(/\s+/g, ' ').trim();
}

/** Extract the essence of the title = first meaningful phrase, trimmed */
function titleEssence(title) {
  const t = cleanForTemplate(title);
  return t || 'Amazing Topic';
}

/** Check if two titles are trivially similar — only differ by generic prefixes/suffixes */
function isTriviallySimilar(proposed, current) {
  const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
    .replace(/[()\[\]{}#]/g, '')
    .replace(/\b(2026|2025|2024|full guide|step by step|ultimate edition|complete|essential|definitive|powerful|proven|secret|ultimate|critical|the|a|an|how to|why|what is)\b/gi, '');
  
  const pNorm = norm(proposed);
  const cNorm = norm(current);
  
  // If the core content is identical after stripping generic words, they're too similar
  if (pNorm === cNorm) return true;
  
  // If one is contained within the other after normalization
  if (pNorm.includes(cNorm) || cNorm.includes(pNorm)) return true;
  
  // Levenshtein-like: if >85% of shorter string is in the longer one
  const shorter = pNorm.length < cNorm.length ? pNorm : cNorm;
  const longer = pNorm.length < cNorm.length ? cNorm : pNorm;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  const similarity = matches / shorter.length;
  if (similarity > 0.85 && Math.abs(pNorm.length - cNorm.length) < 20) return true;
  
  return false;
}

/** Build candidate title strings from templates chosen to address detected issues */
function buildCandidates(title, improvements) {
  const t = titleEssence(title);
  const hasNumber  = improvements.includes('add a number');
  const lacksPower = improvements.includes('add power word');
  const tooShort   = improvements.includes('add descriptive keywords');
  const tooLong    = improvements.includes('trim title');
  const isShorts   = improvements.includes('add #shorts');

  const w = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
  const w2 = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
  const n = NUMBER_CHOICES[Math.floor(Math.random() * NUMBER_CHOICES.length)];
  const n2 = NUMBER_CHOICES[Math.floor(Math.random() * NUMBER_CHOICES.length)];
  const b = BRACKET_VARIANTS[Math.floor(Math.random() * BRACKET_VARIANTS.length)];
  const b2 = BRACKET_VARIANTS[Math.floor(Math.random() * BRACKET_VARIANTS.length)];

  const cands = [];

  if (hasNumber) {
    cands.push(`${n} ${w} ${t} ${b}`);
    if (tooShort) cands.push(`How to ${t}: The Complete ${w} Guide`);
  }

  if (tooLong) {
    const cut = (x) => (x.length <= 55 ? x : x.substring(0, 55).replace(/\s+\S*$/, ''));
    const shortened = cut(t);
    if (shortened !== t) cands.push(shortened); // Only add if actually shortened
    cands.push(`${w}: ${t.substring(0, 42)} — Full Breakdown ${b}`);
  }

  if (lacksPower && !hasNumber) {
    cands.push(`${w} ${t} ${b}`);
    cands.push(`Here's the Truth About ${t}`);
    cands.push(`How to ${t} — ${w} Tips`);
  }

  if (tooShort) {
    cands.push(`How to ${t}: ${w} Guide`);
    cands.push(`Why ${t} Matters`);
    cands.push(`${t}: What Nobody Tells You ${b}`);
  }

  if (isShorts && cands.length > 0) {
    cands.push(`${cands[0]} #shorts`);
  }

  // Always generate diverse candidates even with no specific improvements
  if (cands.length < 3) {
    cands.push(`${w} ${t} — ${n2} Things You Must Know`);
    cands.push(`The ${w2} Approach to ${t}`);
    cands.push(`${t}: ${n} ${w2} Strategies ${b2}`);
  }

  if (cands.length < 2) {
    cands.push(`Everything You Want to Know About ${t}`);
  }

  return cands;
}

/** Score and pick the best candidate — rejecting trivially similar ones */
function smartPick(candidates, currentTitle) {
  const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
  const base = norm(currentTitle);

  const scored = candidates
    .filter(c => {
      // Reject malformed candidates
      if (c.includes('\n') || c.includes('\r') || c.includes('|') || c.length < 10 || c.length > 95) return false;
      // Reject trivially similar titles
      if (isTriviallySimilar(c, currentTitle)) return false;
      return true;
    })
    .map(c => ({
      title: c,
      score: (Math.abs(c.length - currentTitle.length) * 3) + (norm(c) !== base ? 60 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.title || candidates[0];
}

/** AI fallback: ask Groq for a real title when rule-based ones are insufficient */
async function aiTitleFix(currentTitle, improvements, niche, goal) {
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    const prompt = `Rewrite this YouTube video title to be more clickable and SEO-optimized. 
    
CURRENT TITLE: "${currentTitle}"
ISSUES TO FIX: ${improvements.length > 0 ? improvements.join(', ') : 'Make more engaging and click-worthy'}
${niche ? `NICHE: ${niche}` : ''}
${goal ? `CHANNEL GOAL: ${goal}` : ''}

RULES:
- Keep it under 60 characters
- Include a number if possible
- Use power words (Proven, Secret, Ultimate, Essential)
- Make the viewer curious — create an information gap
- Do NOT just add generic prefixes/suffixes to the current title
- Return ONLY the new title, nothing else — no quotes, no explanation`;

    const result = await askAI('You are a YouTube title optimization expert. Return ONLY the optimized title.', prompt, { temperature: 0.8, maxTokens: 100 });
    const clean = result.replace(/^["']|["']$/g, '').trim().substring(0, 100);
    
    // Validate: not empty, not identical to original, not trivially similar
    if (!clean || clean.length < 10) return null;
    if (clean.toLowerCase() === currentTitle.toLowerCase()) return null;
    if (isTriviallySimilar(clean, currentTitle)) return null;
    
    return clean;
  } catch (e) {
    return null; // AI unavailable — fall through to rule-based
  }
}

export async function generateTitleFix(scanResult, goal = null) {
  const { titleScore, overallScore, issues, videoId, format } = scanResult;
  const isShort = format === 'short';
  const threshold = isShort ? 75 : 65;
  if (titleScore >= threshold) return null;

  const title = scanResult.videoTitle || '';
  const conf = Math.min(95, Math.round(50 + (threshold - titleScore) * 1.5));

  // Rule-based diagnostics
  const improvements = [];
  const titleLen = title.length;
  const maxLen = isShort ? 100 : 60;

  if (titleLen > maxLen) improvements.push('trim title');
  if (titleLen < 25 && !isShort) improvements.push('add descriptive keywords');
  if (!/[0-9]/.test(title)) improvements.push('add a number');
  if (!/(how|why|what|best|top|ultimate|secret|proven|power|essential|complete|definitive)/i.test(title)) improvements.push('add power word');
  if (isShort && !/#shorts/i.test(title)) improvements.push('add #shorts');

  const rationale = improvements.length > 0
    ? improvements.join(', ')
    : 'Optimize title structure';

  // Concrete title from templates, NOT a description of issues
  const rawCandidates = buildCandidates(title, improvements);
  let proposedText = smartPick(rawCandidates, title);

  // ' | ' rejection block
  proposedText = proposedText.split(/\s*\|\s*/)[0].trim();

  // If rule-based generation failed or produced a trivially similar title, try AI
  if (!proposedText || proposedText.length < 10 || isTriviallySimilar(proposedText, title)) {
    const niche = scanResult.niche || scanResult.nicheAlignment || 'General';
    const aiTitle = await aiTitleFix(title, improvements, niche, goal);
    if (aiTitle) proposedText = aiTitle;
  }

  // Final safeguard: never hand back the current title unmangled
  if (proposedText.trim().toLowerCase() === title.trim().toLowerCase()) {
    const ess = titleEssence(title);
    proposedText = `${POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)]} ${ess} ${BRACKET_VARIANTS[Math.floor(Math.random() * BRACKET_VARIANTS.length)]}`;
  }

  // If STILL too similar after all attempts, skip this proposal entirely
  if (isTriviallySimilar(proposedText, title)) {
    return null;
  }

  return {
    videoId,
    actionType: 'title',
    proposedText,
    currentText: title,
    confidence: conf,
    rationale,
    predictedLift: `Est. +${Math.round((threshold - titleScore) * 0.8)}% CTR`,
    scoreBefore: titleScore,
    scoreAfter: Math.min(95, titleScore + 25),
    needsAI: true
  };
}
