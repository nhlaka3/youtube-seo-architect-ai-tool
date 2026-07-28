#!/usr/bin/env python3
"""
scripts/skyscraper-technique.py

Skyscraper Technique Scanner — Find pages linking to premium competitor
tools (TubeBuddy, vidIQ, Morningfame) and pitch YT SEO Architect as
a FREE alternative with equivalent or better features.

Strategy:
1. Find top resource pages that link to competitor tools
2. Check if they already link to us
3. If not → generate outreach suggesting our FREE tool as an addition
4. Same CSV format as other scanners → compatible with backlink-outreach-sender.py

Usage:
  python3 scripts/skyscraper-technique.py                        # Full scan
  python3 scripts/skyscraper-technique.py --dry-run               # Preview only
  python3 scripts/skyscraper-technique.py --output custom.csv     # Custom output
  python3 scripts/skyscraper-technique.py --status                # Show stats

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
SEEN_DB = REPORTS_DIR / "skyscraper-seen.json"

USER_AGENT = "Mozilla/5.0 (compatible; SkyscraperBot/1.0; +https://yt-seo-architect.vercel.app)"
OUR_URL = "https://yt-seo-architect.vercel.app"
REQUEST_TIMEOUT = 12

OUR_DOMAINS = [
    "yt-seo-architect.vercel.app",
    "youtube-seo-architect.vercel.app",
    "youtube-seo-tool.vercel.app",
]

# Competitor tools to look for on resource pages
COMPETITOR_TOOLS = [
    "tubebuddy",
    "vidiq",
    "morningfame",
    "vidooly",
    "socialblade",
    "vidiq.com",
    "tubebuddy.com",
    "morningfame.com",
    "socialblade.com",
]

OUR_PITCH_PAGES = {
    "dashboard": f"{OUR_URL}/dashboard",
    "tools": f"{OUR_URL}/tools",
    "tag-generator": f"{OUR_URL}/tools/tag-generator",
    "keyword-research": f"{OUR_URL}/tools/keyword-research",
    "title-optimizer": f"{OUR_URL}/tools/title-optimizer",
    "description-writer": f"{OUR_URL}/tools/description-writer",
    "audit": f"{OUR_URL}/tools/youtube-seo-audit-diagnostic-fix-2026",
}

FALLBACK_PAGES = [
    # Known pages that link to competitor tools (from past scan data)
    "https://contentmavericks.com/best-youtube-seo-tools/",
    "https://vidiq.com/youtube-seo-tools/",
    "https://www.youngurbanproject.com/youtube-seo-tools/",
    "https://rankxdigital.com/blog/youtube-seo-tools/",
    "https://syscality.com/best-seo-tools-for-youtube/",
    "https://tuberanker.com/",
    "https://www.tastyedits.com/youtube-seo-tools/",
    "https://thecmo.com/tools/youtube-seo-tools/",
    "https://joseangelostudios.com/best-youtube-seo-tools/",
    "https://impressivemagazine.com/best-youtube-seo-tools-2026/",
    "https://stuartkerrs.com/best-seo-tools-for-youtube/",
    "https://blog.hubspot.com/marketing/youtube-seo-tools",
    "https://backlinko.com/youtube-seo-tools",
    "https://neilpatel.com/blog/youtube-seo-tools/",
    "https://influencermarketinghub.com/youtube-seo-tools/",
    "https://www.shopify.com/blog/youtube-tools",
    "https://noxinfluencer.com/blog/youtube-tools/",
    "https://www.oberlo.com/blog/youtube-tools",
    "https://ahrefs.com/youtube-keyword-tool",
    "https://prnews.io/blog/youtube-tools/",
    "https://alternative.me/youtube-seo",
    "https://www.g2.com/categories/youtube-tools",
    "https://zapier.com/blog/best-youtube-tools/",
]

SEARCH_QUERIES = [
    # Broad queries that naturally find competitor-linked pages
    "best youtube seo tools",
    "youtube tools for creators",
    "youtube seo guide tools",
    "youtube keyword research tools",
    "youtube growth tools",
    "youtube analytics tools",
    "youtube thumbnail maker",
    "youtube tag generator tools",
    "youtube description generator",
    "tools i use for youtube",
    "best free youtube tools",
    "youtube seo comparison",
    "youtube optimization tools",
    "tools to grow youtube channel",
    "youtube creator toolkit",
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
    """Extract contact emails from page HTML."""
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


def fetch_page(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            return (url, html, None)
    except Exception as e:
        return (url, "", str(e)[:100])


def analyze_page(html, url):
    """Check if a page links to any competitor tools and whether it links to us."""
    parsed = urllib.parse.urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    page_title = title_match.group(1).strip()[:120] if title_match else ""

    hrefs = re.findall(r'href=[\'"](https?://[^\'"\s]+)[\'"]', html)
    has_our_link = False
    competitor_links_found = []

    for href in hrefs:
        href = href.rstrip(".,;:!?/")
        # Skip same-domain
        if base in href:
            continue
        domain = normalize_domain(href)

        if domain in [normalize_domain(d) for d in OUR_DOMAINS]:
            has_our_link = True

        # Check if links to any competitor tool
        for comp in COMPETITOR_TOOLS:
            if comp in href.lower():
                competitor_links_found.append(href)
                break

    return {
        "url": url,
        "title": page_title,
        "base_domain": parsed.netloc,
        "has_our_link": has_our_link,
        "competitor_links": list(set(competitor_links_found)),
        "total_outbound": len(hrefs),
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


def generate_outreach(page, our_pitch_page=None):
    """Generate outreach email suggesting our free tool as an addition."""
    domain = page["base_domain"]
    page_url = page["url"]
    page_title = page["title"]
    comp_tools = page["competitor_links"][:3]

    # Manual name mapping for cleaner display
    COMPETITOR_NAMES = {
        "tubebuddy": "TubeBuddy",
        "tubebuddy.com": "TubeBuddy",
        "vidiq": "vidIQ",
        "vidiq.com": "vidIQ",
        "morningfame": "Morningfame",
        "morningfame.com": "Morningfame",
        "socialblade": "Social Blade",
        "socialblade.com": "Social Blade",
    }
    comp_names = []
    for ct in comp_tools:
        ct_domain = normalize_domain(ct)
        name = COMPETITOR_NAMES.get(ct_domain, ct_domain.split(".")[0].capitalize())
        comp_names.append(name)

    comp_text = ", ".join(comp_names) if comp_names else "premium tools"

    subject = f"Free alternative to {comp_text} for your readers"

    body = f"""Hi there,

I just came across your excellent resource at {page_url} — great collection of tools for YouTube creators.

I noticed you're listing {comp_text} as recommendations for your readers. Love those tools, but I wanted to suggest a free alternative that many creators don't know about yet:

YT SEO Architect ({OUR_URL}) is a completely free platform with 17+ YouTube SEO tools:

• AI Title Optimizer — scores titles before you publish
• Tag Generator with relevance scoring
• SEO Description Writer with timestamp formatting
• Full Channel Metadata Audit
• Bulk Tag/Title/Description Updater
• Keyword Research Tool with search volume data

The best part: it's 100% free with no limits, no credits, no paid tier. Just useful tools for any creator.

Your audience would love having a free option alongside the premium tools you already recommend. Here's the tool page: {OUR_PITCH_PAGES['tools']}

Happy to provide more details or screenshots if helpful.

Best,
THIZA
Founder, YT SEO Architect
{OUR_URL}"""

    return {
        "source_page": page_url,
        "page_title": page_title,
        "site_domain": domain,
        "competitor_tools": ", ".join(normalize_domain(h) for h in comp_tools),
        "broken_url": f"Competitor tools page ({page_title[:50]})",
        "our_replacement": our_pitch_page or OUR_PITCH_PAGES["tools"],
        "subject": subject,
        "body": body,
        "contact_email": page.get("contact_email", ""),
    }


def show_status():
    seen = load_seen()
    print(f"\n{'='*60}")
    print(f"SKYSCRAPER TECHNIQUE — STATUS")
    print(f"{'='*60}")
    print(f"  Pages processed: {len(seen)}")
    csv_files = sorted(REPORTS_DIR.glob("skyscraper-opportunities-*.csv"))
    if csv_files:
        print(f"\n  Previous reports:")
        for f in csv_files[-5:]:
            with open(f, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                rows = list(reader)
            print(f"    {f.name}  ({len(rows)} opportunities)")
    print(f"{'='*60}\n")
    return True


def run_scan(max_pages=15, output_path=None, dry_run=False):
    if output_path is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = REPORTS_DIR / f"skyscraper-opportunities-{date_str}.csv"

    print(f"\n{'='*60}")
    print(f"SKYSCRAPER TECHNIQUE SCANNER")
    print(f"Finding pages that link to competitor tools but not to us")
    print(f"Our site: {OUR_URL}")
    print(f"{'='*60}\n")

    # Stage 1: Search
    print("🔄 Stage 1: Searching for competitor-linking pages...")
    all_results = []
    for i, query in enumerate(SEARCH_QUERIES):
        print(f"  [{i+1}/{len(SEARCH_QUERIES)}] \"{query}\"")
        results = search_ddg(query, max_results=5)
        all_results.extend(results)
        time.sleep(0.5)

    unique_results = list(dict.fromkeys(all_results))
    print(f"  Found {len(unique_results)} unique results\n")

    # Fallback: if DDG returns 0, use curated fallback list
    if not unique_results:
        print("  DDG returned 0. Using curated fallback list...")
        unique_results = FALLBACK_PAGES[:max_pages * 2]
        print(f"  Using {len(unique_results)} fallback pages\n")

    if not unique_results:
        print("  No pages to scan.")
        return True

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

            # Only keep if they link to competitor tools
            if analysis["competitor_links"]:
                status = "✅ (has our link)" if analysis["has_our_link"] else "🎯 OPPORTUNITY"
                email_hint = f", email: {contact_email}" if contact_email else ""
                comp_hint = f", tools: {analysis['competitor_links'][0][:40]}"
                page_analyses.append(analysis)
                print(f"  [{fetched_count}/{len(pages_to_scan)}] {status} {url[:50]}{email_hint}{comp_hint}")
            else:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — no competitor links")

    print(f"\n  Found {len(page_analyses)} pages linking to competitors\n")

    if not page_analyses:
        print("No pages found that link to competitor tools.")
        return True

    # Stage 3: Filter
    already_linked = [p for p in page_analyses if p["has_our_link"]]
    missing_pages = [p for p in page_analyses if not p["has_our_link"]]

    if already_linked:
        print(f"  Already link to us: {len(already_linked)} pages")
        for p in already_linked[:3]:
            print(f"    ✅ {p['url'][:70]}")

    print(f"  Missing our link: {len(missing_pages)} pages\n")

    if not missing_pages:
        print("🎉 All competitor-linking pages already have our link!")
        return True

    # Stage 4: Generate outreach
    print("🔄 Stage 4: Generating outreach templates...")
    opportunities = []
    skipped_seen = 0

    for page in missing_pages:
        if page["url"] in seen_urls:
            skipped_seen += 1
            continue

        outreach = generate_outreach(page)
        opportunities.append(outreach)

        email_hint = f", email: {outreach['contact_email']}" if outreach['contact_email'] else ""
        comp_hint = f", tools: {outreach['competitor_tools'][:40]}"
        print(f"\n  --- Opportunity #{len(opportunities)} ---")
        print(f"  Source:  {outreach['source_page']}")
        print(f"  Title:   {outreach['page_title'][:60]}")
        print(f"  Competitor tools: {outreach['competitor_tools'][:60]}{email_hint}")
        print(f"  Subject: {outreach['subject']}")

        if len(opportunities) >= 10:
            print(f"  (Reached limit of 10)\n")
            break

    print(f"\n  New opportunities: {len(opportunities)}")
    print(f"  Skipped (seen): {skipped_seen}\n")

    if not opportunities:
        print("No new opportunities found.")
        return True

    # Stage 5: Save to CSV
    if not dry_run:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "source_page", "broken_url", "page_title", "site_domain",
                "competitor_tools", "our_replacement", "subject", "body",
                "contact_email",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for opp in opportunities:
                writer.writerow(opp)

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
    print(f"  Competitor pages:  {len(page_analyses)}")
    print(f"  Already link to us: {len(already_linked)}")
    print(f"  Missing our link:  {len(missing_pages)}")
    print(f"  New opportunities: {len(opportunities)}")
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
        description="Find pages linking to competitor tools and pitch our free alternative"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--output", help="Custom CSV output path")
    parser.add_argument("--pages", type=int, default=15, help="Max pages to analyze (default: 15)")
    parser.add_argument("--status", action="store_true", help="Show stats")
    args = parser.parse_args()

    if args.status:
        return show_status()

    return run_scan(
        max_pages=args.pages,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
