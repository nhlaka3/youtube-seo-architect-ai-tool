#!/usr/bin/env node
/**
 * scripts/publish-blog-post.mjs
 *
 * Manually publish a claude-blog (or any HTML) draft to YT SEO Architect's
 * database-backed blog — the same path the daily cron uses.
 *
 * Why this exists: the blog is DB-backed. /blog/:slug, the listing, category
 * pages, and the sitemap all read from the `seoPages` table; Vercel rewrites
 * send /blog/(.+) to api/index.js, so dropping an HTML file in public/blog/
 * does NOT make it live. This script:
 *
 *   1. Extracts the article <body> from the draft HTML
 *   2. Converts the FAQ (h2 FAQ + h3/p) into the template's <details> format
 *   3. Copies any local image/svg assets into public/blog/ and rewrites paths
 *   4. Wraps the body in renderBlogTemplate (adds author box, breadcrumb,
 *      FAQ details, dual JSON-LD — everything the hard gate requires)
 *   5. Runs the scored quality gate (validateBlogPost)
 *   6. Upserts into `seoPages` (safe to re-run — upserts on slug)
 *
 * Usage:
 *   node scripts/publish-blog-post.mjs --html <draft.html> --slug <slug> \
 *        --title "Post Title" [--description "Meta desc"] [--author "Patrick"] \
 *        [--status published|draft] [--min-score 70] [--dry-run] [--force]
 *
 *   --dry-run  preview score + rendered length without touching the DB
 *   --force    publish even if the scored gate blocks (logs a warning)
 *
 * Env: DATABASE_URL in .env (required to actually publish)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

// ── Minimal .env loader ────────────────────────────────────────────
// Reads .env, then .env.local, then .env.vercel (first-set-wins so real
// env vars / secrets always take precedence). Strips surrounding quotes.
function loadEnv() {
  for (const f of ['.env', '.env.local', '.env.vercel']) {
    const envPath = resolve(PROJECT, f);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue; // first-set-wins
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
loadEnv();

// ── Parse CLI args ─────────────────────────────────────────────────
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const has = (name) => process.argv.includes(name);

const htmlPath = arg('--html');
const slug = arg('--slug');
const title = arg('--title');
const description = arg('--description') || '';
const author = arg('--author') || 'Patrick';
const status = arg('--status') || 'published';
const minScore = Number(arg('--min-score') || process.env.BLOG_MIN_SCORE || 70);
const minVisuals = Number(arg('--min-visuals') || process.env.BLOG_MIN_VISUALS || 3);
const DRY_RUN = has('--dry-run');
const FORCE = has('--force');

if (!htmlPath || !slug || !title) {
  console.error('❌ Required: --html <path> --slug <slug> --title "Title"');
  console.error('   Optional: --description, --author, --status, --min-score, --dry-run, --force');
  process.exit(1);
}

// ── Load project modules ───────────────────────────────────────────
const { renderBlogTemplate } = await import('../api/blog-renderer.js');
const { validateBlogPost, countVisuals, analyzeVisuals, fixVisualAnimations } = await import('../api/blog-validation.js');

// ── HTML helpers ───────────────────────────────────────────────────

/** Extract the inner HTML of <body> and drop any inline <style> block. */
function extractBody(html) {
  let body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || html;
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
  return body.trim();
}

/**
 * Strip template-owned chrome from a claude-blog draft's body BEFORE saving.
 * The blog/:slug API wraps the stored body with renderBlogTemplate, which
 * GENERATES these sections itself — so any of them already present in the
 * draft body come out duplicated. Removing them lets the template render
 * exactly one of each. Only the article content (h2/p/table/figure/charts/
 * FAQ details/links) is kept.
 */
function stripTemplateChrome(html) {
  const chromeRe = /tldr|key-takeaways|cta-box|author-box|author-info|share-bar|related-posts|social-proof|reading-progress|featured-image|tool-cta|sticky-cta|disclosure|affiliate|adsense|gear\b|shop/i;
  let out = html;
  let removed = 0;
  let prev;
  do {
    prev = out;
    out = out.replace(/<div\b[^>]*class="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi, (full, cls) => {
      if (chromeRe.test(cls)) { removed++; return ''; }
      return full;
    });
  } while (prev !== out);
  return { html: out, removed };
}

/** Remove the first <h1>...</h1> — the template renders page.title as the H1. */
function stripH1(html) {
  return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '').trim();
}

/** Convert an FAQ section (h2 + h3/p pairs) into the template's <details> format. */
function convertFAQ(html) {
  // Only convert if there are no <details> already and a FAQ heading exists.
  if (/<details[\s>]/i.test(html)) return html;
  const faqMatch = html.match(/<h2[^>]*>[^<]*(Frequently Asked|FAQ)[^<]*<\/h2>/i);
  if (!faqMatch) return html;

  const startIdx = html.indexOf(faqMatch[0]);
  const section = html.slice(startIdx);
  // Find the h2 that ends the FAQ block (next h2 after the FAQ heading), else EOF.
  const rest = section.slice(faqMatch[0].length);
  const nextH2 = rest.search(/<h2[\s>]/i);
  const block = nextH2 === -1 ? section : section.slice(0, faqMatch[0].length + nextH2);

  const pairs = [...block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi)];
  if (pairs.length < 1) return html;

  const details = pairs
    .map(([, q, a]) => `<details><summary>${q.trim()}</summary><div class="faq-answer"><p>${a.trim()}</p></div></details>`)
    .join('\n');

  return html.replace(block, `${faqMatch[0]}\n${details}`);
}

/**
 * Copy local asset references (svg/png/webp) into public/blog/ and rewrite the
 * path to /blog/{asset}. Returns the updated HTML and the list of copied files.
 */
function copyAssets(html, assetBase) {
  let updated = html;
  const copied = [];
  const refs = [...updated.matchAll(/(?:<object[^>]*data=|src=)["']([^"']*\.(?:svg|png|webp|jpg|jpeg|avif))["']/gi)]
    .map((m) => m[1])
    // Local refs only: anything that isn't a protocol-relative URL, data: URI,
    // absolute URL, or hosted CDN path. Bare filenames like "chart.svg" count.
    .filter((p) => !/^(?:https?:)?\/\//i.test(p) && !/^data:/i.test(p) && !/^https?:/i.test(p));

  for (const ref of refs) {
    const srcPath = resolve(dirname(htmlPath), ref);
    if (!existsSync(srcPath)) {
      console.log(`  ⚠ asset not found, skipping: ${ref}`);
      continue;
    }
    const destName = `${assetBase}-${basename(srcPath)}`;
    const destPath = resolve(BLOG_DIR, destName);
    mkdirSync(BLOG_DIR, { recursive: true });
    copyFileSync(srcPath, destPath);
    updated = updated.split(ref).join(`/blog/${destName}`);
    copied.push(destName);
    console.log(`  📦 copied asset → public/blog/${destName}`);
  }
  return { html: updated, copied };
}

function countWords(html) {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

// ── Main ───────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════');
console.log('  📝 PUBLISH BLOG POST');
console.log('════════════════════════════════════════════\n');

const today = new Date().toISOString().split('T')[0];
const draftHtml = readFileSync(htmlPath, 'utf-8');

// 1. Extract + normalize body
let body = extractBody(draftHtml);
body = stripH1(body);
const chrome = stripTemplateChrome(body);
if (chrome.removed > 0) console.log(`  🧹 stripped ${chrome.removed} template-chrome block(s) from draft body`);
body = chrome.html;
body = convertFAQ(body);
const { html: bodyWithAssets } = copyAssets(body, slug);
body = bodyWithAssets;
const wordCount = countWords(body);
console.log(`  Body word count: ${wordCount}`);
console.log(`  Authored visuals (img/object/svg): ${countVisuals(body)}`);
console.log(`  FAQ details after conversion: ${(body.match(/<details[\s>]/gi) || []).length}`);

// Enforce the minimum-visuals requirement on the AUTHORED body (not the
// template-wrapped output, so template chrome can't satisfy it). Drafts short
// on visuals are auto-topped-up with branded inline-SVG charts.
let visuals = countVisuals(body);
if (visuals < minVisuals) {
  const { generatePostVisuals } = await import('./blog-visuals.mjs');
  const toAdd = generatePostVisuals({ slug, keyword: title }).slice(0, minVisuals - visuals);
  const firstH2 = body.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
  const pos = firstH2 ? firstH2.index + firstH2[0].length : body.length;
  body = body.slice(0, pos) + '\n' + toAdd.map(v => v.figure_html).join('\n') + '\n' + body.slice(pos);
  visuals = countVisuals(body);
  console.log(`  🎨 auto-injected ${toAdd.length} visual(s) → now ${visuals}`);
}
// AUTO-CORRECT (fix, don't just block): wrap any non-animated visual in an
// animated container so the post ships with all visuals animated.
const fixRes = fixVisualAnimations(body);
if (fixRes.fixed > 0) {
  body = fixRes.html;
  console.log(`  ✏️  auto-animated ${fixRes.fixed} visual(s):`);
  for (const r of fixRes.report) console.log('     - ' + r);
}
const { count: visualsFinal, unanimated } = analyzeVisuals(body);
visuals = visualsFinal;
if (visuals < minVisuals) {
  console.log(`\n  ❌ BLOCKED: only ${visuals} images/charts (need ${minVisuals} minimum).`);
  console.log('  Pass --min-visuals 0 to skip, or add more visuals.');
  console.log('  Nothing was saved.');
  process.exit(2);
}
if (unanimated.length) {
  console.log(`\n  ❌ BLOCKED: ${unanimated.length} visual(s) could not be auto-animated (${unanimated.map(u => `<${u.name}>`).join(', ')}).`);
  console.log('  Nothing was saved.');
  process.exit(2);
}

// 2. Wrap in the production template
const page = {
  slug,
  title,
  h1: title,
  metaDescription: description || title,
  content: body,
  wordCount,
  publishedAt: today,
  updatedAt: today,
};
console.log('  Wrapping in production template...');
const fullHTML = renderBlogTemplate(page);
console.log(`  Rendered: ${fullHTML.length.toLocaleString()} bytes`);

// 3. Scored quality gate (on what actually ships)
const validation = validateBlogPost({ ...page, content: fullHTML }, { minScore });
console.log(`\n  📊 Quality score: ${validation.score}/100 (grade ${validation.grade}, threshold ${validation.threshold})`);
for (const [cat, val] of Object.entries(validation.categoryScores)) {
  console.log(`      ${cat}: ${val}`);
}
if (validation.failures.length) {
  console.log('  Structural notes:');
  for (const f of validation.failures) console.log(`    - ${f}`);
}

if (!validation.passing && !FORCE) {
  console.log(`\n  ❌ BLOCKED by quality gate (${validation.score} < ${minScore}). Use --force to publish anyway, or lower --min-score.`);
  console.log('  Nothing was saved.');
  process.exit(2);
}
if (!validation.passing && FORCE) {
  console.log(`\n  ⚠ FORCED publish below threshold (${validation.score} < ${minScore}).`);
}

// 4. Dry run?
if (DRY_RUN) {
  console.log('\n  DRY RUN — would publish:');
  console.log(`  URL:      https://yt-seo-architect.vercel.app/blog/${slug}`);
  console.log(`  status:   ${status}`);
  console.log(`  DB save:  skipped (--dry-run)`);
  process.exit(0);
}

// 5. Upsert into DB.
// IMPORTANT: save the RAW article body, NOT fullHTML. The blog/:slug API serves
// posts by running renderBlogTemplate(page) again on the stored content, so
// wrapping here AND letting the API wrap = double header/nav (the bug we found).
// Storing the raw body + API wrapping once matches how the cron's posts work.
console.log('\n  Saving to database...');
try {
  const { default: dbService } = await import('../src/database/services.js');
  await dbService.saveSeoPage({
    slug,
    title,
    metaDescription: description || title,
    h1: title,
    content: body, // raw article body — the API wraps it with renderBlogTemplate
    wordCount,
    status,
    publishedAt: status === 'published' ? new Date() : null,
  });
  console.log('  ✅ Saved to database');
} catch (e) {
  console.error(`  ❌ DB save failed: ${e.message}`);
  console.error('  Check DATABASE_URL in .env');
  process.exit(1);
}

console.log('\n════════════════════════════════════════════');
console.log(`  ✅ LIVE: https://yt-seo-architect.vercel.app/blog/${slug}`);
console.log('════════════════════════════════════════════\n');
console.log('  Note: only static assets (hero images) need a commit + push to the');
console.log('  private repo to redeploy code; the post content itself is already live.');
