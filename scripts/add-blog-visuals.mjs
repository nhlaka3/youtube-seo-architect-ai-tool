#!/usr/bin/env node
/**
 * scripts/add-blog-visuals.mjs
 *
 * Generates branded charts for blog posts and injects them into the content
 * (DB + static file). Uses scripts/generate-blog-visuals.py (matplotlib,
 * Cyber-Luxe branding). Charts are matched to the post's sections by
 * keyword; posts without matching sections get a generic stat/bars combo.
 *
 * Usage:
 *   node scripts/add-blog-visuals.mjs <slug>          # one post (DB + file)
 *   node scripts/add-blog-visuals.mjs --all           # every post in public/blog
 *   node scripts/add-blog-visuals.mjs <slug> --dry-run
 *   node scripts/add-blog-visuals.mjs <slug> --no-db  # static file only
 *
 * Env: DATABASE_URL (from .env.local)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const VISUAL_SCRIPT = resolve(__dirname, 'generate-blog-visuals.py');

// matplotlib lives in the manim venv on this machine; fall back to python3
const PYTHON = existsSync(resolve(process.env.HOME || '~', '.venv/manim/bin/python'))
  ? resolve(process.env.HOME || '~', '.venv/manim/bin/python')
  : 'python3';

// chart kind → heading keywords to anchor the figure under
const ANCHOR_HEADINGS = {
  ctr: ['ctr', 'click', 'thumbnail', 'position', 'impression'],
  retention: ['retention', 'watch time', 'audience', 'hold', 'drop-off'],
  rpm: ['rpm', 'revenue', 'monetiz', 'sponsorship', 'earn', 'adsense'],
  funnel: ['funnel', 'subscriber', 'conversion', 'growth path'],
  traffic: ['traffic', 'impression', 'visibility', 'algorithm', 'suggested'],
  growth: ['upload', 'frequency', 'cadence', 'consistency', 'schedule'],
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    slug: args.find(a => !a.startsWith('--')),
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    staticOnly: args.includes('--static'),
  };
}

function findPython() {
  try {
    execSync(`"${PYTHON}" -c "import matplotlib"`, { stdio: 'pipe' });
    return PYTHON;
  } catch {
    try {
      execSync('python3 -c "import matplotlib"', { stdio: 'pipe' });
      return 'python3';
    } catch {
      console.error('❌ matplotlib not found in any interpreter. Install: ~/.venv/manim/bin/python -m pip install matplotlib');
      process.exit(1);
    }
  }
}

function generateVisuals(py, slug, htmlPath) {
  // _-prefix so batch/audit filters skip it; .html so slug parsing works
  const tmp = resolve(BLOG_DIR, `_visuals-${slug}.html`);
  writeFileSync(tmp, htmlPath);
  let stdout;
  try {
    stdout = execSync(
      `"${py}" "${VISUAL_SCRIPT}" "${tmp}" --auto --slug "${slug}" --out-dir "${BLOG_DIR}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
  } finally {
    rmSync(tmp, { force: true });
  }
  // python prints the JSON spec last (trailing log lines go to stderr)
  const start = stdout.indexOf('{');
  if (start === -1) return [];
  try {
    return JSON.parse(stdout.slice(start)).charts || [];
  } catch (e) {
    console.error(`  ⚠ Could not parse visual spec: ${e.message}`);
    return [];
  }
}

function inferAnchor(chart, content) {
  const needles = ANCHOR_HEADINGS[chart.type] || [];
  // Match <h2> with or without id attribute
  const h2s = [...content.matchAll(/<h2[^>]*>.*?<\/h2>/gi)];
  for (const m of h2s) {
    const text = m[0].replace(/<[^>]+>/g, '').toLowerCase();
    if (needles.some(n => text.includes(n))) return m.index + m[0].length;
  }
  // fallback: after the 2nd content H2 (skipping TL;DR / TOC)
  const bodyH2 = h2s.filter(m => {
    const t = m[0].replace(/<[^>]+>/g, '').toLowerCase();
    return !t.includes('tldr') && !t.includes('in this article') && !t.includes('takeaways') && !t.includes('faq');
  });
  if (bodyH2.length >= 2) return bodyH2[1].index + bodyH2[1][0].length;
  if (bodyH2.length >= 1) return bodyH2[0].index + bodyH2[0][0].length;
  return -1;
}

function injectFigure(content, chart) {
  if (content.includes(chart.file)) return content; // idempotent
  const anchor = inferAnchor(chart, content);
  if (anchor === -1) return content;
  return content.slice(0, anchor) + '\n' + chart.figure_html + '\n' + content.slice(anchor);
}

async function main() {
  const { slug, all, dryRun, staticOnly } = parseArgs();
  const py = findPython();
  console.log(`🎨 Blog Visual Injector (python: ${py})\n`);

  if (all) {
    const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_') && !f.startsWith('.'));
    for (const f of files) await processPost(f.replace('.html', ''), py, { dryRun, staticOnly });
    console.log('\n✅ Batch complete');
    return;
  }
  if (!slug) {
    console.error('❌ Usage: node scripts/add-blog-visuals.mjs <slug> [--all] [--dry-run] [--static]');
    process.exit(1);
  }
  await processPost(slug, py, { dryRun, staticOnly });
}

import { Pool } from 'pg';

async function processPost(slug, py, { dryRun, staticOnly }) {
  const filePath = resolve(BLOG_DIR, `${slug}.html`);
  const hasFile = existsSync(filePath);

  let content = null;
  if (staticOnly && !hasFile) {
    console.error(`  ❌ No static file for ${slug} (use DB mode without --static)`);
    return;
  }

  let pool = null;
  try {
    if (!staticOnly && !dryRun && process.env.DATABASE_URL) {
      pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 45000 });
    }
    if (hasFile) {
      content = readFileSync(filePath, 'utf-8');
    } else if (pool) {
      const { rows } = await pool.query('SELECT id, content FROM seo_pages WHERE slug = $1', [slug]);
      if (rows.length) content = rows[0].content;
    }
    if (!content) {
      console.error(`  ❌ No static file for ${slug}${pool ? ' and no DB row' : ' (and DB skipped)'}`);
      return;
    }

    const charts = generateVisuals(py, slug, content);
    if (!charts.length) {
      console.log(`  ℹ ${slug}: no matching chart types detected (${slug} sections don't hit the keyword rules)`);
      return;
    }

    let newContent = content;
    let added = 0;
    for (const chart of charts) {
      const after = injectFigure(newContent, chart);
      if (after !== newContent) { newContent = after; added++; }
    }
    console.log(`  📊 ${slug}: generated ${charts.length} visuals, injected ${added}`);

    if (dryRun) {
      console.log(`  (dry-run — not writing)`);
      return;
    }

    if (hasFile) writeFileSync(filePath, newContent);
    if (pool) {
      // Neon cold-starts ETIMEDOUT on first connects — retry with backoff
      const backoff = ms => new Promise(r => setTimeout(r, ms));
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await pool.query('UPDATE seo_pages SET content = $1 WHERE slug = $2', [newContent, slug]);
          console.log(`  ✅ DB updated + ${hasFile ? 'static file written' : 'static file n/a'}`);
          break;
        } catch (e) {
          if (attempt === 2) {
            console.error(`  ⚠ DB update failed after 3 attempts: ${e.message} — static file ${hasFile ? 'written (deploy to publish)' : 'n/a — changes not live!'}`);
          } else {
            await backoff(2000 * (attempt + 1));
          }
        }
      }
    }
  } catch (e) {
    console.error(`  ❌ ${slug}: ${e.message}`);
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });