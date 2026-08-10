import { existsSync } from 'fs';
import { resolve } from 'path';

// Self-hosted hero detection (public/ is served at the site root)
function heroExists(url) {
  try {
    return existsSync(resolve(process.cwd(), 'public', String(url).replace(/^\//, '')));
  } catch { return false; }
}

// Zero-dependency date formatting (replaces date-fns)
function formatDateStr(date, pattern) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date(date);
  if (isNaN(d.getTime())) return pattern;
  const month = MONTHS[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  if (pattern === 'MMMM dd, yyyy' || pattern === 'MMMM dd, YYYY') return `${month} ${day}, ${year}`;
  if (pattern === 'MMMM yyyy' || pattern === 'MMMM YYYY') return `${month} ${year}`;
  return pattern;
}

/**
 * Canonical blog post renderer — aligned with public/blog/_TEMPLATE.html structure.
 * Every blog post rendered through this function produces identical HTML structure
 * regardless of whether the content came from programmatic generation or static files.
 *
 * Structural guarantees:
 *   ✓ Breadcrumb nav (Home > Blog > Article)
 *   ✓ Author E-E-A-T box
 *   ✓ Hero image (eager, fetchpriority="high", explicit dimensions)
 *   ✓ TL;DR block (extracted from content or generated from meta)
 *   ✓ TOC (extracted from H2s in content, or generated)
 *   ✓ Content body (as-provided)
 *   ✓ Mid-article CTA (if not already in content)
 *   ✓ FAQ section (extracted from content or generated)
 *   ✓ Key Takeaways (extracted from content or generated)
 *   ✓ Bottom CTA
 *   ✓ Related posts
 *   ✓ Dual JSON-LD schema (Article + FAQPage)
 */

// ── Glossary term auto-linking (injects internal links into content) ───

const GLOSSARY_MAP = [
  ['YouTube Algorithm', '/glossary/youtube-algorithm'],
  ['YouTube Tags', '/glossary/youtube-tags'],
  ['Youtube Tags', '/glossary/youtube-tags'],
  ['CTR', '/glossary/click-through-rate'],
  ['Click-Through Rate', '/glossary/click-through-rate'],
  ['Audience Retention', '/glossary/audience-retention'],
  ['Watch Time', '/glossary/watch-time'],
  ['Impressions', '/glossary/impressions'],
  ['YouTube Keyword Research', '/glossary/youtube-keyword-research'],
  ['Search Volume', '/glossary/search-volume'],
  ['Keyword Difficulty', '/glossary/keyword-difficulty'],
  ['Title Optimization', '/glossary/title-optimization'],
  ['Thumbnail Optimization', '/glossary/thumbnail-optimization'],
  ['Description Optimization', '/glossary/description-optimization'],
  ['Video Chapters', '/glossary/video-chapters'],
  ['Transcript SEO', '/glossary/transcript-seo'],
  ['Keyword Cannibalization', '/glossary/keyword-cannibalization'],
  ['Evergreen Content', '/glossary/evergreen-content'],
  ['Competitor Analysis', '/glossary/competitor-analysis'],
  ['Dwell Time', '/glossary/dwell-time'],
  ['Session Time', '/glossary/session-time'],
  ['Content Pillar', '/glossary/content-pillar'],
  ['Video Hook', '/glossary/video-hook'],
  ['Channel Audit', '/glossary/channel-audit'],
  ['YouTube Shorts', '/glossary/youtube-shorts'],
  ['A/B Testing', '/glossary/ab-testing'],
  ['Topic Authority', '/glossary/topic-authority'],
  ['Shorts Algorithm', '/glossary/shorts-algorithm'],
  ['YouTube Analytics', '/glossary/youtube-analytics'],
  ['Playlist Optimization', '/glossary/playlist-optimization'],
  ['Call to Action', '/glossary/call-to-action'],
  ['Content Gap Analysis', '/glossary/content-gap-analysis'],
  ['Ad Revenue', '/glossary/ad-revenue'],
  ['Demonetization', '/glossary/demonetization'],
  ['Closed Captions', '/glossary/closed-captions'],
  ['External Traffic', '/glossary/external-traffic'],
  ['Long-Tail Keywords', '/glossary/long-tail-keywords'],
  ['Channel Branding', '/glossary/channel-branding'],
  ['Competitor Analysis', '/glossary/competitor-analysis'],
  ['Collaboration', '/glossary/collaboration'],
  ['Community Tab', '/glossary/community-tab'],
  ['Cross-Promotion', '/glossary/cross-promotion'],
  ['Content Calendar', '/glossary/content-calendar'],
  ['Video Backlinks', '/glossary/video-backlinks'],
  ['YouTube Studio', '/glossary/youtube-studio'],
  ['YouTube Premium', '/glossary/youtube-premium'],
  ['YouTube Creator Academy', '/glossary/youtube-creator-academy'],
  ['YouTube Partner Program', '/glossary/youtube-partner-program'],
  ['Community Guidelines', '/glossary/community-guidelines'],
  ['Gaming on YouTube', '/glossary/gaming-on-youtube'],
  ['YouTube Hashtags', '/glossary/youtube-hashtags'],
  ['Mid-Roll Ads', '/glossary/mid-roll-ads'],
];

function linkGlossaryTerms(html) {
  const sortedTerms = GLOSSARY_MAP.map(g => g[0]).sort((a, b) => b.length - a.length);
  let result = html;

  // Protect script/style/pre/code blocks, existing links, AND every HTML tag — so term
  // matching only ever touches visible text nodes. Without this, terms inside attribute
  // values (e.g. img alt="...") or JSON-LD strings get wrapped in <a> tags, corrupting markup.
  const protectedRegions = [];
  let protectedIdx = 0;
  const protect = (m) => { const t = `__PROTECTED_LINK_${protectedIdx}__`; protectedRegions.push(m); protectedIdx++; return t; };
  result = result
    .replace(/<script[\s\S]*?<\/script>/gi, protect)
    .replace(/<style[\s\S]*?<\/style>/gi, protect)
    .replace(/<pre[\s\S]*?<\/pre>/gi, protect)
    .replace(/<code[\s\S]*?<\/code>/gi, protect)
    .replace(/<a\s[^>]*>.*?<\/a>/gi, protect)
    .replace(/<[^>]*>/g, protect);

  for (const term of sortedTerms) {
    // Find the slug for this term
    let slug = '';
    for (const g of GLOSSARY_MAP) {
      if (g[0].toLowerCase() === term.toLowerCase()) { slug = g[1].replace('/glossary/', ''); break; }
    }
    if (!slug) continue;

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![\\w\\-])(${escaped})(?![\\w\\-])`, 'gi');

    result = result.replace(regex, (match) => {
      return `<a href="/glossary/${slug}" class="glossary-link">${match}</a>`;
    });
  }

  // Restore protected regions in ONE pass — per-token replace would be O(n^2) now that
  // every tag is protected. Function replacer keeps `$` patterns (e.g. "$1,000") intact.
  result = result.replace(/__PROTECTED_LINK_(\d+)__/g, (match, i) => protectedRegions[Number(i)]);

  return result;
}

// ── Section detection ────────────────────────────────────────────────

function hasSection(html, className) {
  return new RegExp(`class=["'][^"']*${className}[^"']*["']`).test(html);
}

function hasHeroImage(html) {
  return /<img[^>]*loading=["']eager["'][^>]*>/i.test(html) ||
         /class=["'][^"']*featured-image-wrapper[^"']*["']/i.test(html);
}

function extractH2s(html) {
  const re = /<h2[^>]*id=["']([^"']+)["'][^>]*>(.*?)<\/h2>/gi;
  const headings = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    headings.push({ id: m[1], text: m[2].replace(/<[^>]+>/g, '') });
  }
  if (headings.length === 0) {
    // Try H2s without IDs — we'll anchor them
    const re2 = /<h2[^>]*>(.*?)<\/h2>/gi;
    while ((m = re2.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '');
      if (!/⚡|📑|❓|🎯/.test(text)) {
        headings.push({ id: `section-${headings.length}`, text });
      }
    }
  }
  return headings;
}

function extractFAQItems(html) {
  const items = [];
  const detailRe = /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*<div[^>]*class=["'][^"']*faq-answer[^"']*["'][^>]*>\s*<p>(.*?)<\/p>/gi;
  let m;
  while ((m = detailRe.exec(html)) !== null) {
    items.push({
      question: m[1].replace(/<[^>]+>/g, '').trim(),
      answer: m[2].replace(/<[^>]+>/g, '').trim()
    });
  }
  // Fallback: just questions
  if (items.length === 0) {
    const summaryRe = /<summary[^>]*>(.*?)<\/summary>/gi;
    while ((m = summaryRe.exec(html)) !== null) {
      items.push({
        question: m[1].replace(/<[^>]+>/g, '').trim(),
        answer: m[1].replace(/<[^>]+>/g, '').trim()
      });
    }
  }
  return items;
}

// ── Auto-generated sections (when content lacks them) ──────────────────

function generateTLDRBlock(page) {
  const title = page.title || page.h1 || '';
  const meta = page.metaDescription || '';
  return `<div class="tldr">
      <h2>⚡ TL;DR</h2>
      <ul>
        <li><strong>Direct Answer:</strong> ${esc(title)} gives you the exact strategies used by top YouTube creators to grow their channels in 2026.</li>
        ${meta ? `<li>${esc(meta)}</li>` : ''}
        <li>This guide covers keyword research, title optimization, tag strategy, and AI-powered tools — all backed by real channel data.</li>
        <li>Apply these methods and track results inside the <a href="/dashboard">YT SEO Architect dashboard</a>.</li>
      </ul>
    </div>`;
}

function generateTOCNav(headings) {
  if (!headings.length) return '';
  let html = `<nav class="toc" aria-label="Table of contents">
      <h2>📑 In This Article</h2>
      <ol>`;
  for (const h of headings.slice(0, 8)) {
    html += `\n        <li><a href="#${escAttr(h.id)}">${esc(h.text)}</a></li>`;
  }
  html += `\n      </ol>
    </nav>`;
  return html;
}

function generateKeyTakeaways(headings, page) {
  const items = [];
  if (headings.length >= 2) items.push(`Master <strong>${esc(headings[0]?.text || page.title)}</strong> to improve your video rankings.`);
  if (headings.length >= 3) items.push(`Apply the <strong>${esc(headings[1]?.text || 'step-by-step methods')}</strong> outlined above to your next upload.`);
  items.push(`Use <a href="/dashboard">YT SEO Architect</a> to automate optimization and track results.`);
  items.push('Treat YouTube SEO as a continuous process — audit, update, and improve monthly.');
  return `<div class="key-takeaways" id="key-takeaways">
      <h2>🎯 Key Takeaways</h2>
      <ul>
        ${items.map(i => `<li>${i}</li>`).join('\n        ')}
      </ul>
    </div>`;
}

function generateFAQBlock(page) {
  const kw = (page.title || '').replace(/—.*/, '').trim();
  return `<section class="faq" id="faq">
      <h2>❓ Frequently Asked Questions</h2>
      <details>
        <summary>What is ${esc(kw)} and why does it matter?</summary>
        <div class="faq-answer"><p>${esc(kw)} is a critical component of YouTube channel growth. Creators who optimize systematically see measurable improvements in click-through rate, watch time, and subscriber growth within 30-90 days.</p></div>
      </details>
      <details>
        <summary>How long does it take to see results?</summary>
        <div class="faq-answer"><p>Most creators see measurable improvements in CTR and views within 2-4 weeks of applying these strategies. Full ranking impact typically takes 4-8 weeks as YouTube processes the optimization signals.</p></div>
      </details>
      <details>
        <summary>Can I do this without paid tools?</summary>
        <div class="faq-answer"><p>Yes. YouTube's built-in analytics, autocomplete search, and the free tier of <a href="/dashboard">YT SEO Architect</a> provide everything you need to start optimizing. Paid tools accelerate the process but aren't required.</p></div>
      </details>
      <details>
        <summary>What is the single highest-impact change I can make today?</summary>
        <div class="faq-answer"><p>Title optimization. A better title directly increases CTR, which signals YouTube to promote your video more widely. Start there, then optimize descriptions and tags.</p></div>
      </details>
      <details>
        <summary>How often should I update my video SEO?</summary>
        <div class="faq-answer"><p>Review your top 10 videos monthly. Update titles and thumbnails on underperformers. Re-research keywords quarterly. The algorithm rewards fresh optimization signals.</p></div>
      </details>
    </section>`;
}

function generateRelatedPosts(page) {
  // Core pillar posts — validated, template-compliant, 1,500+ words
  return `<nav class="related-posts" aria-label="Related articles">
    <h3>📖 Related Articles</h3>
    <div class="related-posts-grid">
      <a href="/blog/best-youtube-seo-tools-2026" class="related-post-card">
        <span class="rp-title">Best YouTube SEO Tools in 2026</span>
        <span class="rp-meta">Compared by use case &amp; price</span>
      </a>
      <a href="/blog/youtube-competitor-analysis-reverse-engineer" class="related-post-card">
        <span class="rp-title">YouTube Competitor Analysis</span>
        <span class="rp-meta">Reverse-engineer top channels</span>
      </a>
      <a href="/blog/youtube-analytics-explained-2026" class="related-post-card">
        <span class="rp-title">YouTube Analytics Explained 2026</span>
        <span class="rp-meta">Read your data like a pro</span>
      </a>
      <a href="/blog/youtube-seo-audit-diagnostic-fix-2026" class="related-post-card">
        <span class="rp-title">YouTube SEO Audit Guide</span>
        <span class="rp-meta">5-min diagnostic for more views</span>
      </a>
      <a href="/blog/youtube-thumbnail-ab-testing-guide" class="related-post-card">
        <span class="rp-title">YouTube Thumbnail A/B Testing</span>
        <span class="rp-meta">Double your CTR in 30 days</span>
      </a>
    </div>
  </nav>`;
}

// ── Social Share Buttons ──────────────────────────────────────────────

function generateShareBar(slug, title, isBottom) {
  const url = `https://yt-seo-architect.vercel.app/blog/${slug}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const bottomClass = isBottom ? ' share-bar-bottom' : '';
  return `<div class="share-bar${bottomClass}" style="display:flex;align-items:center;gap:0.5rem;margin:1.5rem 0;flex-wrap:wrap">
      <span class="share-label" style="font-size:0.75rem;font-weight:700;color:#5d6676;text-transform:uppercase;letter-spacing:0.08em;margin-right:0.25rem">Share</span>
      <a href="https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn reddit" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(255,69,0,0.08);color:#ff4500;border-color:rgba(255,69,0,0.15)" aria-label="Share on Reddit">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
        Reddit
      </a>
      <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn x-twitter" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(29,155,240,0.08);color:#1d9bf0;border-color:rgba(29,155,240,0.15)" aria-label="Share on X">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        X
      </a>
      <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn linkedin" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(10,102,194,0.08);color:#0a66c2;border-color:rgba(10,102,194,0.15)" aria-label="Share on LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        LinkedIn
      </a>
      <a href="https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-btn whatsapp" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(37,211,102,0.08);color:#25d366;border-color:rgba(37,211,102,0.15)" aria-label="Share on WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </a>
      <a href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn telegram" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(0,136,204,0.08);color:#0088cc;border-color:rgba(0,136,204,0.15)" aria-label="Share on Telegram">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        Telegram
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-btn facebook" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(24,119,242,0.08);color:#1877f2;border-color:rgba(24,119,242,0.15)" aria-label="Share on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
      <button onclick="navigator.clipboard.writeText(window.location.href).then(()=>{const b=this;b.classList.add('copied');b.querySelector('span').textContent='Copied!';setTimeout(()=>{b.classList.remove('copied');b.querySelector('span').textContent='Copy Link'},2000)})" class="share-btn copy-link" style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.4rem 0.85rem;border-radius:0.5rem;font-size:0.78rem;font-weight:600;text-decoration:none;border:1px solid transparent;cursor:pointer;font-family:inherit;background:rgba(255,255,255,0.05);color:#a8b2c1;border-color:rgba(255,255,255,0.06)" aria-label="Copy link to clipboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>Copy Link</span>
      </button>
    </div>`;
}

// ── Schema generation ──────────────────────────────────────────────────

function generateDualSchema(page, faqItems) {
  const title = page.title || '';
  const desc = (page.metaDescription || '').replace(/"/g, '&quot;').substring(0, 155);
  const slug = page.slug;
  const isoDate = formatDate(page.publishedAt || page.createdAt || new Date());
  const isoUpdate = formatDate(page.updatedAt || page.publishedAt || page.createdAt || new Date());

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title.substring(0, 110),
    description: desc,
    datePublished: isoDate,
    dateModified: isoUpdate,
    author: {
      '@type': 'Person',
      name: 'Patrick',
      url: 'https://yt-seo-architect.vercel.app/about',
      sameAs: ['https://github.com/nhlaka3'],
      knowsAbout: ['YouTube SEO', 'YouTube Analytics', 'YouTube Algorithm', 'Content Strategy']
    },
    publisher: {
      '@type': 'Organization',
      name: 'YT SEO Architect',
      url: 'https://yt-seo-architect.vercel.app/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://yt-seo-architect.vercel.app/og-image.png'
      },
      sameAs: [
        'https://twitter.com/YTSEOArchitect',
        'https://linkedin.com/company/yt-seo-architect',
        'https://github.com/nhlaka3'
      ]
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://yt-seo-architect.vercel.app/blog/${slug}`
    },
    speakable: {
      '@type': 'SpeakableSpecification',
      xpath: ['/html/head/title', '//h1', "//*[@id='direct-answer']", "//*[@class='tldr']"]
    }
  };

  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer || f.question
      }
    })),
    speakable: {
      '@type': 'SpeakableSpecification',
      xpath: ['/h1', "//*[@id='direct-answer']/@content", "//meta[@name='description']/@content"]
    }
  } : null;

  return JSON.stringify(faqSchema ? [articleSchema, faqSchema] : [articleSchema]);
}

// ── Helpers ────────────────────────────────────────────────────────────

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }
function formatDate(d) { return new Date(d).toISOString().split('T')[0]; }

function heroImageHTML(slug, title) {
  // Self-hosted branded hero when available; otherwise fall back to the site OG image.
  // (picsum.photos hotlinks were removed — external images hurt reliability and SEO.)
  const alt = (title || slug).replace(/—.*/, '').trim();
  const heroWebp = `/blog/${slug}-hero.webp`;
  const heroPng = `/blog/${slug}-hero.png`;
  const useWebp = heroExists(heroWebp);
  const src = useWebp ? heroWebp : (heroExists(heroPng) ? heroPng : '/og-image.png');
  const fallback = useWebp ? (heroExists(heroPng) ? heroPng : '/og-image.png') : null;
  const picture = useWebp
    ? `<picture><source srcset="${heroWebp}" type="image/webp" /><img src="${fallback}" alt="${escAttr(alt)} guide — YT SEO Architect" width="800" height="400" loading="eager" fetchpriority="high" style="width:100%;height:auto;max-width:800px;border-radius:12px;border:1px solid #2D215E;" /></picture>`
    : `<img src="${src}" alt="${escAttr(alt)} guide — YT SEO Architect" width="800" height="400" loading="eager" fetchpriority="high" style="width:100%;height:auto;max-width:800px;border-radius:12px;border:1px solid #2D215E;" />`;
  return `<div class="featured-image-wrapper" style="margin:24px 0;text-align:center;">
      ${picture}
    </div>`;
}

// ── Affiliate Disclosure + Gear Sections ──────────────────────────────

const AFFILIATE_TAG = '44HlecM';
const AFFILIATE_URL = `https://amzn.to/${AFFILIATE_TAG}`;

// Specific product URLs from affiliate-mapper.json
const PRODUCT_URLS = {
  'Ring Light for YouTube': `https://www.amazon.com/dp/B01LXS2U0U?tag=${AFFILIATE_TAG}`,
  'Blue Yeti Microphone': `https://www.amazon.com/dp/B00N1YPXW2?tag=${AFFILIATE_TAG}`,
  'Tripod for YouTube': `https://www.amazon.com/dp/B005KP473Q?tag=${AFFILIATE_TAG}`,
  'SD Card for Video': `https://www.amazon.com/dp/B08YF7PB14?tag=${AFFILIATE_TAG}`,
  'Teleprompter for YouTube': `https://www.amazon.com/dp/B0BXD19D79?tag=${AFFILIATE_TAG}`,
  '4K Monitor for Editing': `https://www.amazon.com/dp/B08YF7PB14?tag=${AFFILIATE_TAG}`,
  'Sony ZV-1 Camera': `https://www.amazon.com/dp/B08965JV8D?tag=${AFFILIATE_TAG}`,
  'LED Panel Light': `https://www.amazon.com/dp/B0F99DXC8X?tag=${AFFILIATE_TAG}`,
  'Green Screen Kit': `https://www.amazon.com/dp/B0743Z892W?tag=${AFFILIATE_TAG}`,
  'Webcam': `https://www.amazon.com/dp/B006A2Q81M?tag=${AFFILIATE_TAG}`,
  'Headphones': `https://www.amazon.com/dp/B00HVLUR86?tag=${AFFILIATE_TAG}`,
  'Audio Interface': `https://www.amazon.com/dp/B07QR6Z1JB?tag=${AFFILIATE_TAG}`,
  'Studio Monitors': `https://www.amazon.com/dp/B00NESC6LU?tag=${AFFILIATE_TAG}`,
  'Pop Filter': `https://www.amazon.com/dp/B01N21H9WY?tag=${AFFILIATE_TAG}`,
  'Boom Arm': `https://www.amazon.com/dp/B07V2FJL54?tag=${AFFILIATE_TAG}`,
  'Gimbal': `https://www.amazon.com/dp/B0B7XD7R43?tag=${AFFILIATE_TAG}`,
  'External Hard Drive': `https://www.amazon.com/dp/B0713WPGLL?tag=${AFFILIATE_TAG}`,
};

function getProductUrl(title) {
  // Exact match only — no fragile partial matching
  if (PRODUCT_URLS[title]) return PRODUCT_URLS[title];
  return AFFILIATE_URL;
}

function generateAffiliateDisclosure() {
  return `<div style="padding:0.8rem 1rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);font-size:0.82rem;color:#6b7280;margin:1.5rem 0;">
    <strong>Disclosure:</strong> This post contains affiliate links. If you purchase through these links, I may earn a commission at no extra cost to you. I only recommend products I genuinely use and believe in.
  </div>`;
}

function getGearCategory(title) {
  const t = (title || '').toLowerCase();
  if (/cook|food|recipe|kitchen/.test(t)) return 'cooking';
  if (/game|gaming/.test(t)) return 'gaming';
  if (/\btutorial\b/.test(t)) return 'tutorials';
  if (/music|song|audio/.test(t)) return 'music';
  if (/fitness|workout|exercise/.test(t)) return 'fitness';
  if (/short(s)?/.test(t)) return 'shorts';
  if (/thumbnail|design|ab.?test/.test(t)) return 'thumbnails';
  if (/analytics|metric|data|retention/.test(t)) return 'analytics';
  if (/monetiz|income|revenue|brand|sponsor/.test(t)) return 'monetization';
  if (/impression|ctr|click/.test(t)) return 'impressions';
  if (/end.?screen|card/.test(t)) return 'end_screens';
  return 'seo_metadata';
}

const GEAR_CATEGORIES = {
  cooking: {
    title: '🎥 Gear for Cooking YouTube Channels',
    intro: 'Cooking channels need great lighting for food close-ups and hands-free audio while you cook.',
    items: [
      ['Ring Light for YouTube', '18-inch Ring Light', 'essential for overhead food shots — even lighting makes every dish look appetizing'],
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'hands-free recording while you cook — mount it on a boom arm above the counter'],
      ['Tripod for YouTube', 'Overhead Tripod Mount', 'position your camera directly above the cutting board for the classic cooking tutorial angle'],
    ]
  },
  gaming: {
    title: '🎮 Gear for Gaming YouTube Channels',
    intro: 'Gaming content requires clean audio capture and good facecam lighting for commentary videos.',
    items: [
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'crisp commentary audio without background keyboard noise — use the cardioid pattern'],
      ['Ring Light for YouTube', 'Ring Light for Facecam', 'even lighting for facecam overlays — viewers notice when your facecam looks dark and grainy'],
      ['SD Card for Video', '128GB SD Card', 'fast write speeds for recording long gaming sessions without dropped frames'],
    ]
  },
  tutorials: {
    title: '💻 Gear for Tutorial YouTube Channels',
    intro: 'Tutorials live and die by audio clarity — viewers will tolerate average video but not muffled sound.',
    items: [
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'studio-quality voiceover without the studio — the most popular mic for tutorial creators'],
      ['Ring Light for YouTube', 'Ring Light', 'professional facecam lighting for intro/outro segments of your tutorials'],
      ['Teleprompter for YouTube', 'Teleprompter for Scripts', 'read your tutorial scripts naturally without looking down at notes — keeps eye contact with viewers'],
    ]
  },
  music: {
    title: '🎵 Gear for Music YouTube Channels',
    intro: 'Music channels need accurate audio monitoring and clean recording setups.',
    items: [
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'record vocals and acoustic instruments with studio-quality detail — switchable pickup patterns'],
      ['Ring Light for YouTube', 'LED Panel Light', 'stage-style lighting for performance videos — consistent color temperature for accurate skin tones'],
      ['SD Card for Video', '128GB SD Card', 'high-speed recording for 4K music performance videos without buffering'],
    ]
  },
  fitness: {
    title: '💪 Gear for Fitness YouTube Channels',
    intro: 'Fitness content needs wide-angle lighting and wireless audio for full-body movement.',
    items: [
      ['Ring Light for YouTube', '18-inch Ring Light', 'wide, even lighting for full-body workout demonstrations — eliminates shadows on the floor'],
      ['Tripod for YouTube', 'Tripod with Pan Head', 'smooth panning for following workout movements — stable base for heavy cameras'],
      ['Blue Yeti Microphone', 'Wireless Lavalier Mic', 'clip-on microphone for hands-free instruction during high-movement exercises'],
    ]
  },
  shorts: {
    title: '📱 Gear for Shooting YouTube Shorts',
    intro: 'Shorts require quick setup and vertical-friendly gear for fast production cycles.',
    items: [
      ['Ring Light for YouTube', 'Ring Light', 'essential for face-to-camera Shorts — the algorithm rewards clear, well-lit first frames'],
      ['Tripod for YouTube', 'Flexible Phone Tripod', 'quick vertical-to-horizontal switching — mount your phone and start recording in seconds'],
      ['SD Card for Video', '128GB SD Card', 'fast read/write for batching multiple Shorts in a single session'],
    ]
  },
  thumbnails: {
    title: '🎨 Gear for YouTube Thumbnail & Design Work',
    intro: 'Thumbnails need accurate color display and good lighting for self-portrait shots.',
    items: [
      ['4K Monitor for Editing', '4K Monitor', 'color-accurate display for editing thumbnails — what you see is what viewers get'],
      ['Ring Light for YouTube', 'Ring Light', 'flawless lighting for thumbnail selfies — even illumination for consistent brand look'],
      ['SD Card for Video', '128GB SD Card', 'store high-resolution source images and project files for thumbnail creation'],
    ]
  },
  analytics: {
    title: '📈 Gear for YouTube Analytics & Growth Tracking',
    intro: 'Deep analytics work benefits from a large display and comfortable workspace setup.',
    items: [
      ['4K Monitor for Editing', '4K Monitor', 'spreadsheet and analytics dashboards side-by-side — see trends you\'d miss on a laptop screen'],
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'record data-driven video essays with clear, professional voiceover'],
      ['SD Card for Video', '128GB SD Card', 'backup your YouTube Studio exports and analytics screenshots for trend analysis'],
    ]
  },
  monetization: {
    title: '💰 Gear for YouTube Monetization & Business Content',
    intro: 'Business-focused content needs to look professional to attract brand deals and sponsors.',
    items: [
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'studio-quality audio that signals professionalism to potential brand partners'],
      ['Ring Light for YouTube', 'Ring Light', 'professional lighting that makes your channel look sponsor-ready'],
      ['4K Monitor for Editing', '4K Monitor', 'edit revenue dashboards and earnings screenshots with crystal-clear detail'],
    ]
  },
  impressions: {
    title: '👁️ Gear for YouTube Impressions & CTR Optimization',
    intro: 'Impressions start with clickable thumbnails — the right gear makes them stand out.',
    items: [
      ['Ring Light for YouTube', 'Ring Light', 'professional lighting for thumbnail selfies that catch the eye in search results'],
      ['4K Monitor for Editing', '4K Monitor', 'preview thumbnails at YouTube\'s display size — test readability before publishing'],
      ['SD Card for Video', '128GB SD Card', 'store thumbnail source files and A/B test variations without running out of space'],
    ]
  },
  end_screens: {
    title: '🎯 Gear for YouTube End Screens & Cards Strategy',
    intro: 'End screens drive session watch time — make sure your linked videos look great.',
    items: [
      ['4K Monitor for Editing', '4K Monitor', 'preview end screen layouts at full resolution — ensure text and thumbnails are readable'],
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'record compelling end screen voiceovers that drive clicks to your next video'],
      ['Ring Light for YouTube', 'Ring Light', 'consistent lighting across linked videos so your end screen thumbnails match'],
    ]
  },
  seo_metadata: {
    title: '📊 Gear for YouTube SEO & Metadata Optimization',
    intro: 'Optimizing metadata is a desk job — the right monitor and audio setup keeps you productive.',
    items: [
      ['4K Monitor for Editing', 'Ultrawide Monitor', 'side-by-side comparison of YouTube Analytics and metadata editor — multitask without alt-tabbing'],
      ['Blue Yeti Microphone', 'Blue Yeti USB Mic', 'record voiceover for metadata-optimized videos with broadcast-quality audio'],
      ['Ring Light for YouTube', 'Ring Light', 'quick lighting setup for face-to-camera intro segments that pair with your optimized metadata'],
    ]
  },
};

function generateGearSection(title) {
  const category = getGearCategory(title);
  const gear = GEAR_CATEGORIES[category];
  if (!gear) return '';
  const items = gear.items.map(([linkTitle, displayName, desc]) =>
    `      <li><strong>${esc(displayName.split(' ')[0])}:</strong> <a href="${getProductUrl(linkTitle)}" class="affiliate-link" rel="nofollow sponsored" title="${escAttr(linkTitle)}">${esc(displayName)}</a> — ${esc(desc)}</li>`
  ).join('\n');
  return `  <!-- Recommended Gear (Amazon Affiliate) -->
  <div style="margin:2.5rem 0;padding:1.5rem;background:linear-gradient(135deg,rgba(6,182,212,0.08) 0%,rgba(99,102,241,0.08) 100%);border-radius:12px;border:1px solid rgba(6,182,212,0.15);">
    <h3 style="color:#f9fafb;font-size:1.1rem;margin:0 0 0.8rem;">${esc(gear.title)}</h3>
    <p style="color:#9ca3af;font-size:0.9rem;margin:0 0 1rem;">${esc(gear.intro)}</p>
    <ul style="color:#d1d5db;font-size:0.9rem;line-height:1.8;padding-left:1.2rem;">
${items}
    </ul>
  </div>`;
}

// ── Main render function ───────────────────────────────────────────────

export function renderBlogTemplate(page) {
  const publishDate = page.publishedAt || page.createdAt || new Date();
  const updateDate = page.updatedAt || publishDate;
  const formattedDate = formatDateStr(new Date(publishDate), 'MMMM dd, yyyy');
  const formattedUpdateDate = formatDateStr(new Date(updateDate), 'MMMM yyyy');
  const slug = page.slug;
  const title = page.title || '';
  // Truncate SERP title to <=60 chars (Google display limit); keep body H1 + schema full
  const metaTitle = title.length > 60
    ? title.substring(0, 57).replace(/\s+\S*$/, '') + '…'
    : title;
  const metaDesc = (page.metaDescription || '').replace(/"/g, '&quot;');
  const rawContent = page.content || '';
  // Calculate word count from actual content (strips HTML tags)
  const contentText = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length || 0;
  const readMinutes = Math.max(8, Math.ceil(wordCount / 200));

  // Detect existing structural sections in content
  const hasTLDR = hasSection(rawContent, 'tldr');
  const hasTOC = hasSection(rawContent, 'toc');
  const hasFAQ = hasSection(rawContent, 'faq');
  const hasKeyTakeaways = hasSection(rawContent, 'key-takeaways') || hasSection(rawContent, 'key-takeaways');
  const hasHero = false; // Always inject via template — body content hero is stripped
  const hasCTA = hasSection(rawContent, 'cta-box');
  const hasAuthorBox = hasSection(rawContent, 'author-box') || hasSection(rawContent, 'author-info');
  const hasBreadcrumbs = hasSection(rawContent, 'breadcrumb') || /"BreadcrumbList"/i.test(rawContent);

  // Extract structural data from content
  const h2s = extractH2s(rawContent);
  const faqItems = extractFAQItems(rawContent);

  // Extract the article body early — needed to hoist a content-provided TL;DR
  // above the TOC (canonical order: TL;DR → TOC → ad → body).
  let bodyContent = rawContent;
  const articleMatchB = bodyContent.match(/<article>([\s\S]*?)<\/article>/i);
  if (articleMatchB) {
    bodyContent = articleMatchB[1].trim();
  }
  // Strip duplicate H1 (template provides one) and any existing related-posts/footer sections
  // Also strip share bars, meta lines, author box, hero image — template renders these
  bodyContent = bodyContent
    // Some DB posts store a FULL HTML page (incl. <head> with its own canonical/meta).
    // Strip the embedded head so we never emit duplicate <link rel=canonical> / meta tags.
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<h1[^>]*>.*?<\/h1>/i, '')
    .replace(/<nav\s[^>]*class="related-posts"[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<div\s[^>]*class="share-bar[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<p\s[^>]*class="meta"[^>]*>[\s\S]*?<\/p>/gi, '')
    .replace(/<div\s[^>]*class="author-box[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div\s[^>]*class="adsense-blog[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div\s[^>]*class="featured-image-wrapper[^>]*>[\s\S]*?<\/div>/gi, '')
    // Strip any JSON-LD blocks embedded in the article body — schema belongs in the
    // <head> (the template emits one clean block via JSON.stringify below). Embedded
    // blocks from generators are often unparseable and break rich results.
    .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
  // Hoist a content-provided TL;DR block (from ANY position) so it renders
  // above the TOC. Stored full-page posts embed their own tldr/toc/breadcrumb
  // chrome — strip the duplicates and let the template regenerate them.
  let hoistedTLDR = '';
  let strippedTOC = false;
  const anyTLDR = bodyContent.match(/<div\s[^>]*class=["'][^"']*tldr[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
  if (anyTLDR) {
    hoistedTLDR = anyTLDR[0].trim();
  }
  bodyContent = bodyContent
    .replace(/<div\s[^>]*class=["'][^"']*tldr[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<nav\s[^>]*class="toc"[^>]*>[\s\S]*?<\/nav>/gi, (_m) => { strippedTOC = true; return ''; })
    .replace(/<nav\s[^>]*class="breadcrumb"[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<!--\s*Breadcrumb\s*-->/gi, '')
    .trim();

  // Build content sections (insert structural wrappers where missing)
  let contentHTML = '';

  // 1. TL;DR block
  if (hoistedTLDR) {
    contentHTML += hoistedTLDR;
  } else if (!hasTLDR) {
    contentHTML += generateTLDRBlock(page);
  }

  // 2. TOC nav (before any ad — keeps the TL;DR → TOC → content flow tight;
  // regenerate when the stored copy was stripped)
  if (h2s.length >= 3 && (!hasTOC || strippedTOC)) {
    const contentH2s = h2s.filter(h => !/faq|key takeaways|conclusion|in this article/i.test(h.text));
    contentHTML += generateTOCNav(contentH2s);
  }

  // AdSense: Post-TOC (moved below the TOC so it doesn't separate TL;DR from
  // the article; auto-collapses when no ad is served so unfilled units never
  // leave a gap in the layout)
  contentHTML += `<div class="adsense-blog-top" style="margin:1rem 0 1.5rem; text-align:center;">
    <ins class="adsbygoogle"
         style="display:inline-block;width:728px;height:90px"
         data-ad-client="ca-pub-3831668789026424"
         data-ad-slot="8703240267"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>
         (adsbygoogle = window.adsbygoogle || []).push({});
    <\/script>
  </div>`;

  // 3. Body content (the AI-generated or template-generated HTML) — with auto-linked glossary terms
  // (bodyContent was extracted and cleaned above, incl. TL;DR hoisting)
  const linked = linkGlossaryTerms(bodyContent);
  contentHTML += linked;

  // 3b. Try-the-Tool CTA (if a corresponding interactive tool page exists)
  // Dynamically check if a tool file exists for this blog slug
  const blogSlug = (page.slug || '').replace(/^(how-to-|what-does-|why-|when-to-)/, '');
  let toolExists = false;
  const STATIC_TOOL_SLUGS = [
      "best-youtube-seo-tools-2026", "fix-youtube-shadow-ban-2026", "keywords-youtube",
      "metadata-youtube", "rank-on-youtube-2026", "youtube-ctr-actually-mean",
      "youtube-ai-seo-coach-phronesis-2026", "youtube-algorithm-changes-2026",
      "youtube-analytics-4-metrics-that-matter", "youtube-analytics-explained-2026",
      "youtube-chapter-timestamps-seo-guide", "youtube-community-posts-strategy-2026",
      "youtube-competitor-analysis-reverse-engineer", "youtube-description-templates-2026",
      "youtube-end-screens-cards-guide-2026", "youtube-for-small-channels-2026",
      "youtube-for-tutorials-2026", "youtube-impressions-guide-2026",
      "youtube-intro-hook-first-3-seconds", "youtube-metadata-auditor-vs-vidiq-shadow-ban",
      "youtube-monetization-tips-2026", "youtube-playlist-optimization-strategy",
      "youtube-retention-graph-explained-2026", "youtube-seo-audit-diagnostic-fix-2026",
      "youtube-seo-checklist-beginners-2026", "youtube-seo-examples-2026",
      "youtube-seo-for-business-channels-2026", "youtube-seo-for-gaming-channels-2026",
      "youtube-seo-template-2026", "youtube-shorts-seo-ranking-guide-2026", "youtube-tags-2026",
      "youtube-thumbnail-ab-testing-guide", "youtube-title-examples-2026",
      "youtube-video-not-getting-views-diagnostic-fix-2026",
    ];
    toolExists = STATIC_TOOL_SLUGS.includes(blogSlug) || STATIC_TOOL_SLUGS.includes(page.slug);
  if (toolExists) {
    const toolSlug = blogSlug || page.slug;
    const toolUrl = `/tools/${toolSlug}`;
    contentHTML += `\n      <div class="tool-cta" style="margin:2.5rem 0;padding:1.5rem;background:rgba(0,242,255,0.04);border:1px solid rgba(0,242,255,0.2);border-radius:12px;text-align:center;">
        <h3 style="color:var(--cyan, #00f2ff);margin-bottom:0.5rem;">🛠️ Try the Interactive Tool</h3>
        <p style="color:#a8b2c1;margin-bottom:1rem;">Apply what you learned — use our free interactive tool to optimize your YouTube content right now.</p>
        <a href="${toolUrl}" style="display:inline-block;background:var(--cyan, #00f2ff);color:#000;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:700;">Launch the Tool →</a>
      </div>`;
  }

  // 4. Mid-article CTA (if no cta-box found in content)
  if (!hasCTA) {
    contentHTML += `\n      <div class="cta-box">
        <h3>🔍 Want a Full Channel Audit?</h3>
        <p>17 AI tools analyze your titles, tags, descriptions, and thumbnails. 100 free credits/month. No credit card required.</p>
        <a href="/dashboard">Audit My Channel — It's Free →</a>
      </div>`;
  }

  // 5. FAQ section
  if (!hasFAQ) {
    contentHTML += generateFAQBlock(page);
  }

  // 6. Key Takeaways
  if (!hasKeyTakeaways) {
    contentHTML += generateKeyTakeaways(h2s, page);
  }

  // Build dual JSON-LD schema
  const faqSchemaItems = faqItems.length >= 3 ? faqItems.map(f => ({
    question: f.question,
    answer: f.answer || f.question
  })).slice(0, 5) : [
    { question: 'How long does it take to see results?', answer: 'Most creators see measurable improvements within 2-4 weeks.' },
    { question: 'Can I do this without paid tools?', answer: 'Yes, YouTube analytics and free tools provide everything needed.' },
    { question: 'What\'s the single highest-impact change?', answer: 'Title optimization directly increases CTR and signals YouTube to promote your video.' },
    { question: 'How often should I update my SEO?', answer: 'Review top videos monthly, re-research keywords quarterly.' },
    { question: 'Does this work for small channels?', answer: 'Yes, small channels that optimize well routinely outrank larger channels on specific keywords.' }
  ];
  const schemaJSON = generateDualSchema(page, faqSchemaItems);

  // Assemble the full page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/favicon.ico" />

  <title>${metaTitle} — YT SEO Architect</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="author" content="Patrick" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/blog/${slug}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://yt-seo-architect.vercel.app/blog/${slug}" />
  <meta property="og:title" content="${metaTitle}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:image" content="https://yt-seo-architect.vercel.app/blog/${slug}-og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:site_name" content="YT SEO Architect" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${metaTitle}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <meta name="twitter:image" content="https://yt-seo-architect.vercel.app/blog/${slug}-og.png" />

  <!-- Article: published/modified times -->
  <meta property="article:published_time" content="${formatDate(publishDate)}" />
  <meta property="article:modified_time" content="${formatDate(updateDate)}" />

  <!-- Geist font (non-render-blocking) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <script type="application/ld+json">${schemaJSON}</script>
  <link rel="stylesheet" href="/design-tokens.css">
  <link rel="stylesheet" href="/utilities.css">
  <link rel="stylesheet" href="/nav.css">
  <link rel="stylesheet" href="/blog-article.css">
  <link rel="stylesheet" href="/blog/blog.css">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>
  <style>
    /* ── Inline share-bar styles ── */
    /* ── Social Share Bar ──────────────────────────────────── */ .share-bar{display: flex;align-items: center;gap: 0.5rem;margin: 1.5rem 0;flex-wrap: wrap}.share-bar .share-label{font-size: 0.75rem;font-weight: 700;color: var(--text-muted);text-transform: uppercase;letter-spacing: 0.08em;margin-right: 0.25rem}.share-btn{display: inline-flex;align-items: center;gap: 0.35rem;padding: 0.4rem 0.85rem;border-radius: var(--radius-md);font-size: 0.78rem;font-weight: 600;text-decoration: none;transition: all 0.25s var(--ease-precise);border: 1px solid transparent;cursor: pointer;font-family: var(--font)}.share-btn:hover{transform: translateY(-2px);text-decoration: none}.share-btn:active{transform: translateY(0)}.share-btn svg{width: 14px;height: 14px;flex-shrink: 0}.share-btn.reddit{background: rgba(255, 69, 0, 0.08);color: #ff4500;border-color: rgba(255, 69, 0, 0.15)}.share-btn.reddit:hover{background: rgba(255, 69, 0, 0.15);border-color: rgba(255, 69, 0, 0.3);box-shadow: 0 4px 12px rgba(255, 69, 0, 0.2)}.share-btn.x-twitter{background: rgba(29, 155, 240, 0.08);color: #1d9bf0;border-color: rgba(29, 155, 240, 0.15)}.share-btn.x-twitter:hover{background: rgba(29, 155, 240, 0.15);border-color: rgba(29, 155, 240, 0.3);box-shadow: 0 4px 12px rgba(29, 155, 240, 0.2)}.share-btn.linkedin{background: rgba(10, 102, 194, 0.08);color: #0a66c2;border-color: rgba(10, 102, 194, 0.15)}.share-btn.linkedin:hover{background: rgba(10, 102, 194, 0.15);border-color: rgba(10, 102, 194, 0.3);box-shadow: 0 4px 12px rgba(10, 102, 194, 0.2)}.share-btn.facebook{background: rgba(24, 119, 242, 0.08);color: #1877f2;border-color: rgba(24, 119, 242, 0.15)}.share-btn.facebook:hover{background: rgba(24, 119, 242, 0.15);border-color: rgba(24, 119, 242, 0.3);box-shadow: 0 4px 12px rgba(24, 119, 242, 0.2)}.share-btn.whatsapp{background: rgba(37, 211, 102, 0.08);color: #25d366;border-color: rgba(37, 211, 102, 0.15)}.share-btn.whatsapp:hover{background: rgba(37, 211, 102, 0.15);border-color: rgba(37, 211, 102, 0.3);box-shadow: 0 4px 12px rgba(37, 211, 102, 0.2)}.share-btn.telegram{background: rgba(0, 136, 204, 0.08);color: #0088cc;border-color: rgba(0, 136, 204, 0.15)}.share-btn.telegram:hover{background: rgba(0, 136, 204, 0.15);border-color: rgba(0, 136, 204, 0.3);box-shadow: 0 4px 12px rgba(0, 136, 204, 0.2)}.share-btn.copy-link{background: rgba(255, 255, 255, 0.05);color: var(--text-secondary);border-color: var(--border)}.share-btn.copy-link:hover{background: rgba(255, 255, 255, 0.1);color: var(--text);border-color: var(--border-hover)}.share-btn.copy-link.copied{background: rgba(0, 255, 136, 0.1);color: var(--green);border-color: rgba(0, 255, 136, 0.25)}.share-bar-bottom{margin-top: 2.5rem;padding-top: 1.5rem;border-top: 1px solid var(--border)}/* ── Glossary Links ─────────────────────────────────────── */ .glossary-link{color: var(--cyan);text-decoration: none;border-bottom: 1px dotted rgba(0, 242, 255, 0.35);transition: all 0.2s var(--ease-precise);cursor: help}.glossary-link:hover{color: var(--green);border-bottom-color: var(--green)}/* ── Template Box (code templates) ──────────────────────── */ .template-box{background: var(--surface);border: 1px solid var(--border);border-radius: var(--radius-lg);padding: 1.5rem;margin: 1rem 0;white-space: pre-wrap;font-family: var(--font-mono);font-size: 0.85rem;color: var(--text-secondary);line-height: 1.6;transition: all 0.3s var(--ease-precise)}.template-box:hover{border-color: var(--border-hover)}/* ── Infographic Container ──────────────────────────────── */ .infographic-container{text-align: center;margin: 2rem 0}/* ── Optional Badge ─────────────────────────────────────── */ .optional-badge{display: inline-block;background: rgba(0, 242, 255, 0.08);color: var(--cyan);border: 1px solid rgba(0, 242, 255, 0.15);border-radius: 999px;padding: 0.1rem 0.5rem;font-size: 0.7rem;font-weight: 600;letter-spacing: 0.03em;text-transform: lowercase;margin-left: 0.5rem;vertical-align: middle}/* ── AdSense Ad Unit ──────────────────────────────────── */ .adsense-blog-top{margin: 2rem 0;text-align: center}/* ── Footer ─────────────────────────────────────────────── */ .footer{text-align: center;padding: 2rem;border-top: 1px solid var(--border);color: var(--text-muted);font-size: 0.82rem;background: rgba(10, 11, 16, 0.5);backdrop-filter: blur(12px);-webkit-backdrop-filter: blur(12px)}.footer a{color: var(--cyan);text-decoration: none;font-weight: 500}.footer a:hover{text-decoration: underline}/* ── Responsive ─────────────────────────────────────────── */ @media (max-width: 768px){h1{font-size: 1.7rem}h2{font-size: 1.3rem;margin-top: 2rem}h3{font-size: 1.05rem}article{padding: 1.5rem 1rem}.header{padding: 0.75rem 1rem}.author-box{flex-direction: column;text-align: center;padding: 1.25rem}.toc{position: static;max-height: none}.step-guide .step{padding-left: 3.5rem}.step-guide .step::before{left: 0.75rem;width: 2rem;height: 2rem;font-size: 0.85rem}.related-posts-grid{grid-template-columns: 1fr}.related-posts{padding: 0 1rem}.share-btn span:not(.share-label){display: none}}@media (max-width: 480px){h1{font-size: 1.4rem}article{padding: 1rem 0.75rem}.cta-box{padding: 1.5rem}.tldr, .key-takeaways, .trending-now{padding: 1rem 1.25rem}.share-bar{gap: 0.35rem}.share-btn{padding: 0.35rem 0.65rem;font-size: 0.72rem}}/* ── Reduced Motion ─────────────────────────────────────── */ @media (prefers-reduced-motion: reduce){*, *::before, *::after{animation-duration: 0.01ms !important;animation-iteration-count: 1 !important;transition-duration: 0.01ms !important}}/* ── Print Styles ───────────────────────────────────────── */ @media print{.header, .footer, .share-bar, .cta-box, .reading-progress, .related-posts, .social-proof, .trending-now{display: none}body{background: #fff;color: #000}a{color: #000;text-decoration: underline}article{max-width: 100%;padding: 0}}
  </style>
  <link rel="stylesheet" href="/motion-utilities.css">
</head>
<body>
  <!-- Skip to content -->
  <a href="#main-content" class="skip-link">Skip to content</a>

  <!-- Reading Progress Bar -->
  <div class="reading-progress" id="reading-progress"></div>

  <!-- Shared Header -->
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="header-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/><circle cx="12" cy="12" r="10"/></svg>
        YT <span>SEO</span> Architect
      </a>
      <nav class="header-nav" id="header-nav">
        <a href="/tools">Tools</a>
        <a href="/blog">Blog</a>
        <a href="/glossary/">Glossary</a>
       <a href="/dashboard" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">☰</button>
    </div>
  </header>

  <main>
    <article class="article-body">

      <!-- Breadcrumb -->
      ${hasBreadcrumbs ? '' : `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> › <a href="/blog">Blog</a> › <strong>${title.substring(0, 60)}</strong>
      </nav>
      `}

      <h1>${page.h1 || title}</h1>

      <!-- Meta line + last-updated badge -->
      <p class="meta">
        Published ${formattedDate} · ${readMinutes} min read · By <a href="https://yt-seo-architect.vercel.app/about" style="color:var(--cyan);text-decoration:none;font-weight:600;">Patrick</a>
        <span class="last-updated">✓ Updated ${formattedUpdateDate}</span>
      </p>

      <!-- Social Share Buttons (Top) -->
      ${generateShareBar(slug, title, false)}

      <!-- E-E-A-T: Author credentials (improved) -->
      ${hasAuthorBox ? '' : `
      <div class="author-box">
        <div class="avatar">P</div>
        <div class="author-info">
          <h4>Patrick</h4>
          <p>Founder of YT SEO Architect. I research and test every strategy in this guide on real YouTube channels — no theory, no fabricated stats. Free tools for every creator.</p>
        </div>
      </div>
      `}

      <!-- Hero / Featured Image (auto-detected from content or injected) -->
      ${hasHero ? '' : heroImageHTML(slug, title)}

      <!-- Article body with auto-generated structural sections -->
      ${contentHTML}

      <!-- Social proof counter -->
      <div class="social-proof">
        <div class="stat"><strong>90+</strong><span>Free AI Tools</span></div>
        <div class="stat"><strong>5,000+</strong><span>Active Creators</span></div>
        <div class="stat"><strong>100</strong><span>Free Credits/Month</span></div>
        <div class="stat"><strong>No CC</strong><span>Required</span></div>
      </div>

      <!-- Affiliate Disclosure + Gear Recommendations -->
      ${generateAffiliateDisclosure()}
      ${generateGearSection(title)}

      <!-- Bottom CTA (improved) -->
      <div class="cta-box">
        <h3>🚀 Ready to Grow Your Channel?</h3>
        <p>Join 5,000+ creators using YT SEO Architect to optimize titles, tags, descriptions, and more. 100% free — no credit card needed.</p>
        <div class="btn-group">
          <a href="/dashboard" class="btn-primary">Get Started Free →</a>
          <a href="/tools/" class="btn-secondary">Browse All Tools</a>
        </div>
      </div>

      <!-- Social Share Buttons (Bottom) -->
      ${generateShareBar(slug, title, true)}

      <!-- Related posts -->
      ${generateRelatedPosts(page)}

      <!-- AdSense: Bottom (after related posts — keeps share bar → related
           cards contiguous so unfilled ad units don't leave a void) -->
      <div class="adsense-blog-bottom" style="margin:1.5rem 0 0.5rem; text-align:center;">
        <ins class="adsbygoogle"
             style="display:block;width:100%;height:250px"
             data-ad-client="ca-pub-3831668789026424"
             data-ad-slot="6837670420"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>
             (adsbygoogle = window.adsbygoogle || []).push({});
        <\/script>
      </div>

      <!-- Collapse unfilled ad units so they never leave layout gaps -->
      <script>
        (function () {
          setTimeout(function () {
            document.querySelectorAll('.adsense-blog-top, .adsense-blog-bottom').forEach(function (w) {
              var ins = w.querySelector('ins.adsbygoogle');
              if (ins && !ins.querySelector('iframe') && ins.getAttribute('data-ad-status') !== 'filled') {
                w.style.display = 'none';
              }
            });
          }, 3500);
        })();
      <\/script>

    </article>
  </main>

  <!-- Sticky bottom CTA (styled via blog.css) -->
  <div id="sticky-cta" class="sticky-cta" style="position:fixed;bottom:0;left:0;right:0;background:rgba(10,11,16,0.95);border-top:1px solid rgba(0,242,255,0.2);padding:0.75rem 1.5rem;display:none;align-items:center;justify-content:space-between;gap:1rem;z-index:9998;backdrop-filter:blur(12px);">
    <p style="margin:0;font-size:0.9rem;color:#f0f2f5;"><strong style="color:#00f2ff;">100% free.</strong> Optimize your YouTube videos with AI — titles, tags, descriptions, and more.</p>
    <a href="/dashboard" style="background:#00f2ff;color:#000;padding:0.5rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.85rem;white-space:nowrap;flex-shrink:0;box-shadow:0 0 12px rgba(0,242,255,0.25);">Try Free Tools →</a>
  </div>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <h4>Product</h4>
       <a href="/dashboard">Dashboard</a>
        <a href="/changelog">Changelog</a>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <a href="/blog">Blog</a>
        <a href="/glossary/">Glossary</a>
        <a href="/tools/">Guides</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="/terms-of-service">Terms</a>
      </div>
      <div class="footer-col">
        <h4>Social</h4>
        <a href="https://twitter.com/YTSEOArchitect" target="_blank" rel="noopener">Twitter / X</a>
        <a href="https://youtube.com" target="_blank" rel="noopener">YouTube</a>
        <a href="https://github.com/nhlaka3" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2026 YT SEO Architect. All rights reserved.</span>
      <div class="footer-social">
        <a href="https://twitter.com/YTSEOArchitect" target="_blank" rel="noopener" aria-label="Twitter">𝕏</a>
        <a href="https://github.com/nhlaka3" target="_blank" rel="noopener" aria-label="GitHub">GH</a>
      </div>
    </div>
  </footer>

  <script defer src="/js/blog-enhancements.js"></script>
</body>
</html>`;
}
