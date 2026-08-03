#!/usr/bin/env node
/**
 * scripts/generate-tools-index.mjs
 *
 * Generates public/tools/index.html — the tools hub page.
 * Scans all *.html files in public/tools/ and builds a searchable,
 * filterable index with categories, tool types, and live search.
 *
 * Usage:
 *   node scripts/generate-tools-index.mjs              # Generate index.html
 *   node scripts/generate-tools-index.mjs --dry-run    # Preview only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT = resolve(__dirname, '..');
const TOOLS_DIR = resolve(PROJECT, 'public/tools');
const SITE = 'https://yt-seo-architect.vercel.app';

// ── Tool type detection (mirrors generate-blog-tools.mjs) ─────

const TOOL_TYPE_MAP = {
  'title': { type: 'scorer', icon: '🎯', cat: 'Title & Hook', desc: 'Score and optimize your YouTube titles for CTR and SEO.' },
  'tag': { type: 'generator', icon: '🏷️', cat: 'Tags & Keywords', desc: 'Generate optimized tags for any video topic.' },
  'keyword': { type: 'research', icon: '🔍', cat: 'Tags & Keywords', desc: 'Research keywords with volume and competition data.' },
  'description': { type: 'writer', icon: '✍️', cat: 'Description', desc: 'Write SEO-optimized descriptions with timestamps.' },
  'thumbnail': { type: 'checker', icon: '🖼️', cat: 'Thumbnails', desc: 'Check thumbnail and metadata best practices.' },
  'analytics': { type: 'analyzer', icon: '📊', cat: 'Analytics', desc: 'Analyze channel performance and growth metrics.' },
  'retention': { type: 'calculator', icon: '📈', cat: 'Analytics', desc: 'Calculate and analyze audience retention metrics.' },
  'ctr': { type: 'calculator', icon: '📉', cat: 'Analytics', desc: 'Calculate click-through rate and get improvement tips.' },
  'impression': { type: 'tracker', icon: '👁️', cat: 'Analytics', desc: 'Track impressions and understand your reach.' },
  'seo': { type: 'auditor', icon: '🔎', cat: 'Audit & Diagnostic', desc: 'Complete metadata audit with prioritized fixes.' },
  'monetization': { type: 'checker', icon: '💰', cat: 'Growth', desc: 'Check monetization eligibility and requirements.' },
  'shadow-ban': { type: 'detector', icon: '👻', cat: 'Audit & Diagnostic', desc: 'Detect shadow bans and reach limitations.' },
  'hook': { type: 'scorer', icon: '🪝', cat: 'Title & Hook', desc: 'Score and improve your video hook and first 3 seconds.' },
  'playlist': { type: 'optimizer', icon: '📋', cat: 'Strategy', desc: 'Optimize playlist structure for watch time.' },
  'competitor': { type: 'analyzer', icon: '⚔️', cat: 'Growth', desc: 'Analyze competitor channels and reverse-engineer strategies.' },
  'end-screen': { type: 'checker', icon: '🔚', cat: 'Strategy', desc: 'Check end screen and cards placement.' },
  'chapter': { type: 'generator', icon: '📑', cat: 'Description', desc: 'Generate SEO-optimized chapter timestamps.' },
  'shorts': { type: 'optimizer', icon: '📱', cat: 'Shorts', desc: 'Optimize YouTube Shorts for search and reach.' },
  'community': { type: 'planner', icon: '👥', cat: 'Strategy', desc: 'Plan community posts and engagement strategies.' },
  'backlink': { type: 'finder', icon: '🔗', cat: 'Growth', desc: 'Find backlink and outreach opportunities.' },
  'video-not-getting-views': { type: 'detector', icon: '🔍', cat: 'Audit & Diagnostic', desc: 'Diagnose why your videos aren\'t getting views.' },
  'subscriber': { type: 'tracker', icon: '📈', cat: 'Growth', desc: 'Track and project your subscriber growth over time.' },
  'small': { type: 'checker', icon: '🔎', cat: 'Audit & Diagnostic', desc: 'Check your small channel for growth opportunities and fixes.' },
  'tutorial': { type: 'optimizer', icon: '📖', cat: 'Strategy', desc: 'Optimize your tutorial content for better search ranking.' },
  'idea': { type: 'planner', icon: '💡', cat: 'Strategy', desc: 'Generate video ideas tailored to your channel niche.' },
  'algorithm': { type: 'calculator', icon: '🧮', cat: 'Analytics', desc: 'Analyze how YouTube algorithm changes affect your channel.' },
};

const MANUAL_TOOLS = {
  'tag-generator': { title: 'YouTube Tag Generator', icon: '🏷️', cat: 'Tags & Keywords', desc: 'AI-powered tag generator with competition scores, search volume, and one-click copy. The most popular free tool on the platform.', type: 'generator', featured: true },
  'title-optimizer': { title: 'YouTube Title Optimizer', icon: '🎯', cat: 'Title & Hook', desc: 'Generate click-worthy titles with CTR scores and keyword analysis. Test different formats and find what works.', type: 'scorer', featured: true },
  'description-writer': { title: 'YouTube Description Writer', icon: '✍️', cat: 'Description', desc: 'Build SEO-optimized descriptions with timestamps, links, hashtags, and CTAs in seconds.', type: 'writer', featured: true },
  'best-youtube-seo-tools-2026': { title: 'Best YouTube SEO Tools 2026', icon: '🛠️', cat: 'Tools', desc: 'Curated comparison of the best YouTube SEO tools — free and paid. Find the right tools for your channel.', type: 'tool', featured: false },
};

const CATEGORY_ICONS = {
  'Tags & Keywords': '🏷️',
  'Title & Hook': '🎯',
  'Description': '📝',
  'Thumbnails': '🖼️',
  'Analytics': '📊',
  'Audit & Diagnostic': '🔍',
  'Growth': '📈',
  'Strategy': '📋',
  'Shorts': '📱',
  'Tools': '🛠️',
};

const CATEGORY_ORDER = ['Tags & Keywords', 'Title & Hook', 'Description', 'Thumbnails', 'Analytics', 'Audit & Diagnostic', 'Growth', 'Strategy', 'Shorts', 'Tools'];

// ── Tools that 301 to /blog/<slug> (cannibalization fix) ──
// These are article-shell tools sharing a slug with a blog post.
// The blog article is the canonical home; /tools/<slug> now 301s there,
// so they must NOT appear in the tools hub index.
const REDIRECTED_TOOLS = new Set([
  'best-youtube-growth-strategies-for-new-creators-2026',
  'best-youtube-seo-tools-2026',
  'creating-effective-youtube-thumbnails-for-clicks-2026',
  'developing-a-youtube-content-calendar-strategy-2026',
  'github-seo-backlinks-guide',
  'how-to-keywords-youtube',
  'how-to-metadata-youtube',
  'improving-youtube-engagement-with-live-streaming-2026',
  'increasing-youtube-watch-time-with-analytics-2026',
  'maximizing-youtube-revenue-with-sponsorships-2026',
  'understanding-youtube-algorithm-updates-for-creators-2026',
  'using-youtube-features-to-enhance-viewer-experience-2026',
  'youtube-algorithm-best-strategies-2026',
  'youtube-algorithm-changes-2026-impact-on-gaming-channels',
  'youtube-analytics-explained-2026',
  'youtube-channel-branding-tips-for-consistency-2026',
  'youtube-competitor-analysis-reverse-engineer',
  'youtube-content-strategy-for-beginners-2026',
  'youtube-description-templates-2026',
  'youtube-end-screens-cards-guide-2026',
  'youtube-for-small-channels-2026',
  'youtube-impressions-guide-2026',
  'youtube-monetization-2026',
  'youtube-playlist-optimization-strategy',
  'youtube-retention-graph-explained-2026',
  'youtube-seo-checklist-beginners-2026',
  'youtube-seo-examples-2026',
  'youtube-seo-optimization-for-gaming-channels-2026',
  'youtube-shorts-algorithm-2026',
  'youtube-shorts-seo-guide-2026',
  'youtube-subscriber-growth-2026',
  'youtube-tags-2026',
  'youtube-thumbnail-ab-testing-guide',
  'youtube-thumbnail-tips-2026',
  'youtube-title-examples-2026',
  'youtube-video-not-getting-views-diagnostic-fix-2026',
  'youtube-ai-seo-coach-phronesis-2026',
  'youtube-community-posts-strategy-2026',
  'youtube-metadata-auditor-vs-vidiq-shadow-ban',
  'youtube-shorts-seo-ranking-guide-2026',
  'youtube-analytics-4-metrics-that-matter',
  'youtube-seo-audit-diagnostic-fix-2026',
]);

// ── Discover tools ─────────────────────────────────────────

function discoverTools() {
  const files = readdirSync(TOOLS_DIR).filter(f => f.endsWith('.html') && f !== 'index.html' && f !== 'keyword-seed.js');
  const tools = [];

  for (const f of files) {
    const slug = f.replace('.html', '');
    if (REDIRECTED_TOOLS.has(slug)) continue; // 301s to /blog/<slug> — skip
    const html = readFileSync(resolve(TOOLS_DIR, f), 'utf-8');

    // Extract title from the HTML
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);

    let title = titleMatch ? titleMatch[1].replace(/ —.*$/, '').trim() : '';
    if (!title || title.includes('Free Interactive Tool')) {
      title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/ —.*$/, '').trim() : slug;
    }

    // Check if manual or auto-generated
    if (MANUAL_TOOLS[slug]) {
      const m = MANUAL_TOOLS[slug];
      tools.push({ slug, title: m.title, icon: m.icon, cat: m.cat, desc: m.desc, type: m.type, featured: m.featured, manual: true });
      continue;
    }

    // Auto-detect tool type and category
    let toolType = { type: 'tool', icon: '🛠️', cat: 'Tools', desc: 'Free YouTube SEO tool to optimize your content.' };
    for (const [key, val] of Object.entries(TOOL_TYPE_MAP)) {
      if (slug.includes(key)) {
        toolType = val;
        break;
      }
    }

    tools.push({
      slug, title, icon: toolType.icon, cat: toolType.cat,
      desc: toolType.desc, type: toolType.type, featured: false, manual: false
    });
  }

  // Sort: featured first, then by category order, then alphabetically
  tools.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const catA = CATEGORY_ORDER.indexOf(a.cat);
    const catB = CATEGORY_ORDER.indexOf(b.cat);
    if (catA !== catB) return (catA === -1 ? 999 : catA) - (catB === -1 ? 999 : catB);
    return a.title.localeCompare(b.title);
  });

  return tools;
}

// ── Generate HTML ──────────────────────────────────────────

function generateIndexHTML(tools) {
  const totalTools = tools.length;
  const categories = [...new Set(tools.map(t => t.cat))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const toolTypes = [...new Set(tools.map(t => t.type))].sort();

  const typeLabels = {
    scorer: 'Scorer', generator: 'Generator', research: 'Research', writer: 'Writer',
    checker: 'Checker', analyzer: 'Analyzer', calculator: 'Calculator', auditor: 'Auditor',
    detector: 'Detector', optimizer: 'Optimizer', planner: 'Planner', finder: 'Finder',
    tracker: 'Tracker', tool: 'Tool'
  };

  const toolsJSON = JSON.stringify(tools.map(t => ({
    s: t.slug, ti: t.title, i: t.icon, c: t.cat, d: t.desc, tp: t.type, f: t.featured, m: t.manual
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google-site-verification" content="google6368748a920a2add" />
  <title>${totalTools} Free YouTube SEO Tools — Interactive & AI-Powered 2026 | YT SEO Architect</title>
  <meta name="description" content="${totalTools} free interactive YouTube SEO tools: tag generator, title scorer, keyword research, description writer, SEO auditor, CTR calculator, shadow ban detector, content planner, and more. No login required, works offline." />
  <meta name="keywords" content="free youtube seo tools, youtube tag generator, youtube title optimizer, youtube description writer, youtube keyword research, youtube seo audit, youtube ctr calculator" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/tools/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}/tools/" />
  <meta property="og:title" content="${totalTools} Free YouTube SEO Tools — Interactive & AI-Powered 2026" />
  <meta property="og:description" content="${totalTools} free interactive YouTube SEO tools. Tag generator, title scorer, keyword research, SEO auditor, and more. Works offline, no login." />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:title" content="${totalTools} Free YouTube SEO Tools — Interactive & AI-Powered 2026" />
  <meta property="twitter:description" content="${totalTools} free interactive YouTube SEO tools. No login required." />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Free YouTube SEO Tools",
    "description": "${totalTools} AI-powered YouTube SEO tools for creators",
    "url": "${SITE}/tools/",
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": ${totalTools},
      "itemListElement": [
        ${tools.map((t, i) => `{ "@type": "ListItem", "position": ${i + 1}, "name": "${escJson(t.title)}" }`).join(',\\n        ')}
      ]
    }
  }
  </script>
  <style>
    :root { --bg: #0f0f1a; --surface: #1a1a2e; --surface2: #16162a; --border: #2a2a4a; --accent: #6366f1; --accent2: #06b6d4; --text: #e2e8f0; --text2: #94a3b8; --text3: #64748b; --success: #22c55e; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.6; min-height: 100vh; }
    .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .header-logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text); font-weight: 700; font-size: 1.25rem; }
    .header-logo img { height: 32px; width: 32px; }
    .header-cta { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; padding: 0.6rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: opacity .2s; }
    .header-cta:hover { opacity: .9; }
    .hero { text-align: center; padding: 3rem 2rem 2rem; max-width: 900px; margin: 0 auto; }
    .hero h1 { font-size: 2.25rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.75rem; background: linear-gradient(135deg, #fff, var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero .subtitle { color: var(--text2); font-size: 1.05rem; max-width: 600px; margin: 0 auto 1.5rem; }
    .hero-stats { display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap; }
    .hero-stat { text-align: center; padding: 1rem 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; min-width: 120px; }
    .hero-stat .num { font-size: 1.8rem; font-weight: 800; color: var(--accent); }
    .hero-stat .num.green { color: var(--success); }
    .hero-stat .num.cyan { color: var(--accent2); }
    .hero-stat .label { font-size: 0.75rem; color: var(--text3); text-transform: uppercase; letter-spacing: .5px; margin-top: .25rem; }
    .controls { max-width: 1000px; margin: 2rem auto 1rem; padding: 0 2rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .search-wrap { flex: 1; min-width: 200px; position: relative; }
    .search-wrap input { width: 100%; padding: .75rem 1rem .75rem 2.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 1rem; outline: none; transition: border-color .2s; }
    .search-wrap input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
    .search-wrap input::placeholder { color: var(--text3); }
    .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text3); font-size: 1.1rem; pointer-events: none; }
    .filter-btns { display: flex; gap: .5rem; flex-wrap: wrap; }
    .filter-btn { padding: .5rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text2); cursor: pointer; font-size: .82rem; font-weight: 500; transition: all .2s; white-space: nowrap; }
    .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
    .filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
    .filter-btn.active-all { background: linear-gradient(135deg, var(--accent), var(--accent2)); border-color: transparent; color: #fff; }
    .container { max-width: 1000px; margin: 0 auto; padding: 0 2rem 3rem; }
    .result-count { color: var(--text3); font-size: .85rem; margin-bottom: 1rem; padding: .5rem 0; }
    .result-count span { color: var(--accent); font-weight: 700; }
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; text-decoration: none; color: var(--text); transition: all .2s; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .tool-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(99,102,241,.05), rgba(6,182,212,.05)); opacity: 0; transition: opacity .2s; }
    .tool-card:hover { border-color: var(--accent); transform: translateY(-3px); box-shadow: 0 8px 30px rgba(99,102,241,.15); }
    .tool-card:hover::before { opacity: 1; }
    .tool-card .top { display: flex; align-items: flex-start; gap: .75rem; margin-bottom: .5rem; position: relative; z-index: 1; }
    .tool-card .icon { font-size: 2rem; flex-shrink: 0; }
    .tool-card .info { flex: 1; min-width: 0; }
    .tool-card h3 { font-size: 1rem; font-weight: 700; margin-bottom: .25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tool-card p { font-size: .82rem; color: var(--text2); line-height: 1.5; position: relative; z-index: 1; }
    .tool-card .badges { display: flex; gap: .4rem; margin-top: .6rem; flex-wrap: wrap; position: relative; z-index: 1; }
    .tool-card .badge { font-size: .68rem; padding: .15rem .5rem; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .tool-card .badge.free { background: rgba(34,197,94,.12); color: var(--success); }
    .tool-card .badge.interactive { background: rgba(99,102,241,.12); color: var(--accent); }
    .tool-card .badge.featured { background: rgba(245,158,11,.15); color: #f59e0b; }
    .tool-card .badge.type { background: rgba(6,182,212,.1); color: var(--accent2); }
    .no-results { text-align: center; padding: 3rem; color: var(--text3); display: none; }
    .no-results.visible { display: block; }
    .no-results .emoji { font-size: 3rem; margin-bottom: 1rem; }
    .no-results p { font-size: 1rem; }
    .category-label { font-size: 1.2rem; font-weight: 700; margin: 2rem 0 .75rem; padding-bottom: .5rem; border-bottom: 1px solid var(--border); color: var(--text); display: flex; align-items: center; gap: .5rem; }
    .category-label .cat-count { font-size: .8rem; color: var(--text3); font-weight: 400; }
    .footer { text-align: center; padding: 2rem; border-top: 1px solid var(--border); color: var(--text3); font-size: .85rem; }
    .footer a { color: var(--accent); text-decoration: none; margin: 0 .5rem; }
    @media (max-width: 600px) { .hero h1 { font-size: 1.5rem; } .tools-grid { grid-template-columns: 1fr; } .container { padding: 0 1rem; } .controls { flex-direction: column; align-items: stretch; } .filter-btns { justify-content: center; } }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="header-logo"><img src="/logo.svg" alt="YT SEO Architect" width="32" height="32" />YT SEO Architect</a>
    <a href="/dashboard" class="header-cta">🚀 Get Started Free</a>
  </header>

  <section class="hero">
    <div class="breadcrumb" style="color:var(--text3);font-size:.85rem;margin-bottom:1rem;">
      <a href="/" style="color:var(--accent);text-decoration:none;">Home</a> › <strong>Free Tools</strong>
    </div>
    <h1>${totalTools} Free YouTube SEO Tools</h1>
    <p class="subtitle">Interactive tools that actually work — no AI API calls, no login required. Score titles, generate tags, research keywords, audit channels, and more.</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="num">${totalTools}</div><div class="label">Free Tools</div></div>
      <div class="hero-stat"><div class="num green">✔</div><div class="label">Works Offline</div></div>
      <div class="hero-stat"><div class="num cyan">0</div><div class="label">Login Needed</div></div>
      <div class="hero-stat"><div class="num" style="font-size:1.2rem;">⚡ Instant</div><div class="label">No API Calls</div></div>
    </div>
  </section>

  <div class="controls">
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input type="text" id="searchInput" placeholder="Search tools by name, category, or keyword..." oninput="filterTools()" />
    </div>
    <div class="filter-btns">
      <button class="filter-btn active-all" id="filter-all" onclick="setFilter('all', this)">✨ All</button>
      ${toolTypes.map(t => `<button class="filter-btn" id="filter-${t}" onclick="setFilter('${t}', this)">${typeLabels[t] || t}</button>`).join('\\n      ')}
    </div>
  </div>

  <div class="container">
    <div class="result-count" id="resultCount">Showing <span>${totalTools}</span> tools</div>
    <div class="tools-grid" id="toolsGrid"></div>
    <div class="no-results" id="noResults">
      <div class="emoji">🔍</div>
      <p>No tools match your search. Try a different keyword or clear the filter.</p>
    </div>
  </div>

  <footer class="footer">
    <p><a href="/">Home</a> | <a href="/dashboard">Dashboard</a> | <a href="/blog">Blog</a> | <a href="/privacy-policy">Privacy</a> | <a href="/terms-of-service">Terms</a></p>
    <p style="margin-top:.5rem;">&copy; 2026 YT SEO Architect. ${totalTools} free YouTube SEO tools — built for creators, by creators.</p>
  </footer>

  <script>
    const TOOLS = ${toolsJSON};

    function renderTools(tools) {
      const grid = document.getElementById('toolsGrid');
      const noResults = document.getElementById('noResults');
      const countEl = document.getElementById('resultCount');

      if (tools.length === 0) {
        grid.innerHTML = '';
        noResults.classList.add('visible');
        countEl.innerHTML = 'Showing <span>0</span> tools';
        return;
      }
      noResults.classList.remove('visible');
      countEl.innerHTML = 'Showing <span>' + tools.length + '</span> ' + (tools.length === 1 ? 'tool' : 'tools');

      // Group by category
      const groups = {};
      tools.forEach(function(t) {
        if (!groups[t.c]) groups[t.c] = [];
        groups[t.c].push(t);
      });

      let html = '';
      var catOrder = ${JSON.stringify(CATEGORY_ORDER)};
      Object.keys(groups).sort(function(a, b) {
        var ai = catOrder.indexOf(a), bi = catOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }).forEach(function(cat) {
        html += '<div class="category-label">' + (${JSON.stringify(JSON.stringify(CATEGORY_ICONS))}[cat] || '📁') + ' ' + cat + ' <span class="cat-count">(' + groups[cat].length + ')</span></div>';
        html += '<div class="tools-grid">';
        groups[cat].forEach(function(t) {
          var badges = '';
          if (t.f) badges += '<span class="badge featured">⭐ Featured</span>';
          badges += '<span class="badge interactive">🖱️ Interactive</span>';
          if (t.m) badges += '<span class="badge free">🔓 Always Free</span>';
          badges += '<span class="badge type">' + (t.tp ? t.tp.charAt(0).toUpperCase() + t.tp.slice(1) : 'Tool') + '</span>';
          html += '<a href="/tools/' + t.s + '" class="tool-card">';
          html += '<div class="top"><div class="icon">' + t.i + '</div><div class="info"><h3>' + esc(t.ti) + '</h3></div></div>';
          html += '<p>' + esc(t.d) + '</p>';
          html += '<div class="badges">' + badges + '</div>';
          html += '</a>';
        });
        html += '</div>';
      });
      grid.innerHTML = html;
    }

    function filterTools() {
      var query = document.getElementById('searchInput').value.toLowerCase().trim();
      var activeFilter = document.querySelector('.filter-btn.active') || document.getElementById('filter-all');
      var typeFilter = activeFilter ? activeFilter.id.replace('filter-', '') : 'all';

      var filtered = TOOLS.filter(function(t) {
        var matchesSearch = !query ||
          t.ti.toLowerCase().includes(query) ||
          t.s.toLowerCase().includes(query) ||
          t.d.toLowerCase().includes(query) ||
          t.c.toLowerCase().includes(query) ||
          t.tp.toLowerCase().includes(query);
        var matchesType = typeFilter === 'all' || t.tp === typeFilter;
        return matchesSearch && matchesType;
      });

      renderTools(filtered);
    }

    function setFilter(type, btn) {
      document.querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      filterTools();
    }

    function esc(s) {
      return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Initial render
    renderTools(TOOLS);
  </script>
</body>
</html>`;
}

function escJson(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('═══════════════════════════════════════════════');
  console.log('  GENERATE TOOLS INDEX');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const tools = discoverTools();
  console.log(`  Discovered ${tools.length} tools`);
  console.log(`  Categories: ${[...new Set(tools.map(t => t.cat))].join(', ')}`);
  console.log('');

  const html = generateIndexHTML(tools);

  if (dryRun) {
    console.log(`  [DRY] Generated ${html.length} bytes`);
    console.log(`  [DRY] Would write to: ${TOOLS_DIR}/index.html`);
    console.log('');
    return;
  }

  writeFileSync(resolve(TOOLS_DIR, 'index.html'), html);
  console.log(`  ✅ Written ${html.length} bytes to index.html`);
  console.log(`  ✅ ${tools.length} tools indexed`);
  console.log('');
}

main();
