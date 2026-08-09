#!/usr/bin/env node
/**
 * scripts/batch-design-fix.mjs
 *
 * Batch-fixes design inconsistencies across all generated pages:
 * 1. Glossary comparison pages (public/glossary/*-vs-*.html)
 * 2. VS comparison pages (public/vs/*.html)
 * 3. Individual tool pages (public/tools/*.html)
 *
 * Replaces old custom headers/footers/inline styles with the shared
 * design system (design-tokens.css, utilities.css, nav.css, blog-article.css)
 * plus skip-link, proper footer, and Geist font.
 *
 * Usage:
 *   node scripts/batch-design-fix.mjs [--dry-run] [--type=glossary|vs|tools|all]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');

const DRY_RUN = process.argv.includes('--dry-run');
const TYPE_ARG = process.argv.find(a => a.startsWith('--type='));
const FILTER_TYPE = TYPE_ARG ? TYPE_ARG.split('=')[1] : 'all';

// ─── Shared components ─────────────────────────────────────────────

const CSS_IMPORTS = `  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>`;

const SKIP_LINK = `  <!-- Skip to content -->
  <a href="#main-content" class="skip-link">Skip to content</a>`;

const SITE_HEADER = `  <!-- Reading Progress Bar -->
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
        <a href="/public/glossary">Glossary</a>
        <a href="/public/tools">Free Tools</a>
        <a href="/dashboard" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">☰</button>
    </div>
  </header>`;

const BREADCRUMBS_GLOSSARY = `  <!-- Breadcrumbs -->
  <div class="breadcrumbs">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href="/public/glossary">Glossary</a>
    <span class="sep">/</span>
    <span class="current">Comparison</span>
  </div>`;

const BREADCRUMBS_VS = `  <!-- Breadcrumbs -->
  <div class="breadcrumbs">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href="/vs">Comparisons</a>
    <span class="sep">/</span>
    <span class="current">Comparison</span>
  </div>`;

const BREADCRUMBS_TOOLS = `  <!-- Breadcrumbs -->
  <div class="breadcrumbs">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href="/tools">Tools</a>
    <span class="sep">/</span>
    <span class="current">Tool</span>
  </div>`;

const SITE_FOOTER = `  <!-- Footer -->
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <h4>Product</h4>
        <a href="/public/tools">Free Tools</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/changelog">Changelog</a>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <a href="/blog">Blog</a>
        <a href="/public/glossary">Glossary</a>
        <a href="/public/guides">Guides</a>
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

  <script defer src="/js/blog-enhancements.js"></script>`;

// ─── Fix patterns ─────────────────────────────────────────────────

/**
 * Fix glossary comparison pages (public/glossary/*-vs-*.html)
 * These have: purple inline styles, old header, old footer, blog.css link
 */
function fixGlossaryComparisonPage(content) {
  let changed = false;

  // 1. Replace old blog.css with new CSS imports
  const oldCssPattern = /<link rel="stylesheet" href="\/blog\/blog\.css"[^>]*\/>\s*<noscript><link rel="stylesheet" href="\/blog\/blog\.css" \/><\/noscript>/;
  if (oldCssPattern.test(content)) {
    content = content.replace(oldCssPattern, CSS_IMPORTS);
    changed = true;
  }

  // 2. Remove old inline <style> block (purple theme)
  // Keep the body font-family and reduces-motion, replace the rest
  const oldStyleBlock = content.match(/<style>[\s\S]*?<\/style>/);
  if (oldStyleBlock) {
    const styleContent = oldStyleBlock[0];
    // Only remove if it contains purple theme colors
    if (styleContent.includes('#0f0c29') || styleContent.includes('#302b63') || styleContent.includes('#1e1b4b')) {
      // Keep only essential resets and responsive styles, remove purple-specific
      const newStyleContent = `<style>
    body{font-family:'Geist','Outfit',-apple-system,BlinkMacSystemFont,sans-serif}
    .cat-badge{display:inline-block;background:rgba(0,242,255,0.08);color:#00f2ff;border:1px solid rgba(0,242,255,0.15);padding:.25rem .75rem;border-radius:9999px;font-size:.8rem;font-weight:600}
    section{margin-bottom:2.5rem}
    .comparison-table{width:100%;border-collapse:collapse;font-size:.9rem}
    .comparison-table th{background:rgba(16,20,32,0.7);color:#00f2ff;padding:.75rem;text-align:left;border-bottom:1px solid rgba(255,255,255,0.06)}
    .comparison-table td{padding:.75rem;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;color:var(--text-secondary)}
    .comparison-table tr:hover td{background:rgba(255,255,255,0.02)}
    .comparison-table .insight{color:var(--text-muted);font-size:.85rem;font-style:italic;width:30%}
    .when-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
    @media(max-width:640px){.when-grid{grid-template-columns:1fr}}
    .when-col{background:var(--bg-surface);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem;backdrop-filter:blur(12px)}
    .when-col h3{color:var(--text-primary);margin:0 0 .75rem;font-size:1rem}
    .when-col ul{margin:0;padding-left:1.25rem}
    .when-col li{color:var(--text-secondary);margin-bottom:.5rem;font-size:.9rem}
    .related-row{display:flex;flex-wrap:wrap;gap:.75rem}
    .related-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:.5rem;padding:.75rem 1rem;text-decoration:none;color:var(--text-secondary);font-size:.85rem;transition:all .2s;backdrop-filter:blur(12px)}
    .related-card:hover{background:var(--bg-hover);border-color:var(--border-hover);color:var(--text-primary);transform:translateY(-1px)}
    .back-link{display:inline-block;margin-bottom:1.5rem;color:var(--text-muted);text-decoration:none;font-size:.9rem}
    .back-link:hover{color:var(--cyan)}
    @media(max-width:640px){.hero{padding:2rem 1rem}.hero h1{font-size:1.3rem}}
  </style>`;
      content = content.replace(oldStyleBlock[0], newStyleContent);
      changed = true;
    }
  }

  // 3. Replace old header with site-header + skip-link
  const oldHeaderPattern = /<header class="header">\s*<a href="\/">⚡ YT SEO Architect<\/a>\s*<a href="\/glossary\/"[^>]*>📖 Glossary<\/a>\s*<a href="\/tools\/" class="cta">Free Tools<\/a>\s*<\/header>/;
  if (oldHeaderPattern.test(content)) {
    const newHeader = `${SKIP_LINK}\n${SITE_HEADER}\n${BREADCRUMBS_GLOSSARY}`;
    content = content.replace(oldHeaderPattern, newHeader);
    changed = true;
  }

  // 4. Replace hero gradient with cyan theme
  const oldHeroPattern = /background:linear-gradient\(135deg,#0f0c29,#302b63,#24243e\)/g;
  if (oldHeroPattern.test(content)) {
    content = content.replace(oldHeroPattern, 'background:radial-gradient(ellipse at center, rgba(0,242,255,0.06), transparent 70%)');
    changed = true;
  }

  // 5. Fix cat-badge colors (purple → cyan)
  const oldBadgePattern = /background:rgba\(99,102,241,\.3\);color:#a5b4fc/g;
  if (oldBadgePattern.test(content)) {
    content = content.replace(oldBadgePattern, 'background:rgba(0,242,255,0.08);color:#00f2ff');
    changed = true;
  }

  // 6. Replace .hero h1 color
  content = content.replace(/\.hero h1\{font-size:1\.8rem;margin:0 0 \.5rem;color:#fff\}/g, '.hero h1{font-size:1.8rem;margin:0 0 .5rem;color:var(--text-primary)}');
  
  // 7. Fix hero .sub color
  content = content.replace(/color:#c4b5fd/g, 'color:var(--text-secondary)');

  // 8. Fix h2 color
  content = content.replace(/color:#e0e7ff/g, 'color:var(--text-primary)');

  // 9. Fix p color
  content = content.replace(/<p style="color:#94a3b8/g, '<p style="color:var(--text-secondary)');
  content = content.replace(/color:#94a3b8/g, 'color:var(--text-secondary)');

  // 10. Fix CTA box colors (purple → cyan)
  const oldCtaBox = /background:linear-gradient\(135deg,#1a1a2e,#16213e\);\s*border:1px solid #6366f1/;
  if (oldCtaBox.test(content)) {
    content = content.replace(oldCtaBox, 'background:var(--bg-surface);border:1px solid rgba(0,242,255,0.2)');
    changed = true;
  }
  const oldCtaH3 = /<h3 style="color:#e2e8f0/;
  content = content.replace(oldCtaH3, '<h3 style="color:var(--text-primary)');

  // 11. Fix CTA button (orange → cyan)
  const oldCtaBtn = /background:linear-gradient\(135deg,#f97316,#fb923c\)/g;
  content = content.replace(oldCtaBtn, 'background:var(--cyan)');
  changed = true;

  // 12. Replace old footer with new site footer
  const oldFooterPattern = /<footer class="footer">\s*<p>&copy; 2026 YT SEO Architect ·.*?<\/footer>/s;
  if (oldFooterPattern.test(content)) {
    content = content.replace(oldFooterPattern, SITE_FOOTER);
    changed = true;
  }

  // 13. Wrap <main> content in article-body for consistent styling
  if (!content.includes('article-body')) {
    content = content.replace('<main>', '<main id="main-content"><div class="article-body">');
    content = content.replace('</main>', '</div></main>');
    changed = true;
  }

  // 14. Ensure heading colors use cyan brand
  content = content.replace(/<span class="cat-badge" style="background:rgba\(249,115,22,\.2\);color:#fdba74">/g, '<span class="cat-badge" style="background:rgba(0,242,255,0.08);color:#00f2ff">');

  return { content, changed };
}

/**
 * Fix VS comparison pages (public/vs/*.html)
 */
function fixVSPage(content) {
  let changed = false;

  // 1. Add CSS imports before </head> (if not already there)
  if (!content.includes('design-tokens.css')) {
    content = content.replace('</head>', `${CSS_IMPORTS}\n</head>`);
    changed = true;
  }

  // 2. Remove old inline <style> and replace with minimal version
  const oldStyle = content.match(/<style>[\s\S]*?<\/style>/);
  if (oldStyle && !oldStyle[0].includes('design-tokens')) {
    // Keep it but replace background colors with var references
    // Actually for VS pages the style is very custom. Just add skip-link and fix header/footer.
  }

  // 3. Replace old nav with site-header
  const oldNav = /\s*<nav class="nav-bar">\s*<a href="\/" class="brand">[^<]*<span>[^<]*<\/span><\/a>\s*<a href="\/(?:vs|dashboard)"[^>]*class="cta">[^<]*<\/a>\s*<\/nav>/;
  if (oldNav.test(content)) {
    const newHeader = `${SKIP_LINK}\n${SITE_HEADER}\n${BREADCRUMBS_VS}`;
    content = content.replace(oldNav, newHeader);
    changed = true;
  }

  // 4. Replace old footer
  const oldFooter = /<footer>[\s\S]*?<\/footer>/;
  if (oldFooter.test(content)) {
    const match = content.match(oldFooter);
    if (match && !match[0].includes('site-footer')) {
      content = content.replace(oldFooter, SITE_FOOTER);
      changed = true;
    }
  }

  // 5. Wrap main content
  if (!content.includes('id="main-content"')) {
    content = content.replace('<div class="container">', '<main id="main-content"><div class="container">');
    content = content.replace('</div>\n\n  <footer', '</div></main>\n\n  <footer');
    changed = true;
  }

  // 6. Fix hero gradient to use cyan
  content = content.replace(/background:linear-gradient\(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%\)/g, 'background:radial-gradient(ellipse at center, rgba(0,242,255,0.06), transparent 70%)');
  content = content.replace(/background:linear-gradient\(135deg, #0a0b10 0%, #1e1b4b 50%, #0a0b10 100%\)/g, 'background:radial-gradient(ellipse at center, rgba(0,242,255,0.06), transparent 70%)');

  return { content, changed };
}

/**
 * Fix individual tool pages (public/tools/*.html)
 */
function fixToolPage(content) {
  let changed = false;

  // 1. Add CSS imports before </head> if not already there
  if (!content.includes('design-tokens.css')) {
    content = content.replace('</head>', `${CSS_IMPORTS}\n</head>`);
    changed = true;
  }

  // 2. Replace old tool header with site-header
  // Pattern 1: <div class="header"> with emoji logo
  const oldToolDivHeader = /\s*<div class="header">\s*<a href="\/" class="header-logo">\s*<span>[^<]*<\/span> YT SEO Architect<\/a>[\s\S]*?<\/div>/;
  // Pattern 2: <header class="header"> with logo span
  const oldToolHeader1 = /\s*<header class="header">\s*<a href="\/" class="header-logo">\s*<span>[^<]*<\/span> YT SEO Architect<\/a>[\s\S]*?<\/header>/;
  // Pattern 3: <!-- HEADER --> version
  const oldToolHeader2 = /\s*<!-- HEADER -->[\s\S]*?<header class="header">[\s\S]*?<\/header>/;
  // Pattern 4: simple <header class="header"> with ⚡
  const oldToolHeader3 = /\s*<header class="header">\s*<a href="\/">[^<]*<\/a>[\s\S]*?<\/header>/;

  for (const pattern of [oldToolDivHeader, oldToolHeader1, oldToolHeader2, oldToolHeader3]) {
    if (pattern.test(content)) {
      const newHeader = `${SKIP_LINK}\n${SITE_HEADER}\n${BREADCRUMBS_TOOLS}`;
      content = content.replace(pattern, newHeader);
      changed = true;
      break;
    }
  }

  // 3. Replace old footer with site footer (catch various patterns)
  const oldFooterPatterns = [
    /<!-- FOOTER -->[\s\S]*?<footer class="footer">[\s\S]*?<\/footer>/,
    /<footer class="footer">[\s\S]*?<\/footer>/,
  ];
  
  for (const pattern of oldFooterPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, SITE_FOOTER);
      changed = true;
      break;
    }
  }

  // 4. Wrap content in main with id
  if (!content.includes('id="main-content"')) {
    content = content.replace('<div class="container">', '<main id="main-content"><div class="container">');
    content = content.replace(/<\/div>\s*<\/div>\s*<footer/, '</div></main>\n\n  <footer');
    changed = true;
  }

  // 5. Fix header-cta links (purple → cyan)
  content = content.replace(/<a href="\/blog\/[^"]*" class="header-cta">📖 Read the Guide →<\/a>/g, '<a href="/tools" class="header-cta">All Tools</a>');

  return { content, changed };
}

// ─── Helper: list HTML files matching a pattern ──────────────

function listHtmlFiles(dir, filterFn) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => extname(f) === '.html' && filterFn(f))
    .sort();
}

// ─── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Batch Design Fix — YT SEO Architect');
  console.log('═══════════════════════════════════════════════');
  if (DRY_RUN) console.log('  🔍 DRY RUN — no files will be modified\n');

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process glossary comparison pages
  if (FILTER_TYPE === 'all' || FILTER_TYPE === 'glossary') {
    console.log('\n📖 Glossary comparison pages...');
    const glossaryDir = resolve(PROJECT, 'public/glossary');
    const files = listHtmlFiles(glossaryDir, f => f.includes('-vs-'));
    
    for (const file of files) {
      const filepath = resolve(glossaryDir, file);
      try {
        const orig = readFileSync(filepath, 'utf-8');
        const { content, changed } = fixGlossaryComparisonPage(orig);
        if (changed) {
          if (!DRY_RUN) writeFileSync(filepath, content);
          console.log(`  ✓ ${file}`);
          totalFixed++;
        } else {
          totalSkipped++;
        }
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
        totalErrors++;
      }
    }
    console.log(`  → ${files.length} files, ${DRY_RUN ? 'would fix' : 'fixed'}: ${totalFixed}, skipped: ${totalSkipped}`);
  }

  // Process VS pages
  if (FILTER_TYPE === 'all' || FILTER_TYPE === 'vs') {
    console.log('\n⚡ VS comparison pages...');
    const vsDir = resolve(PROJECT, 'public/vs');
    const files = listHtmlFiles(vsDir, f => f !== 'index.html');
    
    let vsFixed = 0;
    let vsSkipped = 0;
    for (const file of files) {
      const filepath = resolve(vsDir, file);
      try {
        const orig = readFileSync(filepath, 'utf-8');
        const { content, changed } = fixVSPage(orig);
        if (changed) {
          if (!DRY_RUN) writeFileSync(filepath, content);
          console.log(`  ✓ ${file}`);
          vsFixed++;
        } else {
          vsSkipped++;
        }
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
        totalErrors++;
      }
    }
    totalFixed += vsFixed;
    totalSkipped += vsSkipped;
    console.log(`  → ${files.length} files, fixed: ${vsFixed}, skipped: ${vsSkipped}`);
  }

  // Process individual tool pages
  if (FILTER_TYPE === 'all' || FILTER_TYPE === 'tools') {
    console.log('\n🛠️  Tool pages...');
    const toolsDir = resolve(PROJECT, 'public/tools');
    const files = listHtmlFiles(toolsDir, f => 
      !f.startsWith('_') && f !== 'index.html' && !f.includes('converters'));
    
    let toolFixed = 0;
    let toolSkipped = 0;
    for (const file of files) {
      const filepath = resolve(toolsDir, file);
      try {
        const orig = readFileSync(filepath, 'utf-8');
        const { content, changed } = fixToolPage(orig);
        if (changed) {
          if (!DRY_RUN) writeFileSync(filepath, content);
          console.log(`  ✓ ${file}`);
          toolFixed++;
        } else {
          toolSkipped++;
        }
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
        totalErrors++;
      }
    }
    totalFixed += toolFixed;
    totalSkipped += toolSkipped;
    console.log(`  → ${files.length} files, fixed: ${toolFixed}, skipped: ${toolSkipped}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Total: ${DRY_RUN ? 'would fix' : 'fixed'}: ${totalFixed}`);
  console.log(`  Skipped (no changes needed): ${totalSkipped}`);
  if (totalErrors > 0) console.log(`  Errors: ${totalErrors}`);
  console.log('═══════════════════════════════════════════════\n');
}

main();
