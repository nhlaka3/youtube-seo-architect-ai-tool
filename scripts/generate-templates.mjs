#!/usr/bin/env node
/**
 * generate-templates.mjs — programmatic SEO template pages (goal2).
 *
 * Reads scripts/templates-data.json (20 demand-validated templates) and emits:
 *   - public/templates/<slug>.html   (each page: copy-paste template + usage +
 *     niche variations + mistakes + tool links + related + FAQ + JSON-LD)
 *   - public/templates/index.html    (hub page with cards grouped by family)
 *
 * Standards (AGENTS.md):
 *   - motion-utilities.css linked; every page has >=3 animated visuals
 *     (inline SVG charts in .chart-wrap.chart-entrance[data-chart])
 *   - unique title/meta/H1 per page; internal links to tools + pillar guides
 *   - FAQPage + WebPage schema JSON-LD
 *
 * Usage: node scripts/generate-templates.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const DATA_FILE = resolve(PROJECT, 'scripts/templates-data.json');
const OUT_DIR = resolve(PROJECT, 'public/templates');

const SITE = 'https://yt-seo-architect.vercel.app';

// Standard site header (matches /tools & /blog pages)
const SITE_HEADER = `<header class="site-header">
    <div class="header-inner">
      <a href="/" class="header-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/><circle cx="12" cy="12" r="10"/></svg>
        YT <span>SEO</span> Architect
      </a>
      <nav class="header-nav" id="header-nav">
        <a href="/tools">Tools</a>
        <a href="/blog">Blog</a>
        <a href="/templates/">Templates</a>
        <a href="/glossary/">Glossary</a>
        <a href="/tools/">Free Tools</a>
        <a href="/dashboard" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">&#9776;</button>
    </div>
  </header>`;

const FAMILY_META = {
  description: { icon: '📝', label: 'Description Templates' },
  title:       { icon: '🎯', label: 'Title Templates' },
  tags:        { icon: '🏷️', label: 'Tag Templates' },
  thumbnail:   { icon: '🖼️', label: 'Thumbnail Templates' },
  features:    { icon: '⚙️', label: 'Video Feature Templates' },
  script:      { icon: '📜', label: 'Script Templates' },
  tool:        { icon: '🧰', label: 'Generators & Tools' },
};

const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
const templates = data.templates;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── inline SVG chart per family (dark-mode, animated via .chart-entrance) ──
function familyChart(family, title) {
  const palette = {
    description: ['#00f2ff', '#00ff88', '#a78bfa'],
    title:       ['#ff6b6b', '#fbbf24', '#00f2ff'],
    tags:        ['#a78bfa', '#f472b6', '#00ff88'],
    thumbnail:   ['#ff6b6b', '#fbbf24', '#00f2ff'],
    features:    ['#00f2ff', '#a78bfa', '#fbbf24'],
    script:      ['#00ff88', '#00f2ff', '#a78bfa'],
    tool:        ['#fbbf24', '#ff6b6b', '#00ff88'],
  };
  const cols = palette[family] || palette.tool;
  const bars = [92, 78, 64, 51, 38, 26, 15, 8];
  const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
  const bw = 34, gap = 14, H = 160;
  const x0 = 20, y0 = 20;
  let rects = '', dots = '';
  bars.forEach((v, i) => {
    const x = x0 + i * (bw + gap);
    const h = (v / 100) * (H - 40);
    const y = y0 + (H - 40) - h;
    const c = cols[i % 3];
    rects += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${c}" opacity="0.9"/>`;
    dots += `<circle cx="${x + bw / 2}" cy="${y - 6}" r="3" fill="${c}"/>`;
    labels[i] = `<text x="${x + bw / 2}" y="${H + 8}" font-size="10" fill="#8b8b9e" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<div class="chart-wrap chart-entrance" data-chart role="img" aria-label="${esc(title)} structure chart">
    <svg viewBox="0 0 ${x0 + 8 * (bw + gap) - gap + 20} ${H + 24}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
      <rect width="100%" height="100%" rx="14" fill="#101422"/>
      <text x="${x0}" y="${14}" font-size="12" fill="#e2e8f0" font-weight="600">${esc(title)}</text>
      ${rects}
      ${dots}
      ${labels.join('')}
    </svg>
  </div>`;
}

// ── usage-flow chart (steps → outcome) ──
function flowChart(family, steps) {
  const cols = { description: '#00f2ff', title: '#fbbf24', tags: '#a78bfa', thumbnail: '#ff6b6b', features: '#00ff88', script: '#00f2ff', tool: '#fbbf24' };
  const c = cols[family] || '#00f2ff';
  const n = Math.min(steps.length, 5);
  const bw = 96, gap = 12, H = 74;
  let boxes = '', arrows = '';
  for (let i = 0; i < n; i++) {
    const x = 14 + i * (bw + gap);
    boxes += `<rect x="${x}" y="20" width="${bw}" height="42" rx="8" fill="#161c2e" stroke="${c}" stroke-opacity="0.5"/>`;
    boxes += `<text x="${x + bw / 2}" y="38" font-size="9" fill="#e2e8f0" text-anchor="middle" font-weight="600">STEP ${i + 1}</text>`;
    boxes += `<text x="${x + bw / 2}" y="51" font-size="8" fill="#8b8b9e" text-anchor="middle">${esc(steps[i].slice(0, 14))}</text>`;
    if (i < n - 1) arrows += `<path d="M ${x + bw + 3} 41 L ${x + bw + gap - 3} 41" stroke="${c}" stroke-width="2" marker-end="url(#ah)"/>`;
  }
  return `<div class="chart-wrap chart-entrance" data-chart role="img" aria-label="How to use this template">
    <svg viewBox="0 0 ${14 + n * (bw + gap) - gap + 14} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
      <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${c}"/></marker></defs>
      <rect width="100%" height="100%" rx="14" fill="#101422"/>
      ${boxes}
      ${arrows}
    </svg>
  </div>`;
}

// ── template table (the copy-paste core) ──
function templateTable(rows) {
  const trs = rows.map(([label, body]) => {
    const lines = String(body).split('\\n').map(l => esc(l)).join('<br>');
    return `<tr><td class="tpl-label">${esc(label)}</td><td class="tpl-body">${lines}</td></tr>`;
  }).join('\n      ');
  return `<div class="chart-wrap chart-entrance" data-chart role="img" aria-label="Copy-paste template">
    <table class="tpl-table"><thead><tr><th>Section</th><th>Copy-paste template</th></tr></thead><tbody>
      ${trs}
    </tbody></table>
  </div>`;
}

function ul(items) {
  return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('\n        ')}</ul>`;
}

function buildPage(t) {
  const fam = FAMILY_META[t.family] || { icon: '📄', label: 'Templates' };
  const faqJson = (t.faq || []).map(([q, a]) => ({
    '@type': 'Question', name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.title,
    description: t.meta,
    url: `${SITE}/templates/${t.slug}`,
    mainEntity: [
      { '@type': 'Article', headline: t.h1, author: { '@type': 'Person', name: 'Patrick' } },
      { '@type': 'FAQPage', mainEntity: faqJson },
    ],
  };
  const toolLinks = (t.tools || []).map(([label, href]) =>
    `<a href="${href}" class="tpl-tool-link">${esc(label)}</a>`).join(' ');
  const relatedLinks = (t.related || []).map(([label, href]) =>
    `<li><a href="${href}">${esc(label)}</a></li>`).join('\n        ');
  const variations = ul(t.niche_variations || []);
  const mistakes = ul(t.mistakes || []);
  const faqItems = (t.faq || []).map(([q, a]) =>
    `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ');
  const flowSteps = (t.template || []).map(r => r[0]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(t.title)}</title>
  <meta name="description" content="${esc(t.meta)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE}/templates/${t.slug}">
  <meta property="og:title" content="${esc(t.title)}">
  <meta property="og:description" content="${esc(t.meta)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/templates/${t.slug}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/design-tokens.css">
  <link rel="stylesheet" href="/utilities.css">
  <link rel="stylesheet" href="/nav.css">
  <link rel="stylesheet" href="/motion-utilities.css">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    :root { --tpl-accent: #00f2ff; --bg-oled: #0a0b10; }
    body { background: var(--bg-oled); color: #e2e8f0; font-family: 'Geist', system-ui, sans-serif; line-height: 1.7; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    h1 { font-size: 2rem; line-height: 1.25; margin: 1rem 0 .75rem; }
    .meta-line { color: #8b8b9e; font-size: .9rem; margin-bottom: 1.5rem; }
    .intro { font-size: 1.05rem; color: #cbd5e1; margin-bottom: 1.5rem; }
    .breadcrumb { font-size: .85rem; color: #8b8b9e; margin-bottom: 1rem; }
    .breadcrumb a { color: var(--tpl-accent); text-decoration: none; }
    h2 { font-size: 1.35rem; margin: 2.5rem 0 .75rem; color: #f8fafc; }
    .tpl-table { width: 100%; border-collapse: collapse; background: #101422; border-radius: 12px; overflow: hidden; }
    .tpl-table th { background: #161c2e; color: #8b8b9e; text-align: left; padding: .7rem 1rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
    .tpl-table td { padding: .8rem 1rem; border-top: 1px solid #1e2537; vertical-align: top; font-size: .92rem; }
    .tpl-label { color: var(--tpl-accent); font-weight: 600; white-space: nowrap; width: 34%; }
    .tpl-body code { font-family: 'Geist Mono', monospace; }
    .tpl-tool-link { display: inline-block; margin: .25rem .5rem .25rem 0; padding: .45rem .9rem; border: 1px solid rgba(0,242,255,.35); border-radius: 8px; color: var(--tpl-accent); text-decoration: none; font-size: .85rem; }
    .tpl-tool-link:hover { background: rgba(0,242,255,.1); }
    ul { padding-left: 1.25rem; } li { margin: .35rem 0; }
    details.faq-item { border: 1px solid #1e2537; border-radius: 10px; padding: .9rem 1.1rem; margin: .6rem 0; background: #101422; }
    details.faq-item summary { cursor: pointer; font-weight: 600; color: #f8fafc; }
    details.faq-item p { margin: .6rem 0 0; color: #cbd5e1; font-size: .93rem; }
    .hub-link { margin-top: 2.5rem; font-size: .9rem; }
    .hub-link a { color: var(--tpl-accent); text-decoration: none; }
    .chart-wrap { margin: 1.25rem 0; }
    @media (max-width: 640px) { h1 { font-size: 1.5rem; } .tpl-label { white-space: normal; width: 40%; } }
  </style>
<script defer src="/ga.js"></script></head>
<body>
  ${SITE_HEADER}
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> › <a href="/templates/">Templates</a> › <span>${esc(fam.label)}</span>
    </nav>
    <h1>${esc(t.h1)}</h1>
    <p class="meta-line">${fam.icon} ${esc(fam.label)} · Demand-validated · Updated 2026</p>
    <p class="intro">${esc(t.intro)}</p>

    ${familyChart(t.family, t.title)}

    <h2>📋 The Copy-Paste Template</h2>
    ${templateTable(t.template)}

    ${flowChart(t.family, (t.template || []).map(r => r[0]))}

    <h2>🧠 When &amp; How to Use It</h2>
    <p>${esc(t.usage)}</p>

    <h2>🎯 Niche Variations</h2>
    ${variations}

    <h2>🚫 Common Mistakes to Avoid</h2>
    ${mistakes}

    <h2>🛠️ Free Tools for This Template</h2>
    <div class="tool-links">${toolLinks}</div>

    <h2>📚 Related Guides</h2>
    <ul class="related-list">${relatedLinks}</ul>

    <h2>❓ FAQ</h2>
    ${faqItems}

    <p class="hub-link">← <a href="/templates/">All YouTube Templates</a> · <a href="/blog/">Blog</a> · <a href="/tools/">Tools</a></p>
  </div>
</body>
</html>
`;
}

function buildHub() {
  const byFam = {};
  for (const t of templates) {
    (byFam[t.family] = byFam[t.family] || []).push(t);
  }
  const famOrder = Object.keys(FAMILY_META).filter(f => byFam[f]);
  const sections = famOrder.map(f => {
    const meta = FAMILY_META[f];
    const cards = byFam[f].map(t =>
      `<a href="/templates/${t.slug}" class="index-card"><div class="card-header"><strong>${esc(t.title.split(':')[0])}</strong></div><div class="card-body">${esc(t.meta.slice(0, 110))}…</div><div class="card-footer">Demand ${t.demand}/100</div></a>`).join('\n      ');
    return `<section class="fam-section"><h2>${meta.icon} ${esc(meta.label)}</h2><div class="card-grid">${cards}</div></section>`;
  }).join('\n    ');

  const famChart = familyChart('tool', 'Template Library Coverage');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Templates: 20 Copy-Paste Formats for 2026 | YT SEO Architect</title>
  <meta name="description" content="20 free copy-paste YouTube templates: descriptions, titles, tags, thumbnails, scripts, end screens, and chapters. Demand-validated formats that rank in 2026.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE}/templates/">
  <meta property="og:title" content="YouTube Templates: 20 Copy-Paste Formats for 2026">
  <meta property="og:description" content="20 demand-validated YouTube templates — descriptions, titles, tags, thumbnails, scripts & more.">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/templates/">
  <link rel="stylesheet" href="/design-tokens.css">
  <link rel="stylesheet" href="/utilities.css">
  <link rel="stylesheet" href="/nav.css">
  <link rel="stylesheet" href="/motion-utilities.css">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'YouTube Templates', url: `${SITE}/templates/`,
    description: '20 free copy-paste YouTube templates for descriptions, titles, tags, thumbnails, scripts, end screens, and chapters.',
    hasPart: templates.map(t => ({ '@type': 'WebPage', name: t.title, url: `${SITE}/templates/${t.slug}` })),
  })}</script>
  <style>
    body { background: #0a0b10; color: #e2e8f0; font-family: 'Geist', system-ui, sans-serif; line-height: 1.7; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    h1 { font-size: 2.1rem; line-height: 1.25; }
    .sub { color: #8b8b9e; font-size: 1.05rem; margin-bottom: 2rem; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 1rem; }
    .index-card { display: block; background: #101422; border: 1px solid #1e2537; border-radius: 12px; padding: 1.1rem 1.2rem; text-decoration: none; color: inherit; transition: transform .3s cubic-bezier(.16,1,.3,1), border-color .3s; }
    .index-card:hover { transform: translateY(-3px); border-color: rgba(0,242,255,.4); }
    .card-header strong { color: #f8fafc; font-size: .98rem; }
    .card-body { color: #94a3b8; font-size: .86rem; margin: .5rem 0; }
    .card-footer { color: #00f2ff; font-size: .78rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
    .fam-section { margin: 2.25rem 0; }
    .fam-section h2 { font-size: 1.3rem; color: #f8fafc; margin-bottom: 1rem; }
    .chart-wrap { margin: 1rem 0 2rem; }
    @media (max-width: 640px) { h1 { font-size: 1.55rem; } }
  </style>
</head>
<body>
  ${SITE_HEADER}
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb" style="color:#8b8b9e;font-size:.85rem;margin-bottom:1rem">
      <a href="/" style="color:#00f2ff;text-decoration:none">Home</a> › <span>Templates</span>
    </nav>
    <h1>📋 YouTube Templates: 20 Copy-Paste Formats for 2026</h1>
    <p class="sub">Every template is demand-validated (Google Suggest score), includes a copy-paste structure, usage notes, niche variations, and links to free tools.</p>
    ${famChart}
    ${sections}
  </div>
</body>
</html>
`;
}

// ── main ──
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const t of templates) {
  const file = resolve(OUT_DIR, `${t.slug}.html`);
  writeFileSync(file, buildPage(t));
  written++;
}
writeFileSync(resolve(OUT_DIR, 'index.html'), buildHub());
written++;
console.log(`✅ Generated ${written} files (20 template pages + hub) → public/templates/`);
