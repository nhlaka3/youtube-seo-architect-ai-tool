// api/glossary-comparison.js
// Dynamic comparison page renderer — serves both EN and ES from one route.
// Replaces 5,500+ static HTML files with a single dynamic endpoint.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');

export default async function handler(req, res) {
  const url = req.url.split('?')[0].replace(/\/+$/, '');
  const parts = url.split('/');
  const last = parts[parts.length - 1];

  // Match patterns: /glossary/{a}-vs-{b} or /glossary/es/{a}-vs-{b}
  const vsMatch = last.match(/^(.+)-vs-(.+)$/);
  if (!vsMatch) return res.status(404).json({ error: 'Not a comparison URL' });

  const isES = url.includes('/es/');
  const slugA = vsMatch[1];
  const slugB = vsMatch[2];
  const dataFile = isES
    ? resolve(PROJECT, 'scripts/glossary-data-es.json')
    : resolve(PROJECT, 'scripts/glossary-data.json');

  if (!existsSync(dataFile)) return res.status(500).json({ error: 'Data file not found' });

  let data;
  try {
    data = JSON.parse(readFileSync(dataFile, 'utf-8'));
  } catch {
    return res.status(500).json({ error: 'Failed to parse data' });
  }

  const termA = data.terms.find(t => t.slug === slugA);
  const termB = data.terms.find(t => t.slug === slugB);
  if (!termA || !termB) return res.status(404).json({ error: `Terms not found: ${slugA}, ${slugB}` });

  const aName = termA.term_es || termA.term;
  const bName = termB.term_es || termB.term;
  const aDef = termA.shortDefinition_es || termA.shortDefinition;
  const bDef = termB.shortDefinition_es || termB.shortDefinition;
  const catNameA = data.categories.find(c => c.slug === termA.category)?.[isES ? 'name_es' : 'name'] || termA.category;
  const catNameB = data.categories.find(c => c.slug === termB.category)?.[isES ? 'name_es' : 'name'] || termB.category;

  const site = 'https://yt-seo-architect.vercel.app';
  const enUrl = `/glossary/${slugA}-vs-${slugB}`;
  const esUrl = `/glossary/es/${slugA}-vs-${slugB}`;
  const lang = isES ? 'es' : 'en';
  const langLabel = isES ? '🇪🇸 Español' : '🇺🇸 English';
  const altLangLabel = isES ? '🇺🇸 English' : '🇪🇸 Español';
  const altUrl = isES ? enUrl : esUrl;
  const title = isES
    ? `${aName} vs ${bName}: Diferencias Clave para Creadores de YouTube | YT SEO Architect`
    : `${aName} vs ${bName}: Key Differences for YouTube Creators | YT SEO Architect`;
  const desc = isES
    ? `Compara ${aName} y ${bName}: definiciones, diferencias clave y cómo afectan tu estrategia de YouTube SEO.`
    : `Compare ${aName} vs ${bName}: definitions, key differences, and how they impact your YouTube SEO strategy.`;
  const h1 = `${aName} vs ${bName}`;
  const h2 = isES ? 'Diferencias Clave' : 'Key Differences';
  const p1Text = isES
    ? `${aName} es ${aDef.charAt(0).toLowerCase() + aDef.slice(1)}`
    : `${aName} is ${aDef.charAt(0).toLowerCase() + aDef.slice(1)}`;
  const p2Text = isES
    ? `${bName} es ${bDef.charAt(0).toLowerCase() + bDef.slice(1)}`
    : `${bName} is ${bDef.charAt(0).toLowerCase() + bDef.slice(1)}`;
  const ctaText = isES ? 'Prueba las Herramientas Gratis →' : 'Try Free Tools →';
  const ctaTitle = isES ? '🚀 Domina el SEO de YouTube' : '🚀 Master YouTube SEO';
  const ctaDesc = isES
    ? 'Usa nuestras herramientas gratuitas para optimizar tu contenido.'
    : 'Use our free tools to optimize your titles, tags, and more.';
  const langNotice = isES
    ? `🇪🇸 Comparación en español · <a href="${enUrl}" hreflang="en">${altLangLabel}</a>`
    : `🇺🇸 English comparison · <a href="${esUrl}" hreflang="es">${altLangLabel}</a>`;
  const hreflangEn = isES ? enUrl : `${site}${enUrl}`;
  const hreflangEs = isES ? `${site}${esUrl}` : esUrl;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${site}${isES ? esUrl : enUrl}" />
  <link rel="alternate" hreflang="en" href="${hreflangEn}" />
  <link rel="alternate" hreflang="es" href="${hreflangEs}" />
  <link rel="alternate" hreflang="x-default" href="${site}${enUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${site}${isES ? esUrl : enUrl}" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Outfit,Geist,-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}
    .header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.5rem;background:#0f0c29;border-bottom:1px solid rgba(255,255,255,.05)}
    .header a{color:#e2e8f0;text-decoration:none;font-weight:600}
    .header .cta{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem}
    main{max-width:720px;margin:0 auto;padding:2rem 1.5rem}
    h1{font-size:1.8rem;margin-bottom:.5rem;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#8b8b9e;font-size:.95rem;margin-bottom:2rem;line-height:1.6}
    .card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
    .card h2{color:#a5b4fc;font-size:1.1rem;margin-bottom:.75rem}
    .card p{color:#94a3b8;line-height:1.7;margin:.5rem 0}
    .vs{text-align:center;font-size:1.5rem;font-weight:800;color:#f97316;padding:.5rem 0}
    .badge{display:inline-block;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.3);color:#f97316;padding:.2rem .6rem;border-radius:9999px;font-size:.75rem;font-weight:600}
    .dw{display:flex;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.9rem}
    .dw:last-child{border-bottom:none}
    .dw .lb{color:#8b8b9e}
    .dw .va{color:#fb923c;font-weight:600}
    .dw .vb{color:#a5b4fc;font-weight:600}
    .ln{text-align:center;font-size:.8rem;color:#8b8b9e;margin-bottom:1.5rem}
    .ln a{color:#a5b4fc}
    .cta-box{border:1px solid #4f46e5;border-radius:12px;padding:1.5rem;text-align:center;margin:2rem 0}
    .cta-box h3{color:#e2e8f0;margin-bottom:.5rem}
    .cta-box p{color:#8b8b9e;font-size:.85rem;margin-bottom:1rem}
    .cta-box a{display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.6rem 1.5rem;border-radius:9999px;text-decoration:none;font-weight:600}
    footer{text-align:center;padding:2rem;color:#6b7280;font-size:.8rem}
    footer a{color:#8b8b9e;text-decoration:none}
    @media(max-width:480px){.dw{flex-direction:column;gap:4px}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/glossary/" class="cta">📖 Glossary</a>
  </header>
  <main>
    <div class="ln">${langNotice}</div>
    <h1>${h1}</h1>
    <p class="sub">${isES ? 'Comparación detallada con definiciones y diferencias clave.' : 'Detailed comparison with definitions and key differences.'}</p>
    <div class="card">
      <h2>📖 ${aName}</h2>
      <span class="badge">${catNameA}</span>
      <p>${p1Text}</p>
    </div>
    <div class="vs">⚡ VS ⚡</div>
    <div class="card">
      <h2>📖 ${bName}</h2>
      <span class="badge">${catNameB}</span>
      <p>${p2Text}</p>
    </div>
    <div class="card">
      <h2>⚖️ ${h2}</h2>
      <div class="dw"><span class="lb">${isES ? 'Categoría' : 'Category'}</span><span class="va">${catNameA}</span><span class="vb">${catNameB}</span></div>
      <div class="dw"><span class="lb">${isES ? 'Enfoque' : 'Focus'}</span><span class="va">${aName}</span><span class="vb">${bName}</span></div>
      <div class="dw"><span class="lb">${isES ? 'Impacto SEO' : 'SEO Impact'}</span><span class="va">Directo</span><span class="vb">Complementario</span></div>
      <div class="dw"><span class="lb">${isES ? 'Prioridad' : 'Priority'}</span><span class="va">Alta</span><span class="vb">Alta</span></div>
    </div>
    <div class="cta-box">
      <h3>${ctaTitle}</h3>
      <p>${ctaDesc}</p>
      <a href="/tools/">${ctaText}</a>
    </div>
  </main>
  <footer>
    <p>&copy; 2026 YT SEO Architect · <a href="/glossary/">Glossary</a> · <a href="/tools/">Tools</a> · <a href="/blog">Blog</a></p>
  </footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return res.status(200).send(html);
}
