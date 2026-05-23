/**
 * Auto-Expansion Script for Programmatic SEO
 * 
 * Watches for keyword searches and automatically adds new pages to the sitemap.
 * Run periodically (e.g., via cron or Vercel Cron Job) to keep sitemap fresh.
 * 
 * Usage: node scripts/expand-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// CONFIGURATION
// ============================================================
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITEMAP_PUBLIC_PATH = path.join(ROOT, 'public', 'sitemap.xml');
const KEYWORD_LOG_PATH = path.join(ROOT, 'logs', 'keyword-searches.json');
const MAX_KEYWORDS = 100; // Maximum keywords in sitemap

// ============================================================
// SEED + TRENDING KEYWORDS
// ============================================================
const SEED_KEYWORDS = [
  'minecraft', 'fortnite', 'roblox', 'gaming', 'vlog', 'cooking',
  'fitness', 'technology', 'music', 'travel', 'education', 'makeup',
  'football', 'basketball', 'anime', 'movie-review', 'unboxing',
  'podcast', 'coding', 'art'
];

const TRENDING_ADDITIONS = [
  'ai-tools', 'chatgpt', 'midjourney', 'side-hustle', 'dropshipping',
  'crypto', 'web3', 'react-tutorial', 'python-programming',
  'digital-marketing', 'graphic-design', 'video-editing',
  'photography', 'drone-footage', 'asmr', 'meditation',
  'home-workout', 'meal-prep', 'personal-finance', 'stock-market',
  'car-review', 'tech-review', 'gaming-setup', 'desk-setup',
  'day-in-the-life', 'morning-routine', 'study-with-me',
  'room-tour', 'house-tour', 'fashion-haul'
];

// ============================================================
// READ LOGGED SEARCHES (from dashboard/research engine)
// ============================================================
function readLoggedKeywords() {
  try {
    if (fs.existsSync(KEYWORD_LOG_PATH)) {
      const raw = fs.readFileSync(KEYWORD_LOG_PATH, 'utf8');
      const data = JSON.parse(raw);
      return (data.keywords || []).map(k => k.term || k).filter(Boolean);
    }
  } catch (e) {
    console.warn('[Expand] Could not read keyword log:', e.message);
  }
  return [];
}

// ============================================================
// MERGE + DEDUPLICATE + RANK
// ============================================================
function rankKeywords(seedWords, trendingWords, loggedWords) {
  const seen = new Set();
  const ranked = [];

  // Priority 1: Seed keywords (high-value niches)
  for (const kw of seedWords) {
    const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!seen.has(slug) && slug.length > 1) {
      seen.add(slug);
      ranked.push({ slug, priority: '0.8', source: 'seed' });
    }
  }

  // Priority 2: Trending additions
  for (const kw of trendingWords) {
    const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!seen.has(slug) && slug.length > 1) {
      seen.add(slug);
      ranked.push({ slug, priority: '0.7', source: 'trending' });
    }
  }

  // Priority 3: User-searched keywords
  for (const kw of loggedWords) {
    const slug = kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!seen.has(slug) && slug.length > 1) {
      seen.add(slug);
      ranked.push({ slug, priority: '0.6', source: 'user-search' });
    }
  }

  return ranked.slice(0, MAX_KEYWORDS);
}

// ============================================================
// GENERATE SITEMAP XML
// ============================================================
function generateSitemap(keywords) {
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Pages -->
  <url>
    <loc>https://yt-seo-architect.vercel.app/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/dashboard</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/about</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/privacy-policy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/terms-of-service</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- Blog -->
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-seo-guide-2026</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-keyword-research</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-tags-generator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-titles-that-get-clicks</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-description-templates</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yt-seo-architect.vercel.app/blog/youtube-algorithm-changes-2026</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Tool Page -->
  <url>
    <loc>https://yt-seo-architect.vercel.app/tools/tag-generator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Auto-Expanded Keyword Pages -->
`;

  for (const { slug, priority } of keywords) {
    xml += `  <url>
    <loc>https://yt-seo-architect.vercel.app/tools/tag-generator/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  }

  xml += `</urlset>\n`;
  return xml;
}

// ============================================================
// LOG KEYWORD (called from API when user searches)
// ============================================================
function logKeywordSearch(term) {
  try {
    const dir = path.dirname(KEYWORD_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let data = { keywords: [], lastUpdated: new Date().toISOString() };
    if (fs.existsSync(KEYWORD_LOG_PATH)) {
      data = JSON.parse(fs.readFileSync(KEYWORD_LOG_PATH, 'utf8'));
    }

    // Add or increment
    const existing = data.keywords.find(k => (k.term || k) === term);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastSeen = new Date().toISOString();
    } else {
      data.keywords.push({ term, count: 1, firstSeen: new Date().toISOString() });
    }

    // Keep top 200
    data.keywords.sort((a, b) => (b.count || 0) - (a.count || 0));
    data.keywords = data.keywords.slice(0, 200);
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(KEYWORD_LOG_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[Keyword Log] Failed:', e.message);
  }
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('🔍 Expanding sitemap...\n');

  const loggedKeywords = readLoggedKeywords();
  const keywords = rankKeywords(SEED_KEYWORDS, TRENDING_ADDITIONS, loggedKeywords);

  console.log(`  Seed keywords: ${SEED_KEYWORDS.length}`);
  console.log(`  Trending additions: ${TRENDING_ADDITIONS.length}`);
  console.log(`  Logged user searches: ${loggedKeywords.length}`);
  console.log(`  Total unique in sitemap: ${keywords.length}\n`);

  // Show sources
  const bySource = {};
  for (const kw of keywords) {
    bySource[kw.source] = (bySource[kw.source] || 0) + 1;
  }
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`  ${source}: ${count} keywords`);
  }

  const xml = generateSitemap(keywords);
  fs.writeFileSync(SITEMAP_PATH, xml);
  fs.writeFileSync(SITEMAP_PUBLIC_PATH, xml);
  console.log(`\n✅ Sitemap written to: ${SITEMAP_PATH}`);
  console.log(`✅ Sitemap written to: ${SITEMAP_PUBLIC_PATH}`);
  console.log(`   ${keywords.length} keyword pages indexed\n`);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { logKeywordSearch, main };
