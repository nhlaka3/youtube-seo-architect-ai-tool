#!/usr/bin/env node
/**
 * Check a blog post HTML file against the site's image/visual standard:
 *   1. motion-utilities.css link present (animations actually ship)
 *   2. >= 3 CONTENT visuals inside <article> (img / object / inline-SVG chart;
 *      share-bar & icon sprites are excluded)
 *   3. EVERY content visual is animated (.chart-entrance / .media-entrance /
 *      .motion-float(-slow) / .motion-lift / data-motion="zoom" on itself or
 *      its wrapper) — hover-only effects don't count
 *
 * AUTO-CORRECT: pass --fix and any visual that isn't animated gets wrapped in
 * an animated container (fixVisualAnimations in api/blog-validation.js), the
 * file is rewritten, and the check re-runs. The publish gates call this fix
 * first, so posts are corrected — not just blocked.
 *
 * Usage:
 *   node scripts/check-post-visuals.js public/blog/<slug>.html [--fix]
 * Exit 0 = compliant, 1 = violations (prints them).
 */
import { readFileSync, writeFileSync } from 'fs';
import { analyzeVisuals, fixVisualAnimations } from '../api/blog-validation.js';

const file = process.argv[2];
const doFix = process.argv.includes('--fix');
if (!file) {
  console.error('Usage: node scripts/check-post-visuals.js <path-to-html> [--fix]');
  process.exit(2);
}

let html = readFileSync(file, 'utf-8');
const problems = [];

if (!html.includes('motion-utilities.css')) {
  problems.push('missing motion-utilities.css link (visuals will not be animated)');
}

const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
if (!articleMatch) {
  problems.push('no <article> block found — visual standard cannot be verified');
} else {
  let article = articleMatch[1].trim();
  let { count, unanimated } = analyzeVisuals(article);

  if (doFix && unanimated.length) {
    const res = fixVisualAnimations(article);
    if (res.fixed > 0) {
      writeFileSync(file, html.replace(articleMatch[1], res.html));
      article = res.html;
      console.log(`✏️  Auto-corrected ${res.fixed} visual(s):`);
      for (const r of res.report) console.log('   - ' + r);
      ({ count, unanimated } = analyzeVisuals(article));
    }
  }

  if (count < 3) {
    problems.push(`only ${count} content visuals inside <article> (site standard: 3+ images/charts)`);
  } else {
    console.log(`Visuals: ${count} (standard met)`);
  }
  if (unanimated.length) {
    problems.push(`${unanimated.length} visual(s) NOT animated (need .chart-entrance/.media-entrance/.motion-* on self or wrapper):`);
    for (const u of unanimated) problems.push(`   - <${u.name}> ${u.tag.slice(0, 100)}`);
  } else if (count >= 3) {
    console.log('Animation: all visuals animated ✓');
  }
}

if (problems.length) {
  console.error('FAIL — image standard violations:');
  for (const p of problems) console.error('  ' + p);
  console.error('Fix: node scripts/check-post-visuals.js ' + file + ' --fix  (auto-wraps bare visuals)');
  process.exit(1);
}
console.log('OK — post meets the 3+ animated visuals standard.');
process.exit(0);
