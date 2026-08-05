#!/usr/bin/env node
// Re-verify FULL-AUDIT-REPORT-2026-08-03-fresh.md findings against the live site
const BASE = 'https://yt-seo-architect.vercel.app';

async function probe(path) {
  const r = await fetch(BASE + path, { redirect: 'manual' });
  return { status: r.status, loc: r.headers.get('location') || '' };
}

const checks = [
  // C1 contact
  ['C1', '/contact'],
  ['C1b', '/contact.html'],
  // canonical-related
  ['C2', '/blog/youtube-tags-2026'],
  ['C2b', '/tools/youtube-tags-2026'],
  ['C2c', '/blog/youtube-shorts-seo-ranking-guide-2026'],
  ['C2d', '/tools/youtube-shorts-seo-ranking-guide-2026'],
  ['C2e', '/blog/youtube-retention-graph-explained-2026'],
  ['C2f', '/tools/youtube-retention-graph-explained-2026'],
  // H1 canonicals
  ['H1a', '/tools'],
  ['H1b', '/dashboard'],
  ['H1c', '/public/glossary'],
  ['H1d', '/glossary'],
  // H7 sitemap missing
  ['H7a', '/about'],
  ['H7b', '/privacy-policy'],
  ['H7c', '/terms-of-service'],
  ['H7d', '/changelog'],
  // M3 broken tag-generator niches
  ['M3a', '/tools/tag-generator/gaming'],
  ['M3b', '/tools/tag-generator/minecraft'],
  ['M3c', '/tools/tag-generator/automotive'],
  // M2
  ['M2', '/js/blog-enhancements.js'],
  // M4 sitemap stubs
  ['M4a', '/glossary/algorithm/category/index'],
  ['M4b', '/glossary/category'],
  // M6 vs pages
  ['M6a', '/vs/vidiq'],
  ['M6b', '/vs/tubebuddy'],
  ['M6c', '/vs/morningfame'],
  // M7 searchaction
  ['M7', '/dashboard?q=test'],
  // H3 asset 308s
  ['H3a', '/assets/main-CILbTyH1.js'],
  ['H3b', '/logo.png'],
  ['H3c', '/favicon.ico'],
  // H8 indexnow
  ['H8a', '/bingindexnow.txt'],
  ['H8b', '/BingSiteAuth.xml'],
  // glossary terms
  ['G1', '/glossary/youtube-tags'],
  ['G2', '/glossary/es/youtube-tags'],
  ['G3', '/glossary/pt/youtube-tags'],
  // llms
  ['H4', '/llms.txt'],
];

const results = [];
for (const [id, p] of checks) {
  try {
    const r = await probe(p);
    results.push(`${id.padEnd(5)} ${p.padEnd(45)} ${r.status} ${r.loc}`);
  } catch (e) {
    results.push(`${id.padEnd(5)} ${p.padEnd(45)} ERR ${e.message}`);
  }
}
console.log(results.join('\n'));
