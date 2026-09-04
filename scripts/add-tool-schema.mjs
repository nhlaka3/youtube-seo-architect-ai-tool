#!/usr/bin/env node
/**
 * scripts/add-tool-schema.mjs
 *
 * Idempotent post-processor for public/tools/*.html — adds WebApplication
 * JSON-LD + og/twitter image tags to tool pages that lack them (the 5
 * metric-calculator pages whose generator predates schema emission).
 *
 * Preserves all existing enrichment (FAQ sections, related-tool links, etc.)
 * — injects only what is missing. Safe to re-run after every future deploy.
 *
 * Usage: node scripts/add-tool-schema.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const TOOLS_DIR = resolve(import.meta.dirname ?? '.', '..', 'public', 'tools');

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function inject(filePath) {
  let html = readFileSync(filePath, 'utf-8');
  let changed = false;

  const title = extract(html, /<title[^>]*>([^<]*)<\/title>/);
  const desc = extract(html, /<meta name="description"[^>]*content="([^"]*)"\s*\/?>/);
  const canonical = extract(html, /<link rel="canonical"[^>]*href="([^"]*)"\s*\/?>/);
  if (!title || !desc || !canonical) {
    console.log(`  SKIP ${join(filePath)} (missing title/desc/canonical)`);
    return false;
  }

  // 1. og:image + twitter image (only if missing)
  if (!html.includes('og:image')) {
    const ogBlock = [
      `  <meta property="og:image" content="https://yt-seo-architect.vercel.app/og-image.png" />`,
      `  <meta property="og:type" content="website" />`,
      `  <meta property="og:url" content="${canonical}" />`,
      `  <meta name="twitter:card" content="summary_large_image" />`,
      `  <meta name="twitter:image" content="https://yt-seo-architect.vercel.app/og-image.png" />`,
    ].join('\n');
    html = html.replace('</head>', `${ogBlock}\n</head>`);
    changed = true;
  }

  // 2. WebApplication JSON-LD (only if no schema block at all)
  if (!html.includes('application/ld+json')) {
    const name = title.replace(/\s*[—-]\s*.*$/, '').trim(); // strip " — Free Tool" suffix
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name,
      description: desc,
      url: canonical,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
    const block = `  <script type="application/ld+json">\n  ${JSON.stringify(schema, null, 2).replace(/\n/g, '\n  ')}\n  </script>\n`;
    html = html.replace('</head>', `${block}</head>`);
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, html);
    return true;
  }
  return false;
}

const files = readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.html')).sort();
let injected = 0;
for (const f of files) {
  const p = join(TOOLS_DIR, f);
  if (inject(p)) {
    console.log(`  + ${f}`);
    injected++;
  }
}
console.log(`\nDone: ${injected}/${files.length} tool pages updated (idempotent — re-run safe).`);
