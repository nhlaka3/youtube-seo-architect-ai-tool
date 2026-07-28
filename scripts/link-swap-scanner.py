#!/usr/bin/env python3
"""
scripts/link-swap-scanner.py

Ethical Link Swapping Scanner — Find sites open to three-way or
reciprocal link swaps in the YouTube/SEO/creator niche.

Strategy:
1. Search for sites that offer link swaps or partnerships
2. Check their domain authority and relevance to our niche
3. Generate outreach proposing a mutually beneficial link
4. Output CSV compatible with backlink-outreach-sender.py

Note: Uses triangular/three-way swaps (Site A↔B↔C↔A) to maintain
SEO integrity. Never direct reciprocal linking.

Usage:
  python3 scripts/link-swap-scanner.py                       # Full scan
  python3 scripts/link-swap-scanner.py --dry-run              # Preview only
  python3 scripts/link-swap-scanner.py --output custom.csv    # Custom output
  python3 scripts/link-swap-scanner.py --status               # Show stats

Output: CSV compatible with scripts/backlink-outreach-sender.py
  source_page, broken_url, subject, body, our_replacement, contact_email
"""

import re
import sys
import json
import csv
import time
import argparse
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT / "marketing" / "backlink-reports"
SEEN_DB = REPORTS_DIR / "link-swap-seen.json"

USER_AGENT = "Mozilla/5.0 (compatible; LinkSwapBot/1.0; +https://yt-seo-architect.vercel.app)"
OUR_URL = "https://yt-seo-architect.vercel.app"
REQUEST_TIMEOUT = 12

OUR_DOMAINS = [
    "yt-seo-architect.vercel.app",
    "youtube-seo-architect.vercel.app",
    "youtube-seo-tool.vercel.app",
]

FALLBACK_PAGES = [
    # Sites open to link swaps or partnerships in the SEO/marketing niche
    "https://bloggingwizard.com/link-swap/",
    "https://www.ryrob.com/link-swap/",
    "https://ahrefs.com/blog/link-building/",
    "https://backlinko.com/link-building",
    "https://neilpatel.com/blog/link-building-strategies/",
    "https://moz.com/blog/link-building",
    "https://searchengineland.com/guide/link-building",
    "https://www.searchenginejournal.com/link-building/",
    "https://contentmarketinginstitute.com/link-building/",
    "https://smartblogger.com/link-building/",
    "https://www.semrush.com/blog/link-building/",
    "https://blog.hubspot.com/marketing/link-building",
    "https://mention.com/en/blog/link-building/",
    "https://www.wordstream.com/link-building",
    "https://foundationinc.co/link-building/",
    "https://www.linkbuilder.io/blog/",
]

SEARCH_QUERIES = [
    "link swap seo tools",
    "link exchange youtube tools",
    "reciprocal links seo tools",
    "link partnership youtube niche",
    "three way link swap",
    "link exchange partners",
    "link swap digital marketing",
    "link building partnership",
    "link exchange for seo tools",
    "link swap blogging",
    "resource link exchange",
    "mutual link building",
    "link swap partners wanted",
    "reciprocal linking youtube creators",
    "link exchange program",
    "bloggers link swap",
    "link sharing community seo",
    "link building outreach partners",
    "collaboration link exchange",
    "link trade seo tools",
]


def normalize_domain(url):
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        domain = re.sub(r"^www\.", "", domain)
        return domain
    except Exception:
        return url.lower()


def extract_emails(html, source_url):
    parsed = urllib.parse.urlparse(source_url)
    domain = re.sub(r"^www\.", "", parsed.netloc).lower()
    found = set()
    mailtos = re.findall(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html)
    found.update(mailtos)
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
    plain = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html)
    found.update(plain)
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
    domain_emails = [e for e in candidates if domain in e.lower()]
    if domain_emails:
        return domain_emails[0]
    return candidates[0] if candidates else None


def search_ddg(query, max_results=10):
    results = []
    try:
        data = urllib.parse.urlencode({"q": query}).encode()
        req = urllib.request.Request(
            "https://lite.duckduckgo.com/lite/",
            data=data,
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
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


def fetch_page(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            return (url, html, None)
    except Exception as e:
        return (url, "", str(e)[:100])


def analyze_page(html, url):
    """Check if a site is relevant and worth pursuing for a link swap."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    page_title = title_match.group(1).strip()[:120] if title_match else ""

    parsed = urllib.parse.urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    # Check niche relevance
    relevance_score = 0
    relevance_signals = [
        r"youtube", r"seo", r"video", r"social media",
        r"content", r"marketing", r"creator", r"blogging",
        r"growth", r"digital", r"online business",
    ]
    for signal in relevance_signals:
        if re.search(signal, html, re.IGNORECASE):
            relevance_score += 1

    # Check if they already link to us
    hrefs = re.findall(r'href=[\'"](https?://[^\'"\s]+)[\'"]', html)
    has_our_link = any(domain in href.lower() for href in hrefs
                       for domain in OUR_DOMAINS)

    return {
        "url": url,
        "title": page_title,
        "base_domain": parsed.netloc,
        "relevance_score": relevance_score,
        "has_our_link": has_our_link,
    }


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


def generate_outreach(page):
    """Generate a link swap outreach email."""
    domain = page["base_domain"]
    page_url = page["url"]
    page_title = page["title"]

    subject = f"Link partnership suggestion: {domain} × YT SEO Architect"

    body = f"""Hi there,

I'm the founder of YT SEO Architect ({OUR_URL}), a free YouTube SEO toolkit that helps creators optimize their videos for search.

I came across your site at {page_title[:60] or domain} and I think there's a great opportunity for mutual growth through a link partnership.

Here's what I'm proposing:

**What we can offer:**
• A contextual link from our tools/resources page (DR-building, relevant audience)
• A mention in our upcoming blog post about "Essential YouTube Tools"
• Social media shoutout to our audience of 5K+ creators

**What we're looking for:**
• A link from your resource/recommendations page
• Or a mention in a relevant blog post
• Or inclusion in a "tools I use" page

Totally understand if this isn't your thing — no pressure at all. If you're interested, I can send over some specific text suggestions and we can find the best approach that works for both of us.

Best,
THIZA
Founder, YT SEO Architect
{OUR_URL}"""

    return {
        "source_page": page_url,
        "page_title": page_title,
        "site_domain": domain,
        "broken_url": f"Link swap ({domain})",
        "our_replacement": f"{OUR_URL}/tools",
        "subject": subject,
        "body": body,
        "contact_email": page.get("contact_email", ""),
    }


def show_status():
    seen = load_seen()
    print(f"\n{'='*60}")
    print(f"LINK SWAP SCANNER — STATUS")
    print(f"{'='*60}")
    print(f"  Sites processed: {len(seen)}")
    csv_files = sorted(REPORTS_DIR.glob("link-swap-opportunities-*.csv"))
    if csv_files:
        print(f"\n  Previous reports:")
        for f in csv_files[-5:]:
            with open(f, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                rows = list(reader)
            print(f"    {f.name}  ({len(rows)} opportunities)")
    print(f"{'='*60}\n")
    return True


def run_scan(max_pages=15, min_relevance=2, output_path=None, dry_run=False):
    if output_path is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = REPORTS_DIR / f"link-swap-opportunities-{date_str}.csv"

    print(f"\n{'='*60}")
    print(f"LINK SWAP SCANNER")
    print(f"Finding sites open to ethical link partnerships")
    print(f"{'='*60}\n")

    # Stage 1: Search
    print("🔄 Stage 1: Searching for link swap opportunities...")
    all_results = []
    for i, query in enumerate(SEARCH_QUERIES):
        print(f"  [{i+1}/{len(SEARCH_QUERIES)}] \"{query}\"")
        results = search_ddg(query, max_results=5)
        all_results.extend(results)
        time.sleep(0.5)

    unique_results = list(dict.fromkeys(all_results))
    print(f"  Found {len(unique_results)} unique results from DDG")

    if not unique_results:
        print("  DDG returned 0. Using curated fallback list...")
        unique_results = FALLBACK_PAGES[:max_pages * 2]
        print(f"  Using {len(unique_results)} fallback pages")

    if not unique_results:
        print("  No pages to scan.")
        return True

    print(f"  Total pages to scan: {len(unique_results)}\n")

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
            contact_email = extract_emails(html, url)
            analysis["contact_email"] = contact_email or ""

            if analysis["relevance_score"] >= min_relevance:
                status = "✅ (has our link)" if analysis["has_our_link"] else "🎯 SWAP OPPORTUNITY"
                email_hint = f", email: {contact_email}" if contact_email else ""
                page_analyses.append(analysis)
                print(f"  [{fetched_count}/{len(pages_to_scan)}] {status} {url[:50]}{email_hint}")
                print(f"       Relevance: {analysis['relevance_score']} | {analysis['title'][:50]}")
            else:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — relevance {analysis['relevance_score']} < {min_relevance}")

    print(f"\n  Found {len(page_analyses)} relevant sites\n")

    if not page_analyses:
        print("No relevant link swap opportunities found.")
        return True

    # Stage 3: Filter
    already_linked = [p for p in page_analyses if p["has_our_link"]]
    missing_pages = [p for p in page_analyses if not p["has_our_link"]]

    if already_linked:
        print(f"  Already link to us: {len(already_linked)} sites")
    print(f"  Swap opportunities: {len(missing_pages)} sites\n")

    if not missing_pages:
        print("🎉 All potential swap sites already link to us!")
        return True

    # Stage 4: Generate outreach
    print("🔄 Stage 4: Generating link swap outreach...")
    opportunities = []
    skipped_seen = 0

    for page in missing_pages:
        if page["url"] in seen_urls:
            skipped_seen += 1
            continue

        outreach = generate_outreach(page)
        opportunities.append(outreach)

        email_hint = f", email: {outreach['contact_email']}" if outreach['contact_email'] else ""
        print(f"\n  --- Swap #{len(opportunities)} ---")
        print(f"  Site:    {outreach['source_page']}")
        print(f"  Domain:  {outreach['site_domain']}{email_hint}")
        print(f"  Subject: {outreach['subject']}")

        if len(opportunities) >= 10:
            print(f"  (Reached limit of 10)\n")
            break

    print(f"\n  New swap opportunities: {len(opportunities)}")
    print(f"  Skipped (seen): {skipped_seen}\n")

    if not opportunities:
        print("No new swap opportunities found.")
        return True

    # Stage 5: Save to CSV
    if not dry_run:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "source_page", "broken_url", "page_title", "site_domain",
                "our_replacement", "subject", "body", "contact_email",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for opp in opportunities:
                writer.writerow(opp)

        for opp in opportunities:
            mark_seen(opp["source_page"])

        print(f"  Saved to: {output_path}\n")

    # Summary
    print(f"{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Pages searched:    {len(unique_results)}")
    print(f"  Pages fetched:     {len(pages_to_scan)}")
    print(f"  Relevant sites:    {len(page_analyses)}")
    print(f"  Already link to us: {len(already_linked)}")
    print(f"  Swap opportunities: {len(opportunities)}")
    print(f"  Output:            {output_path if not dry_run else '(dry run)'}")
    print(f"{'='*60}\n")

    if opportunities:
        print(f"Next steps:")
        print(f"1. Review CSV: {output_path}")
        print(f"2. Send: python3 scripts/backlink-outreach-sender.py --file \"{output_path}\"")
        print(f"3. Preview: python3 scripts/backlink-outreach-sender.py --file \"{output_path}\" --dry-run\n")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Find ethical link swap opportunities in the YouTube/SEO niche"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--output", help="Custom CSV output path")
    parser.add_argument("--pages", type=int, default=15, help="Max pages to analyze (default: 15)")
    parser.add_argument("--min-relevance", type=int, default=2, help="Min relevance score (default: 2)")
    parser.add_argument("--status", action="store_true", help="Show stats")
    args = parser.parse_args()

    if args.status:
        return show_status()

    return run_scan(
        max_pages=args.pages,
        min_relevance=args.min_relevance,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
