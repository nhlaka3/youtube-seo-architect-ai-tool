#!/usr/bin/env node
/**
 * scripts/generate-guides.mjs
 * How-to guide pages — Wise-style "Code Guides" equivalent
 * Generates step-by-step tool guides at public/guides/
 *
 * Usage:
 *   node scripts/generate-guides.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const OUT_DIR = resolve(PROJECT, 'public/guides');

const guides = (await import('./guides-data.js')).default;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Template ───────────────────────────────────────────────────────

function generatePage(g) {
  const sectionsHtml = g.sections.map(s => `
    <div class="step-card">
      <h2 id="${s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${s.heading}</h2>
      <p>${s.content}</p>
    </div>`).join('');

  const faqHtml = g.faq.map(f => `
    <details>
      <summary>${f.q}</summary>
      <div class="faq-answer"><p>${f.a}</p></div>
    </details>`).join('');

  const relatedHtml = guides
    .filter(r => g.related.includes(r.id))
    .map(r => `<a href="/guides/${r.id}" class="related-card"><strong>${r.name}</strong><span>${r.description.substring(0, 60)}…</span></a>`)
    .join('\n          ');

  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: g.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${g.h1} | YT SEO Architect</title>
  <meta name="description" content="${g.metaDesc}">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/guides/${g.slug}">
  <meta property="og:title" content="${g.h1}">
  <meta property="og:description" content="${g.metaDesc.substring(0, 160)}">
  <meta property="og:type" content="article">
  <script type="application/ld+json">${faqSchema}</script>
  <script type="application/ld+json">{
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "${g.h1}",
    "description": "${g.description}",
    "step": [${g.sections.map((s, i) => `{"@type":"HowToStep","position":${i+1},"name":"${s.heading}","text":"${s.content.replace(/"/g, '\\"').substring(0, 200)}"}`).join(',')}]
  }</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .hero { padding: 4rem 2rem 3rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.2rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero .tool-badge { display: inline-block; background: rgba(99,102,241,0.15); color: #818cf8; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; border: 1px solid rgba(99,102,241,0.3); margin-bottom: 1rem; }
    .hero p { color: #9ca3af; font-size: 1rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .step-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem; }
    .step-card h2 { color: #f9fafb; font-size: 1.15rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
    .step-card p { color: #9ca3af; font-size: 0.95rem; }
    .step-card::before { content: ''; display: inline-block; width: 8px; height: 8px; background: #34d399; border-radius: 50%; margin-right: 0.5rem; }
    .cta-box { background: linear-gradient(135deg,rgba(99,102,241,0.1),rgba(6,182,212,0.05)); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; padding: 2rem; margin: 2rem 0; text-align: center; }
    .cta-box h3 { color: #f9fafb; font-size: 1.2rem; margin-bottom: 0.5rem; }
    .cta-box p { color: #9ca3af; margin-bottom: 1rem; }
    .cta-box a { display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.75rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 700; }
    .faq-section { margin: 2rem 0; }
    .faq-section h2 { color: #f9fafb; font-size: 1.3rem; margin-bottom: 1rem; }
    details { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; cursor: pointer; }
    details[open] { border-color: rgba(99,102,241,0.3); }
    summary { color: #e5e7eb; font-weight: 600; font-size: 0.95rem; }
    .faq-answer { padding-top: 0.75rem; color: #9ca3af; font-size: 0.9rem; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .related-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; text-decoration: none; color: inherit; }
    .related-card strong { display: block; color: #f9fafb; font-size: 0.9rem; }
    .related-card span { font-size: 0.8rem; color: #6b7280; }
    .related-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
    @media(max-width:640px) { .hero h1 { font-size: 1.5rem; } .step-card { padding: 1.25rem; } }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="${g.toolLink}" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:0.5rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;">${g.toolCta} →</a>
  </nav>

  <div class="hero">
    <div class="tool-badge">📖 How-To Guide</div>
    <h1>${g.h1}</h1>
    <p>${g.description}</p>
  </div>

  <div class="container">
    ${sectionsHtml}

    <div class="cta-box">
      <h3>🚀 Try It Now</h3>
      <p>Ready to apply these steps? Open the ${g.name} and optimize your content.</p>
      <a href="${g.toolLink}">${g.toolCta} →</a>
    </div>

    <div class="faq-section">
      <h2>❓ Frequently Asked Questions</h2>
      ${faqHtml}
    </div>

    <div class="related-section">
      <h2 style="color:#f9fafb;font-size:1.2rem;margin-bottom:1rem;">📚 More Guides</h2>
      <div class="related-grid">
        ${relatedHtml}
        <a href="/guides" class="related-card"><strong>Browse All Guides</strong><span>See all how-to guides</span></a>
      </div>
    </div>
  </div>

  <footer>
    <p>© 2026 YT SEO Architect · <a href="/guides">Guides</a> · <a href="/tools/converters">Calculators</a> · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Index page ─────────────────────────────────────────────────────

function generateIndex() {
  const cards = guides.map(g =>
    `<a href="/guides/${g.id}" class="index-card">
      <div class="card-header"><strong>${g.name}</strong></div>
      <div class="card-body">${g.description.substring(0, 80)}…</div>
      <div class="card-footer">${g.sections.length} steps</div>
    </a>`
  ).join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How to Use YT SEO Architect Tools — Free Guides (2026)</title>
  <meta name="description" content="Step-by-step guides for every YT SEO Architect tool. Learn to use the Tag Generator, Title Optimizer, Channel Audit, and more.">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/guides">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .hero { padding: 4rem 2rem 3rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero p { color: #9ca3af; max-width: 500px; margin: 0 auto; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .index-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .index-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; }
    .index-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    .card-header strong { color: #f9fafb; }
    .card-body { color: #9ca3af; font-size: 0.85rem; margin-top: 0.5rem; }
    .card-footer { color: #6b7280; font-size: 0.8rem; margin-top: 0.5rem; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <nav class="nav-bar"><a href="/" class="brand">⚡ YT SEO <span>Architect</span></a></nav>
  <div class="hero"><h1>📚 How-to Guides</h1><p>Step-by-step tutorials for every YT SEO Architect tool</p></div>
  <div class="container"><div class="index-grid">${cards}</div></div>
  <footer><p>© 2026 YT SEO Architect · <a href="/tools/converters">Calculators</a> · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a></p></footer>
</body>
</html>`;
  return html;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  GUIDE GENERATOR — Wise-style Code Guides');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let count = 0;
  for (const g of guides) {
    const html = generatePage(g);
    writeFileSync(resolve(OUT_DIR, `${g.id}.html`), html);
    count++;
    console.log(`  ✅ ${g.id}.html  (${(html.length / 1024).toFixed(1)} KB)`);
  }

  const idxHtml = generateIndex();
  // Hub (index.html) is maintained separately (pillar cards + modern design) —
  // only write it if it doesn't exist yet, so the daily workflow never clobbers it.
  if (!existsSync(resolve(OUT_DIR, 'index.html'))) {
    writeFileSync(resolve(OUT_DIR, 'index.html'), idxHtml);
    console.log(`  ✅ index.html  (${(idxHtml.length / 1024).toFixed(1)} KB) — Guides hub`);
  } else {
    console.log('  ⏭ index.html exists — hub is maintained separately, skipping');
  }
  console.log('');
  console.log(`  Summary: ${count} how-to guides + index`);
}

await main();