// api/agent-core/niche-detector.js — Auto-detects channel niche and adapts scoring/proposals
// Integrates: brand-voice, content-engine, tutorial-engineer, seo-keyword-strategist

const NICHE_PATTERNS = {
  science_education: {
    keywords: ['science', 'physics', 'chemistry', 'biology', 'math', 'explain', 'how', 'why', 'experiment', 'theory', 'discovery', 'research', 'decoded', 'simplified', 'learn', 'education', 'tutorial', 'concept', 'breakdown', 'explained'],
    titleWeight: 0.30, descWeight: 0.40, tagWeight: 0.30,
    descMinWords: 300, // science needs thorough descriptions
    powerWords: ['explained', 'simplified', 'decoded', 'demystified', 'breakdown', 'visualized'],
    avoidWords: ['shocking', 'secret', 'insane'],
    strategy: 'educational_depth'
  },
  religious_spiritual: {
    keywords: ['bible', 'god', 'jesus', 'prayer', 'faith', 'christian', 'scripture', 'verse', 'worship', 'spiritual', 'church', 'holy', 'gospel', 'psalm', 'proverb'],
    titleWeight: 0.35, descWeight: 0.35, tagWeight: 0.30,
    descMinWords: 200,
    powerWords: ['powerful', 'inspiring', 'hope', 'strength', 'peace', 'comfort'],
    strategy: 'community_engagement'
  },
  gaming: {
    keywords: ['game', 'gaming', 'playthrough', 'walkthrough', 'gameplay', 'lets play', 'twitch', 'stream', 'boss', 'level', 'esports', 'minecraft', 'fortnite', 'roblox'],
    titleWeight: 0.45, descWeight: 0.25, tagWeight: 0.30,
    descMinWords: 100,
    powerWords: ['insane', 'impossible', 'pro', 'speedrun', 'world record', 'clutch'],
    strategy: 'ctr_heavy'
  },
  tech_coding: {
    keywords: ['code', 'programming', 'python', 'javascript', 'react', 'tutorial', 'developer', 'software', 'app', 'build', 'api', 'ai', 'machine learning', 'data', 'algorithm'],
    titleWeight: 0.30, descWeight: 0.40, tagWeight: 0.30,
    descMinWords: 300,
    powerWords: ['build', 'create', 'learn', 'tutorial', 'guide', 'crash course'],
    strategy: 'educational_depth'
  },
  entertainment_vlog: {
    keywords: ['vlog', 'day in', 'challenge', 'prank', 'reaction', 'haul', 'routine', 'storytime', 'grwm', 'q&a'],
    titleWeight: 0.45, descWeight: 0.20, tagWeight: 0.35,
    descMinWords: 150,
    powerWords: ['honest', 'raw', 'emotional', 'shocking', 'never before'],
    strategy: 'ctr_heavy'
  },
  finance_business: {
    keywords: ['money', 'invest', 'stock', 'crypto', 'business', 'entrepreneur', 'passive income', 'wealth', 'finance', 'trading', 'startup', 'side hustle'],
    titleWeight: 0.40, descWeight: 0.35, tagWeight: 0.25,
    descMinWords: 250,
    powerWords: ['proven', 'secret', 'strategy', 'wealth', 'financial freedom'],
    strategy: 'authority_building'
  }
};

// Detect niche from video titles, tags, and descriptions
export function detectNiche(videos) {
  if (!videos || videos.length === 0) return { niche: 'General', config: getDefaultConfig() };
  
  const allText = videos.slice(0, 20).map(v => 
    ((v.title || '') + ' ' + (v.description || '') + ' ' + (v.tags || []).join(' ')).toLowerCase()
  ).join(' ');
  
  let bestMatch = { niche: 'General', score: 0, config: getDefaultConfig() };
  
  for (const [niche, pattern] of Object.entries(NICHE_PATTERNS)) {
    let score = 0;
    for (const kw of pattern.keywords) {
      if (allText.includes(kw.toLowerCase())) score++;
    }
    const normalizedScore = score / pattern.keywords.length;
    if (normalizedScore > bestMatch.score) {
      bestMatch = { niche, score: normalizedScore, config: pattern };
    }
  }
  
  return bestMatch.score > 0.08 ? bestMatch : { niche: 'General', config: getDefaultConfig() };
}

function getDefaultConfig() {
  return {
    titleWeight: 0.35, descWeight: 0.35, tagWeight: 0.30,
    descMinWords: 200,
    powerWords: ['ultimate', 'complete', 'essential', 'proven'],
    avoidWords: [],
    strategy: 'balanced'
  };
}

// Adapt SEO scoring weights based on detected niche
export function adaptScoring(nicheConfig, baseScores) {
  if (!nicheConfig || nicheConfig.niche === 'General') return baseScores;
  
  const config = nicheConfig.config;
  const overall = Math.round(
    (baseScores.title || 0) * config.titleWeight +
    (baseScores.desc || 0) * config.descWeight +
    (baseScores.tags || 0) * config.tagWeight
  );
  
  return { ...baseScores, overall };
}

// Generate niche-specific proposal language
export function nicheProposalLanguage(nicheConfig, actionType, data) {
  const niche = nicheConfig?.niche || 'General';
  const config = nicheConfig?.config || getDefaultConfig();
  
  const phrases = {
    science_education: {
      title: `Make your title more educational: front-load the key concept, add "${config.powerWords[0]}" or "${config.powerWords[1]}"`,
      desc: `Expand to ${config.descMinWords}+ words with clear explanations. Add chapter timestamps for each concept covered.`,
      tags: `Use scientific terminology tags: combine broad concepts with specific topics`,
      chapters: `Add timestamps breaking down each concept: 0:00 Introduction, X:XX First Principle, X:XX Second Principle`
    },
    religious_spiritual: {
      title: `Add the specific verse reference or theme. Use "${config.powerWords[0]}" or "${config.powerWords[1]}" for emotional connection.`,
      desc: `Include the full verse text, reflection, and application. Add timestamps for each verse.`,
      tags: `Tag specific books, chapters, themes. Tag related topics your audience searches for.`,
      chapters: `Structure by verse: 0:00 Opening Prayer, X:XX Verse 1, X:XX Verse 2`
    },
    gaming: {
      title: `Hook with a challenge or achievement. Use "${config.powerWords[0]}", "${config.powerWords[1]}" or similar. Keep it punchy.`,
      desc: `Describe the game, level, or challenge. Add links to related videos and your socials.`,
      tags: `Tag the game name, genre, specific challenge, difficulty level.`,
      chapters: `Structure by game section: 0:00 Intro, X:XX Level/Chapter 1, X:XX Boss Fight`
    },
    tech_coding: {
      title: `State what they'll build or learn. Use "${config.powerWords[0]}" or "${config.powerWords[1]}". Include the tech stack.`,
      desc: `${config.descMinWords}+ words with code snippets, links to docs, and step-by-step instructions.`,
      tags: `Tag languages, frameworks, concepts, difficulty level.`,
      chapters: `0:00 Overview, X:XX Setup, X:XX Implementation, X:XX Testing/Result`
    }
  };
  
  const nichePhrases = phrases[niche] || {};
  const actionPhrases = nichePhrases[actionType];
  
  if (actionPhrases) {
    return { ...data, rationale: actionPhrases };
  }
  
  return data;
}
