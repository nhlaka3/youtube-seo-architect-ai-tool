#!/usr/bin/env node
/**
 * verify-confirmed-backlinks.mjs
 * ------------------------------
 * HONEST backlink verification for YT SEO Architect.
 *
 * The older audit pipeline (audit-*.json) reported "14 links / 8 domains" from
 * automation artifacts without a verifiable source in the repo. That number
 * conflated "prospects contacted" with "confirmed referring domains".
 *
 * This script redefines "confirmed backlink" STRICTLY as: an EXTERNAL page that
 * returns HTTP 200 AND contains a link to the target domain, live-verified now.
 *
 * It produces:
 *   - confirmed-backlinks-<date>.json  (only live-verified links)
 *   - logs every prospect status (200-with-link / dead / blocked / no-link)
 * so the backlink report never overstates reality.
 *
 * Usage:
 *   node scripts/verify-confirmed-backlinks.mjs \
 *     --target yt-seo-architect.vercel.app \
 *     --prospects marketing/backlink-reports/qualified-prospects-2026-08-01.json
 */
import fs from 'fs';
import { execSync } from 'child_process';

const FLAG = (n) => process.argv.indexOf(n);
const get = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const TARGET = get('--target', 'yt-seo-architect.vercel.app');
const PROSPECTS_FILE = get('--prospects', process.env.PROSPECTS_FILE);
const OUT_DIR = get('--out', 'marketing/backlink-reports');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function fetchPage(url) {
  // returns {code, hasLink, ctx, bytes}
  const tmp = `/tmp/verify_${Date.now()}.html`;
  let code;
  try {
    code = execSync(
      `curl -sL --max-time 25 -A '${UA}' -o '${tmp}' -w '%{http_code}' '${url}'`,
      { encoding: 'utf8' }
    ).trim();
  } catch (e) {
    return { status: 'error', reason: e.message.split('\n')[0].slice(0, 80) };
  }
  let body = '';
  try { body = fs.readFileSync(tmp, 'utf8'); } catch {}
  const hasLink = body.includes(TARGET);
  let anchor = null;
  if (hasLink) {
    const i = body.indexOf(TARGET);
    anchor = body.slice(Math.max(0, i - 120), i + TARGET.length + 80)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  return { status: code === '200' ? '200' : ('http_' + code), code, hasLink, anchor };
}

function load(urls) {
  if (!urls) return [];
  const f = fs.existsSync(urls) ? urls : `${process.cwd()}/${urls}`;
  if (!fs.existsSync(f)) { console.error(`Prospects file not found: ${f}`); process.exit(2); }
  const raw = fs.readFileSync(f, 'utf8');
  try { const j = JSON.parse(raw); return (j.prospects ?? j).map(p => typeof p === 'string' ? p : p.url); }
  catch { return raw.split('\n').map(l => l.trim()).filter(Boolean); }
}

const prospects = load(PROSPECTS_FILE);
console.log(`Verifying ${prospects.length} prospects against target '${TARGET}'...`);

const confirmed = [];
const results = [];
for (const [i, url] of prospects.entries()) {
  const r = { url, ...fetchPage(url) };
  if (r.status === '200' && r.hasLink) confirmed.push({ url, anchor: r.anchor });
  results.push(r);
  if (!(i % 10)) console.log(`  ${i}/${prospects.length} ...`);
}

const date = new Date().toISOString().slice(0, 10);
const report = {
  generated: new Date().toISOString(),
  target: TARGET,
  summary: {
    prospects_checked: results.length,
    confirmed_backlinks: confirmed.length,
    referring_domains: new Set(confirmed.map(c => new URL(c.url).hostname.replace('www.', ''))).size,
    live_pages: results.filter(r => r.status === '200').length,
    dead_or_blocked: results.filter(r => r.status !== '200' && r.status !== 'live').length,
  },
  methodology: 'Confirmed = external page returning HTTP 200 AND containing a live link to target, checked at generation time. This replaces the older audit-*.json count which conflated prospects with links.',
  confirmed,
  results,
};
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(`${OUT_DIR}/confirmed-backlinks-${date}.json`, JSON.stringify(report, null, 2));
console.log(`\nDone. ${confirmed.length} confirmed backlinks (${report.summary.referring_domains} referring domains).`);
console.log(`Report: ${OUT_DIR}/confirmed-backlinks-${date}.json`);