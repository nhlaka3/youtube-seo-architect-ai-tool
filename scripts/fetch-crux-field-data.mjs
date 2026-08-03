#!/usr/bin/env node
/**
 * scripts/fetch-crux-field-data.mjs
 *
 * Pulls real-world CrUX field data (LCP, INP, CLS, TTFB — 28-day origin + URL
 * data) for the site's key pages using the Google Chrome UX Report API.
 *
 * Why: the previous audit scored Performance (CWV) purely from lab signals
 * because no field data was available. With GOOGLE_API_KEY set, this script
 * fetches REAL user-experience metrics, and the next audit can score against
 * field LCP/INP/CLS.
 *
 * Setup:
 *   1. Google Cloud Console → enable "Chrome UX Report API"
 *   2. Create an API key (APIs & Services → Credentials → Create API Key)
 *   3. Add to .env:  GOOGLE_API_KEY=your_key_here
 *   4. Add the same key as a Vercel env var: vercel env add GOOGLE_API_KEY
 *
 * Usage:
 *   node scripts/fetch-crux-field-data.mjs            # origin-level + key URLs
 *   node scripts/fetch-crux-field-data.mjs --json     # machine-readable
 *
 * Output: public/crux-field-data.json (default) — consumed by the audit.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT = resolve(__dirname, '..');

const API_KEY = process.env.GOOGLE_API_KEY;
const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const SITE = 'https://yt-seo-architect.vercel.app';

// Pages that matter most for CWV scoring
const KEY_PAGES = ['/', '/tools', '/blog', '/dashboard'];

function loadEnv() {
  const envPath = resolve(PROJECT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

async function queryCrUX(formFactor, { url } = {}) {
  const body = url ? { url, formFactor } : { origin: SITE, formFactor };
  const res = await fetch(`${CRUX_ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return null; // no data for this URL/form factor yet
  if (res.status === 403) {
    throw new Error('CrUX API key rejected (403). Check GOOGLE_API_KEY + that "Chrome UX Report API" is enabled.');
  }
  if (!res.ok) {
    throw new Error(`CrUX API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function extractMetric(record, name) {
  try {
    const m = record.metrics[name];
    if (!m) return null;
    const p75 = m.percentiles?.p75;
    return p75 ? { p75, unit: m.percentiles?.unit ?? '' } : null;
  } catch {
    return null;
  }
}

async function main() {
  loadEnv();
  const asJson = process.argv.includes('--json');

  if (!API_KEY) {
    console.log('❌ GOOGLE_API_KEY not set.');
    console.log('  1. Enable "Chrome UX Report API" in Google Cloud Console');
    console.log('  2. Create an API key and add to .env: GOOGLE_API_KEY=your_key');
    console.log('  3. Re-run: node scripts/fetch-crux-field-data.mjs');
    process.exit(1);
  }

  console.log('Fetching CrUX field data (28-day)…');
  const out = { fetchedAt: new Date().toISOString(), site: SITE, pages: {} };

  for (const path of KEY_PAGES) {
    for (const formFactor of ['PHONE', 'DESKTOP']) {
      const label = path === '/' ? 'homepage' : path.slice(1).replaceAll('/', '-');
      try {
        const url = path === '/' ? SITE : `${SITE}${path}`;
        const rec = await queryCrUX(formFactor, { url });
        if (!rec) continue;
        const lcp = extractMetric(rec.record, 'largest_contentful_paint');
        const inp = extractMetric(rec.record, 'interaction_to_next_paint');
        const cls = extractMetric(rec.record, 'cumulative_layout_shift');
        const ttfB = extractMetric(rec.record, 'experimental_time_to_first_byte');
        out.pages[`${label}@${formFactor.toLowerCase()}`] = { lcp, inp, cls, ttfb: ttfB };
        console.log(`  ✓ ${label} ${formFactor}: LCP ${lcp?.p75 ?? '—'} · INP ${inp?.p75 ?? '—'} · CLS ${cls?.p75 ?? '—'} · TTFB ${ttfB?.p75 ?? '—'}`);
      } catch (e) {
        console.log(`  ✗ ${label} ${formFactor}: ${e.message}`);
      }
    }
  }

  // Origin-level (all users) — most stable signal
  try {
    const rec = await queryCrUX('PHONE');
    if (rec) {
      out.originPhone = {
        lcp: extractMetric(rec.record, 'largest_contentful_paint'),
        inp: extractMetric(rec.record, 'interaction_to_next_paint'),
        cls: extractMetric(rec.record, 'cumulative_layout_shift'),
        ttfb: extractMetric(rec.record, 'experimental_time_to_first_byte'),
      };
      console.log('  ✓ origin@phone: origin-level aggregate captured');
    }
  } catch (e) {
    console.log(`  ✗ origin@phone: ${e.message}`);
  }

  const outPath = resolve(PROJECT, 'public/crux-field-data.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ Written ${outPath}`);

  if (asJson) console.log(JSON.stringify(out, null, 2));
  else console.log('\nNext audit will score Performance against this field data.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
