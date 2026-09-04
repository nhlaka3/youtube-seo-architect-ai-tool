#!/usr/bin/env node
/** Validate the assembled post HTML against the sitemap hard gate (blog-validation.js). */
import { readFileSync } from 'fs';
import { validateBlogPost } from '../api/blog-validation.js';

const html = readFileSync('public/blog/youtube-seo-tips-for-creators-in-2026.html', 'utf-8');
const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]?.trim() || html;

// Same extraction the DB publisher uses (count words from article content)
const text = article
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const wordCount = text ? text.split(/\s+/).length : 0;

const result = validateBlogPost({
  slug: 'youtube-seo-tips-for-creators-in-2026',
  title: 'YouTube SEO Tips for Creators in 2026: What Actually Moves Rankings',
  content: article,
  wordCount,
});

console.log('wordCount:', wordCount);
console.log('valid:', result.valid);
console.log('failures:', JSON.stringify(result.failures));
console.log('score:', result.score, '| grade:', result.grade, '| categories:', JSON.stringify(result.categoryScores));
process.exit(result.valid ? 0 : 1);