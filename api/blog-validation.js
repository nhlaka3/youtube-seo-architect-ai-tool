// api/blog-validation.js
// Automatic quality gate for blog posts.
// Posts that fail validation are silently excluded from sitemap and blog listing.

// Banned AI words — presence disqualifies the post
const BANNED_WORDS = /\b(excited|leverage|seamless|robust|embark|streamline|pivotal|cutting-edge)\b/i;

// Minimum word count to pass
const MIN_WORD_COUNT = 1200;

/**
 * Validate a blog post against _TEMPLATE.html quality standards.
 * @param {Object} post - A post object from the seoPages table or a file path
 * @param {string} post.slug - Post slug
 * @param {string} post.title - Post title
 * @param {string} post.content - Post HTML content
 * @param {number} post.wordCount - Pre-computed word count (if from DB)
 * @returns {{ valid: boolean, failures: string[] }}
 */
export function validateBlogPost(post) {
  const failures = [];
  const content = post.content || '';
  const wordCount = post.wordCount || countWords(content);

  // 1. Word count check (≥ 1200)
  if (wordCount < MIN_WORD_COUNT) {
    failures.push(`word count ${wordCount} < ${MIN_WORD_COUNT} minimum`);
  }

  // 2. Author box check
  if (!/class=["'][^"']*author-box[^"']*["']/i.test(content) &&
      !/class=["'][^"']*author-info[^"']*["']/i.test(content)) {
    failures.push('missing author box (E-E-A-T requirement)');
  }

  // 3. Breadcrumb check
  if (!/"BreadcrumbList"/i.test(content) &&
      !/class=["'][^"']*breadcrumb[^"']*["']/i.test(content)) {
    failures.push('missing breadcrumb navigation');
  }

  // 4. FAQ check — must have exactly 5 <details> elements
  const detailsCount = (content.match(/<\s*details[\s>]/gi) || []).length;
  if (detailsCount < 5) {
    failures.push(`only ${detailsCount} FAQ entries (need 5 minimum)`);
  }

  // 5. TL;DR block check
  if (!/class=["'][^"']*tldr[^"']*["']/i.test(content) &&
      !/Direct Answer/i.test(content)) {
    failures.push('missing TL;DR / Direct Answer block');
  }

  // 6. Banned words check
  const bannedMatch = content.match(BANNED_WORDS);
  if (bannedMatch) {
    failures.push(`contains banned word: "${bannedMatch[0]}"`);
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Count visible text words from HTML content.
 * Strips HTML tags, scripts, and style blocks.
 */
function countWords(html) {
  if (!html) return 0;
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}
