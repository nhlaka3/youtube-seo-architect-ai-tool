// api/blog-validation.js
// Automatic quality gate for blog posts.
// Posts that fail validation are silently excluded from sitemap and blog listing.
//
// v2 (2026-08-06) — scored quality gate:
//   * `valid` / `failures` keep the EXACT prior behavior (the 6 hard checks below).
//     Every caller reading `.valid` (sitemap, blog listing, category pages) is
//     byte-for-byte backward compatible — no post that passed before will be excluded.
//   * New fields let callers enforce depth, not just structure:
//       score          -> 0-100 weighted total
//       categoryScores -> { content, seo, eeat, technical, aiCitation }
//       grade          -> A/B/C/D/F
//       passing        -> score >= threshold
//       threshold      -> effective min score
//     The rubric mirrors the claude-blog 5-category scoring contract, adapted to
//     this codebase's HTML template and stack.
//
// Usage:
//   validateBlogPost(post)                          // hard gate only (defaults minScore = 0)
//   validateBlogPost(post, { minScore: 70 })        // enforce the scored gate

// ── Hard gate constants (unchanged behavior) ──────────────────────
// Banned AI words — presence disqualifies the post
const BANNED_WORDS = /\b(excited|leverage|seamless|robust|embark|streamline|pivotal|cutting-edge)\b/i;

// Minimum word count to pass
const MIN_WORD_COUNT = 1200;

// Default scored-gate threshold. Existing published posts (1,900–2,650 words,
// full template, schema, author box, FAQ, TL;DR) score ~85–95; 70 blocks only
// genuinely thin output. Override per-call or via BLOG_MIN_SCORE env.
const DEFAULT_MIN_SCORE = Number(process.env.BLOG_MIN_SCORE || 70);

// ── Scoring rubric (100 points, 5 categories) ─────────────────────
const CATEGORY_MAX = { content: 30, seo: 25, eeat: 15, technical: 15, aiCitation: 15 };

/**
 * Validate a blog post against the quality gate + scored rubric.
 * @param {Object} post - A post object from the seoPages table or a file path
 * @param {string} post.slug - Post slug (used for keyword detection)
 * @param {string} post.title - Post title
 * @param {string} post.content - Post HTML content (body OR full wrapped template)
 * @param {number} post.wordCount - Pre-computed word count (if from DB)
 * @param {Object} [opts] - { minScore } scored-gate threshold
 * @returns {Object} { valid, failures, score, categoryScores, grade, passing, threshold }
 */
export function validateBlogPost(post, opts = {}) {
  const failures = [];
  const content = post.content || '';
  const wordCount = post.wordCount || countWords(content);
  const threshold = typeof opts.minScore === 'number' ? opts.minScore : DEFAULT_MIN_SCORE;

  // ── Hard gate (v1 checks, unchanged) ───────────────────────────
  // 1. Word count (≥ 1200)
  if (wordCount < MIN_WORD_COUNT) {
    failures.push(`word count ${wordCount} < ${MIN_WORD_COUNT} minimum`);
  }
  // 2. Author box (E-E-A-T)
  if (!/class=["'][^"']*author-box[^"']*["']/i.test(content) &&
      !/class=["'][^"']*author-info[^"']*["']/i.test(content)) {
    failures.push('missing author box (E-E-A-T requirement)');
  }
  // 3. Breadcrumb
  if (!/"BreadcrumbList"/i.test(content) &&
      !/class=["'][^"']*breadcrumb[^"']*["']/i.test(content)) {
    failures.push('missing breadcrumb navigation');
  }
  // 4. FAQ — at least 5 <details>
  const detailsCount = (content.match(/<\s*details[\s>]/gi) || []).length;
  if (detailsCount < 5) {
    failures.push(`only ${detailsCount} FAQ entries (need 5 minimum)`);
  }
  // 5. TL;DR / Direct Answer block
  if (!/class=["'][^"']*tldr[^"']*["']/i.test(content) &&
      !/Direct Answer/i.test(content)) {
    failures.push('missing TL;DR / Direct Answer block');
  }
  // 6. Banned words
  const bannedMatch = content.match(BANNED_WORDS);
  if (bannedMatch) {
    failures.push(`contains banned word: "${bannedMatch[0]}"`);
  }

  // ── Scored rubric (v2) ─────────────────────────────────────────
  const categoryScores = {
    content: scoreContent(content, wordCount),
    seo: scoreSEO(content, post),
    eeat: scoreEEAT(content),
    technical: scoreTechnical(content),
    aiCitation: scoreAICitation(content),
  };
  const score = Object.entries(categoryScores)
    .reduce((sum, [k, v]) => sum + v, 0);
  // Never exceed a category max even if heuristics overlap
  const clamped = {};
  for (const [k, v] of Object.entries(categoryScores)) {
    clamped[k] = Math.min(v, CATEGORY_MAX[k]);
  }
  const total = Object.values(clamped).reduce((a, b) => a + b, 0);

  return {
    valid: failures.length === 0,
    failures,
    score: total,
    categoryScores: clamped,
    grade: gradeFor(total),
    passing: total >= threshold,
    threshold,
  };
}

// ── Category scorers (each returns raw points, clamped by caller) ─

function scoreContent(content, wordCount) {
  let s = 0;
  // Word count depth (10)
  s += wordCount >= 2000 ? 10 : wordCount >= 1600 ? 8 : wordCount >= 1200 ? 6 : 2;
  // Heading structure (10): H2s give a scannable, extractable outline
  const h2 = (content.match(/<h2[\s>]/gi) || []).length;
  s += h2 >= 8 ? 10 : h2 >= 5 ? 7 : h2 >= 3 ? 4 : h2 >= 1 ? 2 : 0;
  // FAQ depth (10): <details> (or FAQ heading) count
  const details = (content.match(/<\s*details[\s>]/gi) || []).length;
  s += details >= 5 ? 10 : details >= 3 ? 7 : details >= 1 ? 3 : 0;
  return s;
}

function scoreSEO(content, post) {
  let s = 0;
  // Title + meta description (5)
  const hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(content);
  const hasDesc = /<meta\s+name=["']description["'][^>]*content=["'][^"']+["']/i.test(content);
  s += hasTitle && hasDesc ? 5 : hasTitle || hasDesc ? 2 : 0;
  // Primary keyword (derived from slug) in title/H1 (5)
  const keyword = keywordTokens(post.slug);
  const titleOrH1 = (content.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
  const h1 = stripTags((content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const headText = `${titleOrH1} ${h1}`.toLowerCase();
  if (keyword.length && keyword.some(t => headText.includes(t))) s += 5;
  // Internal links (10): count same-site links
  const internalLinks = (content.match(/href=["']\/(?!\/)[^"']*["']/gi) || []).length
    + (content.match(/href=["']https:\/\/yt-seo-architect\.vercel\.app[^"']*["']/gi) || []).length;
  s += internalLinks >= 5 ? 10 : internalLinks >= 3 ? 7 : internalLinks >= 1 ? 4 : 0;
  // Canonical (5)
  if (/rel=["']canonical["']/i.test(content)) s += 5;
  return s;
}

function scoreEEAT(content) {
  let s = 0;
  // Author attribution (5): visible author box OR Person schema
  const authorBox = /class=["'][^"']*author-(box|info)[^"']*["']/i.test(content);
  const personSchema = /"@type"\s*:\s*"Person"/i.test(content);
  if (authorBox || personSchema) s += 5;
  // Breadcrumb (5)
  if (/"BreadcrumbList"/i.test(content) || /class=["'][^"']*breadcrumb[^"']*["']/i.test(content)) s += 5;
  // Published/modified date (5)
  if (/datePublished/i.test(content) || /dateModified/i.test(content) ||
      /<time\b/i.test(content) || /property=["']article:published_time["']/i.test(content)) s += 5;
  return s;
}

function scoreTechnical(content) {
  let s = 0;
  // JSON-LD structured data (5)
  if (/application\/ld\+json/i.test(content)) s += 5;
  // Exactly one H1 (5)
  const h1 = (content.match(/<h1[\s>]/gi) || []).length;
  s += h1 === 1 ? 5 : h1 === 0 ? 0 : 2;
  // No banned words (5)
  if (!BANNED_WORDS.test(content)) s += 5;
  return s;
}

function scoreAICitation(content) {
  let s = 0;
  // Summary / Key Takeaways box — extractable answer (5)
  if (/class=["'][^"']*tldr[^"']*["']/i.test(content) ||
      /Key Takeaways/i.test(content) ||
      /Direct Answer/i.test(content)) s += 5;
  // FAQ Q&A extractable (5)
  const details = (content.match(/<\s*details[\s>]/gi) || []).length;
  if (details >= 3 || /Frequently Asked/i.test(content)) s += 5;
  // Structured data tables / definition blocks (5)
  if (/<table[\s>]/i.test(content) || (content.match(/<h3[\s>]/gi) || []).length >= 3) s += 5;
  return s;
}

// ── Helpers ───────────────────────────────────────────────────────

// Derive keyword tokens from the slug: "youtube-seo-checklist-beginners-2026"
// -> ["youtube","seo","checklist","beginners"] (drops stopwords/numbers).
const STOPWORDS = new Set(['the','and','for','how','to','with','your','you','guide','tips','2026','2025','best','free','using','a','of','in','on','what','why']);
function keywordTokens(slug) {
  if (!slug) return [];
  return slug.split(/[-_]/).filter(t => t.length > 2 && !/^\d+$/.test(t) && !STOPWORDS.has(t.toLowerCase())).map(t => t.toLowerCase());
}

function stripTags(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
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
