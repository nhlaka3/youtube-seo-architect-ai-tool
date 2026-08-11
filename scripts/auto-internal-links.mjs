#!/usr/bin/env node
/**
 * auto-internal-links.mjs — hub-and-spoke internal linking for blog posts.
 *
 * Task 1 of run-daily-backlink-automation.py (was referenced but missing).
 * For every post in public/blog/, finds related posts by shared keyword
 * tokens and injects a "Related Posts" hub section + in-body links to the
 * cluster hub page, so topic authority flows hub → spoke and spoke → hub
 * (ho.txt: systematic internal linking for pSEO).
 *
 * Safe to re-run: skips posts that already have a related-posts section
 * (idempotent). Deploy note: run BEFORE git commit so the links ship with
 * the post; the GH Actions daily publisher runs this via the automation
 * script's Task 1.
 *
 * Usage:
 *   node scripts/auto-internal-links.mjs            # live
 *   node scripts/auto-internal-links.mjs --dry-run  # report only
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const BLOG_DIR = resolve(ROOT, 'public/blog');

const HUB_PAGES = {
  'youtube-seo': '/blog/youtube-seo-examples-2026',
  'keyword': '/blog/how-to-keywords-youtube',
  'tag': '/blog/youtube-tags-2026',
  'description': '/blog/youtube-description-templates-2026',
  'thumbnail': '/blog/youtube-thumbnail-tips-2026',
  'retention': '/blog/youtube-retention-graph-explained-2026',
  'algorithm': '/blog/youtube-algorithm-changes-2026',
  'monetiz': '/blog/youtube-monetization-tips-2026',
  'shorts': '/blog/youtube-shorts-seo-guide-2026',
  'title': '/blog/youtube-title-examples-2026',
  'channel': '/blog/youtube-for-small-channels-2026',
  'analytics': '/blog/youtube-analytics-explained-2026',
};

// Stopwords for topic tokenization
const STOP = new Set(['youtube', 'the', 'and', 'for', 'with', 'your', 'you', 'how', 'what', 'why', '2026', '2025', 'guide', 'tips', 'best', 'seo', 'video', 'videos', 'channel', 'creators', 'creator', 'new', 'in', 'to', 'of', 'a', 'an', 'is', 'are', 'that', 'this', 'on', 'can', 'does', 'do', 'should', 'from', 'by', 'get', 'more', 'most', 'top', 'vs', 'use', 'using', 'make', 'making', 'grow', 'growth', 'strategy', 'strategies', 'complete', 'full', 'ultimate', 'checklist', 'explained', 'actually', 'matters', 'work', 'works', 'ranking', 'rank', 'boost', 'increase', 'improve']);

function tokens(slug) {
  return slug.split('-').filter(t => t.length > 2 && !STOP.has(t));
}

function relatedSlugs(target, all, max = 4) {
  const t = tokens(target);
  const scored = all
    .filter(s => s !== target && !s.endsWith('-hero') && !s.endsWith('-og') && !s.endsWith('-visual'))
    .map(s => {
      const sTok = tokens(s);
      const shared = sTok.filter(x => t.includes(x)).length;
      // bonus: same topic family prefix (e.g. youtube-tags vs youtube-tags-2026)
      const family = sTok.length >= 2 && t.length >= 2 && sTok[0] === t[0] && sTok[1] === t[1];
      return { s, score: shared * 2 + (family ? 3 : 0) };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map(x => x.s);
}

function findHub(slug) {
  const s = slug;
  for (const [key, url] of Object.entries(HUB_PAGES)) {
    if (s.includes(key)) return url;
  }
  return null;
}

function titleFromSlug(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function main() {
  const dry = process.argv.includes('--dry-run');
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
  const slugs = files.map(f => f.replace(/\.html$/, ''));
  let changed = 0, skipped = 0;

  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const path = resolve(BLOG_DIR, f);
    let html = readFileSync(path, 'utf-8');

    // Idempotency: already has related section
    if (/id="related-posts"|Related Posts|related-articles/.test(html)) {
      skipped++;
      continue;
    }

    const rel = relatedSlugs(slug, slugs);
    const hub = findHub(slug);
    let section = '';

    if (rel.length > 0) {
      const items = rel.map(r =>
        `<li><a href="/blog/${r}">${titleFromSlug(r)}</a></li>`).join('\n        ');
      section += `<section class="related-posts" id="related-posts" aria-label="Related articles">
      <h2>Related Posts</h2>
      <ul>
        ${items}
      </ul>
    </section>`;
    }
    if (hub && hub !== `/blog/${slug}`) {
      section += `<p class="cluster-hub-link"><a href="${hub}">← More ${titleFromSlug(slug).replace(/\b\w/g, c => c.toLowerCase())} guides</a></p>`;
    }
    if (!section) { skipped++; continue; }

    // Insert before </article> or before <footer, whichever comes first
    const insertAt = html.lastIndexOf('</article>');
    const anchor = insertAt > 0 ? insertAt : html.lastIndexOf('</main>');
    if (anchor < 0) { skipped++; continue; }

    html = html.slice(0, anchor) + section + '\n' + html.slice(anchor);
    if (!dry) writeFileSync(path, html);
    changed++;
    console.log(`  ${dry ? '[dry]' : '✅'} ${slug} → ${rel.length} related + ${hub ? 'hub' : 'no-hub'}`);
  }

  console.log(`\n${dry ? 'DRY RUN' : 'Done'}: ${changed} updated, ${skipped} skipped (already linked or no matches)`);
}

main();
