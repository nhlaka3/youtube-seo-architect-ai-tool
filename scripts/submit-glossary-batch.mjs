#!/usr/bin/env node
/**
 * scripts/submit-glossary-batch.mjs
 *
 * Submits 200 glossary URLs per day to Google Indexing API.
 * Tracks progress via public/glossary-indexing-cursor.json
 *
 * Usage:
 *   node scripts/submit-glossary-batch.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = 'https://yt-seo-architect.vercel.app';
const CURSOR_PATH = resolve(ROOT, 'public/glossary-indexing-cursor.json');
const BATCH_SIZE = 200;

// ── Load glossary terms ─────────────────────────────────────────

function loadTerms() {
  const raw = JSON.parse(readFileSync(resolve(ROOT, 'scripts/glossary-data.json'), 'utf-8'));
  return (raw.terms || []).map(t => t.slug).filter(Boolean);
}

// ── Generate all glossary URLs ──────────────────────────────────

function generateUrls(terms) {
  const urls = [];
  // Static pages
  urls.push(`${SITE}/glossary/`);
  // Category pages
  const cats = ['analytics', 'algorithm', 'seo-optimization', 'monetization', 'content-strategy', 'youtube-features'];
  for (const c of cats) urls.push(`${SITE}/glossary/category/${c}`);
  // Term pages (EN + ES)
  for (const slug of terms) {
    urls.push(`${SITE}/glossary/${slug}`);
    urls.push(`${SITE}/glossary/es/${slug}`);
  }
  // NOTE: Comparison (X-vs-Y) pages are no longer submitted. They are noindex'd
  // (thin, template-assembled content with no standalone search demand) and the
  // Google Indexing API only acts on JobPosting/VideoObject pages anyway, so
  // submitting them wasted daily quota on URLs that can never be forced into the
  // index. Terms (above) + tools stay on the legitimate submit path.
  return [...new Set(urls)];
}

// ── Cursor management ──────────────────────────────────────────

function readCursor() {
  if (!existsSync(CURSOR_PATH)) {
    return { index: 0, completed: false, updatedAt: null };
  }
  return JSON.parse(readFileSync(CURSOR_PATH, 'utf-8'));
}

function writeCursor(cursor) {
  writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2) + '\n');
}

// ── Google Indexing API ────────────────────────────────────────

function loadGoogleKey() {
  if (process.env.GOOGLE_INDEXING_KEY) {
    try { return JSON.parse(process.env.GOOGLE_INDEXING_KEY); } catch {}
    if (existsSync(process.env.GOOGLE_INDEXING_KEY)) {
      return JSON.parse(readFileSync(process.env.GOOGLE_INDEXING_KEY, 'utf-8'));
    }
  }
  // Local dev fallback
  const p = resolve(ROOT, 'config/google-indexing-key.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
}

async function getToken(key) {
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
  const d = await res.json();
  if (!d.access_token) throw new Error(`Auth failed: ${JSON.stringify(d)}`);
  return d.access_token;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  📡 GLOSSARY BATCH INDEXER');
  console.log('══════════════════════════════════════════\n');

  // 1. Load terms and generate URLs
  const terms = loadTerms();
  const allUrls = generateUrls(terms);
  console.log(`📋 ${terms.length} terms → ${allUrls.length} total URLs`);

  // 2. Read cursor
  let cursor = readCursor();
  if (cursor.completed) {
    console.log('✅ All glossary URLs have been submitted previously.');
    console.log('   Resetting to re-submit (URL_UPDATED type is idempotent).');
    cursor = { index: 0, completed: false, updatedAt: null };
  }

  console.log(`📌 Cursor: ${cursor.index}/${allUrls.length}`);
  const remaining = allUrls.length - cursor.index;
  const batchSize = Math.min(BATCH_SIZE, remaining);
  const batch = allUrls.slice(cursor.index, cursor.index + batchSize);

  console.log(`📦 Submitting batch ${cursor.index + 1}–${cursor.index + batchSize} (${batchSize} URLs)\n`);

  // 3. Submit to Google Indexing API
  const key = loadGoogleKey();
  if (!key) {
    console.log('❌ No Google service account key found');
    process.exit(1);
  }

  const token = await getToken(key);
  console.log('✅ Authenticated with Google\n');

  let success = 0, failed = 0, attempted = 0;
  for (let i = 0; i < batch.length; i++) {
    attempted++;
    try {
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: batch[i], type: 'URL_UPDATED' }),
      });
      const bodyText = await res.text();
      if (res.ok) {
        success++;
      } else if (res.status === 429) {
        const detail = bodyText.slice(0, 300);
        failed++;
        console.log(`   ⚠️  429 on ${batch[i]} — ${detail}`);
        // Could be a burst limit (shared GH runner IPs). Retry once after 30s.
        if (failed === 1) {
          console.log('   ⏳ Waiting 30s and retrying once...');
          await new Promise(r => setTimeout(r, 30000));
          try {
            const retry = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: batch[i], type: 'URL_UPDATED' }),
            });
            if (retry.ok) { success++; continue; }
            const detail2 = (await retry.text().catch(() => '')).slice(0, 300);
            console.log(`   ⚠️  retry ${retry.status} — ${detail2}`);
            if (retry.status === 429) {
              const retryAfter = retry.headers.get('retry-after');
              if (retryAfter) console.log(`   ⏳ Retry after: ${retryAfter}s`);
              console.log('   ⏹️  Quota still exhausted — stopping early, will resume next run');
              attempted--; // the retry consumed no quota success; count once
              break;
            }
          } catch (e) {
            console.log(`   ⚠️  retry failed: ${e.message}`);
          }
        } else {
          const retryAfter = res.headers.get('retry-after');
          if (retryAfter) console.log(`   ⏳ Retry after: ${retryAfter}s`);
          console.log('   ⏹️  Quota exhausted — stopping early, will resume next run');
          break;
        }
      } else {
        failed++;
        console.log(`   ⚠️  [${i + 1}] ${batch[i].split('/glossary/')[1]}: ${res.status} ${bodyText.slice(0, 150)}`);
      }
    } catch (e) {
      failed++;
    }

    if ((i + 1) % 20 === 0 || i === batch.length - 1) {
      console.log(`   ${i + 1}/${batch.length} (${success} ok, ${failed} failed)`);
    }

    // Small delay to avoid rate limiting
    if (i > 0 && i % 50 === 0) await new Promise(r => setTimeout(r, 500));
  }

  // 4. Update cursor
  const newIndex = cursor.index + success;
  const newCursor = {
    index: newIndex,
    total: allUrls.length,
    completed: newIndex >= allUrls.length,
    lastBatch: {
      submitted: attempted,
      succeeded: success,
      failed,
      timestamp: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  writeCursor(newCursor);

  // 5. Summary
  console.log('\n══════════════════════════════════════════');
  console.log(`✅ This run: ${success} submitted, ${failed} failed`);
  console.log(`📊 Progress: ${newIndex}/${allUrls.length} (${Math.round(newIndex / allUrls.length * 100)}%)`);
  if (newCursor.completed) {
    console.log('🎉 All glossary URLs submitted!');
  } else {
    console.log(`⏭️  Next batch: ${newIndex}–${Math.min(newIndex + BATCH_SIZE, allUrls.length)}`);
  }
  console.log('══════════════════════════════════════════\n');

  // Exit with error if we got rate-limited and made no progress
  if (success === 0 && failed > 0) {
    console.error('❌ All submissions failed — likely quota exhausted. Will retry tomorrow.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
