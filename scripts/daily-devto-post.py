#!/usr/bin/env python3
"""
Daily Dev.to Cross-Poster — posts one blog article per day to dev.to
with canonical link back to yt-seo-architect.vercel.app.

Usage: python3 scripts/daily-devto-post.py [--dry-run] [--force SLUG]
"""
import os
import re
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

# Load .env file if DEVTO_API_KEY not in environment
_env_file = Path(__file__).parent.parent / '.env'
if not os.environ.get('DEVTO_API_KEY') and _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            os.environ.setdefault(key.strip(), value.strip())

BASE_URL = "https://yt-seo-architect.vercel.app"
BLOG_DIR = Path(__file__).parent.parent / "public" / "blog"
STATE_FILE = Path(__file__).parent.parent / "logs" / "devto-posted.json"
API_KEY = os.environ.get("DEVTO_API_KEY", "")

# Skip these files
SKIP = {"_TEMPLATE.html", "blog.css"}

def load_state():
    """Load list of already-posted slugs."""
    try:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text())
    except Exception:
        pass
    return {"posted": [], "last_run": None}

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))

def extract_meta(html, name):
    patterns = [
        r'<meta\s+name=["\']' + name + r'["\']\s+content=["\']([^"\']*)',
        r'<meta\s+property=["\']' + name + r'["\']\s+content=["\']([^"\']*)',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None

def extract_article_body(html):
    """Extract only the article content, skip nav/author/footer."""
    m = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    if m:
        return m.group(1)
    m = re.search(r'<main[^>]*>(.*?)</main>', html, re.DOTALL)
    if m:
        return m.group(1)
    return html

def html_to_clean_markdown(html):
    """Convert HTML to clean markdown for dev.to."""
    md = html

    # Remove script/style/json-LD
    md = re.sub(r'<script[^>]*>.*?</script>', '', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<style[^>]*>.*?</style>', '', md, flags=re.DOTALL | re.I)

    # Remove nav, header, footer, author box, breadcrumbs, CTA, TOC
    remove_patterns = [
        r'<nav[^>]*>.*?</nav>',
        r'<header[^>]*>.*?</header>',
        r'<footer[^>]*>.*?</footer>',
        r'<div[^>]*class=["\'][^"\']*author[^"\']*["\'][^>]*>.*?</div>',
        r'<div[^>]*class=["\'][^"\']*breadcrumb[^"\']*["\'][^>]*>.*?</div>',
        r'<div[^>]*class=["\'][^"\']*cta[^"\']*["\'][^>]*>.*?</div>',
        r'<div[^>]*class=["\'][^"\']*toc[^"\']*["\'][^>]*>.*?</div>',
    ]
    for pat in remove_patterns:
        md = re.sub(pat, '', md, flags=re.DOTALL | re.I)

    # Convert headings
    md = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1\n', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1\n', md, flags=re.DOTALL | re.I)

    # Bold, italic, links
    md = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', md, flags=re.DOTALL | re.I)

    # Paragraphs and lists
    md = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<br\s*/?>', '\n', md, flags=re.I)
    md = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', md, flags=re.DOTALL | re.I)

    # Tables to basic markdown
    md = re.sub(r'<thead[^>]*>', '', md, flags=re.I)
    md = re.sub(r'</thead>', '', md, flags=re.I)
    md = re.sub(r'<tbody[^>]*>', '', md, flags=re.I)
    md = re.sub(r'</tbody>', '', md, flags=re.I)
    md = re.sub(r'<tr[^>]*>(.*?)</tr>', r'\1\n', md, flags=re.DOTALL | re.I)
    md = re.sub(r'<t[dh][^>]*>(.*?)</t[dh]>', r'| \1 ', md, flags=re.DOTALL | re.I)

    # Remove remaining HTML tags
    md = re.sub(r'<[^>]+>', '', md)

    # Decode common HTML entities
    md = md.replace('&amp;', '&')
    md = md.replace('&lt;', '<')
    md = md.replace('&gt;', '>')
    md = md.replace('&quot;', '"')
    md = md.replace('&#39;', "'")
    md = md.replace('&nbsp;', ' ')

    # Clean whitespace
    md = re.sub(r'\n\s*\n\s*\n+', '\n\n', md)
    md = re.sub(r'^\s+', '', md, flags=re.MULTILINE)
    return md.strip()

def get_existing_articles(api_key):
    """Fetch all existing dev.to articles to check for duplicates.

    Uses curl (not urllib) — dev.to returns 403 Forbidden Bots to urllib's
    User-Agent, which made this function always return an empty set and the
    daily run would try to repost an already-published canonical (422).
    """
    import subprocess
    try:
        result = subprocess.run([
            'curl', '-s',
            '-H', f'api-key: {api_key}',
            'https://dev.to/api/articles/me?per_page=100&state=published',
        ], capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[:200])
        articles = json.loads(result.stdout)
        # Return set of canonical URLs already posted
        return {a.get('canonical_url', '').rstrip('/') for a in articles}
    except Exception as e:
        print(f"  Warning: Could not fetch existing articles: {e}")
        return set()

def post_to_devto(title, description, markdown, tags, canonical_url, api_key, dry_run=False):
    """Post article to dev.to via curl (Python urllib gets 403 from dev.to). Returns URL or None."""
    import subprocess, tempfile

    # Truncate if too long
    max_body = 25000
    if len(markdown) > max_body:
        markdown = markdown[:max_body] + '\n\n*[Content truncated — read the full guide at the original link]*'

    # Add footer
    markdown += f'\n\n---\n\n*Originally published at [YT SEO Architect]({canonical_url})*'

    payload = json.dumps({
        'article': {
            'title': title,
            'description': description[:200],
            'body_markdown': markdown,
            'published': True,
            'tags': tags[:4],
            'canonical_url': canonical_url,
        }
    })

    if dry_run:
        print(f"  [DRY RUN] Would post: {title}")
        print(f"  Body length: {len(markdown)} chars")
        return "dry-run"

    # Write payload to temp file and use curl (avoids Python urllib 403)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(payload)
        tmp_path = f.name

    try:
        result = subprocess.run([
            'curl', '-s', '-w', '\\n%{http_code}',
            '-X', 'POST', 'https://dev.to/api/articles',
            '-H', 'Content-Type: application/json',
            '-H', f'api-key: {api_key}',
            '-d', f'@{tmp_path}',
        ], capture_output=True, text=True, timeout=60)

        lines = result.stdout.strip().rsplit('\n', 1)
        if len(lines) == 2:
            body, status = lines
        else:
            body, status = result.stdout, '000'

        if status == '201':
            data = json.loads(body)
            return data.get('url', 'unknown')
        else:
            error_data = json.loads(body) if body else {}
            error_msg = error_data.get('error', body[:200])
            print(f"  dev.to ERROR: {status} - {error_msg}")
            return None
    except Exception as e:
        print(f"  dev.to ERROR: {e}")
        return None
    finally:
        os.unlink(tmp_path)

def main():
    dry_run = '--dry-run' in sys.argv
    force_slug = None
    if '--force' in sys.argv:
        idx = sys.argv.index('--force')
        if idx + 1 < len(sys.argv):
            force_slug = sys.argv[idx + 1]

    if not API_KEY:
        print("ERROR: Set DEVTO_API_KEY environment variable")
        sys.exit(1)

    print(f"{'='*60}")
    print(f"  DAILY DEV.TO CROSS-POSTER")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*60}")

    # Load state
    state = load_state()
    posted = set(state.get("posted", []))

    # Get existing articles on dev.to
    existing = get_existing_articles(API_KEY)
    print(f"  Already on dev.to: {len(existing)} articles")

    # Find all blog posts
    all_posts = []
    for f in sorted(BLOG_DIR.glob("*.html")):
        if f.name in SKIP or f.name.startswith('.'):
            continue
        slug = f.stem
        all_posts.append(slug)

    print(f"  Total blog posts: {len(all_posts)}")

    # Filter out already posted
    unposted = []
    for slug in all_posts:
        canonical = f"{BASE_URL}/blog/{slug}"
        if slug in posted:
            continue
        if canonical.rstrip('/') in existing:
            posted.add(slug)  # Mark as posted
            continue
        unposted.append(slug)

    print(f"  Unposted: {len(unposted)}")

    if not unposted:
        print("\n  All posts already cross-posted!")
        state["posted"] = list(posted)
        state["last_run"] = datetime.now().isoformat()
        save_state(state)
        sys.exit(0)

    # Pick next post
    if force_slug and force_slug in unposted:
        target = force_slug
    else:
        target = unposted[0]

    print(f"\n  Posting: {target}")
    print(f"  ({len(unposted) - 1} remaining after this)")

    # Read and convert
    filepath = BLOG_DIR / f"{target}.html"
    html = filepath.read_text(encoding='utf-8')

    title = extract_meta(html, 'og:title') or extract_meta(html, 'title') or target.replace('-', ' ').title()
    title = re.sub(r'\s*[-–—|]\s*YT\s*SEO\s*Architect.*$', '', title, flags=re.IGNORECASE).strip()

    description = extract_meta(html, 'description') or extract_meta(html, 'og:description') or ''
    canonical = f"{BASE_URL}/blog/{target}"

    body_html = extract_article_body(html)
    markdown = html_to_clean_markdown(body_html)

    # Extract tags from HTML or use defaults
    tags = ['youtube', 'seo', 'contentcreation']

    print(f"  Title: {title[:80]}...")
    print(f"  Body: {len(markdown)} chars")

    # Post
    url = post_to_devto(title, description, markdown, tags, canonical, API_KEY, dry_run=dry_run)

    if url:
        print(f"\n  SUCCESS: {url}")
        posted.add(target)
        state["posted"] = list(posted)
        state["last_run"] = datetime.now().isoformat()
        save_state(state)
    else:
        print(f"\n  FAILED — will retry next run")

    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()
