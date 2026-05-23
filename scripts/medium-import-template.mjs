// scripts/medium-import-template.mjs — Generate a Medium-ready copy-paste template
// Usage: node scripts/medium-import-template.mjs <post-slug>
// Outputs a markdown file ready for Medium's editor + canonical URL pre-configured

import { readFileSync, writeFileSync } from 'fs';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/medium-import-template.mjs <post-slug>');
  process.exit(1);
}

const htmlPath = `public/blog/${slug}.html`;
let html;
try { html = readFileSync(htmlPath, 'utf-8'); }
catch (e) { console.error(`Post not found: ${htmlPath}`); process.exit(1); }

// Extract
const titleMatch = html.match(/<title>(.*?)<\/title>/);
const title = titleMatch ? titleMatch[1].replace(' — YT SEO Architect', '').trim() : slug;
const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/);
const body = articleMatch ? articleMatch[1] : '';
const tagsMatch = body.match(/📅.*?🏷️\s*(.+?)</);
let tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : ['YouTube', 'SEO'];

// Strip blog-specific elements for Medium
const content = body
  .replace(/<nav[^>]*>[\s\S]*?<\/nav>/g, '')
  .replace(/<div class="author-box"[\s\S]*?<\/div>/g, '')
  .replace(/class="[^"]*"/g, '')
  .replace(/<div class="related-posts"[\s\S]*?<\/nav>/g, '')
  .replace(/style="[^"]*"/g, '');

// Build Medium template
const leadIn = `<p><em>Originally published at <a href="https://yt-seo-architect.vercel.app/blog/${slug}" rel="canonical">YT SEO Architect</a> — free YouTube SEO tools and guides.</em></p>\n\n`;

const template = `---
# Copy-paste into Medium: https://medium.com/new-story
# Step 1: Paste content into Medium editor (Ctrl+V)
# Step 2: Click "..." → "More settings" → "Advanced" → paste canonical URL below
# Step 3: Add tags: ${tags.slice(0,5).join(', ')}
# Step 4: Click "Publish"
---

CANONICAL URL (paste in Medium → More Settings → Advanced → Custom canonical link):
https://yt-seo-architect.vercel.app/blog/${slug}

TITLE:
${title}

TAGS (5 max):
${tags.slice(0,5).join(', ')}

CONTENT (copy everything below this line):
─────────────────────────────────────────────────────────────────

${leadIn}${content}
`;

const outPath = `scripts/medium-${slug}.txt`;
writeFileSync(outPath, template);
console.log(`✅ Template saved to: ${outPath}`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Open https://medium.com/new-story`);
console.log(`   2. Paste the CONTENT section above into the editor`);
console.log(`   3. Set title to: ${title}`);
console.log(`   4. Add tags: ${tags.slice(0,5).join(', ')}`);
console.log(`   5. Click "..." → "More settings"`);
console.log(`   6. Under "Advanced" → paste canonical URL → Save`);
console.log(`   7. Publish`);
console.log(`\n🔗 Canonical URL set to: https://yt-seo-architect.vercel.app/blog/${slug}`);
console.log(`   Google credits YOUR domain, not Medium. No duplicate content penalty.`);
