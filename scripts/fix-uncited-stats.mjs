#!/usr/bin/env node
/**
 * scripts/fix-uncited-stats.mjs
 *
 * AUDIT FINDING C5: uncited statistics presented as fact → misinformation + E-E-A-T collapse.
 *
 * Strategy: remediate each UNIQUE stat-containing paragraph once via Groq, then
 * apply the rewritten HTML globally across all seo_pages rows. This is far cheaper
 * and less error-prone than rewriting 53 full posts (avoids token-truncation of the
 * article body), and dedup means we pay once per unique paragraph.
 *
 * Usage:
 *   node scripts/fix-uncited-stats.mjs --dry-run     # extract + remediate + diff to /tmp, NO writes
 *   node scripts/fix-uncited-stats.mjs               # apply rewrites to the DB
 *   node scripts/fix-uncited-stats.mjs --limit=5     # only first N unique paragraphs (for testing)
 *
 * Env: GROQ_API_KEY (from .env.local), DATABASE_URL (from .env.local)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve('.env.local'), override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;
const CACHE = '/tmp/c5-rewrites.json';
const LOAD_CACHE = process.argv.includes('--load-cache');

const GROQ_KEY = process.env.GROQ_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!GROQ_KEY) { console.error('❌ GROQ_API_KEY missing (check .env.local)'); process.exit(1); }
if (!DATABASE_URL) { console.error('❌ DATABASE_URL missing'); process.exit(1); }

// ── DB helper (family:4 + retry — Neon pooler quirk) ──
const { default: pg } = await import('pg');
const { Client } = pg;
const base = DATABASE_URL.split('?')[0];

async function connectDB() {
  const client = new Client({ connectionString: base, ssl: { rejectUnauthorized: false }, family: 4, connectionTimeoutMillis: 15000, keepAlive: true });
  let connected = false;
  for (let a = 1; a <= 6 && !connected; a++) {
    try { await client.connect(); connected = true; }
    catch (e) { if (a < 6) await new Promise(r => setTimeout(r, 2500 * a)); else throw e; }
  }
  return client;
}

// ── Stat detection (same as audit inventory) ──
const statRe = /(According to|study by|found that|a (recent|new|2026) (study|report|survey)|[0-9]+%|survey of|[0-9,]+\+? (creators|users|channels|videos)|we audited|we collected data|we analyzed data|data from [0-9]+|case study)/i;

function hasStat(text) {
  if (!text || text.length < 40) return false;
  if (!statRe.test(text)) return false;
  if (!/[0-9]+(\.[0-9]+)?%|\b[0-9,]+\b/.test(text)) return false;
  return true;
}

// extract <p> paragraphs
function extractParas(content) {
  const out = [];
  const re = /<p[^>]*>[\s\S]*?<\/p>/g;
  let m;
  while ((m = re.exec(content)) !== null) out.push({ html: m[0], start: m.index });
  return out;
}

function stripTags(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function normKey(text) { return text.toLowerCase().slice(0, 160); }

// ── Groq remediator ──
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

async function remediate(html, modelIdx = 0, attempt = 0) {
  const model = MODELS[modelIdx % MODELS.length];
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: 'You fix fabricated statistics in SEO blog content to restore E-E-A-T trust. HARD RULES: (1) Remove, soften to qualitative language ("more", "higher", "most"), or re-attribute to a REAL, citable primary source — you may ONLY add a specific number if it is a well-established, uncontroversial public fact you are certain of; otherwise keep it qualitative. (2) NEVER invent a source, study, survey, or company attribution. (3) NEVER attribute a metric to a real brand (TubeFilter, Hootsuite, HubSpot, Pew Research, etc.) unless it is truly from them. (4) Remove fake creator case-study before/after metrics. (5) Do NOT add new claims or facts. (6) Preserve meaning and the exact same wording for any sentence that is already factual. (7) If a "<strong>" or inline tag is present, keep the tags in place. Return ONLY the rewritten HTML paragraph for that single paragraph — no explanation, no wrapper, no markdown fences.',
          },
          {
            role: 'user',
            content: `Rewrite ONLY this paragraph so no unverifiable statistic is presented as fact (soften/cite/delete as needed). Keep the surrounding HTML tags intact.\n\nPARAGRAPH:\n${html}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      // 429 = quota/rate limit → switch to next model after short pause
      if (r.status === 429 && modelIdx < MODELS.length) {
        await new Promise(res => setTimeout(res, 4000));
        return remediate(html, modelIdx + 1, 0);
      }
      if (r.status >= 500 && attempt < 4) {
        await new Promise(res => setTimeout(res, 6000 * (attempt + 1)));
        return remediate(html, modelIdx, attempt + 1); // backoff retry
      }
      throw new Error(`Groq ${r.status} [${model}]: ${t.slice(0, 200)}`);
    }
    const j = await r.json();
    return (j.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    // network-level errors also get backoff retries
    if (attempt < 4) {
      await new Promise(res => setTimeout(res, 6000 * (attempt + 1)));
      return remediate(html, modelIdx, attempt + 1);
    }
    throw e;
  }
}

// ── Main ──
console.log(`C5 remediation — ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}`);
console.log('────────────────────────────────────────────');

// 1. Load posts (close DB before the long remediation phase — Neon drops idle conns)
let client = await connectDB();
const { rows } = await client.query("select id, slug, content from seo_pages where page_type='blog'");
const posts = rows.filter(r => r.content && hasStat(stripTags(r.content)));
console.log(`Posts with stat paragraphs: ${posts.length} / ${rows.length}\n`);
await client.end().catch(() => {});
client = null;

// 2. Collect unique stat paragraphs (by normalized full text)
const uniq = new Map(); // key -> { html, posts:[slug], count }
for (const p of posts) {
  for (const { html } of extractParas(p.content)) {
    if (!hasStat(stripTags(html))) continue;
    const k = normKey(stripTags(html));
    if (!uniq.has(k)) uniq.set(k, { html, posts: [], count: 0 });
    const e = uniq.get(k);
    e.posts.push(p.slug);
    e.count++;
    if (uniq.size > 1e5) break;
  }
}
const uniqueParas = [...uniq.values()];
console.log(`Unique stat paragraphs to remediate: ${uniqueParas.length}`);

const todo = uniqueParas.slice(0, LIMIT);
console.log(`  → processing ${todo.length} (limit=${LIMIT === Infinity ? '∞' : LIMIT})\n`);

// 3. Remediate each unique paragraph (or load from cache)
const rewrites = new Map(); // key -> newHtml
let ok = 0, fail = 0;

if (LOAD_CACHE) {
  const { existsSync, readFileSync } = await import('fs');
  if (!existsSync(CACHE)) {
    console.error(`❌ Cache not found: ${CACHE}. Run dry-run first.`);
    process.exit(1);
  }
  const cacheObj = JSON.parse(readFileSync(CACHE, 'utf-8'));
  for (const [k, v] of Object.entries(cacheObj)) rewrites.set(k, v);
  ok = rewrites.size;
  console.log(`Loaded ${ok} rewrites from cache: ${CACHE}\n`);
} else {
  // resume: preload any existing cache so re-runs skip already-done keys
  const { existsSync, readFileSync, writeFileSync } = await import('fs');
  if (existsSync(CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(CACHE, 'utf-8'));
      for (const [k, v] of Object.entries(cached)) rewrites.set(k, v);
      console.log(`  (resuming: ${rewrites.size} already cached)`);
    } catch (_) {}
  }
  const saveCache = () => writeFileSync(CACHE, JSON.stringify(Object.fromEntries(rewrites), null, 2));

  for (const [i, u] of todo.entries()) {
    const k = normKey(stripTags(u.html));
    if (rewrites.has(k)) continue; // already cached
    process.stdout.write(`  [${i + 1}/${todo.length}] ${u.count}×  ${stripTags(u.html).slice(0, 60)}… `);
    try {
      const out = await remediate(u.html, 0);
      const clean = out.replace(/^```html\s*|^```\s*|```$/gi, '').trim();
      if (!clean || clean === u.html) {
        // identical => no change needed
        process.stdout.write('(unchanged/unnecessary)\n');
      } else {
        rewrites.set(k, clean);
        process.stdout.write('→ rewritten\n');
        ok++;
      }
    } catch (e) {
      process.stdout.write(`\n     ⚠ ${e.message}\n`);
      fail++;
    }
    if ((i + 1) % 25 === 0) { saveCache(); process.stdout.write('  [cache saved]\n'); }
  }
  saveCache();
  console.log(`\nCache saved: ${CACHE} (${rewrites.size} rewrites)`);
}

console.log(`Rewrites ready: ${rewrites.size}, failures: ${fail}`);

// 4. Apply rewrites across all posts (in memory) & build diff
const changes = { slugs: 0, replacements: 0 };
const diffLines = [];
for (const p of rows) {
  if (!p.content) continue;
  let newContent = p.content;
  let matched = 0;
  for (const { html } of extractParas(p.content)) {
    const t = stripTags(html);
    if (!hasStat(t)) continue;
    const k = normKey(t);
    const repl = rewrites.get(k);
    if (!repl) continue;
    newContent = newContent.split(html).join(repl);
    matched++;
  }
  if (matched > 0) {
    changes.slugs++;
    changes.replacements += matched;
    diffLines.push(`### /blog/${p.slug}  (${matched} paragraph(s) changed)`);
    for (const { html } of extractParas(p.content)) {
      const t = stripTags(html);
      if (!hasStat(t)) continue;
      const k = normKey(t);
      const repl = rewrites.get(k);
      if (repl) {
        diffLines.push(`  BEFORE: ${t}`);
        diffLines.push(`  AFTER:  ${stripTags(repl)}`);
        diffLines.push('');
      }
    }
  }
}
console.log(`Posts affected: ${changes.slugs}, paragraph replacements: ${changes.replacements}`);

// 5. Write diff report
const report = `/tmp/c5-fix-diff${DRY_RUN ? '-dryrun' : '-apply'}-${Date.now()}.txt`;
import('fs').then(async ({ writeFileSync }) => {
  const body = diffLines.join('\n') || '(no changes)';
  writeFileSync(report, body);
  console.log(`\nReport: ${report}`);

  // 6. Persist if not dry-run (reopen DB — it was closed during remediation)
  const BACKUP = '/tmp/c5-original-backup.json';
  if (!DRY_RUN && changes.slugs > 0) {
    client = await connectDB();
    // safety backup: capture original contents of every affected row for reversibility
    const dirtySlugs = diffLines.filter(l => l.startsWith('### /blog/')).map(l => l.split(' ')[1].slice(1));
    const affected = rows.filter(p => dirtySlugs.includes(p.slug));
    const backupObj = { at: new Date().toISOString(), rows: affected.map(p => ({ id: p.id, slug: p.slug, content: p.content })) };
    const { writeFileSync } = await import('fs');
    writeFileSync(BACKUP, JSON.stringify(backupObj, null, 2));
    console.log(`💾 Backup of ${affected.length} rows → ${BACKUP}`);

    for (const p of rows) {
      if (!p.content) continue;
      let newContent = p.content;
      for (const { html } of extractParas(p.content)) {
        const t = stripTags(html);
        if (!hasStat(t)) continue;
        const repl = rewrites.get(normKey(t));
        if (repl) newContent = newContent.split(html).join(repl);
      }
      if (newContent !== p.content) {
        await client.query('update seo_pages set content=$1 where id=$2', [newContent, p.id]);
      }
    }
    await client.end().catch(() => {});
    console.log('✅ DB updated. To roll back: load $1 contents into seo_pages by id.', BACKUP);
  } else if (!DRY_RUN) {
    console.log('Nothing to write.');
  }

  process.exit(0);
});