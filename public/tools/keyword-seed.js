// Auto-expansion keyword seed for programmatic SEO tool pages
// Add new keywords as users search them — the tag/title/desc templates handle slugs dynamically
export const SEED_KEYWORDS = [
  // Gaming
  'gaming', 'minecraft', 'fortnite', 'roblox', 'call of duty', 'valorant', 'elden ring',
  // Tutorials
  'youtube seo', 'video editing', 'photoshop tutorial', 'premiere pro', 'after effects',
  'python programming', 'web development', 'machine learning', 'data science',
  // Lifestyle
  'vlog', 'cooking', 'fitness', 'travel', 'makeup', 'fashion', 'home workout',
  // Tech
  'technology', 'iphone review', 'samsung galaxy', 'macbook pro', 'gaming pc build',
  'crypto trading', 'ai tools', 'chatgpt tutorial',
  // Music
  'music production', 'fl studio tutorial', 'ableton live', 'guitar tutorial',
  // Education
  'math tutorial', 'physics explained', 'history documentary', 'language learning',
  // Finance
  'personal finance', 'stock market', 'real estate investing', 'side hustle ideas',
  // Common searches
  'how to make money online', 'productivity tips', 'morning routine',
  'study tips', 'meditation guide', 'resume tips'
];

export function getSuggestedSlugs() {
  return SEED_KEYWORDS.map(k => k.toLowerCase().replace(/\s+/g, '-'));
}
