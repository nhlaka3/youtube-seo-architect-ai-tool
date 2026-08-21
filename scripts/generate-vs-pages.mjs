#!/usr/bin/env node
/**
 * scripts/generate-vs-pages.mjs
 * Programmatic comparison page generator — Wise-inspired templated engine
 * Reads vs-data.js, outputs HTML pages to public/vs/ + index
 *
 * Usage:
 *   node scripts/generate-vs-pages.mjs              # Generate all pages
 *   node scripts/generate-vs-pages.mjs --id vidiq    # Single page
 *   node scripts/generate-vs-pages.mjs --index-only  # Just the hub index
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const VS_DIR = resolve(PROJECT, 'public/vs');

const args = process.argv.slice(2);
const SINGLE_ID = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const INDEX_ONLY = args.includes('--index-only');

// Lazy-load data
let tools;
try {
  const mod = await import('./vs-data.js');
  tools = mod.default;
} catch (e) {
  console.error('❌ Failed to load vs-data.js:', e.message);
  process.exit(1);
}

if (!existsSync(VS_DIR)) mkdirSync(VS_DIR, { recursive: true });

// ── Template ───────────────────────────────────────────────────────

function generatePage(tool) {
  const { name, url, pricing, tagline, features, verdict, bestFor, score, related } = tool;
  const slug = tool.id;
  const title = `YT SEO Architect vs ${name} (2026): Honest Comparison`;
  const desc = `Compare ${name} vs YT SEO Architect. ${tagline}. See feature comparison, pricing, and which tool is best for your channel.`;
  const h1 = `YT SEO Architect vs ${name}`;
  const h1Sub = `${name}: ${tagline}`;

  // Build feature rows
  const featureRows = features.map(f => {
    const usIcon = f.us ? '✅' : '❌';
    const themIcon = f.them ? '✅' : '❌';
    const note = f.note ? `<br><span class="note">${f.note}</span>` : '';
    return `<tr><td>${f.name}${note}</td><td class="col-us">${usIcon}</td><td class="col-them">${themIcon}</td></tr>`;
  }).join('\n    ');

  // Score bars
  const usPct = (score.us / 10) * 100;
  const themPct = (score.them / 10) * 100;
  const usWins = features.filter(f => f.us && !f.them).length;
  const themWins = features.filter(f => !f.us && f.them).length;
  const tied = features.filter(f => f.us && f.them).length;

  // Related links
  const relatedLinks = related.map(r => {
    const t = tools.find(t => t.id === r);
    return t ? `<a href="/vs/${r}" class="related-card"><strong>${t.name}</strong><span>${t.tagline}</span></a>` : '';
  }).join('\n      ');

  // FAQ structured data (featured snippet optimization)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Which is better, ${name} or YT SEO Architect?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: verdict.substring(0, 200)
        }
      },
      {
        '@type': 'Question',
        name: `Is ${name} free?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${name} pricing: ${pricing}. YT SEO Architect is completely free with unlimited access.`
        }
      },
      {
        '@type': 'Question',
        name: `Can I use ${name} and YT SEO Architect together?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Many creators use both. ${name} is good for ${tagline.toLowerCase()}. YT SEO Architect adds AI thumbnail scoring, A/B title testing, and channel audit tools.`
        }
      }
    ]
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/vs/${slug}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="https://yt-seo-architect.vercel.app/og-image.png">
  <meta name="twitter:card" content="summary_large_image">

  <!-- FAQ Schema (featured snippet) -->
  <script type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>
  <!-- Breadcrumb + Organization entity graph -->
  <script type="application/ld+json">${JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://yt-seo-architect.vercel.app/' },
        { '@type': 'ListItem', position: 2, name: 'Comparisons', item: 'https://yt-seo-architect.vercel.app/vs/' },
        { '@type': 'ListItem', position: 3, name: `YT SEO Architect vs ${name}`, item: `https://yt-seo-architect.vercel.app/vs/${slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://yt-seo-architect.vercel.app/#organization',
      name: 'YT SEO Architect',
      url: 'https://yt-seo-architect.vercel.app/',
      logo: { '@type': 'ImageObject', url: 'https://yt-seo-architect.vercel.app/logo.png' },
      sameAs: [
        'https://twitter.com/YTSEOArchitect',
        'https://linkedin.com/company/yt-seo-architect',
        'https://github.com/nhlaka3',
      ],
    },
  ], null, 2)}</script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .nav-bar .cta { background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.5rem 1.2rem; border-radius: 8px; }
    .hero { padding: 4rem 2rem 3rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.5rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero h1 .tool-name { color: #818cf8; }
    .hero p { color: #9ca3af; font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 960px; margin: 0 auto; padding: 0 2rem; }
    .verdict-box { background: linear-gradient(135deg, #064e3b, #065f46); border-radius: 16px; padding: 2rem; margin: 3rem auto; text-align: center; border: 1px solid rgba(52,211,153,0.2); max-width: 700px; }
    .verdict-box h2 { color: #34d399; font-size: 1.4rem; margin-bottom: 0.5rem; }
    .verdict-box p { color: #a7f3d0; font-size: 1rem; }
    .score-row { display: flex; gap: 2rem; justify-content: center; margin: 2rem 0; flex-wrap: wrap; }
    .score-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem 2rem; text-align: center; min-width: 200px; }
    .score-card .label { color: #9ca3af; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .score-card .value { font-size: 2.5rem; font-weight: 800; margin: 0.25rem 0; }
    .score-card.us .value { color: #34d399; }
    .score-card.them .value { color: #818cf8; }
    .score-bar-bg { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-top: 0.5rem; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
    .score-bar-fill.us { background: linear-gradient(90deg, #34d399, #06b6d4); }
    .score-bar-fill.them { background: linear-gradient(90deg, #818cf8, #6366f1); }
    .comparison-table { width: 100%; border-collapse: collapse; margin: 2rem 0; background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; }
    .comparison-table th, .comparison-table td { padding: 14px 18px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .comparison-table th { background: rgba(255,255,255,0.04); color: #f9fafb; font-weight: 600; font-size: 0.9rem; }
    .comparison-table th.col-us { color: #34d399; }
    .comparison-table th.col-them { color: #818cf8; }
    .comparison-table td.col-us { color: #34d399; text-align: center; font-size: 1.1rem; }
    .comparison-table td.col-them { color: #9ca3af; text-align: center; font-size: 1.1rem; }
    .comparison-table tr:hover { background: rgba(255,255,255,0.03); }
    .comparison-table .note { font-size: 0.8rem; color: #6b7280; display: block; }
    .counts { display: flex; gap: 1.5rem; justify-content: center; margin: 1.5rem 0; flex-wrap: wrap; }
    .count-badge { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 0.5rem 1.2rem; font-size: 0.9rem; }
    .count-badge.win-us { border-color: rgba(52,211,153,0.3); color: #34d399; }
    .count-badge.win-them { border-color: rgba(129,140,248,0.3); color: #818cf8; }
    .count-badge.tie { border-color: rgba(255,255,255,0.15); color: #9ca3af; }
    .cta-box { background: linear-gradient(135deg,rgba(99,102,241,0.1),rgba(6,182,212,0.05)); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; padding: 2.5rem; margin: 3rem 0; text-align: center; }
    .cta-box h3 { color: #f9fafb; font-size: 1.4rem; margin-bottom: 0.5rem; }
    .cta-box p { color: #9ca3af; margin-bottom: 1.25rem; max-width: 500px; margin-left: auto; margin-right: auto; }
    .cta-box a { display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.85rem 2.5rem; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 1.05rem; }
    .faq-section { margin: 3rem 0; }
    .faq-section h2 { color: #f9fafb; font-size: 1.5rem; margin-bottom: 1.5rem; }
    details { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; cursor: pointer; }
    details[open] { border-color: rgba(99,102,241,0.3); }
    summary { color: #e5e7eb; font-weight: 600; font-size: 1rem; }
    .faq-answer { padding-top: 0.75rem; color: #9ca3af; font-size: 0.95rem; }
    .related-section { margin: 3rem 0; }
    .related-section h2 { color: #f9fafb; font-size: 1.3rem; margin-bottom: 1rem; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .related-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; text-decoration: none; color: #e5e7eb; }
    .related-card strong { display: block; color: #f9fafb; }
    .related-card span { font-size: 0.85rem; color: #6b7280; }
    .related-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
    @media(max-width:640px) { .hero h1 { font-size: 1.6rem; } .comparison-table th, .comparison-table td { padding: 10px 12px; font-size: 0.8rem; } .score-card { min-width: 140px; padding: 1rem; } }
  </style>
<script defer src="/ga.js"></script></head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="/vs" class="cta">All Comparisons →</a>
  </nav>

  <div class="hero">
    <h1>YT SEO Architect vs <span class="tool-name">${name}</span></h1>
    <p>${tagline}. Honest feature comparison — see where each tool excels.</p>
  </div>

  <div class="container">

    <!-- Featured Snippet Answer (H1 + inline) -->
    <div class="verdict-box" id="verdict">
      <h2>🏆 Winner: YT SEO Architect</h2>
      <p>${verdict}</p>
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:0.9rem;margin-top:1rem;"><strong>Quick answer:</strong> YT SEO Architect wins on ${usWins} features (${name} leads on ${themWins}, ${tied} tied). See full breakdown below.</p>

    <!-- Score Cards -->
    <div class="score-row">
      <div class="score-card us">
        <div class="label">YT SEO Architect</div>
        <div class="value">${score.us}/10</div>
        <div class="score-bar-bg"><div class="score-bar-fill us" style="width:${usPct}%"></div></div>
      </div>
      <div class="score-card them">
        <div class="label">${name}</div>
        <div class="value">${score.them}/10</div>
        <div class="score-bar-bg"><div class="score-bar-fill them" style="width:${themPct}%"></div></div>
      </div>
    </div>

    <!-- Count Badges -->
    <div class="counts">
      <span class="count-badge win-us">✅ YT SEO Architect: ${usWins} features</span>
      <span class="count-badge win-them">✅ ${name}: ${themWins} features</span>
      <span class="count-badge tie">🤝 Tied: ${tied} features</span>
    </div>

    <!-- Feature Comparison Table (featured snippet: table format) -->
    <h2 style="margin:2rem 0 1rem;font-size:1.4rem;color:#f9fafb">Feature Comparison</h2>
    <table class="comparison-table">
      <thead><tr><th>Feature</th><th class="col-us">YT SEO Architect</th><th class="col-them">${name}</th></tr></thead>
      <tbody>
    ${featureRows}
      </tbody>
    </table>

    <!-- Best For -->
    <div class="cta-box">
      <h3>🎯 Best For</h3>
      <p>${bestFor}</p>
      <a href="/dashboard">Try YT SEO Architect Free →</a>
    </div>

    <!-- FAQ (featured snippet: expand/collapse) -->
    <div class="faq-section" id="faq">
      <h2>❓ Frequently Asked Questions</h2>
      <details>
        <summary>Which is better, ${name} or YT SEO Architect?</summary>
        <div class="faq-answer"><p>${verdict}</p></div>
      </details>
      <details>
        <summary>Is ${name} free?</summary>
        <div class="faq-answer"><p>${name} pricing: ${pricing}. YT SEO Architect is completely free with unlimited access to all tools — no credit card required.</p></div>
      </details>
      <details>
        <summary>Can I use both ${name} and YT SEO Architect together?</summary>
        <div class="faq-answer"><p>Yes, many creators use both. ${name} excels at ${tagline.toLowerCase()}. YT SEO Architect adds AI thumbnail scoring, title A/B testing, channel audits, and keyword tools — all free. They complement each other.</p></div>
      </details>
      <details>
        <summary>What does YT SEO Architect do that ${name} doesn't?</summary>
        <div class="faq-answer"><p>YT SEO Architect offers AI thumbnail click prediction scoring, title A/B testing, and a 17-point channel metadata audit — features ${name} doesn't provide. All completely free.</p></div>
      </details>
    </div>

    <!-- Related Comparisons (hub-and-spoke internal linking) -->
    <div class="related-section">
      <h2>🔗 More Comparisons</h2>
      <div class="related-grid">
        ${relatedLinks}
        <a href="/vs" class="related-card"><strong>Browse All</strong><span>See all tool comparisons</span></a>
      </div>
    </div>

  </div>

  <footer>
    <p>© 2026 YT SEO Architect · <a href="/vs">All Comparisons</a> · <a href="/blog">Blog</a> · <a href="/glossary/">Glossary</a> · <a href="/dashboard">Dashboard</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Index page ─────────────────────────────────────────────────────

function generateIndex() {
  const cards = tools.map(t => {
    const usWins = t.features.filter(f => f.us && !f.them).length;
    return `<a href="/vs/${t.id}" class="index-card">
      <div class="card-header">
        <strong>vs ${t.name}</strong>
        <span class="badge win-us">+${usWins} features</span>
      </div>
      <div class="card-body">${t.tagline}</div>
      <div class="card-footer">${t.pricing} · Score: ${t.score.us}/10</div>
    </a>`;
  }).join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YT SEO Architect vs Competitors (2026): All Comparisons</title>
  <meta name="description" content="Honest comparisons of YT SEO Architect vs vidIQ, TubeBuddy, Canva, Morningfame, Tubics, Keyword Tool and more. See feature breakdowns, scores, and verdicts.">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/vs">
  <meta property="og:title" content="YT SEO Architect vs Competitors (2026): All Comparisons">
  <meta property="og:description" content="Honest comparisons of YT SEO Architect vs popular YouTube tools.">
  <meta property="og:type" content="website">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .hero { padding: 4rem 2rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.5rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero p { color: #9ca3af; font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    .index-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .index-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; transition: border-color 0.2s; }
    .index-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .card-header strong { font-size: 1.1rem; color: #f9fafb; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 10px; }
    .badge.win-us { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
    .card-body { color: #9ca3af; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .card-footer { color: #6b7280; font-size: 0.8rem; }
    .intro-text { max-width: 700px; margin: 0 auto 2rem; text-align: center; color: #9ca3af; font-size: 0.95rem; line-height: 1.8; }
    .intro-text strong { color: #e5e7eb; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
    @media(max-width:640px) { .hero h1 { font-size: 1.6rem; } .index-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="/dashboard" class="cta" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:0.5rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;">Try Free →</a>
  </nav>

  <div class="hero">
    <h1>📊 All Comparisons</h1>
    <p>Honest side-by-side comparisons — YT SEO Architect vs popular YouTube tools</p>
  </div>

  <div class="container">
    <div class="intro-text">
      <p>Every comparison is <strong>independently researched</strong> and updated for 2026. We score features, compare pricing, and tell you which tool wins — and when to use both together. <strong>No affiliate bias.</strong> If a competitor is better at something, we say so.</p>
    </div>

    <div class="index-grid">
      ${cards}
    </div>
  </div>

  <footer>
    <p>© 2026 YT SEO Architect · <a href="/blog">Blog</a> · <a href="/glossary/">Glossary</a> · <a href="/dashboard">Dashboard</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VS PAGE GENERATOR — Wise-style Templated Engine');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  if (INDEX_ONLY) {
    const html = generateIndex();
    writeFileSync(resolve(VS_DIR, 'index.html'), html);
    console.log(`  ✅ Index page: ${(html.length / 1024).toFixed(1)} KB`);
    return;
  }

  let targets = tools;
  if (SINGLE_ID) {
    const tool = tools.find(t => t.id === SINGLE_ID);
    if (!tool) { console.error(`  ❌ Tool "${SINGLE_ID}" not found`); process.exit(1); }
    targets = [tool];
  }

  let count = 0;
  for (const tool of targets) {
    const html = generatePage(tool);
    const path = resolve(VS_DIR, `${tool.id}.html`);
    writeFileSync(path, html);
    count++;
    console.log(`  ✅ ${tool.id}.html  (${(html.length / 1024).toFixed(1)} KB) — ${tool.name}`);
  }

  // Always regenerate index
  const indexHtml = generateIndex();
  writeFileSync(resolve(VS_DIR, 'index.html'), indexHtml);
  console.log(`  ✅ index.html  (${(indexHtml.length / 1024).toFixed(1)} KB) — All Comparisons hub`);
  console.log('');
  console.log(`  Summary: ${count} pages + index generated`);
}

await main();
