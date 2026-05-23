// api/programmatic-seo/generator.js
// PROGRAMMATIC BLOG ENGINE — PERMANENTLY DISABLED (2026-05-20)
// Fallback template produced low-quality generic content (Mad Libs-style).
// Static blog engine (public/blog/) and blog-renderer.js remain active.
// Routes return 410 Gone. Exports kept for orchestrator/content-plans compatibility.

import express from 'express';
export const router = express.Router();

// ── IndexNow: Submit URLs to Bing/Yandex for instant indexing ──
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'aa2b0b7d0ada465f886246090f01165f';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

export async function submitToIndexNow(urls) {
  if (!urls || !urls.length) return;
  try {
    const baseUrl = process.env.BASE_URL || 'https://yt-seo-architect.vercel.app';
    const fullUrls = urls.map(u => u.startsWith('http') ? u : `${baseUrl}/blog/${u}`);
    const body = JSON.stringify({
      host: new URL(baseUrl).hostname,
      key: INDEXNOW_KEY,
      keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
      urlList: fullUrls
    });
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      // IndexNow submission successful
    } else {
      console.warn(`[IndexNow] Submission failed:`, res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[IndexNow] Submission error:', e.message);
  }
}

// ── AI-based page content generation (kept for orchestrator compatibility) ──
export async function generatePageContent(opportunity, niche, competitorWeakness = null) {
  const { askAI } = await import('../_lib/ai-provider.js');
  const kw = opportunity.keyword;
  const kwTitle = kw.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  let weaknessContext = '';
  if (competitorWeakness && competitorWeakness.length > 0) {
    weaknessContext = `\n\nCOMPETITOR WEAKNESSES TO BEAT:\n${competitorWeakness.map(w => `- ${w.title}: ${w.wordCount} words. Issues: ${(w.weaknessBreakdown || []).map(i => i.detail).join('; ')}`).join('\n')}\n\nYour page must be 1500+ words with a powerful title, unique H1, and 2026 freshness. Beat them on every point.`;
  }

  const raw = await askAI(
    `You are an expert SEO content writer for "YT SEO Architect", a YouTube SEO tool.

CRITICAL RULES:
1. NO AI-isms. Never use: "in today's world", "landscape", "leverage", "robust", "seamless", "foster", "moreover", "pivotal", "embark", "game-changer", "cutting-edge", "streamline". Write like a real YouTube creator sharing hard-won lessons.
2. NO filler: Never use "At its core", "That said", "Let's explore", "Ultimately", "It's important to note", "In a world where".
3. NO hedging: Write with authority. Declare facts, don't suggest possibilities.
4. Short paragraphs (2-3 sentences). Vary sentence length. Concrete nouns, strong verbs.
5. E-E-A-T signals: first-hand experience ("I tested this"), specific data, real examples, actionable steps.
6. Follow EXACTLY this structure — every CSS class and HTML element is mandatory:${weaknessContext}

REQUIRED STRUCTURE (must use these exact class names — no variations):
- <div class="tldr"><h2>⚡ TL;DR</h2><ul><li><strong>Direct Answer:</strong> 1-2 sentences answering the title question.</li><li>Point 2 with a stat or metric</li><li>Point 3 — actionable takeaway</li><li>Point 4 — mention YT SEO Architect naturally</li></ul></div>
- <nav class="toc" aria-label="Table of contents"><h2>📑 In This Article</h2><ol><li><a href="#section-id">Section Title</a></li>...<li><a href="#faq">Frequently Asked Questions</a></li><li><a href="#key-takeaways">Key Takeaways</a></li></ol></nav>
- <div class="featured-image-wrapper"><img src="https://picsum.photos/seed/[keyword]/800/400" loading="eager" fetchpriority="high" width="800" height="400" style="width:100%;height:auto;max-width:800px;border-radius:12px;border:1px solid #2D215E;"></div>
- Content body with <h2 id="..."> sections whose IDs match the TOC anchors exactly.
- <div class="cta-box"><h3>CTA Title</h3><p>CTA description with a link to /dashboard.</p><a href="/dashboard">Button Text →</a></div>
- <section class="faq" id="faq"><h2>❓ Frequently Asked Questions</h2>...5 questions using <details><summary>Q</summary><div class="faq-answer"><p>2-3 sentence answer.</p></div></details></section>
- <div class="key-takeaways" id="key-takeaways"><h2>🎯 Key Takeaways</h2><ul><li>Actionable point</li>...4-5 points total</ul></div>

Return ONLY valid JSON: {"title":"50-60 char title","metaDescription":"150-160 char meta","h1":"unique H1 different from title","content":"full HTML containing ALL sections above with exact CSS classes shown"}`,
    `Keyword: "${kwTitle}". Niche: ${niche}. Write 1200-1800 words. Be the definitive guide — the post someone bookmarks. No fluff, no AI cadence, just real advice from someone who has done the work.`,
    { temperature: 0.5, maxTokens: 4000, forceJson: true }
  );

  const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    title: parsed.title || `${kwTitle}: 7 Proven Strategies for 2026 | YT SEO Architect`,
    metaDescription: parsed.metaDescription || `Master ${kwTitle}. Expert guide with step-by-step instructions, common mistakes, and proven strategies.`,
    h1: parsed.h1 || `${kwTitle}: What Every Creator Needs to Know in 2026`,
    content: parsed.content || '',
    schemaMarkup: parsed.schemaMarkup || '',
    wordCount: (parsed.content || '').split(/\s+/).length
  };
}

// ═══════════════════════════════════════════════════════════════
//  ALL ROUTES — PERMANENTLY DISABLED
// ═══════════════════════════════════════════════════════════════

const GONE = { error: 'Blog engine permanently disabled', message: 'Programmatic blog generation has been deactivated. Static blog remains at /blog.' };

router.post('/generate-page', (req, res) => res.status(410).json(GONE));
router.post('/bulk-generate', (req, res) => res.status(410).json(GONE));
router.post('/auto-expand', (req, res) => res.status(410).json(GONE));
router.post('/auto-publish/toggle', (req, res) => res.status(410).json(GONE));
router.get('/auto-publish/status', (req, res) => res.json({ autoPublishPseo: false, disabled: true }));

// ── triggerAutoExpansion — kept for api/index.js compatibility ──
export async function triggerAutoExpansion(keyword, niche = 'YouTube SEO') {
  return { created: false, reason: 'Blog engine permanently disabled' };
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 2: Plan-aware content generation (kept for content-plans.js)
// ═══════════════════════════════════════════════════════════════

function generateInternalLinkStrategy(category, keyword) {
  const BASE = 'https://yt-seo-architect.vercel.app';
  const pillars = {
    'channel growth': [{ url: '/blog/youtube-algorithm-guide-2026', anchor: 'YouTube algorithm guide for 2026' }],
    'SEO': [{ url: '/blog/youtube-seo-guide-2026', anchor: 'complete YouTube SEO guide' }],
    'thumbnails': [{ url: '/blog/youtube-thumbnail-guide-2026', anchor: 'YouTube thumbnail design guide' }],
    'monetization': [{ url: '/blog/youtube-monetization-guide-2026', anchor: 'YouTube monetization guide' }],
    'shorts': [{ url: '/blog/youtube-shorts-strategy-guide', anchor: 'YouTube Shorts strategy guide' }],
    'production': [{ url: '/blog/youtube-setup-guide-beginners', anchor: 'YouTube equipment guide' }],
    'analytics': [{ url: '/blog/youtube-analytics-explained', anchor: 'YouTube Analytics explained' }],
    'policies': [{ url: '/blog/youtube-copyright-fair-use-guide', anchor: 'YouTube copyright guide' }],
    'content strategy': [{ url: '/blog/youtube-content-strategy-2026', anchor: 'YouTube content strategy guide' }],
  };
  const categoryPillars = pillars[category] || [{ url: '/blog/youtube-seo-guide-2026', anchor: 'YouTube SEO guide' }];
  const toolLinks = [
    { url: '/dashboard', anchor: 'YT SEO Architect dashboard' },
    { url: '/pricing', anchor: 'YT SEO Architect Pro plans' },
    { url: '/tools/tag-generator', anchor: 'YouTube tag generator' },
  ];
  const links = [...categoryPillars, ...toolLinks.slice(0, 2)];
  return links.map(l => `- <a href="${l.url}">${l.anchor}</a>`).join('\n') +
    `\nAlso link naturally to 1-2 related blog posts in the same category where relevant.`;
}

function generateArticleSchema(planSpec, parsed) {
  const slug = planSpec.url_slug || '';
  const title = parsed?.title || planSpec.seo_title || '';
  const desc = parsed?.metaDescription || planSpec.meta_description || '';
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: title, description: desc.substring(0, 155),
    author: { '@type': 'Person', name: 'Patrick' },
    publisher: { '@type': 'Organization', name: 'YT SEO Architect', url: 'https://yt-seo-architect.vercel.app' },
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://yt-seo-architect.vercel.app/blog/${slug}` },
    about: { '@type': 'Thing', name: planSpec.topic_category || 'YouTube' },
  });
}

function parseInternalLinks(linkStrategy) {
  const links = [];
  const regex = /<a href="([^"]+)">([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(linkStrategy)) !== null) {
    links.push({ target_url: match[1], anchor_text: match[2] });
  }
  return links.length ? links : [
    { target_url: '/dashboard', anchor_text: 'YT SEO Architect dashboard' },
    { target_url: '/pricing', anchor_text: 'Pro plans' },
  ];
}

async function generatePageFromPlanAI(planSpec) {
  const { askAI } = await import('../_lib/ai-provider.js');
  const audienceContext = planSpec.audience || 'YouTube creators';
  const problemContext = planSpec.problem || '';
  const desiredOutcome = planSpec.desired_outcome || '';
  const outline = (planSpec.outline || []).join('\n');
  const faqList = (planSpec.faq || []).join('\n');
  const secondaryKeywords = (planSpec.secondary_keywords || []).join(', ');
  const primaryKw = planSpec.primary_keyword || '';
  const linkStrategy = generateInternalLinkStrategy(planSpec.topic_category, primaryKw);

  const raw = await askAI(
    `You are an expert YouTube content writer for "YT SEO Architect", a YouTube growth platform.
WRITE FOR THIS SPECIFIC CREATOR: ${audienceContext}
THEIR PROBLEM: ${problemContext}
WHAT THEY WANT: ${desiredOutcome}
CRITICAL RULES: No AI-isms, no filler, short paragraphs, E-E-A-T signals, primary keyword "${primaryKw}" in first 100 words.
REQUIRED STRUCTURE: <div class="tldr">, <nav class="toc">, <div class="featured-image-wrapper"> with eager loading, content with H2 sections, <div class="cta-box">, <section class="faq"> with 5 <details>/<summary>, <div class="key-takeaways">.
INTERNAL LINKING: ${linkStrategy}
Return ONLY valid JSON: {"title":"50-60 char title","metaDescription":"150-160 char meta","h1":"unique H1","content":"full HTML","internalLinks":[...]}`,
    `Write a definitive guide for: "${primaryKw}". Target: ${audienceContext}. Be the post they bookmark and share. No fluff.`,
    { temperature: 0.5, maxTokens: 4000, forceJson: true }
  );

  const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    title: parsed.title || planSpec.seo_title || primaryKw,
    metaDescription: parsed.metaDescription || planSpec.meta_description || '',
    h1: parsed.h1 || planSpec.h1 || primaryKw,
    content: parsed.content || '',
    schemaMarkup: generateArticleSchema(planSpec, parsed),
    internalLinks: parsed.internalLinks || parseInternalLinks(linkStrategy),
    wordCount: (parsed.content || '').split(/\s+/).length,
  };
}

export async function generatePageFromPlan(planSpec, opportunity) {
  const slug = opportunity?.targetUrlSlug || planSpec.url_slug || planSpec.primary_keyword?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60);
  try {
    const pageContent = await generatePageFromPlanAI(planSpec);
    if (pageContent && pageContent.content && pageContent.content.split(/\s+/).length >= 800) {
      return pageContent;
    }
  } catch (aiErr) {
    console.warn('[PSEO Plan] AI generation failed:', aiErr.message);
  }
  // Return minimal content — caller should handle the failure
  return {
    title: planSpec.seo_title || planSpec.primary_keyword || '',
    metaDescription: planSpec.meta_description || '',
    h1: planSpec.h1 || planSpec.primary_keyword || '',
    content: '<p>Content generation unavailable. Blog engine permanently disabled.</p>',
    schemaMarkup: generateArticleSchema(planSpec, {}),
    internalLinks: parseInternalLinks(''),
    wordCount: 5,
  };
}
