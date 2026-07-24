#!/usr/bin/env node
/**
 * scripts/auto-index.mjs
 *
 * Auto-submits all site pages to search engines for faster indexing.
 * Supports:
 *   - IndexNow (Bing, Yandex, Seznam) — works immediately, no API key needed
 *   - Google Indexing API — requires service account key (GOOGLE_INDEXING_KEY env var)
 *
 * Usage:
 *   node scripts/auto-index.mjs                         # Submit all known pages via IndexNow
 *   node scripts/auto-index.mjs --url https://...       # Submit a specific URL
 *   node scripts/auto-index.mjs --google                # Submit all pages via Google Indexing API
 *   node scripts/auto-index.mjs --url https://... --google  # Submit specific URL to Google
 *   node scripts/auto-index.mjs --check                 # Check IndexNow key is valid
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = 'https://yt-seo-architect.vercel.app';

// IndexNow API key — must match public/{key}.txt verification file
const INDEXNOW_KEY = '8825c721ac4f49c5b25af78d7418a2b8';
const INDEXNOW_ENDPOINTS = [
  `https://bing.com/indexnow?url={URL}&key=${INDEXNOW_KEY}`,
  `https://yandex.com/indexnow?url={URL}&key=${INDEXNOW_KEY}`,
  `https://www.bing.com/indexnow?url={URL}&key=${INDEXNOW_KEY}`,
];

// ── Page discovery ──────────────────────────────────────────────

function discoverAllUrls() {
  const urls = [];
  const today = new Date().toISOString().split('T')[0];

  // Core pages
  const corePages = [
    { path: '', priority: '1.0' },
    { path: 'about', priority: '0.7' },
    { path: 'changelog', priority: '0.4' },
    { path: 'contact', priority: '0.8' },
  ];
  for (const page of corePages) {
    urls.push(`${SITE_URL}/${page.path}`);
  }

  // Tools pages
  const toolsDir = resolve(ROOT, 'public/tools');
  if (existsSync(toolsDir)) {
    const toolFiles = readdirSync(toolsDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const file of toolFiles) {
      const slug = file.replace('.html', '');
      urls.push(`${SITE_URL}/tools/${slug}`);
    }
  }
  urls.push(`${SITE_URL}/tools/`);

  // Glossary hub
  urls.push(`${SITE_URL}/glossary/`);

  // Glossary term pages
  const glossaryDir = resolve(ROOT, 'public/glossary');
  if (existsSync(glossaryDir)) {
    const glossaryFiles = readdirSync(glossaryDir).filter(
      f => f.endsWith('.html') && f !== 'index.html' && f !== '_template.html'
    );
    for (const file of glossaryFiles) {
      const slug = file.replace('.html', '');
      urls.push(`${SITE_URL}/glossary/${slug}`);
    }
  }

  // Blog posts
  const blogDir = resolve(ROOT, 'public/blog');
  if (existsSync(blogDir)) {
    const blogFiles = readdirSync(blogDir).filter(
      f => f.endsWith('.html') && !f.startsWith('_')
    );
    for (const file of blogFiles) {
      const slug = file.replace('.html', '');
      urls.push(`${SITE_URL}/blog/${slug}`);
    }
  }

  // Deduplicate and return
  return [...new Set(urls)];
}

// ── IndexNow submission (Bing / Yandex) ──────────────────────

async function submitToIndexNow(url) {
  const results = [];
  for (const endpointTemplate of INDEXNOW_ENDPOINTS) {
    const endpoint = endpointTemplate.replace(/{URL}/g, encodeURIComponent(url));
    try {
      const res = await fetch(endpoint, { method: 'GET' });
      if (res.ok || res.status === 202) {
        results.push({ endpoint: new URL(endpoint).hostname, status: 'ok' });
      } else {
        results.push({ endpoint: new URL(endpoint).hostname, status: `error ${res.status}` });
      }
    } catch (e) {
      results.push({ endpoint: new URL(endpoint).hostname, status: `failed: ${e.message}` });
    }
  }
  return results;
}

async function submitBatchToIndexNow(urls, batchSize = 10) {
  let success = 0;
  let failed = 0;

  console.log(`\n📡 Submitting ${urls.length} URLs via IndexNow (Bing/Yandex)...\n`);

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(url => submitToIndexNow(url))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        const allOk = result.value.every(r => r.status === 'ok');
        if (allOk) {
          success++;
        } else {
          failed++;
          const errors = result.value.filter(r => r.status !== 'ok').map(r => r.status).join(', ');
          if (failed <= 3) console.log(`  ⚠️  ${batch[j]}: ${errors}`);
        }
      } else {
        failed++;
        if (failed <= 3) console.log(`  ❌ ${batch[j]}: ${result.reason.message}`);
      }
    }

    // Progress every 20 URLs
    if ((i + batchSize) % 20 === 0 || i + batchSize >= urls.length) {
      console.log(`  Progress: ${Math.min(i + batchSize, urls.length)}/${urls.length} (${success} ok, ${failed} failed)`);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < urls.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return { success, failed, total: urls.length };
}

// ── Google Indexing API submission ──────────────────────────

async function getGoogleAccessToken(keyPath) {
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const { createSign } = await import('crypto');
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

async function submitToGoogle(url, token) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  return await res.json();
}

async function submitBatchToGoogle(urls) {
  const keyPath = process.env.GOOGLE_INDEXING_KEY;
  if (!keyPath || !existsSync(keyPath)) {
    console.log('\n⚠️  GOOGLE_INDEXING_KEY not found. Skipping Google Indexing API.');
    console.log('   To enable: set GOOGLE_INDEXING_KEY env var to your service account JSON key path.\n');
    return { success: 0, failed: 0, total: 0, skipped: true };
  }

  console.log(`\n🔍 Submitting ${urls.length} URLs via Google Indexing API...\n`);

  let token;
  try {
    token = await getGoogleAccessToken(keyPath);
    console.log('✅ Authenticated with Google\n');
  } catch (e) {
    console.log(`❌ Google auth failed: ${e.message}`);
    return { success: 0, failed: urls.length, total: urls.length, skipped: false };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const result = await submitToGoogle(url, token);
      if (result.urlNotificationMetadata) {
        success++;
      } else {
        failed++;
        if (failed <= 3) console.log(`  ⚠️  ${url}: ${JSON.stringify(result).substring(0, 100)}`);
      }
    } catch (e) {
      failed++;
      if (failed <= 3) console.log(`  ❌ ${url}: ${e.message}`);
    }

    // Progress every 10
    if ((i + 1) % 10 === 0 || i === urls.length - 1) {
      console.log(`  Google: ${i + 1}/${urls.length} (${success} ok, ${failed} failed)`);
    }
  }

  return { success, failed, total: urls.length, skipped: false };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const specificUrl = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
  const useGoogle = args.includes('--google');
  const checkMode = args.includes('--check');

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Auto-Indexing Engine                          ║');
  console.log('║   Google · Bing · Yandex · Seznam              ║');
  console.log('╚══════════════════════════════════════════════════╝');

  if (checkMode) {
    console.log(`\n🔑 IndexNow Key: ${INDEXNOW_KEY}`);
    console.log(`   Verification file: https://yt-seo-architect.vercel.app/${INDEXNOW_KEY}.txt\n`);
    // Test the key with a simple URL
    const testUrl = `${SITE_URL}/`;
    console.log(`   Testing IndexNow with: ${testUrl}`);
    const results = await submitToIndexNow(testUrl);
    for (const r of results) {
      console.log(`   ${r.endpoint}: ${r.status}`);
    }
    console.log('');
    return;
  }

  const urls = specificUrl ? [specificUrl] : discoverAllUrls();

  console.log(`\n📋 Discovered ${urls.length} URLs to index`);

  if (!specificUrl) {
    console.log('\nBreakdown:');
    const core = urls.filter(u => !u.includes('/tools/') && !u.includes('/glossary/') && !u.includes('/blog/'));
    const tools = urls.filter(u => u.includes('/tools/'));
    const glossary = urls.filter(u => u.includes('/glossary/'));
    const blog = urls.filter(u => u.includes('/blog/'));
    console.log(`   Core pages: ${core.length}`);
    console.log(`   Tools pages: ${tools.length}`);
    console.log(`   Glossary terms: ${glossary.length}`);
    console.log(`   Blog posts: ${blog.length}`);
  }

  // Always submit to IndexNow (Bing/Yandex)
  const indexNowResult = await submitBatchToIndexNow(urls);

  // Optionally submit to Google
  let googleResult = { success: 0, failed: 0, total: 0, skipped: true };
  if (useGoogle) {
    googleResult = await submitBatchToGoogle(urls);
  } else {
    const keyPath = process.env.GOOGLE_INDEXING_KEY;
    if (keyPath && existsSync(keyPath)) {
      console.log('\nℹ️  Google Indexing API key found. Use --google to submit to Google.');
    }
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════');
  console.log('📊 INDEXING SUMMARY');
  console.log('──────────────────────────────────────────────────');
  console.log(`   Total URLs: ${urls.length}`);
  console.log(`   IndexNow (Bing/Yandex): ${indexNowResult.success} ok, ${indexNowResult.failed} failed`);
  if (!googleResult.skipped) {
    console.log(`   Google Indexing API: ${googleResult.success} ok, ${googleResult.failed} failed`);
  } else {
    console.log('   Google Indexing API: skipped (no key configured)');
  }
  console.log('════════════════════════════════════════════════════\n');
}

main();
