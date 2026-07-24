#!/usr/bin/env node
/**
 * scripts/auto-glossary-terms.mjs
 *
 * Auto-discovers new YouTube SEO glossary terms using AI.
 * Reads existing glossary-data.json, asks Groq/Gemini for 3-5 new
 * terms not already in the dataset, validates uniqueness, and appends them.
 *
 * Usage:
 *   node scripts/auto-glossary-terms.mjs              # Generate 3-5 new terms
 *   node scripts/auto-glossary-terms.mjs --count 8    # Override max terms
 *   node scripts/auto-glossary-terms.mjs --dry-run    # Preview without saving
 *
 * Env: GROQ_API_KEY (primary), GEMINI_API_KEY (fallback)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');

const MAX_RETRIES = 3;
const RETRY_DELAY = 4000;
const DRY_RUN = process.argv.includes('--dry-run');
const COUNT_FLAG = process.argv.indexOf('--count');
const MAX_TERMS = COUNT_FLAG > -1 ? parseInt(process.argv[COUNT_FLAG + 1]) || 5 : 5;

const CATEGORIES = ['analytics', 'algorithm', 'seo-optimization', 'monetization', 'content-strategy', 'youtube-features'];

// ── API helpers (same pattern as auto-blog-generator) ──────────────

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      const body = await res.text();
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after')) || 10;
        console.log(`    ⏳ Rate limited. Waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
    } catch (e) {
      if (attempt === retries) throw e;
      lastError = e;
      console.log(`    ⚠ Retry ${attempt}/${retries}: ${e.message}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
    }
  }
  throw lastError || new Error('All retries exhausted');
}

async function callGroq(apiKey, systemPrompt, prompt) {
  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: systemPrompt
          ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
          : [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 3000,
      })
    }
  );
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty Groq response');
  return content;
}

async function callGemini(apiKey, systemPrompt, prompt) {
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8000 }
      })
    }
  );
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

async function callAI(systemPrompt, prompt) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Try Gemini first (higher token limits, no 6000 TPM restriction)
  if (geminiKey) {
    try { return await callGemini(geminiKey, systemPrompt, prompt); }
    catch (e) {
      console.log(`    ⚠ Gemini failed: ${e.message}`);
      if (!groqKey) throw e;
      console.log('    → Falling back to Groq...');
    }
  }
  if (groqKey) return await callGroq(groqKey, systemPrompt, prompt);
  throw new Error('No API keys available (GROQ_API_KEY and/or GEMINI_API_KEY)');
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Auto-Discovering New Glossary Terms...\n`);

  if (!existsSync(DATA_FILE)) {
    console.error('❌ glossary-data.json not found');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const existingSlugsArray = data.terms.map(t => t.slug);
  const existingSlugs = new Set(existingSlugsArray);
  const existingTerms = new Set(data.terms.map(t => t.term.toLowerCase().replace(/\(.*?\)/g, '').trim()));
  // Send a minimal sample to fit API limits
  const existingList = existingSlugsArray.slice(-5).join(',');

  console.log(`  Existing terms: ${data.terms.length} (showing 10 to AI)`);
  console.log(`  Requesting ${MAX_TERMS} new terms...\n`);

  const systemPrompt = ``;

  const prompt = `Suggest ${MAX_TERMS} new YouTube SEO terms not in: ${existingList}. Categories: ${CATEGORIES.join(', ')}. Return JSON: [{"term":"","slug":"","shortDefinition":"","expandedDefinition":"","category":"","relatedTerms":[],"relatedBlogs":[]}]`;

  const result = await callAI(systemPrompt, prompt);
  let newTerms;

  try {
    // Strip any markdown fences and find first [ or {
    let clean = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const firstBracket = clean.indexOf('[');
    if (firstBracket > 0) clean = clean.substring(firstBracket);
    const lastBracket = clean.lastIndexOf(']');
    if (lastBracket > 0) clean = clean.substring(0, lastBracket + 1);
    newTerms = JSON.parse(clean);
    if (!Array.isArray(newTerms)) throw new Error('Response is not an array');
  } catch (e) {
    console.error('❌ Failed to parse AI response as JSON:', e.message);
    console.error('Raw response:', result.substring(0, 500));
    process.exit(1);
  }

  // Validate and filter
  const added = [];
  for (const term of newTerms) {
    // Skip if slug already exists
    if (existingSlugs.has(term.slug)) {
      console.log(`  ⏭ Skipped "${term.term}" — slug "${term.slug}" already exists`);
      continue;
    }
    // Skip if term name too similar to existing
    const normalized = term.term.toLowerCase().replace(/\(.*?\)/g, '').trim();
    if (existingTerms.has(normalized)) {
      console.log(`  ⏭ Skipped "${term.term}" — too similar to existing term`);
      continue;
    }
    // Validate and normalize category (case-insensitive)
    const normalizedCategory = CATEGORIES.find(c => c.toLowerCase() === (term.category || '').toLowerCase());
    if (!normalizedCategory) {
      console.log(`  ⏭ Skipped "${term.term}" — invalid category "${term.category}"`);
      continue;
    }
    term.category = normalizedCategory;
    // Generate ID from slug
    term.id = term.slug;
    // Validate relatedTerms
    if (!Array.isArray(term.relatedTerms)) term.relatedTerms = [];
    term.relatedTerms = term.relatedTerms.filter(s => !existingSlugs.has(s) ? false : true);
    if (!Array.isArray(term.relatedBlogs)) term.relatedBlogs = [];

    added.push(term);
  }

  if (added.length === 0) {
    console.log('\n⚠ No new valid terms found. All suggestions already exist or were invalid.');
    console.log('   The glossary is either comprehensive or the AI is generating duplicates.\n');
    return;
  }

  // Append to data
  data.terms.push(...added);
  data.meta.totalTerms = data.terms.length;
  data.meta.generatedAt = new Date().toISOString().split('T')[0];

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN — would add ${added.length} new terms:\n`);
    for (const t of added) {
      console.log(`  ✅ ${t.term} (${t.category}) — ${t.shortDefinition.substring(0, 100)}...`);
    }
    console.log(`\n  Total would become: ${data.terms.length} terms\n`);
  } else {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\n✅ Added ${added.length} new glossary terms:\n`);
    for (const t of added) {
      console.log(`  ✅ ${t.term} → /glossary/${t.slug}  [${t.category}]`);
    }
    console.log(`\n  Total terms: ${data.terms.length}`);
    console.log(`  Saved to: scripts/glossary-data.json\n`);
  }
}

main();
