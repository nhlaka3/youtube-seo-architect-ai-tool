#!/usr/bin/env python3
"""
scripts/competitor-backlink-replicator.py

Competitor Backlink Replicator — Find sites that link to YouTube SEO tool
competitors (vidIQ, TubeBuddy, etc.) but NOT to YT SEO Architect, then
generate personalized outreach emails for inclusion.

Strategy: Sites already listing YouTube SEO tools are warm leads.
They've already shown interest in the category. You just need to show
them why your tool deserves a spot alongside the competition.

Usage:
  python3 scripts/competitor-backlink-replicator.py                    # Run full scan
  python3 scripts/competitor-backlink-replicator.py --dry-run          # Preview only
  python3 scripts/competitor-backlink-replicator.py --search           # Search phase only
  python3 scripts/competitor-backlink-replicator.py --output file.csv  # Custom output
  python3 scripts/competitor-backlink-replicator.py --pages 20         # More results
  python3 scripts/competitor-backlink-replicator.py --min-links 3      # Min competitor links
  python3 scripts/competitor-backlink-replicator.py --status           # Show stats

Output: CSV compatible with scripts/backlink-outreach-sender.py
  Source page, target domain, which competitors they link to, our suggested page

No API keys needed — uses DuckDuckGo Lite for search + direct HTTP fetching.
"""

import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT / "marketing" / "backlink-reports"
SEEN_DB = REPORTS_DIR / "competitor-replicator-seen.json"

USER_AGENT = "Mozilla/5.0 (compatible; CompetitorReplicator/1.0; +https://yt-seo-architect.vercel.app)"
OUR_URL = "https://yt-seo-architect.vercel.app"
REQUEST_TIMEOUT = 12

# ─── Competitor definitions ────────────────────────────────────────────
# These are YouTube SEO / growth tools that our target audience knows.
# Sites that link to these are warm leads for our tool too.

COMPETITORS = [
    # Primary competitors (direct YouTube SEO tools)
    {"name": "vidIQ", "domains": ["vidiq.com", "vidiq.com/blog"], "dr": 85},
    {"name": "TubeBuddy", "domains": ["tubebuddy.com", "tubebuddy.com/blog"], "dr": 83},
    {"name": "Morningfame", "domains": ["morningfame.com"], "dr": 65},
    {"name": "Tubics", "domains": ["tubics.com", "tubics.com/blog"], "dr": 62},
    {"name": "KeywordTool.io", "domains": ["keywordtool.io"], "dr": 70},
    {"name": "RapidTags", "domains": ["rapidtags.io", "rapidtags.com"], "dr": 55},
    {"name": "Canva", "domains": ["canva.com", "canva.com/features/youtube-thumbnails"], "dr": 92},
    {"name": "YTCockpit", "domains": ["ytcockpit.com"], "dr": 50},
    # Secondary (blogging/tools that often list YouTube tools)
    {"name": "Buffer", "domains": ["buffer.com"], "dr": 90},
    {"name": "Hootsuite", "domains": ["hootsuite.com"], "dr": 88},
]

# ─── Search queries to find candidate pages ────────────────────────────

SEARCH_QUERIES = [
    # Listicles & comparisons
    "best youtube seo tools",
    "best free youtube seo tools",
    "youtube seo tools 2026",
    "youtube keyword research tools",
    "youtube tag generator tools",
    "best tools for youtube growth",
    "youtube optimization tools",
    "youtube analytics tools",
    "alternatives to vidiq",
    "alternatives to tubebuddy",
    "free alternatives to vidiq",
    "vidiq vs tubebuddy",
    "vidiq alternative free",
    "tubebuddy alternative free",
    # Resource pages
    "youtube tools list",
    "youtube seo resources",
    "tools for youtube creators",
    "youtube marketing tools",
    "best free tools for youtubers",
    "youtube creator toolkit",
    "essential youtube tools",
    "youtube growth tools",
    # Tutorials & guides that mention tools
    "how to optimize youtube videos tools",
    "youtube seo guide tools",
    "youtube thumbnail maker tools",
    "youtube description generator tools",
]

# ─── Our linkable assets (what to suggest as replacement) ──────────────

OUR_PAGES = {
    "default": f"{OUR_URL}/dashboard",
    "tag": f"{OUR_URL}/tools/tag-generator",
    "keyword": f"{OUR_URL}/tools/keyword-research",
    "title": f"{OUR_URL}/tools/title-optimizer",
    "description": f"{OUR_URL}/tools/description-writer",
    "audit": f"{OUR_URL}/tools/youtube-seo-audit-diagnostic-fix-2026",
    "analytics": f"{OUR_URL}/tools/youtube-analytics-explained-2026",
    "thumbnails": f"{OUR_URL}/tools/thumbnail-analyzer",
    "vs": f"{OUR_URL}/vs",
}

# ─── Utility functions ─────────────────────────────────────────────────

def normalize_domain(url):
    """Extract the main domain from a URL for matching."""
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc.lower()
        # Remove www.
        domain = re.sub(r"^www\.", "", domain)
        return domain
    except Exception:
        return url.lower()

def domain_matches_competitor(domain, competitor):
    """Check if a domain matches any of the competitor's known domains."""
    domain = domain.lower()
    for comp_domain in competitor["domains"]:
        comp_domain = comp_domain.lower()
        if domain == comp_domain:
            return True
        # Match subdomains too (e.g., app.vidiq.com -> vidiq.com)
        if domain.endswith("." + comp_domain):
            return True
    return False

def domain_matches_our_site(domain):
    """Check if a domain is our own site."""
    our_domains = [
        "yt-seo-architect.vercel.app",
        "youtube-seo-architect.vercel.app",
        "youtube-seo-tool.vercel.app",
    ]
    domain = domain.lower()
    for ours in our_domains:
        if ours in domain or domain in ours:
            return True
    return False

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

        # Extract result links
        links = re.findall(r'href="(https?://[^"]+)"\s+class=[\'"]result-link[\'"]', html)
        results = list(dict.fromkeys(links))

        if not results:
            links = re.findall(r'class=[\'"]result-link[\'"]\s+href="(https?://[^"]+)"', html)
            results = list(dict.fromkeys(links))

        return results[:max_results]
    except Exception as e:
        print(f"  Search error for '{query[:50]}': {e}", file=sys.stderr)
        return []

# ─── Link extraction ──────────────────────────────────────────────────

def extract_outbound_links(html, base_url):
    """Extract all outbound HTTP links from HTML, excluding navigation/social domains."""
    links = set()
    hrefs = re.findall(r'href=[\'"](https?://[^\'"\s]+)[\'"]', html)
    for href in hrefs:
        href = href.rstrip(".,;:!?/")
        # Skip same-domain
        if base_url and base_url in href:
            continue
        # Skip common non-content / irrelevant domains
        skip_domains = [
            "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
            "pinterest.com", "reddit.com", "tiktok.com", "snapchat.com",
            "google.com", "doubleclick.net", "googletagmanager.com",
            "cloudflare.com", "amazon.com", "apple.com",
            "fonts.googleapis.com", "fonts.gstatic.com", "gstatic.com",
            "addtoany.com", "x.com", "tumblr.com", "youtube.com",
            "youtu.be", "github.com", "stackoverflow.com",
            "wordpress.org", "w3.org", "schema.org",
        ]
        if any(d in href for d in skip_domains):
            continue
        links.add(href)
    return list(links)

# ─── Page fetching ────────────────────────────────────────────────────

def fetch_page(url):
    """Fetch a page, return (url, html, error)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            html = resp.read().decode("utf-8", errors="replace")
            return (url, html, None)
    except Exception as e:
        return (url, "", str(e)[:100])

# ─── Page analysis ────────────────────────────────────────────────────

def analyze_page_links(html, url):
    """
    Analyze a page's outbound links and determine:
    - Which competitors are linked
    - Whether our site is already linked
    - The page title/context
    """
    parsed = urllib.parse.urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    links = extract_outbound_links(html, base)

    # Extract page title
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    page_title = title_match.group(1).strip() if title_match else parsed.netloc

    # Check each link against competitors and our site
    linked_competitors = []
    has_our_link = False
    found_links = {}  # domain -> full URL

    for link in links:
        domain = normalize_domain(link)
        if domain_matches_our_site(domain):
            has_our_link = True
            continue
        for comp in COMPETITORS:
            if domain_matches_competitor(domain, comp):
                if comp["name"] not in linked_competitors:
                    linked_competitors.append(comp["name"])
                    found_links[comp["name"]] = link
                break

    return {
        "title": page_title[:120],
        "url": url,
        "base_domain": parsed.netloc,
        "linked_competitors": linked_competitors,
        "competitor_count": len(linked_competitors),
        "has_our_link": has_our_link,
        "found_links": found_links,
        "total_outbound_links": len(links),
    }

# ─── Outreach template generation ─────────────────────────────────────

def generate_outreach(page_info, competitor_context=""):
    """
    Generate a personalized outreach email asking to be added alongside competitors.
    Different templates based on the page type and which competitors are linked.
    """
    site_domain = page_info["base_domain"]
    competitors = page_info["linked_competitors"]
    comp_list = ", ".join(competitors[:-1]) + " and " + competitors[-1] if len(competitors) > 1 else competitors[0]

    page_url = page_info["url"]
    our_page = OUR_PAGES["default"]
    page_title = page_info["title"]

    # Pick the best page to suggest based on what competitors they link
    linked_lower = [c.lower() for c in competitors]
    if "KeywordTool.io" in competitors:
        our_page = OUR_PAGES["keyword"]
    if "RapidTags" in competitors or "vidIQ" in competitors:
        our_page = OUR_PAGES["tag"]
    if "Canva" in competitors:
        our_page = OUR_PAGES["title"]
    if "Tubics" in competitors:
        our_page = OUR_PAGES["audit"]

    # Different angles depending on how many competitors they link
    if len(competitors) >= 3:
        # Comprehensive listicle — pitch as a missing entry
        subject = f"Your {site_domain} list is missing a free YouTube SEO tool"
        body = f"""Hi there,

I came across your excellent resource at {page_url} — great roundup of {comp_list} and other YouTube tools.

I noticed you're not yet listing YT SEO Architect, a completely free platform with 17+ tools for YouTube creators, including:

• AI title optimizer — scores titles out of 100 before you publish
• Tag generator — finds 15+ optimized tags with relevance scores
• Description writer — writes SEO-optimized descriptions with timestamps
• Full channel audit — finds metadata issues across all your videos
• Bulk metadata updater — fix titles/tags/descriptions in batches

It's 100% free, no account required, and used by thousands of creators. I think it would be a valuable addition to your list — especially as a free alternative to tools like {comp_list} that have paid tiers.

You can check it out here: {our_page}

Happy to provide screenshots, a demo video, or additional details if helpful.

Best,
[NHLAKA]
Founder, YT SEO Architect
{OUR_URL}"""
    elif len(competitors) == 2:
        # Comparison-style — pitch as a 3rd option worth comparing
        subject = f"Suggested addition for your {comp_list.replace(' and ', ' vs ')} comparison"
        body = f"""Hi there,

I read your comparison of {comp_list} at {page_url} — really helpful breakdown.

I wanted to suggest another tool worth considering: YT SEO Architect ({OUR_URL}). It's a completely free platform that does everything the paid tools do:

• Keyword research with search volume data
• AI title optimization with scoring
• Tag generation from competitor analysis
• Full channel metadata audits
• Bulk operations for managing multiple videos

The key difference: it's 100% free with no paid tier. No limits, no credits, no trials.

I think your readers would find it useful as a free alternative. Happy to provide any details or screenshots you need.

Best,
[NHLAKA]
Founder, YT SEO Architect
{OUR_URL}"""
    else:
        # Single competitor — pitch as a complementary/free alternative
        subject = f"Free alternative to {competitors[0]} for your {site_domain} audience"
        body = f"""Hi there,

I enjoyed reading your content at {page_url} — great work on covering {competitors[0]} and YouTube tools in general.

I wanted to let you know about YT SEO Architect, a completely free alternative to paid tools like {competitors[0]}. Key features:

• AI-powered title scoring and optimization
• Smart tag generation with relevance scoring
• SEO-optimized description writer
• Full YouTube channel audit
• Bulk metadata updates

The best part: it's 100% free forever. No credits, no limits, no trial period. Just useful tools for YouTube creators.

I'd love for you to check it out and consider adding it to your resource list: {our_page}

Happy to answer any questions.

Best,
[NHLAKA]
Founder, YT SEO Architect
{OUR_URL}"""

    return {
        "source_page": page_url,
        "page_title": page_title,
        "site_domain": site_domain,
        "linked_competitors": " + ".join(competitors),
        "competitor_count": len(competitors),
        "our_replacement": our_page,
        "subject": subject,
        "body": body,
    }

# ─── Seen-tracker (avoid duplicate outreach) ───────────────────────────

def load_seen():
    """Load the set of pages we've already generated outreach for."""
    if SEEN_DB.exists():
        try:
            return set(json.loads(SEEN_DB.read_text()))
        except (json.JSONDecodeError, KeyError):
            return set()
    return set()

def mark_seen(url):
    """Mark a page as having been processed."""
    seen = load_seen()
    seen.add(url)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SEEN_DB.write_text(json.dumps(sorted(list(seen)), indent=2))

# ─── Reporting / status ──────────────────────────────────────────────

def show_status():
    """Show current stats on competitor replication efforts."""
    seen = load_seen()
    print(f"\n{'='*60}")
    print(f"COMPETITOR BACKLINK REPLICATOR — STATUS")
    print(f"{'='*60}")
    print(f"  Pages processed:    {len(seen)}")
    print(f"  Reports directory:  {REPORTS_DIR}")
    print(f"  Competitors tracked: {len(COMPETITORS)}")

    print(f"\n  Competitors:")
    for c in COMPETITORS:
        print(f"    {c['name']:20s}  DR {c['dr']:2d}  ({', '.join(c['domains'])})")

    # Check for previous reports
    csv_files = sorted(REPORTS_DIR.glob("competitor-opportunities-*.csv"))
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

def run_scan(stage="all", max_pages=15, min_competitor_links=1, output_path=None, dry_run=False):
    """
    Main scan workflow:
    Stage 1: Search for pages that mention competitors
    Stage 2: Analyze each page for competitor links
    Stage 3: Find pages that link to competitors but NOT to us
    Stage 4: Generate outreach templates
    Stage 5: Save to CSV
    """
    if output_path is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = REPORTS_DIR / f"competitor-opportunities-{date_str}.csv"

    print(f"\n{'='*60}")
    print(f"COMPETITOR BACKLINK REPLICATOR")
    print(f"Scanning for pages that link to YouTube SEO tool competitors")
    print(f"Our site: {OUR_URL}")
    print(f"Competitors tracked: {len(COMPETITORS)}")
    print(f"{'='*60}\n")

    # ── Stage 1: Search ─────────────────────────────
    if stage in ("all", "search"):
        print("🔄 Stage 1: Searching for relevant pages...")
        all_results = []
        for i, query in enumerate(SEARCH_QUERIES):
            print(f"  [{i+1}/{len(SEARCH_QUERIES)}] \"{query}\"")
            results = search_ddg(query, max_results=5)
            all_results.extend(results)
            time.sleep(0.5)  # Be polite

        # Deduplicate
        unique_results = list(dict.fromkeys(all_results))
        print(f"  Found {len(unique_results)} unique results across all queries\n")

        if not unique_results:
            print("No results found. Try again later.")
            return True

        # Save raw results for inspection
        raw_path = REPORTS_DIR / f"competitor-raw-results-{datetime.now().strftime('%Y-%m-%d')}.json"
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(json.dumps(unique_results, indent=2))
        print(f"  Raw results saved: {raw_path}\n")

        # If --search flag, stop here
        if stage == "search":
            print(f"Search phase complete. Saved {len(unique_results)} raw results.")
            print(f"Run without --search to analyze these results.")
            return True
    else:
        # Load from cached results
        raw_files = sorted(REPORTS_DIR.glob("competitor-raw-results-*.json"))
        if not raw_files:
            print("No cached search results. Run without --search first.")
            return True
        unique_results = json.loads(raw_files[-1].read_text())
        print(f"🔄 Stage 1: Loaded {len(unique_results)} cached search results\n")

    # ── Stage 2: Fetch and analyze pages ────────────
    if stage in ("all", "analyze"):
        print("🔄 Stage 2: Fetching pages and analyzing links...")
    else:
        print("🔄 Stage 2: Loading cached analysis...")

    # Limit pages to scan
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
                print(f"  [SKIP] {url[:70]} — {error}")
                continue

            analysis = analyze_page_links(html, url)
            # Extract contact email from the page
            contact_email = extract_emails(html, url)
            analysis['contact_email'] = contact_email or ''

            if analysis["competitor_count"] >= min_competitor_links:
                page_analyses.append(analysis)
                comps = " + ".join(analysis["linked_competitors"])
                status = "✅ (has our link)" if analysis["has_our_link"] else "🎯 MISSING"
                print(f"  [{fetched_count}/{len(pages_to_scan)}] {status} {analysis['url'][:50]}")
                print(f"       Links to: {comps}")
            else:
                print(f"  [{fetched_count}/{len(pages_to_scan)}] [SKIP] {url[:50]} — 0-{min_competitor_links-1} competitor links")

    print(f"\n  Analyzed {len(page_analyses)} pages with competitor links\n")

    if not page_analyses:
        print("No pages found linking to competitors. Try different queries or increase page count.")
        return True

    # ── Stage 3: Filter to MISSING pages (they link competitors but not us) ──
    if stage in ("all", "filter"):
        print("🔄 Stage 3: Finding pages that DON'T link to us yet...")
    else:
        print("🔄 Stage 3: Using cached filtered results...")

    # Sort by competitor count (most linked = highest priority)
    missing_pages = [p for p in page_analyses if not p["has_our_link"]]
    missing_pages.sort(key=lambda p: p["competitor_count"], reverse=True)

    already_linked = [p for p in page_analyses if p["has_our_link"]]

    if already_linked:
        print(f"  Already link to us: {len(already_linked)} pages")
        for p in already_linked:
            print(f"    ✅ {p['url'][:70]} ({p['competitor_count']} competitors)")

    print(f"  Missing our link: {len(missing_pages)} pages")
    if not missing_pages:
        print("\n🎉 All scanned pages already have our link! Try different search queries.")
        return True

    # Show top opportunities
    print(f"\n  Top opportunities:")
    for p in missing_pages[:10]:
        comps = " + ".join(p["linked_competitors"])
        print(f"    🎯 [links {p['competitor_count']} comps] {p['url'][:60]}")
        print(f"         Competitors: {comps}")
    print("")

    # ── Stage 4: Generate outreach templates ────────
    if stage in ("all", "generate"):
        print("🔄 Stage 4: Generating personalized outreach templates...")
    else:
        print("🔄 Stage 4: Using cached outreach templates...")

    opportunities = []
    skipped_seen = 0

    for page in missing_pages:
        if page["url"] in seen_urls:
            skipped_seen += 1
            continue

        outreach = generate_outreach(page)
        outreach['contact_email'] = page.get('contact_email', '')
        opportunities.append(outreach)

        email_hint = f", email: {outreach['contact_email']}" if outreach['contact_email'] else ""
        print(f"\n  --- Opportunity #{len(opportunities)} ---")
        print(f"  Source:    {outreach['source_page']}")
        print(f"  Title:     {outreach['page_title'][:60]}")
        print(f"  Links to:  {outreach['linked_competitors']}{email_hint}")
        print(f"  Subject:   {outreach['subject']}")
        print(f"  Body:\n{outreach['body']}\n")

        # Limit to avoid overwhelming
        if len(opportunities) >= 20:
            print(f"  (Reached limit of 20 new opportunities)\n")
            break

    print(f"  New opportunities: {len(opportunities)}")
    print(f"  Skipped (already seen): {skipped_seen}")
    print(f"")

    if not opportunities:
        print("No new opportunities found. Run with more search queries or different terms.")
        return True

    # ── Stage 5: Save to CSV ────────────────────────
    if stage in ("all", "export") and not dry_run:
        print("🔄 Stage 5: Exporting to CSV...")
    else:
        if dry_run:
            print("🔄 Stage 5: [DRY RUN] Skipping CSV export\n")
        else:
            print("🔄 Stage 5: Using cached export...\n")

    if not dry_run:
        import csv
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", newline="", encoding="utf-8") as f:
            fieldnames = [
                "source_page", "broken_url", "page_title", "site_domain",
                "linked_competitors", "competitor_count",
                "our_replacement", "contact_email", "subject", "body",
            ]
            # Write compat header for backlink-outreach-sender.py
            # which expects 'broken_url' field (uses .get() fallback)
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for opp in opportunities:
                row = dict(opp)
                row["broken_url"] = opp.get("linked_competitors", "")
                writer.writerow(row)

        print(f"  Saved {len(opportunities)} opportunities to: {output_path}")

        # Mark as seen so we don't re-process
        for opp in opportunities:
            mark_seen(opp["source_page"])

        print(f"  Marked {len(opportunities)} pages as processed (won't re-process)\n")

    # ── Summary ──────────────────────────────────────────────────────
    print(f"{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Pages searched:    {len(unique_results)}")
    print(f"  Pages fetched:     {len(pages_to_scan)}")
    print(f"  With competitor links: {len(page_analyses)}")
    print(f"  Already link to us:    {len(already_linked)}")
    print(f"  Missing our link:      {len(missing_pages)}")
    print(f"  New opportunities:     {len(opportunities)}")
    print(f"  Output:                {output_path if not dry_run else '(dry run)'}")
    print(f"{'='*60}\n")

    if opportunities:
        print(f"Next steps:")
        print(f"1. Review the CSV at: {output_path}")
        print(f"2. Send outreach via: python3 scripts/backlink-outreach-sender.py --file \"{output_path}\"")
        print(f"3. Or preview first:  python3 scripts/backlink-outreach-sender.py --file \"{output_path}\" --dry-run")
        print(f"")
        print(f"Expected response rate: 15-25% for \"you're missing from this awesome list\" emails")
        print(f"Typical result: 3-5 backlinks from 20 outreach attempts\n")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Find sites linking to competitors but not to YT SEO Architect, and generate outreach"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't save CSV")
    parser.add_argument("--search", action="store_true", help="Run search phase only (debug)")
    parser.add_argument("--output", help="Custom output CSV path")
    parser.add_argument("--pages", type=int, default=15, help="Max pages to analyze (default: 15)")
    parser.add_argument("--min-links", type=int, default=1, help="Min competitor links required (default: 1)")
    parser.add_argument("--status", action="store_true", help="Show current stats")

    args = parser.parse_args()

    if args.status:
        return show_status()

    stage = "search" if args.search else "all"

    return run_scan(
        stage=stage,
        max_pages=args.pages,
        min_competitor_links=args.min_links,
        output_path=args.output,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
