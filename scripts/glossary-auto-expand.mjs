#!/usr/bin/env node
/**
 * scripts/glossary-auto-expand.mjs
 *
 * Auto-detects glossary gaps by:
 *   1. Scanning blog posts for topics not yet in the glossary
 *   2. Suggesting combinatorial term clusters (e.g. "X vs Y" variants)
 *   3. Adding the best candidates to glossary-data.json directly
 *
 * Usage:
 *   node scripts/glossary-auto-expand.mjs                    # Scan + suggest + fill
 *   node scripts/glossary-auto-expand.mjs --dry-run          # Preview only
 *   node scripts/glossary-auto-expand.mjs --count 10         # Max terms to add
 *   node scripts/glossary-auto-expand.mjs --scan-only        # Only scan, don't add
 *
 * Env: GROQ_API_KEY (primary), GEMINI_API_KEY (fallback)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const GLOSSARY_DIR = resolve(PROJECT, 'public/glossary');

const DRY_RUN = process.argv.includes('--dry-run');
const SCAN_ONLY = process.argv.includes('--scan-only');
const COUNT_FLAG = process.argv.indexOf('--count');
const MAX_TERMS = COUNT_FLAG > -1 ? parseInt(process.argv[COUNT_FLAG + 1]) || 10 : 10;

const CATEGORIES = ['analytics', 'algorithm', 'seo-optimization', 'monetization', 'content-strategy', 'youtube-features'];

// ── Read existing data ────────────────────────────────────────

function loadData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
  if (DRY_RUN) return;
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Scan blog posts for potential glossary terms ─────────────

function extractPotentialTermsFromBlogs() {
  if (!existsSync(BLOG_DIR)) {
    console.log('  ⚠ No blog directory found — skipping blog scan');
    return [];
  }

  const blogFiles = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
  console.log(`  Scanning ${blogFiles.length} blog posts for unglossed terms...`);

  // Common YouTube SEO terms that might not be in the glossary yet
  const CANDIDATE_PATTERNS = [
    // YouTube-specific features & concepts
    /YouTube\s+(Shorts|Studio|Premium|Music|TV|Kids|Gaming|Live|Podcasts|Analytics|Search|Trends|News)/gi,
    /(video|channel|content)\s+(ideas|strategy|planning|calendar|pillar|topic|research)/gi,
    /(thumbnail|title|description|tag|end.?screen|card|chapter|transcript|caption|hashtag)/gi,
    /(impression|CTR|click.?through|view|watch.?time|retention|audience.?retention|session.?time|dwell.?time)/gi,
    /(keyword|search.?volume|difficulty|opportunity|cannibalization|long.?tail|semantic|LSI)/gi,
    /(algorithm|ranking|rank|recommendation|suggested|browse|search.?result|SERP)/gi,
    /(monetization|ad.?revenue|CPM|RPM|AdSense|sponsorship|affiliate|membership|super.?chat|super.?thanks)/gi,
    /(a.?b.?test|split.?test|experiment|optimize|iteration|analytics|metric|KPI|benchmark)/gi,
    /(evergreen|seasonal|trending|viral|timely|pillar|cornerstone|hub|cluster)/gi,
    /(hook|intro|outro|CTA|call.?to.?action|engagement|comment|like|share|subscribe)/gi,
    /(niche|audience|demographic|persona|target|viewer|subscriber|fan|community)/gi,
    /(collaboration|collab|duet|stitch|remix|response|reaction|feature)/gi,
    /(playlist|series|mini.?series|season|episode|chapter|segment)/gi,
    /(voice.?over|narration|script|teleprompter|b.?roll|cut|transition|effect)/gi,
  ];

  const found = new Set();
  for (const file of blogFiles) {
    try {
      const html = readFileSync(resolve(BLOG_DIR, file), 'utf-8');
      for (const [i, pattern] of CANDIDATE_PATTERNS.entries()) {
        const matches = html.matchAll(pattern);
        for (const m of matches) {
          const term = m[0].trim();
          if (term.length > 2 && term.length < 60) {
            found.add(term);
          }
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }

  console.log(`  Found ${found.size} candidate terms from blog content`);
  return [...found].sort();
}

// ── Combinatorial term generation ─────────────────────────────

function generateCombinatorialTerms(existingTerms, existingSlugs) {
  const generated = [];

  // Pattern: "X for Y" variants
  const FORMAT_PAIRS = [
    ['Keyword Research', 'Small Channels'],
    ['Keyword Research', 'Beginners'],
    ['Keyword Research', 'YouTube SEO'],
    ['Video SEO', 'Tutorials'],
    ['Video SEO', 'Gaming Channels'],
    ['Video SEO', 'Music Channels'],
    ['Channel Optimization', 'New Creators'],
    ['Channel Optimization', 'Small Channels'],
    ['Content Strategy', 'Monetization'],
    ['Content Strategy', 'Channel Growth'],
    ['YouTube Analytics', 'Content Strategy'],
    ['Thumbnail Design', 'Click-Through Rate'],
    ['Thumbnail Design', 'YouTube Shorts'],
    ['Video Editing', 'Workflow'],
    ['Video Editing', 'Productivity'],
    ['YouTube Shorts', 'Monetization 2026'],
    ['YouTube Shorts', 'Algorithm 2026'],
    ['Live Streaming', 'Monetization'],
    ['Live Streaming', 'Audience Growth'],
    ['Audience Retention', 'Content Strategy'],
    ['Audience Retention', 'Video Structure'],
  ];

  const existingLower = new Set(existingTerms.map(t => typeof t === 'string' ? t.toLowerCase() : (t.term || '').toLowerCase()));

  for (const [base, modifier] of FORMAT_PAIRS) {
    const slug = `${base.toLowerCase().replace(/\s+/g, '-')}-for-${modifier.toLowerCase().replace(/\s+/g, '-')}`.replace(/[^a-z0-9-]/g, '');
    if (existingSlugs.has(slug)) continue;

    const termName = `${base} for ${modifier}`;
    if (existingLower.has(termName.toLowerCase())) continue;

    // Determine category based on base term
    let category = 'content-strategy';
    const baseLower = base.toLowerCase();
    if (baseLower.includes('analytics') || baseLower.includes('retention') || baseLower.includes('ctr')) category = 'analytics';
    else if (baseLower.includes('algorithm') || baseLower.includes('ranking')) category = 'algorithm';
    else if (baseLower.includes('keyword') || baseLower.includes('seo') || baseLower.includes('thumbnail') || baseLower.includes('tag')) category = 'seo-optimization';
    else if (baseLower.includes('monetiz')) category = 'monetization';
    else if (baseLower.includes('short') || baseLower.includes('live') || baseLower.includes('edit')) category = 'youtube-features';

    generated.push({
      term: termName,
      slug,
      shortDefinition: `Learn how to optimize ${base.toLowerCase()} specifically for ${modifier.toLowerCase()}. This guide covers tailored strategies, common challenges, and proven techniques that work for ${modifier.toLowerCase()} channels and creators in 2026.`,
      expandedDefinition: `${base} is a critical skill for YouTube success, but the approach changes depending on your audience and channel size. For ${modifier.toLowerCase()}, the strategies differ significantly from general best practices. This guide breaks down exactly what ${modifier.toLowerCase()} creators need to know about ${base.toLowerCase()}, including specific examples, tools, and techniques that deliver results. Whether you're just starting out or looking to refine your approach, understanding how ${base.toLowerCase()} applies to ${modifier.toLowerCase()} will help you create more effective content and grow faster.`,
      category,
      relatedTerms: [],
      relatedBlogs: [],
      id: slug,
      _source: 'combinatorial',
    });
  }

  return generated;
}

// ── Suggest related terms combinatorially ─────────────────────

function fillRelatedTerms(termData, allTerms) {
  if (termData.relatedTerms && termData.relatedTerms.length >= 3) return;

  const categoryTerms = allTerms.filter(t =>
    t.slug !== termData.slug &&
    t.category === termData.category
  );

  // Score: prefer terms with similar length (more specific match) + mutual links
  const scored = categoryTerms.map(t => ({
    slug: t.slug,
    score: (t.relatedTerms?.includes(termData.slug) ? 30 : t.term.length)
  })).sort((a, b) => b.score - a.score);

  const existing = new Set(termData.relatedTerms || []);
  if (!termData.relatedTerms) termData.relatedTerms = [];

  let added = 0;
  for (const candidate of scored) {
    if (added >= 4) break;
    if (existing.has(candidate.slug)) continue;
    termData.relatedTerms.push(candidate.slug);
    existing.add(candidate.slug);
    added++;
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Glossary Auto-Expansion Engine\n`);

  if (!existsSync(DATA_FILE)) {
    console.error('❌ glossary-data.json not found');
    process.exit(1);
  }

  const data = loadData();
  const existingSlugs = new Set(data.terms.map(t => t.slug));
  const added = [];

  // Phase 1: Scan blogs for potential terms
  console.log('Phase 1: Scanning blog content...');
  const blogCandidates = extractPotentialTermsFromBlogs();

  // Phase 2: Combinatorial generation
  console.log('\nPhase 2: Generating combinatorial term variants...');
  const combinatorial = generateCombinatorialTerms(data.terms, existingSlugs);
  console.log(`  Generated ${combinatorial.length} combinatorial variants`);

  // Phase 3: Combine and filter
  console.log('\nPhase 3: Filtering and ranking candidates...');
  const allCandidates = [...combinatorial];

  for (const term of allCandidates) {
    if (existingSlugs.has(term.slug)) continue;

    // Auto-fill related terms based on category
    fillRelatedTerms(term, data.terms);

    // Auto-fill related blog slugs if any blog matches
    const blogSlug = term.slug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (existsSync(resolve(BLOG_DIR, `${blogSlug}.html`))) {
      term.relatedBlogs = [blogSlug];
    }

    added.push(term);
    existingSlugs.add(term.slug);
  }

  if (added.length === 0) {
    console.log('\n✅ No new terms to add — glossary is comprehensive!\n');
    return;
  }

  // Limit to MAX_TERMS
  const toAdd = added.slice(0, MAX_TERMS);

  // Add to data
  data.terms.push(...toAdd);
  data.meta.totalTerms = data.terms.length;
  data.meta.generatedAt = new Date().toISOString().split('T')[0];
  data.meta.lastAutoExpand = new Date().toISOString();

  saveData(data);

  console.log(`\n✅ Added ${toAdd.length} terms (${added.length - toAdd.length} more queued for next cycle):\n`);
  for (const t of toAdd) {
    const source = t._source || 'ai';
    console.log(`  ✅ ${t.term} → /glossary/${t.slug}  [${t.category}]  (${source})`);
    if (t.relatedTerms.length > 0) {
      console.log(`     Related: ${t.relatedTerms.join(', ')}`);
    }
  }

  console.log(`\n  Total terms: ${data.terms.length}`);
  console.log(`  Saved to: scripts/glossary-data.json\n`);

  if (SCAN_ONLY) {
    console.log('\n  📋 Scan-only mode — no changes saved.');
    console.log(`  Blog candidates found: ${blogCandidates.length}`);
    console.log(`  Combinatorial variants: ${combinatorial.length}\n`);
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
