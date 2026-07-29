#!/usr/bin/env node
/**
 * scripts/generate-glossary-es.mjs
 *
 * Generates Spanish glossary pages from glossary-data-es.json.
 * Outputs to public/glossary/es/{slug}.html
 *
 * Usage:
 *   node scripts/generate-glossary-es.mjs
 *   node scripts/generate-glossary-es.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const ES_DATA_FILE = resolve(PROJECT, 'scripts/glossary-data-es.json');
const TEMPLATE_FILE = resolve(PROJECT, 'public/glossary/es/_template.html');
const OUTPUT_DIR = resolve(PROJECT, 'public/glossary/es');
const EN_GLOSSARY_DIR = resolve(PROJECT, 'public/glossary');

const DRY_RUN = process.argv.includes('--dry-run');

function loadData() {
  return JSON.parse(readFileSync(ES_DATA_FILE, 'utf-8'));
}

function loadTemplate() {
  return readFileSync(TEMPLATE_FILE, 'utf-8');
}

function getCategoryEmoji(slug) {
  const map = {
    'analytics': '📊', 'algorithm': '🤖', 'seo-optimization': '🔍',
    'monetization': '💰', 'content-strategy': '📝', 'youtube-features': '⚙️',
  };
  return map[slug] || '📖';
}

function getCategoryMeta(data, categorySlug) {
  return data.categories.find(c => c.slug === categorySlug);
}

function generateWhyItMatters(termData) {
  return termData.whyItMatters_es || `${termData.term_es} es un concepto importante de YouTube que todo creador debe entender para hacer crecer su canal de manera efectiva.`;
}

function generateHowToOptimize(termData) {
  return termData.howToOptimize_es || `Para empezar con ${termData.term_es.toLowerCase()}, investiga cómo otros creadores en tu nicho abordan este concepto. Comienza implementando una técnica nueva por video.`;
}

function generateFAQSection(termData) {
  const faq = termData.faq_es || { q1: '', a1: '', q2: '', a2: '' };
  const term = termData.term_es;
  const slug = termData.slug;

  const schemaQA = [];
  const htmlQA = [];
  let qIndex = 0;

  const addQA = (q, a) => {
    if (!q || !a) return;
    qIndex++;
    schemaQA.push({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]*>/g, '') }
    });
    htmlQA.push(
      `<div class="faq-item">` +
      `<div class="faq-question" onclick="this.parentElement.classList.toggle('open')">${q}</div>` +
      `<div class="faq-answer"><p>${a}</p></div></div>`
    );
  };

  addQA(faq.q1, faq.a1);
  addQA(faq.q2, faq.a2);

  const faqSchemaJSON = schemaQA.length > 0
    ? `<script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": ${JSON.stringify(schemaQA, null, 4).replace(/^/gm, '    ')}\n  }\n  </script>`
    : '';

  const faqSectionHTML = htmlQA.length > 0
    ? `\n      <h2>Preguntas Frecuentes Sobre ${term}</h2>\n      <p>Respuestas rápidas a las preguntas más comunes sobre ${term.toLowerCase()} para creadores de YouTube.</p>\n` + `      ${htmlQA.join('\n      ')}`
    : '';

  return { faqSchemaJSON, faqSectionHTML };
}

function generateRelatedTermsSection(termData, allTerms) {
  const related = termData.relatedTerms || [];
  if (related.length === 0) return '';

  const cards = related.map(slug => {
    const t = allTerms.find(t => t.slug === slug);
    if (!t) return null;
    const name = t.term_es || t.term;
    const def = t.shortDefinition_es || t.shortDefinition || '';
    return `<div class="related-card">
      <a href="/glossary/es/${t.slug}">${name}</a>
      <p>${def.substring(0, 100)}...</p>
    </div>`;
  }).filter(Boolean).join('\n      ');

  if (!cards) return '';
  return `\n      <h2>Términos Relacionados</h2>\n      <p>Amplía tus conocimientos con estos conceptos relacionados de SEO en YouTube:</p>\n      <div class="related-grid">\n      ${cards}\n      </div>`;
}

function generateComparisonsSection(termData, allTerms) {
  const slug = termData.slug;
  const termName = termData.term_es || termData.term;
  const comparisons = [];

  for (const other of allTerms) {
    if (other.slug === slug) continue;
    const slugA = slug < other.slug ? slug : other.slug;
    const slugB = slug < other.slug ? other.slug : slug;
    const otherName = other.term_es || other.term;
    comparisons.push({ slug: `${slugA}-vs-${slugB}`, b: other.slug, bTerm: otherName });
  }

  const sameCat = comparisons.filter(c => {
    const other = allTerms.find(t => t.slug === c.b);
    return other && other.category === termData.category;
  });
  const crossCat = comparisons.filter(c => {
    const other = allTerms.find(t => t.slug === c.b);
    return other && other.category !== termData.category;
  });
  const picks = [...sameCat.slice(0, 3), ...crossCat.slice(0, 2)].slice(0, 5);
  if (picks.length === 0) return '';

  const links = picks.map(p => {
    const other = allTerms.find(t => t.slug === p.b);
    return `<a href="/glossary/es/${p.slug}" class="related-card">⚖️ ${termName} vs ${other ? (other.term_es || other.term) : p.bTerm}</a>`;
  }).join('\n        ');

  return `\n      <h2>Comparar ${termName}</h2>\n      <p>Descubre cómo ${termName.toLowerCase()} se compara con conceptos relacionados:</p>\n      <div class="related-grid">${links}</div>`;
}

function generateShortAnswer(termData) {
  const def = termData.shortDefinition_es || termData.shortDefinition || '';
  const firstLetter = def.charAt(0).toLowerCase();
  return `es ${firstLetter}${def.slice(1)}`;
}

function truncateForSchema(text, maxLen = 200) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function countWords(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;
}

function generatePage(termData, template, allTerms, catMeta) {
  const whyItMatters = generateWhyItMatters(termData);
  const howToOptimize = generateHowToOptimize(termData);
  const { faqSchemaJSON, faqSectionHTML } = generateFAQSection(termData);
  const catName = catMeta ? (catMeta.name_es || catMeta.name) : termData.category_es || termData.category;

  const replacements = {
    '{{TERM}}': termData.term_es || termData.term,
    '{{SLUG}}': termData.slug,
    '{{SHORT_DEFINITION}}': termData.shortDefinition_es || termData.shortDefinition,
    '{{EXPANDED_DEFINITION}}': termData.expandedDefinition_es || termData.expandedDefinition,
    '{{CATEGORY_SLUG}}': termData.category,
    '{{CATEGORY_NAME}}': catName,
    '{{CATEGORY_EMOJI}}': getCategoryEmoji(termData.category),
    '{{SHORT_ANSWER}}': generateShortAnswer(termData),
    '{{WHY_IT_MATTERS}}': whyItMatters,
    '{{HOW_TO_OPTIMIZE}}': howToOptimize,
    '{{FAQ_SCHEMA}}': faqSchemaJSON,
    '{{COMMON_QUESTIONS_SECTION}}': faqSectionHTML,
    '{{RELATED_TERMS_SECTION}}': generateRelatedTermsSection(termData, allTerms),
    '{{COMPARISONS_SECTION}}': generateComparisonsSection(termData, allTerms),
    '{{SCHEMA_DESCRIPTION}}': truncateForSchema(termData.shortDefinition_es || termData.shortDefinition),
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }
  return html;
}

function generateIndexPage(data) {
  const categories = data.categories;
  const terms = data.terms;
  const total = terms.length;

  let catSections = '';
  for (const cat of categories) {
    const catTerms = terms.filter(t => t.category === cat.slug);
    if (catTerms.length === 0) continue;
    const catName = cat.name_es || cat.name;
    const termLinks = catTerms.map(t => {
      const name = t.term_es || t.term;
      const def = t.shortDefinition_es || t.shortDefinition || '';
      return `<div class="related-card"><a href="/glossary/es/${t.slug}">${name}</a><p>${def.substring(0, 120)}...</p></div>`;
    }).join('\n        ');

    catSections += `\n    <section id="${cat.slug}">
      <h2 style="color:#e0e7ff;font-size:1.3rem;margin:2rem 0 1rem;display:flex;align-items:center;gap:.5rem">
        ${getCategoryEmoji(cat.slug)} ${catName}
        <span style="font-size:.8rem;color:#8b8b9e;font-weight:400">(${catTerms.length} términos)</span>
      </h2>
      <div class="related-grid">${termLinks}</div>
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Glosario SEO de YouTube — ${total}+ Términos en Español | YT SEO Architect</title>
  <meta name="description" content="Glosario completo de SEO para YouTube con ${total}+ términos en español: analíticas, algoritmo, optimización, monetización, estrategia de contenido y funciones." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/glossary/es/" />
  <meta property="og:title" content="Glosario SEO de YouTube — ${total}+ Términos en Español" />
  <link rel="alternate" hreflang="en" href="https://yt-seo-architect.vercel.app/glossary/" />
  <link rel="alternate" hreflang="es" href="https://yt-seo-architect.vercel.app/glossary/es/" />
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
    .glossary-hero{padding:3rem 1.5rem;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);border-radius:1rem;margin-bottom:2rem;text-align:center}
    .glossary-hero h1{font-size:2rem;margin:0 0 .5rem;color:#fff}
    .glossary-hero p{color:#c4b5fd;font-size:1.1rem;max-width:600px;margin:0 auto}
    .glossary-hero .stat{display:inline-block;margin-top:1rem;background:rgba(99,102,241,.3);color:#a5b4fc;padding:.4rem 1.2rem;border-radius:9999px;font-size:.9rem}
    .lang-notice{text-align:center;margin-bottom:1rem;font-size:.85rem;color:#8b8b9e}
    .lang-notice a{color:#a5b4fc}
    .related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
    .related-card{background:#1e1b4b;border-radius:.75rem;padding:1rem;transition:all .2s}
    .related-card:hover{background:#312e81;transform:translateY(-2px)}
    .related-card a{color:#a5b4fc;text-decoration:none;font-weight:600;display:block;margin-bottom:.25rem}
    .related-card p{font-size:.8rem;color:#8b8b9e;margin:0}
    @media(max-width:640px){.glossary-hero{padding:2rem 1rem}.glossary-hero h1{font-size:1.5rem}}
  </style>
</head>
<body>
  <header class="header"><a href="/">⚡ YT SEO Architect</a><a href="/tools/" class="cta">Herramientas</a></header>
  <main>
    <div class="glossary-hero">
      <h1>📖 Glosario SEO de YouTube</h1>
      <p>${total}+ términos definidos y explicados para creadores de contenido en español.</p>
      <div class="stat">${total} términos · 6 categorías · Gratis</div>
    </div>
    <div class="lang-notice">🇪🇸 Estás viendo la versión en español. <a href="/glossary/">Ver en inglés →</a></div>
    ${catSections}
  </main>
  <footer class="footer"><p>&copy; 2026 YT SEO Architect</p></footer>
</body>
</html>`;
}

function main() {
  console.log('\n🌐 Generando páginas del glosario en español...\n');

  if (!existsSync(ES_DATA_FILE)) {
    console.error('❌ glossary-data-es.json not found. Run translate-glossary-es.mjs first.');
    process.exit(1);
  }

  const data = loadData();
  const template = loadTemplate();
  const terms = data.terms;
  const totalTerms = terms.length;

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;
  let totalWords = 0;

  for (const termData of terms) {
    const catMeta = getCategoryMeta(data, termData.category);
    const html = generatePage(termData, template, data.terms, catMeta);
    const words = countWords(html);
    const filePath = resolve(OUTPUT_DIR, `${termData.slug}.html`);

    if (!DRY_RUN) {
      writeFileSync(filePath, html);
    }

    const name = termData.term_es || termData.term;
    console.log(`  ✅ ${termData.slug}.html  [${name}]  ${words} palabras`);
    generated++;
    totalWords += words;
  }

  // Generate ES index page
  const indexHTML = generateIndexPage(data);
  if (!DRY_RUN) {
    writeFileSync(resolve(OUTPUT_DIR, 'index.html'), indexHTML);
  }

  const avgWords = Math.round(totalWords / generated);
  console.log(`\n📊 Resumen:`);
  console.log(`  Términos: ${totalTerms}`);
  console.log(`  Páginas generadas: ${generated}`);
  console.log(`  Palabras promedio: ${avgWords}`);
  console.log(`  Total palabras: ${totalWords.toLocaleString()}`);
  console.log(`  Ubicación: public/glossary/es/\n`);
}

main();
