#!/usr/bin/env python3
"""
Batch-update all blog articles and tool pages with the new shared header/footer/CSS.
"""
import os
import re
import glob

ROOT = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"

# ── New CSS imports block ──
CSS_IMPORTS = '''  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>'''

# ── Shared Header ──
SHARED_HEADER = '''  <!-- Skip to content -->
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
        <a href="/tools.html">Tools</a>
        <a href="/blog">Blog</a>
        <a href="/public/glossary">Glossary</a>
        <a href="/public/tools">Free Tools</a>
        <a href="/dashboard.html" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">\\u2630</button>
    </div>
  </header>

  <!-- Breadcrumbs -->
  <div class="breadcrumbs">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href="/blog">Blog</a>
    <span class="sep">/</span>
    <span class="current">Article</span>
  </div>'''

# ── Shared Header for Tools ──
SHARED_HEADER_TOOLS = '''  <!-- Skip to content -->
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
        <a href="/tools.html">Tools</a>
        <a href="/blog">Blog</a>
        <a href="/public/glossary">Glossary</a>
        <a href="/public/tools">Free Tools</a>
        <a href="/dashboard.html" class="header-cta">Dashboard</a>
      </nav>
      <button class="mobile-menu-btn" aria-label="Menu" onclick="document.getElementById('header-nav').classList.toggle('open')">\\u2630</button>
    </div>
  </header>

  <!-- Breadcrumbs -->
  <div class="breadcrumbs">
    <a href="/">Home</a>
    <span class="sep">/</span>
    <a href="/tools.html">Tools</a>
    <span class="sep">/</span>
    <span class="current">Tool</span>
  </div>'''

# ── Shared Footer ──
SHARED_FOOTER = '''  <!-- Footer -->
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <h4>Product</h4>
        <a href="/public/tools">Free Tools</a>
        <a href="/dashboard.html">Dashboard</a>
        <a href="/changelog.html">Changelog</a>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <a href="/blog">Blog</a>
        <a href="/public/glossary">Glossary</a>
        <a href="/public/guides">Guides</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/privacy-policy.html">Privacy</a>
        <a href="/terms-of-service.html">Terms</a>
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
        <a href="https://twitter.com/YTSEOArchitect" target="_blank" rel="noopener" aria-label="Twitter">\\u1d54\\u1d43</a>
        <a href="https://github.com/nhlaka3" target="_blank" rel="noopener" aria-label="GitHub">GH</a>
      </div>
    </div>
  </footer>

  <script defer src="/js/blog-enhancements.js"></script>'''


def process_blog_article(filepath):
    """Update a single blog article with new CSS imports, header, footer."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. Replace old CSS link to blog.css with new imports
    old_css = '<link rel="stylesheet" href="/blog/blog.css" />'
    if old_css in content:
        content = content.replace(old_css, CSS_IMPORTS)
        changed = True

    # 2. Replace old reading progress bar + header (two variants)
    old_header_v1 = '  <!-- Reading Progress Bar -->\n  <div class="reading-progress" id="readingProgress" aria-hidden="true"></div>\n  <header class="header">\n    <a href="/">⚡ YT SEO Architect</a>\n    <a href="/dashboard" class="cta">Try Free</a>\n  </header>'
    old_header_v2 = '<header class="header">\n    <a href="/">⚡ YT SEO Architect</a>\n    <a href="/dashboard" class="cta">Try Free</a>\n  </header>'

    if old_header_v1 in content:
        content = content.replace(old_header_v1, SHARED_HEADER)
        changed = True
    elif old_header_v2 in content:
        content = content.replace(old_header_v2, SHARED_HEADER)
        changed = True

    # 3. Replace old footer with new shared footer
    old_footer_v1 = '<footer class="footer">\n    <p>© 2026 YT SEO Architect · <a href="/blog">All Articles</a> · <a href="/privacy-policy">Privacy</a></p>\n  </footer>'
    old_footer_v2 = '<footer class="footer">\n    <p>© 2026 YT SEO Architect · <a href="/blog">All Articles</a></p>\n  </footer>'
    old_footer_v3 = '<footer class="footer">\n    <p>© 2026 YT SEO Architect. All rights reserved.</p>\n  </footer>'

    if old_footer_v1 in content:
        content = content.replace(old_footer_v1, SHARED_FOOTER)
        changed = True
    elif old_footer_v2 in content:
        content = content.replace(old_footer_v2, SHARED_FOOTER)
        changed = True
    elif old_footer_v3 in content:
        content = content.replace(old_footer_v3, SHARED_FOOTER)
        changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def process_tool_page(filepath):
    """Update a single tool page with new CSS imports, header, footer."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. Add CSS imports before </head> (only if not already there)
    if 'design-tokens.css' not in content:
        content = content.replace('</head>', f'  {CSS_IMPORTS}\n</head>')
        changed = True

    # 2. Replace old tool header
    old_tool_header = '  <!-- HEADER -->\n  <header class="header">\n    <a href="/" class="header-logo">\n      <img src="/logo.svg" alt="YT SEO Architect" width="32" height="32" loading="eager" fetchpriority="high" />\n      YT SEO Architect\n    </a>\n    <a href="/dashboard" class="header-cta">🚀 Get Started Free</a>\n  </header>'

    if old_tool_header in content:
        content = content.replace(old_tool_header, SHARED_HEADER_TOOLS)
        changed = True

    # 3. Add footer before </body> (if no footer exists)
    if '</footer>' not in content:
        content = content.replace('</body>', f'{SHARED_FOOTER}\n</body>')
        changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    print("=" * 60)
    print("Batch Updating Blog Articles & Tool Pages")
    print("=" * 60)

    # Process blog articles
    blog_dir = os.path.join(ROOT, "public/blog")
    blog_files = sorted(glob.glob(os.path.join(blog_dir, "*.html")))
    blog_count = 0
    for fp in blog_files:
        basename = os.path.basename(fp)
        if basename in ('_TEMPLATE.html', 'blog.css') or basename.startswith('_'):
            continue
        if process_blog_article(fp):
            print(f"  ✓ Updated blog: {basename}")
            blog_count += 1
        else:
            print(f"  - Skipped blog (no matching patterns): {basename}")

    # Process tool pages
    tools_dir = os.path.join(ROOT, "public/tools")
    tool_files = sorted(glob.glob(os.path.join(tools_dir, "*.html")))
    tool_count = 0
    for fp in tool_files:
        basename = os.path.basename(fp)
        if basename in ('index.html', '_template.html') or basename.startswith('_'):
            continue
        if process_tool_page(fp):
            print(f"  ✓ Updated tool: {basename}")
            tool_count += 1
        else:
            print(f"  - Skipped tool (no matching patterns): {basename}")

    print()
    print(f"Updated {blog_count} blog articles, {tool_count} tool pages")


if __name__ == "__main__":
    main()
