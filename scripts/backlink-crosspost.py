#!/usr/bin/env python3
"""
Backlink Cross-Poster — Automatically cross-post blog posts to high-DR platforms
with dofollow canonical links back to yt-seo-architect.vercel.app.

Platforms:
  - dev.to (DR 91) — dofollow, canonical_url supported
  - Hashnode (DR 82) — dofollow, canonicalURL supported via API
  - Medium (DR 95) — via existing publish-to-medium.mjs script

Setup:
  1. dev.to: Get API key at https://dev.to/settings/extensions
     export DEVTO_API_KEY=your_key

  2. Hashnode: Get token at https://hashnode.com/settings/developer
     export HASHNODE_TOKEN=your_token
     export HASHNODE_PUBLICATION_ID=your_publication_id

Usage:
  # Cross-post a single blog post to all platforms
  python3 scripts/backlink-crosspost.py youtube-description-templates-2026

  # Cross-post to specific platform only
  python3 scripts/backlink-crosspost.py youtube-description-templates-2026 --platform devto

  # Dry run (preview without posting)
  python3 scripts/backlink-crosspost.py youtube-description-templates-2026 --dry-run

  # List all blog posts available for cross-posting
  python3 scripts/backlink-crosspost.py --list
"""

import os
import re
import sys
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = "https://yt-seo-architect.vercel.app"
BLOG_DIR = Path(__file__).parent.parent / "public" / "blog"

# ─── HTML extraction ──────────────────────────────────────────────────

def extract_meta(html, name):
    """Extract meta tag content by name or property."""
    patterns = [
        '<meta\\s+name=["\\\']' + name + '["\\\']\\s+content=["\\\']([^"\\\']*)',
        '<meta\\s+property=["\\\']' + name + '["\\\']\\s+content=["\\\']([^"\\\']*)',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None

def clean_html_for_platform(html, platform="devto"):
    """Strip template-only elements, keep content."""
    # Remove header/footer/sidebars that only exist on our site
    remove_selectors = [
        r'<header[^>]*>.*?</header>',
        r'<footer[^>]*>.*?</footer>',
        r'<nav\s+class=["\']breadcrumb[^>]*>.*?</nav>',
        r'<div\s+class=["\']author-box[^>]*>.*?</div>',
        r'<div\s+class=["\']cta-box[^>]*>.*?</div>',
        r'<div\s+class=["\']cta-bottom[^>]*>.*?</div>',
        r'<div\s+class=["\']social-proof[^>]*>.*?</div>',
        r'<div\s+class=["\']trending-now[^>]*>.*?</div>',
        r'<nav\s+class=["\']related-posts[^>]*>.*?</nav>',
        r'<script[^>]*>.*?</script>',
    ]
    for selector in remove_selectors:
        html = re.sub(selector, '', html, flags=re.DOTALL | re.IGNORECASE)

    # Convert relative links to absolute
    html = html.replace('href="/', f'href="{BASE_URL}/')
    html = html.replace("href='/", f"href='{BASE_URL}/")
    html = html.replace('src="/', f'src="{BASE_URL}/')
    html = html.replace("src='/", f"src='{BASE_URL}/")

    return html

def extract_article_body(html):
    """Extract the <article> tag content."""
    m = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    if m:
        return m.group(1)
    # Fallback: extract <main> content
    m = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
    if m:
        return m.group(1)
    return html

def extract_tags(html):
    """Try to find tags/categories from blog post."""
    tags = []
    # Look for category in breadcrumb
    m = re.search(r'<strong>([^<]+)</strong>', html)
    if m:
        tags.append(m.group(1).lower().replace(' ', ''))
    # Look for tag-like patterns
    cat_m = re.search(r'<span\s+class=["\']category["\'][^>]*>([^<]+)', html)
    if cat_m:
        tags.append(cat_m.group(1).lower().replace(' ', ''))
    # Default YouTube/SEO tags
    default_tags = ['youtube', 'seo', 'contentcreation']
    for t in default_tags:
        if t not in tags:
            tags.append(t)
    return tags[:4]  # dev.to max 4 tags

def read_blog_post(slug):
    """Read a blog post HTML file and extract metadata."""
    filepath = BLOG_DIR / f"{slug}.html"
    if not filepath.exists():
        print(f"Error: Blog post not found: {filepath}")
        sys.exit(1)

    html = filepath.read_text(encoding='utf-8')

    title = extract_meta(html, 'og:title') or extract_meta(html, 'title')
    if not title:
        m = re.search(r'<title>([^<]*)</title>', html)
        title = m.group(1) if m else slug.replace('-', ' ').title()

    description = extract_meta(html, 'description') or extract_meta(html, 'og:description') or ''
    canonical = extract_meta(html, 'canonical') or f"{BASE_URL}/blog/{slug}"
    tags = extract_tags(html)

    # Clean up title (remove site name suffix)
    title = re.sub(r'\s*[-–—|]\s*YT\s*SEO\s*Architect.*$', '', title, flags=re.IGNORECASE).strip()

    body_html = extract_article_body(html)
    body_html = clean_html_for_platform(body_html)

    return {
        'slug': slug,
        'title': title,
        'description': description,
        'canonical_url': canonical,
        'tags': tags,
        'body_html': body_html,
    }

# ─── dev.to ────────────────────────────────────────────────────────────

def post_to_devto(post, api_key, dry_run=False):
    """Post to dev.to with canonical_url. Returns URL or None."""
    devto_body = post['body_html']
    # dev.to uses markdown, but accepts HTML. Add cross-post footer.
    devto_body += f"""
<br><br>
<hr>
<p><em>Originally published at <a href="{post['canonical_url']}">YT SEO Architect</a>.</em></p>
"""

    payload = {
        'article': {
            'title': post['title'],
            'description': post['description'][:200],
            'body_markdown': '',  # We're sending HTML
            'body_html': devto_body,
            'published': True,
            'tags': post['tags'],
            'canonical_url': post['canonical_url'],
        }
    }

    if dry_run:
        print(f"\n  [DRY RUN] Would post to dev.to:")
        print(f"    Title: {post['title']}")
        print(f"    Tags: {', '.join(post['tags'])}")
        print(f"    Canonical: {post['canonical_url']}")
        print(f"    Body length: {len(devto_body)} chars")
        return None

    try:
        req = urllib.request.Request(
            'https://dev.to/api/articles',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'api-key': api_key,
            },
            method='POST',
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            devto_url = result.get('url', 'unknown')
            print(f"  dev.to: {devto_url} (DR 91, dofollow)")
            return devto_url
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  dev.to ERROR: {e.code} - {error_body[:300]}")
        return None

# ─── Hashnode ───────────────────────────────────────────────────────────

def post_to_hashnode(post, token, publication_id, dry_run=False):
    """Post to Hashnode via GraphQL API."""
    query = """
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          url
          slug
        }
      }
    }
    """

    # Clean up body for Hashnode
    body = post['body_html']

    variables = {
        'input': {
            'title': post['title'],
            'publicationId': publication_id,
            'contentMarkdown': '',  # We're sending HTML
            'contentHtml': body,
            'tags': [{'slug': t, 'name': t.capitalize()} for t in post['tags']],
            'canonicalUrl': post['canonical_url'],
            'subtitle': post['description'][:150],
            'disableComments': False,
        }
    }

    payload = {
        'query': query,
        'variables': variables,
    }

    if dry_run:
        print(f"\n  [DRY RUN] Would post to Hashnode:")
        print(f"    Title: {post['title']}")
        print(f"    Tags: {', '.join(post['tags'])}")
        print(f"    Canonical: {post['canonical_url']}")
        return None

    try:
        req = urllib.request.Request(
            'https://gql.hashnode.com/',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': token,
            },
            method='POST',
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            post_data = result.get('data', {}).get('publishPost', {}).get('post', {})
            hn_url = post_data.get('url', 'unknown')
            print(f"  Hashnode: {hn_url} (DR 82, dofollow)")
            return hn_url
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  Hashnode ERROR: {e.code} - {error_body[:300]}")
        return None

# ─── Main ──────────────────────────────────────────────────────────────

def list_posts():
    """List all available blog posts."""
    if not BLOG_DIR.exists():
        print("No blog directory found.")
        return

    posts = sorted(BLOG_DIR.glob("*.html"))
    print(f"\n{'='*60}")
    print(f"Blog posts available for cross-posting ({len(posts)} files)")
    print(f"{'='*60}")
    for p in posts:
        if p.name.startswith('_'):
            continue
        slug = p.stem
        html = p.read_text(encoding='utf-8')
        # Check if it's a real post (not template)
        if '[POST_TITLE]' in html or '[ARTICLE_HEADLINE]' in html:
            print(f"  [SKIP] {slug} — still has placeholder content")
            continue
        title_m = re.search(r'<title>([^<]*)</title>', html)
        title = title_m.group(1) if title_m else '(no title)'
        title = re.sub(r'\s*[-–—|]\s*YT\s*SEO\s*Architect.*$', '', title, flags=re.IGNORECASE).strip()
        desc = extract_meta(html, 'description') or '(no description)'
        desc = desc[:100] + '...' if len(desc) > 100 else desc
        print(f"  {slug}")
        print(f"    Title: {title}")
        print(f"    Desc:  {desc}")
        print()

def main():
    parser = argparse.ArgumentParser(description='Cross-post blog posts for backlinks')
    parser.add_argument('slug', nargs='?', help='Blog post slug (e.g., youtube-description-templates-2026)')
    parser.add_argument('--platform', choices=['devto', 'hashnode', 'all'], default='all',
                        help='Target platform (default: all)')
    parser.add_argument('--dry-run', action='store_true', help='Preview without posting')
    parser.add_argument('--list', action='store_true', help='List all available blog posts')
    args = parser.parse_args()

    if args.list:
        list_posts()
        return

    if not args.slug:
        parser.print_help()
        print("\nRun with --list to see available posts.")
        return

    post = read_blog_post(args.slug)

    print(f"\n{'='*60}")
    print(f"Cross-posting: {post['slug']}")
    print(f"Title: {post['title']}")
    print(f"Canonical: {post['canonical_url']}")
    print(f"Tags: {', '.join(post['tags'])}")
    if args.dry_run:
        print("MODE: DRY RUN (no actual posting)")
    print(f"{'='*60}")

    results = {}

    if args.platform in ('devto', 'all'):
        api_key = os.environ.get('DEVTO_API_KEY')
        if not api_key:
            print("  dev.to: SKIPPED (set DEVTO_API_KEY env var)")
        else:
            results['devto'] = post_to_devto(post, api_key, dry_run=args.dry_run)

    if args.platform in ('hashnode', 'all'):
        token = os.environ.get('HASHNODE_TOKEN')
        pub_id = os.environ.get('HASHNODE_PUBLICATION_ID')
        if not token or not pub_id:
            print("  Hashnode: SKIPPED (set HASHNODE_TOKEN + HASHNODE_PUBLICATION_ID env vars)")
        else:
            results['hashnode'] = post_to_hashnode(post, token, pub_id, dry_run=args.dry_run)

    if args.platform in ('all',):
        print("\n  Medium: Use existing script — node scripts/publish-to-medium.mjs " + post['slug'])

    if not args.dry_run:
        print(f"\nDone! Backlinks earned:")
        for platform, url in results.items():
            if url:
                dr = {'devto': 91, 'hashnode': 82}.get(platform, '?')
                print(f"  {platform}: {url} (DR {dr}, dofollow ✓)")

    print(f"\nPro tip: Wait 2-3 days between cross-posts to avoid duplicate content flags.")
    print(f"Google will credit the canonical URL — no SEO penalty.")

if __name__ == '__main__':
    main()
