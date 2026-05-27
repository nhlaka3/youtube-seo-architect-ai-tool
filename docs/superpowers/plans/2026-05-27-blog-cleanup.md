# Blog Cleanup & Programmatic SEO Purge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete 8 programmatically-generated trash blog posts from disk and database, shut down the programmatic SEO pipeline, and add automatic validation to prevent future low-quality posts from being indexed.

**Architecture:** The blog is served dynamically from the `seoPages` database table via `api/blog-renderer.js`. Static HTML files in `public/blog/` are legacy shadows. The real fix requires: (1) deleting DB records for trash posts, (2) deleting static shadows, (3) removing the PSEO generation pipeline, (4) fixing hardcoded related-post links in the renderer that point to trash URLs, and (5) adding a validation gate to the blog listing endpoint.

**Tech Stack:** Node.js, Express, Neon Postgres (Drizzle ORM), vanilla HTML

---

## Task 1: Delete Static Trash Files from `public/blog/`

**Files:**
- Delete: `public/blog/youtube-description-templates.html`
- Delete: `public/blog/how-to-write-youtube-titles.html`
- Delete: `public/blog/youtube-algorithm-changes-2026.html`
- Delete: `public/blog/youtube-keyword-research-tutorial.html`
- Delete: `public/blog/how-to-mass-update-youtube-descriptions-safely.html`
- Delete: `public/blog/youtube-shorts-seo-ranking-guide.html`
- Delete: `public/blog/youtube-tags-generator-vs-vidiq.html`
- Delete: `public/blog/youtube-seo-guide-2026.html`
- Delete: `public/blog/post.html`
- Delete: 16 associated `-hero.png` and `-og.png` images

- [ ] **Step 1: Delete trash HTML files**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
rm -f public/blog/youtube-description-templates.html
rm -f public/blog/how-to-write-youtube-titles.html
rm -f public/blog/youtube-algorithm-changes-2026.html
rm -f public/blog/youtube-keyword-research-tutorial.html
rm -f public/blog/how-to-mass-update-youtube-descriptions-safely.html
rm -f public/blog/youtube-shorts-seo-ranking-guide.html
rm -f public/blog/youtube-tags-generator-vs-vidiq.html
rm -f public/blog/youtube-seo-guide-2026.html
rm -f public/blog/post.html
```

- [ ] **Step 2: Delete associated image files**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
# Trash post images
rm -f public/blog/youtube-description-templates-hero.png public/blog/youtube-description-templates-og.png
rm -f public/blog/how-to-write-youtube-titles-hero.png public/blog/how-to-write-youtube-titles-og.png
rm -f public/blog/youtube-algorithm-changes-2026-hero.png public/blog/youtube-algorithm-changes-2026-og.png
rm -f public/blog/youtube-keyword-research-tutorial-hero.png public/blog/youtube-keyword-research-tutorial-og.png
rm -f public/blog/how-to-mass-update-youtube-descriptions-safely-hero.png public/blog/how-to-mass-update-youtube-descriptions-safely-og.png
rm -f public/blog/youtube-shorts-seo-ranking-guide-hero.png public/blog/youtube-shorts-seo-ranking-guide-og.png
rm -f public/blog/youtube-tags-generator-vs-vidiq-hero.png public/blog/youtube-tags-generator-vs-vidiq-og.png
rm -f public/blog/youtube-seo-guide-2026-hero.png public/blog/youtube-seo-guide-2026-og.png
```

- [ ] **Step 3: Verify deletions**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
echo "=== Remaining HTML files ===" && ls public/blog/*.html
echo "=== Remaining images ===" && ls public/blog/*.png
```

Expected: Only good posts remain (`best-youtube-seo-tools-2026.html`, `github-seo-backlinks-guide.html`, `how-to-fix-youtube-shadow-ban-2026.html`, `what-does-youtube-ctr-actually-mean.html`, `youtube-ai-seo-coach-phronesis-2026.html`, `youtube-analytics-explained-2026.html`, `youtube-analytics-4-metrics-that-matter.html`, `youtube-competitor-analysis-reverse-engineer.html`, `youtube-description-templates-2026.html`, `youtube-end-screens-cards-guide-2026.html`, `youtube-metadata-auditor-vs-vidiq-shadow-ban.html`, `youtube-retention-graph-explained-2026.html`, `youtube-seo-audit-diagnostic-fix-2026.html`, `youtube-thumbnail-ab-testing-guide.html`, `youtube-video-not-getting-views-diagnostic-fix-2026.html`, `_TEMPLATE.html`)

- [ ] **Step 4: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add public/blog/
git commit -m "chore: delete 8 trash blog posts + post.html + associated images"
```

---

## Task 2: Clean Static `blog.html` — Remove Trash Card Entries

**Files:**
- Modify: `blog.html`

- [ ] **Step 1: Remove 8 trash article cards from blog.html**

The following 8 article-card blocks must be removed from `blog.html`. Each is a complete `<div class="article-card">...</div>` block.

**Remove block 1** — `youtube-shorts-seo-ranking-guide`:

```html
    <div class="article-card">
      <span class="category">Shorts SEO</span>
      <h3><a href="/blog/youtube-shorts-seo-ranking-guide">YouTube Shorts SEO: How to Rank Shorts in 2026</a></h3>
      <p class="excerpt">Master YouTube Shorts SEO in 2026. Learn how to optimize metadata, perfect the first 3 seconds hook, beat the swiped-away metric, and gain more views on Shorts.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 5 min read &middot; 🏷️ Shorts, SEO, Algorithm, AVD</p>
    </div>
```

**Remove block 2** — `youtube-seo-guide-2026`:

```html
    <div class="article-card">
      <span class="category">SEO Guide</span>
      <h3><a href="/blog/youtube-seo-guide-2026">YouTube SEO Guide 2026: Rank #1 with AI-Powered Optimization</a></h3>

      <p class="excerpt">Learn how YouTube's algorithm works in 2026 and how AI tools can help you rank higher. Complete guide covering titles, tags, descriptions, thumbnails, and the new AI content era.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 12 min read &middot; 🏷️ SEO, Algorithm, AI</p>
    </div>
```

**Remove block 3** — `youtube-keyword-research-tutorial`:

```html
    <div class="article-card">
      <span class="category">Keyword Research</span>
      <h3><a href="/blog/youtube-keyword-research-tutorial">YouTube Keyword Research: The Complete Tutorial for 2026</a></h3>
      <p class="excerpt">Master YouTube keyword research with AI tools. Discover high-volume, low-competition keywords that actually drive views. Step-by-step tutorial with examples.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 10 min read &middot; 🏷️ Keywords, Research, AI</p>
    </div>
```

**Remove block 4** — `youtube-tags-generator-vs-vidiq`:

```html
    <div class="article-card">
      <span class="category">Tools</span>
      <h3><a href="/blog/youtube-tags-generator-vs-vidiq">YouTube Tags Generator: Free AI Tool vs vidIQ &amp; TubeBuddy</a></h3>
      <p class="excerpt">Compare the best YouTube tag generators in 2026. See how YT SEO Architect's free AI tag generator stacks up against vidIQ and TubeBuddy for tag optimization.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 8 min read &middot; 🏷️ Tools, Tags, Comparison</p>
    </div>
```

**Remove block 5** — `how-to-write-youtube-titles`:

```html
    <div class="article-card">
      <span class="category">Growth</span>
      <h3><a href="/blog/how-to-write-youtube-titles">How to Write YouTube Titles That Get Clicks (2026 Data)</a></h3>
      <p class="excerpt">Data-backed strategies for writing YouTube titles that maximize CTR. Learn the psychology behind click-worthy titles and use AI to generate optimized ones.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 9 min read &middot; 🏷️ Titles, CTR, Psychology</p>
    </div>
```

**Remove block 6** — `youtube-description-templates`:

```html
    <div class="article-card">
      <span class="category">Templates</span>
      <h3><a href="/blog/youtube-description-templates">YouTube Description Templates That Boost Views &amp; SEO</a></h3>
      <p class="excerpt">Copy-paste YouTube description templates optimized for SEO. Includes chapters, links, and keyword placement strategies that improve rankings.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 7 min read &middot; 🏷️ Descriptions, Templates</p>
    </div>
```

**Remove block 7** — `youtube-algorithm-changes-2026`:

```html
    <div class="article-card">
      <span class="category">Algorithm</span>
      <h3><a href="/blog/youtube-algorithm-changes-2026">YouTube Algorithm Changes in 2026: What Creators Need to Know</a></h3>
      <p class="excerpt">Stay ahead of YouTube's algorithm updates. Learn about the latest changes affecting video rankings, AI content detection, and what it means for your channel.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 11 min read &middot; 🏷️ Algorithm, Updates</p>
    </div>
```

**Remove block 8** — `how-to-mass-update-youtube-descriptions-safely`:

```html
    <div class="article-card">
      <span class="category">Bulk Updates</span>
      <h3><a href="/blog/how-to-mass-update-youtube-descriptions-safely">How to Mass Update YouTube Video Descriptions Safely (2026 Strategy)</a></h3>
      <p class="excerpt">Learn how to bulk edit YouTube video descriptions safely without losing rankings or triggering duplicate content spam filters. Step-by-step master guide.</p>
      <p class="meta">📅 May 2026 &middot; ⏱️ 12 min read &middot; 🏷️ Descriptions, Bulk Edit, Automation</p>
    </div>
```

Use the edit tool with 8 separate edits to remove all 8 blocks. Each `oldText` is one complete `<div class="article-card">...</div>` block, replaced with empty string.

- [ ] **Step 2: Verify blog.html**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep -c 'article-card' blog.html
```

Expected: 16 article cards (14 good posts + 2 CTA widgets that also use `.article-card`... actually let's count: blog.html has 22 cards + 2 CTA blocks inside `.articles`. After removing 8, should be 14 blog cards + 2 CTAs = 16 matching lines). The key check:

```bash
# Verify no trash slugs remain
grep -E 'youtube-shorts-seo-ranking-guide|youtube-seo-guide-2026|youtube-keyword-research-tutorial|youtube-tags-generator-vs-vidiq|how-to-write-youtube-titles|youtube-description-templates|youtube-algorithm-changes-2026|how-to-mass-update-youtube-descriptions-safely' blog.html
```

Expected: No output (no matches).

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add blog.html
git commit -m "chore: remove 8 trash blog post cards from blog.html index"
```

---

## Task 3: Clean Static `sitemap.xml` — Remove 6 Trash Blog URLs

**Files:**
- Modify: `sitemap.xml`

- [ ] **Step 1: Remove 6 trash blog `<url>` entries**

Remove these 6 lines from `sitemap.xml`:

```xml
  <url><loc>https://yt-seo-architect.vercel.app/blog/how-to-mass-update-youtube-descriptions-safely</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
  <url><loc>https://yt-seo-architect.vercel.app/blog/youtube-seo-guide-2026</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
  <url><loc>https://yt-seo-architect.vercel.app/blog/youtube-keyword-research-tutorial</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
  <url><loc>https://yt-seo-architect.vercel.app/blog/youtube-tags-generator-vs-vidiq</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
  <url><loc>https://yt-seo-architect.vercel.app/blog/how-to-write-youtube-titles</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
  <url><loc>https://yt-seo-architect.vercel.app/blog/youtube-description-templates</loc><lastmod>2026-05-19</lastmod><priority>0.7</priority></url>
```

- [ ] **Step 2: Verify sitemap.xml**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep '/blog/' sitemap.xml
```

Expected: Only good blog URLs remain (`best-youtube-seo-tools-2026`, `youtube-competitor-analysis-reverse-engineer`, `youtube-seo-audit-diagnostic-fix-2026`, `youtube-ai-seo-coach-phronesis-2026`, `youtube-description-templates-2026`).

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add sitemap.xml
git commit -m "chore: remove 6 trash blog URLs from static sitemap.xml"
```

---

## Task 4: Delete Trash Posts from Database (`seoPages` Table)

**Files:**
- Create: `scripts/cleanup-trash-db-posts.mjs` (one-time migration script)

The blog is dynamically served from the `seoPages` database table. Trash posts may have DB records. We need to find and delete them.

- [ ] **Step 1: Write the cleanup script**

Create `scripts/cleanup-trash-db-posts.mjs`:

```javascript
// One-time cleanup: delete 8 trash blog posts from seoPages table
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const TRASH_SLUGS = [
  'youtube-description-templates',
  'how-to-write-youtube-titles',
  'youtube-algorithm-changes-2026',
  'youtube-keyword-research-tutorial',
  'how-to-mass-update-youtube-descriptions-safely',
  'youtube-shorts-seo-ranking-guide',
  'youtube-tags-generator-vs-vidiq',
  'youtube-seo-guide-2026',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  
  // 1. Check what exists
  console.log('Checking for trash posts in seoPages...');
  for (const slug of TRASH_SLUGS) {
    const rows = await sql`SELECT id, slug, title, word_count, status FROM seo_pages WHERE slug = ${slug}`;
    if (rows.length > 0) {
      console.log(`  FOUND: ${slug} (id=${rows[0].id}, words=${rows[0].word_count})`);
    } else {
      console.log(`  NOT FOUND: ${slug} — already clean`);
    }
  }

  // 2. Delete them
  console.log('\nDeleting trash posts...');
  for (const slug of TRASH_SLUGS) {
    const result = await sql`DELETE FROM seo_pages WHERE slug = ${slug}`;
    console.log(`  Deleted ${slug}: ${result.count} rows`);
  }

  // 3. Verify
  console.log('\nVerifying cleanup...');
  const remaining = await sql`SELECT slug FROM seo_pages WHERE slug = ANY(${TRASH_SLUGS})`;
  if (remaining.length === 0) {
    console.log('✓ All trash posts deleted from database');
  } else {
    console.error('✗ Some posts remain:', remaining.map(r => r.slug));
  }
  
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the cleanup script**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node scripts/cleanup-trash-db-posts.mjs
```

Expected: Lists found posts, deletes them, confirms all 8 slugs are gone.

- [ ] **Step 3: Commit and delete the script**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add scripts/cleanup-trash-db-posts.mjs
git commit -m "chore: add one-time DB cleanup script for 8 trash blog posts"
rm scripts/cleanup-trash-db-posts.mjs
git add scripts/cleanup-trash-db-posts.mjs
git commit -m "chore: remove one-time DB cleanup script after execution"
```

---

## Task 5: Fix Hardcoded Related Posts Links in `blog-renderer.js`

**Files:**
- Modify: `api/blog-renderer.js`

The `generateRelatedPosts()` function hardcodes 5 links to trash posts. It must be updated to point to good posts only.

- [ ] **Step 1: Replace the `generateRelatedPosts` function**

Find the function in `api/blog-renderer.js` and replace the body with good post links:

Replace:
```javascript
function generateRelatedPosts(page) {
  // Core pillar posts always shown
  return `<nav class="related-posts" aria-label="Related articles" style="margin-top:3rem;padding-top:2rem;border-top:1px solid var(--border);">
    <h3 style="margin-bottom:1rem;color:var(--text);">📖 Related Articles</h3>
    <a href="/blog/youtube-seo-guide-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube SEO Guide 2026: Rank #1 With AI Tools</a>
    <a href="/blog/youtube-keyword-research-tutorial" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Keyword Research: Complete 2026 Tutorial</a>
    <a href="/blog/how-to-write-youtube-titles" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">How to Write YouTube Titles That Get Clicks in 2026</a>
    <a href="/blog/youtube-tags-generator-vs-vidiq" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Tags Generator: AI vs vidIQ vs TubeBuddy</a>
    <a href="/blog/youtube-description-templates" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Description Templates: Boost Views & SEO</a>
  </nav>`;
}
```

With:
```javascript
function generateRelatedPosts(page) {
  // Core pillar posts — validated, template-compliant, 1,500+ words
  return `<nav class="related-posts" aria-label="Related articles" style="margin-top:3rem;padding-top:2rem;border-top:1px solid var(--border);">
    <h3 style="margin-bottom:1rem;color:var(--text);">📖 Related Articles</h3>
    <a href="/blog/best-youtube-seo-tools-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">Best YouTube SEO Tools in 2026: Compared by Use Case</a>
    <a href="/blog/youtube-competitor-analysis-reverse-engineer" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Competitor Analysis: Reverse-Engineer Top Channels</a>
    <a href="/blog/youtube-analytics-explained-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Analytics Explained 2026: Read Your Data Like a Pro</a>
    <a href="/blog/youtube-seo-audit-diagnostic-fix-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube SEO Audit: The 5-Minute Diagnostic That Finds What's Killing Your Views</a>
    <a href="/blog/youtube-thumbnail-ab-testing-guide" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Thumbnail A/B Testing: Double Your CTR in 30 Days</a>
  </nav>`;
}
```

- [ ] **Step 2: Verify no remaining trash slugs in blog-renderer.js**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep -n 'youtube-seo-guide-2026\|youtube-keyword-research-tutorial\|how-to-write-youtube-titles\|youtube-tags-generator-vs-vidiq\|youtube-description-templates\b\|youtube-algorithm-changes-2026\|youtube-shorts-seo-ranking-guide\|how-to-mass-update' api/blog-renderer.js
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add api/blog-renderer.js
git commit -m "fix: replace trash related-post links with validated good posts in blog renderer"
```

---

## Task 6: Delete the Programmatic SEO Directory

**Files:**
- Delete: `api/programmatic-seo/` (entire directory)

- [ ] **Step 1: Delete the directory**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
rm -rf api/programmatic-seo/
```

- [ ] **Step 2: Verify**

```bash
ls api/programmatic-seo/ 2>&1
```

Expected: `ls: cannot access 'api/programmatic-seo/': No such file or directory`

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add api/programmatic-seo/
git commit -m "chore: delete entire programmatic-seo pipeline directory"
```

---

## Task 7: Edit `api/index.js` — Remove PSEO References

**Files:**
- Modify: `api/index.js`

- [ ] **Step 1: Remove PSEO import lines (currently lines 71-76)**

Remove:
```javascript
import { router as competitorRouter } from './programmatic-seo/competitor-analysis.js';
import { router as clusterRouter } from './programmatic-seo/keyword-clusters.js';
import { router as generatorRouter } from './programmatic-seo/generator.js';
import { router as indexingRouter } from './programmatic-seo/indexing.js';
import { router as longTailRouter } from './programmatic-seo/long-tail-engine.js';
import { router as contentPlansRouter } from './pseo/content-plans.js';
```

- [ ] **Step 2: Remove PSEO route mounts (currently lines 658-663)**

Remove:
```javascript
app.use('/api/pseo/competitors', requireAdmin, competitorRouter);
app.use('/api/pseo/clusters', requireAdmin, clusterRouter);
app.use('/api/pseo/generator', requireAdmin, generatorRouter);
app.use('/api/pseo/indexing', indexingRouter);
app.use('/api/pseo/long-tail', requireAdmin, longTailRouter);
app.use('/api/pseo/plans', requireAdmin, contentPlansRouter);
```

- [ ] **Step 3: Remove the auto-expand trigger in the keyword endpoint**

Find the block (currently around lines 778-783):
```javascript
    // Phase 11C — Auto-expand: create content opportunity for top keyword (non-blocking)
    if (top && top.keyword && top.keyword.length > 3) {
      import('./programmatic-seo/generator.js').then(m => {
        m.triggerAutoExpansion(top.keyword, niche).catch(e => console.error('PSEO Expansion Error:', e));
      });
    }
```

Replace with nothing (delete the entire block).

- [ ] **Step 4: Remove `/p` and `/p/:slug` routes**

Remove:
```javascript
app.get('/p', (req, res) => res.redirect('/blog'));
```

And remove:
```javascript
app.get('/p/:slug', (req, res) => res.redirect('/blog/' + req.params.slug));
```

- [ ] **Step 5: Remove `/api/pseo/auto-expand` endpoint**

Remove:
```javascript
app.post('/api/pseo/auto-expand', async (req, res) => {
  try {
    const { triggerAutoExpansion } = await import('./programmatic-seo/generator.js');
    const result = await triggerAutoExpansion(req.body?.keyword, req.body?.niche);
    res.json(result);
  } catch(e) { res.json({ created: false }); }
});
```

- [ ] **Step 6: Remove sitemap/robots PSEO redirects**

Remove:
```javascript
// Phase 11C — Canonical redirects for sitemap, robots, and tool routing
app.get('/sitemap.xml', (req, res) => res.redirect(301, '/api/pseo/indexing/sitemap.xml'));
app.get('/robots.txt', (req, res) => res.redirect('/api/pseo/indexing/robots.txt'));
```

And remove:
```javascript
// Legacy sitemap redirect (backward compat)
app.get('/sitemap-pseo.xml', (req, res) => res.redirect('/api/pseo/indexing/sitemap.xml'));
```

- [ ] **Step 7: Remove the "Bulk generate" comment line**

Remove:
```javascript
// Bulk generate moved to api/programmatic-seo/generator.js
```

- [ ] **Step 8: Verify no PSEO references remain**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep -n 'programmatic-seo\|/pseo/\|sitemap-pseo\|triggerAutoExpansion\|/p/\|/p:slug' api/index.js
```

Expected: No output.

- [ ] **Step 9: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add api/index.js
git commit -m "chore: remove all programmatic SEO references from api/index.js"
```

---

## Task 8: Edit `vercel.json` — Remove PSEO Routes

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Remove PSEO-related rewrites**

Remove these 3 lines from the `rewrites` array:
```json
    { "source": "/sitemap-pseo.xml", "destination": "/api/index.js" },
```

And:
```json
    { "source": "/p", "destination": "/api/index.js" },
    { "source": "/p/(.+)", "destination": "/api/index.js" },
```

- [ ] **Step 2: Verify vercel.json is valid JSON**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add vercel.json
git commit -m "chore: remove PSEO and /p/ routes from vercel.json rewrites"
```

---

## Task 9: Add Automatic Validation Gate

**Files:**
- Create: `api/blog-validation.js` (validation module)
- Modify: `api/index.js` (integrate validation into sitemap and blog listing endpoints)

This is the permanent safeguard — even if someone manually creates a bad post, it never reaches the sitemap or blog index.

- [ ] **Step 1: Create the validation module**

Create `api/blog-validation.js`:

```javascript
// api/blog-validation.js
// Automatic quality gate for blog posts.
// Posts that fail validation are silently excluded from sitemap and blog listing.

// Banned AI words — presence disqualifies the post
const BANNED_WORDS = /\b(excited|leverage|seamless|robust|embark|streamline|pivotal|cutting-edge)\b/i;

// Minimum word count to pass
const MIN_WORD_COUNT = 1200;

/**
 * Validate a blog post against _TEMPLATE.html quality standards.
 * @param {Object} post - A post object from the seoPages table or a file path
 * @param {string} post.slug - Post slug
 * @param {string} post.title - Post title
 * @param {string} post.content - Post HTML content
 * @param {number} post.wordCount - Pre-computed word count (if from DB)
 * @returns {{ valid: boolean, failures: string[] }}
 */
export function validateBlogPost(post) {
  const failures = [];
  const content = post.content || '';
  const wordCount = post.wordCount || countWords(content);

  // 1. Word count check (≥ 1200)
  if (wordCount < MIN_WORD_COUNT) {
    failures.push(`word count ${wordCount} < ${MIN_WORD_COUNT} minimum`);
  }

  // 2. Author box check
  if (!/class=["'][^"']*author-box[^"']*["']/i.test(content) &&
      !/class=["'][^"']*author-info[^"']*["']/i.test(content)) {
    failures.push('missing author box (E-E-A-T requirement)');
  }

  // 3. Breadcrumb check
  if (!/"BreadcrumbList"/i.test(content) &&
      !/class=["'][^"']*breadcrumb[^"']*["']/i.test(content)) {
    failures.push('missing breadcrumb navigation');
  }

  // 4. FAQ check — must have exactly 5 <details> elements
  const detailsCount = (content.match(/<\s*details[\s>]/gi) || []).length;
  if (detailsCount < 5) {
    failures.push(`only ${detailsCount} FAQ entries (need 5 minimum)`);
  }

  // 5. TL;DR block check
  if (!/class=["'][^"']*tldr[^"']*["']/i.test(content) &&
      !/Direct Answer/i.test(content)) {
    failures.push('missing TL;DR / Direct Answer block');
  }

  // 6. Banned words check
  const bannedMatch = content.match(BANNED_WORDS);
  if (bannedMatch) {
    failures.push(`contains banned word: "${bannedMatch[0]}"`);
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Count visible text words from HTML content.
 * Strips HTML tags, scripts, and style blocks.
 */
function countWords(html) {
  if (!html) return 0;
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).length : 0;
}
```

- [ ] **Step 2: Add validation to the sitemap endpoint in `api/index.js`**

The dynamic sitemap is currently served via redirect to `/api/pseo/indexing/sitemap.xml` (which we're removing in Task 7). We need to add a new `/sitemap.xml` endpoint directly in `api/index.js` that uses the validation gate.

Add this new endpoint after the existing route mounts (before the `/sitemap.xml` redirect that we're removing):

```javascript
// ── Sitemap (quality-gated) ──────────────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const { validateBlogPost } = await import('./blog-validation.js');

    const allPages = await dbService.db.select()
      .from(s.seoPages)
      .where(eq(s.seoPages.status, 'published'))
      .orderBy(desc(s.seoPages.publishedAt))
      .limit(500);

    // Quality gate: only include validated posts
    let indexedCount = 0;
    let totalCount = allPages.length;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<!-- Static core pages + validated blog posts. Validated: ${totalCount} candidates -->\n`;
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Core static pages (always included, not validated)
    const corePages = [
      { loc: '/', priority: '1.0' },
      { loc: '/dashboard', priority: '0.9' },
      { loc: '/blog', priority: '0.9' },
      { loc: '/pricing', priority: '0.8' },
      { loc: '/about', priority: '0.7' },
      { loc: '/changelog', priority: '0.6' },
    ];
    for (const p of corePages) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app${p.loc}</loc><priority>${p.priority}</priority></url>\n`;
    }

    // Validated blog posts only
    for (const page of allPages) {
      const validation = validateBlogPost({
        slug: page.slug,
        title: page.title,
        content: page.content,
        wordCount: page.wordCount,
      });

      if (!validation.valid) {
        continue; // silently skip
      }

      const date = page.publishedAt
        ? new Date(page.publishedAt).toISOString().split('T')[0]
        : '2026-05-27';
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/blog/${page.slug}</loc><lastmod>${date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
      indexedCount++;
    }

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e) {
    console.error('[Sitemap] Error:', e.message);
    res.status(500).send('Error generating sitemap');
  }
});
```

- [ ] **Step 3: Add validation to the `/blog` listing endpoint**

Modify the existing `/blog` endpoint to filter out invalid posts. The current endpoint (around line 810) selects all published posts and renders them. Add a validation filter:

After the line:
```javascript
var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt)).limit(50);
```

Add filtering. The simplest approach is to also fetch `content` and validate each post in the loop:

Change the select to include content:
```javascript
var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt)).limit(50);
```

And add validation before the render loop:
```javascript
const { validateBlogPost } = await import('./blog-validation.js');
pages = pages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);
```

Note: This needs to go BEFORE the `for (var p of pages)` loop that renders cards. The full edited block should be:

```javascript
app.get('/blog', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const { validateBlogPost } = await import('./blog-validation.js');
    var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt)).limit(50);
    
    // Quality gate: only list validated posts
    pages = pages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);
    
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>YouTube SEO Guides & Tips | YT SEO Architect</title><meta name="description" content="Free YouTube SEO guides, tips, and tutorials. Learn how to grow your channel with AI-powered tools."><link rel="stylesheet" href="/style.css"><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#0a0a0f;color:#eee;line-height:1.7}h1{color:#f97316}.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px;margin-bottom:10px}.card a{color:#f97316;text-decoration:none;font-weight:600;font-size:1.1rem}.card a:hover{text-decoration:underline}.card .meta{color:#888;font-size:.8rem;margin-top:4px}nav a{color:#f97316}</style></head><body><nav><a href="/">← YT SEO Architect</a></nav><h1>📚 YouTube SEO Guides</h1><p style="color:#888;">Free guides to help you grow your YouTube channel with AI-powered tools.</p>';
    // ... rest unchanged
```

The rest of the endpoint (the `for` loop and response) stays the same.

- [ ] **Step 4: Verify the new validation module works**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node -e "
const { validateBlogPost } = await import('./api/blog-validation.js');
// Test 1: A bad post (short, no author, no breadcrumb, no FAQ)
const bad = validateBlogPost({
  slug: 'test-bad',
  title: 'Test',
  content: '<p>Too short, no template features at all.</p>',
  wordCount: 10,
});
console.log('Bad post valid?', bad.valid, 'Failures:', bad.failures);
console.assert(bad.valid === false, 'Bad post should fail');

// Test 2: A good post (all template features)
const good = validateBlogPost({
  slug: 'test-good',
  title: 'Test Good Post',
  content: '<nav class=\"breadcrumb\">Home > Blog</nav><div class=\"tldr\"><h2>Direct Answer</h2></div><div class=\"author-box\"><div class=\"author-info\"><h4>Test</h4></div></div>' + '<p>lorem ipsum </p>'.repeat(600) + '<details><summary>Q1</summary><div class=\"faq-answer\"><p>A1</p></div></details>'.repeat(5),
  wordCount: 1200,
});
console.log('Good post valid?', good.valid, 'Failures:', good.failures);
console.assert(good.valid === true, 'Good post should pass');
console.log('All validation tests passed');
"
```

Expected: `Bad post valid? false`, `Good post valid? true`, `All validation tests passed`

- [ ] **Step 5: Commit**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git add api/blog-validation.js api/index.js
git commit -m "feat: add automatic blog post validation gate to sitemap and blog listing"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full sweep for remaining trash slugs**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep -rn 'youtube-description-templates\b\|how-to-write-youtube-titles\b\|youtube-algorithm-changes-2026\b\|youtube-keyword-research-tutorial\b\|how-to-mass-update-youtube-descriptions-safely\b\|youtube-shorts-seo-ranking-guide\b\|youtube-tags-generator-vs-vidiq\b\|youtube-seo-guide-2026\b' --include='*.html' --include='*.js' --include='*.json' --include='*.xml' --include='*.md' public/ api/ blog.html sitemap.xml vercel.json 2>/dev/null
```

Expected: No output (or only matches in backup files and spec/plan docs).

- [ ] **Step 2: Verify no PSEO references remain**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
grep -rn 'programmatic-seo' api/ --include='*.js' 2>/dev/null
```

Expected: No output.

- [ ] **Step 3: Verify the app still parses**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node --check api/index.js
```

Expected: No errors.

- [ ] **Step 4: Commit any remaining changes**

```bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
git status
git add -A
git commit -m "chore: final verification pass — no trash slugs or PSEO references remain"
```
