#!/usr/bin/env node
/**
 * scripts/post-lead-drafts.mjs
 *
 * Posts the reply drafts from marketing/reddit-drafts/ to Reddit via the API.
 * Each draft file's header contains the post permalink; the "## Draft Reply"
 * section is the comment body.
 *
 * Usage:
 *   node scripts/post-lead-drafts.mjs                # post all unsent drafts
 *   node scripts/post-lead-drafts.mjs --dry-run      # show what would be posted
 *   node scripts/post-lead-drafts.mjs --file <path>  # post a single draft
 *
 * Env (required for posting):
 *   REDDIT_CLIENT_ID     — Reddit App client ID (script type)
 *   REDDIT_CLIENT_SECRET — Reddit App client secret
 *   REDDIT_USERNAME      — Reddit account username
 *   REDDIT_PASSWORD      — Reddit account password
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
config({ path: resolve(PROJECT, '.env.local') });

const DRAFTS_DIR = resolve(PROJECT, 'marketing/reddit-drafts');
const SENT_FILE = resolve(DRAFTS_DIR, '.sent.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FILE_ARG = args.find(a => a.startsWith('--file='));
const SINGLE_FILE = FILE_ARG ? FILE_ARG.split('=')[1] : null;

// ── Parse a draft file ─────────────────────────────────────────────
function parseDraft(filepath) {
  const raw = readFileSync(filepath, 'utf-8');
  const permMatch = raw.match(/\*\*Post:\*\* \[[^\]]+\]\(([^)]+)\)/);
  const authorMatch = raw.match(/\*\*Author:\*\* u\/(\S+)/);
  const titleMatch = raw.match(/\*\*Post:\*\* \[([^\]]+)\]/);
  const replyMatch = raw.match(/## Draft Reply\n\n([\s\S]*?)(?=\n---\s*$|\n## Post Content|$)/);
  if (!permMatch || !replyMatch) {
    console.log(`  ⚠ Skipping (unparseable): ${filepath.split('/').pop()}`);
    return null;
  }
  return {
    permalink: permMatch[1],
    author: authorMatch ? authorMatch[1] : '?',
    title: titleMatch ? titleMatch[1] : '?',
    reply: replyMatch[1].trim(),
    file: filepath,
    filename: filepath.split('/').pop(),
  };
}

// ── Reddit API helpers ─────────────────────────────────────────────
async function getAccessToken() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!clientId || !clientSecret || !username || !password) {
    return { error: 'Missing Reddit API credentials (REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD)' };
  }
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'YTSEOArchitect/1.0 (YouTube SEO tool; https://yt-seo-architect.vercel.app)',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    return { error: `Token HTTP ${res.status}: ${err.slice(0, 200)}` };
  }
  const data = await res.json();
  return { token: data.access_token };
}

async function postComment(token, permalink, text) {
  // permalink like /r/NewTubers/comments/1t7342p/slug/ -> thing id t3_1t7342p
  const idMatch = permalink.match(/\/comments\/([a-z0-9]+)/i);
  if (!idMatch) return { error: `Could not extract post id from ${permalink}` };
  const thingId = `t3_${idMatch[1]}`;

  const res = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'YTSEOArchitect/1.0 (YouTube SEO tool; https://yt-seo-architect.vercel.app)',
    },
    body: `thing_id=${thingId}&text=${encodeURIComponent(text)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    return { error: `Reply HTTP ${res.status}: ${err.slice(0, 200)}` };
  }
  const data = await res.json();
  const id = data.json?.data?.things?.[0]?.data?.id;
  return { id, url: `https://www.reddit.com${permalink}` };
}

// ── Sent tracker ───────────────────────────────────────────────────
function getSent() {
  if (!existsSync(SENT_FILE)) return {};
  try { return JSON.parse(readFileSync(SENT_FILE, 'utf-8')); } catch { return {}; }
}
function markSent(filename, result) {
  const sent = getSent();
  sent[filename] = { sent_at: new Date().toISOString(), ...result };
  writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2));
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  💬 POST LEAD DRAFTS');
  console.log('════════════════════════════════════════════\n');

  const files = SINGLE_FILE
    ? [SINGLE_FILE]
    : readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')).sort();

  if (!files.length) { console.log('  No drafts found.'); return; }

  const sent = getSent();
  const pending = files.filter(f => !sent[f]);
  console.log(`  Drafts: ${files.length} | Already sent: ${files.length - pending.length} | Pending: ${pending.length}\n`);

  if (DRY_RUN) {
    for (const f of pending) {
      const draft = parseDraft(resolve(DRAFTS_DIR, f));
      if (!draft) continue;
      console.log(`  [DRY] Would reply to u/${draft.author} on ${draft.permalink}`);
      console.log(`        "${draft.reply.slice(0, 90)}..."\n`);
    }
    console.log(`  DRY RUN — ${pending.length} replies ready. No posts made.`);
    return;
  }

  const auth = await getAccessToken();
  if (auth.error) {
    console.error(`  ❌ ${auth.error}`);
    console.error('\n  To enable posting:');
    console.error('  1. Go to https://www.reddit.com/prefs/apps → create a "script" app');
    console.error('  2. Set these in .env.local:');
    console.error('     REDDIT_CLIENT_ID=<your client id>');
    console.error('     REDDIT_CLIENT_SECRET=<your client secret>');
    console.error('     REDDIT_USERNAME=<your reddit username>');
    console.error('     REDDIT_PASSWORD=<your reddit password>');
    console.error('  3. Re-run this script.');
    process.exit(1);
  }

  let ok = 0, fail = 0;
  for (const f of pending) {
    const draft = parseDraft(resolve(DRAFTS_DIR, f));
    if (!draft) { fail++; continue; }

    console.log(`  💬 Replying to u/${draft.author} — "${draft.title.slice(0, 55)}..."`);
    const result = await postComment(auth.token, draft.permalink, draft.reply);
    if (result.error) {
      console.log(`     ❌ ${result.error}`);
      fail++;
    } else {
      console.log(`     ✅ Comment ${result.id} on ${result.url}`);
      markSent(f, { comment_id: result.id, permalink: draft.permalink });
      ok++;
    }
    await new Promise(r => setTimeout(r, 2500)); // be polite
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  Posted: ${ok} | Failed: ${fail}`);
  console.log('════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
