#!/usr/bin/env node
// scripts/index-glossary-fast.mjs
// Submits 200 glossary URLs to Google Indexing API + pings sitemap.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://yt-seo-architect.vercel.app';

function loadGlossaryTerms() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'scripts/glossary-data.json'), 'utf-8'));
  return (raw.terms || []).map(t => t.slug).filter(Boolean);
}

function generateGlossaryUrls(terms) {
  const urls = [];
  for (const slug of terms) {
    urls.push(`${SITE}/glossary/${slug}`);
    urls.push(`${SITE}/glossary/es/${slug}`);
  }
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      urls.push(`${SITE}/glossary/${terms[i]}-vs-${terms[j]}`);
      urls.push(`${SITE}/glossary/es/${terms[i]}-vs-${terms[j]}`);
    }
  }
  urls.push(`${SITE}/glossary/`);
  return [...new Set(urls)];
}

function loadGoogleKey() {
  const path = resolve(ROOT, 'config/google-indexing-key.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
}

async function getGoogleAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const jwt = [
    b64({ alg: 'RS256', typ: 'JWT' }),
    b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/indexing', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }),
  ].join('.');
  const sign = createSign('RSA-SHA256');
  sign.update(jwt);
  const sig = sign.sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}.${sig}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  🔍 GLOSSARY INDEXING');
  console.log('══════════════════════════════════════════\n');

  const terms = loadGlossaryTerms();
  const allUrls = generateGlossaryUrls(terms);
  console.log(`📋 ${terms.length} terms → ${allUrls.length} URLs`);

  // 1. Sitemap ping
  const sitemap = `${SITE}/sitemap.xml`;
  console.log('\n🗺️  Pinging sitemap...');
  try {
    const r = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`);
    console.log(`   Google: ${r.status} ${r.statusText}`);
  } catch (e) { console.log(`   Google: ❌ ${e.message}`); }
  try {
    const r = await fetch(`https://www.bing.com/ping?siteMap=${encodeURIComponent(sitemap)}`);
    console.log(`   Bing:   ${r.status} ${r.statusText}`);
  } catch (e) { console.log(`   Bing:   ❌ ${e.message}`); }

  // 2. Google Indexing API (200 URLs)
  const key = loadGoogleKey();
  if (!key) {
    console.log('\n⚠️  No Google service account key found');
    return;
  }
  console.log('\n🔑 Getting Google access token...');
  const token = await getGoogleAccessToken(key);
  console.log('✅ Authenticated\n');

  // Pick 200 most important glossary URLs
  // Prioritize: EN term pages, then EN comparisons (alphabetically)
  const allComparisons = allUrls.filter(u => u.includes('-vs-') && !u.includes('/es/'));
  const esUrls = allUrls.filter(u => u.includes('/es/'));
  const termPages = allUrls.filter(u => !u.includes('-vs-') && !u.includes('/es/') && u !== `${SITE}/glossary/`);
  const staticPages = allUrls.filter(u => u === `${SITE}/glossary/`);

  const googleBatch = [
    ...staticPages,
    ...termPages,
    ...allComparisons.slice(0, 200 - staticPages.length - termPages.length),
  ];

  console.log(`🔍 Submitting ${googleBatch.length} URLs to Google Indexing API:`);
  console.log(`   ${staticPages.length} static pages`);
  console.log(`   ${termPages.length} EN term pages`);
  console.log(`   ${googleBatch.length - staticPages.length - termPages.length} EN comparisons`);
  console.log('');

  let success = 0, failed = 0;
  for (let i = 0; i < googleBatch.length; i++) {
    try {
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleBatch[i], type: 'URL_UPDATED' }),
      });
      const body = await res.text();
      if (res.ok) { success++; }
      else { failed++; console.log(`   ⚠️  [${i+1}] ${googleBatch[i].split('/glossary/')[1]}: ${res.status} ${body.slice(0,100)}`); }
    } catch (e) { failed++; }

    if ((i + 1) % 20 === 0 || i === googleBatch.length - 1) {
      console.log(`   ${i + 1}/${googleBatch.length} (${success} ok, ${failed} failed)`);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`✅ Google API: ${success} submitted, ${failed} failed`);
  console.log(`📡 ${allUrls.length - 200} remaining URLs → please wait for crawl`);
  console.log('   (sitemap covers all 5,707 URLs for discovery)');
  console.log('══════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
