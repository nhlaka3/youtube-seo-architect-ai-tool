#!/usr/bin/env node
/**
 * DataForSEO 6-Step Research Pipeline — YT SEO Architect Marketing Brain
 *
 * Step 1: Find top competitors (dataforseo_labs/google/competitors_domain)
 * Step 2: Pull ranked keywords per competitor (dataforseo_labs/google/ranked_keywords)
 *         -> the "competitor gap" corpus (6,000+ keywords)
 * Step 3: (separate script) build-keyword-xlsx.py — multi-tab segmented XLSX
 * Step 4: Mine PAA from top search-volume terms (serp/google/organic)
 * Steps 5-6: vault population + beast-plan synthesis happen after data lands
 *
 * Credentials: config/dataforseo.json (gitignored). Login/password = DataForSEO API creds.
 * Usage: node scripts/dataforseo-extract.mjs [--competitors] [--keywords] [--paa] [--limit N]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'marketing/dataforseo');
const CONFIG = JSON.parse(readFileSync(resolve(ROOT, 'config/dataforseo.json'), 'utf-8'));

const API = 'https://api.dataforseo.com/v3';
const AUTH = 'Basic ' + Buffer.from(`${CONFIG.login}:${CONFIG.password}`).toString('base64');
const LOC = CONFIG.location_code || 2840;
const LANG = CONFIG.language_code || 'en';
const TARGET = CONFIG.target_domain;

const args = process.argv.slice(2);
const doCompetitors = args.includes('--competitors');
const doKeywords = args.includes('--keywords');
const doPaa = args.includes('--paa');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;

if (!doCompetitors && !doKeywords && !doPaa) {
  console.log('Usage: node scripts/dataforseo-extract.mjs [--competitors] [--keywords] [--paa] [--limit=N]');
  process.exit(1);
}

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status_code !== 20000) {
    throw new Error(`${path}: ${json.status_message || JSON.stringify(json).slice(0, 200)}`);
  }
  const task = json.tasks?.[0];
  return task?.result?.[0] ?? task ?? {};
}

function save(name, data) {
  mkdirSync(OUT_DIR, { recursive: true });
  const p = resolve(OUT_DIR, name);
  writeFileSync(p, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${name} (${JSON.stringify(data).length} bytes)`);
  return p;
}

const ts = new Date().toISOString().slice(0, 10);

// ── Step 1: competitors ─────────────────────────────────────────
async function findCompetitors() {
  console.log('\n[Step 1] Finding top competitors for', TARGET);
  const r = await call('/dataforseo_labs/google/competitors_domain/live', [{
    target: TARGET, location_code: LOC, language_code: LANG, limit: 10, intersect: true,
  }]);
  const comps = (r.items || []).map(i => ({
    domain: i.domain, rank: i.rank, keywords_count: i.keywords_count,
    estimated_traffic: i.estimated_traffic, common_keywords: i.common_keywords,
  }));
  console.log(`  Found ${comps.length} competitors`);
  for (const c of comps) console.log(`    #${c.rank} ${c.domain} (${c.keywords_count} kw, ~${c.estimated_traffic} traffic)`);
  save(`competitors-${ts}.json`, comps);
  return comps.map(c => c.domain).filter(Boolean);
}

// ── Step 2: ranked keywords per competitor ───────────────────────
async function pullRankedKeywords(domains) {
  console.log(`\n[Step 2] Pulling ranked keywords for ${domains.length} competitors (limit ${LIMIT} each)`);
  const all = {};
  for (const d of domains) {
    try {
      const r = await call('/dataforseo_labs/google/ranked_keywords/live', [{
        target: d, location_code: LOC, language_code: LANG, limit: LIMIT,
        filters: [['keyword_data.keyword_info.search_volume', '>', 0]],
      }]);
      const kws = (r.items || []).map(i => ({
        keyword: i.keyword, position: i.rank_group, volume: i.keyword_data?.keyword_info?.search_volume ?? 0,
        difficulty: i.keyword_data?.keyword_info?.keyword_difficulty ?? 0, cpc: i.keyword_data?.keyword_info?.cpc ?? 0,
        intent: i.keyword_data?.search_intent_info?.main_intent ?? '', competitor: d,
      }));
      all[d] = kws;
      console.log(`  ${d}: ${kws.length} keywords`);
      await new Promise(r => setTimeout(r, 1500)); // polite rate
    } catch (e) {
      console.log(`  ${d}: SKIP — ${e.message.slice(0, 90)}`);
    }
  }
  save(`ranked-keywords-${ts}.json`, all);
  const total = Object.values(all).reduce((s, v) => s + v.length, 0);
  console.log(`  Total: ${total} keyword rows`);
  return all;
}

// ── Step 4: PAA mining ───────────────────────────────────────────
async function minePaa(topTerms) {
  console.log(`\n[Step 4] Mining PAA from top ${topTerms.length} terms`);
  const out = {};
  for (const [i, kw] of topTerms.entries()) {
    try {
      const r = await call('/serp/google/organic/live/advanced', [{
        keyword: kw, location_code: LOC, language_code: LANG, depth: 10,
      }]);
      const paas = (r.items || []).filter(i => i.type === 'people_also_ask')
        .flatMap(i => (i.items || []).map(x => x.title).filter(Boolean));
      const related = (r.items || []).filter(i => i.type === 'related_searches')
        .flatMap(i => (i.items || []).map(x => x.title).filter(Boolean));
      if (paas.length) out[kw] = { paas: [...new Set(paas)], related: [...new Set(related)] };
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${topTerms.length} (${kw})`);
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      console.log(`  ${kw}: ERR ${e.message.slice(0, 70)}`);
    }
  }
  save(`paa-mined-${ts}.json`, out);
  const n = Object.values(out).reduce((s, v) => s + v.paas.length, 0);
  console.log(`  Total PAA questions: ${n}`);
  return out;
}

// ── main ─────────────────────────────────────────────────────────
(async () => {
  if (CONFIG.login.startsWith('YOUR_')) {
    console.error('❌ config/dataforseo.json still has placeholder credentials.');
    console.error('   Add your DataForSEO API login/password first (https://app.dataforseo.com/api-settings).');
    process.exit(1);
  }
  console.log(`DataForSEO pipeline · target=${TARGET} · loc=${LOC} · ${ts}`);
  let comps = [];
  if (doCompetitors || doKeywords) comps = await findCompetitors();
  if (doKeywords) await pullRankedKeywords(comps.length ? comps : CONFIG.competitors);
  if (doPaa) {
    // fall back to a built-in seed list when no ranked keywords yet
    const seeds = ['youtube seo', 'youtube tags', 'youtube description', 'youtube title',
      'youtube keyword research', 'youtube analytics', 'youtube algorithm', 'youtube views',
      'youtube ctr', 'youtube watch time', 'youtube seo tools', 'free youtube seo tool',
      'youtube tag generator', 'youtube title optimizer', 'youtube description writer',
      'youtube glossary', 'youtube terms', 'vidiq alternative', 'tubebuddy alternative',
      'youtube seo for beginners'];
    await minePaa(seeds);
  }
  console.log('\n✅ Extraction complete. Next: node scripts/build-keyword-xlsx.py → vault population.');
})();
