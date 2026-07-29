#!/usr/bin/env node
/**
 * scripts/auto-discover-tools.mjs
 * AI-powered tool discovery — uses Groq to find new YouTube tool competitors
 * Appends new tools to vs-data.js automatically
 *
 * Usage:
 *   node scripts/auto-discover-tools.mjs              # Discover 2 new tools
 *   node scripts/auto-discover-tools.mjs --count 5    # Up to 5
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const VS_FILE = resolve(PROJECT, 'scripts/vs-data.js');

const args = process.argv.slice(2);
const COUNT = parseInt(args.includes('--count') ? args[args.indexOf('--count') + 1] : '2', 10);

function getExistingTools() {
  const raw = readFileSync(VS_FILE, 'utf-8');
  const names = [...raw.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
  const ids = [...raw.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
  return { names, ids };
}

function getApiKey() {
  const envPath = resolve(PROJECT, '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GROQ_API_KEY=')) return trimmed.split('=')[1].trim().replace(/["']/g, '');
    }
  }
  return process.env.GROQ_API_KEY || null;
}

async function discoverTools(count) {
  const existing = getExistingTools();
  const apiKey = getApiKey();
  if (!apiKey) { console.error('❌ GROQ_API_KEY not found.'); process.exit(1); }

  console.log(`🔍 Existing tools: ${existing.names.join(', ')}`);
  console.log(`🎯 Discovering ${count} new tool(s)...`);

  const prompt = `You are a YouTube tool expert. Suggest ${count} YouTube creator tools that are NOT already in this comparison list:
${existing.names.join(', ')}

For each tool, return a JSON object:
{
  "id": "kebab-case-id",
  "name": "Tool Name",
  "url": "https://example.com",
  "pricing": "Free / $XX/mo Pro",
  "category": "Category",
  "tagline": "Short description",
  "features": [
    {"name": "Feature Name", "us": true/false, "them": true/false},
    {"name": "Another Feature", "us": true/false, "them": true/false, "note": "optional note"}
  ],
  "verdict": "2-3 sentence comparison verdict",
  "bestFor": "Who this is best for",
  "score": {"us": 0-10, "them": 0-10},
  "related": ["existing-tool-id", "another-id"]
}

Requirements:
- Include 8-10 features per tool. "us" means YT SEO Architect has it, "them" means the competitor has it
- YT SEO Architect should win on 5-7 features (it's a free tool), competitor wins on 2-3
- Scores: us should be 7.5-9, them should be 5.5-8.5
- Related must reference existing tool IDs from: ${existing.ids.join(', ')}
- REAL tools that YouTube creators actually use
- Return ONLY valid JSON array — no markdown`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON array.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7, max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  const result = await response.json();
  let text = result.choices?.[0]?.message?.content || '';
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return JSON.parse(text);
}

function appendToFile(tools) {
  let raw = readFileSync(VS_FILE, 'utf-8');
  const existingIds = getExistingTools().ids;
  let added = 0;

  for (const t of tools) {
    if (!t.id || !t.name) continue;
    if (existingIds.includes(t.id)) { console.log(`  ⏭ Already exists: ${t.name}`); continue; }

    const featuresStr = t.features.map(f =>
      `      { name: '${f.name.replace(/'/g, "\\'")}', us: ${f.us}, them: ${f.them}${f.note ? `, note: '${f.note.replace(/'/g, "\\'")}'` : ''} }`
    ).join(',\n');

    const relatedStr = (t.related || []).map(r => `'${r}'`).join(', ');

    const entry = `\n  {\n    id: '${t.id}',\n    name: '${t.name.replace(/'/g, "\\'")}',\n    url: '${t.url || ''}',\n    pricing: '${(t.pricing || '').replace(/'/g, "\\'")}',\n    category: '${(t.category || '').replace(/'/g, "\\'")}',\n    tagline: '${(t.tagline || '').replace(/'/g, "\\'")}',\n    features: [\n${featuresStr}\n    ],\n    verdict: '${(t.verdict || '').replace(/'/g, "\\'")}',\n    bestFor: '${(t.bestFor || '').replace(/'/g, "\\'")}',\n    score: { us: ${t.score?.us || 8}, them: ${t.score?.them || 7} },\n    related: [${relatedStr}],\n  },`;

    raw = raw.replace(/(\n];\s*$)/, entry + '$1');
    added++;
    console.log(`  ✅ Added: ${t.name}`);
  }

  if (added > 0) {
    writeFileSync(VS_FILE, raw);
    console.log(`\n  ✅ ${added} new tool(s) written to vs-data.js`);
  }
  return added;
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TOOL AUTO-DISCOVERY — AI-powered');
  console.log('═══════════════════════════════════════════════');
  const newTools = await discoverTools(COUNT);
  if (newTools.length === 0) { console.log('  No tools discovered.'); return; }
  const added = appendToFile(newTools);
  if (added > 0) {
    const { execSync } = await import('child_process');
    execSync(`node '${PROJECT}/scripts/generate-vs-pages.mjs'`, { stdio: 'inherit' });
    console.log('\n  ✅ All vs/ pages regenerated.');
  }
}
await main();