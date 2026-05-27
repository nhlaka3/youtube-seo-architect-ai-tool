# Blog Image SEO Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-optimize blog post images for SEO — PNG→WebP conversion, responsive srcset, fix missing dimensions, fix broken OG tags, and add second in-content images to 2 high-impact posts.

**Architecture:** A single Node.js script (`scripts/optimize-blog-images.js`) using Sharp processes all 15 blog posts. It reads existing PNG images, generates WebP variants at 3 responsive sizes, rewrites HTML with `<picture>` elements and correct metadata. Two posts get manually added second images using the existing Python hero generator.

**Tech Stack:** Node.js (Sharp for image processing), Python 3 (Pillow for diagram generation via existing `scripts/generate-blog-hero.py`)

---

## Task 1: Create the Image Optimization Script

**Files:**
- Create: `scripts/optimize-blog-images.js`

- [ ] **Step 1: Write the optimization script**

Create `scripts/optimize-blog-images.js`:

```javascript
#!/usr/bin/env node
// Blog Image SEO Optimizer
// Converts hero/OG PNGs to WebP, adds responsive srcset, fixes dimensions and OG tags.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
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

  // 6. Fix missing width/height attributes on hero img (inside picture or standalone)
  const imgInPicture = html.match(/<picture[^>]*>[\s\S]*?<img[^>]*>/i);
  if (imgInPicture) {
    const img = imgInPicture[0];
    let fixed = img;
    if (!/width="/i.test(fixed)) {
      fixed = fixed.replace('<img', `<img width="${width}" height="${height}"`);
      stats.dimsFixed++;
    }
    if (fixed !== img) {
      html = html.replace(imgInPicture[0], fixed);
      changed = true;
      postLog.push('fixed missing dimensions');
    }
  }

  // 7. Fix missing/broken og:image
  const ogImageTag = html.match(/<meta property="og:image" content="[^"]*"/i);
  const twImageTag = html.match(/<meta name="twitter:image" content="[^"]*"/i);
  const expectedOg = `https://yt-seo-architect.vercel.app/blog/${baseName}-og.png`;

  if (!ogImageTag) {
    // Inject og:image right after og:description
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

  // 8. Write back if changed
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
```

- [ ] **Step 2: Syntax-check the script**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node --check scripts/optimize-blog-images.js
```

Expected: No errors.

- [ ] **Step 3: Run the script**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node scripts/optimize-blog-images.js
```

Expected: Logs each post processed, WebP variants generated, dimensions/OG fixed. No errors.

- [ ] **Step 4: Verify 3 posts manually**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"

# Check best-youtube-seo-tools-2026
grep -c '<picture' public/blog/best-youtube-seo-tools-2026.html
grep -c 'srcset' public/blog/best-youtube-seo-tools-2026.html
grep 'og:image' public/blog/best-youtube-seo-tools-2026.html
ls -la public/blog/best-youtube-seo-tools-2026-hero-*.webp

# Check how-to-fix-youtube-shadow-ban-2026 (had missing og:image)
grep 'og:image' public/blog/how-to-fix-youtube-shadow-ban-2026.html

# Check youtube-seo-audit-diagnostic-fix-2026 (had wrong og:image URL)
grep 'og:image' public/blog/youtube-seo-audit-diagnostic-fix-2026.html
```

Expected:
- `best-youtube-seo-tools-2026`: 1 `<picture`, 1 `srcset`, correct og:image, 3 WebP files exist
- `how-to-fix-youtube-shadow-ban-2026`: og:image present
- `youtube-seo-audit-diagnostic-fix-2026`: og:image has correct slug

- [ ] **Step 5: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add scripts/optimize-blog-images.js public/blog/*.webp public/blog/*.html
git commit -m "feat: auto-optimize blog images — WebP, srcset, fix dimensions and OG tags"
```

---

## Task 2: Add Second Image to Competitor Analysis Post

**Files:**
- Create: `public/blog/youtube-competitor-analysis-reverse-engineer-diagram-hero.png` (via Python generator)
- Modify: `public/blog/youtube-competitor-analysis-reverse-engineer.html`

- [ ] **Step 1: Generate the diagram image**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
python3 scripts/generate-blog-hero.py \
  youtube-competitor-analysis-reverse-engineer-diagram \
  "Competitor Tag Extraction" \
  "Enter URL → Extract Tags → Build Infiltration Bundle" \
  "" \
  "DIAGRAM"
```

Expected: Creates `public/blog/youtube-competitor-analysis-reverse-engineer-diagram-hero.png` (800×400).

- [ ] **Step 2: Insert the image into the HTML**

Find a good insertion point in the implementation/steps section. Open the file and find the "Step-by-Step" or "How to" section H2. Insert this after the first step description `<div class="step"><p>...</p></div>`:

```html
      <figure style="margin:2rem 0;text-align:center;">
        <img 
          src="/blog/youtube-competitor-analysis-reverse-engineer-diagram-hero.png" 
          alt="Competitor tag extraction workflow — three steps from entering a competitor URL to building an infiltration bundle"
          width="800"
          height="400"
          loading="lazy"
          style="width:100%;height:auto;max-width:800px;border-radius:8px;border:1px solid var(--border);"
        />
        <figcaption style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem;">
          The three-step process: identify → extract → deploy
        </figcaption>
      </figure>
```

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add public/blog/youtube-competitor-analysis-reverse-engineer-diagram-hero.png public/blog/youtube-competitor-analysis-reverse-engineer.html
git commit -m "feat: add workflow diagram to competitor analysis blog post"
```

---

## Task 3: Add Second Image to Phronesis AI Coach Post

**Files:**
- Create: `public/blog/youtube-ai-seo-coach-phronesis-2026-diagram-hero.png` (via Python generator)
- Modify: `public/blog/youtube-ai-seo-coach-phronesis-2026.html`

- [ ] **Step 1: Generate the diagram image**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
python3 scripts/generate-blog-hero.py \
  youtube-ai-seo-coach-phronesis-2026-diagram \
  "Phronesis Dashboard" \
  "Goal Tracking + ETA Projections + Optimization Proposals" \
  "" \
  "DIAGRAM"
```

Expected: Creates `public/blog/youtube-ai-seo-coach-phronesis-2026-diagram-hero.png` (800×400).

- [ ] **Step 2: Insert the image into the HTML**

Find a good insertion point in the setup section. Insert after the setup description paragraph:

```html
      <figure style="margin:2rem 0;text-align:center;">
        <img 
          src="/blog/youtube-ai-seo-coach-phronesis-2026-diagram-hero.png" 
          alt="Phronesis AI dashboard showing goal tracking, subscriber growth ETA projection, and automated optimization proposals"
          width="800"
          height="400"
          loading="lazy"
          style="width:100%;height:auto;max-width:800px;border-radius:8px;border:1px solid var(--border);"
        />
        <figcaption style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem;">
          Phronesis tracks goals, projects ETAs, and generates optimization plans automatically
        </figcaption>
      </figure>
```

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add public/blog/youtube-ai-seo-coach-phronesis-2026-diagram-hero.png public/blog/youtube-ai-seo-coach-phronesis-2026.html
git commit -m "feat: add dashboard diagram to Phronesis AI coach blog post"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Verify all 15 posts have `<picture>` elements**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
for f in public/blog/*.html; do
  name=$(basename "$f" .html)
  [ "$name" = "_TEMPLATE" ] && continue
  has_picture=$(grep -c '<picture' "$f")
  has_srcset=$(grep -c 'srcset' "$f")
  has_dims=$(grep -c 'width="' "$f")
  has_og=$(grep -c 'og:image' "$f")
  echo "$name | picture=$has_picture | srcset=$has_srcset | dims=$has_dims | og=$has_og"
done
```

Expected: Every post has `picture=1 srcset=1 og>=1`.

- [ ] **Step 2: Verify WebP files exist for all posts**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
ls public/blog/*-400w.webp | wc -l
ls public/blog/*-800w.webp | wc -l
ls public/blog/*-1200w.webp | wc -l
ls public/blog/*-og.webp | wc -l
```

Expected: 15 each (one per blog post).

- [ ] **Step 3: Final commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add -A
git status
git commit -m "chore: final verification — all 15 posts have picture/srscset/og optimized"
```
