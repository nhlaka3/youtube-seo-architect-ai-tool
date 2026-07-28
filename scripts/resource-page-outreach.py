#!/usr/bin/env python3
"""
scripts/resource-page-outreach.py

Resource Page Outreach — Find "Best YouTube Tools", "Tools for Creators",
and similar resource/list pages, check if YT SEO Architect is already
listed, and generate personalized outreach asking to be added.

Strategy: Resource pages are PERMANENT backlinks. Once added, they stay
for months/years. Unlike blog posts that get buried, resource pages
are constantly updated and re-shared.

Usage:
  python3 scripts/resource-page-outreach.py                     # Run full scan
  python3 scripts/resource-page-outreach.py --dry-run           # Preview only
  python3 scripts/resource-page-outreach.py --pages 20          # More results
  python3 scripts/resource-page-outreach.py --search            # Search phase only
  python3 scripts/resource-page-outreach.py --status            # Show stats

Output: CSV compatible with scripts/backlink-outreach-sender.py
  source_page, broken_url, subject, body, our_replacement, contact_email

No API keys needed — uses DuckDuckGo Lite for search + direct HTTP fetching.
"""

import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT / "marketing" / "backlink-reports"
SEEN_DB = REPORTS_DIR / "resource-page-seen.json"

USER_AGENT = "Mozilla/5.0 (compatible; ResourceOutreach/1.0; +https://yt-seo-architect.vercel.app)"
OUR_URL = "https://yt-seo-architect.vercel.app"
REQUEST_TIMEOUT = 12

# ─── Our site domains to check against ────────────────────────────────

OUR_DOMAINS = [
    "yt-seo-architect.vercel.app",
    "youtube-seo-architect.vercel.app",
    "youtube-seo-tool.vercel.app",
]

# ─── Search queries to find resource pages ────────────────────────────

SEARCH_QUERIES = [
    # "Best tools" listicles
    "best youtube tools for creators",
    "best youtube seo tools 2026",
    "best free youtube tools",
    "best tools for youtube growth",
    "best youtube analytics tools",
    "best youtube keyword research tools",
    "best youtube thumbnail maker",
    "best youtube description generator",
    "top youtube tools every creator needs",
    "best free tools for youtubers",
    "best youtube marketing tools",
    # Resource roundups
    "youtube creator toolkit",
    "youtube tools list",
    "youtube seo resources",
    "essential youtube tools",
    "tools for youtube creators",
    "youtube growth resources",
    "youtube optimization tools",
    # "Helpful Resources" pages
    "helpful resources youtube creators",
    "youtube resources page",
    "tools i use youtube",
    "gear and tools for youtube",
    "youtube studio tools",
    "youtube content creation tools",
    "youtube video optimization tools",
    # Community resource pages
    "youtube tools and resources",
    "youtube creator resources",
    "free tools for youtube channels",
    "youtube seo checklist tools",
]

# ─── Our linkable asset pages ─────────────────────────────────────────

OUR_PAGES = {
    "default": f"{OUR_URL}/dashboard",
    "tools": f"{OUR_URL}/tools",
    "tag": f"{OUR_URL}/tools/tag-generator",
    "keyword": f"{OUR_URL}/tools/keyword-research",
    "title": f"{OUR_URL}/tools/title-optimizer",
    "description": f"{OUR_URL}/tools/description-writer",
    "audit": f"{OUR_URL}/tools/youtube-seo-audit-diagnostic-fix-2026",
    "blog": f"{OUR_URL}/blog",
}

# ─── Utility ──────────────────────────────────────────────────────────

def normalize_domain(url):
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        domain = re.sub(r"^www\.", "", domain)
        return domain
    except Exception:
        return url.lower()

def domain_matches_our_site(domain):
    domain = domain.lower()
    for ours in OUR_DOMAINS:
        if ours in domain or domain in ours:
            return True
    return False

def extract_page_title(html):
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip()[:120] if match else ""

# ─── Email extraction ─────────────────────────────────────────────────

def extract_emails(html, source_url):
    """Extract contact emails from page HTML.
    Returns the first likely contact email, or None.
    """
    parsed = urllib.parse.urlparse(source_url)
    domain = re.sub(r"^www\.", "", parsed.netloc).lower()

    found = set()
    # mailto: links
    mailtos = re.findall(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html)
    found.update(mailtos)
    # CloudFlare email protection (data-cfemail is hex-encoded)
    cf_encoded = re.findall(r'data-cfemail="([a-fA-F0-9]+)"', html)
    for cf in cf_encoded:
        try:
            decoded = bytes.fromhex(cf)
            key = decoded[0]
            email = ''.join(chr(b ^ key) for b in decoded[1:])
            if '@' in email:
                found.add(email)
        except Exception:
            pass
    # Plain email patterns
    plain = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html)
    found.update(plain)

    # Filter out noreply, example.com, etc.
    skip_hard = {"noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster"}
    image_exts = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".ico", ".css", ".js"}
    fake_domains = {"example.com", "example.org", "example.net", "domain.com"}

    candidates = []
    for e in found:
        el = e.lower()
        if any(s in el for s in skip_hard):
            continue
        if any(el.endswith(ext) for ext in image_exts):
            continue
        email_domain = el.split("@")[1] if "@" in el else ""
        if email_domain in fake_domains:
            continue
        candidates.append(e)

    # Prefer domain-matching emails
    domain_emails = [e for e in candidates if domain in e.lower()]
    if domain_emails:
        return domain_emails[0]
    return candidates[0] if candidates else None


# ─── Search (DuckDuckGo Lite — no API key needed) ─────────────────────

def search_ddg(query, max_results=20):
    """Search DuckDuckGo Lite and return result URLs."""
    results = []
    try:
        data = urllib.parse.urlencode({"q": query}).encode()
        req = urllib.request.Request(
            "https://lite.duckduckgo.com/lite/",
            data=data,
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        links = re.findall(r'href="(https?://[^"]+)"\s+class=[\'"]result-link[\'"]', html)
        results = list(dict.fromkeys(links))
        if not results:
            links = re.findall(r'class=[\'"]result-link[\'"]\s+href="(https?://[^"]+)"', html)
            results = list(dict.fromkeys(links))

        return results[:max_results]
    except Exception as e:
        print(f"  Search error: {e}", file=sys.stderr)
        return []

# ─── Page fetching & analysis ─────────────────────────────────────────

def fetch_page(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            return (url, html, None)
    except Exception as e:
        return (url, "", str(e)[:100])

def analyze_page(html, url):
    """Check if a page is a resource/list page and whether it links to us."""
    parsed = urllib.parse.urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    page_title = extract_page_title(html)

    # Extract all outbound links
    hrefs = re.findall(r'href=[\'"](https?://[^\'"\s]+)[\'"]', html)
    outbound_links = []
    has_our_link = False

    for href in hrefs:
        href = href.rstrip(".,;:!?/")
        # Skip same-domain and social
        if base in href:
            continue
        skip = ["facebook.com", "twitter.com", "instagram.com", "linkedin.com",
                "pinterest.com", "reddit.com", "google.com", "youtube.com",
                "youtu.be", "github.com", "amazon.com"]
        if any(d in href for d in skip):
            continue
        domain = normalize_domain(href)

        if domain_matches_our_site(domain):
            has_our_link = True

        # Collect resource-like links (not tag/taxonomy pages)
        if not re.search(r'/tag/|/category/|/author/|/page/\d+', href):
            outbound_links.append(href)

    # Score how "resource-like" the page is
    resource_signals = [
        r'best\s+\w+\s+tools',
        r'tools\s+(i\s+)?(use|recommend)',
        r'resources?\s+(for|page|list)',
        r'ultimate\s+guide',
        r'toolkit',
        r'curated\s+list',
        r'top\s+\d+\s+',
        r'comparison',
        r'alternatives?\s+to',
        r'vs\.?\s+',
    ]
    resource_score = 0
    for signal in resource_signals:
        if re.search(signal, html, re.IGNORECASE):
            resource_score += 1
    # Bonus for list-like HTML structure
    list_count = len(re.findall(r'<li>', html))
    if list_count > 20:
        resource_score += 2

    return {
        "url": url,
        "title": page_title,
        "base_domain": parsed.netloc,
        "has_our_link": has_our_link,
        "resource_score": resource_score,

        "list_item_count": list_count,
    }

# ─── Outreach template ────────────────────────────────────────────────

def generate_outreach(page, contact_email=None):
    """Generate an outreach email asking to be added to the resource page."""
    domain = page["base_domain"]
    page_url = page["url"]
    page_title = page["title"]

    subject = f"Suggestion for your {domain} resource page"

    body = f"""Hi there,

I just came across your resource page at {page_url} — great collection of tools and resources for creators.

I noticed you're listing various YouTube tools, and I wanted to suggest YT SEO Architect ({OUR_URL}) as a free addition. It's a completely free platform with 17+ tools for YouTube creators:

• AI title optimizer — scores titles before you publish
• Tag generator with relevance scoring
• SEO description writer with timestamps
• Full channel metadata audit
• Bulk tag/title/description updater

The best part: it's 100% free with no limits, no credits, no paid tier. Just useful tools for any creator.

I think your audience would find it genuinely useful. The tool page is here: {OUR_PAGES['tools']}

Happy to provide screenshots or answer any questions.

Best,
THIZA
Founder, YT SEO Architect
{OUR_URL}"""

    return {
        "source_page": page_url,
        "page_title": page_title,
        "site_domain": domain,
        "resource_score": page["resource_score"],
        "broken_url": f"Resource page ({page_title[:50]})",
        "our_replacement": OUR_PAGES["tools"],
        "subject": subject,
        "body": body,
        "contact_email": contact_email or "",  # From scanner extraction or empty for auto-discovery
    }

# ─── Seen tracker ─────────────────────────────────────────────────────

def load_seen():
    if SEEN_DB.exists():
        try:
            return set(json.loads(SEEN_DB.read_text()))
        except (json.JSONDecodeError, KeyError):
            return set()
    return set()

def mark_seen(url):
    seen = load_seen()
    seen.add(url)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SEEN_DB.write_text(json.dumps(sorted(list(seen)), indent=2))

# ─── Status ───────────────────────────────────────────────────────────

def show_status():
    seen = load_seen()
    print(f"\n{'='*60}")
    print(f"RESOURCE PAGE OUTREACH — STATUS")
    print(f"{'='*60}")
    print(f"  Pages processed: {len(seen)}")
    print(f"  Reports directory: {REPORTS_DIR}")

    csv_files = sorted(REPORTS_DIR.glob("resource-opportunities-*.csv"))
    if csv_files:
        print(f"\n  Previous reports:")
        for f in csv_files[-5:]:
            import csv
            with open(f, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                rows = list(reader)
            print(f"    {f.name}  ({len(rows)} opportunities)")

    print(f"{'='*60}\n")
    return True

# ─── Main workflow ────────────────────────────────────────────────────

def run_scan(max_pages=15, min_resource_score=2, output_path=None, dry_run=False):
    if output_path is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = REPORTS_DIR / f"resource-opportunities-{date_str}.csv"

    print(f"\n{'='*60}")
    print(f"RESOURCE PAGE OUTREACH")
    print(f"Finding resource/list pages that could list YT SEO Architect")
    print(f"Our site: {OUR_URL}")
    print(f"{'='*60}\n")

    # Stage 1: Search
    print("🔄 Stage 1: Searching for resource pages...")
    all_results = []
    for i, query in enumerate(SEARCH_QUERIES):
        print(f"  [{i+1}/{len(SEARCH_QUERIES)}] \"{query}\"")
        results = search_ddg(query, max_results=5)
        all_results.extend(results)
        time.sleep(0.5)

    unique_results = list(dict.fromkeys(all_results))
    print(f"  Found {len(unique_results)} unique results\n")

    if not unique_results:
        print("No results found. Try again later.")
        return True

    # Save raw results
    raw_path = REPORTS_DIR / f"resource-raw-results-{datetime.now().strftime('%Y-%m-%d')}.json"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(unique_results, indent=2))

    # Stage 2: Fetch and analyze
    print(f"🔄 Stage 2: Fetching and analyzing up to {max_pages} pages...")
    pages_to_scan = unique_results[:max_pages]
    seen_urls = load_seen()

    page_analyses = []
    fetched_count = 0

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(fetch_page, url): url for url in pages_to_scan}
        for future in as_completed(futures):
            url, html, error = future.result()
            fetched_count += 1

            if error:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — {error}")
                continue

            analysis = analyze_page(html, url)
            # Extract contact email from the page
            contact_email = extract_emails(html, url)
            analysis['contact_email'] = contact_email or ''

            if analysis["resource_score"] >= min_resource_score:
                status = "✅ (has our link)" if analysis["has_our_link"] else "🎯 OPPORTUNITY"
                email_hint = f", email: {contact_email}" if contact_email else ""
                page_analyses.append(analysis)
                print(f"  [{fetched_count}/{len(pages_to_scan)}] {status} {url[:50]}{email_hint}")
                print(f"       Score: {analysis['resource_score']} | Title: {analysis['title'][:50]}")
            else:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — score {analysis['resource_score']} < {min_resource_score}")

    print(f"\n  Analyzed {len(page_analyses)} relevant resource pages\n")

    if not page_analyses:
        print("No relevant resource pages found. Try different queries.")
        return True

    # Stage 3: Filter to pages NOT linking to us
    already_linked = [p for p in page_analyses if p["has_our_link"]]
    missing_pages = [p for p in page_analyses if not p["has_our_link"]]

    if already_linked:
        print(f"  Already link to us: {len(already_linked)} pages")
        for p in already_linked[:5]:
            print(f"    ✅ {p['url'][:70]}")

    print(f"  Missing our link: {len(missing_pages)} pages\n")

    if not missing_pages:
        print("🎉 All scanned resource pages already have our link!")
        return True

    # Stage 4: Generate outreach
    print("🔄 Stage 4: Generating outreach templates...")
    opportunities = []
    skipped_seen = 0

    for page in missing_pages:
        if page["url"] in seen_urls:
            skipped_seen += 1
            continue

        outreach = generate_outreach(page, contact_email=page.get('contact_email', ''))
        opportunities.append(outreach)

        email_hint = f", email: {outreach['contact_email']}" if outreach['contact_email'] else ""
        print(f"\n  --- Opportunity #{len(opportunities)} ---")
        print(f"  Source:  {outreach['source_page']}")
        print(f"  Title:   {outreach['page_title'][:60]}")
        print(f"  Score:   {outreach['resource_score']}{email_hint}")
        print(f"  Subject: {outreach['subject']}")

        if len(opportunities) >= 20:
            print(f"  (Reached limit of 20)\n")
            break

    print(f"\n  New opportunities: {len(opportunities)}")
    print(f"  Skipped (seen): {skipped_seen}\n")

    if not opportunities:
        print("No new opportunities found.")
        return True

    # Stage 5: Save to CSV
    if not dry_run:
        import csv
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "source_page", "broken_url", "page_title", "site_domain",
                "resource_score", "our_replacement", "subject", "body",
                "contact_email",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for opp in opportunities:
                writer.writerow(opp)

        # Mark as seen
        for opp in opportunities:
            mark_seen(opp["source_page"])

        print(f"  Saved to: {output_path}")
        print(f"  Marked {len(opportunities)} as processed\n")

    # Summary
    print(f"{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Pages searched:    {len(unique_results)}")
    print(f"  Pages fetched:     {len(pages_to_scan)}")
    print(f"  Relevant pages:    {len(page_analyses)}")
    print(f"  Already link to us: {len(already_linked)}")
    print(f"  Missing our link:  {len(missing_pages)}")
    print(f"  New opportunities: {len(opportunities)}")
    print(f"  Output:            {output_path if not dry_run else '(dry run)'}")
    print(f"{'='*60}\n")

    if opportunities:
        print(f"Next steps:")
        print(f"1. Review CSV: {output_path}")
        print(f"2. Send outreach: python3 scripts/backlink-outreach-sender.py --file \"{output_path}\"")
        print(f"3. Or preview first: python3 scripts/backlink-outreach-sender.py --file \"{output_path}\" --dry-run")
        print(f"")
        print(f"Expected response rate: 10-20% for resource page requests")
        print(f"Typical result: 2-4 backlinks from 20 outreach attempts\n")

    return True

def main():
    parser = argparse.ArgumentParser(
        description="Find resource/list pages that could link to YT SEO Architect, and generate outreach"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--search", action="store_true", help="Search phase only (debug)")
    parser.add_argument("--output", help="Custom CSV output path")
    parser.add_argument("--pages", type=int, default=15, help="Max pages to analyze (default: 15)")
    parser.add_argument("--min-score", type=int, default=2, help="Min resource score (default: 2)")
    parser.add_argument("--status", action="store_true", help="Show stats")

    args = parser.parse_args()

    if args.status:
        return show_status()

    # If --search flag, just search and save raw results, don't analyze
    if args.search:
        from datetime import datetime
        print(f"\n{'='*60}")
        print(f"RESOURCE PAGE OUTREACH — SEARCH MODE")
        print(f"{'='*60}\n")
        print("🔄 Searching for resource pages...")
        all_results = []
        for i, query in enumerate(SEARCH_QUERIES):
            print(f"  [{i+1}/{len(SEARCH_QUERIES)}] \"{query}\"")
            results = search_ddg(query, max_results=5)
            all_results.extend(results)
            time.sleep(0.5)
        unique = list(dict.fromkeys(all_results))
        raw_path = REPORTS_DIR / f"resource-raw-results-{datetime.now().strftime('%Y-%m-%d')}.json"
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(json.dumps(unique, indent=2))
        print(f"\n  Found {len(unique)} unique results.")
        print(f"  Saved to: {raw_path}")
        print(f"  Run without --search to analyze these results.\n")
        return True

    return run_scan(
        max_pages=args.pages,
        min_resource_score=args.min_score,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
