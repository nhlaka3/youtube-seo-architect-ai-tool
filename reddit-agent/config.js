// Target subreddits and keyword triggers
export const TARGET_SUBREDDITS = [
  'youtube',
  'NewTubers', 
  'PartneredYoutube',
  'SEO',
  'smallYTchannel',
  'youtubers',
  'VideoEditing',
  'content_marketing'
];

// Keywords that indicate someone needs YouTube SEO help
export const KEYWORD_TRIGGERS = [
  'how to get views',
  'how to grow',
  'getting views',
  'no views',
  'my views',
  'best tags',
  'tag generator',
  'youtube seo',
  'youtube SEO',
  'video seo',
  'optimize',
  'optimise',
  'keyword research',
  'title tips',
  'title help',
  'description help',
  'grow my channel',
  'grow channel',
  'channel growth',
  'not getting views',
  'stuck at',
  'algorithm',
  'recommended',
  'thumbnail tips',
  'ctr help',
  'click through',
  'audit',
  'metadata',
  'vidiq',
  'tubebuddy',
];

// Posts to skip (avoid replying to these)
export const SKIP_TRIGGERS = [
  'buy views',
  'buy subscribers',
  'sub4sub',
  'check out my',
  'watch my video',
  'promo code',
];

// Rate limits
export const RATE_LIMITS = {
  maxRepliesPerDay: parseInt(process.env.MAX_REPLIES_PER_DAY || '10'),
  minMinutesBetweenReplies: parseInt(process.env.MIN_MINUTES_BETWEEN_REPLIES || '3'),
  maxPostsPerSubreddit: 25,
};

// Memory file path
export const MEMORY_FILE = new URL('./memory.json', import.meta.url).pathname;

// Tool mention (randomized by AI, this is just a fallback)
export const TOOL_MENTION = 'I\'ve been using YT SEO Architect (free, 100 credits/month) — it does AI keyword research, tag generation, and metadata audits automatically. Saves me hours.';
export const TOOL_URL = 'https://yt-seo-architect.vercel.app';

// Include blog/tool links in replies? Set to false for help-only mode
export const INCLUDE_LINKS = process.env.REDDIT_INCLUDE_LINKS !== 'false'; // default: true

// Also link to specific blog posts? Set to empty array to disable
export const BLOG_POSTS_TO_LINK = process.env.REDDIT_BLOG_LINKS === 'false' ? [] : [
  { keyword: 'competitor', url: 'https://yt-seo-architect.vercel.app/blog/youtube-competitor-analysis-reverse-engineer', text: 'guide on competitor analysis' },
  { keyword: 'keyword research', url: 'https://yt-seo-architect.vercel.app/blog/youtube-keyword-research-tutorial', text: 'keyword research tutorial' },
  { keyword: 'seo', url: 'https://yt-seo-architect.vercel.app/blog/youtube-seo-guide-2026', text: 'YouTube SEO guide' },
  { keyword: 'tags', url: 'https://yt-seo-architect.vercel.app/blog/youtube-tags-generator-vs-vidiq', text: 'tag strategy guide' },
  { keyword: 'titles', url: 'https://yt-seo-architect.vercel.app/blog/how-to-write-youtube-titles', text: 'title writing guide' },
  { keyword: 'shadow ban', url: 'https://yt-seo-architect.vercel.app/blog/how-to-fix-youtube-shadow-ban-2026', text: 'shadow ban guide' },
  { keyword: 'algorithm', url: 'https://yt-seo-architect.vercel.app/blog/youtube-algorithm-changes-2026', text: 'algorithm changes guide' },
];
