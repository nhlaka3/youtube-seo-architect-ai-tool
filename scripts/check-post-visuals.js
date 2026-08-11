#!/usr/bin/env node
/**
 * Check a blog post HTML file against the site's image/visual standard:
 *   1. motion-utilities.css link present (visuals are animated)
 *   2. >= 3 visuals inside <article> (images, <object> embeds, inline <svg>)
 * Usage: node scripts/check-post-visuals.js public/blog/<slug>.html
 * Exit 0 = compliant, 1 = violations (prints them).
 */
import { readFileSync } from 'fs';
import { countVisuals } from '../api/blog-validation.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-post-visuals.js <path-to-html>');
  process.exit(2);
}

const html = readFileSync(file, 'utf-8');
const problems = [];

if (!html.includes('motion-utilities.css')) {
  problems.push('missing motion-utilities.css link (visuals will not be animated)');
}

const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]?.trim() || '';
if (!article) {
  problems.push('no <article> block found — visual count cannot be verified');
} else {
  const visuals = countVisuals(article);
  if (visuals < 3) {
    problems.push(`only ${visuals} visuals inside <article> (site standard: 3+ images/charts)`);
  } else {
    console.log(`Visuals: ${visuals} (standard met)`);
  }
}

if (problems.length) {
  console.error('FAIL — image standard violations:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('OK — post meets the 3+ visual / animated standard.');
process.exit(0);