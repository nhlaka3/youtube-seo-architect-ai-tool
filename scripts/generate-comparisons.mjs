#!/usr/bin/env node
/**
 * scripts/generate-comparisons.mjs
 *
 * Generates comparison pages (/vs/ pages) that compare YT SEO Architect
 * against other tools. These pages attract backlinks from people comparing
 * YouTube SEO tools.
 *
 * Usage:
 *   node scripts/generate-comparisons.mjs              # Generate all pending
 *   node scripts/generate-comparisons.mjs --list       # List what would be made
 *   node scripts/generate-comparisons.mjs --slug morningfame  # Generate one
 *
 * Each page follows the format of public/vs/vidiq.html with:
 *   - Product + Article schema
 *   - Feature comparison table
 *   - Verdict box
 *   - Canonical link to YT SEO Architect
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const VS_DIR = resolve(PROJECT, 'public/vs');

const COMPARISONS = {
  'morningfame': {
    competitor: 'Morningfame',
    tagline: 'YT SEO Architect vs Morningfame (2026): Free Alternative to Discontinued Analytics',
    description: 'Morningfame shut down in 2023. Compare its replacement options vs YT SEO Architect — the free alternative with 17 AI-powered YouTube SEO tools.',
    price: 'Free (was $5.50/mo)',
    ourEdge: 'Morningfame shut down. YT SEO Architect is the free replacement with more features — AI metadata optimization, tag generation, competitor analysis, and channel audit.',
    features: [
      ['Keyword Research', '✅ Advanced AI research', '❌ Limited'],
      ['Tag Generation', '✅ AI-optimized tags', '❌ Basic only'],
      ['Title Optimization', '✅ AI title scorer', '❌ None'],
      ['Description Writer', '✅ AI description generator', '❌ None'],
      ['Channel Audit', '✅ 17-point audit', '❌ Basic analytics'],
      ['Competitor Analysis', '✅ Full competitor sniping', '❌ None'],
      ['Thumbnail Analysis', '✅ AI thumbnail scoring', '❌ None'],
      ['AI Automation', '✅ Autonomous agent', '❌ Shut down'],
      ['Price', '💰 Free, unlimited', '💀 Discontinued'],
    ],
    verdict: 'Morningfame users: YT SEO Architect is your free replacement. Same analytics focus, but with AI-powered SEO tools Morningfame never had. No credit card needed.',
  },
  'tubics': {
    competitor: 'Tubeics',
    tagline: 'YT SEO Architect vs Tubeics (2026): Free With More AI Features',
    description: 'Compare Tubeics ($13/mo) vs YT SEO Architect (free). Feature-by-feature breakdown of both YouTube SEO tools.',
    price: '€13/mo',
    ourEdge: 'Tubeics offers good keyword research but charges €13/mo. YT SEO Architect provides similar keyword tools PLUS title optimization, tag generation, description writing, competitor sniping — all free.',
    features: [
      ['Keyword Research', '✅ AI keyword discovery', '✅ Good keyword data'],
      ['Tag Generation', '✅ AI-optimized tags', '❌ Limited'],
      ['Title Optimization', '✅ AI title scorer', '❌ None'],
      ['Description Writer', '✅ AI description generator', '❌ None'],
      ['Channel Audit', '✅ 17-point audit', '❌ Basic'],
      ['Competitor Analysis', '✅ Full competitor sniping', '❌ None'],
      ['Thumbnail Analysis', '✅ AI thumbnail scoring', '❌ None'],
      ['Script Generation', '✅ AI script writer', '❌ None'],
      ['Trend Detection', '✅ Trend Pulse detector', '⚠️ Limited'],
      ['Price', '💰 Free, unlimited', '💶 €13/month'],
    ],
    verdict: 'Tubeics is solid for keyword research but costly at €13/mo. YT SEO Architect matches their keyword tools and adds 15+ features they lack — all free.',
  },
  'keywordtool': {
    competitor: 'Keyword Tool',
    tagline: 'YT SEO Architect vs Keyword Tool (2026): Free YouTube Keyword Research',
    description: 'Compare Keyword Tool ($69/mo Pro) vs YT SEO Architect (free). AI-powered YouTube keyword research without the subscription.',
    price: '$69/mo (Pro)',
    ourEdge: 'Keyword Tool is excellent for keyword discovery but costs $69/mo for Pro. YT SEO Architect offers keyword research PLUS tag generation, title optimization, channel audit, and competitor analysis — all free.',
    features: [
      ['Keyword Research', '✅ YouTube + Google keyword tools', '✅ Multi-source keywords'],
      ['Search Volume', '✅ Relative search volume', '✅ Volume estimates'],
      ['Long-Tail Keywords', '✅ AI long-tail discovery', '⚠️ Manual only'],
      ['Tag Generation', '✅ AI-optimized tags', '❌ None'],
      ['Title Optimization', '✅ AI title scorer', '❌ None'],
      ['Channel Audit', '✅ 17-point audit', '❌ None'],
      ['Competitor Analysis', '✅ Competitor keyword sniping', '❌ None'],
      ['Bulk Operations', '✅ Bulk metadata injector', '❌ None'],
      ['Price', '💰 Free, unlimited', '💵 $69/month Pro'],
    ],
    verdict: 'Keyword Tool is expensive at $69/mo. YT SEO Architect gives you keyword research plus a full SEO toolkit — and it is 100% free.',
  },
  'canva': {
    competitor: 'Canva (Thumbnails)',
    tagline: 'YT SEO Architect vs Canva (2026): Free Thumbnail Analysis + SEO',
    description: 'Compare Canva (design only) vs YT SEO Architect (free). Get AI thumbnail analysis, title optimization, and SEO tools — not just design.',
    price: 'Free / $13/mo Pro',
    ourEdge: 'Canva is great for designing thumbnails. YT SEO Architect tells you if your thumbnail will actually get clicks — AI thumbnail scoring, title analysis, and channel-wide SEO audit. Use Canva to design, YT SEO Architect to optimize.',
    features: [
      ['Thumbnail Design', '✅ AI thumbnail scoring', '✅ Excellent design tools'],
      ['Click Prediction', '✅ CTR prediction score', '❌ None'],
      ['Title Optimization', '✅ AI title + thumbnail fit', '❌ None'],
      ['A/B Testing', '✅ Title A/B tester', '❌ None'],
      ['Channel Audit', '✅ 17-point metadata audit', '❌ None'],
      ['Keyword Research', '✅ YouTube keyword tool', '❌ None'],
      ['Tag Generation', '✅ AI-optimized tags', '❌ None'],
      ['Brand Kits', '❌ Not applicable', '✅ Yes'],
      ['Price', '💰 Free, unlimited', '🎨 Free / $13 Pro'],
    ],
    verdict: 'Canva designs thumbnails. YT SEO Architect tells you if they will work. Use both together — design in Canva, then optimize with YT SEO Architect.',
  },
};

function renderComparisonPage(key, data) {
  const featureRows = data.features.map(f =>
    `    <tr><td>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td></tr>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.tagline}</title>
  <meta name="description" content="${data.description}">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/vs/${key}">
  <meta property="og:title" content="${data.tagline}">
  <meta property="og:description" content="Honest comparison. ${data.ourEdge.substring(0, 120)}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="https://yt-seo-architect.vercel.app/og-image.png">
  <meta name="twitter:card" content="summary_large_image">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "YT SEO Architect",
    "description": "Free AI-powered YouTube SEO tool with 17 features.",
    "url": "https://yt-seo-architect.vercel.app/",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${data.tagline}",
    "description": "${data.description.substring(0, 200)}",
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://yt-seo-architect.vercel.app/vs/${key}" }
  }
  </script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .hero { padding: 6rem 2rem 4rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.8rem; color: #f9fafb; margin-bottom: 1rem; }
    .hero h1 .free { color: #34d399; }
    .hero h1 .paid { color: #f87171; }
    .hero p { color: #9ca3af; font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 900px; margin: 0 auto; padding: 0 2rem; }
    .verdict-box { background: linear-gradient(135deg, #064e3b, #065f46); border-radius: 16px; padding: 2rem; margin: 3rem auto; text-align: center; border: 1px solid rgba(52,211,153,0.2); max-width: 700px; }
    .verdict-box h2 { color: #34d399; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .verdict-box p { color: #a7f3d0; }
    .comparison-table { width: 100%; border-collapse: collapse; margin: 3rem 0; background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; }
    .comparison-table th, .comparison-table td { padding: 14px 18px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .comparison-table th { background: rgba(255,255,255,0.04); color: #f9fafb; font-weight: 600; }
    .comparison-table th:nth-child(2) { color: #818cf8; }
    .comparison-table th:nth-child(3) { color: #f87171; }
    .comparison-table td:nth-child(2) { color: #34d399; }
    .comparison-table td:nth-child(3) { color: #9ca3af; }
    .comparison-table tr:hover { background: rgba(255,255,255,0.03); }
    .cta-box { background: linear-gradient(135deg,rgba(99,102,241,0.1),rgba(6,182,212,0.05)); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; padding: 2rem; margin: 3rem 0; text-align: center; }
    .cta-box h3 { color: #f9fafb; font-size: 1.25rem; margin-bottom: 0.75rem; }
    .cta-box p { color: #9ca3af; margin-bottom: 1.25rem; }
    .cta-box a { display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.75rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 700; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .cta { background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.5rem 1.2rem; border-radius: 8px; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
    @media(max-width:640px) { .hero h1 { font-size: 1.8rem; } .comparison-table th, .comparison-table td { padding: 10px 12px; font-size: 0.85rem; } }
  </style>
<script defer src="/ga.js"></script></head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="/dashboard" class="cta">Try Free →</a>
  </nav>

  <div class="hero">
    <h1>YT SEO Architect vs <span class="paid">${data.competitor}</span></h1>
    <p>${data.description}</p>
  </div>

  <div class="container">

    <div class="verdict-box">
      <h2>🏆 Our Verdict</h2>
      <p>${data.verdict}</p>
    </div>

    <h2 style="margin:2rem 0 1rem;font-size:1.5rem">Feature Comparison</h2>
    <table class="comparison-table">
      <thead><tr><th>Feature</th><th>YT SEO Architect</th><th>${data.competitor}</th></tr></thead>
      <tbody>
${featureRows}
      </tbody>
    </table>

    <div class="cta-box">
      <h3>🚀 Try YT SEO Architect Free</h3>
      <p>17 AI-powered tools. No credit card required. Upgrade from ${data.competitor} in 2 minutes.</p>
      <a href="/dashboard">Start Free →</a>
    </div>

  </div>

  <footer>
    <p>© 2026 YT SEO Architect · <a href="/vs/vidiq">vs vidIQ</a> · <a href="/vs/tubebuddy">vs TubeBuddy</a> · <a href="/blog">Blog</a> · <a href="/glossary/">Glossary</a> · <a href="/privacy-policy">Privacy</a></p>
  </footer>
</body>
</html>`;
}

function main() {
  if (!existsSync(VS_DIR)) mkdirSync(VS_DIR, { recursive: true });

  const listMode = process.argv.includes('--list');
  const specific = process.argv.indexOf('--slug');
  const specificSlug = specific > -1 ? process.argv[specific + 1] : null;

  const toGenerate = specificSlug ? [specificSlug] : Object.keys(COMPARISONS);

  console.log('\n📊 Generating Comparison Pages...\n');

  for (const slug of toGenerate) {
    const data = COMPARISONS[slug];
    if (!data) {
      console.log(`  ⏭ Skipped "${slug}" — not in COMPARISONS`);
      continue;
    }

    const html = renderComparisonPage(slug, data);
    const wordCount = html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    const outputPath = resolve(VS_DIR, `${slug}.html`);

    if (listMode) {
      console.log(`  📄 ${slug}.html — ${data.tagline.substring(0, 60)}...`);
      console.log(`     ${wordCount} words, ${data.features.length} feature rows`);
      continue;
    }

    writeFileSync(outputPath, html);
    console.log(`  ✅ ${slug}.html — ${wordCount} words, ${data.features.length} features`);
  }

  // Copy to dist/ as well
  const distDir = resolve(PROJECT, 'dist/vs');
  if (!listMode && existsSync(dirname(distDir))) {
    if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
    for (const slug of toGenerate) {
      const data = COMPARISONS[slug];
      if (!data) continue;
      writeFileSync(resolve(distDir, `${slug}.html`), renderComparisonPage(slug, data));
    }
  }

  // Also add to sitemap — the sitemap route already exists in api/index.js
  // Just need to add the vercel.json rewrites

  console.log('\n📊 Summary:');
  console.log(`  Pages generated: ${toGenerate.filter(s => COMPARISONS[s]).length}`);
  console.log(`  Total comparison pages: ${Object.keys(COMPARISONS).length + 2} (2 existing: vidiq, tubebuddy)`);
  console.log('');

  if (listMode) {
    console.log('  Run without --list to generate these pages.');
    console.log('  Run with --slug <name> to generate a single page.\n');
  } else {
    console.log('  Add rewrites to vercel.json for new /vs/ routes.\n');
  }
}

main();
