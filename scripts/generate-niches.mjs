#!/usr/bin/env node
/**
 * scripts/generate-niches.mjs
 * Niche guide pages — Wise-style "Location Pages" equivalent
 * Generates "YouTube SEO for [niche]" guide pages at public/niches/
 *
 * Usage: node scripts/generate-niches.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const OUT_DIR = resolve(PROJECT, 'public/niches');
const niches = (await import('./niches-data.js')).default;
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function generatePage(n) {
  const tipsHtml = n.tips.map(t => `<div class="tip-card"><h2 id="${t.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}">${t.title}</h2><p>${t.content}</p></div>`).join('');
  const relatedHtml = niches.filter(r => n.related.includes(r.id)).map(r => `<a href="/niches/${r.id}" class="related-card"><strong>${r.icon} ${r.name}</strong><span>${r.description.substring(0,60)}…</span></a>`).join('\n          ');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${n.h1} | YT SEO Architect</title><meta name="description" content="${n.metaDesc}"><link rel="canonical" href="https://yt-seo-architect.vercel.app/niches/${n.id}"><meta property="og:title" content="${n.h1}"><meta property="og:description" content="${n.metaDesc.substring(0,160)}"><meta property="og:type" content="article"><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is the best video length for ${n.name.toLowerCase()}?","acceptedAnswer":{"@type":"Answer","text":"The ideal length is ${n.stats.bestLength}."}},{"@type":"Question","name":"What CTR should ${n.name.toLowerCase()} expect?","acceptedAnswer":{"@type":"Answer","text":"Average CTR for ${n.name.toLowerCase()} is ${n.stats.avgCtr}."}},{"@type":"Question","name":"How much do ${n.name.toLowerCase()} earn?","acceptedAnswer":{"@type":"Answer","text":"Average CPM for ${n.name.toLowerCase()} is ${n.stats.avgCpm}."}}]}</script><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0b10;color:#e5e7eb;line-height:1.7}.nav-bar{display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;background:rgba(15,15,26,0.9);border-bottom:1px solid rgba(255,255,255,0.06)}.nav-bar a{color:#e5e7eb;text-decoration:none;font-weight:600}.nav-bar .brand{font-size:1.2rem;font-weight:800}.nav-bar .brand span{color:#fb923c}.hero{padding:4rem 2rem 3rem;text-align:center;background:linear-gradient(135deg,#0a0b10 0%,#1e1b4b 50%,#0a0b10 100%)}.hero .icon{font-size:3rem;margin-bottom:.5rem}.hero h1{font-size:2.2rem;color:#f9fafb;margin-bottom:.75rem}.hero p{color:#9ca3af;font-size:1rem;max-width:650px;margin:0 auto}.container{max-width:800px;margin:0 auto;padding:2rem}.intro-box{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:1.5rem;margin-bottom:2rem}.intro-box p{color:#9ca3af;font-size:.95rem}.stats-row{display:flex;gap:1rem;justify-content:center;margin:2rem 0;flex-wrap:wrap}.stat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:1rem 1.5rem;text-align:center;min-width:140px}.stat-card .label{color:#6b7280;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}.stat-card .value{color:#34d399;font-size:1.1rem;font-weight:700;margin-top:.25rem}.tip-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:1.5rem;margin-bottom:1.25rem}.tip-card h2{color:#f9fafb;font-size:1.1rem;margin-bottom:.75rem}.tip-card h2::before{content:'${n.icon}';font-size:1.2rem;margin-right:.5rem}.tip-card p{color:#9ca3af;font-size:.95rem}.cta-box{background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(6,182,212,0.05));border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:2rem;margin:2rem 0;text-align:center}.cta-box h3{color:#f9fafb;font-size:1.2rem;margin-bottom:.5rem}.cta-box p{color:#9ca3af;margin-bottom:1rem}.cta-box a{display:inline-block;background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:.75rem 2rem;border-radius:10px;text-decoration:none;font-weight:700}.faq-section{margin:2rem 0}.faq-section h2{color:#f9fafb;font-size:1.3rem;margin-bottom:1rem}details{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:1rem 1.25rem;margin-bottom:.75rem;cursor:pointer}details[open]{border-color:rgba(99,102,241,0.3)}summary{color:#e5e7eb;font-weight:600;font-size:.95rem}.faq-answer{padding-top:.75rem;color:#9ca3af;font-size:.9rem}.related-section{margin:2rem 0}.related-section h2{color:#f9fafb;font-size:1.2rem;margin-bottom:1rem}.related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}.related-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:1rem;text-decoration:none;color:inherit}.related-card strong{display:block;color:#f9fafb;font-size:.9rem}.related-card span{font-size:.8rem;color:#6b7280}.related-card:hover{border-color:rgba(99,102,241,0.4);background:rgba(99,102,241,0.05)}footer{text-align:center;padding:2rem;border-top:1px solid rgba(255,255,255,0.06);color:#6b7280;font-size:.85rem}footer a{color:#6366f1;text-decoration:none}@media(max-width:640px){.hero h1{font-size:1.5rem}.tip-card{padding:1.25rem}}
</style></head><body>
<nav class="nav-bar"><a href="/" class="brand">⚡ YT SEO <span>Architect</span></a><a href="/dashboard" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;padding:.5rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;">Dashboard →</a></nav>
<div class="hero"><div class="icon">${n.icon}</div><h1>${n.h1}</h1><p>${n.description}</p></div>
<div class="container">
<div class="intro-box"><p>${n.intro}</p></div>
<div class="stats-row">
<div class="stat-card"><div class="label">Avg CTR</div><div class="value">${n.stats.avgCtr}</div></div>
<div class="stat-card"><div class="label">Best Length</div><div class="value">${n.stats.bestLength}</div></div>
<div class="stat-card"><div class="label">Avg CPM</div><div class="value">${n.stats.avgCpm}</div></div>
<div class="stat-card" style="min-width:200px"><div class="label">Top Keywords</div><div class="value" style="font-size:.85rem;color:#818cf8">${n.stats.topKeywords}</div></div>
</div>
<h2 style="color:#f9fafb;font-size:1.3rem;margin-bottom:1.5rem;">📋 ${n.name}: SEO Strategies That Work</h2>
${tipsHtml}
<div class="cta-box"><h3>🚀 Optimize Your ${n.name} Channel</h3><p>Run a free 17-point channel audit and get personalized recommendations.</p><a href="/dashboard">Run Free Audit →</a></div>
<div class="faq-section"><h2>❓ Frequently Asked Questions</h2>
<details><summary>What is the best video length for ${n.name.toLowerCase()}?</summary><div class="faq-answer"><p>The ideal length is ${n.stats.bestLength}.</p></div></details>
<details><summary>What CTR should ${n.name.toLowerCase()} expect?</summary><div class="faq-answer"><p>Average CTR is ${n.stats.avgCtr}.</p></div></details>
<details><summary>How much do ${n.name.toLowerCase()} channels earn?</summary><div class="faq-answer"><p>Average CPM is ${n.stats.avgCpm}.</p></div></details>
</div>
<div class="related-section"><h2>🔗 Related Niches</h2><div class="related-grid">${relatedHtml}<a href="/niches" class="related-card"><strong>Browse All Niches</strong><span>See guides for all content types</span></a></div></div>
</div>
<footer><p>© 2026 YT SEO Architect · <a href="/niches">Niches</a> · <a href="/guides">Guides</a> · <a href="/tools/converters">Calculators</a> · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a></p></footer>
</body></html>`;
}

function generateIndex() {
  const cards = niches.map(n => `<a href="/niches/${n.id}" class="index-card"><div class="card-icon">${n.icon}</div><div class="card-header"><strong>${n.name}</strong></div><div class="card-body">${n.description.substring(0,80)}…</div><div class="card-footer">${n.stats.avgCtr} CTR · ${n.stats.bestLength} · ${n.stats.avgCpm} CPM</div></a>`).join('\n      ');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>YouTube SEO by Niche (2026) — Guides for Every Content Type</title><meta name="description" content="YouTube SEO strategies by niche: gaming, cooking, music, fitness, tech reviews, education, business, and lifestyle."><link rel="canonical" href="https://yt-seo-architect.vercel.app/niches"><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0b10;color:#e5e7eb;line-height:1.7}.nav-bar{display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;background:rgba(15,15,26,0.9);border-bottom:1px solid rgba(255,255,255,0.06)}.nav-bar a{color:#e5e7eb;text-decoration:none;font-weight:600}.nav-bar .brand{font-size:1.2rem;font-weight:800}.nav-bar .brand span{color:#fb923c}.hero{padding:4rem 2rem 3rem;text-align:center;background:linear-gradient(135deg,#0a0b10 0%,#1e1b4b 50%,#0a0b10 100%)}.hero h1{font-size:2rem;color:#f9fafb;margin-bottom:.5rem}.hero p{color:#9ca3af;max-width:500px;margin:0 auto}.container{max-width:900px;margin:0 auto;padding:2rem}.index-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem}.index-card{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.25rem;text-decoration:none;color:inherit}.index-card:hover{border-color:rgba(99,102,241,0.4);background:rgba(99,102,241,0.05)}.card-icon{font-size:2rem;margin-bottom:.5rem}.card-header strong{color:#f9fafb;font-size:1.1rem}.card-body{color:#9ca3af;font-size:.85rem;margin-top:.5rem}.card-footer{color:#6b7280;font-size:.8rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,0.04)}footer{text-align:center;padding:2rem;border-top:1px solid rgba(255,255,255,0.06);color:#6b7280;font-size:.85rem}footer a{color:#6366f1;text-decoration:none}
</style></head><body>
<nav class="nav-bar"><a href="/" class="brand">⚡ YT SEO <span>Architect</span></a></nav>
<div class="hero"><h1>🎯 YouTube SEO by Niche</h1><p>Specialized SEO strategies tailored to your content type</p></div>
<div class="container"><div class="index-grid">${cards}</div></div>
<footer><p>© 2026 YT SEO Architect · <a href="/guides">Guides</a> · <a href="/tools/converters">Calculators</a> · <a href="/vs">Comparisons</a> · <a href="/blog">Blog</a></p></footer>
</body></html>`;
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  NICHE GUIDE GENERATOR');
  console.log('═══════════════════════════════════════════════');
  let count = 0;
  for (const n of niches) { const html = generatePage(n); writeFileSync(resolve(OUT_DIR, `${n.id}.html`), html); count++; console.log(`  ✅ ${n.id}.html`); }
  writeFileSync(resolve(OUT_DIR, 'index.html'), generateIndex());
  console.log(`  ✅ index.html`); console.log(`\n  Summary: ${count} niche guides + index`);
}
await main();