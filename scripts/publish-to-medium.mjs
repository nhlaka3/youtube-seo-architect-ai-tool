// scripts/publish-to-medium.mjs — Publish blog posts to Medium via cookie auth
// Usage: node scripts/publish-to-medium.mjs <post-slug>
// Example: node scripts/publish-to-medium.mjs youtube-end-screens-cards-guide-2026
//
// Prerequisites:
//   1. Log into Medium.com in Chrome
//   2. F12 → Application → Cookies → medium.com → copy "sid" value
//   3. F12 → Console → type: document.cookie.match(/sid=([^;]+)/)[1]
//   4. Set in .env: MEDIUM_SID=<paste>
//   5. Also get your Medium userId:
//      F12 → Application → Cookies → medium.com → look for "uid" cookie
//      Set in .env: MEDIUM_UID=<paste>

import { readFileSync } from 'fs';

const MEDIUM_SID = process.env.MEDIUM_SID;
const MEDIUM_UID = process.env.MEDIUM_UID;

if (!MEDIUM_SID || !MEDIUM_UID) {
  console.error('❌ Missing MEDIUM_SID or MEDIUM_UID in environment');
  console.error('   Get them from: F12 → Application → Cookies → medium.com');
  process.exit(1);
}

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/publish-to-medium.mjs <post-slug>');
  console.error('Example: node scripts/publish-to-medium.mjs youtube-end-screens-cards-guide-2026');
  process.exit(1);
}

const htmlPath = `public/blog/${slug}.html`;
let html;
try {
  html = readFileSync(htmlPath, 'utf-8');
} catch (e) {
  console.error(`❌ Post not found: ${htmlPath}`);
  process.exit(1);
}

// ── Extract post metadata ──────────────────────────────────────────

const titleMatch = html.match(/<title>(.*?)<\/title>/);
const title = titleMatch ? titleMatch[1].replace(' — YT SEO Architect', '').trim() : slug;

const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
const description = descMatch ? descMatch[1] : '';

const h1Match = html.match(/<h1>(.*?)<\/h1>/);
const h1 = h1Match ? h1Match[1] : title;

// Extract article body content (everything inside <article> tags)
const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/);
const articleContent = articleMatch ? articleMatch[1].trim() : '';

// Extract keywords / tags from meta
const tagsMatch = html.match(/📅.*?🏷️\s*(.+?)</);
let tags = [];
if (tagsMatch) {
  tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
}
// Always add these base tags
if (!tags.includes('YouTube')) tags.unshift('YouTube');
if (!tags.includes('SEO')) tags.push('SEO');

// ── Build Medium post body ─────────────────────────────────────────
// Medium's HTML content — strip the page chrome, keep article body.
// Wrap in Medium-friendly format with a lead paragraph.

const leadParagraph = `<p><em>Originally published at <a href="https://yt-seo-architect.vercel.app/blog/${slug}" rel="canonical">YT SEO Architect</a>.</em></p>`;

// Medium has limited HTML support. Convert blog-specific classes to inline styles.
let content = articleContent
  // Remove elements Medium doesn't support
  .replace(/<nav[^>]*>[\s\S]*?<\/nav>/g, '')   // Remove nav (breadcrumb, TOC)
  .replace(/<div class="author-box"[\s\S]*?<\/div>/g, '')  // Remove author box
  .replace(/class="[^"]*"/g, '')                // Strip classes (Medium uses its own)
  .replace(/<div class="related-posts"[\s\S]*?<\/nav>/g, '') // Remove related posts
  .replace(/<div class="cta-box"[\s\S]*?<\/div>/g, (match) => {
    // Keep first CTA, remove duplicate bottom CTAs
    return match.includes('Get Started Free') ? '' : match;
  })
  .replace(/style="[^"]*"/g, '');               // Strip inline styles

// ── Publish to Medium ──────────────────────────────────────────────

const MEDIUM_API = 'https://medium.com/_/api/posts';

const payload = {
  title: title,
  contentFormat: 'html',
  content: leadParagraph + '\n\n' + content,
  tags: tags.slice(0, 5), // Medium allows max 5 tags
  canonicalUrl: `https://yt-seo-architect.vercel.app/blog/${slug}`,
  publishStatus: 'draft', // 'draft' or 'public'
  license: 'all-rights-reserved',
};

console.log(`📤 Publishing to Medium...`);
console.log(`   Title: ${title}`);
console.log(`   Tags: ${tags.join(', ')}`);
console.log(`   Canonical: ${payload.canonicalUrl}`);
console.log(`   Status: draft (review on Medium before publishing)`);

try {
  const response = await fetch(MEDIUM_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sid=${MEDIUM_SID}; uid=${MEDIUM_UID}`,
      'Accept': 'application/json',
      'Origin': 'https://medium.com',
      'Referer': 'https://medium.com/new-story',
      'X-XSRF-Token': MEDIUM_SID.split(':')[0] || MEDIUM_SID,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    // Medium returned HTML — likely auth failure or CSRF challenge
    const preview = text.substring(0, 300);
    console.error(`\n❌ Medium returned HTML (HTTP ${response.status}), not JSON:`);
    console.error(`   ${preview}...`);
    
    if (text.includes('login') || text.includes('sign in')) {
      console.error(`\n💡 Session expired. Refresh your sid cookie from medium.com`);
    } else if (text.includes('csrf') || text.includes('xsrf') || text.includes('403')) {
      console.error(`\n💡 CSRF token needed. Get your xsrf cookie:`);
      console.error(`   F12 → Application → Cookies → medium.com → copy "xsrf" value`);
      console.error(`   Then: export MEDIUM_XSRF="<paste>"`);
    } else {
      console.error(`\n💡 Try publishing manually at https://medium.com/new-story`);
      console.error(`   and import the URL: https://yt-seo-architect.vercel.app/blog/${slug}`);
    }
    process.exit(1);
  }

  if (response.ok && result.id) {
    console.log(`\n✅ Published to Medium!`);
    console.log(`   Post ID: ${result.id}`);
    console.log(`   URL: https://medium.com/@pathlatshwayo/${result.id}`);
    console.log(`   Status: ${result.publishStatus || 'draft'}`);
    console.log(`\n📝 Review at: https://medium.com/me/stories/drafts`);
  } else {
    console.error(`\n❌ Medium API returned: ${response.status}`);
    console.error(JSON.stringify(result, null, 2));
    console.error(`\n💡 Troubleshooting:`);
    console.error(`   1. Your sid cookie may have expired — refresh from browser`);
    console.error(`   2. Your uid cookie may be wrong — check Application → Cookies`);
    console.error(`   3. Medium may have changed their API — try publishing manually`);
  }
} catch (e) {
  console.error(`\n❌ Network error: ${e.message}`);
  console.error(`\n💡 Try again — sometimes Medium blocks automated requests.`);
}
