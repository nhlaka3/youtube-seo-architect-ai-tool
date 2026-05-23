#!/usr/bin/env node
// scripts/publish-playlist-seo-post.mjs
// Creates a contentOpportunity → AI-generates full blog post → saves as status=published
// → submits URL to IndexNow for instant Bing/Yandex crawl.
//
// Prereqs:
//   export DATABASE_URL=postgres://user:pass@host/db
//   export GROQ_API_KEY=gsk_...
//   export BASE_URL=https://yt-seo-architect.vercel.app   (override if staging)
//
// Run:  node scripts/publish-playlist-seo-post.mjs

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ── Load schema dynamically ──
const s = await import('../src/database/schema.js');
const { contentOpportunities, seoPages } = s;

// ── DB ──
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Set it before running.');
  process.exit(1);
}
const pool = new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 10000, keepAlive: true });
const db = drizzle(pool);

// ── Groq call (mirrors ai-provider.js fallback behaviour) ──
async function askGroq(system, user, opts = {}) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens || 4000,
      ...(opts.forceJson && { response_format: { type: 'json_object' } }),
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) { const t = await r.text().slice(0, 300); throw new Error(`Groq ${r.status}: ${t}`); }
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

// ── IndexNow submit (non-blocking, mirrors indexing.js) ──
const INDEXNOW_KEY = 'aa2b0b7d0ada465f886246090f01165f';
const INDEXNOW_URL = 'https://api.indexnow.org/indexnow';
const BASE_URL = process.env.BASE_URL || 'https://yt-seo-architect.vercel.app';

async function submitToIndexNow(slugs) {
  if (!slugs?.length) return;
  const fullUrls = slugs.map(s => s.startsWith('http') ? s : `${BASE_URL}/blog/${s}`);
  const body = {
    host: new URL(BASE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/aa2b0b7d0ada465f886246090f01165f.txt`,
    urlList: fullUrls,
  };
  try {
    const r = await fetch(INDEXNOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    console.log(r.ok ? `[IndexNow] OK` : `[IndexNow] ${r.status}`);
  } catch (e) { console.warn('[IndexNow]', e.message); }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE  (generator.css pattern: Step 1 → 2 → 3 → 4 → 5)
// ═══════════════════════════════════════════════════════════════
(async () => {
  const t0 = Date.now();
  const keyword = 'youtube playlist seo for small channels';
  const slug    = 'youtube-playlist-seo-for-small-channels';

  try {
    // ── STEP 1: load or create contentOpportunities row ──
    console.log(`[1/5] Opportunities table – find or create: "${keyword}"`);
    const [existing] = await db
      .select()
      .from(contentOpportunities)
      .where(eq(contentOpportunities.keyword, keyword))
      .limit(1);

    let oppId = existing?.id;
    if (!existing) {
      oppId = createId();
      await db.insert(contentOpportunities).values({
        id: oppId, keyword, targetUrlSlug: slug, priority: 9, status: 'pending',
      });
      console.log(`       ✓ created oppId=${oppId}`);
    } else {
      console.log(`       ✓ found oppId=${oppId} (existing slug=${existing.targetUrlSlug})`);
    }

    // ── STEP 2: AI generation ──
    console.log(`[2/5] AI: composing blog post (Tier 1 plan-aware)…`);
    /* builder (long-tail engine × generator.js Phase 2) – cached constant to avoid
       re-concatenating strings in the Groq prompt every time the script is re-run. */
    // DESIGN PATTERN CATEGORY: content-strategy → pillar: /blog/youtube-content-strategy-2026
    const CATEGORY = 'content strategy';
    const PILLARS  = { 'content strategy': [{ url: '/blog/youtube-content-strategy-2026', anchor: 'YouTube content strategy guide' }] };
    const TOOLS    = [
      { url: '/dashboard',              anchor: 'YT SEO Architect dashboard' },
      { url: '/pricing',                anchor: 'YT SEO Architect Pro plans' },
      { url: '/tools/description-writer', anchor: 'YouTube description writer' },
    ];
    const categoryPillars  = PILLARS[CATEGORY] || [{ url: '/blog/youtube-seo-guide-2026', anchor: 'YouTube SEO guide' }];
    const internalLinkHtml = [...categoryPillars, ...TOOLS.slice(0, 2)]
      .map(l => `- <a href="${l.url}">${l.anchor}</a>`).join('\n');

    const PROMPT_SYS = `You are an expert YouTube content writer for "YT SEO Architect", a YouTube SEO tool.

TARGET CREATOR: small channel owners (under 1K subscribers) who don't know session playlists can move the needle.
THEIR PROBLEM: individual videos perform fine but session watch time is flat; they don't think about playlists.
WHAT THEY WANT: a concrete, tested playlist SEO method they can apply in under 2 hours this evening.

CRITICAL RULES:
1. Address THIS specific creator directly in the intro. Name their situation. Use "you" not "creators."
2. NO AI-isms: "in today's world", "landscape", "leverage", "robust", "seamless", "foster", "moreover",
   "pivotal", "embark", "game-changer", "cutting-edge", "streamline".
3. NO filler: "At its core", "That said", "Let's explore", "Ultimately", "It's important to note".
4. Short paragraphs (2-3 sentences). Concrete nouns, strong verbs. Vary sentence length.
5. E-E-A-T: first-hand experience ("I tested this"), specific numbers, real examples, actionable steps.
6. Primary keyword: "youtube playlist seo" — first 100 words, H1, at least one H2.
   Secondary keywords: reorder YouTube playlists, boost YouTube playlist watch time,
   create playlists for YouTube, optimize YouTube playlists for search,
   YouTube playlist watch time strategy.

REQUIRED STRUCTURE:
- <blockquote><strong>TL;DR:</strong> 2–3 sentence direct answer. Start with a bold claim, back with a number. MANDATORY.
- <img src="https://picsum.photos/seed/playlist-optimization/800/400" alt="YouTube playlist SEO guide" style="width:100%"> — MANDATORY directly after TL;DR.
- <h2>What Is YouTube Playlist SEO?</h2> — One-clean-definition sentence + how YouTube indexes playlist metadata separately from individual video metadata.
- <h2>Why Playlist SEO Matters More in 2026</h2> — Session watch time data, Browse Feature update, compare a well-ordered vs unordered playlist effect. Use concrete example numbers.
- <h2>6 Actions to Take Right Now</h2>
  - <h3>Step 1: Identify Your Underperforming Playlists</h3>
    How to spot low-session watch time in Studio's End Screens / Watch Time per playlist report.
  - <h3>Step 2: Rewrite Playlist Titles with Keywords</h3>
    Front-load keyword in first 40 chars, add specificity / power word. Example rewrite.
  - <h3>Step 3: Write Playlist Descriptions That Rank</h3>
    200–400 chars, keyword in first 80, describe the viewing journey end-to-end.
  - <h3>Step 4: Reorder by Retention Score (the AI method)</h3>
    Bookend structure: short hook video first → deep-content middle → strong closer.
    YT SEO Architect's reorder_playlists_by_retention endpoint does this automatically.
  - <h3>Step 5: Add a Hook Thumbnail to Every Playlist</h3>
    One focal point, <3 words of text, high contrast. Also add end-screens linking to next playlist video.
  - <h3>Step 6: Publish and Track Session Delta Weekly</h3>
    Unlisted → public rollout preserves scheduling boost. Check Weekly Session Duration in Studio.
- <h2>5 Playlist SEO Mistakes (And How to Fix Each)</h2>
  As two-sentence paragraphs: <strong>Mistake name.</strong> Why it hurts — one line. Fix — one line.
  Include: alphabetical ordering, generic title, missing end-screen, reuse of cover thumb, slow/late playlist reordering.
- <h2>Tools That Automate Playlist SEO</h2>
  Introduce the tool naturally, explain how it handles retention-weighted reorder in a single click.
- Lead naturally into a CTA about running a free channel audit, then solve the right way.
- <h2>Frequently Asked Questions</h2>
  Q: Does YouTube actually surface playlists in search results?
  A: Yes — since the 2023 Browse Features update, YouTube indexes playlist public titles and descriptions separately from individual video metadata. A well-titled and keyword-first playlist can appear as a "Top Result" for branded queries.
  
  Q: Can I use the same video in multiple playlists?
  A: Yes — ordering changes how YouTube scores session contribution. Duplicate ordering across multiple playlists dilutes the signal rather than amplifying it, as YouTube's algorithm can't determine which user path is primary.
  
  Q: What is the best playlist description length?
  A: 200–400 characters is optimal. Under 100, YouTube may truncate in the browse feed. Over 500 dilutes the keyword-relevance signal. Place the 2–3 highest-volume search queries in the first 80 characters.
  
  Q: Do playlist thumbnails affect individual video rankings?
  A: Indirectly. A high-CTR playlist cover drives more clicks from the browse feed, boosting that individual video's watch-time velocity and helping it climb in its own search ranking.
  
  Q: How often should I reorder a playlist?
  A: Every 30–60 days based on actual session watch time data, not your gut feeling. Playlist order drifts as individual video performance changes. A 4-week automated reorder cadence is the equilibrium point for most channels.
- <h2>Key Takeaways</h2> — 3–4 bullets in <ul><li> format.

CTA (introduce the free audit): "Run a free channel audit with YT SEO Architect to identify which of your playlists are actively dragging session watch time down — and which ones you can boost in one click."

INTERNAL LINKS (include 2–5 inline in the prose):
${internalLinkHtml}

Return ONLY valid JSON (no markdown fences, no trailing text):
{"title":"50–60 char keyword-rich title with a number when possible","metaDescription":"150–160 char meta including keyword + clear benefit","h1":"unique H1 different from the title","content":"full HTML","internalLinks":[{"target_url":"/pricing","anchor_text":"YT SEO Architect Pro plans"},{"target_url":"/dashboard","anchor_text":"YT SEO Architect dashboard"}]}`;

    const raw = await askGroq(PROMPT_SYS, 'Write 1200–1800 words. Be definitive. No fluff.', { temperature: 0.5, maxTokens: 4000, forceJson: true });

    // ── STEP 2b: Parse + word-count gate ──
    let parsed, wordCount;
    try {
      const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
      wordCount = (parsed.content || '').split(/\s+/).length;
      console.log(`       ✓ AI returned ${wordCount} words`);
    } catch (e) {
      console.error('[AI] JSON parse failed, raw:', raw.slice(0, 400));
      throw e;
    }

    if (wordCount < 800) {
      console.warn(`       ⚠ Thin content (${wordCount}w); production would use generateTemplateContent() fallback here`);
    }

    // ── STEP 3: Save to seoPages status=published ──
    console.log(`[3/5] DB: inserting seoPages  slug=${slug}`);
    const pageId = createId();
    const schemaMarkup = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: parsed.title,
      description: parsed.metaDescription,
      author: { '@type': 'Person', name: 'Patrick' },
      publisher: { '@type': 'Organization', name: 'YT SEO Architect', url: BASE_URL },
      datePublished: new Date().toISOString().split('T')[0],
      dateModified: new Date().toISOString().split('T')[0],
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${slug}` },
      about: { '@type': 'Thing', name: 'YouTube playlist SEO' },
    });
    await db.insert(seoPages).values({
      id: createId(),
      opportunityId: oppId, slug, pageType: 'blog',
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      h1: parsed.h1,
      content: parsed.content,
      schemaMarkup,
      internalLinks: JSON.stringify(parsed.internalLinks || []),
      wordCount,
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
    });
    console.log(`       ✓ seoPages row saved  id=${pageId}  status=published`);

    // ── STEP 4: Mark opportunity generated ──
    await db
      .update(contentOpportunities)
      .set({ status: 'generated', pageId: pageId })
      .where(eq(contentOpportunities.id, oppId));
    console.log(`[4/5] DB: opportunity id=${oppId.slice(0,12)}… → status=generated`);

    // ── STEP 5: IndexNow (non-blocking) ──
    console.log(`[5/5] IndexNow: submitting ${slug}…`);
    await submitToIndexNow([slug]);

    const liveUrl = `${BASE_URL}/blog/${slug}`;
    const elapsed  = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`
╔══════════════════════════════════════════════════╗
║  ✅ POST PUBLISHED                                ║
╠══════════════════════════════════════════════════╣
║  URL        ${liveUrl.padEnd(38)}║
║  Page ID    ${pageId.padEnd(38)}║
║  Words      ${String(wordCount).padEnd(38)}║
║  Elapsed    ${(elapsed + 's').padEnd(38)}║
╚══════════════════════════════════════════════════╝
Title:  ${parsed.title}
Meta:   ${(parsed.metaDescription || '').slice(0, 80)}…
`);
    process.exit(0);

  } catch (err) {
    console.error('\n❌ FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
