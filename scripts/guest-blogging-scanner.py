#!/usr/bin/env python3
"""
scripts/guest-blogging-scanner.py

Guest Blogging Scanner — Find blogs and publications that accept guest
posts in the YouTube/SEO/creator niche and generate outreach pitches.

Strategy:
1. Search for sites that accept guest posts about YouTube/content creation
2. Check if they've published content similar to what we offer (SEO tools)
3. Generate a pitch offering to write a unique article
4. Output CSV compatible with backlink-outreach-sender.py

Usage:
  python3 scripts/guest-blogging-scanner.py                     # Full scan
  python3 scripts/guest-blogging-scanner.py --dry-run            # Preview only
  python3 scripts/guest-blogging-scanner.py --output custom.csv  # Custom output
  python3 scripts/guest-blogging-scanner.py --status             # Show stats

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
SEEN_DB = REPORTS_DIR / "guest-blog-seen.json"

USER_AGENT = "Mozilla/5.0 (compatible; GuestBlogBot/1.0; +https://yt-seo-architect.vercel.app)"
OUR_URL = "https://yt-seo-architect.vercel.app"
REQUEST_TIMEOUT = 12

OUR_DOMAINS = [
    "yt-seo-architect.vercel.app",
    "youtube-seo-architect.vercel.app",
    "youtube-seo-tool.vercel.app",
]

FALLBACK_PAGES = [
    # Sites known to accept guest posts in the YouTube/creator niche
    "https://www.jeffbullas.com/write-for-us/",
    "https://neilpatel.com/blog/guest-post/",
    "https://backlinko.com/guest-posting-guidelines",
    "https://blog.hubspot.com/marketing/guest-blogging-guidelines",
    "https://buffer.com/resources/guest-posting/",
    "https://later.com/blog/guest-post/",
    "https://www.socialmediaexaminer.com/write-for-us/",
    "https://hootsuite.com/about/guest-contributors",
    "https://sproutsocial.com/insights/guest-contributor/",
    "https://coschedule.com/blog/write-for-us",
    "https://www.semrush.com/blog/write-for-us/",
    "https://moz.com/blog/write-for-us",
    "https://searchengineland.com/write-for-us",
    "https://searchenginejournal.com/write-for-us/",
    "https://www.wordstream.com/guest-posting",
    "https://bloggingwizard.com/write-for-us/",
    "https://www.ryrob.com/guest-post/",
    "https://ahrefs.com/blog/guest-post/",
    "https://mention.com/en/blog/write-for-us/",
]

SEARCH_QUERIES = [
    "write for us youtube seo",
    "guest post youtube tools",
    "write for us youtube creator",
    "guest post youtube marketing",
    "write for us content creation",
    "submit guest post video marketing",
    "write for us social media",
    "guest posting guidelines seo tools",
    "write for us digital marketing",
    "become a contributor youtube",
    "guest post guidelines content marketing",
    "write for us online marketing",
    "submit article youtube growth",
    "write for us video seo",
    "guest author youtube tips",
]

OUR_PITCH_ANGLES = {
    "article1": {
        "title": "10 Free YouTube SEO Tools That Actually Work in 2026",
        "desc": "A comprehensive roundup of free tools with real testing data",
    },
    "article2": {
        "title": "The Complete Guide to YouTube Metadata Optimization",
        "desc": "Step-by-step guide covering titles, tags, descriptions, thumbnails",
    },
    "article3": {
        "title": "How to Rank Your YouTube Videos in 2026: A Data-Driven Approach",
        "desc": "SEO strategies backed by analysis of 100K+ videos",
    },
    "article4": {
        "title": "YouTube SEO vs Traditional SEO: What Creators Need to Know",
        "desc": "Comparison of ranking factors and optimization strategies",
    },
    "article5": {
        "title": "Why Your YouTube Videos Aren't Getting Found (And How to Fix It)",
        "desc": "Common metadata mistakes and how to fix them",
    },
}


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
    """Check if a page accepts guest posts and is relevant to our niche."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    page_title = title_match.group(1).strip()[:120] if title_match else ""

    parsed = urllib.parse.urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    guest_post_signals = [
        r"write for us",
        r"guest post",
        r"guest blogging",
        r"submit (a )?(guest )?post",
        r"become (a )?contributor",
        r"guest author",
        r"contribute to",
        r"submission guidelines",
        r"pitch (an? )?article",
        r"write for",
    ]

    score = 0
    for signal in guest_post_signals:
        if re.search(signal, html, re.IGNORECASE):
            score += 2

    # Check if site covers topics relevant to us
    relevance_signals = [
        r"youtube", r"seo", r"social media", r"content marketing",
        r"video", r"digital marketing", r"creator", r"blogging",
    ]
    for signal in relevance_signals:
        if re.search(signal, html, re.IGNORECASE):
            score += 1

    # Check if already linking to us
    hrefs = re.findall(r'href=[\'"](https?://[^\'"\s]+)[\'"]', html)
    has_our_link = any(domain in href.lower() for href in hrefs
                       for domain in OUR_DOMAINS)

    return {
        "url": url,
        "title": page_title,
        "base_domain": parsed.netloc,
        "guest_post_score": score,
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


def generate_outreach(page, pitch_angle="article1"):
    """Generate a guest post pitch."""
    domain = page["base_domain"]
    page_url = page["url"]
    page_title = page["title"]
    pitch = OUR_PITCH_ANGLES.get(pitch_angle, OUR_PITCH_ANGLES["article1"])

    subject = f"Guest post idea for {domain}: {pitch['title']}"

    body = f"""Hi there,

I'm a regular reader of {page_title or domain} and I've noticed your content around YouTube and content creation — great stuff!

I'd love to contribute a guest post that I think your audience would find valuable:

**{pitch['title']}**

{pitch['desc']}

As the founder of YT SEO Architect ({OUR_URL}), a free YouTube SEO toolkit used by thousands of creators, I've gathered unique data and insights on how YouTube metadata affects search rankings and discoverability.

The article would include:
• Original data from our platform's analysis of 100K+ videos
• Actionable tips that readers can implement immediately
• Screenshots and examples from real YouTube channels
• A no-nonsense approach (no fluff, just what works)

If this sounds interesting, I'm happy to tailor it to your audience and editorial style. I can also suggest alternative topics if this doesn't fit.

Best,
THIZA
Founder, YT SEO Architect
{OUR_URL}

PS: I've written for other publications in the space and can share writing samples if helpful."""

    return {
        "source_page": page_url,
        "page_title": page_title,
        "site_domain": domain,
        "pitch_title": pitch["title"],
        "broken_url": f"Guest post pitch ({pitch['title'][:50]})",
        "our_replacement": OUR_URL,
        "subject": subject,
        "body": body,
        "contact_email": page.get("contact_email", ""),
    }


def show_status():
    seen = load_seen()
    print(f"\n{'='*60}")
    print(f"GUEST BLOGGING SCANNER — STATUS")
    print(f"{'='*60}")
    print(f"  Sites processed: {len(seen)}")
    csv_files = sorted(REPORTS_DIR.glob("guest-blog-opportunities-*.csv"))
    if csv_files:
        print(f"\n  Previous reports:")
        for f in csv_files[-5:]:
            with open(f, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                rows = list(reader)
            print(f"    {f.name}  ({len(rows)} opportunities)")
    print(f"{'='*60}\n")
    return True


def run_scan(max_pages=15, min_score=3, output_path=None, dry_run=False):
    if output_path is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = REPORTS_DIR / f"guest-blog-opportunities-{date_str}.csv"

    print(f"\n{'='*60}")
    print(f"GUEST BLOGGING SCANNER")
    print(f"Finding sites that accept guest posts in the YouTube/SEO niche")
    print(f"{'='*60}\n")

    # Stage 1: Search
    print("🔄 Stage 1: Searching for guest posting opportunities...")
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

            if analysis["guest_post_score"] >= min_score:
                status = "✅ (has our link)" if analysis["has_our_link"] else "🎯 PITCH OPPORTUNITY"
                email_hint = f", email: {contact_email}" if contact_email else ""
                page_analyses.append(analysis)
                print(f"  [{fetched_count}/{len(pages_to_scan)}] {status} {url[:50]}{email_hint}")
                print(f"       Score: {analysis['guest_post_score']} | {analysis['title'][:50]}")
            else:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — score {analysis['guest_post_score']} < {min_score}")

    print(f"\n  Found {len(page_analyses)} relevant guest post sites\n")

    if not page_analyses:
        print("No relevant guest posting opportunities found.")
        return True

    # Stage 3: Filter
    already_linked = [p for p in page_analyses if p["has_our_link"]]
    missing_pages = [p for p in page_analyses if not p["has_our_link"]]

    if already_linked:
        print(f"  Already link to us: {len(already_linked)} sites")
    print(f"  Guest post opportunities: {len(missing_pages)} sites\n")

    if not missing_pages:
        print("🎉 All guest post sites already link to us!")
        return True

    # Stage 4: Generate outreach
    print("🔄 Stage 4: Generating guest post pitches...")
    opportunities = []
    skipped_seen = 0

    pitch_angles = list(OUR_PITCH_ANGLES.keys())
    for idx, page in enumerate(missing_pages):
        if page["url"] in seen_urls:
            skipped_seen += 1
            continue

        # Rotate pitch angles so each site gets a different topic
        pitch_key = pitch_angles[idx % len(pitch_angles)]
        outreach = generate_outreach(page, pitch_angle=pitch_key)
        opportunities.append(outreach)

        email_hint = f", email: {outreach['contact_email']}" if outreach['contact_email'] else ""
        print(f"\n  --- Pitch #{len(opportunities)} ---")
        print(f"  Site:    {outreach['source_page']}")
        print(f"  Topic:   {outreach['pitch_title']}{email_hint}")
        print(f"  Subject: {outreach['subject']}")

        if len(opportunities) >= 10:
            print(f"  (Reached limit of 10)\n")
            break

    print(f"\n  New pitches: {len(opportunities)}")
    print(f"  Skipped (seen): {skipped_seen}\n")

    if not opportunities:
        print("No new guest posting opportunities found.")
        return True

    # Stage 5: Save to CSV
    if not dry_run:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "source_page", "broken_url", "page_title", "site_domain",
                "pitch_title", "our_replacement", "subject", "body",
                "contact_email",
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
    print(f"  Guest post sites:  {len(page_analyses)}")
    print(f"  Already link to us: {len(already_linked)}")
    print(f"  Pitch opportunities: {len(opportunities)}")
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
        description="Find guest posting opportunities in the YouTube/SEO niche"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--output", help="Custom CSV output path")
    parser.add_argument("--pages", type=int, default=15, help="Max pages to analyze (default: 15)")
    parser.add_argument("--min-score", type=int, default=3, help="Min guest post score (default: 3)")
    parser.add_argument("--status", action="store_true", help="Show stats")
    args = parser.parse_args()

    if args.status:
        return show_status()

    return run_scan(
        max_pages=args.pages,
        min_score=args.min_score,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
