#!/usr/bin/env node
/**
 * scripts/generate-glossary-categories.mjs
 *
 * Generates combinatorial category landing pages for the glossary.
 * Each category page is a rich index with:
 *   - Category overview + meta description
 *   - Term cluster groupings (e.g., "Beginner Terms", "Advanced Concepts")
 *   - Cross-category "Related categories" links
 *   - Schema.org CollectionPage markup
 *   - Internal links to blog posts in the same category
 *
 * Outputs to public/glossary/category/{slug}.html
 *
 * Usage:
 *   node scripts/generate-glossary-categories.mjs
 *   node scripts/generate-glossary-categories.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');
const OUTPUT_DIR = resolve(PROJECT, 'public/glossary/category');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

const DRY_RUN = process.argv.includes('--dry-run');

const CATEGORY_META = {
  'analytics': {
    name: 'Analytics',
    emoji: '📊',
    description: 'Understand your YouTube data with these analytics metrics and KPIs. Learn what each metric means, how to track it, and how to use the data to improve your content strategy and channel growth.',
    keywords: 'YouTube analytics metrics, video performance data, channel insights, audience analytics, content measurement',
  },
  'algorithm': {
    name: 'Algorithm',
    emoji: '🤖',
    description: 'How the YouTube algorithm works in 2026: ranking signals, recommendation systems, search ranking factors, and the strategies you need to work with the algorithm — not against it.',
    keywords: 'YouTube algorithm explained, ranking signals, recommendation system, video discovery, search ranking',
  },
  'seo-optimization': {
    name: 'SEO Optimization',
    emoji: '🔍',
    description: 'YouTube SEO strategies and techniques to rank higher in search results. From keyword research to title optimization, thumbnail design to transcript SEO — everything you need to get found.',
    keywords: 'YouTube SEO, video optimization, keyword research, title optimization, thumbnail tips, tag strategy',
  },
  'monetization': {
    name: 'Monetization',
    emoji: '💰',
    description: 'Make money on YouTube: ad revenue, channel memberships, Super Chat, affiliate marketing, sponsorships, and more. Understand YouTube Partner Program requirements and maximize your earnings per view.',
    keywords: 'YouTube monetization, ad revenue, channel memberships, Super Chat, affiliate marketing, sponsorships',
  },
  'content-strategy': {
    name: 'Content Strategy',
    emoji: '📝',
    description: 'Plan, create, and grow with a winning YouTube content strategy. Learn about content pillars, video formats, audience building, content calendars, and data-driven content planning.',
    keywords: 'YouTube content strategy, video planning, channel growth, content pillars, audience building',
  },
  'youtube-features': {
    name: 'YouTube Features',
    emoji: '⚙️',
    description: 'Master YouTube\'s built-in features — from end screens and cards to community posts, playlists, and live streaming. Use every tool the platform offers to grow your channel.',
    keywords: 'YouTube features guide, end screens, cards, playlists, community posts, live streaming tools',
  },
};

function loadData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function getCategoryEmoji(slug) {
  return CATEGORY_META[slug]?.emoji || '📖';
}

function getCategoryName(slug) {
  return CATEGORY_META[slug]?.name || slug;
}

// ── Cluster terms into beginner / intermediate / advanced ────

function clusterTerms(terms) {
  // Simple heuristic: shorter terms = broader = beginner-friendly
  const sorted = [...terms].sort((a, b) => a.term.length - b.term.length);
  const total = sorted.length;

  const clusters = {
    'Essential': sorted.slice(0, Math.max(3, Math.ceil(total * 0.25))),
    'Core Concepts': sorted.slice(Math.max(3, Math.ceil(total * 0.25)), Math.ceil(total * 0.65)),
    'Advanced Topics': sorted.slice(Math.ceil(total * 0.65)),
  };

  return clusters;
}

// ── Detect which blog posts relate to a category ─────────────

function getRelatedBlogsForCategory(categorySlug) {
  if (!existsSync(BLOG_DIR)) return [];

  const blogFiles = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
  const categoryKeywords = {
    'analytics': ['analytics', 'metric', 'data', 'track', 'measure', 'impression', 'ctr', 'retention', 'views', 'watch time'],
    'algorithm': ['algorithm', 'ranking', 'recommend', 'search', 'discovery', 'rank'],
    'seo-optimization': ['seo', 'optimize', 'keyword', 'title', 'thumbnail', 'tag', 'description', 'transcript'],
    'monetization': ['monetiz', 'revenue', 'earning', 'ad', 'sponsor', 'affiliate', 'membership', 'super chat'],
    'content-strategy': ['content', 'strategy', 'growth', 'planning', 'audience', 'niche', 'evergreen'],
    'youtube-features': ['shorts', 'live', 'community', 'playlist', 'end screen', 'card', 'feature'],
  };

  const keywords = categoryKeywords[categorySlug] || [];

  return blogFiles
    .map(f => {
      const slug = f.replace('.html', '');
      const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const lowerFile = f.toLowerCase();
      const score = keywords.filter(kw => lowerFile.includes(kw)).length;
      return { slug, title, score };
    })
    .filter(b => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ── Generate a single category page ──────────────────────────

function generateCategoryPage(categorySlug, termsInCategory, allTerms, totalTerms, allCategories) {
  const meta = CATEGORY_META[categorySlug] || { name: categorySlug, emoji: '📖', description: '', keywords: '' };
  const clusters = clusterTerms(termsInCategory);
  const relatedBlogs = getRelatedBlogsForCategory(categorySlug);

  // Term cards by cluster
  let bodyHTML = '';
  for (const [clusterName, clusterTerms] of Object.entries(clusters)) {
    if (clusterTerms.length === 0) continue;
    const cards = clusterTerms.map(t => `
      <div class="glossary-card">
        <a href="/glossary/${t.slug}"><h3>${t.term}</h3></a>
        <p>${t.shortDefinition.substring(0, 150)}...</p>
        ${t.relatedTerms && t.relatedTerms.length > 0
          ? `<div class="tag-group"><strong>Related:</strong> ${t.relatedTerms.slice(0, 3).map(s => {
              const rt = allTerms.find(t2 => t2.slug === s);
              return rt ? `<a href="/glossary/${rt.slug}" class="tag">${rt.term}</a>` : '';
            }).filter(Boolean).join(' ')}</div>`
          : ''}
      </div>`).join('');

    bodyHTML += `
    <section class="cluster">
      <h2 class="cluster-title">${clusterName} <span class="count">(${clusterTerms.length} terms)</span></h2>
      <div class="card-grid">
        ${cards}
      </div>
    </section>`;
  }

  // Related blogs section
  let blogSection = '';
  if (relatedBlogs.length > 0) {
    blogSection = `
    <section class="related-blogs">
      <h2>📝 Related Blog Posts</h2>
      <div class="blog-list">
        ${relatedBlogs.map(b => `<a href="/blog/${b.slug}" class="blog-link">📖 ${b.title}</a>`).join('\n        ')}
      </div>
    </section>`;
  }

  // Cross-category navigation
  const otherCategories = allCategories
    .filter(c => c !== categorySlug)
    .map(c => `<a href="/glossary/category/${c}" class="cross-cat">${getCategoryEmoji(c)} ${getCategoryName(c)}</a>`)
    .join('\n          ');

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/logo.svg" type="image/svg+xml" />
  <title>${meta.emoji} ${meta.name} — YouTube SEO Glossary Terms | YT SEO Architect</title>
  <meta name="description" content="${meta.description.substring(0, 160)}" />
  <meta name="keywords" content="${meta.keywords}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/glossary/category/${categorySlug}" />

  <meta property="og:title" content="${meta.name} — YouTube SEO Glossary" />
  <meta property="og:description" content="${meta.description.substring(0, 160)}" />
  <meta property="og:url" content="https://yt-seo-architect.vercel.app/glossary/category/${categorySlug}" />
  <meta property="og:type" content="website" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${meta.name} YouTube SEO Glossary",
    "description": "${meta.description.substring(0, 200)}",
    "url": "https://yt-seo-architect.vercel.app/glossary/category/${categorySlug}",
    "about": {
      "@type": "Thing",
      "name": "${meta.name}"
    }
  }
  </script>

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>
  
  <style>
    body{font-display:swap;font-family:'Outfit','Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e8f0}
    .hero{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:3rem 1.5rem;text-align:center;margin-bottom:2rem;border-radius:1rem}
    .hero h1{font-size:2rem;margin:0 0 .5rem;color:#fff}
    .hero p{color:#c4b5fd;max-width:600px;margin:0 auto}
    .hero .stat{margin-top:1rem;display:inline-block;background:rgba(99,102,241,.3);color:#a5b4fc;padding:.4rem 1.2rem;border-radius:9999px;font-size:.9rem}
    .cluster{margin-bottom:2.5rem}
    .cluster-title{font-size:1.3rem;color:#e0e7ff;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem}
    .cluster-title .count{font-size:.85rem;color:#8b8b9e;font-weight:400}
    .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
    .glossary-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:.75rem;padding:1.25rem;transition:all .2s}
    .glossary-card:hover{background:#312e81;transform:translateY(-2px);border-color:#6366f1}
    .glossary-card h3{color:#a5b4fc;margin:0 0 .5rem;font-size:1rem}
    .glossary-card p{color:#8b8b9e;font-size:.85rem;margin:0 0 .75rem;line-height:1.5}
    .tag-group{font-size:.8rem;color:#6b7280}
    .tag-group .tag{display:inline-block;background:rgba(99,102,241,.2);color:#a5b4fc;padding:.15rem .5rem;border-radius:9999px;margin-right:.25rem;font-size:.75rem;text-decoration:none;transition:all .2s}
    .tag-group .tag:hover{background:rgba(99,102,241,.5)}
    .cross-cats{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin-bottom:2rem}
    .cross-cat{background:#1e1b4b;color:#a5b4fc;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem;text-decoration:none;transition:all .2s}
    .cross-cat:hover{background:#312e81;color:#fff;transform:translateY(-1px)}
    .related-blogs h2{font-size:1.1rem;color:#e0e7ff;margin-bottom:1rem}
    .blog-list{display:flex;flex-wrap:wrap;gap:.75rem}
    .blog-link{display:inline-block;background:#1e1b4b;color:#a5b4fc;padding:.5rem 1rem;border-radius:.5rem;text-decoration:none;font-size:.85rem;transition:all .2s}
    .blog-link:hover{background:#312e81;color:#fff}
    .back-link{display:inline-block;margin-bottom:1.5rem;color:#8b8b9e;text-decoration:none;font-size:.9rem}
    .back-link:hover{color:#a5b4fc}
    .cta-box{border:1px solid #4f46e5;margin:2rem 0}
    @media(max-width:640px){.hero{padding:2rem 1rem}.hero h1{font-size:1.5rem}.card-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/glossary/" style="color:#a5b4fc">📖 Glossary</a>
    <a href="/tools/" class="cta">Free Tools</a>
  </header>

  <main>
    <a href="/glossary/" class="back-link">← Back to All Glossary Terms</a>

    <div class="hero">
      <h1>${meta.emoji} ${meta.name} Glossary</h1>
      <p>${meta.description}</p>
      <div class="stat">${termsInCategory.length} terms · ${Object.keys(clusters).length} clusters</div>
    </div>

    <nav class="cross-cats">
      ${otherCategories}
    </nav>

    ${bodyHTML}

    ${blogSection}

    <div class="cta-box" style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #6366f1;border-radius:12px;text-align:center;">
      <h3 style="color:#e2e8f0;margin:0 0 .5rem">🚀 Apply What You've Learned</h3>
      <p style="color:#94a3b8;margin:0 0 1rem">Use YT SEO Architect's free tools to optimize your YouTube content — titles, tags, descriptions, and more.</p>
      <a href="/tools/" style="display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.7rem 2rem;border-radius:9999px;text-decoration:none;font-weight:600">Try Free Tools →</a>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="/glossary/" style="color:#a5b4fc;font-size:.9rem">📖 Browse All ${totalTerms} Glossary Terms</a>
    </div>
  </main>

  <footer class="footer">
    <p>&copy; 2026 YT SEO Architect · <a href="/glossary/">Glossary</a> · <a href="/blog">Blog</a> · <a href="/tools/">Free Tools</a> · <a href="/privacy-policy">Privacy</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Generate category index page ─────────────────────────────

function generateCategoryIndex(allCategories, termCounts, totalTerms) {
  const cards = allCategories.map(cat => {
    const meta = CATEGORY_META[cat] || { name: cat, emoji: '📖', description: '' };
    return `
      <a href="/glossary/category/${cat}" class="cat-card">
        <div class="cat-emoji">${meta.emoji}</div>
        <h3>${meta.name}</h3>
        <p>${termCounts[cat] || 0} terms</p>
        <p class="desc">${meta.description.substring(0, 100)}...</p>
      </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Glossary Categories — YT SEO Architect</title>
  <meta name="description" content="Browse YouTube SEO glossary terms by category: Analytics, Algorithm, SEO Optimization, Monetization, Content Strategy, and YouTube Features." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/glossary/category/" />
  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>
  <style>
    body{font-family:'Outfit','Geist',sans-serif;background:#0a0a0f;color:#e2e8f0}
    .hero{text-align:center;padding:3rem 1rem}
    .hero h1{font-size:2rem;margin:0 0 .5rem}
    .hero p{color:#8b8b9e;max-width:500px;margin:0 auto}
    .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1.5rem;max-width:900px;margin:2rem auto;padding:0 1rem}
    .cat-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:1rem;padding:1.5rem;text-align:center;text-decoration:none;transition:all .2s;display:block}
    .cat-card:hover{background:#312e81;transform:translateY(-3px);border-color:#6366f1}
    .cat-emoji{font-size:2.5rem;margin-bottom:.5rem}
    .cat-card h3{color:#a5b4fc;margin:0 0 .25rem;font-size:1.1rem}
    .cat-card p{color:#8b8b9e;margin:0;font-size:.85rem}
    .cat-card .desc{font-size:.8rem;margin-top:.5rem}
  </style>
</head>
<body>
  <header class="header"><a href="/">⚡ YT SEO Architect</a></header>
  <main>
    <div class="hero">
      <h1>📖 Glossary Categories</h1>
      <p>${totalTerms} terms across 6 categories. Pick a category to dive in.</p>
    </div>
    <div class="cat-grid">${cards}</div>
  </main>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────

function main() {
  console.log('\n🗂️  Generating Glossary Category Pages...\n');

  if (!existsSync(DATA_FILE)) {
    console.error('❌ glossary-data.json not found');
    process.exit(1);
  }

  const data = loadData();
  const allTerms = data.terms;
  const allCategories = data.categories.map(c => c.slug).filter(c => CATEGORY_META[c]);
  const totalTerms = allTerms.length;

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;

  // Generate per-category pages
  for (const categorySlug of allCategories) {
    const termsInCategory = allTerms.filter(t => t.category === categorySlug);
    if (termsInCategory.length === 0) {
      console.log(`  ⏭ Skipping ${categorySlug} — no terms`);
      continue;
    }

    const html = generateCategoryPage(categorySlug, termsInCategory, allTerms, totalTerms, allCategories);
    const filePath = resolve(OUTPUT_DIR, `${categorySlug}.html`);

    if (!DRY_RUN) {
      writeFileSync(filePath, html);
    }

    console.log(`  ✅ ${categorySlug}.html  [${termsInCategory.length} terms, ${Object.keys({}).length} clusters]`);
    generated++;
  }

  // Generate category index page
  const termCounts = {};
  for (const cat of allCategories) {
    termCounts[cat] = allTerms.filter(t => t.category === cat).length;
  }
  const indexHTML = generateCategoryIndex(allCategories, termCounts, totalTerms);
  if (!DRY_RUN) {
    writeFileSync(resolve(OUTPUT_DIR, 'index.html'), indexHTML);
    writeFileSync(resolve(PROJECT, 'public/glossary/category.html'), indexHTML);
  }
  console.log(`  ✅ category/index.html  [Category Hub — ${allCategories.length} categories]`);

  console.log(`\n📊 Summary:`);
  console.log(`  Category pages: ${generated}`);
  console.log(`  Total terms indexed: ${totalTerms}`);
  console.log(`  Output: public/glossary/category/\n`);
}

main();
