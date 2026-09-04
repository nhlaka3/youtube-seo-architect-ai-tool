#!/usr/bin/env node
/**
 * add-glossary-tips.mjs
 * Enrich shipped glossary term pages with a category-specific "Optimization Tips"
 * section (4 concrete, actionable li items + brief intro). Idempotent, deterministic.
 * Deliberately post-processes files instead of regenerating: regeneration with the
 * current generator would DROP the Article/Breadcrumb schema that shipped pages carry.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname ?? '.', '..');
const GLOSSARY_DIR = join(ROOT, 'public', 'glossary');
const DATA_PATH = join(ROOT, 'scripts', 'glossary-data.json');

// Slug -> category map from the same data source the generator uses.
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const slugToCat = new Map(data.terms.map((t) => [t.slug, t.category]));

// Category-specific tip banks (concrete, actionable; term-parametric).
const TIP_BANKS = {
  analytics: (term) => [
    `Open YouTube Studio > Analytics and find ${term.toLowerCase()} in the report before you change anything — establish the baseline first.`,
    `Check ${term.toLowerCase()} weekly instead of daily; trends over 28 days matter more than single-day spikes.`,
    `Use the comparison feature in Analytics to see your ${term.toLowerCase()} against similar channels, then target the 50th-75th percentile.`,
    `When a video outperforms on ${term.toLowerCase()}, copy its format, pacing, or packaging into your next upload.`,
  ],
  algorithm: (term) => [
    `Watch how ${term.toLowerCase()} shows up in your last 10 videos' Traffic Sources — it reveals which audience the algorithm is testing you on.`,
    `Study two competitors ranking for your keyword: how they structure titles and retention vs your current approach.`,
    `Check the official YouTube Creator blog for ${term.toLowerCase()} updates each quarter; major updates change signal weights.`,
    `Keep session time and watch time strong — they stay the most consistent reinforcement signals behind ${term.toLowerCase()}.`,
  ],
  'seo-optimization': (term) => [
    `Search your keyword on YouTube and write down the top 5 auto-suggest phrases — each one is a title or description you can target with ${term.toLowerCase()}.`,
    `Place ${term.toLowerCase()} in the title, the first line of the description, and your first 30 seconds of speech.`,
    `Add FAQ schema and a citable definition block (like this page) so ${term.toLowerCase()} content is extractable by AI search.`,
    `Refresh your top 10 videos monthly: update descriptions, tags, and end screens with ${term.toLowerCase()} insights.`,
  ],
  monetization: (term) => [
    `Check YouTube Studio → Monetization for your current status and any policy warnings on ${term.toLowerCase()}.`,
    `Keep videos over 8 minutes if monetized, so ${term.toLowerCase()} can include mid-roll ads.`,
    `Diversify: memberships, Supers, and affiliate content stabilize revenue beyond ${term.toLowerCase()} from ads alone.`,
    `Track ${term.toLowerCase()} revenue monthly in Analytics and compare year-over-year, not week-over-week.`,
  ],
  'content-strategy': (term) => [
    `Define 3-5 topic pillars and slot ${term.toLowerCase()} into one of them so every video reinforces the same audience promise.`,
    `Plan 4-8 weeks ahead: 60-70% evergreen, 30-40% timely — keep ${term.toLowerCase()} in the evergreen share.`,
    `Batch-produce the pillar that already performs so you always have ${term.toLowerCase()} content ready.`,
    `Review quarterly: kill what's not working, double down on what is, based on ${term.toLowerCase()} data from analytics.`,
  ],
  'youtube-features': (term) => [
    `Explore all of ${term.toLowerCase()} in Studio — most features have panels or toggles creators never uncover.`,
    `Use one aspect of ${term.toLowerCase()} per video and track the result before stacking more.`,
    `Check YouTube's official how-to tutorials for ${term.toLowerCase()} before inventing workflows.`,
    `Ask your community how they use ${term.toLowerCase()} — their questions become your next content and engagement.`,
  ],
};
const DEFAULT_TIPS = (term) => [
  `Research how ${term.toLowerCase()} works from YouTube's official help center before applying it.`,
  `Apply ${term.toLowerCase()} consistently across your next 3 videos, tracking one metric each time.`,
  `Document what changes resonated with your audience so you can repeat the pattern.`,
  `Revisit ${term.toLowerCase()} quarterly — YouTube updates its features and ranking signals often.`,
];

function termNameFromHtml(html) {
  const m = html.match(/<h1[^>]*>([^<]{2,90})<\/h1>/);
  if (m) return m[1].replace(/\s*—.*$/, '').trim();
  const m2 = html.match(/"headline":"([^"]{2,90})"/);
  return m2 ? m2[1].replace(/\s*—.*$/, '').trim() : null;
}

function inject(html, tipsHtml) {
  const idx = html.lastIndexOf('<footer');
  if (idx > 0) return html.slice(0, idx) + tipsHtml + '\n' + html.slice(idx);
  const b = html.lastIndexOf('</body>');
  return html.slice(0, b) + tipsHtml + '\n' + html.slice(b);
}

const files = readdirSync(GLOSSARY_DIR).sort().filter((f) => f.endsWith('.html') && !f.startsWith('_'));
let done = 0, skipped = 0;
for (const f of files) {
  const path = join(GLOSSARY_DIR, f);
  let html = readFileSync(path, 'utf8');
  if (/Optimization Tips|optimization-tips/.test(html)) { skipped++; continue; }
  let term = termNameFromHtml(html);
  const slug = f.replace(/\.html$/, '');
  if (!term) { skipped++; continue; }
  const cat = slugToCat.get(slug) || (data.terms.find((t) => t.id === slug) || {}).category;
  const tips = (TIP_BANKS[cat] || DEFAULT_TIPS)(term);
  const termLower = term.toLowerCase();
  const tipsHtml = `
<section class="optimization-tips">
  <h2>Optimization Tips for ${term}</h2>
  <p>Put ${termLower} to work on your channel with these quick actions:</p>
  <ul>
    ${tips.map((t) => `<li>${t}</li>`).join('\n    ')}
  </ul>
</section>`;
  html = inject(html, tipsHtml);
  writeFileSync(path, html);
  done++;
}
console.log(`glossary pages enriched: ${done} | already had tips: ${skipped}`);