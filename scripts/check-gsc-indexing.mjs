#!/usr/bin/env node
// scripts/check-gsc-indexing.mjs — authoritative Google index status per URL.
//
// Uses the Google Search Console URL Inspection API
// (urlInspection.index:inspect) to report each URL's true index coverage:
//   coverageState: IN_STOCK / InStock = indexed ·
//                    NOT_IN_STOCK / OutOfStock = not indexed
//                    (plus DUPLICATE, COVERAGE_GAP, etc.)
//
// The service account must be an OWNER in Search Console for this site.
//
// Credentials: reads GOOGLE_INDEXING_KEY (raw JSON) OR config/google-indexing-key.json
// Auth scope required: https://www.googleapis.com/auth/webmasters.readonly
//
// Usage:
//   GOOGLE_INDEXING_KEY="$(cat key.json)" node scripts/check-gsc-indexing.mjs
//   node scripts/check-gsc-indexing.mjs --url https://site.com/glossary/x
//   node scripts/check-gsc-indexing.mjs --sample 12        # random sample across types
//   node scripts/check-gsc-indexing.mjs --all-types       # fixed sample covering each type

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SITE = 'https://yt-seo-architect.vercel.app';
const GSC_SITE = SITE + (SITE.endsWith('/') ? '' : '/');

function resolveKey(input) {
  if (!input) {
    const p = resolve(ROOT, 'config/google-indexing-key.json');
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
  }
  if (input.startsWith('{')) return JSON.parse(input);
  if (existsSync(input)) return JSON.parse(readFileSync(input, 'utf-8'));
  return null;
}

async function getToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const scope = 'https://www.googleapis.com/auth/webmasters.readonly ' +
                'https://www.googleapis.com/auth/indexing';
  const jwt = [b64({ alg: 'RS256', typ: 'JWT' }), b64({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })].join('.');
  const sign = createSign('RSA-SHA256');
  sign.update(jwt);
  const sig = sign.sign(key.private_key, 'base64url');
  // Retry: cold-start / transient network blips ETIMEDOUT the first attempt
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}.${sig}`,
      });
      const d = await res.json();
      if (!d.access_token) throw new Error(`Auth failed: ${JSON.stringify(d).slice(0, 300)}`);
      return d.access_token;
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise(res => setTimeout(res, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function inspectUrl(token, url, siteUrl) {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl }),
  });
  const d = await res.json();
  if (!res.ok) return { url, status: `API HTTP ${res.status}`, error: JSON.stringify(d).slice(0, 160) };
  const insp = d.inspectionResult || {};
  const idx = insp.indexStatusResult || {};
  const exp = insp.urlInspectionResult || {};
  // Google returns localized/human-readable coverageState strings from this
  // endpoint (e.g. "Submitted and indexed", "URL is unknown to Google",
  // "Excluded by page removal tool" ...) OR the enum form. Normalize:
  const raw = idx.coverageState || '';
  const str = String(raw);
  const isIndexed = /indexed|index?/i.test(str) && !/unknown|not indexed|excluded|not found|noindex|soft 404/i.test(str);
  return {
    url,
    status: res.status,
    coverageState: str || 'UNKNOWN',
    // 'indexed' = true ONLY when Google confirms the URL is in its index
    // 'unknown' = Google has never catalogued/discovered the URL
    rawCoverage: str,
    isIndexed,
    isUnknown: /unknown to google|unknown/i.test(str) || str === 'URL is unknown to Google',
    indexingState: idx.indexingState || 'N/A',
    lastCrawl: idx.lastCrawlTime || null,
    pageFetchState: idx.pageFetchState || 'N/A',
    richResult: exp.richResultInspectionResult?.richResultType || null,
  };
}

function typeOf(url) {
  if (url === SITE + '/' || url === SITE) return 'core';
  if (url.includes('/blog/es/')) return 'blog-es';
  if (url.includes('/blog/')) return 'blog';
  if (url.includes('/glossary/es/')) return 'glossary-es';
  if (url.includes('/glossary/pt/')) return 'glossary-pt';
  if (url.includes('/glossary/category/')) return 'glossary-category';
  if (url.includes('-vs-')) return 'glossary-comparison';
  if (url.includes('/glossary/')) return 'glossary';
  if (url.includes('/tools/')) return 'tools';
  return 'other';
}

function pickUrls(locs, opts) {
  const byTypeMap = {};
  for (const u of locs) { const t = typeOf(u); (byTypeMap[t] ||= []).push(u); }

  if (opts.byType) {
    // Spread picks evenly across types: at least one per type, up to n total
    const types = Object.keys(byTypeMap).filter(t => byTypeMap[t].length);
    const out = [];
    let i = 0;
    while (out.length < opts.n && i < 200) {
      const t = types[i % types.length];
      if (byTypeMap[t].length) out.push(byTypeMap[t].shift());
      i++;
    }
    return out;
  }
  const urls = [...locs].sort(() => Math.random() - 0.5);
  return urls.slice(0, opts.n);
}

async function main() {
  const args = process.argv.slice(2);
  const key = resolveKey(process.env.GOOGLE_INDEXING_KEY);
  if (!key) { console.error('❌ No Google service account key. Set GOOGLE_INDEXING_KEY or add config/google-indexing-key.json'); process.exit(1); }

  const token = await getToken(key);
  console.log('✅ Authenticated to Google Search Console\n');

  // Load sitemap for URL discovery — recurse through sitemap indexes
  // (sitemap.xml is an index pointing at sitemap-core.xml etc.)
  async function loadSitemapLocs(url) {
    const res = await fetch(url);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const out = [];
    for (const loc of locs) {
      if (loc.includes('sitemap-') && loc.endsWith('.xml')) out.push(...await loadSitemapLocs(loc));
      else if (loc.startsWith(SITE)) out.push(loc);
    }
    return out;
  }
  const locs = await loadSitemapLocs(`${SITE}/sitemap.xml`);
  console.log(`📋 Sitemap: ${locs.length} URLs`);

  // Choose URLs
  let targets;
  const urlIdx = args.indexOf('--url');
  if (urlIdx !== -1) { targets = [args[urlIdx + 1]]; }
  else {
    const sampleIdx = args.indexOf('--sample');
    const n = sampleIdx !== -1 ? parseInt(args[sampleIdx + 1], 10) : 10;
    const byType = args.includes('--by-type') || args.includes('--all-types');
    targets = pickUrls(locs, { n, byType });
  }

  console.log(`\n🔎 Inspecting ${targets.length} URLs against Search Console...\n`);
  const results = [];
  for (const url of targets) {
    const r = await inspectUrl(token, url, GSC_SITE);
    results.push(r);
    const dot = r.isIndexed ? '✅' : (r.isUnknown ? '❓' : '❌');
    console.log(`  ${dot} [${r.coverageState}] ${typeOf(url).padEnd(18)} ${url}`);
    await new Promise(res => setTimeout(res, 200)); // pace — URL inspection is also quota'd
  }

  // Summary
  const inStock = results.filter(r => r.isIndexed).length;
  const unknown = results.filter(r => r.isUnknown).length;
  const notIn = results.length - inStock - unknown;
  console.log('\n═'.repeat(60));
  console.log('📊 GOOGLE INDEX SUMMARY');
  console.log('─'.repeat(60));
  console.log(`   Checked:   ${results.length}`);
  console.log(`   Indexed:   ${inStock}   (Google confirms URL is in the index)`);
  console.log(`   Unknown:   ${unknown}   (Google has never discovered the URL — sitemap/discovery issue)`);
  console.log(`   Other:     ${notIn}   (discovered but not indexed)`);
  console.log('═'.repeat(60));

  process.exit(unknown > results.length / 2 ? 1 : 0); // fail if majority never discovered
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });