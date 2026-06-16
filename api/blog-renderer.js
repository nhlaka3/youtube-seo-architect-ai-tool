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
  return `<nav class="related-posts" aria-label="Related articles" style="margin-top:3rem;padding-top:2rem;border-top:1px solid var(--border);">
    <h3 style="margin-bottom:1rem;color:var(--text);">📖 Related Articles</h3>
    <a href="/blog/best-youtube-seo-tools-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">Best YouTube SEO Tools in 2026: Compared by Use Case</a>
    <a href="/blog/youtube-competitor-analysis-reverse-engineer" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Competitor Analysis: Reverse-Engineer Top Channels</a>
    <a href="/blog/youtube-analytics-explained-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Analytics Explained 2026: Read Your Data Like a Pro</a>
    <a href="/blog/youtube-seo-audit-diagnostic-fix-2026" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube SEO Audit: The 5-Minute Diagnostic That Finds What's Killing Your Views</a>
    <a href="/blog/youtube-thumbnail-ab-testing-guide" style="display:block;color:var(--accent);text-decoration:none;padding:0.4rem 0;font-size:0.95rem;">YouTube Thumbnail A/B Testing: Double Your CTR in 30 Days</a>
  </nav>`;
}

// ── Social Share Buttons ──────────────────────────────────────────────

function generateShareBar(slug, title, isBottom) {
  const url = `https://yt-seo-architect.vercel.app/blog/${slug}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const bottomClass = isBottom ? ' share-bar-bottom' : '';
  return `<div class="share-bar${bottomClass}">
      <span class="share-label">Share</span>
      <a href="https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn reddit" aria-label="Share on Reddit">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
        Reddit
      </a>
      <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn x-twitter" aria-label="Share on X">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        X
      </a>
      <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener noreferrer" class="share-btn linkedin" aria-label="Share on LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        LinkedIn
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-btn facebook" aria-label="Share on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
      <button onclick="navigator.clipboard.writeText(window.location.href).then(()=>{const b=this;b.classList.add('copied');b.querySelector('span').textContent='Copied!';setTimeout(()=>{b.classList.remove('copied');b.querySelector('span').textContent='Copy Link'},2000)})" class="share-btn copy-link" aria-label="Copy link to clipboard">
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
      name: 'Patrick'
    },
    publisher: {
      '@type': 'Organization',
      name: 'YT SEO Architect',
      logo: {
        '@type': 'ImageObject',
        url: 'https://yt-seo-architect.vercel.app/og-image.png'
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://yt-seo-architect.vercel.app/blog/${slug}`
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
    }))
  } : null;

  return JSON.stringify(faqSchema ? [articleSchema, faqSchema] : [articleSchema]);
}

// ── Helpers ────────────────────────────────────────────────────────────

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }
function formatDate(d) { return new Date(d).toISOString().split('T')[0]; }

function heroImageHTML(slug, title) {
  const seed = slug.replace(/[^a-z0-9-]/g, '').substring(0, 30);
  const alt = (title || slug).replace(/—.*/, '').trim();
  return `<div class="featured-image-wrapper" style="margin:24px 0;text-align:center;">
      <img
        src="https://picsum.photos/seed/${seed}/800/400"
        alt="${escAttr(alt)} guide — YT SEO Architect"
        width="800"
        height="400"
        loading="eager"
        fetchpriority="high"
        style="width:100%;height:auto;max-width:800px;border-radius:12px;border:1px solid #2D215E;"
      />
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
  const metaDesc = (page.metaDescription || '').replace(/"/g, '&quot;');
  const rawContent = page.content || '';
  const wordCount = page.wordCount || 0;
  const readMinutes = Math.max(1, Math.ceil((wordCount || 1200) / 200));

  // Detect existing structural sections in content
  const hasTLDR = hasSection(rawContent, 'tldr');
  const hasTOC = hasSection(rawContent, 'toc');
  const hasFAQ = hasSection(rawContent, 'faq');
  const hasKeyTakeaways = hasSection(rawContent, 'key-takeaways') || hasSection(rawContent, 'key-takeaways');
  const hasHero = hasHeroImage(rawContent);
  const hasCTA = hasSection(rawContent, 'cta-box');
  const hasAuthorBox = hasSection(rawContent, 'author-box') || hasSection(rawContent, 'author-info');
  const hasBreadcrumbs = hasSection(rawContent, 'breadcrumb') || /"BreadcrumbList"/i.test(rawContent);

  // Extract structural data from content
  const h2s = extractH2s(rawContent);
  const faqItems = extractFAQItems(rawContent);

  // Build content sections (insert structural wrappers where missing)
  let contentHTML = '';

  // 1. TL;DR block
  if (!hasTLDR) {
    contentHTML += generateTLDRBlock(page);
  }

  // AdSense: Post-TL;DR
  contentHTML += `<div class="adsense-blog-top" style="margin:2rem 0; text-align:center;">
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

  // 2. TOC nav
  if (!hasTOC && h2s.length >= 3) {
    const contentH2s = h2s.filter(h => !/faq|key takeaways|conclusion/i.test(h.text));
    contentHTML += generateTOCNav(contentH2s);
  }

  // 3. Body content (the AI-generated or template-generated HTML)
  contentHTML += rawContent;

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

  <title>${title} — YT SEO Architect</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/blog/${slug}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://yt-seo-architect.vercel.app/blog/${slug}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:image" content="https://yt-seo-architect.vercel.app/blog/${slug}-og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:site_name" content="YT SEO Architect" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <meta name="twitter:image" content="https://yt-seo-architect.vercel.app/blog/${slug}-og.png" />

  <!-- Article: published/modified times -->
  <meta property="article:published_time" content="${formatDate(publishDate)}" />
  <meta property="article:modified_time" content="${formatDate(updateDate)}" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <script type="application/ld+json">${schemaJSON}</script>
  <link rel="stylesheet" href="/blog/blog.css" />
</head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/dashboard" class="cta">Try Free</a>
  </header>

  <main>
    <article>

      <!-- Breadcrumb -->
      ${hasBreadcrumbs ? '' : `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> › <a href="/blog">Blog</a> › <strong>${title.substring(0, 60)}</strong>
      </nav>
      `}

      <h1>${page.h1 || title}</h1>

      <!-- Meta line + last-updated badge -->
      <p class="meta">
        Published ${formattedDate} · ${readMinutes} min read · By YT SEO Architect
        <span class="last-updated">✓ Updated ${formattedUpdateDate}</span>
      </p>

      <!-- Social Share Buttons (Top) -->
      ${generateShareBar(slug, title, false)}

      <!-- E-E-A-T: Author credentials -->
      ${hasAuthorBox ? '' : `
      <div class="author-box">
        <div class="avatar">YT</div>
        <div class="author-info">
          <h4>YT SEO Architect Team</h4>
          <p>AI-powered YouTube SEO platform. 17 tools used by content creators to rank higher. Built by creators, for creators.</p>
        </div>
      </div>
      `}

      <!-- Hero / Featured Image (auto-detected from content or injected) -->
      ${hasHero ? '' : heroImageHTML(slug, title)}

      <!-- Article body with auto-generated structural sections -->
      ${contentHTML}

      <!-- Bottom CTA -->
      <div class="cta-box">
        <h3>🚀 Ready to Grow Your Channel?</h3>
        <p>17 AI tools, 100 free credits/month, no credit card required.</p>
        <a href="/dashboard">Get Started Free →</a>
      </div>

      <!-- Social Share Buttons (Bottom) -->
      ${generateShareBar(slug, title, true)}

      <!-- AdSense: Bottom -->
      <div class="adsense-blog-bottom" style="margin:2rem 0; text-align:center;">
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

      <!-- Related posts -->
      ${generateRelatedPosts(page)}

    </article>
  </main>

  <footer class="footer">
    <p>© 2026 YT SEO Architect · <a href="/blog">All Articles</a> · <a href="/privacy-policy">Privacy</a></p>
  </footer>
</body>
</html>`;
}
