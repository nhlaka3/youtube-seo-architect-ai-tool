#!/usr/bin/env node
/**
 * scripts/generate-llms-content.mjs
 *
 * Generates and maintains AI-optimized content discovery files:
 *   - public/llms.txt        — Quick reference for AI assistants
 *   - public/llms-full.txt   — Detailed per-page summaries for deeper AI understanding
 *
 * These files follow the llmstxt.org standard so AI assistants (ChatGPT, Claude,
 * Gemini, Perplexity) can easily discover and cite site content.
 *
 * Usage:
 *   node scripts/generate-llms-content.mjs
 *
 * Env: GROQ_API_KEY (optional — generates smarter summaries if available)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');
const TOOLS_DIR = resolve(PROJECT, 'public/tools');

const SITE_URL = 'https://yt-seo-architect.vercel.app';
const TODAY = new Date().toISOString().split('T')[0];

// ── Page parser ───────────────────────────────────────────────────
function parseHtmlPage(filePath) {
  const html = readFileSync(filePath, 'utf-8');
  return parseHtmlString(html);
}

// Parse from an HTML string (used for live-fetched DB-rendered posts)
function parseHtmlString(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const h2s = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1].trim());
  const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const pubMatch = html.match(/<meta property="article:published_time" content="([^"]+)"/);
  const modMatch = html.match(/<meta property="article:modified_time" content="([^"]+)"/);

  return {
    title: titleMatch ? titleMatch[1].replace(/ — YT SEO Architect$/, '').trim() : null,
    description: descMatch ? descMatch[1] : null,
    h1: h1Match ? h1Match[1].trim() : null,
    h2s: h2s.slice(0, 8), // Top 8 H2s
    wordCount,
    published: pubMatch ? pubMatch[1] : null,
    modified: modMatch ? modMatch[1] : null,
  };
}

// ── Glossary loader ─────────────────────────────────────────────
// Loads glossary terms + definitions from scripts/glossary-data.json so the
// site's largest content asset (18k programmatic pages) is surfaced to AI crawlers.
function loadGlossaryTerms() {
  const glossaryPath = resolve(PROJECT, 'scripts/glossary-data.json');
  if (!existsSync(glossaryPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(glossaryPath, 'utf-8'));
    return (raw.terms || [])
      .filter(t => t && t.slug && !t.slug.includes('-vs-')) // skip comparison pairs
      .map(t => ({
        slug: t.slug,
        name: t.term || t.name || t.nameEN || t.slug,
        def: t.shortDefinition || t.def || t.defEN || t.expandedDefinition || '',
      }))
      .filter(t => t.def)
      .slice(0, 150);
  } catch {
    return [];
  }
}

// ── Live blog discovery (DB posts) ──────────────────────────────
// Many blog posts are DB-rendered (not static files). Discover them from the
// live sitemap and fetch their meta so llms.txt covers ALL posts, not just static ones.
async function discoverDbOnlyPosts(staticSlugs) {
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const blogUrls = locs.filter(u => /\/blog\/[a-z0-9-]+$/.test(u));
    const missing = blogUrls.filter(u => !staticSlugs.has(u.split('/').pop().replace('.html', '')));
    const posts = [];
    for (const url of missing.slice(0, 50)) {
      try {
        const pageRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!pageRes.ok) continue;
        const html = await pageRes.text();
        const slug = url.split('/').pop();
        const parsed = parseHtmlString(html);
        if (parsed.title && !/page not found/i.test(parsed.title)) {
          posts.push({ slug, ...parsed });
        }
      } catch { /* skip unreachable post */ }
    }
    return posts;
  } catch {
    return [];
  }
}


// ── AI summary generator (optional — falls back to description) ──
async function generateSummary(title, description, h2s) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null; // Use description fallback

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You generate concise, factual 2-3 sentence summaries for AI assistants to cite. Be specific and include numbers where relevant. Never use marketing fluff.'
          },
          {
            role: 'user',
            content: `Write a 2-3 sentence summary of this page for an AI assistant to cite:
Title: ${title}
Description: ${description}
Sections: ${h2s.join(', ')}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Generating AI-optimized content files...\n');

  // 1. Homepage
  const homepagePaths = [
    resolve(PROJECT, 'public/index.html'),
    resolve(PROJECT, 'index.html'),
  ];
  let hp = null;
  for (const p of homepagePaths) {
    if (existsSync(p)) {
      hp = parseHtmlPage(p);
      break;
    }
  }
  if (!hp) {
    console.log('⚠ homepage not found');
    hp = { title: 'YT SEO Architect', description: 'AI YouTube SEO toolkit', h2s: [], wordCount: 0 };
  }

  // 2. Tools index
  const toolsIndexPath = resolve(TOOLS_DIR, 'index.html');
  const ti = existsSync(toolsIndexPath) ? parseHtmlPage(toolsIndexPath) : null;

  // 3. Blog posts
  const blogPosts = [];
  if (existsSync(BLOG_DIR)) {
    const files = readdirSync(BLOG_DIR)
      .filter(f => f.endsWith('.html') && !f.startsWith('_'))
      .sort((a, b) => {
        // Sort by published date descending
        const aPath = resolve(BLOG_DIR, a);
        const bPath = resolve(BLOG_DIR, b);
        const aStat = statSync(aPath);
        const bStat = statSync(bPath);
        return bStat.mtimeMs - aStat.mtimeMs;
      });

    for (const file of files) {
      const slug = file.replace('.html', '');
      const page = parseHtmlPage(resolve(BLOG_DIR, file));
      blogPosts.push({ slug, ...page });
    }
  }

  // 4. Tool pages (individual topic guides)
  const toolPages = [];
  if (existsSync(TOOLS_DIR)) {
    const files = readdirSync(TOOLS_DIR)
      .filter(f => f.endsWith('.html') && f !== 'index.html');

    for (const file of files) {
      const slug = file.replace('.html', '');
      const page = parseHtmlPage(resolve(TOOLS_DIR, file));
      toolPages.push({ slug, ...page });
    }
  }

  // 5. Glossary terms (from scripts/glossary-data.json)
  const glossaryTerms = loadGlossaryTerms();

  // 6. DB-only blog posts (discovered via live sitemap — they aren't static files)
  const staticBlogSlugs = new Set(blogPosts.map(p => p.slug));
  const dbOnlyPosts = await discoverDbOnlyPosts(staticBlogSlugs);
  const knownDbSlugs = new Set(dbOnlyPosts.map(p => p.slug));
  const allBlogPosts = [...blogPosts, ...dbOnlyPosts].filter(p => p.title && p.slug !== 'generic-hero' && !/page not found/i.test(p.title));

  // Deterministic ordering: newest first (static posts carry published dates; DB posts fall back to today)
  const healthyPosts = allBlogPosts.slice().sort((a, b) => {
    const da = a.published ? new Date(a.published) : 0;
    const db = b.published ? new Date(b.published) : 0;
    return db - da;
  });

  // ── Generate llms.txt (quick reference) ──────────────────────────
  let llmsContent = `# YT SEO Architect
> AI-powered YouTube SEO platform — 90+ free tools for keyword research, tag generation, title optimization, channel audit, and more.
> Site: ${SITE_URL}
> Updated: ${TODAY}

## Core Platform
- [Homepage](${SITE_URL}/): ${hp.description || 'AI YouTube SEO toolkit with 90+ free tools'}
- [Dashboard](${SITE_URL}/dashboard): Full YouTube SEO dashboard with channel connect, AI coach, keyword research, channel audit
- [Tools](${SITE_URL}/tools/): ${ti?.description || '90+ free AI-powered YouTube SEO tools'}
- [About](${SITE_URL}/about): About YT SEO Architect and its creator
- [Pricing](${SITE_URL}/pricing): YT SEO Architect is 100% free — $0 forever, unlimited credits, no subscription
- [Privacy Policy](${SITE_URL}/privacy-policy)
- [Terms of Service](${SITE_URL}/terms-of-service)

## Blog Posts (${healthyPosts.length})
`;
  for (const post of healthyPosts) {
    const date = post.published ? post.published.split('T')[0] : '';
    let desc = post.description || '';
    // Replace slug-injected template descriptions ("Learn how to X 2026...") with a clean title-based line
    if (/^learn how to /i.test(desc) || /Step-by-step guide with examples, tools, and strategies/i.test(desc)) {
      const h1 = post.h1 || post.title || '';
      const clean = h1.replace(/— YT SEO Architect.*$/, '').trim();
      desc = `${clean}. Practical guide with actionable YouTube SEO strategy, examples, and best practices for 2026.`;
    }
    llmsContent += `- [${post.title}](${SITE_URL}/blog/${post.slug}): ${desc} (${date})\n`;
  }

  llmsContent += `\n## Topic Guides with Interactive Tools (${toolPages.length})\n`;
  for (const tool of toolPages) {
    let tdesc = tool.description || '';
    if (/^learn how to /i.test(tdesc) || /Step-by-step guide with examples, tools, and strategies/i.test(tdesc)) {
      const tclean = (tool.h1 || tool.title || '').replace(/— YT SEO Architect.*$/, '').trim();
      tdesc = `${tclean}. Free interactive tool with practical YouTube SEO guidance for 2026.`;
    }
    llmsContent += `- [${tool.title}](${SITE_URL}/tools/${tool.slug}): ${tdesc}\n`;
  }

  // Glossary section — surfaces the site's largest structured content asset
  if (glossaryTerms.length > 0) {
    llmsContent += `\n## Glossary (${glossaryTerms.length} key terms)\n`;
    for (const t of glossaryTerms) {
      const def = t.def.replace(/\s+/g, ' ').trim();
      llmsContent += `- [${t.name}](${SITE_URL}/glossary/${t.slug}): ${def.slice(0, 180)}\n`;
    }
  }

  writeFileSync(resolve(PROJECT, 'public/llms.txt'), llmsContent);
  console.log(`✅ public/llms.txt — ${healthyPosts.length} blog posts + ${toolPages.length} tools + ${glossaryTerms.length} glossary terms indexed`);

  // ── Generate llms-full.txt (detailed) ────────────────────────────
  let fullContent = `# YT SEO Architect — Full Site Reference
> Generated: ${TODAY}
> This file provides detailed page summaries for AI assistants. Each entry includes the page's structure, key topics, and content summary.

---

## 1. Homepage
**URL:** ${SITE_URL}/
**Title:** ${hp.title}
**Description:** ${hp.description}
**Key Sections:** ${hp.h2s.slice(0, 5).join(' | ')}
**Topics:** YouTube SEO, keyword research, tag generation, title optimization, channel growth
**Pricing:** Free core tools, 100 AI credits/month for premium features

---

## 2. Free Tools Hub
**URL:** ${SITE_URL}/tools/
**Title:** ${ti?.title || 'Free YouTube SEO Tools'}
**Description:** ${ti?.description || ''}
**Tool Categories:**
- Tag Generator (free, no login)
- Title Optimizer (free, no login)
- Description Writer (free, no login)
- Keyword Research
- Channel Audit
- AI Coach Phronesis
- + 45+ topic guides with embedded tools
${ti?.h2s.slice(0, 3).map(h => `- ${h}`).join('\n') || ''}

---

## 3. Blog Posts

`;

  for (const post of healthyPosts.slice(0, 50)) {
    const summary = post.description || '';
    fullContent += `### ${post.title}
**URL:** ${SITE_URL}/blog/${post.slug}
**Published:** ${post.published?.split('T')[0] || 'N/A'}
**Modified:** ${post.modified?.split('T')[0] || 'N/A'}
**Word Count:** ~${post.wordCount}
**Summary:** ${summary}
**Covers:** ${post.h2s.slice(0, 6).join(', ')}
**Tags:** YouTube SEO, ${post.slug.split('-').slice(0, 4).join(', ')}

`;
  }

  // Glossary detail section
  if (glossaryTerms.length > 0) {
    fullContent += `---
## 5. Glossary (${glossaryTerms.length} key terms)

`;
    for (const t of glossaryTerms) {
      const def = t.def.replace(/\s+/g, ' ').trim();
      fullContent += `### ${t.name}
**URL:** ${SITE_URL}/glossary/${t.slug}
**Definition:** ${def.slice(0, 300)}
**Topic:** YouTube SEO

`;
    }
  }

  fullContent += `---
## 4. Topic Guides

`;

  for (const tool of toolPages.slice(0, 50)) {
    fullContent += `### ${tool.title}
**URL:** ${SITE_URL}/tools/${tool.slug}
**Description:** ${tool.description || ''}
**Covers:** ${tool.h2s.slice(0, 4).join(', ')}

`;
  }

  writeFileSync(resolve(PROJECT, 'public/llms-full.txt'), fullContent);
  console.log(`✅ public/llms-full.txt — detailed per-page summaries for AI citation`);

  // ── Generate llms.txt — platform features brief ──────────────────
  // Also add a robots.txt directive if not present
  const robotsPath = resolve(PROJECT, 'public/robots.txt');
  if (!existsSync(robotsPath)) {
    const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`;
    writeFileSync(robotsPath, robots);
    console.log(`✅ public/robots.txt — created with sitemap directive`);
  }

  // Stats
  const totalPages = 1 + 1 + blogPosts.length + toolPages.length;
  console.log(`\n📊 Summary:`);
  console.log(`   Pages indexed: ${totalPages}`);
  console.log(`   Blog posts: ${blogPosts.length}`);
  console.log(`   Topic guides: ${toolPages.length}`);
  console.log(`   llms.txt: ${llmsContent.split('\\n').length} lines`);
  console.log(`   llms-full.txt: ${fullContent.split('\\n').length} lines`);
  console.log(`\n✅ AI search optimization files generated`);
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
