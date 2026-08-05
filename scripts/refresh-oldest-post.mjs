#!/usr/bin/env node
/**
 * scripts/refresh-oldest-post.mjs
 *
 * Weekly content refresh: finds the oldest blog post and adds 2-3 new,
 * timely sections using AI. Updates dateModified, sitemap, and llms.txt.
 *
 * Usage:
 *   node scripts/refresh-oldest-post.mjs              # Refresh oldest post
 *   node scripts/refresh-oldest-post.mjs --dry-run    # Show which post without modifying
 *   node scripts/refresh-oldest-post.mjs --slug "youtube-tags-2026"  # Refresh specific post
 *   node scripts/refresh-oldest-post.mjs --force      # Skip "refreshed within 7 days" check
 *
 * Env: GROQ_API_KEY (primary), GEMINI_API_KEY (fallback)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

// ── Parse CLI args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const SLUG_OVERRIDE = args.find(a => a.startsWith('--slug='))
  ? args.find(a => a.startsWith('--slug=')).split('=')[1]
  : args.includes('--slug')
    ? args[args.indexOf('--slug') + 1]
    : null;

// ── AI helpers ─────────────────────────────────────────────────────
async function callAI(prompt, system) {
  const apiKey = process.env.GROQ_API_KEY;
  const fallbackKey = process.env.GEMINI_API_KEY;
  const errors = [];

  const backoff = (ms) => new Promise(r => setTimeout(r, ms));

  // Primary: Groq (retry with backoff on 429/5xx)
  if (apiKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
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
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const msg = `Groq HTTP ${res.status} ${body.slice(0, 120)}`.trim();
          errors.push(msg);
          if (res.status === 429 || res.status >= 500) {
            await backoff(3000 * (attempt + 1));
            continue;
          }
          break;
        }
        const data = await res.json();
        return data.choices[0].message.content;
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
        if (attempt < 2) await backoff(3000);
      }
    }
  }

  // Fallback: Gemini (retry with backoff on 429/5xx)
  if (fallbackKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${fallbackKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const msg = `Gemini HTTP ${res.status} ${body.slice(0, 120)}`.trim();
          errors.push(msg);
          if (res.status === 429 || res.status >= 500) {
            await backoff(3000 * (attempt + 1));
            continue;
          }
          break;
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (e) {
        errors.push(`Gemini: ${e.message}`);
        if (attempt < 2) await backoff(3000);
      }
    }
  }

  throw new Error(
    `All AI providers failed: ${errors.join(' | ') || 'no API keys configured (set GROQ_API_KEY and/or GEMINI_API_KEY)'}`
  );
}

// ── Blog post parser ───────────────────────────────────────────────
function getPostMeta(html, slug) {
  const pubMatch = html.match(/<meta property="article:published_time" content="([^"]+)"/);
  const modMatch = html.match(/<meta property="article:modified_time" content="([^"]+)"/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);

  return {
    slug,
    published: pubMatch ? pubMatch[1] : null,
    modified: modMatch ? modMatch[1] : null,
    title: titleMatch ? titleMatch[1].replace(/ — YT SEO Architect$/, '').trim() : slug,
    description: descMatch ? descMatch[1] : '',
  };
}

function getContentBody(html) {
  // Extract the article content (between <article> tags or the main content section)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];

  // Fallback: get everything after <main> and before bottom CTA/footer
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  return '';
}

function extractSections(content) {
  // Find all H2 sections with their content
  const sections = [];
  const h2Regex = /<h2[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*id=|$)/gi;
  let match;
  while ((match = h2Regex.exec(content)) !== null) {
    const id = match[1];
    const heading = match[2].replace(/<[^>]+>/g, '').trim();
    const body = match[3].trim();
    const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    sections.push({ id, heading, body, wordCount });
  }
  return sections;
}

function updateModifiedTime(html, newDate) {
  const dateStr = newDate.toISOString().split('T')[0];
  // Update meta tags
  html = html.replace(
    /(<meta property="article:modified_time" content=")[^"]*(")/,
    `$1${dateStr}$2`
  );
  // Update JSON-LD dateModified
  html = html.replace(
    /("dateModified":\s*")[^"]*(")/,
    `$1${dateStr}$2`
  );
  // Also update og:updated_time if present
  html = html.replace(
    /(<meta property="og:updated_time" content=")[^"]*(")/,
    `$1${dateStr}$2`
  );
  return html;
}

function injectNewSections(html, newSectionsHtml, slug) {
  // Find the predictions section or the last H2 section before FAQ
  const faqMatch = html.match(/<h2[^>]*id="faq"[^>]*>[\s\S]*?<\/h2>/i);
  const predictionsMatch = html.match(/<h2[^>]*id="predictions"[^>]*>[\s\S]*?<\/h2>[\s\S]*?(?=<h2|$)/i);
  const bottomCtaMatch = html.match(/<div class="bottom-cta"[^>]*>[\s\S]*?<\/div>/i);

  let insertPoint = '';

  // Insert new sections before FAQ, or after predictions, or before bottom CTA
  if (faqMatch) {
    insertPoint = faqMatch.index;
  } else if (bottomCtaMatch) {
    insertPoint = bottomCtaMatch.index;
  } else {
    // Insert before </article> or </main>
    const articleEnd = html.match(/<\/article>/i);
    const mainEnd = html.match(/<\/main>/i);
    insertPoint = articleEnd ? articleEnd.index : mainEnd ? mainEnd.index : -1;
  }

  if (insertPoint === -1) {
    // Append before </body>
    insertPoint = html.lastIndexOf('</body>');
  }

  if (insertPoint === -1) {
    throw new Error('Could not find insertion point in HTML');
  }

  return html.slice(0, insertPoint) + '\n' + newSectionsHtml + '\n' + html.slice(insertPoint);
}

function getWordCount(text) {
  return text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function updateSitemap(slug) {
  const sitemapPath = resolve(PROJECT, 'public/sitemap.xml');
  if (!existsSync(sitemapPath)) {
    console.log('  ⚠ sitemap.xml not found, skipping');
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  let sitemap = readFileSync(sitemapPath, 'utf-8');
  const url = `https://yt-seo-architect.vercel.app/blog/${slug}`;
  const re = new RegExp(
    `(<url>\\s*<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?<lastmod>)[^<]*(</lastmod>)`
  );
  if (re.test(sitemap)) {
    sitemap = sitemap.replace(re, `$1${today}$2`);
    writeFileSync(sitemapPath, sitemap);
    console.log(`  ✅ Updated sitemap lastmod for ${url}`);
  } else {
    const newEntry = `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    sitemap = sitemap.replace('</urlset>', `${newEntry}\n</urlset>`);
    writeFileSync(sitemapPath, sitemap);
    console.log(`  ✅ Added ${url} to sitemap`);
  }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  📝 WEEKLY CONTENT REFRESH');
  console.log('════════════════════════════════════════════\n');

  // 1. Find target post
  const files = readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));

  let targetSlug = SLUG_OVERRIDE;

  if (!targetSlug) {
    // Parse all posts to find the oldest one
    let oldest = null;
    let oldestDate = Infinity;

    for (const file of files) {
      const slug = file.replace('.html', '');
      const html = readFileSync(resolve(BLOG_DIR, file), 'utf-8');
      const meta = getPostMeta(html, slug);
      if (meta.published) {
        const pubDate = new Date(meta.published).getTime();
        if (pubDate < oldestDate && !isNaN(pubDate)) {
          oldestDate = pubDate;
          oldest = { ...meta, html };
        }
      }
    }

    if (!oldest) {
      console.log('❌ No blog posts found with valid published dates');
      process.exit(1);
    }

    // Check if already refreshed recently (skip if modified within 7 days)
    if (!FORCE && oldest.modified) {
      const modDate = new Date(oldest.modified);
      const daysSinceMod = Math.floor((Date.now() - modDate.getTime()) / (1000*60*60*24));
      if (daysSinceMod < 7) {
        console.log(`⏭️  "${oldest.title}" was refreshed ${daysSinceMod} day(s) ago — skipping (use --force to override)`);
        process.exit(0);
      }
    }

    targetSlug = oldest.slug;
    console.log(`  Target: "${oldest.title}" (published: ${oldest.published})`);
  }

  // 2. Read the target post
  const targetPath = resolve(BLOG_DIR, `${targetSlug}.html`);
  if (!existsSync(targetPath)) {
    console.log(`❌ Blog post not found: ${targetPath}`);
    process.exit(1);
  }

  let html = readFileSync(targetPath, 'utf-8');
  const meta = getPostMeta(html, targetSlug);
  const contentBody = getContentBody(html);
  const sections = extractSections(html);
  const existingIds = sections.map(s => s.id);

  console.log(`  Title: "${meta.title}"`);
  console.log(`  Published: ${meta.published}`);
  console.log(`  Last modified: ${meta.modified}`);
  console.log(`  Existing sections: ${sections.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('── DRY RUN MODE ──');
    console.log(`Would refresh: ${targetSlug}`);
    console.log(`Would generate 2-3 new sections`);
    console.log(`Would update: dateModified, sitemap`);
    process.exit(0);
  }

  // 3. Generate new sections via AI
  // Trim heading list: free-tier Groq caps TPM at 6000, and the 6.5MB post has
  // 1275 headings (~15K+ input tokens) — sending all of them guarantees a 429.
  const MAX_HEADINGS = 40;
  const allHeadings = sections.map(s => `- ${s.heading} (#${s.id})`);
  const existingHeadings =
    allHeadings.slice(0, MAX_HEADINGS).join('\n') +
    (allHeadings.length > MAX_HEADINGS
      ? `\n... and ${allHeadings.length - MAX_HEADINGS} more existing sections (do NOT duplicate their topics)`
      : '');
  const prompt = `You are refreshing the blog post "${meta.title}" on YT SEO Architect.

The post already has these sections:
${existingHeadings}

TASK: Write 2-3 NEW sections that add timely, CURRENT information to this post. The year is ${new Date().getFullYear()}.

REQUIREMENTS:
- Each section must start with <h2 id="fresh-section-N"> where N is 1, 2, or 3
- Each section must be 250-400 words of substantial, actionable content
- Focus on: new YouTube algorithm updates, recent data, fresh strategies that weren't covered before
- Include dates and actionable steps. Use a specific number ONLY when it is a real, verifiable fact you can cite; otherwise keep claims qualitative ("more", "higher"). NEVER invent statistics, studies, or attribution to real companies/creators, and NEVER fabricate metrics for named channels.
- Link to YT SEO Architect dashboard (/dashboard) naturally once or twice
- Use the same writing style as the existing post (direct, authoritative, no fluff)
- NO banned words: leverage, seamless, robust, embark, streamline, cutting-edge, delve, harness, unlock, realm, game-changer
- Mix short and long sentences, use contractions

Return ONLY the HTML for the new sections. No explanation, no wrapper.`;

  console.log('  🤖 Generating fresh sections...');
  let newSectionsHtml;
  try {
    newSectionsHtml = await callAI(
      prompt,
      `You are an expert YouTube SEO content writer. You write direct, actionable content for YouTube creators. You never use AI-sounding language. Your content is specific, data-driven, and genuinely useful.`
    );
  } catch (e) {
    console.log(`❌ AI generation failed: ${e.message}`);
    process.exit(1);
  }

  const newWordCount = getWordCount(newSectionsHtml);
  console.log(`  ✅ Generated: ~${newWordCount} words`);
  console.log(`  Content preview:\n  ${newSectionsHtml.slice(0, 200).replace(/\n/g, '\n  ')}...\n`);

  // 4. Inject new sections
  html = injectNewSections(html, newSectionsHtml, targetSlug);

  // 5. Update modified time
  const now = new Date();
  html = updateModifiedTime(html, now);
  console.log(`  ✅ Updated dateModified to ${now.toISOString().split('T')[0]}`);

  // 6. Write back
  writeFileSync(targetPath, html);
  console.log(`  ✅ Wrote updated post: ${targetPath}`);

  // 7. Update sitemap
  updateSitemap(targetSlug);

  // 8. Update blog listing page if it exists
  const blogListing = resolve(PROJECT, 'blog.html');
  if (existsSync(blogListing)) {
    let blogHtml = readFileSync(blogListing, 'utf-8');
    // Update the card's date to show "Updated [date]" 
    const cardRegex = new RegExp(`(<a href="/blog/${targetSlug}"[^>]*>[^<]*</a>[^]*?<div class="meta">)[^<]*(</div>)`);
    const todayStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (cardRegex.test(blogHtml)) {
      blogHtml = blogHtml.replace(cardRegex, `$1Updated ${todayStr}$2`);
      writeFileSync(blogListing, blogHtml);
      console.log(`  ✅ Updated blog listing date`);
    }
  }

  console.log('\n✅ Content refresh complete');
  console.log(`   Slug: ${targetSlug}`);
  console.log(`   New sections: ${newWordCount} words`);
  console.log(`   Modified: ${now.toISOString().split('T')[0]}`);
  console.log('════════════════════════════════════════════');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
