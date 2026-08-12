#!/usr/bin/env node
/**
 * Generates goal3 pillar pages at public/guides/ from scripts/pillars-data.js.
 * Each pillar: 1500+ words, unique title/meta/H1/FAQ, original checklist +
 * mini case study, descriptive-anchor cluster links, tool links, JSON-LD
 * (WebPage + Article + FAQPage + BreadcrumbList), motion-utilities CSS,
 * animated visuals (chart-entrance) per site standards.
 *
 * Usage: node scripts/generate-pillars.mjs [--dry-run] [--slug <slug>]
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PILLARS } from './pillars-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const OUT_DIR = resolve(PROJECT, 'public/guides');
const SITE = 'https://yt-seo-architect.vercel.app';
const DRY_RUN = process.argv.includes('--dry-run');
const onlySlug = process.argv.includes('--slug') ? process.argv[process.argv.indexOf('--slug') + 1] : null;

mkdirSync(OUT_DIR, { recursive: true });

const HEADER = `  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="header-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/><circle cx="12" cy="12" r="10"/></svg>
        YT <span>SEO</span> Architect
      </a>
      <nav class="header-nav" id="header-nav">
        <a href="/tools">Tools</a>
        <a href="/blog">Blog</a>
        <a href="/templates/">Templates</a>
        <a href="/guides/">Guides</a>
        <a href="/glossary/">Glossary</a>
        <a href="/dashboard" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">&#9776;</button>
    </div>
  </header>`;

const FOOTER = `  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col"><h4>Product</h4><a href="/dashboard">Dashboard</a><a href="/changelog">Changelog</a></div>
      <div class="footer-col"><h4>Resources</h4><a href="/blog">Blog</a><a href="/guides/">Guides</a><a href="/templates/">Templates</a><a href="/glossary/">Glossary</a></div>
      <div class="footer-col"><h4>Company</h4><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy</a><a href="/terms-of-service">Terms</a></div>
      <div class="footer-col"><h4>Social</h4><a href="https://twitter.com/YTSEOArchitect" target="_blank" rel="noopener">Twitter / X</a><a href="https://github.com/nhlaka3" target="_blank" rel="noopener">GitHub</a></div>
    </div>
    <div class="footer-bottom"><span>&copy; 2026 YT SEO Architect. All rights reserved.</span></div>
  </footer>`;

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlock(block, pillar) {
  switch (block.type) {
    case 'p':
      return `    <p>${block.text}</p>\n`;
    case 'list':
      return `    <ul class="pillar-list">${block.items.map(i => `\n      <li>${i}</li>`).join('')}\n    </ul>\n`;
    case 'checklist':
      return `    <div class="checklist-box chart-entrance" role="list" aria-label="${esc(block.title)}">
      <h3 class="checklist-title">✅ ${esc(block.title)}</h3>
      <ul>${block.items.map(i => `\n        <li>☐ ${i}</li>`).join('')}\n      </ul>
    </div>\n`;
    case 'case':
      return `    <div class="case-study chart-entrance" role="note" aria-label="Mini case study">
      <h3 class="case-title">📊 ${esc(block.title)}</h3>
      <p>${block.text}</p>
    </div>\n`;
    case 'link':
      return `    <p class="deeper-link"><a href="${block.url}">→ ${esc(block.title)}</a> — ${block.text}</p>\n`;
    case 'tool':
      return `    <div class="tool-cta chart-entrance" role="note">
      <h3 class="tool-cta-title">🛠️ ${esc(block.title)}</h3>
      <p>${block.text}</p>
      <a href="${block.url}" class="tool-cta-btn">Launch the Tool →</a>
    </div>\n`;
    default:
      return '';
  }
}

function renderPillar(p) {
  const url = `${SITE}/guides/${p.slug}`;
  const wordCount = (() => {
    // rough: paragraphs + list/checklist/case text + faq
    let w = 0;
    for (const s of p.sections) {
      for (const b of s.blocks) {
        if (b.type === 'p') w += b.text.split(/\s+/).length;
        if (b.type === 'list') w += b.items.join(' ').split(/\s+/).length;
        if (b.type === 'checklist') w += b.items.join(' ').split(/\s+/).length + b.title.split(/\s+/).length;
        if (b.type === 'case') w += b.text.split(/\s+/).length + b.title.split(/\s+/).length;
        if (b.type === 'link') w += (b.title + ' ' + b.text).split(/\s+/).length;
        if (b.type === 'tool') w += (b.title + ' ' + b.text).split(/\s+/).length;
      }
    }
    for (const [q, a] of p.faq) w += (q + ' ' + a).split(/\s+/).length;
    return w;
  })();

  const toc = p.sections.map((s, i) =>
    `<li><a href="#sec-${i + 1}">${esc(s.h2.replace(/^[^—]*—\s*/, ''))}</a></li>`).join('\n        ');

  const body = p.sections.map((s, i) => {
    const blocks = s.blocks.map(b => renderBlock(b, p)).join('');
    return `  <section id="sec-${i + 1}" class="pillar-section">
    <h2>${esc(s.h2)}</h2>
${blocks}  </section>\n`;
  }).join('\n');

  const faqItems = p.faq.map(([q, a]) =>
    `    <details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');

  const clusters = p.clusters.map(([t, u]) =>
    `      <li><a href="${u}">${esc(t)}</a></li>`).join('\n');

  const tools = p.tools.map(([t, u]) =>
    `      <a href="${u}" class="tpl-tool-link">${esc(t)}</a>`).join(' ');

  const siblings = PILLARS.filter(x => x.slug !== p.slug).map(x =>
    `      <a class="pillar-card chart-entrance" href="/guides/${x.slug}">
        <strong>${esc(x.h1.split(':')[0])}</strong>
        <span>${esc(x.meta.slice(0, 110))}…</span>
      </a>`).join('\n');

  const faqSchema = {
    '@type': 'FAQPage',
    mainEntity: p.faq.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.h1,
    description: p.meta,
    url,
    datePublished: '2026-08-12',
    dateModified: '2026-08-12',
    author: { '@type': 'Person', name: 'Patrick', url: `${SITE}/about` },
    publisher: { '@type': 'Organization', name: 'YT SEO Architect', url: SITE },
    timeRequired: p.readingTime,
    mainEntityOfPage: url,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/guides/` },
      { '@type': 'ListItem', position: 3, name: p.h1.split(':')[0], item: url },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.meta)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.meta)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/design-tokens.css">
  <link rel="stylesheet" href="/utilities.css">
  <link rel="stylesheet" href="/nav.css">
  <link rel="stylesheet" href="/motion-utilities.css">
  <script type="application/ld+json">${JSON.stringify([articleSchema, faqSchema, breadcrumbSchema])}</script>
  <style>
    :root { --pillar-accent: #00f2ff; --pillar-green: #00ff88; }
    body { background: #0a0b10; color: #e2e8f0; font-family: 'Geist', system-ui, sans-serif; line-height: 1.75; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    .breadcrumb { font-size: .85rem; color: #8b8b9e; margin-bottom: 1rem; }
    .breadcrumb a { color: var(--pillar-accent); text-decoration: none; }
    h1 { font-size: 2.05rem; line-height: 1.25; margin: 1rem 0 .6rem; color: #f8fafc; }
    .meta-line { color: #8b8b9e; font-size: .9rem; margin-bottom: 1.25rem; }
    .meta-line .pillar-badge { display: inline-block; background: rgba(0,242,255,.1); border: 1px solid rgba(0,242,255,.25); color: var(--pillar-accent); border-radius: 999px; padding: .1rem .55rem; font-size: .72rem; font-weight: 600; margin-right: .5rem; text-transform: uppercase; letter-spacing: .04em; }
    .intro { font-size: 1.08rem; color: #cbd5e1; margin-bottom: 1.5rem; }
    .toc { background: #101422; border: 1px solid #1e2537; border-radius: 12px; padding: 1.1rem 1.3rem; margin: 1.25rem 0 2rem; font-size: .92rem; }
    .toc summary { cursor: pointer; font-weight: 700; color: #f8fafc; }
    .toc ol { margin: .6rem 0 0; padding-left: 1.25rem; }
    .toc li { margin: .3rem 0; }
    .toc a { color: #cbd5e1; text-decoration: none; }
    .toc a:hover { color: var(--pillar-accent); }
    h2 { font-size: 1.4rem; margin: 2.75rem 0 .75rem; color: #f8fafc; padding-top: .25rem; }
    .pillar-section p { margin: .75rem 0; color: #cbd5e1; }
    .pillar-list li { margin: .4rem 0; color: #cbd5e1; }
    .checklist-box { background: #101422; border: 1px solid rgba(0,255,136,.25); border-radius: 12px; padding: 1.1rem 1.3rem; margin: 1.25rem 0; }
    .checklist-title { color: var(--pillar-green); font-size: 1rem; margin-bottom: .6rem; }
    .checklist-box ul { list-style: none; padding-left: 0; }
    .checklist-box li { color: #cbd5e1; margin: .45rem 0; font-size: .95rem; }
    .case-study { background: #101422; border: 1px solid rgba(0,242,255,.25); border-radius: 12px; padding: 1.1rem 1.3rem; margin: 1.25rem 0; }
    .case-title { color: var(--pillar-accent); font-size: 1rem; margin-bottom: .5rem; }
    .case-study p { color: #cbd5e1; font-size: .95rem; margin: 0; }
    .deeper-link { background: rgba(0,242,255,.04); border-left: 3px solid var(--pillar-accent); padding: .55rem .9rem; margin: .9rem 0; font-size: .93rem; }
    .deeper-link a { color: var(--pillar-accent); text-decoration: none; font-weight: 600; }
    .deeper-link a:hover { text-decoration: underline; }
    .tool-cta { background: rgba(0,242,255,.05); border: 1px solid rgba(0,242,255,.22); border-radius: 12px; padding: 1.3rem; margin: 1.5rem 0; text-align: center; }
    .tool-cta-title { color: var(--pillar-accent); font-size: 1.05rem; margin-bottom: .5rem; }
    .tool-cta p { color: #a8b2c1; font-size: .95rem; margin-bottom: .9rem; }
    .tool-cta-btn { display: inline-block; background: var(--pillar-accent); color: #000; padding: .65rem 1.6rem; border-radius: 8px; text-decoration: none; font-weight: 700; }
    .tool-cta-btn:hover { filter: brightness(1.15); }
    .faq-item { border: 1px solid #1e2537; border-radius: 10px; padding: .9rem 1.1rem; margin: .6rem 0; background: #101422; }
    .faq-item summary { cursor: pointer; font-weight: 600; color: #f8fafc; }
    .faq-item p { margin: .6rem 0 0; color: #cbd5e1; font-size: .93rem; }
    .cluster-section { background: #101422; border: 1px solid #1e2537; border-radius: 12px; padding: 1.1rem 1.3rem; margin: 1.5rem 0; }
    .cluster-section ul { padding-left: 1.25rem; }
    .cluster-section li { margin: .45rem 0; }
    .cluster-section a { color: var(--pillar-accent); text-decoration: none; }
    .cluster-section a:hover { text-decoration: underline; }
    .tpl-tool-link { display: inline-block; margin: .25rem .5rem .25rem 0; padding: .45rem .9rem; border: 1px solid rgba(0,242,255,.35); border-radius: 8px; color: var(--pillar-accent); text-decoration: none; font-size: .85rem; }
    .tpl-tool-link:hover { background: rgba(0,242,255,.1); }
    .pillar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; margin: 1.25rem 0; }
    .pillar-card { display: block; background: #101422; border: 1px solid #1e2537; border-radius: 12px; padding: 1.1rem; text-decoration: none; color: inherit; }
    .pillar-card:hover { border-color: rgba(0,242,255,.4); background: rgba(0,242,255,.04); }
    .pillar-card strong { display: block; color: #f8fafc; margin-bottom: .35rem; font-size: .95rem; }
    .pillar-card span { color: #8b8b9e; font-size: .82rem; }
    .hub-link { margin-top: 2rem; font-size: .9rem; color: #8b8b9e; }
    .hub-link a { color: var(--pillar-accent); text-decoration: none; }
    .wordcount-note { display: none; } /* body word count for QA: ${wordCount} */
  </style>
</head>
<body>
${HEADER}
  <div class="wrap">
    <div class="breadcrumb"><a href="/">Home</a> › <a href="/guides/">Guides</a> › <span>${esc(p.h1.split(':')[0])}</span></div>
    <h1>${esc(p.h1)}</h1>
    <p class="meta-line"><span class="pillar-badge">Pillar Guide</span> Updated ${p.updated} · ${p.readingTime} · By <a href="/about" style="color:var(--pillar-accent);text-decoration:none;font-weight:600;">Patrick</a></p>
    <p class="intro">${p.intro}</p>
    <details class="toc" open>
      <summary>📑 In This Guide</summary>
      <ol>
        ${toc}
      </ol>
    </details>

${body}
    <section id="clusters" class="pillar-section cluster-section chart-entrance">
      <h2>📚 Cluster Articles — Go Deeper on Each Layer</h2>
      <p>These articles cover each part of this guide in depth. They link back here, and together they form the complete topic cluster for this pillar.</p>
      <ul>
${clusters}
      </ul>
    </section>

    <section id="tools" class="pillar-section chart-entrance">
      <h2>🛠️ Free Tools for This Pillar</h2>
      <div class="tool-links">
${tools}
      </div>
    </section>

    <section id="faq" class="pillar-section">
      <h2>❓ Frequently Asked Questions</h2>
${faqItems}
    </section>

    <h2 class="hub-link">📖 Other Pillar Guides</h2>
    <div class="pillar-grid">
${siblings}
    </div>

    <p class="hub-link">← <a href="/guides/">All Guides</a> · <a href="/blog/">Blog</a> · <a href="/templates/">Templates</a> · <a href="/tools/">Tools</a></p>
  </div>
${FOOTER}
</body>
</html>
`;
}

const targets = PILLARS.filter(p => !onlySlug || p.slug === onlySlug);
let generated = [];
for (const p of targets) {
  const html = renderPillar(p);
  // sanity: word count of visible text
  const words = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const filePath = resolve(OUT_DIR, `${p.slug}.html`);
  if (!DRY_RUN) writeFileSync(filePath, html);
  generated.push({ slug: p.slug, words });
  console.log(`${DRY_RUN ? '[dry] ' : ''}${p.slug}: ~${words} body words -> ${filePath}`);
}
console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}generated ${generated.length} pillar pages`);
