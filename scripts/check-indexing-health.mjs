#!/usr/bin/env node
// scripts/check-indexing-health.mjs — daily Bing/Yandex/IndexNow health check.
//
// Objective: verify the IndexNow key file is deployable AND Bing/Yandex accept
// submissions. Tracks persistent 429 rate-limiting across runs in a committed
// state file (public/indexing-health-state.json). Fails the run (exit 1) when
// the 429 persists 48h+ so GitHub Actions surfaces a red alert.
//
// Usage:
//   node scripts/check-indexing-health.mjs            # run health check
//   node scripts/check-indexing-health.mjs --report   # read last report only

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SITE = 'https://yt-seo-architect.vercel.app';
const INDEXNOW_KEY = '8825c721ac4f49c5b25af78d7418a2b8';
const KEY_URL = `${SITE}/${INDEXNOW_KEY}.txt`;
const STATE_PATH = resolve(ROOT, 'public/indexing-health-state.json');
const REPORT_PATH = resolve(ROOT, 'public/indexing-health.json');
// Once 429 has persisted this many consecutive daily runs (~24h each), fail. 
// 2 runs = ~48h window.
const MAX_CONSECUTIVE_429 = 2;

function loadState() {
  if (!existsSync(STATE_PATH)) return { consecutive429: 0, lastOk: null, last429: null, lastRun: null };
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf-8')); }
  catch { return { consecutive429: 0, lastOk: null, last429: null, lastRun: null }; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--report')) {
    if (!existsSync(STATE_PATH)) { console.log('No health report yet.'); return; }
    console.log(readFileSync(STATE_PATH, 'utf-8'));
    return;
  }

  console.log('═'.repeat(56));
  console.log('  🔍 INDEXING HEALTH CHECK — Bing · Yandex · IndexNow');
  console.log('═'.repeat(56));

  // 1. Key file must be publicly reachable (else ALL submissions silently dropped)
  let keyOk = false;
  try {
    const k = await fetch(KEY_URL, { method: 'GET' });
    if (k.status === 200) { keyOk = true; console.log(`  ✅ IndexNow key file: HTTP 200 (${KEY_URL})`); }
    else { console.log(`  ❌ IndexNow key file: HTTP ${k.status} (${KEY_URL})`); }
  } catch (e) { console.log(`  ❌ IndexNow key file unreachable: ${e.message}`); }

  // 2. Live bulk submission test (1 URL, official endpoint)
  let bulkStatus = null;
  let bulkOk = false;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'yt-seo-architect.vercel.app',
        key: INDEXNOW_KEY,
        keyLocation: KEY_URL,
        urlList: [`${SITE}/`],
      }),
    });
    bulkStatus = res.status;
    bulkOk = res.ok || res.status === 202;
    if (res.status === 429) console.log('  ⏳ Bulk IndexNow: HTTP 429 (rate limited)');
    else if (bulkOk) console.log(`  ✅ Bulk IndexNow: HTTP ${res.status} accepted`);
    else console.log(`  ❌ Bulk IndexNow: HTTP ${res.status}`);
  } catch (e) { console.log(`  ❌ Bulk IndexNow request failed: ${e.message}`); }

  // 3. Track persistent 429
  const now = new Date().toISOString();
  const state = loadState();
  const isRateLimited = !keyOk || bulkStatus === 429;

  if (isRateLimited) {
    state.consecutive429 = (state.consecutive429 || 0) + (bulkStatus === 429 ? 1 : 0);
    state.last429 = now;
    state.lastOk = null;
  } else {
    state.consecutive429 = 0;
    state.lastOk = now;
    state.last429 = null;
  }
  state.lastRun = now;
  state.keyFileOk = keyOk;
  state.lastBulkStatus = bulkStatus;
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  console.log('─'.repeat(56));
  console.log(`  Consecutive 429 runs: ${state.consecutive429}  (threshold ${MAX_CONSECUTIVE_429} = ~48h)`);
  console.log(`  Key file ok: ${keyOk} | Last bulk status: ${bulkStatus || 'n/a'}`);
  console.log(`  State saved: ${STATE_PATH}`);
  console.log('═'.repeat(56));

  // Fail the run if the key is broken (immediate) or 429 persisted 48h+ (alert)
  if (!keyOk) {
    console.log('\n  ⛔ FAIL: IndexNow key file is down — Bing/Yandex submissions are being dropped.');
    process.exit(1);
  }
  if (state.consecutive429 >= MAX_CONSECUTIVE_429) {
    console.log(`\n  ⛔ FAIL: Bing/IndexNow rate limit persisted ${state.consecutive429} consecutive runs (~48h). Action needed.`);
    process.exit(1);
  }
  if (bulkOk) console.log('\n  ✅ Healthy.');
  else console.log('\n  ⚠️  Degraded but not failing (rate limit cooling down, auto-heals).');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });