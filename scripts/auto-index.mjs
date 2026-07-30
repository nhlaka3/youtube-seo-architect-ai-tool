#!/usr/bin/env node
/**
 * scripts/auto-index.mjs
 *
 * Auto-submits all site pages to search engines for faster indexing.
 * Runs automatically after every deploy to ensure instant indexing.
 *
 * Supports:
 *   - Sitemap ping (Google + Bing — covers ALL pages in one call)
 *   - IndexNow (Bing, Yandex) — per-URL notifications
 *   - Google Indexing API — requires GOOGLE_INDEXING_KEY env var (optional)
 *
 * Usage:
 *   node scripts/auto-index.mjs                        # Submit all pages via IndexNow + sitemap ping
 *   node scripts/auto-index.mjs --url https://...      # Submit a specific URL
 *   node scripts/auto-index.mjs --deploy               # Full deploy pipeline: sitemap ping + IndexNow + Google (if key exists)
 *   node scripts/auto-index.mjs --check                # Verify IndexNow key is valid
 *
 * ═══════════════════════════════════════════════════════════
 * GOOGLE INDEXING API SETUP (OPTIONAL)
 * ═══════════════════════════════════════════════════════════
 * To enable Google Indexing API submissions:
 *
 * 1. Go to https://console.cloud.google.com
 * 2. Create a project → Enable "Indexing API" in the API library
 * 3. Create a Service Account: IAM & Admin → Service Accounts → Create
 *    → Role: Owner → Create a key → Download JSON
 * 4. Add the service account email as OWNER in Google Search Console:
 *    → Search Console → Settings → Users → Add User
 *    → Email: [service-account-email] → Role: Owner
 * 5. Set the env var: export GOOGLE_INDEXING_KEY=/path/to/key.json
 *
 * For GitHub Actions: add GOOGLE_INDEXING_KEY as a repository secret
 * containing the full contents of the JSON key file.
 * ═══════════════════════════════════════════════════════════
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE_URL = 'https://yt-seo-architect.vercel.app';
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

// IndexNow API key — must match public/{key}.txt verification file
const INDEXNOW_KEY = '8825c721ac4f49c5b25af78d7418a2b8';

// ── Page discovery ──────────────────────────────────────────────

function discoverAllUrls() {
  const urls = [];

  // Core pages
  urls.push(`${SITE_URL}/`);
  urls.push(`${SITE_URL}/about`);
  urls.push(`${SITE_URL}/changelog`);
  urls.push(`${SITE_URL}/contact`);
  urls.push(`${SITE_URL}/blog`);
  urls.push(`${SITE_URL}/glossary/`);
  urls.push(`${SITE_URL}/tools/`);

  // Tools pages
  const toolsDir = resolve(ROOT, 'public/tools');
  if (existsSync(toolsDir)) {
    const toolFiles = readdirSync(toolsDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const file of toolFiles) {
      urls.push(`${SITE_URL}/tools/${file.replace('.html', '')}`);
    }
  }

  // Glossary pages (generated from glossary-data.json — all 5,700+ comparison URLs)
  const glossaryDataPath = resolve(ROOT, 'scripts/glossary-data.json');
  if (existsSync(glossaryDataPath)) {
    try {
      const raw = JSON.parse(readFileSync(glossaryDataPath, 'utf-8'));
      const terms = (raw.terms || []).map(t => t.slug).filter(Boolean);
      if (terms.length > 0) {
        // Term pages
        for (const slug of terms) {
          urls.push(`${SITE_URL}/glossary/${slug}`);
          urls.push(`${SITE_URL}/glossary/es/${slug}`);
        }
        // Comparison pages (a-vs-b for every unique pair)
        for (let i = 0; i < terms.length; i++) {
          for (let j = i + 1; j < terms.length; j++) {
            urls.push(`${SITE_URL}/glossary/${terms[i]}-vs-${terms[j]}`);
            urls.push(`${SITE_URL}/glossary/es/${terms[i]}-vs-${terms[j]}`);
          }
        }
        // Category pages
        for (const cat of ['analytics','algorithm','seo-optimization','monetization','content-strategy','youtube-features']) {
          urls.push(`${SITE_URL}/glossary/category/${cat}`);
        }
      }
    } catch (_) { /* fallback to filesystem scan below */ }
  }
  // Also scan public/glossary/ for any static files not covered above
  const glossaryDir = resolve(ROOT, 'public/glossary');
  if (existsSync(glossaryDir)) {
    const glossaryFiles = readdirSync(glossaryDir).filter(
      f => f.endsWith('.html') && f !== 'index.html' && f !== '_template.html'
    );
    for (const file of glossaryFiles) {
      urls.push(`${SITE_URL}/glossary/${file.replace('.html', '')}`);
    }
  }

  // Blog posts
  const blogDir = resolve(ROOT, 'public/blog');
  if (existsSync(blogDir)) {
    const blogFiles = readdirSync(blogDir).filter(f => f.endsWith('.html') && !f.startsWith('_'));
    for (const file of blogFiles) {
      urls.push(`${SITE_URL}/blog/${file.replace('.html', '')}`);
    }
  }

  return [...new Set(urls)];
}

// ── Sitemap ping (fastest way to notify all search engines) ──

async function pingSitemap() {
  console.log(`\n🗺️  Pinging sitemap to search engines...\n`);

  const endpoints = [
    { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` },
    { name: 'Bing',   url: `https://www.bing.com/ping?siteMap=${encodeURIComponent(SITEMAP_URL)}` },
  ];

  const results = [];
  for (const { name, url } of endpoints) {
    try {
      const res = await fetch(url, { method: 'GET' });
      results.push({ name, status: res.ok ? 'ok' : `http ${res.status}` });
      console.log(`   ${name}: ${res.ok ? '✅' : '⚠️'} ${res.status}`);
    } catch (e) {
      results.push({ name, status: `failed: ${e.message}` });
      console.log(`   ${name}: ❌ ${e.message}`);
    }
  }
  return results;
}

// ── IndexNow submission (Bing / Yandex) ────────────────────────

async function submitToIndexNow(url) {
  const endpoints = [
    `https://bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
    `https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
    `https://yandex.com/indexnow?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`,
  ];

  const results = [];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { method: 'GET' });
      results.push({
        host: new URL(endpoint).hostname,
        status: (res.ok || res.status === 202) ? 'ok' : `error ${res.status}`,
      });
    } catch (e) {
      results.push({ host: new URL(endpoint).hostname, status: `failed: ${e.message}` });
    }
  }
  return results;
}

async function submitBatchToIndexNow(urls) {
  console.log(`\n📡 Submitting ${urls.length} URLs via IndexNow (Bing/Yandex)...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const batchResults = await Promise.allSettled(batch.map(url => submitToIndexNow(url)));

    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j].status === 'fulfilled') {
        const allOk = batchResults[j].value.every(r => r.status === 'ok');
        if (allOk) success++;
        else failed++;
      } else {
        failed++;
      }
    }

    if ((i + 10) % 50 === 0 || i + 10 >= urls.length) {
      console.log(`   ${Math.min(i + 10, urls.length)}/${urls.length} (${success} ok, ${failed} failed)`);
    }

    if (i + 10 < urls.length) await new Promise(r => setTimeout(r, 100));
  }

  return { success, failed, total: urls.length };
}

// ── Google Indexing API (optional, requires service account) ──

function resolveGoogleKey(input) {
  // Handle both file paths and raw JSON contents
  if (!input) return null;
  if (input.startsWith('{')) {
    // Raw JSON contents (e.g., from GitHub Actions secret)
    try { return JSON.parse(input); } catch { return null; }
  }
  // File path (local development)
  if (existsSync(input)) {
    return JSON.parse(readFileSync(input, 'utf8'));
  }
  return null;
}

async function getGoogleAccessToken(key) {
  if (!key || !key.client_email || !key.private_key) throw new Error('Invalid Google service account key');
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

async function submitBatchToGoogle(urls) {
  const rawInput = process.env.GOOGLE_INDEXING_KEY;
  const key = resolveGoogleKey(rawInput);
  if (!key) {
    return { success: 0, failed: 0, total: 0, skipped: true };
  }

  console.log(`\n🔍 Submitting ${urls.length} URLs via Google Indexing API...\n`);

  let token;
  try {
    token = await getGoogleAccessToken(key);
    console.log('✅ Authenticated with Google\n');
  } catch (e) {
    console.log(`❌ Google auth failed: ${e.message}`);
    return { success: 0, failed: urls.length, total: urls.length, skipped: false };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], type: 'URL_UPDATED' }),
      });
      const result = await res.json();
      if (result.urlNotificationMetadata) success++;
      else failed++;
    } catch (e) {
      failed++;
    }

    if ((i + 1) % 10 === 0 || i === urls.length - 1) {
      console.log(`   ${i + 1}/${urls.length} (${success} ok, ${failed} failed)`);
    }
  }

  return { success, failed, total: urls.length, skipped: false };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const specificUrl = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
  const deployMode = args.includes('--deploy');
  const checkMode = args.includes('--check');

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Auto-Indexing Engine                          ║');
  console.log('║   Google · Bing · Yandex                        ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // ── Check mode ────────────────────────────────────────────
  if (checkMode) {
    console.log(`\n🔑 IndexNow Key: ${INDEXNOW_KEY}`);
    console.log(`   Verification: https://yt-seo-architect.vercel.app/${INDEXNOW_KEY}.txt`);
    const testResult = await submitToIndexNow(`${SITE_URL}/`);
    for (const r of testResult) {
      console.log(`   ${r.host}: ${r.status}`);
    }
    return;
  }

  const urls = specificUrl ? [specificUrl] : discoverAllUrls();
  console.log(`\n📋 ${urls.length} URLs discovered`);

  if (!specificUrl) {
    const stats = {
      core: urls.filter(u => !u.includes('/tools/') && !u.includes('/glossary/') && !u.includes('/blog/')).length,
      tools: urls.filter(u => u.includes('/tools/')).length,
      glossary: urls.filter(u => u.includes('/glossary/')).length,
      blog: urls.filter(u => u.includes('/blog/')).length,
    };
    console.log(`   Core: ${stats.core} | Tools: ${stats.tools} | Glossary: ${stats.glossary} | Blog: ${stats.blog}`);
  }

  // ── Step 1: Ping sitemap (always — fastest path) ────────
  const sitemapResult = await pingSitemap();

  // ── Step 2: IndexNow (always — per-URL notifications) ───
  const indexNowResult = await submitBatchToIndexNow(urls);

  // ── Step 3: Google Indexing API (only if key exists) ────
  let googleResult = { success: 0, failed: 0, total: 0, skipped: true };
  const hasGoogleKey = !!resolveGoogleKey(process.env.GOOGLE_INDEXING_KEY);
  if (deployMode && hasGoogleKey) {
    googleResult = await submitBatchToGoogle(urls);
  } else if (hasGoogleKey) {
    console.log('\nℹ️  Google Indexing API key detected. Use --deploy to submit to Google.');
  }

  // ── Summary ──────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log('📊 INDEXING SUMMARY');
  console.log('──────────────────────────────────────────────────');
  console.log(`   Total URLs:          ${urls.length}`);
  console.log(`   Sitemap ping:        ${sitemapResult.map(r => `${r.name}: ${r.status === 'ok' ? '✅' : '⚠️'}`).join(', ')}`);
  console.log(`   IndexNow:            ${indexNowResult.success} ok, ${indexNowResult.failed} failed`);
  if (!googleResult.skipped) {
    console.log(`   Google API:          ${googleResult.success} ok, ${googleResult.failed} failed`);
  } else {
    console.log(`   Google API:          skipped (set GOOGLE_INDEXING_KEY + use --deploy)`);
  }
  console.log('════════════════════════════════════════════════════\n');

  // Return exit code for CI/CD integration
  if (indexNowResult.failed > 5 || (!googleResult.skipped && googleResult.failed > 5)) {
    process.exit(1);
  }
}

main();
