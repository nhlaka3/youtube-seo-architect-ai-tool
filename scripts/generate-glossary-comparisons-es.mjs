#!/usr/bin/env node
/**
 * scripts/generate-glossary-comparisons-es.mjs
 *
 * Generates Spanish comparison pages for every unique pair of glossary terms.
 * Pattern: /glossary/es/{term-a}-vs-{term-b}
 *
 * Usage:
 *   node scripts/generate-glossary-comparisons-es.mjs
 *   node scripts/generate-glossary-comparisons-es.mjs --dry-run
 *   node scripts/generate-glossary-comparisons-es.mjs --single slug-a slug-b
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const ES_DATA_FILE = resolve(PROJECT, 'scripts/glossary-data-es.json');
const OUTPUT_DIR = resolve(PROJECT, 'public/glossary/es');

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_MODE = process.argv.includes('--single');

const SITE = 'https://yt-seo-architect.vercel.app';

function loadData() {
  try {
    return JSON.parse(readFileSync(ES_DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('❌ No se pudo cargar glossary-data-es.json. Ejecuta translate-glossary-es.mjs primero.');
    process.exit(1);
  }
}

function getCategoryEmoji(slug) {
  const map = { 'analytics':'📊','algorithm':'🤖','seo-optimization':'🔍','monetization':'💰','content-strategy':'📝','youtube-features':'⚙️' };
  return map[slug] || '📖';
}

function getCategoryName(data, slug) {
  const cat = data.categories.find(c => c.slug === slug);
  return cat ? (cat.name_es || cat.name) : slug;
}

function generateComparisonPage(a, b, aName, bName, aCat, bCat, aDef, bDef, allTerms) {
  const catNameA = aCat;
  const catNameB = bCat;

  // Find related comparisons (same terms, different pairs)
  const related = [];
  for (const t of allTerms) {
    if (t.slug === a || t.slug === b) continue;
    // Compare with A
    const slugAA = a < t.slug ? a : t.slug;
    const slugAB = a < t.slug ? t.slug : a;
    const tNameA = t.term_es || t.term;
    if (related.length < 3) {
      related.push(`<a href="/glossary/es/${slugAA}-vs-${slugAB}" class="related-card">⚖️ ${aName} vs ${tNameA}</a>`);
    }
  }

  const relatedHTML = related.join('\n        ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${aName} vs ${bName}: Diferencias Clave para Creadores de YouTube | YT SEO Architect</title>
  <meta name="description" content="Compara ${aName} y ${bName}: definiciones, diferencias clave, cuándo enfocarte en cada uno y cómo afectan tu estrategia de YouTube SEO." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/glossary/es/${a}-vs-${b}" />
  <meta property="og:title" content="${aName} vs ${bName}: Diferencias Clave para YouTube" />
  <meta property="og:description" content="Compara ${aName} y ${bName} para tu estrategia de YouTube SEO." />
  <meta property="og:url" content="${SITE}/glossary/es/${a}-vs-${b}" />
  <link rel="alternate" hreflang="en" href="${SITE}/glossary/${a}-vs-${b}" />
  <link rel="alternate" hreflang="es" href="${SITE}/glossary/es/${a}-vs-${b}" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/glossary/${a}-vs-${b}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${aName} vs ${bName}: Diferencias Clave",
    "description": "Comparación detallada entre ${aName} y ${bName} para creadores de YouTube.",
    "inLanguage": "es",
    "author": {"@type": "Person", "name": "Patrick"},
    "publisher": {"@type": "Organization", "name": "YT SEO Architect"}
  }
  </script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit','Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}
    .header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.5rem;background:#0f0c29;border-bottom:1px solid rgba(255,255,255,.05)}
    .header a{color:#e2e8f0;text-decoration:none;font-weight:600}
    .header .cta{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem}
    main{max-width:720px;margin:0 auto;padding:2rem 1.5rem}
    h1{font-size:1.8rem;margin-bottom:.5rem;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#8b8b9e;font-size:.95rem;margin-bottom:2rem;line-height:1.6}
    .comparison-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
    .comparison-card h2{color:#a5b4fc;font-size:1.1rem;margin-bottom:.75rem}
    .comparison-card p{color:#94a3b8;line-height:1.7;margin:.5rem 0}
    .vs-divider{text-align:center;font-size:1.5rem;font-weight:800;color:#f97316;padding:.5rem 0}
    .category-badge{display:inline-block;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.3);color:#f97316;padding:.2rem .6rem;border-radius:9999px;font-size:.75rem;font-weight:600}
    .dimension{display:flex;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.9rem}
    .dimension:last-child{border-bottom:none}
    .dimension .label{color:#8b8b9e}
    .dimension .value-a{color:#fb923c;font-weight:600}
    .dimension .value-b{color:#a5b4fc;font-weight:600}
    .lang-notice{text-align:center;font-size:.8rem;color:#8b8b9e;margin-bottom:1.5rem}
    .lang-notice a{color:#a5b4fc}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;margin:1rem 0}
    .related-card{background:#15133a;border:1px solid #2d2a5e;border-radius:8px;padding:.75rem;text-decoration:none;color:#a5b4fc;font-size:.85rem;font-weight:600;transition:all .2s}
    .related-card:hover{background:#312e81;color:#fff;transform:translateY(-2px)}
    .cta-box{border:1px solid #4f46e5;border-radius:12px;padding:1.5rem;text-align:center;margin:2rem 0}
    .cta-box h3{color:#e2e8f0;margin-bottom:.5rem}
    .cta-box p{color:#8b8b9e;font-size:.85rem;margin-bottom:1rem}
    .cta-box a{display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.6rem 1.5rem;border-radius:9999px;text-decoration:none;font-weight:600}
    footer{text-align:center;padding:2rem;color:#6b7280;font-size:.8rem}
    footer a{color:#8b8b9e;text-decoration:none}
    @media(max-width:480px){.dimension{flex-direction:column;gap:4px}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/glossary/es/" class="cta">📖 Glosario</a>
  </header>
  <main>
    <div class="lang-notice">🇪🇸 Comparación en español · <a href="/glossary/${a}-vs-${b}">🇺🇸 View in English</a></div>

    <h1>${aName} vs ${bName}</h1>
    <p class="sub">Comparación detallada: diferencias, similitudes y cuándo enfocarte en cada concepto para tu estrategia de YouTube SEO.</p>

    <div class="comparison-card">
      <h2>📖 ${aName}</h2>
      <span class="category-badge">${getCategoryEmoji(aCat)} ${catNameA}</span>
      <p>${aDef}</p>
    </div>

    <div class="vs-divider">⚡ VS ⚡</div>

    <div class="comparison-card">
      <h2>📖 ${bName}</h2>
      <span class="category-badge">${getCategoryEmoji(bCat)} ${catNameB}</span>
      <p>${bDef}</p>
    </div>

    <div class="comparison-card">
      <h2>⚖️ Diferencias Clave</h2>
      <div class="dimension"><span class="label">Enfoque principal</span><span class="value-a">${aName}</span><span class="value-b">${bName}</span></div>
      <div class="dimension"><span class="label">Impacto en SEO</span><span class="value-a">Directo</span><span class="value-b">Complementario</span></div>
      <div class="dimension"><span class="label">Dificultad de optimización</span><span class="value-a">Media</span><span class="value-b">Variable</span></div>
      <div class="dimension"><span class="label">Prioridad para principiantes</span><span class="value-a">Alta</span><span class="value-b">Alta</span></div>
    </div>

    <div class="comparison-card">
      <h2>🔗 Comparaciones Relacionadas</h2>
      <div class="related-grid">
        ${relatedHTML}
      </div>
    </div>

    <div class="cta-box">
      <h3>🚀 Domina el SEO de YouTube</h3>
      <p>Usa nuestras herramientas gratuitas para optimizar tu contenido.</p>
      <a href="/tools/">Prueba las Herramientas Gratis →</a>
    </div>
  </main>
  <footer>
    <p>&copy; 2026 YT SEO Architect · <a href="/glossary/es/">Glosario</a> · <a href="/tools/">Herramientas</a> · <a href="/blog">Blog</a></p>
  </footer>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────

function main() {
  console.log('\n🌐 Generando páginas de comparación en español...\n');

  const data = loadData();
  const terms = data.terms;
  const total = terms.length;

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Handle single pair mode
  if (SINGLE_MODE) {
    const slugA = process.argv[process.argv.indexOf('--single') + 1];
    const slugB = process.argv[process.argv.indexOf('--single') + 2];
    const termA = terms.find(t => t.slug === slugA);
    const termB = terms.find(t => t.slug === slugB);
    if (!termA || !termB) {
      console.error('❌ Términos no encontrados');
      process.exit(1);
    }
    const aFirst = slugA < slugB;
    const pairs = [{
      a: aFirst ? termA : termB, b: aFirst ? termB : termA,
      slug: aFirst ? `${slugA}-vs-${slugB}` : `${slugB}-vs-${slugA}`
    }];
    for (const pair of pairs) {
      const html = generateComparisonPage(
        pair.a.slug, pair.b.slug,
        pair.a.term_es || pair.a.term, pair.b.term_es || pair.b.term,
        pair.a.category, pair.b.category,
        pair.a.shortDefinition_es || pair.a.shortDefinition,
        pair.b.shortDefinition_es || pair.b.shortDefinition,
        terms
      );
      if (!DRY_RUN) writeFileSync(resolve(OUTPUT_DIR, `${pair.slug}.html`), html);
      console.log(`  ✅ es/${pair.slug}.html`);
    }
    console.log('\n');
    return;
  }

  // Full mode: generate all pairs
  const pairs = [];
  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      const a = terms[i];
      const b = terms[j];
      const slugA = a.slug;
      const slugB = b.slug;
      const aFirst = slugA < slugB;
      pairs.push({
        a: aFirst ? a : b, b: aFirst ? b : a,
        slug: aFirst ? `${slugA}-vs-${slugB}` : `${slugB}-vs-${slugA}`
      });
    }
  }

  let generated = 0;
  let totalBytes = 0;

  for (const pair of pairs) {
    const html = generateComparisonPage(
      pair.a.slug, pair.b.slug,
      pair.a.term_es || pair.a.term, pair.b.term_es || pair.b.term,
      pair.a.category, pair.b.category,
      pair.a.shortDefinition_es || pair.a.shortDefinition,
      pair.b.shortDefinition_es || pair.b.shortDefinition,
      terms
    );

    if (!DRY_RUN) {
      writeFileSync(resolve(OUTPUT_DIR, `${pair.slug}.html`), html);
    }

    generated++;
    totalBytes += Buffer.byteLength(html);
  }

  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(`  ✅ ${generated} páginas de comparación generadas`);
  console.log(`  📦 ${mb} MB total`);
  console.log(`  📍 public/glossary/es/\n`);
}

main();
