// api/programmatic-seo/competitor-analysis.js
// Phase 11A — Competitor Analysis Engine
import express from 'express';
export const router = express.Router();

import { requirePlan, optionalChannelId } from '../credits.js';

// ── Plan-gated: Pro feature ──
router.use(optionalChannelId);
router.use(requirePlan('pro'));

// ── Helpers ──
function scoreWeakness(page) {
  const { title, h1, wordCount } = page;
  const issues = [];
  let score = 0;

  // Check word count
  if (wordCount < 400) {
    issues.push({ type: 'word_count', severity: 'critical', detail: `Only ${wordCount} words — far below the 1500+ word standard` });
    score += 35;
  } else if (wordCount < 800) {
    issues.push({ type: 'word_count', severity: 'high', detail: `Only ${wordCount} words — should be 1500+ for competitive ranking` });
    score += 25;
  } else if (wordCount < 1500) {
    issues.push({ type: 'word_count', severity: 'medium', detail: `${wordCount} words — add 500+ more for comprehensive coverage` });
    score += 10;
  }

  // Check title
  if (!title || title.length < 30) {
    issues.push({ type: 'title', severity: 'high', detail: `Title too short (${title ? title.length : 0} chars) — should be 50-60 chars with keyword` });
    score += 15;
  } else if (title.length > 70) {
    issues.push({ type: 'title', severity: 'low', detail: `Title too long (${title.length} chars) — may get truncated in SERPs` });
    score += 5;
  }

  // Check if title has a number or power word
  if (!/\d{4}|\d+\s*(tips|ways|steps|tools|secrets|strategies|hacks|tricks)/i.test(title || '')) {
    issues.push({ type: 'title_hook', severity: 'medium', detail: 'No number or power word in title — add "7 Tips" or "Ultimate Guide" to boost CTR' });
    score += 10;
  }

  // Check recency
  if (!/20[23]\d/i.test(title || '') && !/20[23]\d/i.test(h1 || '')) {
    issues.push({ type: 'freshness', severity: 'medium', detail: 'No year in title/H1 — Google prefers fresh content, add "2026"' });
    score += 5;
  }

  // Check H1
  if (!h1 || h1 === title) {
    issues.push({ type: 'h1', severity: 'high', detail: 'Missing or duplicate H1 — should be a unique, keyword-rich heading' });
    score += 10;
  }

  return { score: Math.min(100, score), issues };
}

function deriveKeyword(title, h1) {
  const source = (h1 || title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');
  return source;
}

// ── POST /analyze — Fetch sitemaps, scrape competitor pages, score weakness ──
router.post('/analyze', async (req, res) => {
  try {
    const { urls, niche } = req.body || {};
    if (!urls || !urls.length) return res.status(400).json({ error: 'urls required' });

    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const results = [];

    for (const baseUrl of urls.slice(0, 5)) {
      let pageUrls = [];
      try {
        const smRes = await fetch(baseUrl.replace(/\/$/, '') + '/sitemap.xml', {
          signal: AbortSignal.timeout(8000)
        });
        if (smRes.ok) {
          const xml = await smRes.text();
          const matches = xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g);
          for (const m of matches) {
            if (pageUrls.length >= 30) break;
            if (/\/(blog|article|post|guide|how-to|tips|best|top|youtube-seo)/i.test(m[1])) {
              pageUrls.push(m[1]);
            }
          }
        }
      } catch (e) { /* sitemap fetch failed — use base URL */ }

      if (!pageUrls.length) pageUrls = [baseUrl];

      for (const pageUrl of pageUrls.slice(0, 10)) {
        try {
          const pRes = await fetch(pageUrl, { signal: AbortSignal.timeout(6000) });
          if (!pRes.ok) continue;
          const html = await pRes.text();

          const tM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const hM = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          const title = (tM?.[1] || '').replace(/&amp;/g, '&').trim();
          const h1 = (hM?.[1] || '').replace(/<[^>]+>/g, '').trim();
          const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const wordCount = text.split(' ').filter(Boolean).length;
          const weakness = scoreWeakness({ title, h1, wordCount });
          const keywordFocus = deriveKeyword(title, h1);

          // Generate fix recommendations based on weaknesses
          const recommendations = weakness.issues.map(i => {
            if (i.type === 'word_count') return `Write 1500+ words covering this topic in-depth`;
            if (i.type === 'title') return `Craft a 50-60 char keyword-rich title`;
            if (i.type === 'title_hook') return `Add a number or power word like "7 Tips" or "Ultimate Guide"`;
            if (i.type === 'freshness') return `Add "2026" to the title for freshness signal`;
            if (i.type === 'h1') return `Add a unique H1 that differs from the title tag`;
            return `Fix: ${i.detail}`;
          });

          const pageData = {
            competitorUrl: baseUrl,
            pageUrl,
            title,
            h1,
            wordCount,
            keywordFocus,
            estimatedTrafficTier: wordCount > 1500 ? 'High' : wordCount > 700 ? 'Medium' : 'Low',
            contentType: /blog|article|post/i.test(pageUrl) ? 'blog' : 'landing',
            weaknessScore: weakness.score
          };

          try {
            await dbService.saveCompetitorPage({ ...pageData, weaknessIssues: JSON.stringify(weakness.issues) });
          } catch (dbErr) {
            console.warn('[PSEO] saveCompetitorPage failed, falling back:', dbErr.message);
            await dbService.db.insert(s.competitorPages).values(pageData)
              .onConflictDoUpdate({ target: s.competitorPages.pageUrl, set: { title, h1, wordCount, weaknessScore: weakness.score } });
          }

          results.push({
            ...pageData,
            weaknessBreakdown: weakness.issues,
            recommendedFixes: recommendations
          });
        } catch (e) { /* individual page fetch failed — skip */ }
      }
    }

    res.json({
      analyzed: results.length,
      weakPages: results.filter(p => (p.weaknessScore || 0) >= 30).length,
      allPages: results,
      topWeakPages: results.sort((a, b) => (b.weaknessScore || 0) - (a.weaknessScore || 0))
    });
  } catch (e) {
    console.error('[PSEO] Competitor analysis error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /weak-pages — Return stored pages sorted by weakness ──
router.get('/weak-pages', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const pages = await dbService.getWeakCompetitorPages(20);
    res.json({ pages, count: pages.length });
  } catch (e) {
    console.error('[PSEO] Weak pages error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /discover-competitors — Auto-discover competitors via Google search ──
router.post('/discover-competitors', async (req, res) => {
  try {
    const niche = req.body?.niche || 'YouTube SEO';

    // Known competitor sites per niche (fallback since Google blocks datacenter IPs)
    const knownCompetitors = {
      'YouTube SEO': [
        'https://vidiq.com/blog/', 'https://www.tubebuddy.com/blog/',
        'https://backlinko.com/youtube-seo', 'https://ahrefs.com/blog/youtube-seo/',
        'https://morningfa.me/blog/', 'https://blog.hootsuite.com/youtube-seo/',
        'https://sproutsocial.com/insights/youtube-seo/', 'https://neilpatel.com/blog/youtube-seo/',
        'https://www.semrush.com/blog/youtube-seo/', 'https://influencermarketinghub.com/youtube-seo/'
      ],
      'default': [
        'https://vidiq.com/blog/', 'https://www.tubebuddy.com/blog/',
        'https://backlinko.com/blog/', 'https://ahrefs.com/blog/',
        'https://neilpatel.com/blog/'
      ]
    };

    let allUrls = knownCompetitors[niche] || knownCompetitors['default'];

    // Also try Google search (will likely fail from Vercel, but try anyway)
    const queries = [
      'best ' + niche + ' tools',
      niche + ' tips and tricks',
      niche + ' guide'
    ];
    for (const q of queries) {
      try {
        const r = await fetch('https://www.google.com/search?q=' + encodeURIComponent(q), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
          signal: AbortSignal.timeout(5000)
        });
        if (!r.ok) continue;
        const html = await r.text();
        const matches = html.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)\/[^"\s<>]+/g);
        for (const m of matches) {
          const url = m[0];
          if (!url.includes('google.com') && !url.includes('youtube.com') && !url.includes('reddit.com') && url.length > 20) {
            allUrls.push(url);
          }
        }
      } catch (e) { /* Google blocks datacenter IPs — fallback used */ }
    }

    const unique = [...new Set(allUrls)].slice(0, 15);
    const domains = [...new Set(unique.map(u => {
      try { return new URL(u).hostname.replace('www.', ''); }
      catch (e) { return ''; }
    }).filter(Boolean))];
    res.json({ competitors: unique.slice(0, 10), domains, niche });
  } catch (e) {
    console.error('[PSEO] Discover competitors error:', e.message);
    // Always return the expected shape so client doesn't crash
    res.json({ competitors: [], domains: [], niche: req.body?.niche || 'YouTube SEO', error: e.message });
  }
});

export { scoreWeakness, deriveKeyword };
