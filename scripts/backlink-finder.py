#!/usr/bin/env python3
"""
Broken Link Finder — Find broken outbound links on YouTube SEO resource pages
and generate outreach templates for "your link is broken, here's my replacement."

This script:
1. Finds resource/list pages in YouTube/SEO niche using search
2. Checks for broken outbound links (404, 502, timeout)
3. Outputs contact-ready outreach templates with your replacement URL

Usage:
  python3 scripts/backlink-finder.py "youtube seo tools"
  python3 scripts/backlink-finder.py "youtube description templates" --pages 20
  python3 scripts/backlink-finder.py "best youtube analytics tools 2026" --output outreach.csv

Platforms that tend to have resource pages:
  - GitHub READMEs (DR 96)
  - University .edu pages (DR 85+)
  - Industry blogs (DR 40-70)
  - "Best X tools" listicles (DR 30-60)
"""

import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

USER_AGENT = 'Mozilla/5.0 (compatible; BacklinkChecker/1.0; +https://yt-seo-architect.vercel.app)'
OUR_URL = 'https://yt-seo-architect.vercel.app'
REQUEST_TIMEOUT = 10

# ─── Search (DuckDuckGo Lite — no API key needed) ─────────────────────

def search_ddg(query, max_results=20):
    """Search DuckDuckGo Lite and return result URLs."""
    results = []
    try:
        data = urllib.parse.urlencode({'q': query}).encode()
        req = urllib.request.Request(
            'https://lite.duckduckgo.com/lite/',
            data=data,
            headers={'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded'},
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        
        # Extract result links
        links = re.findall(r'href="(https?://[^"]+)"\s+class=[\'"]result-link[\'"]', html)
        results = list(dict.fromkeys(links))  # dedupe, preserve order
        
        # Also try alternate pattern
        if not results:
            links = re.findall(r'class=[\'"]result-link[\'"]\s+href="(https?://[^"]+)"', html)
            results = list(dict.fromkeys(links))
            
        return results[:max_results]
    except Exception as e:
        print(f"  Search error: {e}", file=sys.stderr)
        return []

# ─── Link extraction ──────────────────────────────────────────────────

def extract_outbound_links(html, base_url):
    """Extract all outbound HTTP links from HTML page."""
    links = set()
    # Find all href attributes
    hrefs = re.findall(r'href=["\'](https?://[^"\'\s]+)["\']', html)
    for href in hrefs:
        # Clean the URL
        href = href.rstrip('.,;:!?')
        # Skip same-domain links
        if base_url and base_url in href:
            continue
        # Skip common non-content links
        skip_domains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
                       'youtube.com', 'pinterest.com', 'reddit.com', 'tiktok.com',
                       'google.com', 'doubleclick.net', 'googletagmanager.com',
                       'cloudflare.com', 'amazon.com', 'apple.com',
                       'fonts.googleapis.com', 'fonts.gstatic.com', 'gstatic.com',
                       'addtoany.com', 'x.com', 'tumblr.com']
        if any(d in href for d in skip_domains):
            continue
        links.add(href)
    return list(links)

def check_link(url):
    """Check if a URL returns a healthy status code. Returns (url, status_code, error)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT}, method='HEAD')
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return (url, resp.status, None)
    except urllib.error.HTTPError as e:
        return (url, e.code, str(e))
    except Exception as e:
        return (url, 0, str(e)[:100])

def is_broken(status_code):
    """Consider a link broken if 404, 410, 5xx, or timeout."""
    if status_code == 0:
        return True  # Connection error / timeout
    if 400 <= status_code < 600:
        return True
    return False

# ─── Page fetching ────────────────────────────────────────────────────

def fetch_page(url):
    """Fetch a page, return (url, html, error)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode('utf-8', errors='replace')
            return (url, html, None)
    except Exception as e:
        return (url, '', str(e))

# ─── Outreach template ────────────────────────────────────────────────

def generate_outreach(our_page, broken_url, source_page, anchor_context=''):
    """Generate an outreach email template for broken link building."""
    domain = urllib.parse.urlparse(source_page).netloc
    
    subject = f"Found a broken link on your {domain} page"
    
    body = f"""Hi there,

I was reading your excellent resource at {source_page} and noticed a broken link:

  Broken link: {broken_url}

It points to a page that no longer exists. 

I've written a comprehensive guide on this topic that could be a great replacement:

  {our_page}

It covers [specific angle] with [data/examples/steps] that your readers would find useful.

No pressure — just wanted to flag the broken link and offer a fix.

Best,
Patrick
YT SEO Architect"""

    return {
        'source_page': source_page,
        'broken_url': broken_url,
        'our_replacement': our_page,
        'subject': subject,
        'body': body,
    }

# ─── Main workflow ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Find broken links on YouTube SEO resource pages for backlink outreach'
    )
    parser.add_argument('query', help='Search query (e.g., "youtube seo tools guide")')
    parser.add_argument('--pages', type=int, default=10, help='Number of search results to check (default: 10)')
    parser.add_argument('--our-page', help='Our page to suggest as replacement (default: auto-detect best match)')
    parser.add_argument('--output', help='Save outreach templates to CSV file')
    parser.add_argument('--min-dr', type=int, default=30, help='Minimum estimated domain authority to target')
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"BROKEN LINK FINDER")
    print(f"Query: {args.query}")
    print(f"Checking {args.pages} pages from search results")
    print(f"{'='*60}\n")

    # Step 1: Search for resource pages
    print("Step 1: Searching for resource pages...")
    search_results = search_ddg(args.query, max_results=args.pages)
    print(f"  Found {len(search_results)} results\n")

    if not search_results:
        print("No results found. Try a different query.")
        return

    # Step 2: Fetch each page
    print("Step 2: Fetching pages and extracting links...")
    page_data = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fetch_page, url): url for url in search_results}
        for future in as_completed(futures):
            url, html, error = future.result()
            if error:
                print(f"  [SKIP] {url[:80]} — {error[:60]}")
                continue
            # Extract base domain for same-domain filtering
            parsed = urllib.parse.urlparse(url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            links = extract_outbound_links(html, base)
            if links:
                page_data[url] = {'html': html, 'links': links, 'base': base}
                print(f"  [OK] {url[:80]} — {len(links)} outbound links")

    print(f"\n  Successfully fetched {len(page_data)} pages\n")

    if not page_data:
        print("Could not fetch any pages. Try again later.")
        return

    # Step 3: Check all outbound links for broken ones
    print("Step 3: Checking links for broken URLs...")
    all_links = []
    link_to_source = {}
    for source_url, data in page_data.items():
        for link in data['links']:
            all_links.append(link)
            link_to_source[link] = source_url

    # Deduplicate
    unique_links = list(set(all_links))
    print(f"  Checking {len(unique_links)} unique links...")

    broken_links = []
    checked = 0
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check_link, url): url for url in unique_links}
        for future in as_completed(futures):
            url, status, error = future.result()
            checked += 1
            if checked % 20 == 0:
                print(f"    Checked {checked}/{len(unique_links)}...")
            if is_broken(status):
                source = link_to_source.get(url, 'unknown')
                broken_links.append({
                    'broken_url': url,
                    'source_page': source,
                    'status': status,
                    'error': error,
                })

    print(f"  Found {len(broken_links)} broken links\n")

    # Step 4: Generate outreach templates
    if not broken_links:
        print("No broken links found. Try a different query or niche.")
        return

    our_page = args.our_page or f"{OUR_URL}/blog"
    
    print("Step 4: Outreach opportunities")
    print(f"{'='*60}")
    
    opportunities = []
    for i, bl in enumerate(broken_links, 1):
        outreach = generate_outreach(our_page, bl['broken_url'], bl['source_page'])
        opportunities.append(outreach)
        
        print(f"\n--- Opportunity #{i} ---")
        print(f"Source page: {outreach['source_page']}")
        print(f"Broken link: {outreach['broken_url']}")
        print(f"Our replacement: {outreach['our_replacement']}")
        print(f"Email subject: {outreach['subject']}")
        print(f"\n{outreach['body']}")
        print(f"{'-'*40}")

    # Step 5: Save to CSV if requested
    if args.output:
        import csv
        with open(args.output, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['source_page', 'broken_url', 'our_replacement', 'subject', 'body'])
            writer.writeheader()
            for o in opportunities:
                writer.writerow(o)
        print(f"\nSaved {len(opportunities)} outreach templates to {args.output}")

    print(f"\n{'='*60}")
    print(f"SUMMARY: {len(broken_links)} broken links found on {len(page_data)} pages")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"1. Review the broken links — verify they're really broken")
    print(f"2. Find the site owner's contact email (check /about, /contact, or use hunter.io)")
    print(f"3. Send the outreach emails (personalize slightly)")
    print(f"4. Track responses in a spreadsheet")
    print(f"5. Follow up once after 5 days if no response")
    print(f"\nTypical response rate: 10-20% for broken link outreach")
    print(f"Expected backlinks from 10 outreaches: 1-2 dofollow links")

if __name__ == '__main__':
    main()
