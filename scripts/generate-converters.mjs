#!/usr/bin/env node
/**
 * scripts/generate-converters.mjs
 * Channel metric converter pages — Wise-style parameterized calculators
 * Generates interactive HTML tool pages at public/tools/converters/
 *
 * Usage:
 *   node scripts/generate-converters.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const OUT_DIR = resolve(PROJECT, 'public/tools/converters');
const TEMPLATE_DIR = resolve(PROJECT, 'public/tools');

const converters = (await import('./converters-data.js')).default;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Generate converter page ────────────────────────────────────────

function generatePage(c) {
  // Build input HTML
  const inputHtml = c.inputs.map(inp => {
    if (inp.type === 'select') {
      const opts = inp.options.map(o =>
        `<option value="${o.value}"${o.value === inp.default ? ' selected' : ''}>${o.label}</option>`
      ).join('');
      return `<div class="input-group">
        <label for="${inp.id}">${inp.label}</label>
        <select id="${inp.id}">${opts}</select>
        ${inp.info ? `<span class="info">${inp.info}</span>` : ''}
      </div>`;
    }
    return `<div class="input-group">
      <label for="${inp.id}">${inp.label}</label>
      <input type="${inp.type}" id="${inp.id}" value="${inp.default}" placeholder="${inp.placeholder || ''}" min="${inp.min ?? ''}" max="${inp.max ?? ''}" step="${inp.step || ''}">
      ${inp.info ? `<span class="info">${inp.info}</span>` : ''}
    </div>`;
  }).join('\n        ');

  // Niche comparison table
  const nicheRows = c.niches.map(n => {
    const vals = Object.entries(n).filter(([k]) => k !== 'name' && k !== 'icon' && k !== 'desc');
    return `<tr><td>${n.icon || ''} ${n.name}</td>${vals.map(([,v]) => `<td>${v}</td>`).join('')}${n.desc ? `<td class="niche-desc">${n.desc}</td>` : ''}</tr>`;
  }).join('\n          ');

  const nicheHeaders = Object.keys(c.niches[0]).filter(k => k !== 'name' && k !== 'icon' && k !== 'desc');
  const nicheHeaderHtml = nicheHeaders.map(h => `<th>${h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1')}</th>`).join('') + (c.niches[0].desc ? '<th>Notes</th>' : '');

  // Related links
  const relatedLinks = converters
    .filter(r => c.related.includes(r.id))
    .map(r => `<a href="/tools/converters/${r.id}" class="related-card"><strong>${r.name}</strong><span>${r.description.substring(0, 60)}…</span></a>`)
    .join('\n          ');

  // FAQ schema
  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `How does the ${c.name} work?`, acceptedAnswer: { '@type': 'Answer', text: c.explainer } },
      { '@type': 'Question', name: `What is a good ${c.inputs[0]?.label || 'value'} for my channel?`, acceptedAnswer: { '@type': 'Answer', text: `The average varies by niche. Use the reference table below to compare your channel against typical benchmarks.` } },
    ]
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.name} (2026) — Free YouTube Tool</title>
  <meta name="description" content="${c.metaDesc}">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/tools/converters/${c.slug}">
  <meta property="og:title" content="${c.name}">
  <meta property="og:description" content="${c.metaDesc.substring(0, 160)}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">${faqSchema}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .hero { padding: 4rem 2rem 3rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.2rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero p { color: #9ca3af; font-size: 1.05rem; max-width: 600px; margin: 0 auto; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    .calc-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; }
    .calc-card h2 { color: #f9fafb; font-size: 1.3rem; margin-bottom: 1.5rem; }
    .input-group { margin-bottom: 1.25rem; }
    .input-group label { display: block; color: #9ca3af; font-size: 0.9rem; margin-bottom: 0.35rem; font-weight: 500; }
    .input-group input, .input-group select { width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #e5e7eb; font-size: 1rem; outline: none; transition: border-color 0.2s; }
    .input-group input:focus, .input-group select:focus { border-color: #6366f1; }
    .input-group select { cursor: pointer; }
    .input-group select option { background: #1a1a2e; color: #e5e7eb; }
    .input-group .info { display: block; color: #6b7280; font-size: 0.8rem; margin-top: 0.3rem; }
    .result-box { background: linear-gradient(135deg, #064e3b, #065f46); border: 1px solid rgba(52,211,153,0.2); border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1.5rem 0; }
    .result-box .result-label { color: #a7f3d0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .result-box .result-value { font-size: 2.8rem; font-weight: 800; color: #34d399; margin: 0.25rem 0; }
    .result-box .result-sub { color: #6b7280; font-size: 0.85rem; }
    .result-box .result-breakdown { display: flex; gap: 1.5rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap; }
    .result-box .breakdown-item { text-align: center; }
    .result-box .breakdown-item .num { font-size: 1.2rem; font-weight: 700; color: #f9fafb; }
    .result-box .breakdown-item .lbl { font-size: 0.75rem; color: #6b7280; }
    .explainer { background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 1.25rem; margin-top: 1rem; }
    .explainer p { color: #9ca3af; font-size: 0.9rem; }
    .niche-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; background: rgba(255,255,255,0.02); border-radius: 12px; overflow: hidden; }
    .niche-table th, .niche-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .niche-table th { background: rgba(255,255,255,0.04); color: #f9fafb; font-weight: 600; font-size: 0.85rem; }
    .niche-table td { color: #9ca3af; }
    .niche-table tr:hover { background: rgba(255,255,255,0.03); }
    .niche-table .niche-desc { font-size: 0.85rem; color: #6b7280; }
    .cta-box { background: linear-gradient(135deg,rgba(99,102,241,0.1),rgba(6,182,212,0.05)); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; padding: 2rem; margin: 2rem 0; text-align: center; }
    .cta-box h3 { color: #f9fafb; font-size: 1.2rem; margin-bottom: 0.5rem; }
    .cta-box p { color: #9ca3af; margin-bottom: 1rem; }
    .cta-box a { display: inline-block; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; padding: 0.75rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 700; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .related-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; text-decoration: none; color: inherit; }
    .related-card strong { display: block; color: #f9fafb; font-size: 0.95rem; }
    .related-card span { font-size: 0.8rem; color: #6b7280; }
    .related-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    .all-link { text-align: center; margin: 2rem 0; }
    .all-link a { color: #6366f1; text-decoration: none; font-weight: 600; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
    @media(max-width:640px) { .hero h1 { font-size: 1.5rem; } .result-box .result-value { font-size: 2rem; } .calc-card { padding: 1.25rem; } }
  </style>
<script defer src="/ga.js"></script></head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="/dashboard" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:0.5rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;">Dashboard →</a>
  </nav>

  <div class="hero">
    <h1>${c.h1}</h1>
    <p>${c.description}</p>
  </div>

  <div class="container">
    <div class="calc-card">
      <h2>📊 Enter Your Numbers</h2>
      ${inputHtml}

      <div class="result-box" id="result">
        <div class="result-label">Estimated Result</div>
        <div class="result-value" id="resultValue">—</div>
        <div class="result-sub" id="resultSub">Adjust the inputs above</div>
        <div class="result-breakdown" id="resultBreakdown"></div>
      </div>

      <div class="explainer">
        <p><strong>How it works:</strong> ${c.explainer}</p>
      </div>
    </div>

    <h2 style="color:#f9fafb;font-size:1.3rem;margin-bottom:0.5rem;">📋 Reference Benchmarks</h2>
    <p style="color:#6b7280;font-size:0.9rem;margin-bottom:1rem;">Compare your channel against typical values by niche</p>
    <table class="niche-table">
      <thead><tr><th>Niche / Scenario</th>${nicheHeaderHtml}</tr></thead>
      <tbody>${nicheRows}</tbody>
    </table>

    <div class="cta-box">
      <h3>🎯 Optimize Your Channel</h3>
      <p>Get a full 17-point YouTube channel audit with actionable recommendations.</p>
      <a href="/dashboard">Run Free Channel Audit →</a>
    </div>

    <div class="all-link">
      <a href="/tools/converters">← Browse All Calculators</a>
    </div>
  </div>

  <footer>
    <p>© 2026 YT SEO Architect · <a href="/tools/converters">Calculators</a> · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a> · <a href="/dashboard">Dashboard</a></p>
  </footer>

  <script>
    const inputs = document.querySelectorAll('#${c.inputs.map(i => i.id).join(', #')}');
    function calculate() {
      const vals = {};
      inputs.forEach(inp => { vals[inp.id] = parseFloat(inp.value) || 0; });
      const result = ${c.formula};
      const el = document.getElementById('resultValue');
      const sub = document.getElementById('resultSub');
      const bd = document.getElementById('resultBreakdown');

      if (result > 0) {
        el.textContent = result >= 1000000
          ? (result / 1000000).toFixed(1) + 'M'
          : result >= 1000
            ? result.toLocaleString('en-US', { maximumFractionDigits: 0 })
            : result.toFixed(2);

        // Generate breakdown
        let breakdown = '';
        if (vals.views) {
          const daily = result / 30;
          const hourly = daily / 24;
          bd.innerHTML = \`
            <div class="breakdown-item"><div class="num">\${daily.toFixed(0)}</div><div class="lbl">Per Day</div></div>
            <div class="breakdown-item"><div class="num">\${hourly.toFixed(1)}</div><div class="lbl">Per Hour</div></div>
          \`;
        } else if (vals.impressions) {
          const views = result;
          bd.innerHTML = \`
            <div class="breakdown-item"><div class="num">\${(vals.impressions / 1000).toFixed(0)}K</div><div class="lbl">Impressions</div></div>
            <div class="breakdown-item"><div class="num">\${vals.ctr}%</div><div class="lbl">CTR</div></div>
          \`;
        } else {
          bd.innerHTML = '';
        }

        sub.textContent = 'Based on your inputs';
      } else {
        el.textContent = '—';
        sub.textContent = 'Enter values above';
        bd.innerHTML = '';
      }
    }
    inputs.forEach(inp => inp.addEventListener('input', calculate));
    calculate();
  </script>
</body>
</html>`;

  return html;
}

// ── Index page ─────────────────────────────────────────────────────

function generateIndex() {
  const cards = converters.map(c =>
    `<a href="/tools/converters/${c.id}" class="index-card">
      <div class="card-header"><strong>${c.name}</strong><span class="badge">${c.category}</span></div>
      <div class="card-body">${c.description}</div>
    </a>`
  ).join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Channel Calculators & Converters (2026) — Free Tools</title>
  <meta name="description" content="Free YouTube channel calculators. Estimate revenue, views, CTR, and optimal video length. Data-driven tools for YouTube creators.">
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/tools/converters">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0b10; color: #e5e7eb; line-height: 1.7; }
    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: rgba(15,15,26,0.9); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .nav-bar a { color: #e5e7eb; text-decoration: none; font-weight: 600; }
    .nav-bar .brand { font-size: 1.2rem; font-weight: 800; }
    .nav-bar .brand span { color: #fb923c; }
    .hero { padding: 4rem 2rem 3rem; text-align: center; background: linear-gradient(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%); }
    .hero h1 { font-size: 2.2rem; color: #f9fafb; margin-bottom: 0.5rem; }
    .hero p { color: #9ca3af; max-width: 600px; margin: 0 auto; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem; }
    .index-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .index-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; text-decoration: none; color: inherit; }
    .index-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.05); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .card-header strong { color: #f9fafb; }
    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 10px; background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
    .card-body { color: #9ca3af; font-size: 0.9rem; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); color: #6b7280; font-size: 0.85rem; }
    footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <a href="/" class="brand">⚡ YT SEO <span>Architect</span></a>
    <a href="/dashboard" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:0.5rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;">Dashboard →</a>
  </nav>
  <div class="hero">
    <h1>📊 YouTube Channel Calculators</h1>
    <p>Data-driven tools to estimate revenue, predict views, optimize video length, and grow your channel</p>
  </div>
  <div class="container">
    <div class="index-grid">${cards}</div>
  </div>
  <footer>
    <p>© 2026 YT SEO Architect · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a> · <a href="/dashboard">Dashboard</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  CONVERTER GENERATOR — Wise-style Calculator Engine');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let count = 0;
  for (const c of converters) {
    const html = generatePage(c);
    writeFileSync(resolve(OUT_DIR, `${c.id}.html`), html);
    count++;
    console.log(`  ✅ ${c.id}.html  (${(html.length / 1024).toFixed(1)} KB)`);
  }

  const idxHtml = generateIndex();
  writeFileSync(resolve(OUT_DIR, 'index.html'), idxHtml);
  console.log(`  ✅ index.html  (${(idxHtml.length / 1024).toFixed(1)} KB) — Calculators hub`);
  console.log('');
  console.log(`  Summary: ${count} interactive converters + index`);
}

await main();
