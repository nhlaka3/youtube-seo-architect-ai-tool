#!/usr/bin/env node
/**
 * scripts/auto-discover-niches.mjs
 * AI-powered niche auto-discovery — uses Groq to find + generate new niche guides
 * Appends new niches to niches-data.js automatically
 *
 * Usage:
 *   node scripts/auto-discover-niches.mjs              # Discover + generate 2 new niches
 *   node scripts/auto-discover-niches.mjs --count 5    # Generate up to 5
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const NICHES_FILE = resolve(PROJECT, 'scripts/niches-data.js');

const args = process.argv.slice(2);
const COUNT = parseInt(args.includes('--count') ? args[args.indexOf('--count') + 1] : '2', 10);

// ── Load existing niches ───────────────────────────────────────────

function getExistingNiches() {
  const raw = readFileSync(NICHES_FILE, 'utf-8');
  // Extract all 'id:' values
  const ids = [...raw.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
  const names = [...raw.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
  return { ids, names };
}

function getApiKey() {
  const envPath = resolve(PROJECT, '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GROQ_API_KEY=')) return trimmed.split('=')[1].trim().replace(/["']/g, '');
      if (trimmed.startsWith('GROQ_API_KEY')) {
        const val = trimmed.split(/['"]/)[1];
        if (val) return val;
      }
    }
  }
  return process.env.GROQ_API_KEY || null;
}

async function discoverNiches(count) {
  const existing = getExistingNiches();
  const apiKey = getApiKey();

  if (!apiKey) {
    console.error('❌ GROQ_API_KEY not found. Set it in .env or environment.');
    process.exit(1);
  }

  console.log(`🔍 Existing niches: ${existing.names.join(', ')}`);
  console.log(`🎯 Discovering ${count} new niche(s)...`);
  console.log('');

  const prompt = `You are a YouTube SEO expert. Suggest ${count} new YouTube content niches that are NOT already in this list:
${existing.names.join(', ')}

For each niche, return a JSON object with these exact fields:
{
  "id": "short-kebab-case-id",
  "name": "Niche Name Channels",
  "icon": "emoji",
  "description": "1 sentence describing the niche",
  "metaDesc": "SEO meta description 150-160 chars",
  "h1": "YouTube SEO for Niche Name: The 2026 Guide",
  "intro": "2-3 sentence introduction about why this niche matters on YouTube",
  "tips": [
    {"title": "Tip Title", "content": "2-3 sentence tip with specific, actionable advice"}
  ],
  "stats": {
    "avgCtr": "X-Y%",
    "bestLength": "X-Y min",
    "topKeywords": "keyword type suggestions",
    "avgCpm": "$X.00"
  },
  "related": ["id-of-similar-niche", "id-of-another"]
}

Requirements:
- Each niche must be a REAL YouTube content category that people actually search for
- Tips must be specific and actionable — not generic advice
- Stats must be realistic (gaming CTR 6-9%, finance CPM $10+, etc.)
- Include 6 tips per niche
- The "related" array should reference 2-3 existing niches from this list: ${existing.ids.join(', ')}
- Return ONLY a valid JSON array — no markdown, no explanation`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a YouTube SEO expert. Return ONLY valid JSON — no markdown, no explanation, no code fences.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    let text = result.choices?.[0]?.message?.content || '';
    // Strip markdown code fences
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const newNiches = JSON.parse(text);

    if (!Array.isArray(newNiches)) {
      throw new Error('Response was not an array');
    }

    return newNiches;
  } catch (e) {
    console.error(`❌ Discovery failed: ${e.message}`);
    return [];
  }
}

function appendToFile(niches) {
  let raw = readFileSync(NICHES_FILE, 'utf-8');
  const existingIds = getExistingNiches().ids;
  let added = 0;

  for (const n of niches) {
    if (!n.id || !n.name || !n.tips) {
      console.log(`  ⏭ Skipping invalid entry: ${n.name || 'unnamed'}`);
      continue;
    }
    if (existingIds.includes(n.id)) {
      console.log(`  ⏭ Already exists: ${n.name}`);
      continue;
    }

    // Build the entry string
    const tipsStr = n.tips.map(t =>
      `      { title: '${t.title.replace(/'/g, "\\'")}', content: '${(t.content || '').replace(/'/g, "\\'")}' }`
    ).join(',\n');

    const relatedStr = (n.related || []).map(r => `'${r}'`).join(', ');

    const entry = `\n  {\n    id: '${n.id}', name: '${n.name}', icon: '${n.icon || '📹'}',\n    description: '${(n.description || '').replace(/'/g, "\\'")}',\n    metaDesc: '${(n.metaDesc || '').replace(/'/g, "\\'")}',\n    h1: '${(n.h1 || `YouTube SEO for ${n.name}: The 2026 Guide`).replace(/'/g, "\\'")}',\n    intro: '${(n.intro || '').replace(/'/g, "\\'")}',\n    tips: [\n${tipsStr}\n    ],\n    stats: { avgCtr: '${n.stats?.avgCtr || '5-8%'}', bestLength: '${n.stats?.bestLength || '8-15 min'}', topKeywords: '${(n.stats?.topKeywords || '').replace(/'/g, "\\'")}', avgCpm: '${n.stats?.avgCpm || '$3.00'}' },\n    related: [${relatedStr}],\n  },`;

    // Insert before the closing "];"
    raw = raw.replace(/(\n];\s*$)/, entry + '$1');
    added++;
    console.log(`  ✅ Added: ${n.name} (${n.id})`);
  }

  if (added > 0) {
    writeFileSync(NICHES_FILE, raw);
    console.log(`\n  ✅ ${added} new niche(s) written to niches-data.js`);
    console.log('  Run `node scripts/generate-niches.mjs` to build the HTML pages.');
  } else {
    console.log('\n  ✅ No new niches to add.');
  }

  return added;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  NICHE AUTO-DISCOVERY — AI-powered');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const newNiches = await discoverNiches(COUNT);
  if (newNiches.length === 0) {
    console.log('  No niches discovered. Exiting.');
    return;
  }

  const added = appendToFile(newNiches);

  if (added > 0) {
    // Regenerate HTML pages
    console.log('\n  Regenerating HTML pages...');
    const { execSync } = await import('child_process');
    execSync(`node '${PROJECT}/scripts/generate-niches.mjs'`, { stdio: 'inherit' });

    // Auto-commit if --commit flag
    if (COMMIT) {
      try {
        execSync(
          `git config user.name "YT SEO Bot" && ` +
          `git config user.email "hnhlaka142@gmail.com" && ` +
          `git add scripts/niches-data.js public/niches/ && ` +
          `git diff --cached --quiet || (` +
          `git commit -m "discovery: new niches [skip ci]" && ` +
          `git pull --rebase origin main 2>/dev/null || true && ` +
          `git push origin HEAD:main 2>&1 || true)`,
          { stdio: 'inherit', cwd: PROJECT }
        );
        console.log('\n  ✅ Committed and pushed.');
      } catch (e) {
        console.log(`  ⚠ Commit skipped: ${e.message}`);
      }
    }

    console.log('\n  ✅ All pages regenerated.');
  }
}

await main();