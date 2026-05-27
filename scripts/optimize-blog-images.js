#!/usr/bin/env node
// Blog Image SEO Optimizer
// Converts hero/OG PNGs to WebP, adds responsive srcset, fixes dimensions and OG tags.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '..', 'public', 'blog');

const WEBP_SIZES = [400, 800, 1200]; // widths for hero WebP variants
const OG_WEBP_SIZE = 1200; // width for OG WebP (height auto-scaled)

let stats = { processed: 0, webpGenerated: 0, dimsFixed: 0, ogFixed: 0, skipped: 0, errors: [] };

async function main() {
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== '_TEMPLATE.html');
  console.log(`Found ${files.length} blog posts to process\n`);

  for (const file of files) {
    await processPost(file);
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${stats.processed}`);
  console.log(`WebP variants: ${stats.webpGenerated}`);
  console.log(`Dimensions fixed: ${stats.dimsFixed}`);
  console.log(`OG images fixed: ${stats.ogFixed}`);
  console.log(`Skipped: ${stats.skipped}`);
  if (stats.errors.length) {
    console.log(`Errors: ${stats.errors.length}`);
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }
}

async function processPost(filename) {
  const slug = filename.replace('.html', '');
  const filepath = join(BLOG_DIR, filename);
  let html = readFileSync(filepath, 'utf8');
  let changed = false;
  const postLog = [];

  // 1. Find the hero image
  const heroMatch = html.match(/<img[^>]*src="\/blog\/([^"]+-hero\.png)"[^>]*>/i);
  if (!heroMatch) {
    console.log(`  ${slug}: No hero image found — skipping`);
    stats.skipped++;
    return;
  }

  const heroFile = join(BLOG_DIR, heroMatch[1]);
  if (!existsSync(heroFile)) {
    console.log(`  ${slug}: Hero file ${heroMatch[1]} not found — skipping`);
    stats.skipped++;
    return;
  }

  // 2. Read actual image dimensions
  let width = 800, height = 400;
  try {
    const meta = await sharp(heroFile).metadata();
    width = meta.width || 800;
    height = meta.height || 400;
  } catch (e) {
    console.log(`  ${slug}: Could not read dimensions, using 800x400 default`);
  }

  // 3. Generate WebP variants
  const baseName = heroMatch[1].replace('-hero.png', '');
  for (const w of WEBP_SIZES) {
    const webpPath = join(BLOG_DIR, `${baseName}-hero-${w}w.webp`);
    if (!existsSync(webpPath)) {
      try {
        await sharp(heroFile)
          .resize(w, Math.round(w * (height / width)))
          .webp({ quality: 80 })
          .toFile(webpPath);
        stats.webpGenerated++;
      } catch (e) {
        stats.errors.push(`${slug}: WebP ${w}w failed — ${e.message}`);
      }
    }
  }

  // 4. Generate OG WebP
  const ogFile = join(BLOG_DIR, `${baseName}-og.png`);
  const ogWebp = join(BLOG_DIR, `${baseName}-og.webp`);
  if (existsSync(ogFile) && !existsSync(ogWebp)) {
    try {
      await sharp(ogFile)
        .resize(OG_WEBP_SIZE)
        .webp({ quality: 80 })
        .toFile(ogWebp);
      stats.webpGenerated++;
    } catch (e) {
      stats.errors.push(`${slug}: OG WebP failed — ${e.message}`);
    }
  }

  // 5. Replace <img> with <picture> if not already present
  if (!/<picture/i.test(html)) {
    const imgTag = heroMatch[0];
    const altMatch = imgTag.match(/alt="([^"]*)"/);
    const alt = altMatch ? altMatch[1] : slug.replace(/-/g, ' ');

    const pictureTag = `<picture>
      <source srcset="/blog/${baseName}-hero-${WEBP_SIZES[0]}w.webp ${WEBP_SIZES[0]}w,
                      /blog/${baseName}-hero-${WEBP_SIZES[1]}w.webp ${WEBP_SIZES[1]}w,
                      /blog/${baseName}-hero-${WEBP_SIZES[2]}w.webp ${WEBP_SIZES[2]}w"
              sizes="(max-width: 768px) 100vw, 800px"
              type="image/webp">
      <img src="/blog/${baseName}-hero.png" alt="${alt}" width="${width}" height="${height}"
           loading="eager" fetchpriority="high">
    </picture>`;

    html = html.replace(imgTag, pictureTag);
    changed = true;
    postLog.push('added <picture> element');
  }

  // 6. Fix missing/broken og:image
  const ogImageTag = html.match(/<meta property="og:image" content="[^"]*"/i);
  const twImageTag = html.match(/<meta name="twitter:image" content="[^"]*"/i);
  const expectedOg = `https://yt-seo-architect.vercel.app/blog/${baseName}-og.png`;

  if (!ogImageTag) {
    html = html.replace(
      /(<meta property="og:description"[^>]*>)/i,
      `$1\n  <meta property="og:image" content="${expectedOg}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />`
    );
    changed = true;
    stats.ogFixed++;
    postLog.push('injected missing og:image');
  } else if (!ogImageTag[0].includes(baseName)) {
    html = html.replace(ogImageTag[0], `<meta property="og:image" content="${expectedOg}"`);
    changed = true;
    stats.ogFixed++;
    postLog.push('fixed wrong og:image URL');
  }

  if (!twImageTag) {
    html = html.replace(
      /(<meta name="twitter:card"[^>]*>)/i,
      `$1\n  <meta name="twitter:image" content="${expectedOg}" />`
    );
    changed = true;
    stats.ogFixed++;
    postLog.push('injected missing twitter:image');
  }

  // 7. Write back if changed
  if (changed) {
    writeFileSync(filepath, html, 'utf8');
    console.log(`  ${slug}: ${postLog.join(', ')}`);
  } else {
    console.log(`  ${slug}: already optimized — skipped`);
    stats.skipped++;
    return;
  }

  stats.processed++;
}

main().catch(e => { console.error(e); process.exit(1); });
