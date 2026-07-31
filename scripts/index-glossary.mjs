#!/usr/bin/env node
/**
 * scripts/index-glossary.mjs
 *
 * Submits glossary comparison URLs to Google Indexing API (200/day quota)
 * and IndexNow (Bing/Yandex — unlimited).
 *
 * Usage:
 *   node scripts/index-glossary.mjs
 *
 * Reads the Google service account key from config/google-indexing-key.json
 * and generates glossary URLs from scripts/glossary-data.json.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://yt-seo-architect.vercel.app';

// ── Load glossary terms ─────────────────────────────────────────

function loadGlossaryTerms() {
  const path = resolve(ROOT, 'scripts/glossary-data.json');
  if (!existsSync(path)) throw new Error('glossary-data.json not found');
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  // Terms are under raw.terms[].slug
  const terms = (raw.terms || []).map(t => t.slug).filter(Boolean);
  if (terms.length === 0) {
    // Fallback: maybe flat array of slugs?
    const slugs = raw.terms ? raw.terms.map(t => t.slug || t) : Object.keys(raw);
    return slugs.filter(Boolean);
  }
  return terms;
}

// ── Generate all glossary URLs ──────────────────────────────────

function generateGlossaryUrls(terms) {
  const urls = [];

  // Core term pages
  for (const slug of terms) {
    urls.push(`${SITE}/glossary/${slug}`);
    urls.push(`${SITE}/glossary/es/${slug}`);
  }

  // Comparison pages (a-vs-b for every unique pair)
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      urls.push(`${SITE}/glossary/${terms[i]}-vs-${terms[j]}`);
      urls.push(`${SITE}/glossary/es/${terms[i]}-vs-${terms[j]}`);
    }
  }

  // Category pages
  urls.push(`${SITE}/glossary/`);
  urls.push(`${SITE}/glossary/category/analytics`);
  urls.push(`${SITE}/glossary/category/algorithm`);
  urls.push(`${SITE}/glossary/category/seo-optimization`);
  urls.push(`${SITE}/glossary/category/monetization`);
  urls.push(`${SITE}/glossary/category/content-strategy`);
  urls.push(`${SITE}/glossary/category/youtube-features`);

  return [...new Set(urls)];
}

// ── Google Indexing API ─────────────────────────────────────────

function loadGoogleKey() {
  const path = resolve(ROOT, 'config/google-indexing-key.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function getGoogleAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(key.private_key, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function submitBatchToGoogle(urls, token) {
  let success = 0, failed = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urls[i], type: 'URL_UPDATED' }),
      });
      if (res.ok) success++;
      else failed++;
    } catch { failed++; }

    if ((i + 1) % 20 === 0 || i === urls.length - 1) {
      console.log(`   Google API: ${i + 1}/${urls.length} (${success} ok, ${failed} failed)`);
    }
  }
  return { success, failed };
}

// ── IndexNow (Bing/Yandex) ──────────────────────────────────────

const INDEXNOW_KEY = '8825c721ac4f49c5b25af78d7418a2b8';

async function submitToIndexNow(url) {
  const endpoints = [
    `https://bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
    `https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
    `https://yandex.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
  ];
  let ok = 0;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { method: 'GET' });
      if (res.ok || res.status === 202) ok++;
    } catch { /* skip */ }
  }
  return ok > 0;
}

async function submitBatchToIndexNow(urls) {
  let success = 0, failed = 0;
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(u => submitToIndexNow(u)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) success++;
      else failed++;
    }
    if ((i + 10) % 100 === 0 || i + 10 >= urls.length) {
      console.log(`   IndexNow: ${Math.min(i + 10, urls.length)}/${urls.length} (${success} ok, ${failed} failed)`);
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return { success, failed };
}

// ── Sitemap ping ────────────────────────────────────────────────

async function pingSitemap() {
  const sitemapUrl = `${SITE}/sitemap.xml`;
  const endpoints = [
    { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
    { name: 'Bing',   url: `https://www.bing.com/ping?siteMap=${encodeURIComponent(sitemapUrl)}` },
  ];
  console.log('\n🗺️  Pinging sitemap...');
  for (const { name, url } of endpoints) {
    try {
      const res = await fetch(url);
      console.log(`   ${name}: ${res.ok ? '✅' : '⚠️'} ${res.status}`);
    } catch (e) {
      console.log(`   ${name}: ❌ ${e.message}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🔍 GLOSSARY INDEXING ENGINE');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load terms
  const terms = loadGlossaryTerms();
  console.log(`📋 ${terms.length} glossary terms loaded`);

  // 2. Generate URLs
  const allUrls = generateGlossaryUrls(terms);
  console.log(`🌐 ${allUrls.length} total glossary URLs generated`);

  // Break down
  const termPages = allUrls.filter(u => u.match(/\/glossary\/(?!es\/)([^/]+)$/) && !u.includes('-vs-') && u !== `${SITE}/glossary/`);
  const esTermPages = allUrls.filter(u => u.includes('/glossary/es/') && !u.includes('-vs-'));
  const comparisons = allUrls.filter(u => u.includes('-vs-'));
  const esComparisons = allUrls.filter(u => u.includes('/glossary/es/') && u.includes('-vs-'));
  console.log(`   ${termPages.length} EN term pages`);
  console.log(`   ${esTermPages.length} ES term pages`);
  console.log(`   ${comparisons.length} EN comparisons`);
  console.log(`   ${esComparisons.length} ES comparisons`);

  // 3. Sitemap ping (fastest path — notifies all search engines)
  await pingSitemap();

  // 4. IndexNow (Bing/Yandex — no quota limit, submit all)
  console.log(`\n📡 Submitting all ${allUrls.length} URLs via IndexNow...`);
  const indexNowResult = await submitBatchToIndexNow(allUrls);
  console.log(`   ✅ IndexNow: ${indexNowResult.success} ok, ${indexNowResult.failed} failed`);

  // 5. Google Indexing API (200/day quota — submit first 200 glossary URLs)
  const key = loadGoogleKey();
  if (!key) {
    console.log('\n⚠️  Google service account key not found at config/google-indexing-key.json');
    console.log('   Skipping Google Indexing API.');
  } else {
    console.log('\n🔑 Google service account key loaded');
    try {
      const token = await getGoogleAccessToken(key);
      console.log('✅ Authenticated with Google');

      // Pick first 200 URLs — prioritize comparison pages and term pages
      const googleBatch = allUrls
        .filter(u => !u.endsWith('/glossary/') && !u.includes('/category/'))
        .slice(0, 200);

      console.log(`\n🔍 Submitting ${googleBatch.length} glossary URLs to Google Indexing API (200/day quota)...\n`);
      const googleResult = await submitBatchToGoogle(googleBatch, token);
      console.log(`\n✅ Google API: ${googleResult.success} ok, ${googleResult.failed} failed`);
    } catch (e) {
      console.log(`\n❌ Google indexing failed: ${e.message}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log(`   Sitemap: pinged Google + Bing`);
  console.log(`   IndexNow: ${indexNowResult.success}/${allUrls.length} URLs`);
  console.log('   Google API: 200 URLs (daily quota)');
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
