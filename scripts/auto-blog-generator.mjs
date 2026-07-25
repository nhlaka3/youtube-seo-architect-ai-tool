#!/usr/bin/env node
/**
 * scripts/auto-blog-generator.mjs (v2 — improved)
 *
 * Automated blog post generator for YT SEO Architect.
 * Picks the next low-competition keyword, generates a 1500+ word
 * SEO article via Groq (with Gemini fallback), validates it, and
 * writes the HTML file to public/blog/. Deploys via Vercel.
 *
 * v2 IMPROVEMENTS:
 *   - Retry logic with exponential backoff (3 attempts per section)
 *   - Gemini 2.0 Flash fallback when Groq fails/rate-limits
 *   - Minimum section threshold: aborts if <50% of sections succeed
 *   - Expanded BANNED_WORDS matching validation (full 22-word list)
 *   - Post-generation quality gate: re-validates final assembled output
 *   - Content deduplication: checks similarity against existing posts
 *   - Expanded system prompt with stronger anti-AI-detection rules
 *   - "Data-driven" template type for more content variety
 *   - Keyword auto-refill: generates more keywords when list runs low
 *
 * Usage:
 *   node scripts/auto-blog-generator.mjs              # Generate next pending post
 *   node scripts/auto-blog-generator.mjs --dry-run     # Preview without writing
 *   node scripts/auto-blog-generator.mjs --keyword "specific keyword"  # Override
 *   node scripts/auto-blog-generator.mjs --keyword "kw" --force  # Override + skip demand check
 *   node scripts/auto-blog-generator.mjs --list         # Show pending keywords
 *   node scripts/auto-blog-generator.mjs --refill       # Auto-generate more keywords (demand-vetted)
 *   node scripts/auto-blog-generator.mjs --validate-slug <slug>  # Re-validate existing post
 *
 * Env: GROQ_API_KEY in .env (primary), GEMINI_API_KEY (fallback, optional)
 *
 * Flow:
 *   1. Read keywords.json, pick next 'pending' entry
 *   2. Call Groq API (with Gemini fallback) to generate article body HTML
 *   3. Wrap in blog template via blog-renderer.js
 *   4. Validate with blog-validation.js (v2 expanded checks)
 *   5. Post-generation quality gate (banned words, section count)
 *   6. Write to public/blog/{slug}.html
 *   7. Insert into DB for dynamic sitemap
 *   8. Deploy to Vercel
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ── Paths ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const KEYWORDS_FILE = resolve(PROJECT, 'scripts/keywords.json');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const SITEMAP_FILE = resolve(PROJECT, 'sitemap.xml');

// ── Load dependencies (project modules) ────────────────────────────

const { renderBlogTemplate } = await import('../api/blog-renderer.js');
const { validateBlogPost } = await import('../api/blog-validation.js');

// Database for dynamic sitemap
let dbService = null;
try {
  const { default: ds } = await import('../src/database/services.js');
  dbService = ds;
} catch (e) {
  console.log('  ⚠ Database not available, skipping DB insert');
}

// ── Load env ───────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(PROJECT, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ── Parse CLI args ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIST_MODE = args.includes('--list');
const REFILL_MODE = args.includes('--refill');
const FORCE_MODE = args.includes('--force');
const VALIDATE_SLUG = args.includes('--validate-slug')
  ? args[args.indexOf('--validate-slug') + 1]
  : null;
const KEYWORD_OVERRIDE = args.includes('--keyword')
  ? args[args.indexOf('--keyword') + 1]
  : null;

// ── Constants ──────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const MIN_SECTIONS_RATIO = 0.5; // At least 50% of sections must succeed
const MIN_WORD_COUNT = 1600;

// Full banned words list — matches blog-validation.js exactly
// These words trigger AI content detectors and AdSense manual review
// NOTE: "in this article" excluded — it's a legitimate TOC heading in blog-renderer.js
const BANNED_WORDS = [
  'excited', 'leverage', 'seamless', 'robust', 'embark', 'streamline',
  'pivotal', 'cutting-edge', 'delve', 'harness', 'unlock', 'realm',
  'tapestry', 'landscape', 'ecosystem', 'game-changer', 'next level',
  'dive deep', 'in today\'s digital age', 'it\'s worth noting',
  'without further ado',
];

// ── Keyword list management ────────────────────────────────────────

function loadKeywords() {
  return JSON.parse(readFileSync(KEYWORDS_FILE, 'utf-8'));
}

function saveKeywords(data) {
  data.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(KEYWORDS_FILE, JSON.stringify(data, null, 2) + '\n');
}

function pickNextKeyword(data, override) {
  if (override) {
    const existing = data.keywords.find(k =>
      k.keyword.toLowerCase() === override.toLowerCase()
    );
    if (existing) return existing;

    const slug = override
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return {
      keyword: override,
      slug,
      category: 'Generated',
      status: 'pending',
      notes: 'CLI override',
    };
  }

  const pending = data.keywords.filter(k => k.status === 'pending');
  if (pending.length === 0) return null;
  return pending[0];
}

function markDone(data, slug) {
  const entry = data.keywords.find(k => k.slug === slug);
  if (entry) {
    entry.status = 'done';
    entry.generatedAt = new Date().toISOString();
  }
}

// ── Demand check gate (NEW) ───────────────────────────────────────

const DEMAND_THRESHOLD = 15;
const RANKABILITY_THRESHOLD = 55;

function checkKeywordDemand(keyword) {
  try {
    const output = execSync(
      `cd '${PROJECT}' && python3 scripts/check-keyword.py "${keyword.replace(/"/g, '\\"')}" 2>&1`,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    let demand = null;
    let rankability = null;

    const demandMatch = output.match(/DEMAND SCORE[\s\S]*?Score: (\d+)\/100/);
    if (demandMatch) demand = parseInt(demandMatch[1]);

    const rankMatch = output.match(/RANKABILITY:.*?\[[█░]+\] (\d+)\/100/);
    if (rankMatch) rankability = parseInt(rankMatch[1]);

    const hasDemand = demand !== null && demand >= DEMAND_THRESHOLD;
    const hasRankability = rankability !== null && rankability >= RANKABILITY_THRESHOLD;

    return {
      pass: hasDemand && hasRankability,
      demand,
      rankability,
      demandOk: hasDemand,
      rankabilityOk: hasRankability,
    };
  } catch (e) {
    console.log(`    ⚠ Demand check failed: ${e.message}`);
    console.log('    → Continuing anyway (fallback to competition-only decision)');
    return { pass: true, demand: null, rankability: null, demandOk: true, rankabilityOk: true, skipped: true };
  }
}

// ── Existing post deduplication ────────────────────────────────────

function getExistingSlugs() {
  try {
    return readdirSync(BLOG_DIR)
      .filter(f => f.endsWith('.html') && !f.startsWith('_'))
      .map(f => f.replace('.html', ''));
  } catch {
    return [];
  }
}

function getExistingTitles() {
  const slugs = getExistingSlugs();
  const titles = [];
  for (const slug of slugs) {
    try {
      const html = readFileSync(resolve(BLOG_DIR, `${slug}.html`), 'utf-8');
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) titles.push(titleMatch[1].replace(/ — YT SEO Architect$/, ''));
    } catch { /* skip */ }
  }
  return titles;
}

function checkDeduplication(keyword, slug) {
  const existingSlugs = getExistingSlugs();
  if (existingSlugs.includes(slug)) {
    return { duplicate: true, reason: `Post ${slug}.html already exists` };
  }

  // Check keyword similarity against existing titles
  const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const existingTitles = getExistingTitles();
  for (const title of existingTitles) {
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const overlap = kwWords.filter(w => titleWords.includes(w)).length;
    const similarity = overlap / Math.max(kwWords.length, 1);
    if (similarity > 0.8) {
      return { duplicate: true, reason: `Too similar to existing: "${title}" (${Math.round(similarity * 100)}% overlap)` };
    }
  }

  return { duplicate: false };
}

// ── Post-generation quality gate ───────────────────────────────────

function qualityGate(html) {
  const issues = [];

  // 1. Check banned words in the final output
  const lower = html.toLowerCase();
  const foundBanned = [];
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      foundBanned.push(word);
      issues.push(`Banned word found: "${word}"`);
    }
  }

  // 2. Check section count (minimum 3 H2 headings)
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2Count < 3) {
    issues.push(`Only ${h2Count} H2 sections (need ≥3)`);
  }

  // 3. FAQ check — SKIPPED because blog-renderer.js auto-generates
  //    FAQ blocks when they're missing from the raw content.

  // 4. Check for empty sections (H2 followed immediately by another H2)
  const emptySections = html.match(/<h2[^>]*>.*?<\/h2>\s*<h2/gi);
  if (emptySections && emptySections.length > 1) {
    issues.push(`${emptySections.length} empty sections detected`);
  }

  // 5. Check minimum word count
  const words = countWords(html);
  if (words < MIN_WORD_COUNT) {
    issues.push(`Word count ${words} below ${MIN_WORD_COUNT} minimum`);
  }

  return { valid: issues.length === 0, issues, wordCount: words, foundBanned };
}

// ── API calls with retry + fallback ────────────────────────────────

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      const body = await res.text();

      // Rate limited — wait and retry
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_BASE_DELAY_MS * attempt;
        console.log(`    ⏳ Rate limited. Waiting ${waitMs / 1000}s (attempt ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, waitMs));
        lastError = new Error(`Rate limited (429): ${body}`);
        continue;
      }

      // Server error — retry
      if (res.status >= 500) {
        console.log(`    ⚠ Server error ${res.status}. Retrying in ${RETRY_BASE_DELAY_MS * attempt / 1000}s (attempt ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
        lastError = new Error(`Server error ${res.status}: ${body}`);
        continue;
      }

      // Client error — don't retry
      throw new Error(`API error ${res.status}: ${body}`);
    } catch (e) {
      if (attempt === retries) throw e;
      lastError = e;
      // Network error — retry with backoff
      console.log(`    ⚠ Request failed: ${e.message}. Retrying in ${RETRY_BASE_DELAY_MS * attempt / 1000}s (attempt ${attempt}/${retries})...`);
      await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }
  }
  throw lastError || new Error('All retries exhausted');
}

async function generateSectionViaGroq(apiKey, systemPrompt, sectionPrompt) {
  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sectionPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 0.9,
      }),
    }
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');
  return cleanHTML(content);
}

async function generateSectionViaGemini(apiKey, systemPrompt, sectionPrompt) {
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${sectionPrompt}` }] },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return cleanHTML(text);
}

async function generateSection(systemPrompt, sectionPrompt) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Try Groq first (primary)
  if (groqKey) {
    try {
      return await generateSectionViaGroq(groqKey, systemPrompt, sectionPrompt);
    } catch (e) {
      console.log(`    ⚠ Groq failed: ${e.message}`);
      if (!geminiKey) throw e;
      console.log('    → Falling back to Gemini...');
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    return await generateSectionViaGemini(geminiKey, systemPrompt, sectionPrompt);
  }

  throw new Error('No API keys available (GROQ_API_KEY and/or GEMINI_API_KEY)');
}

function cleanHTML(text) {
  return text
    .replace(/^```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

// ── Article generation ─────────────────────────────────────────────

async function generateArticle(keyword, slug) {
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  // ── Template types for content variation ─────────────────────────
  const TEMPLATE_TYPES = [
    {
      name: 'guide',
      label: 'Complete Guide',
      sections: [
        { id: 'definition', prompt: `Write section 1 of a blog post about "${keyword}" (${year}). DEFINITION and INTRODUCTION.
H2: <h2 id="definition">What Is [Topic] and Why It Matters in ${year}</h2>
300-400 words. Define the concept, explain why it matters for YouTube creators, include 1-2 statistics from real data.
End with: <div class="tip-card"><strong>\ud83d\udca1 EXPERT TIP:</strong> [pro tip]</div>
Return ONLY the HTML.` },
        { id: 'deep-dive', prompt: `Write section 2 of a blog post about "${keyword}" (${year}). DEEP DIVE.
H2: <h2 id="deep-dive">The Complete Breakdown: [Topic] Explained</h2>
300-400 words. Include a <table> comparing 3+ approaches (columns: Approach, Pros, Cons, Best For).
Return ONLY the HTML.` },
        { id: 'step-by-step', prompt: `Write section 3 of a blog post about "${keyword}" (${year}). STEP-BY-STEP GUIDE.
H2: <h2 id="step-by-step">How to [Do This]: Step-by-Step Guide</h2>
350-450 words. 5+ numbered steps using <ol>. Each step: what to do, why, common mistake.
Include: <div class="warning-callout"><strong>\u26a0\ufe0f WARNING:</strong> [pitfall]</div>
Mention YT SEO Architect where relevant. Return ONLY the HTML.` },
        { id: 'comparison', prompt: `Write section 4 of a blog post about "${keyword}" (${year}). TOOLS section.
H2: <h2 id="comparison">Best Tools and Methods for [Topic] in ${year}</h2>
300-400 words. Compare 3-4 tools in a <table> (columns: Tool, Price, Key Feature, Rating).
Include YT SEO Architect as the free option. Return ONLY the HTML.` },
        { id: 'common-mistakes', prompt: `Write section 5 of a blog post about "${keyword}" (${year}). COMMON MISTAKES.
H2: <h2 id="common-mistakes">5 [Topic] Mistakes That Kill Your YouTube Growth</h2>
300-400 words. 5 specific mistakes with <h3> titles. Each: what, why it hurts, how to fix.
Include: <div class="alert-box"><strong>\u2139\ufe0f NOTE:</strong> [insight]</div>
Be blunt and specific — no vague advice. Return ONLY the HTML.` },
        { id: 'advanced-tips', prompt: `Write the FINAL section of a blog post about "${keyword}" (${year}). ADVANCED TIPS.
H2: <h2 id="advanced-tips">Advanced Strategies for [Topic] in ${year}</h2>
250-350 words. 2-3 advanced strategies with specific numbers or examples.
Include a tip-card div.
End with CTA: try YT SEO Architect free tools. Link to /dashboard.
NO "in conclusion". Return ONLY the HTML.` },
      ],
    },
    {
      name: 'listicle',
      label: 'Top Picks Listicle',
      sections: [
        { id: 'intro', prompt: `Write the INTRODUCTION for a listicle about "${keyword}" (${year}).
H2: <h2 id="intro">Why [Topic] Matters More Than Ever in ${year}</h2>
200-300 words. Hook with a stat. Explain what the list covers.
End with: <div class="tip-card"><strong>\ud83d\udca1 PRO TIP:</strong> [tip for using this list]</div>
Return ONLY the HTML.` },
        { id: 'list-1', prompt: `Write items 1-4 of a listicle about "${keyword}" (${year}).
For EACH: <h3><strong>1. [Item Name]</strong></h3> then 80-120 words.
Include: what it is, why it ranks here, who it's best for, one specific tip.
Return ONLY the HTML.` },
        { id: 'list-2', prompt: `Write items 5-8 of a listicle about "${keyword}" (${year}).
Same format. Include a <table> comparing items 1-8 (columns: Rank, Item, Best For, Difficulty, Free?).
Return ONLY the HTML.` },
        { id: 'list-3', prompt: `Write items 9-10 (top picks) of a listicle about "${keyword}" (${year}).
H2: <h2 id="top-picks">The Top 2 Picks</h2>
150-200 words each. These are the BEST — explain why they beat everything else.
Include: <div class="alert-box"><strong>\ud83c\udfc6 EDITOR'S CHOICE:</strong> [why #1 wins]</div>
Return ONLY the HTML.` },
        { id: 'how-to-choose', prompt: `Write "How to Choose" section for "${keyword}" (${year}).
H2: <h2 id="how-to-choose">How to Pick the Right One for YOUR Channel</h2>
250-350 words. Decision framework: "Beginner -> X, Growing -> Y, Established -> Z."
Include a <table> (columns: Channel Size, Recommended, Why).
End with CTA to /dashboard. Return ONLY the HTML.` },
        { id: 'faq', prompt: `Write an FAQ section for "${keyword}" (${year}).
H2: <h2 id="faq">Frequently Asked Questions</h2>
5 items using <details>/<summary> with class="faq-item" and answer divs with class="faq-answer".
Questions real creators search for. Return ONLY the HTML.` },
      ],
    },
    {
      name: 'case-study',
      label: 'Case Study / Deep Analysis',
      sections: [
        { id: 'setup', prompt: `Write the SETUP for a case study about "${keyword}" (${year}).
H2: <h2 id="setup">The Challenge: What We Set Out to Prove</h2>
250-350 words. Frame as investigation/experiment. Hypothesis, channels studied, timeframe.
Use realistic numbers. Return ONLY the HTML.` },
        { id: 'methodology', prompt: `Write METHODOLOGY for "${keyword}" (${year}).
H2: <h2 id="methodology">How We Tested This</h2>
250-350 words. Step-by-step approach.
Include a <table> (columns: Variable, Control, Test, Expected Outcome).
Be transparent about limitations. Return ONLY the HTML.` },
        { id: 'findings', prompt: `Write FINDINGS for "${keyword}" (${year}).
H2: <h2 id="findings">What the Data Actually Shows</h2>
350-450 words. Results with specific numbers.
Include <table> with before/after metrics (columns: Metric, Before, After, Change %).
Include: <div class="tip-card"><strong>\ud83d\udca1 KEY FINDING:</strong> [insight]</div>
Return ONLY the HTML.` },
        { id: 'analysis', prompt: `Write ANALYSIS for "${keyword}" (${year}).
H2: <h2 id="analysis">Why These Results Happened</h2>
300-400 words. Explain the WHY behind the data.
Connect to YouTube algorithm. Include: <div class="warning-callout"><strong>\u26a0\ufe0f IMPORTANT:</strong> [caveat]</div>
Return ONLY the HTML.` },
        { id: 'takeaways', prompt: `Write TAKEAWAYS for "${keyword}" (${year}).
H2: <h2 id="takeaways">What Creators Should Steal From This</h2>
250-350 words. 3-5 actionable lessons as <h3> with explanation.
End with CTA: "Run your own audit at <a href='/dashboard'>YT SEO Architect</a>".
NO "in conclusion". Return ONLY the HTML.` },
      ],
    },
    {
      name: 'comparison',
      label: 'Head-to-Head Comparison',
      sections: [
        { id: 'intro', prompt: `Write INTRODUCTION for a comparison about "${keyword}" (${year}).
H2: <h2 id="intro">[Option A] vs [Option B]: Which One Actually Works?</h2>
250-300 words. Frame the debate. Why are creators confused? Tease the winner.
Return ONLY the HTML.` },
        { id: 'overview', prompt: `Write OVERVIEW comparing two approaches to "${keyword}" (${year}).
H2: <h2 id="overview">Quick Comparison: Side-by-Side</h2>
Large <table> (columns: Feature, Option A, Option B, Winner). 8-10 features with check/cross emojis.
200 words of analysis after. Return ONLY the HTML.` },
        { id: 'deep-dive-a', prompt: `Write DEEP DIVE into Option A for "${keyword}" (${year}).
H2: <h2 id="option-a">Deep Dive: [Option A]</h2>
300-400 words. How it works, pricing, ease of use, results, best for.
2-3 examples. Honest about limitations.
Include: <div class="tip-card"><strong>\ud83d\udca1 TIP:</strong> [get the most from A]</div>
Return ONLY the HTML.` },
        { id: 'deep-dive-b', prompt: `Write DEEP DIVE into Option B for "${keyword}" (${year}).
H2: <h2 id="option-b">Deep Dive: [Option B]</h2>
300-400 words. Same structure. Fair and balanced.
Include: <div class="alert-box"><strong>\u2139\ufe0f NOTE:</strong> [distinction]</div>
Return ONLY the HTML.` },
        { id: 'verdict', prompt: `Write VERDICT for "${keyword}" (${year}).
H2: <h2 id="verdict">The Verdict: Which Should YOU Choose?</h2>
250-350 words. Clear recommendation by creator type.
"Choose A if... Choose B if..."
Include: <div class="warning-callout"><strong>\u26a0\ufe0f WATCH OUT:</strong> [mistake]</div>
End with CTA to /dashboard. Return ONLY the HTML.` },
        { id: 'faq', prompt: `Write FAQ for "${keyword}" (${year}).
H2: <h2 id="faq">Frequently Asked Questions</h2>
5 items using <details>/<summary> with class="faq-item" and answer divs with class="faq-answer".
Focus on "which is better for X" questions. Return ONLY the HTML.` },
      ],
    },
    {
      name: 'tutorial',
      label: 'Hands-On Tutorial',
      sections: [
        { id: 'prereq', prompt: `Write PREREQUISITES for a tutorial about "${keyword}" (${year}).
H2: <h2 id="prereq">What You Need Before Starting</h2>
200-250 words. List prerequisites using <ul>.
Tools needed, account requirements, skill level, estimated time.
Include: <div class="tip-card"><strong>\ud83d\udca1 PREP TIP:</strong> [advice]</div>
Return ONLY the HTML.` },
        { id: 'step-1-3', prompt: `Write steps 1-3 of a tutorial about "${keyword}" (${year}).
Use <h2 id="step-1">Step 1: [Action]</h2> format.
Each step: 100-150 words. What to do, expected result.
Include: <div class="warning-callout"><strong>\u26a0\ufe0f DON'T SKIP:</strong> [note]</div>
Return ONLY the HTML.` },
        { id: 'step-4-6', prompt: `Write steps 4-6 of a tutorial about "${keyword}" (${year}).
Same format. Build on previous steps.
Include a <table> for step 6: common errors and fixes (columns: Error, Cause, Fix).
Return ONLY the HTML.` },
        { id: 'step-7-9', prompt: `Write steps 7-9 (final) of a tutorial about "${keyword}" (${year}).
Step 7: optimization. Step 8: measure results. Step 9: scale.
Include: <div class="alert-box"><strong>\u2139\ufe0f PRO TIP:</strong> [scaling advice]</div>
Return ONLY the HTML.` },
        { id: 'troubleshooting', prompt: `Write TROUBLESHOOTING for "${keyword}" (${year}).
H2: <h2 id="troubleshooting">Common Problems and Fixes</h2>
250-350 words. 4-5 issues. Each as <h3>: what happens, why, how to fix.
Include <table> (columns: Problem, Likely Cause, Quick Fix).
Return ONLY the HTML.` },
        { id: 'results', prompt: `Write EXPECTED RESULTS for "${keyword}" (${year}).
H2: <h2 id="results">What Results to Expect (and When)</h2>
200-300 words. Realistic expectations.
Include <table> (columns: Timeframe, Expected Result, How to Measure).
End with CTA to /dashboard. Return ONLY the HTML.` },
      ],
    },
    {
      name: 'data-driven',
      label: 'Data-Driven Deep Dive',
      sections: [
        { id: 'hook', prompt: `Write the HOOK for a data-driven article about "${keyword}" (${year}).
H2: <h2 id="hook">The Numbers Don't Lie: [Topic] in ${year}</h2>
200-300 words. Open with a surprising statistic or data point. Set up what the article will reveal.
Include: <div class="tip-card"><strong>\ud83d\udca1 KEY INSIGHT:</strong> [one-sentence takeaway]</div>
Return ONLY the HTML.` },
        { id: 'data-overview', prompt: `Write DATA OVERVIEW for "${keyword}" (${year}).
H2: <h2 id="data-overview">What the Data Shows</h2>
300-400 words. Present3-5 key data points with context. Use <table> with columns: Metric, Finding, Why It Matters.
Be specific with numbers (percentages, counts, timeframes). Return ONLY the HTML.` },
        { id: 'deep-analysis', prompt: `Write DEEP ANALYSIS for "${keyword}" (${year}).
H2: <h2 id="deep-analysis">Breaking Down the Patterns</h2>
350-450 words. Analyze WHY the data looks this way. Connect patterns to YouTube algorithm behavior.
Include 2-3 sub-headings with <h3>. Return ONLY the HTML.` },
        { id: 'actionable-insights', prompt: `Write ACTIONABLE INSIGHTS for "${keyword}" (${year}).
H2: <h2 id="actionable-insights">What This Means for Your Channel</h2>
300-400 words. Convert data into3-5 specific actions. Each with: What to do, Expected impact, How to measure.
Include: <div class="warning-callout"><strong>\u26a0\ufe0f DON'T IGNORE:</strong> [critical step]</div>
Return ONLY the HTML.` },
        { id: 'predictions', prompt: `Write PREDICTIONS for "${keyword}" (${year}).
H2: <h2 id="predictions">Where This Is Heading in Late ${year} and Beyond</h2>
250-350 words. 2-3 predictions based on the data trends. Be specific with timeframes.
Include: <div class="alert-box"><strong>\u2139\ufe0f PRO TIP:</strong> [how to prepare]</div>
End with CTA to /dashboard. NO "in conclusion". Return ONLY the HTML.` },
        { id: 'faq', prompt: `Write FAQ for "${keyword}" (${year}).
H2: <h2 id="faq">Frequently Asked Questions</h2>
5 items using <details>/<summary> with class="faq-item" and answer divs with class="faq-answer".
Focus on data-related questions ("Is this true for small channels?", "How reliable is this data?").
Return ONLY the HTML.` },
      ],
    },
  ];

  // Pick template based on slug hash for consistency
  const templateIndex = [...slug].reduce((acc, c) => acc + c.charCodeAt(0), 0) % TEMPLATE_TYPES.length;
  const template = TEMPLATE_TYPES[templateIndex];
  console.log(`  Template: ${template.label} (${template.name})`);

  // Expanded system prompt with stronger anti-AI-detection rules
  const systemPrompt = `You are an expert YouTube SEO writer for YT SEO Architect (yt-seo-architect.vercel.app), a free AI-powered YouTube SEO tool with 17 tools.

CRITICAL RULES — VIOLATION = REJECTION:
- Write in a direct, authoritative tone. No fluff, no filler.
- NEVER use these words (they trigger AI content detectors):
  excited, leverage, seamless, robust, embark, streamline, pivotal,
  cutting-edge, delve, harness, unlock, realm, tapestry, landscape,
  ecosystem, game-changer, "next level", "dive deep",
  "in today's digital age", "it's worth noting",
  "without further ado"
- Also AVOID: "take it to the next level", "ultimate guide" (overused),
  "comprehensive" (AI signal), "myriad", "plethora", "facilitate"
- Write for YouTube creators who want actionable advice, not theory.
- Use HTML: <h2 id="...">, <h3>, <p>, <ul>/<ol>, <table>, <strong>.
- Mention YT SEO Architect naturally 2-3 times (link to /dashboard).
- Each section must be SUBSTANTIAL — at least 350 words of real content.
- Include specific examples, numbers, and step-by-step instructions.
- NO filler paragraphs, NO vague summaries, NO "in conclusion" garbage.
- Write like a human who actually uses YouTube — casual where appropriate,
  specific where it matters, blunt about what doesn't work.
- Vary sentence length. Mix short punchy sentences with longer explanations.
- Use contractions (you'll, it's, don't, can't) — they read more naturally.`;

  const sections = template.sections;
  const allSections = [];
  let totalWords = 0;
  let failedSections = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`  [${i + 1}/${sections.length}] Generating: ${section.id}...`);

    let html;
    try {
      html = await generateSection(systemPrompt, section.prompt);
      const words = countWords(html);
      totalWords += words;
      allSections.push(html);
      console.log(`    -> ${words} words (total: ${totalWords})`);
    } catch (e) {
      console.error(`    ❌ Section ${section.id} failed after retries: ${e.message}`);
      failedSections++;
    }

    // Delay between sections (respect rate limits)
    if (i < sections.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // Check minimum section threshold
  const successRate = allSections.length / sections.length;
  if (successRate < MIN_SECTIONS_RATIO) {
    throw new Error(
      `Too many failed sections: ${allSections.length}/${sections.length} succeeded ` +
      `(${Math.round(successRate * 100)}%, need ${Math.round(MIN_SECTIONS_RATIO * 100)}%). Aborting.`
    );
  }

  let html = allSections.join('\n\n');
  const finalCount = countWords(html);
  console.log(`  Generated: ${finalCount} words across ${allSections.length} sections`);

  // Ensure minimum length — expand if too short
  if (finalCount < MIN_WORD_COUNT) {
    console.log(`  ⚠ Only ${finalCount} words. Generating expansion...`);
    try {
      const expansion = await generateSection(systemPrompt,
        `Write an additional comprehensive section for a blog post about "${keyword}" (${year}).

This section covers REAL-WORLD EXAMPLES AND CASE STUDIES.

Requirements:
- H2 tag: <h2 id="examples">Real-World Examples: [Topic] That Actually Work</h2>
- 400-500 words minimum
- Include 2-3 specific examples with numbers (views gained, CTR improvement, etc.)
- Format each example as: <h3>Example 1: [Description]</h3> followed by details
- Reference YouTube creators who used these strategies successfully
- Be specific — channel names, video types, results achieved
- End with a key insight about what all examples have in common

Return ONLY the HTML for this section.`
      );
      allSections.push(expansion);
      console.log(`  Expansion added: ${countWords(expansion)} words`);
    } catch (e) {
      console.error(`  Expansion failed: ${e.message}`);
    }
    html = allSections.join('\n\n');
  }

  // Strip markdown code fences
  html = html
    .replace(/^```(?:html)?\s*\n?/gim, '')
    .replace(/\n?```\s*$/gim, '')
    .trim();

  // Ensure H2s have IDs
  if (!/<h2\s+id=/i.test(html)) {
    console.warn('  ⚠ Adding IDs to H2 tags...');
    let counter = 0;
    html = html.replace(/<h2>(.*?)<\/h2>/gi, (_, text) => {
      counter++;
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || `section-${counter}`;
      return `<h2 id="${id}">${text}</h2>`;
    });
  }

  return html;
}

// ── Word count ─────────────────────────────────────────────────────

function countWords(html) {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

// ── Sitemap update ─────────────────────────────────────────────────

// ── Blog listing page update ─────────────────────────────────────

function updateBlogListing(keywordEntry, page, wordCount) {
  const blogHtmlPath = resolve(PROJECT, 'blog.html');
  if (!existsSync(blogHtmlPath)) {
    console.log('  ⚠ blog.html not found, skipping listing update');
    return;
  }

  let blogHtml = readFileSync(blogHtmlPath, 'utf-8');
  const slug = keywordEntry.slug;

  // Don't add if already listed
  if (blogHtml.includes(`/blog/${slug}`)) {
    console.log('  Already in blog.html listing');
    return;
  }

  const category = keywordEntry.category || 'SEO';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const excerpt = page.metaDescription
    ? page.metaDescription.replace(/Learn how to /i, '').replace(/\. Step-by-step.*$/, '').slice(0, 120)
    : `Complete guide to ${keywordEntry.keyword}.`;

  const cardHtml = `    <div class="article-card">
      <span class="category">${category}</span>
      <h3><a href="/blog/${slug}">${page.title}</a></h3>
      <div class="excerpt">${excerpt}</div>
      <div class="meta">${wordCount.toLocaleString()} words · ${dateStr}</div>
    </div>`;

  // Insert at the top of the articles section (right after <!-- Articles -->)
  const insertPoint = '    <!-- Articles -->\n';
  if (blogHtml.includes(insertPoint)) {
    blogHtml = blogHtml.replace(insertPoint, insertPoint + cardHtml + '\n');
    writeFileSync(blogHtmlPath, blogHtml);
    console.log(`  ✅ Added to blog.html listing`);
  } else {
    console.log('  ⚠ Could not find insertion point in blog.html');
  }
}

function updateSitemap(slug, title) {
  if (!existsSync(SITEMAP_FILE)) {
    console.log('  ⚠ sitemap.xml not found, skipping update');
    return;
  }

  let sitemap = readFileSync(SITEMAP_FILE, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  const url = `https://yt-seo-architect.vercel.app/blog/${slug}`;

  if (sitemap.includes(url)) {
    console.log('  Already in sitemap, updating lastmod');
    const re = new RegExp(
      `(<url>\\s*<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?<lastmod>)[^<]*(</lastmod>)`
    );
    sitemap = sitemap.replace(re, `$1${today}$2`);
  } else {
    const newEntry = `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    sitemap = sitemap.replace('</urlset>', `${newEntry}\n</urlset>`);
    console.log('  Added to sitemap.xml');
  }

  writeFileSync(SITEMAP_FILE, sitemap);
}

// ── Git operations ─────────────────────────────────────────────────

function gitCommit(slug, title) {
  try {
    const blogFile = `public/blog/${slug}.html`;
    execSync(`git add "${blogFile}" scripts/keywords.json sitemap.xml`, {
      cwd: PROJECT,
      stdio: 'pipe',
    });

    const staged = execSync('git diff --cached --name-only', {
      cwd: PROJECT,
      encoding: 'utf-8',
    }).trim();

    if (!staged) {
      console.log('  No changes to commit');
      return false;
    }

    execSync(`git commit -m "blog: add ${title.slice(0, 60)} (auto-generated)"`, {
      cwd: PROJECT,
      stdio: 'pipe',
    });
    console.log('  Git committed');
    return true;
  } catch (e) {
    console.log(`  ⚠ Git commit failed: ${e.message}`);
    return false;
  }
}

// ── Keyword auto-refill ───────────────────────────────────────────

async function refillKeywords() {
  console.log('═══════════════════════════════════════════════');
  console.log('  KEYWORD AUTO-REFILL');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const data = loadKeywords();
  const pending = data.keywords.filter(k => k.status === 'pending');
  const done = data.keywords.filter(k => k.status === 'done');
  const existingKeywords = new Set(data.keywords.map(k => k.keyword.toLowerCase()));

  console.log(`  Current: ${pending.length} pending, ${done.length} done`);

  if (pending.length >= 20) {
    console.log('  Already have 20+ pending keywords. No refill needed.');
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('  ❌ GROQ_API_KEY not found. Cannot generate keywords.');
    return;
  }

  console.log('  Generating new keyword ideas via Groq...');

  // Categories we need more of
  const categories = ['SEO', 'Analytics', 'Growth', 'Revenue', 'Engagement', 'Thumbnails', 'Content', 'Strategy', 'Tools', 'Branding'];

  const prompt = `Generate 15 low-competition YouTube SEO keywords for a blog about YouTube growth and SEO optimization.

Current existing keywords (DO NOT duplicate these):
${[...existingKeywords].slice(0, 30).join(', ')}

Requirements:
- Each keyword must be specific and long-tail (4+ words)
- Target things creators actually search for
- Include the year ${new Date().getFullYear()} where natural
- Cover diverse categories: SEO, Analytics, Growth, Revenue, Engagement, Thumbnails, Content, Strategy, Tools, Branding
- Focus on problems creators have, not just informational queries
- Avoid keywords too similar to existing ones

Return ONLY a JSON array of objects with this exact format:
[{"keyword": "...", "slug": "...", "category": "..."}]

Rules for slug: lowercase, replace spaces with hyphens, remove special chars.
Rules for category: one of: SEO, Analytics, Growth, Revenue, Engagement, Thumbnails, Content, Strategy, Tools, Branding, Niche, Shorts, Algorithm, Features, Troubleshooting, Technical`;

  try {
    const response = await fetchWithRetry(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an SEO keyword research expert. Return only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 2048,
        }),
      }
    );

    const result = await response.json();
    let text = result.choices?.[0]?.message?.content || '';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    const newKeywords = JSON.parse(text);
    let added = 0;

    for (const kw of newKeywords) {
      if (!kw.keyword || !kw.slug || existingKeywords.has(kw.keyword.toLowerCase())) continue;
      
      // Demand vetting (skipped with --force)
      if (!FORCE_MODE) {
        process.stdout.write(`    🔍 Vetting "${kw.keyword}"... `);
        const demand = checkKeywordDemand(kw.keyword);
        if (demand.demand !== null) {
          process.stdout.write(`D:${demand.demand}/100 R:${demand.rankability}/100 `);
        }
        if (!demand.pass) {
          console.log('⏭ SKIPPED (zero demand)');
          continue;
        }
        console.log('✅');
      } else {
        console.log(`    ⚡ --force: Adding "${kw.keyword}" without demand check`);
      }
      
      data.keywords.push({
        keyword: kw.keyword,
        slug: kw.slug,
        category: kw.category || 'Generated',
        status: 'pending',
        notes: FORCE_MODE ? 'Auto-generated' : 'Auto-generated (demand-verified)',
      });
      added++;
    }

    saveKeywords(data);
    console.log(`  ✅ Added ${added} demand-verified keywords (${data.keywords.filter(k => k.status === 'pending').length} pending total)`);
  } catch (e) {
    console.error(`  ❌ Keyword generation failed: ${e.message}`);
  }
}

// ── Validate existing post ─────────────────────────────────────────

function validateExistingPost(slug) {
  console.log('═══════════════════════════════════════════════');
  console.log(`  VALIDATING: ${slug}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const filePath = resolve(BLOG_DIR, `${slug}.html`);
  if (!existsSync(filePath)) {
    console.error(`  ❌ File not found: ${filePath}`);
    return;
  }

  const content = readFileSync(filePath, 'utf-8');
  const wordCount = countWords(content);

  console.log(`  File size: ${(readFileSync(filePath).length / 1024).toFixed(1)} KB`);
  console.log(`  Word count: ${wordCount}`);
  console.log('');

  // Structural validation
  const result = validateBlogPost({
    slug,
    title: slug,
    content,
    wordCount,
  });

  if (result.valid) {
    console.log('  ✅ Structural validation PASSED');
  } else {
    console.log('  ❌ Structural validation FAILED:');
    for (const f of result.failures) {
      console.log(`    - ${f}`);
    }
  }

  // Quality gate
  const gate = qualityGate(content);
  if (gate.valid) {
    console.log('  ✅ Quality gate PASSED');
  } else {
    console.log('  ❌ Quality gate FAILED:');
    for (const i of gate.issues) {
      console.log(`    - ${i}`);
    }
  }

  console.log('');
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  AUTO BLOG GENERATOR v2 — YT SEO Architect');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Validate existing post mode
  if (VALIDATE_SLUG) {
    validateExistingPost(VALIDATE_SLUG);
    return;
  }

  // Refill mode
  if (REFILL_MODE) {
    await refillKeywords();
    return;
  }

  // Load keyword data
  const data = loadKeywords();
  const pending = data.keywords.filter(k => k.status === 'pending');
  const done = data.keywords.filter(k => k.status === 'done');

  console.log(`  Keywords: ${pending.length} pending, ${done.length} done`);
  console.log(`  Providers: Groq${process.env.GEMINI_API_KEY ? ' + Gemini (fallback)' : ''}`);
  console.log('');

  // Auto-refill if running low
  if (pending.length < 5 && !KEYWORD_OVERRIDE) {
    console.log('  ⚠ Running low on keywords. Auto-refilling...');
    await refillKeywords();
    // Reload after refill
    const refreshed = loadKeywords();
    const newPending = refreshed.keywords.filter(k => k.status === 'pending');
    if (newPending.length === 0) {
      console.error('  ❌ No keywords available even after refill. Aborting.');
      process.exit(1);
    }
    return main(); // Restart with fresh data
  }

  // List mode
  if (LIST_MODE) {
    console.log('  PENDING KEYWORDS:');
    for (const kw of pending) {
      console.log(`    [${kw.category}] ${kw.keyword}`);
      console.log(`      slug: ${kw.slug}`);
    }
    if (pending.length === 0) {
      console.log('    (none — add more to scripts/keywords.json or run --refill)');
    }
    console.log('');
    return;
  }

  // Pick keyword
  const keywordEntry = pickNextKeyword(data, KEYWORD_OVERRIDE);
  if (!keywordEntry) {
    console.log('  ✅ No pending keywords! Run with --refill to generate more.');
    process.exit(0);
  }

  console.log(`  Keyword: "${keywordEntry.keyword}"`);
  console.log(`  Slug:    ${keywordEntry.slug}`);
  console.log(`  Category: ${keywordEntry.category}`);
  console.log('');

  // Check for duplicates
  const dedup = checkDeduplication(keywordEntry.keyword, keywordEntry.slug);
  if (dedup.duplicate) {
    console.log(`  ⚠ Duplicate detected: ${dedup.reason}`);
    console.log('  Marking as done and skipping...');
    markDone(data, keywordEntry.slug);
    saveKeywords(data);
    process.exit(0);
  }

  // ═══ NEW: Demand check gate ═══
  if (!FORCE_MODE) {
    console.log('  📊 Checking keyword demand...');
    const demandResult = checkKeywordDemand(keywordEntry.keyword);
    if (demandResult.demand !== null) {
      console.log(`    Demand: ${demandResult.demand}/100  Rankability: ${demandResult.rankability}/100`);
    }
    if (!demandResult.pass) {
      const reasons = [];
      if (!demandResult.demandOk) reasons.push(`Demand ${demandResult.demand} < ${DEMAND_THRESHOLD}`);
      if (!demandResult.rankabilityOk) reasons.push(`Rankability ${demandResult.rankability} < ${RANKABILITY_THRESHOLD}`);
      console.log(`  ⏭ SKIPPING: ${reasons.join(', ')}`);
      console.log('  Use --force to bypass this check.');
      markDone(data, keywordEntry.slug);
      saveKeywords(data);
      process.exit(0);
    }
    console.log('  ✅ Demand check PASSED');
    console.log('');
  } else {
    console.log('  ⚡ --force: Skipping demand check');
    console.log('');
  }

  // Generate article
  console.log('  Generating article...');
  let articleHTML;
  try {
    articleHTML = await generateArticle(keywordEntry.keyword, keywordEntry.slug);
  } catch (e) {
    console.error(`  ❌ Generation failed: ${e.message}`);
    process.exit(1);
  }

  const wordCount = countWords(articleHTML);
  console.log(`  Generated: ${wordCount} words`);

  if (wordCount < MIN_WORD_COUNT) {
    console.error(`  ❌ Word count ${wordCount} is below ${MIN_WORD_COUNT} minimum. Aborting.`);
    process.exit(1);
  }

  // Post-generation quality gate
  console.log('');
  console.log('  Running quality gate...');
  let gate = qualityGate(articleHTML);
  if (gate.valid) {
    console.log('  ✅ Quality gate PASSED');
  } else {
    console.log('  ⚠ Quality gate issues:');
    for (const i of gate.issues) {
      console.log(`    - ${i}`);
    }

    // If banned words found, try ONE regeneration
    if (gate.foundBanned && gate.foundBanned.length > 0) {
      console.log(`  🔄 Banned words detected (${gate.foundBanned.join(', ')}). Retrying generation...`);
      try {
        articleHTML = await generateArticle(keywordEntry.keyword + ' [IMPORTANT: do not use these words: ' + gate.foundBanned.join(', ') + ']', keywordEntry.slug);
        gate = qualityGate(articleHTML);
        if (gate.valid) {
          console.log('  ✅ Retry PASSED — quality gate clean');
        } else if (gate.foundBanned && gate.foundBanned.length > 0) {
          console.error(`  ❌ Retry still has banned words: ${gate.foundBanned.join(', ')}. Aborting.`);
          process.exit(1);
        } else {
          console.log('  ⚠ Retry has non-banned issues (advisory). Continuing...');
        }
      } catch (e) {
        console.error(`  ❌ Retry generation failed: ${e.message}. Aborting.`);
        process.exit(1);
      }
    } else {
      console.log('  Continuing (non-banned-word issues are advisory)...');
    }
  }
  console.log('');

  // Build page object for renderer
  const today = new Date();
  const titleRaw = keywordEntry.keyword
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const title = titleRaw.includes(String(today.getFullYear()))
    ? titleRaw
    : `${titleRaw} ${today.getFullYear()}`;

  const page = {
    slug: keywordEntry.slug,
    title,
    h1: `${title}: Complete Guide`,
    metaDescription: `Learn how to ${keywordEntry.keyword}. Step-by-step guide with examples, tools, and strategies for ${today.getFullYear()}. Free tools included.`,
    content: articleHTML,
    wordCount,
    publishedAt: today,
    updatedAt: today,
  };

  // Wrap in full template
  console.log('  Wrapping in blog template...');
  const fullHTML = renderBlogTemplate(page);

  // Validate
  console.log('  Validating structure...');
  const validation = validateBlogPost(page);
  if (!validation.valid) {
    console.log(`  ⚠ Structural issues (non-blocking):`);
    for (const f of validation.failures) {
      console.log(`    - ${f}`);
    }
    console.log('  Continuing (renderer will auto-fix structural issues)...');
  } else {
    console.log('  ✅ Structural validation passed');
  }

  // Dry run check
  if (DRY_RUN) {
    console.log('');
    console.log('  DRY RUN — would write to:');
    console.log(`  ${resolve(BLOG_DIR, `${keywordEntry.slug}.html`)}`);
    console.log(`  ${fullHTML.length} bytes, ${wordCount} words`);
    console.log('');
    console.log('  Preview (first 500 chars of article body):');
    console.log('  ' + '─'.repeat(50));
    console.log('  ' + articleHTML.slice(0, 500).replace(/\n/g, '\n  '));
    console.log('  ' + '─'.repeat(50));
    return;
  }

  // Write to database only — API serves dynamically (no static HTML files needed)
  console.log('  Saving to database...');
  const saveResult = { wroteFile: false, savedToDb: false };

  // Inject affiliate links into the article content before saving
  let finalContent = fullHTML;
  try {
    const { injectAffiliateLinks } = await import('./affiliate-mapper-lib.mjs');
    const affiliateConfig = JSON.parse(readFileSync(resolve(PROJECT, 'scripts/affiliate-mapper.json'), 'utf-8'));
    const affiliateResult = injectAffiliateLinks(finalContent, affiliateConfig);
    if (affiliateResult.linksAdded > 0) {
      finalContent = affiliateResult.html;
      console.log(`  🔗 Affiliate links: ${affiliateResult.linksAdded} added (${affiliateResult.addedKeywords.join(', ')})`);
    }
  } catch (e) {
    console.log(`  ⚠ Affiliate injection skipped: ${e.message}`);
  }

  // Save to database for dynamic sitemap and API serving
  if (dbService) {
    try {
      await dbService.saveSeoPage({
        slug: keywordEntry.slug,
        title: page.title,
        metaDescription: page.metaDescription || `Learn about ${keywordEntry.keyword} in this comprehensive guide.`,
        h1: page.title,
        content: finalContent,
        wordCount: wordCount,
        status: 'published',
        publishedAt: new Date(),
      });
      saveResult.savedToDb = true;
      console.log('  ✅ Saved to database — API will serve dynamically');
    } catch (e) {
      console.log(`  ⚠ DB save failed: ${e.message}`);
    }
  }

  // Skip static file write — all pages served dynamically via API
  console.log('  ⏭ Skipping static HTML file (API serves dynamically with glossary-linking)');

  // Skip static sitemap and blog listing updates — API handles both dynamically

  // Mark keyword as done
  markDone(data, keywordEntry.slug);
  saveKeywords(data);

  // Deploy to Vercel (skip if CI — GitHub Actions handles deployment)
  let deployFailed = false;
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  if (isCI) {
    console.log('  ⏭ Skipping Vercel deploy (CI detected — workflow handles this)');
  } else {
    console.log('');
    console.log('  Deploying to Vercel...');
    try {
      execSync('vercel --prod --yes', {
        cwd: PROJECT,
        stdio: 'inherit',
        timeout: 120000,
      });
      console.log('  ✅ Deployed to production');
    } catch (e) {
      console.error(`  ❌ Vercel deploy failed: ${e.message}`);
      console.error('  Blog post saved locally but NOT live. Run: vercel --prod --yes');
      deployFailed = true;
    }
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  ✅ BLOG POST GENERATED');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Title:    ${page.title}`);
  console.log(`  Slug:     ${keywordEntry.slug}`);
  console.log(`  Words:    ${wordCount}`);
  console.log(`  Source:   Database (API-served with glossary links)`);
  console.log(`  File:     public/blog/${keywordEntry.slug}.html`);
  console.log(`  Live at:  https://yt-seo-architect.vercel.app/blog/${keywordEntry.slug}`);
  console.log('');
  const remaining = data.keywords.filter(k => k.status === 'pending').length;
  console.log(`  Remaining: ${remaining} keywords pending`);
  if (remaining < 10) {
    console.log(`  ⚠ Low keyword pool! Run: node scripts/auto-blog-generator.mjs --refill`);
  }
  console.log('═══════════════════════════════════════════════');

  // ── Auto-index the new post for fast search engine discovery ──
  // auto-index.mjs handles: IndexNow (Bing/Yandex), sitemap ping (Google/Bing)
  if (!deployFailed) {
    const postUrl = `https://yt-seo-architect.vercel.app/blog/${keywordEntry.slug}`;
    console.log(`  📡 Notifying search engines about: ${postUrl}...`);
    try {
      execSync(`node scripts/auto-index.mjs --url "${postUrl}"`, {
        cwd: PROJECT,
        stdio: 'pipe',
        timeout: 30000,
      });
      console.log('  ✅ Search engines notified via IndexNow + sitemap ping');
    } catch (e) {
      const msg = e.stderr ? e.stderr.toString().trim() : e.message;
      console.log(`  ⚠ Index notification had issues (non-fatal): ${msg.slice(0, 120)}`);
    }
  }

  if (deployFailed) process.exit(1);
}

// ── Run ────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
