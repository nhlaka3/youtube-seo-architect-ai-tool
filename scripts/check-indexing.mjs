#!/usr/bin/env node
/**
 * scripts/check-indexing.mjs
 *
 * Scans ALL site pages and checks their live status.
 * Reports counts by page type, 404s, and indexing coverage.
 *
 * Usage:
 *   node scripts/check-indexing.mjs                          # Full scan
 *   node scripts/check-indexing.mjs --quick                   # HTTP status only (fast)
 *   node scripts/check-indexing.mjs --gsc                     # + Google Indexing API check (200 URLs/day)
 *   node scripts/check-indexing.mjs --report                  # Generate report file only
 *
 * Output: public/indexing-report.json (for dashboard/history)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT = resolve(__dirname, '..');
const SITE_URL = 'https://yt-seo-architect.vercel.app';
const REPORT_FILE = resolve(PROJECT, 'public/indexing-report.json');

const USE_GSC = process.argv.includes('--gsc');
const QUICK = process.argv.includes('--quick');
const REPORT_ONLY = process.argv.includes('--report');

// ── URL discovery ───────────────────────────────────────────────

function discoverAllUrls() {
  const urls = [];

  // Core pages
  urls.push({ url: `${SITE_URL}/`, type: 'home' });
  urls.push({ url: `${SITE_URL}/blog`, type: 'blog-index' });
  urls.push({ url: `${SITE_URL}/glossary/`, type: 'glossary-index' });
  urls.push({ url: `${SITE_URL}/tools/`, type: 'tools-index' });
  urls.push({ url: `${SITE_URL}/dashboard`, type: 'dashboard' });

  // Blog posts
  const blogDir = resolve(PROJECT, 'public/blog');
  if (existsSync(blogDir)) {
    const files = readdirSync(blogDir).filter(f => f.endsWith('.html') && !f.startsWith('_'));
    for (const f of files) {
      const slug = f.replace('.html', '');
      urls.push({ url: `${SITE_URL}/blog/${slug}`, type: 'blog' });
    }
  }

  // Glossary terms
  const glossaryDir = resolve(PROJECT, 'public/glossary');
  if (existsSync(glossaryDir)) {
    const files = readdirSync(glossaryDir)
      .filter(f => f.endsWith('.html') && !f.startsWith('_') && f !== 'index.html' && !f.includes('-vs-'));
    for (const f of files) {
      const slug = f.replace('.html', '');
      urls.push({ url: `${SITE_URL}/glossary/${slug}`, type: 'glossary' });
    }
  }

  // Glossary comparison pages
  if (existsSync(glossaryDir)) {
    const files = readdirSync(glossaryDir).filter(f => f.endsWith('.html') && f.includes('-vs-'));
    for (const f of files) {
      const slug = f.replace('.html', '');
      urls.push({ url: `${SITE_URL}/glossary/${slug}`, type: 'comparison' });
    }
  }

  // Glossary category pages
  const catDir = resolve(PROJECT, 'public/glossary/category');
  if (existsSync(catDir)) {
    const files = readdirSync(catDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const f of files) {
      const slug = f.replace('.html', '');
      urls.push({ url: `${SITE_URL}/glossary/category/${slug}`, type: 'glossary-category' });
    }
    urls.push({ url: `${SITE_URL}/glossary/category/`, type: 'glossary-category-index' });
  }

  // Tools pages
  const toolsDir = resolve(PROJECT, 'public/tools');
  if (existsSync(toolsDir)) {
    const files = readdirSync(toolsDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const f of files) {
      const slug = f.replace('.html', '');
      urls.push({ url: `${SITE_URL}/tools/${slug}`, type: 'tool' });
    }
  }

  return urls;
}

// ── HTTP status check ───────────────────────────────────────────

async function checkHttpStatus(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return { status: res.status, ok: res.ok };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

// ── Google Indexing API status check ────────────────────────────

async function getAccessToken() {
  const keyPath = process.env.GOOGLE_INDEXING_KEY;
  if (!keyPath || !existsSync(keyPath)) return null;

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
  return data.access_token || null;
}

async function checkGoogleIndexing(url, token) {
  try {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    const data = await res.json();
    // If we got a metadata response, the URL is known to Google
    return data.urlNotificationMetadata ? 'submitted' : data.error?.status || 'unknown';
  } catch (e) {
    return 'error';
  }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  🔍 SITE INDEXING CHECKER');
  console.log('══════════════════════════════════════════════════\n');

  const allUrls = discoverAllUrls();
  console.log(`Discovered ${allUrls.length} URLs:\n`);

  // Show counts by type
  const byType = {};
  for (const u of allUrls) {
    byType[u.type] = (byType[u.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type.padEnd(22)} ${count}`);
  }

  if (REPORT_ONLY && existsSync(REPORT_FILE)) {
    const previous = JSON.parse(readFileSync(REPORT_FILE, 'utf-8'));
    console.log(`\n📊 Previous report: ${previous.timestamp}\n`);
    for (const [type, data] of Object.entries(previous.byType)) {
      console.log(`  ${type.padEnd(22)} ${data.total} pages, ${data.live} live, ${data.dead} dead`);
    }
    return;
  }

  // HTTP status checks
  console.log('\n--- Checking HTTP status ---\n');

  const results = [];
  const concurrency = 20;
  const chunks = [];
  for (let i = 0; i < allUrls.length; i += concurrency) {
    chunks.push(allUrls.slice(i, i + concurrency));
  }

  let checked = 0;
  const liveByType = {};
  const deadByType = {};

  for (const chunk of chunks) {
    const checks = chunk.map(u => checkHttpStatus(u.url));
    const statuses = await Promise.all(checks);

    for (let i = 0; i < chunk.length; i++) {
      const u = chunk[i];
      const s = statuses[i];
      checked++;

      const isLive = s.status === 200;
      if (isLive) {
        liveByType[u.type] = (liveByType[u.type] || 0) + 1;
      } else if (s.status !== 308 && s.status !== 301) {
        deadByType[u.type] = (deadByType[u.type] || 0) + 1;
      }

      results.push({ ...u, ...s });

      if (checked % 500 === 0 || checked === allUrls.length) {
        console.log(`  ${checked}/${allUrls.length} checked...`);
      }
    }

    if (QUICK && checked >= 500) break;
  }

  // Report
  const live = results.filter(r => r.status === 200).length;
  const redirect = results.filter(r => r.status === 308 || r.status === 301).length;
  const dead = results.filter(r => r.status === 404).length;
  const errors = results.filter(r => r.status === 0).length;
  const checked_total = results.length;

  console.log(`\n══════════════════════════════════════════════════`);
  console.log('  📊 INDEXING STATUS REPORT');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Total URLs discovered:  ${allUrls.length}`);
  console.log(`  URLs checked:           ${checked_total}`);
  console.log(`  ✅ Live (200):           ${live}`);
  console.log(`  🔄 Redirect (301/308):   ${redirect}`);
  console.log(`  ❌ Not found (404):      ${dead}`);
  console.log(`  ⚠️  Errors:              ${errors}\n`);

  console.log('  By page type:');
  const allTypes = [...new Set(results.map(r => r.type))].sort();
  for (const type of allTypes) {
    const typeResults = results.filter(r => r.type === type);
    const typeLive = typeResults.filter(r => r.status === 200).length;
    const typeDead = typeResults.filter(r => r.status === 404).length;
    const typeTotal = typeResults.length;
    const pct = typeTotal > 0 ? Math.round((typeLive / typeTotal) * 100) : 0;
    console.log(`    ${type.padEnd(22)} ${typeLive}/${typeTotal} live (${pct}%)`);
  }

  // 404 list
  const notFound = results.filter(r => r.status === 404);
  if (notFound.length > 0) {
    console.log(`\n  ❌ 404 URLs (${notFound.length}):`);
    for (const u of notFound.slice(0, 20)) {
      console.log(`    ${u.url}`);
    }
    if (notFound.length > 20) {
      console.log(`    ... and ${notFound.length - 20} more`);
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    total: allUrls.length,
    checked: checked_total,
    live,
    redirect,
    dead,
    errors,
    byType: {},
    notFound: notFound.map(u => u.url),
  };

  for (const type of allTypes) {
    const typeResults = results.filter(r => r.type === type);
    report.byType[type] = {
      total: typeResults.length,
      live: typeResults.filter(r => r.status === 200).length,
      dead: typeResults.filter(r => r.status === 404).length,
    };
  }

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n  💾 Report saved to: ${REPORT_FILE}\n`);

  // Return summary for cron job delivery
  return { live, dead, total: allUrls.length, byType: report.byType };
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
