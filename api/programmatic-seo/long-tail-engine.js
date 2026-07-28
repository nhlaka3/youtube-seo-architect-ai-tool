// api/programmatic-seo/long-tail-engine.js
// Phase 1 — Combinatorial Long-Tail Keyword Engine
// Systematically generates long-tail keywords by combining:
//   Core Actions × Audience Types × Constraints × Geo/Locale
// Matches content.txt spec: 50-100+ rankable, specific, YouTube-topic keywords
import express from 'express';
export const router = express.Router();

// ═══════════════════════════════════════════════════════════════
//  COMBINATOR ARRAYS
// ═══════════════════════════════════════════════════════════════

// Each core action maps to a topic_category and has natural phrase forms
const CORE_ACTIONS = [
  // ── Channel Growth ──
  { key: 'grow', phrase: 'grow a YouTube channel', category: 'channel growth', intent: 'how-to', priority: 10 },
  { key: 'subscribers', phrase: 'get more YouTube subscribers', category: 'channel growth', intent: 'how-to', priority: 10 },
  { key: 'views', phrase: 'get more views on YouTube', category: 'channel growth', intent: 'how-to', priority: 9 },
  { key: 'watch_time', phrase: 'increase watch time on YouTube', category: 'channel growth', intent: 'how-to', priority: 8 },
  { key: 'ctr', phrase: 'improve YouTube click through rate', category: 'channel growth', intent: 'how-to', priority: 7 },
  { key: 'retention', phrase: 'improve YouTube audience retention', category: 'channel growth', intent: 'how-to', priority: 7 },
  { key: 'algorithm', phrase: 'understand the YouTube algorithm', category: 'channel growth', intent: 'informational', priority: 8 },
  { key: 'ranking', phrase: 'rank YouTube videos higher', category: 'channel growth', intent: 'how-to', priority: 8 },

  // ── Content Strategy ──
  { key: 'niche', phrase: 'choose a YouTube niche', category: 'content strategy', intent: 'how-to', priority: 7 },
  { key: 'content_plan', phrase: 'plan YouTube content', category: 'content strategy', intent: 'how-to', priority: 6 },
  { key: 'script', phrase: 'write YouTube video scripts', category: 'content strategy', intent: 'how-to', priority: 6 },
  { key: 'series', phrase: 'create a YouTube video series', category: 'content strategy', intent: 'how-to', priority: 5 },
  { key: 'calendar', phrase: 'build a YouTube content calendar', category: 'content strategy', intent: 'how-to', priority: 5 },
  { key: 'ideas', phrase: 'find YouTube video ideas', category: 'content strategy', intent: 'how-to', priority: 7 },
  { key: 'viral', phrase: 'make a YouTube video go viral', category: 'content strategy', intent: 'how-to', priority: 7 },

  // ── SEO ──
  { key: 'seo', phrase: 'improve YouTube SEO', category: 'SEO', intent: 'how-to', priority: 10 },
  { key: 'keyword_research', phrase: 'research YouTube keywords', category: 'SEO', intent: 'how-to', priority: 9 },
  { key: 'tags', phrase: 'use YouTube tags effectively', category: 'SEO', intent: 'how-to', priority: 8 },
  { key: 'descriptions', phrase: 'write YouTube descriptions', category: 'SEO', intent: 'how-to', priority: 7 },
  { key: 'titles', phrase: 'write YouTube titles', category: 'SEO', intent: 'how-to', priority: 8 },
  { key: 'metadata', phrase: 'optimize YouTube metadata', category: 'SEO', intent: 'how-to', priority: 7 },
  { key: 'hashtags', phrase: 'use YouTube hashtags', category: 'SEO', intent: 'how-to', priority: 5 },

  // ── Thumbnails & Branding ──
  { key: 'thumbnails', phrase: 'design YouTube thumbnails', category: 'thumbnails', intent: 'how-to', priority: 9 },
  { key: 'thumbnail_tools', phrase: 'make YouTube thumbnails', category: 'thumbnails', intent: 'how-to', priority: 7 },
  { key: 'branding', phrase: 'brand a YouTube channel', category: 'thumbnails', intent: 'how-to', priority: 6 },
  { key: 'ab_test_thumb', phrase: 'A/B test YouTube thumbnails', category: 'thumbnails', intent: 'how-to', priority: 6 },
  { key: 'ctr_design', phrase: 'design thumbnails that get clicks', category: 'thumbnails', intent: 'how-to', priority: 8 },

  // ── Monetization ──
  { key: 'monetize', phrase: 'monetize a YouTube channel', category: 'monetization', intent: 'how-to', priority: 10 },
  { key: 'adsense', phrase: 'get YouTube AdSense approval', category: 'monetization', intent: 'how-to', priority: 7 },
  { key: 'brand_deals', phrase: 'get brand deals on YouTube', category: 'monetization', intent: 'how-to', priority: 6 },
  { key: 'affiliate', phrase: 'make money with YouTube affiliate marketing', category: 'monetization', intent: 'how-to', priority: 6 },
  { key: 'merch', phrase: 'sell merch on YouTube', category: 'monetization', intent: 'how-to', priority: 5 },
  { key: 'memberships', phrase: 'set up YouTube channel memberships', category: 'monetization', intent: 'how-to', priority: 5 },
  { key: 'superthanks', phrase: 'earn from YouTube Super Thanks', category: 'monetization', intent: 'how-to', priority: 4 },
  { key: 'monetization_req', phrase: 'meet YouTube monetization requirements', category: 'monetization', intent: 'informational', priority: 8 },

  // ── Shorts & Formats ──
  { key: 'shorts', phrase: 'grow with YouTube Shorts', category: 'shorts', intent: 'how-to', priority: 9 },
  { key: 'shorts_views', phrase: 'get more views on YouTube Shorts', category: 'shorts', intent: 'how-to', priority: 8 },
  { key: 'shorts_strategy', phrase: 'create a YouTube Shorts strategy', category: 'shorts', intent: 'how-to', priority: 7 },
  { key: 'shorts_monetize', phrase: 'monetize YouTube Shorts', category: 'shorts', intent: 'how-to', priority: 8 },
  { key: 'long_form', phrase: 'create long form YouTube videos', category: 'shorts', intent: 'how-to', priority: 5 },
  { key: 'livestreams', phrase: 'run YouTube livestreams', category: 'shorts', intent: 'how-to', priority: 5 },
  { key: 'playlists', phrase: 'organize YouTube playlists', category: 'shorts', intent: 'how-to', priority: 4 },

  // ── Production ──
  { key: 'edit', phrase: 'edit YouTube videos', category: 'production', intent: 'how-to', priority: 8 },
  { key: 'edit_fast', phrase: 'edit YouTube videos faster', category: 'production', intent: 'how-to', priority: 7 },
  { key: 'gear', phrase: 'choose YouTube equipment', category: 'production', intent: 'informational', priority: 6 },
  { key: 'lighting', phrase: 'set up YouTube lighting', category: 'production', intent: 'how-to', priority: 5 },
  { key: 'audio', phrase: 'improve YouTube audio quality', category: 'production', intent: 'how-to', priority: 6 },
  { key: 'camera', phrase: 'choose a camera for YouTube', category: 'production', intent: 'informational', priority: 5 },
  { key: 'software', phrase: 'choose YouTube editing software', category: 'production', intent: 'informational', priority: 6 },
  { key: 'workflow', phrase: 'create a YouTube editing workflow', category: 'production', intent: 'how-to', priority: 5 },
  { key: 'captions', phrase: 'add subtitles to YouTube videos', category: 'production', intent: 'how-to', priority: 4 },
  { key: 'broll', phrase: 'find B-roll footage for YouTube', category: 'production', intent: 'how-to', priority: 4 },

  // ── Analytics ──
  { key: 'analytics', phrase: 'use YouTube analytics', category: 'analytics', intent: 'how-to', priority: 7 },
  { key: 'studio', phrase: 'use YouTube Studio', category: 'analytics', intent: 'how-to', priority: 6 },
  { key: 'retention_graph', phrase: 'read YouTube retention graphs', category: 'analytics', intent: 'how-to', priority: 5 },
  { key: 'traffic_sources', phrase: 'understand YouTube traffic sources', category: 'analytics', intent: 'informational', priority: 5 },
  { key: 'impressions', phrase: 'increase YouTube impressions', category: 'analytics', intent: 'how-to', priority: 7 },

  // ── Policies & Mistakes ──
  { key: 'copyright', phrase: 'avoid copyright claims on YouTube', category: 'policies', intent: 'how-to', priority: 9 },
  { key: 'strikes', phrase: 'handle YouTube copyright strikes', category: 'policies', intent: 'informational', priority: 6 },
  { key: 'demonetized', phrase: 'fix a demonetized YouTube video', category: 'policies', intent: 'troubleshooting', priority: 6 },
  { key: 'fair_use', phrase: 'use fair use on YouTube', category: 'policies', intent: 'informational', priority: 5 },
  { key: 'reused', phrase: 'avoid YouTube reused content policy', category: 'policies', intent: 'how-to', priority: 6 },
  { key: 'community_guidelines', phrase: 'follow YouTube community guidelines', category: 'policies', intent: 'informational', priority: 4 },
  { key: 'appeal', phrase: 'appeal a YouTube decision', category: 'policies', intent: 'how-to', priority: 5 },
];

// Audience segments with preposition and description
const AUDIENCES = [
  { key: 'none', phrase: '', preposition: '', description: 'all creators', exclusive: false },
  { key: 'small', phrase: 'small channels', preposition: 'for', description: 'creators with under 1K subscribers', exclusive: false },
  { key: 'beginners', phrase: 'beginners', preposition: 'for', description: 'people new to YouTube', exclusive: false },
  { key: 'faceless', phrase: 'faceless channels', preposition: 'for', description: 'creators who do not show their face', exclusive: false },
  { key: 'gaming', phrase: 'gaming channels', preposition: 'for', description: 'gaming content creators', exclusive: false },
  { key: 'education', phrase: 'education channels', preposition: 'for', description: 'educational content creators', exclusive: false },
  { key: 'vlog', phrase: 'vlog channels', preposition: 'for', description: 'lifestyle and vlog creators', exclusive: false },
  { key: 'music', phrase: 'music channels', preposition: 'for', description: 'musicians and music producers', exclusive: false },
  { key: 'reaction', phrase: 'reaction channels', preposition: 'for', description: 'reaction video creators', exclusive: false },
  { key: 'shorts_only', phrase: 'Shorts-only channels', preposition: 'for', description: 'creators focused on YouTube Shorts', exclusive: false },
  { key: 'tech', phrase: 'tech channels', preposition: 'for', description: 'tech review and tutorial creators', exclusive: false },
  { key: 'cooking', phrase: 'cooking channels', preposition: 'for', description: 'food and cooking creators', exclusive: false },
  { key: 'fitness', phrase: 'fitness channels', preposition: 'for', description: 'fitness and health creators', exclusive: false },
  { key: 'kids', phrase: 'kids content creators', preposition: 'for', description: 'creators making content for children', exclusive: false },
];

// Constraints / context modifiers
const CONSTRAINTS = [
  { key: 'none', phrase: '', preposition: '', exclusive: false },
  { key: 'no_face', phrase: 'without showing your face', preposition: '', exclusive: false },
  { key: 'no_talking', phrase: 'without talking', preposition: '', exclusive: false },
  { key: 'no_money', phrase: 'without spending money', preposition: '', exclusive: false },
  { key: 'phone_only', phrase: 'with only a phone', preposition: '', exclusive: false },
  { key: 'in_2026', phrase: 'in 2026', preposition: '', exclusive: false },
  { key: 'kids_content', phrase: 'for kids content', preposition: '', exclusive: false },
  { key: 'low_budget', phrase: 'for low budget creators', preposition: '', exclusive: false },
  { key: 'no_subs', phrase: 'when you have no subscribers', preposition: '', exclusive: false },
  { key: 'old_videos', phrase: 'on old videos', preposition: '', exclusive: false },
  { key: 'free_tools', phrase: 'with free tools', preposition: '', exclusive: false },
  { key: 'on_mobile', phrase: 'on mobile', preposition: '', exclusive: false },
  { key: 'no_editing', phrase: 'without editing', preposition: '', exclusive: false },
  { key: 'ai_tools', phrase: 'using AI tools', preposition: '', exclusive: false },
  { key: 'consistent', phrase: 'while staying consistent', preposition: '', exclusive: false },
];

// Geo / language (optional sprinkling)
const GEO_LOCALES = [
  { key: 'none', phrase: '', description: '' },
  { key: 'south_africa', phrase: 'in South Africa', description: 'South African creators' },
  { key: 'india', phrase: 'in India', description: 'Indian creators' },
  { key: 'africa', phrase: 'for African creators', description: 'creators across Africa' },
  { key: 'hindi', phrase: 'for Hindi channels', description: 'Hindi-language creators' },
  { key: 'english_learners', phrase: 'for English learners', description: 'non-native English speakers' },
];

// ═══════════════════════════════════════════════════════════════
//  EXCLUSION RULES — prevent nonsensical combinations
// ═══════════════════════════════════════════════════════════════

function isRedundant(action, audience, constraint) {
  // Faceless + without showing your face = redundant
  if (audience.key === 'faceless' && constraint.key === 'no_face') return true;
  // Beginners + when you have no subscribers = redundant
  if (audience.key === 'beginners' && constraint.key === 'no_subs') return true;
  // Small channels + when you have no subscribers = redundant
  if (audience.key === 'small' && constraint.key === 'no_subs') return true;
  // Low budget + without spending money = redundant
  if (constraint.key === 'low_budget' && constraint.key === 'no_money') return false; // different but related, keep
  // Shorts-only + long-form specific actions
  if (audience.key === 'shorts_only' && ['long_form', 'playlists'].includes(action.key)) return true;
  // Kids content creators + adult-oriented actions
  if (audience.key === 'kids' && ['brand_deals', 'affiliate'].includes(action.key)) return true;
  // Without talking + reaction channels (reaction requires talking typically)
  if (audience.key === 'reaction' && constraint.key === 'no_talking') return true;
  // Music channels + without talking (music channels can be instrumental)
  // Allow this — instrumental music channels exist
  if (constraint.key === 'kids_content' && audience.key !== 'kids' && action.category === 'monetization') return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  TEMPLATE PATTERNS — convert arrays into natural English phrases
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_CONFIGS = [
  // Pattern 1: "how to {action} {audience}"
  // "how to grow a YouTube channel for gaming channels"
  { prefix: 'how to', join: ' ', parts: ['action.phrase', 'audience'], weight: 35 },
  // Pattern 2: "how to {action} {constraint}"
  // "how to monetize a YouTube channel without showing your face"
  { prefix: 'how to', join: ' ', parts: ['action.phrase', 'constraint'], weight: 30 },
  // Pattern 3: "how to {action} {audience} {constraint}"
  // "how to do YouTube SEO for small channels with free tools"
  { prefix: 'how to', join: ' ', parts: ['action.phrase', 'audience', 'constraint'], weight: 20 },
  // Pattern 4: "best {noun} {audience}"
  // "best YouTube thumbnail strategy for gaming channels"
  { prefix: 'best', join: ' ', parts: ['action_strategy', 'audience'], weight: 15 },
  // Pattern 5: "{action} {audience}"
  // "YouTube SEO tips for faceless channels"
  { prefix: '', join: ' ', parts: ['action_tips', 'audience'], weight: 10 },
  // Pattern 6: "{action} {constraint}"
  // "edit YouTube videos faster with only a phone"
  { prefix: '', join: ' ', parts: ['action.phrase', 'constraint'], weight: 10 },
  // Pattern 7: "{action} {audience} {constraint} {geo}"
  // "how to grow a YouTube channel for beginners in South Africa"
  { prefix: 'how to', join: ' ', parts: ['action.phrase', 'audience', 'constraint', 'geo'], weight: 3 },
  // Pattern 8: "how to {action} {geo}"
  // "how to monetize a YouTube channel in India"
  { prefix: 'how to', join: ' ', parts: ['action.phrase', 'geo'], weight: 5 },
];

// ── Derive alternative phrase forms from an action ──
function actionForms(action) {
  const p = action.phrase;
  return {
    phrase: p,
    strategy: p.replace(/^(how to )?/, '').replace(/^(a |an )?/, '') + ' strategy',
    tips: p.replace(/^(how to )?/, '').replace(/^(a |an )?/, '') + ' tips',
    guide: p.replace(/^(how to )?/, '') + ' guide',
  };
}

// ── Format audience phrase ──
function audiencePhrase(audience) {
  if (!audience.phrase) return '';
  return audience.preposition + ' ' + audience.phrase;
}

// ── Format constraint phrase ──
function constraintPhrase(constraint) {
  if (!constraint.phrase) return '';
  return constraint.phrase;
}

// ── Smart slug: truncates at word boundary ──
function slugify(text, maxLen = 65) {
  let slug = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  if (slug.length <= maxLen) return slug;
  // Truncate at last hyphen within maxLen
  const truncated = slug.substring(0, maxLen);
  const lastHyphen = truncated.lastIndexOf('-');
  return lastHyphen > 20 ? truncated.substring(0, lastHyphen) : truncated;
}

// ═══════════════════════════════════════════════════════════════
//  GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Generate all valid long-tail keyword candidates via combinatorial expansion.
 * @param {Object} options
 * @param {string[]} options.categories - filter to specific categories (default: all)
 * @param {boolean} options.includeGeo - include geo/locale variants
 * @param {number} options.maxPerAction - max candidates per action (default: 30)
 * @returns {Object[]} array of keyword candidate objects
 */
export function generateLongTailCandidates(options = {}) {
  const {
    categories = null,
    includeGeo = false,
    maxPerAction = 30,
  } = options;

  const candidates = [];

  // Filter actions by category if specified
  const actions = categories
    ? CORE_ACTIONS.filter(a => categories.includes(a.category))
    : CORE_ACTIONS;

  for (const action of actions) {
    const forms = actionForms(action);
    let actionCount = 0;
    const activeAudiences = AUDIENCES.filter(a => a.key !== 'none');
    
    // Shuffle audiences per action for diversity (different start point per action)
    const actionIndex = actions.indexOf(action);
    const rotatedAudiences = [...activeAudiences.slice(actionIndex % activeAudiences.length), ...activeAudiences.slice(0, actionIndex % activeAudiences.length)];
    
    // Pick diverse constraints for variety
    const priorityConstraints = CONSTRAINTS.filter(c => c.key !== 'none' && ['no_face', 'no_money', 'phone_only', 'in_2026', 'free_tools', 'no_subs'].includes(c.key));
    const fallbackConstraints = CONSTRAINTS.filter(c => c.key !== 'none' && !priorityConstraints.includes(c));
    const orderedConstraints = [...priorityConstraints, ...fallbackConstraints];

    // ── PRIORITY 1: audience + constraint combos (each audience gets 1 valid constraint) ──
    for (const audience of rotatedAudiences) {
      if (actionCount >= maxPerAction) break;
      const audPhrase = audiencePhrase(audience);
      // Try constraints in order until we find one that isn't redundant with this audience
      for (const constraint of orderedConstraints) {
        if (isRedundant(action, audience, constraint)) continue;
        const conPhrase = constraintPhrase(constraint);
        const kw = `how to ${action.phrase} ${audPhrase} ${conPhrase}`.trim().replace(/\s+/g, ' ');
        if (isValidLongTail(kw)) {
          candidates.push(buildCandidate(kw, action, audience, constraint, null));
          actionCount++;
          break; // One candidate per audience — move to next audience
        }
      }
    }

    // ── PRIORITY 2: audience-only + "best" variants (limit to 2 more, rotated audiences) ──
    for (const audience of rotatedAudiences.slice(0, 4)) {
      if (actionCount >= maxPerAction) break;
      const audPhrase = audiencePhrase(audience);

      const kw1 = `how to ${action.phrase} ${audPhrase}`.trim().replace(/\s+/g, ' ');
      if (isValidLongTail(kw1)) {
        candidates.push(buildCandidate(kw1, action, audience, { key: 'none', phrase: '', preposition: '', exclusive: false }, null));
        actionCount++;
      }

      if (['how-to', 'informational'].includes(action.intent) && actionCount < maxPerAction) {
        const kw2 = `best ${forms.strategy} ${audPhrase}`.trim().replace(/\s+/g, ' ');
        if (isValidLongTail(kw2)) {
          candidates.push(buildCandidate(kw2, action, audience, { key: 'none', phrase: '', preposition: '', exclusive: false }, null));
          actionCount++;
        }
      }
    }

    // ── Geo variants (optional, first 2 audiences × 2 geos) ──
    if (includeGeo) {
      for (const audience of rotatedAudiences.slice(0, 2)) {
        if (actionCount >= maxPerAction) break;
        const audPhrase = audiencePhrase(audience);
        for (const geo of GEO_LOCALES.filter(g => g.key !== 'none').slice(0, 2)) {
          if (actionCount >= maxPerAction) break;
          const kwGeo = `how to ${action.phrase} ${audPhrase} ${geo.phrase}`.trim().replace(/\s+/g, ' ');
          if (isValidLongTail(kwGeo)) {
            candidates.push(buildCandidate(kwGeo, action, audience, { key: 'none', phrase: '', preposition: '', exclusive: false }, geo));
            actionCount++;
          }
        }
      }
    }
  }

  return deduplicateAndRank(candidates);
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION & FILTERING
// ═══════════════════════════════════════════════════════════════

// Head terms to reject (too broad, not long-tail)
const HEAD_TERM_BLOCKLIST = [
  'youtube seo', 'youtube monetization', 'youtube thumbnails', 'youtube shorts',
  'youtube algorithm', 'youtube analytics', 'youtube tips', 'youtube guide',
  'grow youtube channel', 'get subscribers', 'get views',
];

function isValidLongTail(keyword) {
  const words = keyword.toLowerCase().split(/\s+/);
  // Must have 4+ words (content.txt spec: 4-7+)
  if (words.length < 4) return false;
  // Must be ≤ 20 words (excessive length)
  if (words.length > 20) return false;
  // Must not be a bare head term
  const bare = keyword.toLowerCase().trim();
  for (const head of HEAD_TERM_BLOCKLIST) {
    if (bare === head) return false;
  }
  // Must contain at least one specificity marker (audience, constraint, or geo)
  const specificityWords = ['for', 'without', 'with', 'when', 'on', 'in', 'using'];
  if (!specificityWords.some(w => bare.includes(' ' + w + ' '))) return false;
  return true;
}

// ── Build a candidate object ──
function buildCandidate(primaryKeyword, action, audience, constraint, geo) {
  const audienceDesc = audience.description || audience.key;
  const constraintDesc = constraint.key !== 'none' ? constraint.phrase : '';
  const geoDesc = geo ? geo.description : '';

  // Build audience string
  let audienceStr = audienceDesc;
  if (constraintDesc) audienceStr += ' — ' + constraintDesc;
  if (geoDesc) audienceStr += ' — ' + geoDesc;

  // Derive problem and outcome from the combination
  const problem = deriveProblem(action, audience, constraint);
  const desiredOutcome = deriveOutcome(action, audience);

  // Compute opportunity score — wider range for differentiation
  const wordCount = primaryKeyword.split(/\s+/).length;
  const specificityScore = Math.min(50, 10 + (wordCount - 3) * 8);
  
  // Audience + constraint = most specific (best long-tail)
  const hasAudience = audience.key !== 'none';
  const hasConstraint = constraint.key !== 'none';
  let comboScore = 0;
  if (hasAudience && hasConstraint) comboScore = 30;
  else if (hasAudience) comboScore = 22;
  else if (hasConstraint) comboScore = 12;
  
  const geoScore = geo ? 8 : 0;
  const priorityScore = (action.priority || 5) * 3;
  const opportunityScore = Math.min(100, Math.round(specificityScore + comboScore + geoScore + priorityScore / 10));

  return {
    primary_keyword: primaryKeyword,
    topic_category: action.category,
    secondary_keywords: generateSecondaryKeywords(primaryKeyword, action, audience),
    intent: action.intent,
    audience: audienceStr,
    problem,
    desired_outcome: desiredOutcome,
    seo_title: generateSeoTitle(primaryKeyword),
    meta_description: generateMetaDescription(primaryKeyword, action, audience),
    url_slug: slugify(primaryKeyword, 65),
    h1: generateH1(primaryKeyword),
    outline: generateOutline(primaryKeyword, action, audience, constraint),
    faq: generateFaq(action, audience, constraint),
    cta: generateCta(action),
    opportunity_score: opportunityScore,
    word_count: primaryKeyword.split(/\s+/).length,
    source: 'combinatorial',
    audience_key: audience.key,
    constraint_key: constraint.key,
    geo_key: geo ? geo.key : null,
  };
}

// ── Derive a realistic problem statement ──
function deriveProblem(action, audience, constraint) {
  const templates = {
    'channel growth': `They want to ${action.phrase} but are unsure where to start.`,
    'content strategy': `They struggle to ${action.phrase} effectively.`,
    'SEO': `They want better search rankings but do not know the right ${action.phrase} techniques.`,
    'thumbnails': `They want to ${action.phrase} that drive more clicks.`,
    'monetization': `They want to ${action.phrase} but face confusion about the process.`,
    'shorts': `They want to ${action.phrase} but Shorts feel unpredictable.`,
    'production': `They want to ${action.phrase} without overwhelming complexity.`,
    'analytics': `They want to ${action.phrase} to make better decisions.`,
    'policies': `They want to ${action.phrase} and protect their channel.`,
  };
  let base = templates[action.category] || `They want to ${action.phrase}.`;

  if (constraint.key !== 'none') {
    base += ` The challenge: doing it ${constraint.phrase}.`;
  }
  if (audience.key !== 'none') {
    base = base.replace('They', audience.description.charAt(0).toUpperCase() + audience.description.slice(1));
  }
  return base;
}

// ── Derive outcome ──
function deriveOutcome(action, audience) {
  let audienceName = audience.key !== 'none' ? audience.phrase.replace('channels', 'creator').replace('for ', '').trim() : 'YouTube creator';
  // Fix plurals: "beginners" → "beginner", "musicians" → "musician"
  audienceName = audienceName.replace(/\b(beginners|creators|musicians|creators)\b/gi, (m) => m.replace(/s$/i, ''));
  const article = /^[aeiou]/i.test(audienceName) ? 'an ' : 'a ';
  return `Successfully ${action.phrase} as ${article}${audienceName} with a clear, actionable plan.`;
}

// ── Generate secondary keywords ──
function generateSecondaryKeywords(primaryKw, action, audience) {
  const words = primaryKw.toLowerCase().split(/\s+/);
  const variants = [];

  // Core action as standalone
  variants.push(action.phrase);

  // Stripped "how to" variant
  const stripped = primaryKw.replace(/^how to /, '').trim();
  variants.push(stripped);
  variants.push(stripped + ' guide');
  variants.push(stripped + ' tips');

  // Audience-specific variants
  if (audience.key !== 'none') {
    variants.push(`${action.phrase} for ${audience.phrase}`);
    variants.push(`${action.phrase} as a ${audience.phrase.replace('channels', 'creator').replace('for ', '')}`);
  }

  // Shorter variant — keep meaningful prefix, end on substantive word
  if (words.length > 6) {
    const cutoff = Math.floor(words.length * 0.6);
    const prefix = words.slice(0, cutoff);
    // If last word is short (< 5 chars) or a connector, push one more for completeness
    const connectors = ['for', 'with', 'without', 'in', 'on', 'when', 'using', 'to', 'the', 'a', 'an', 'and', 'or', 'of'];
    const last = prefix[prefix.length - 1];
    if ((last && last.length < 5) || connectors.includes(last)) {
      if (cutoff < words.length) prefix.push(words[cutoff]);
    }
    variants.push(prefix.join(' ') + ' explained');
  }

  // Category-based related term
  const categoryTerms = {
    'channel growth': 'grow on YouTube in 2026',
    'SEO': 'YouTube search optimization tips',
    'monetization': 'make money on YouTube',
    'thumbnails': 'YouTube thumbnail design tips',
    'shorts': 'YouTube Shorts growth strategy',
    'production': 'video production for YouTube',
    'analytics': 'YouTube analytics explained',
    'policies': 'YouTube copyright rules explained',
    'content strategy': 'YouTube content strategy 2026',
  };
  if (categoryTerms[action.category]) {
    variants.push(categoryTerms[action.category]);
  }

  return [...new Set(variants.map(v => v.trim()))].slice(0, 8);
}

// ── Generate SEO title (≤60 chars, natural) ──
function generateSeoTitle(keyword) {
  // Use the keyword directly but capitalize properly
  let title = keyword.replace(/\b\w/g, l => l.toUpperCase())
    .replace('How To', 'How to')
    .replace(' Without ', ' without ')
    .replace(' With ', ' with ')
    .replace(' For ', ' for ')
    .replace(' In ', ' in ')
    .replace(' On ', ' on ')
    .replace(' When ', ' when ')
    .replace(' Using ', ' using ')
    .replace(/\bA\s/, 'a ')
    .replace(/\bAn\s/, 'an ');
  
  if (title.length <= 60) return title;
  // Truncate at last full word under 57 chars, no ellipsis on titles
  const truncated = title.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 35 ? truncated.substring(0, lastSpace) : truncated;
}

// ── Generate meta description (140-155 chars) ──
function generateMetaDescription(keyword, action, audience) {
  const audienceStr = audience.key !== 'none' ? ` for ${audience.phrase}` : '';
  const base = `Learn how to ${action.phrase}${audienceStr} with proven strategies, step-by-step instructions, and real examples that work in 2026.`;
  return base.substring(0, 155);
}

// ── Generate H1 (human-friendly title case) ──
function generateH1(keyword) {
  return keyword.replace(/\b\w/g, l => l.toUpperCase())
    .replace('How To', 'How to')
    .replace(' Without ', ' without ')
    .replace(' With ', ' with ')
    .replace(' For ', ' for ')
    .replace(' In ', ' in ')
    .replace(' On ', ' on ')
    .replace(' When ', ' when ')
    .replace(' Using ', ' using ')
    .replace(/\bA\s/, 'a ')
    .replace(/\bAn\s/, 'an ')
    .replace(/\bThe\s/, 'the ');
}

// ── Generate outline ──
function generateOutline(keyword, action, audience, constraint) {
  // Natural topic name for section headings (gerund form if possible)
  let topicDisplay = action.phrase;
  // Convert "grow a" → "growing a", "do YouTube" → "doing YouTube", etc.
  topicDisplay = topicDisplay.replace(/^(grow|get|make|build|create|use|write|edit|design|choose|run|set|plan|find|rank|earn|sell|handle|fix|appeal|follow|read|understand|increase|improve|monetize|organize|optimize|avoid|add|start|develop)\b/, (m) => {
    const ingMap = { grow: 'growing', get: 'getting', make: 'making', build: 'building', 
      create: 'creating', use: 'using', write: 'writing', edit: 'editing', design: 'designing',
      choose: 'choosing', run: 'running', set: 'setting', plan: 'planning', find: 'finding',
      rank: 'ranking', earn: 'earning', sell: 'selling', handle: 'handling', fix: 'fixing',
      appeal: 'appealing', follow: 'following', read: 'reading', understand: 'understanding',
      increase: 'increasing', improve: 'improving', monetize: 'monetizing', organize: 'organizing',
      optimize: 'optimizing', avoid: 'avoiding', add: 'adding', start: 'starting', develop: 'developing' };
    return ingMap[m] || m + 'ing';
  });
  topicDisplay = topicDisplay.charAt(0).toUpperCase() + topicDisplay.slice(1);
  
  const audienceStr = audience.key !== 'none' ? ` for ${audience.phrase}` : '';
  const constraintStr = constraint.key !== 'none' ? ` ${constraint.phrase}` : '';

  return [
    `Introduction: Why ${topicDisplay}${audienceStr}${constraintStr} matters in 2026`,
    `Step 1: Understand the fundamentals before you start`,
    `Step 2: The exact setup process (do not skip this)`,
    `Step 3: Step-by-step strategy tailored${audienceStr}`,
    `Step 4: Common mistakes creators make and how to avoid them`,
    `Step 5: Measure your results and optimize further`,
    `Tools and resources to accelerate your progress`,
    'Frequently Asked Questions',
    'Key takeaways and next steps',
  ];
}

// ── Generate scenario-specific FAQs ──
function generateFaq(action, audience, constraint) {
  const faqs = [];

  // Base FAQ based on category
  if (action.category === 'monetization') {
    faqs.push('How long does it take to start earning money on YouTube?');
    faqs.push('Can small channels make money on YouTube?');
    faqs.push('What are the YouTube monetization requirements in 2026?');
  } else if (action.category === 'channel growth') {
    faqs.push('How long does it take to see results?');
    faqs.push('Can I grow without posting every day?');
    faqs.push('Is it too late to start a YouTube channel in 2026?');
  } else if (action.category === 'SEO') {
    faqs.push('How long does YouTube SEO take to work?');
    faqs.push('Do tags still matter for YouTube SEO?');
    faqs.push('Can I rank without using paid tools?');
  } else if (action.category === 'shorts') {
    faqs.push('Do Shorts watch hours count toward monetization?');
    faqs.push('How often should I post Shorts?');
    faqs.push('Can Shorts hurt my long-form video performance?');
  } else if (action.category === 'thumbnails') {
    faqs.push('What makes a YouTube thumbnail effective?');
    faqs.push('Should I put my face in every thumbnail?');
    faqs.push('How do I A/B test thumbnails on YouTube?');
  } else if (action.category === 'policies') {
    faqs.push('What happens if I get a copyright strike?');
    faqs.push('Can I appeal a demonetization decision?');
    faqs.push('How do I avoid reused content flags?');
  } else if (action.category === 'production') {
    faqs.push('What is the best free video editing software for YouTube?');
    faqs.push('How can I improve my YouTube video quality with basic equipment?');
    faqs.push('Do I need a professional camera to succeed on YouTube?');
  } else if (action.category === 'analytics') {
    faqs.push('Which YouTube metric matters most for growth?');
    faqs.push('How do I read the audience retention graph?');
    faqs.push('What is a good CTR on YouTube?');
  } else if (action.category === 'content strategy') {
    faqs.push('How often should I post on YouTube?');
    faqs.push('How do I plan a YouTube content calendar?');
    faqs.push('Should I focus on one niche or multiple topics?');
  } else {
    faqs.push('How long does this take to see results?');
    faqs.push('Is this strategy still effective in 2026?');
    faqs.push('Can beginners succeed with this approach?');
  }

  // Audience-specific FAQ
  if (audience.key === 'faceless') {
    faqs.push('Can a faceless channel get monetized?');
  } else if (audience.key === 'shorts_only') {
    faqs.push('Is it possible to build a full channel with only Shorts?');
  } else if (audience.key === 'beginners') {
    faqs.push('What should I do in my first 30 days on YouTube?');
  } else if (audience.key === 'gaming') {
    faqs.push('How do gaming channels stand out in a crowded niche?');
  }

  // Constraint-specific FAQ
  if (constraint.key === 'no_money' || constraint.key === 'low_budget') {
    faqs.push('Can I succeed on YouTube without spending any money?');
  } else if (constraint.key === 'no_face') {
    faqs.push('Do faceless channels get less engagement than channels that show a face?');
  } else if (constraint.key === 'phone_only') {
    faqs.push('Is phone footage good enough for YouTube in 2026?');
  } else if (constraint.key === 'no_subs') {
    faqs.push('How do I get my first 100 subscribers?');
  }

  return [...new Set(faqs)].slice(0, 6);
}

// ── Generate CTA ──
function generateCta(action) {
  const ctas = {
    'SEO': 'Run your next video title through a keyword check before you publish.',
    'thumbnails': 'Create two thumbnail variants for your next video and track which one performs better.',
    'monetization': 'Review your channel against the monetization checklist and identify your biggest gap.',
    'channel growth': 'Audit your last 5 videos against this framework and fix the weakest one first.',
    'content strategy': 'Brainstorm 10 video ideas using the framework above and pick your top 3.',
    'shorts': 'Record 3 Shorts this week using the strategy outlined above and track the results.',
    'production': 'Pick one production improvement from this guide and apply it to your next video.',
    'analytics': 'Open YouTube Studio right now and check your retention graph on your last 3 videos.',
    'policies': 'Review your last 10 videos for any potential policy issues before the next upload.',
  };
  return ctas[action.category] || 'Apply the steps from this guide to your next video and measure the impact.';
}

// ═══════════════════════════════════════════════════════════════
//  DEDUPLICATION & RANKING
// ═══════════════════════════════════════════════════════════════

function deduplicateAndRank(candidates) {
  const seen = new Set();
  const unique = [];

  for (const c of candidates) {
    const normalized = c.primary_keyword.toLowerCase().trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(c);
  }

  // Sort by opportunity score (descending)
  unique.sort((a, b) => b.opportunity_score - a.opportunity_score);

  return unique;
}

// ═══════════════════════════════════════════════════════════════
//  STATS & METADATA
// ═══════════════════════════════════════════════════════════════

export function getEngineStats() {
  return {
    totalActions: CORE_ACTIONS.length,
    totalAudiences: AUDIENCES.length,
    totalConstraints: CONSTRAINTS.length,
    totalGeoLocales: GEO_LOCALES.length,
    theoreticalMaxCombinations: CORE_ACTIONS.length * AUDIENCES.length * CONSTRAINTS.length * GEO_LOCALES.length,
    categoriesRepresented: [...new Set(CORE_ACTIONS.map(a => a.category))],
    categoryDistribution: CORE_ACTIONS.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {}),
  };
}

// ═══════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════

// ── POST /api/programmatic-seo/long-tail/generate ──
// Generate long-tail keyword candidates and optionally save to DB
router.post('/generate', async (req, res) => {
  try {
    const { categories, includeGeo, maxPerAction, limit, save } = req.body || {};
    const candidates = generateLongTailCandidates({ categories, includeGeo, maxPerAction });

    const limited = limit ? candidates.slice(0, limit) : candidates;

    // Optionally save to content_opportunities table
    let saved = 0;
    if (save) {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        for (const c of limited) {
          try {
            await dbService.createContentOpportunity({
              keyword: c.primary_keyword,
              pageType: 'blog',
              targetUrlSlug: c.url_slug,
              priority: Math.min(10, Math.round(c.opportunity_score / 10)),
              status: 'pending',
              metadata: c,
            });
            saved++;
          } catch (e) { /* skip duplicates */ }
        }
      } catch (dbErr) {
        console.warn('[LongTail] DB save failed:', dbErr.message);
      }
    }

    // Category breakdown
    const categoryBreakdown = {};
    for (const c of limited) {
      categoryBreakdown[c.topic_category] = (categoryBreakdown[c.topic_category] || 0) + 1;
    }

    res.json({
      total: candidates.length,
      returned: limited.length,
      saved,
      candidates: limited,
      category_breakdown: categoryBreakdown,
      stats: getEngineStats(),
    });
  } catch (e) {
    console.error('[LongTail] Generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/programmatic-seo/long-tail/stats ──
router.get('/stats', async (req, res) => {
  res.json(getEngineStats());
});

// ── GET /api/programmatic-seo/long-tail/categories ──
router.get('/categories', async (req, res) => {
  const categories = [...new Set(CORE_ACTIONS.map(a => a.category))];
  res.json({ categories });
});

// ── POST /api/programmatic-seo/long-tail/preview ──
// Quick preview without saving — shows what would be generated
router.post('/preview', async (req, res) => {
  try {
    const { categories, includeGeo } = req.body || {};
    const candidates = generateLongTailCandidates({ categories, includeGeo, maxPerAction: 5 });
    const sample = candidates.slice(0, 15);
    res.json({
      total: candidates.length,
      sample,
      sample_keywords: sample.map(c => c.primary_keyword),
      category_breakdown: sample.reduce((acc, c) => {
        acc[c.topic_category] = (acc[c.topic_category] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (e) {
    console.error('[LongTail] Preview error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export { CORE_ACTIONS, AUDIENCES, CONSTRAINTS, GEO_LOCALES };
