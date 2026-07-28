#!/usr/bin/env python3
"""
scripts/backlink-auditor.py

Analyzes backlinks for toxicity, anchor text diversity, and link velocity.
Generates disavow files for toxic domains.

Usage:
  python3 scripts/backlink-auditor.py --file links.csv                  # Full audit from CSV
  python3 scripts/backlink-auditor.py --file links.csv --generate-disavow  # Also produce disavow
  python3 scripts/backlink-auditor.py --url https://mysite.com          # Crawl site for backlinks
  python3 scripts/backlink-auditor.py --file links.csv --summary-only   # Just the overview

CSV input expected columns:
  source_url, target_url, anchor_text, domain_authority (optional),
  first_found (optional), last_seen (optional), link_type (optional)

Output:
  - Console summary with risk scores
  - marketing/backlink-reports/audit-{date}.json — full audit report
  - marketing/backlink-reports/disavow-{date}.txt — disavow file (if requested)
"""

import os
import sys
import json
import csv
import re
import time
import argparse
import collections
import urllib.parse
from datetime import datetime
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT / "marketing" / "backlink-reports"

# ─── Toxic signal databases ───────────────────────────────────────────

# Domains known for PBNs, spam directories, paid links (sample — expand over time)
KNOWN_TOXIC_DOMAINS = {
    # Known PBN / spam networks
    "buylinks.com", "seo-pbn.com", "pbn.network", "privatenetwork.com",
    "linkwheel.com", "blognetwork.com", "articlemarketing.com",
    "articlebase.com", "goarticles.com", "articlesnatch.com",
    "spammy-directory.com", "linkdumps.com", "freelinkexchange.com",
    "linkexchange.com", "reciprocallinks.com", "linkpartners.com",
    "backlinkexchange.com", "linkmarket.com",
    # Known comment spam domains
    "cheap-comments.com", "blogcomments.net", "comment-spam.com",
    # Casino/gambling/spam categories (often toxic)
    "online-casino", "poker-online", "gambling-site",
    "pharmacy-no-prescription", "buy-viagra", "cheap-meds",
    "payday-loans", "quick-cash", "instant-loan",
}

# TLDs often associated with spam (when not relevant to the site)
SPAMMY_TLDS = {
    ".tk", ".ml", ".ga", ".cf", ".gq",  # Freenom free TLDs
    ".work", ".date", ".racing", ".win", ".bid", ".trade",
    ".webcam", ".science", ".download", ".xin", ".review",
    ".party", ".loan", ".men", ".mom", ".click", ".link",
}

LT_AGGRESSIVE_ANCHOR_PATTERNS = [
    r"buy\s+", r"purchase\s+", r"cheap\s+", r"discount\s+",
    r"best\s+(SEO|price|deal)s?\b",
    r"click\s+here", r"free\s+(money|cash|prize|gift)",
    r"download\s+(now|free)", r"limited\s+offer",
    r"act\s+now", r"don't\s+miss",
]

# ─── Helpers ──────────────────────────────────────────────────────────

def date_str():
    return datetime.now().strftime("%Y-%m-%d")


def load_backlinks(csv_path):
    """Load backlinks from CSV. Returns list of dicts."""
    links = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            links.append(row)
    return links


def extract_domain(url):
    """Extract clean domain from a URL."""
    if not url:
        return ""
    url = url.strip().lower()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc
        # Strip port
        domain = domain.split(":")[0]
        return re.sub(r"^www\.", "", domain)
    except Exception:
        return url.split("/")[0] if "/" in url else url


def classify_anchor(anchor_text):
    """
    Classify anchor text into categories:
    - exact_match: keyword that matches a target page topic
    - branded: contains brand name
    - generic: click here, visit site, this link, etc.
    - url: raw URL
    - lsi: partial-match / long-tail keywords
    - naked: just a URL displayed as text
    - image: image alt text indicator
    - other: everything else
    """
    if not anchor_text or not anchor_text.strip():
        return "empty"
    t = anchor_text.strip().lower()

    # URL patterns
    url_patterns = [r"^https?://", r"^www\.", r"^[a-z0-9.-]+\.[a-z]{2,}(/|$)"]
    if any(re.match(p, t) for p in url_patterns):
        return "url"

    # Generic patterns
    generic = {
        "click here", "visit here", "this site", "this website", "this link",
        "read more", "learn more", "find out more", "more info", "more information",
        "go here", "link", "website", "site", "homepage", "home",
        "check it out", "check this out", "see more", "view more",
    }
    if t in generic or t.startswith("click ") or t.startswith("visit "):
        return "generic"

    # Image alt text indicators (often the URL or "image" as anchor)
    if t.startswith("image") or t.endswith("image"):
        return "image"

    # Commercial / aggressive keywords
    for pat in LT_AGGRESSIVE_ANCHOR_PATTERNS:
        if re.search(pat, t):
            return "commercial"

    # Exact match — long enough to be a meaningful keyword
    if 2 <= len(t.split()) <= 5:
        return "exact_match"

    # Long tail / LSI
    if len(t.split()) > 5:
        return "lsi"

    return "other"


def score_toxicity(source_url, anchor_text=""):
    """
    Score a backlink source for toxicity (0-100).
    Higher = more toxic / risky.
    """
    score = 0
    reasons = []

    source_domain = extract_domain(source_url)

    # 1. Known toxic domains
    for toxic_domain in KNOWN_TOXIC_DOMAINS:
        if toxic_domain in source_domain:
            score += 40
            reasons.append(f"Known toxic/PBN domain: {toxic_domain}")
            break

    # 2. Spammy TLDs
    tld_match = None
    for tld in SPAMMY_TLDS:
        if source_domain.endswith(tld):
            tld_match = tld
            break
    if tld_match:
        score += 25
        reasons.append(f"Suspicious TLD: {tld_match}")

    # 3. Hyphen-heavy domains (often keyword-stuffed PBNs)
    domain_name = source_domain.split(".")[0] if "." in source_domain else source_domain
    hyphen_count = domain_name.count("-")
    if hyphen_count >= 3:
        score += 15
        reasons.append(f"Keyword-stuffed domain ({hyphen_count} hyphens)")
    elif hyphen_count >= 1:
        score += 5

    # 4. Very long domain names (keyword stuffing)
    if len(domain_name) > 25:
        score += 10
        reasons.append(f"Long domain name ({len(domain_name)} chars — potential keyword stuffing)")

    # 5. Numeric-heavy domains
    digit_ratio = sum(c.isdigit() for c in domain_name) / max(len(domain_name), 1)
    if digit_ratio > 0.4:
        score += 10
        reasons.append(f"Heavy numeric content in domain ({digit_ratio:.0%} digits)")

    # 6. Aggressive anchor text
    if anchor_text:
        for pat in LT_AGGRESSIVE_ANCHOR_PATTERNS:
            if re.search(pat, anchor_text, re.IGNORECASE):
                score += 15
                reasons.append(f"Aggressive anchor: \"{anchor_text[:50]}\"")
                break

    # 7. Naked URL anchor (no keyword value)
    if anchor_text and (anchor_text.strip().lower().startswith("http") or
                        anchor_text.strip().lower().startswith("www")):
        score += 0  # Neutral — not toxic, just not valuable

    # 8. IP-address-based domains (usually PBNs or scrapers)
    if re.match(r"^\d+\.\d+\.\d+\.\d+", source_domain):
        score += 30
        reasons.append("IP-address-based domain (likely scraper/PBN)")

    # 9. Subdomain-heavy URL (free hosting / web 2.0 spam)
    subdomain_parts = source_domain.split(".")
    if len(subdomain_parts) > 3:
        score += 10
        reasons.append(f"Deep subdomain structure ({len(subdomain_parts)} parts)")

    return min(score, 100), reasons


# ─── Analysis functions ───────────────────────────────────────────────

def analyze_anchor_diversity(links):
    """
    Analyze anchor text distribution across backlinks.
    Returns percentages for each category.
    """
    categories = collections.Counter()
    for link in links:
        cat = classify_anchor(link.get("anchor_text", ""))
        categories[cat] += 1

    total = max(sum(categories.values()), 1)
    distribution = {
        cat: round((count / total) * 100, 1)
        for cat, count in categories.most_common()
    }
    return {
        "distribution": distribution,
        "total_anchors": total,
        "exact_match_pct": distribution.get("exact_match", 0),
        "branded_pct": distribution.get("branded", 0),
        "generic_pct": distribution.get("generic", 0),
        "url_pct": distribution.get("url", 0),
        "commercial_pct": distribution.get("commercial", 0),
        "lsi_pct": distribution.get("lsi", 0),
        "empty_pct": distribution.get("empty", 0),
        "health_score": _anchor_health_score(distribution),
    }


def _anchor_health_score(distribution):
    """
    Heuristic health score 0-100 based on anchor distribution.
    Ideal: 30-50% branded, 20-40% generic/URL, 10-30% exact match.
    Warning signs: > 50% exact match (over-optimized).
    """
    score = 100
    exact = distribution.get("exact_match", 0)
    branded = distribution.get("branded", 0)
    commercial = distribution.get("commercial", 0)
    empty = distribution.get("empty", 0)
    url_pct = distribution.get("url", 0)

    # Penalize over-optimized exact match
    if exact > 50:
        score -= (exact - 50) * 1.5
    elif exact < 5:
        score -= 10  # Too few exact match = no keyword targeting

    # Reward branded anchors (natural profile)
    if branded < 10:
        score -= 15
    elif branded > 60:
        score -= 10  # Suspiciously high branded

    # Penalize commercial anchors
    score -= commercial * 1.2

    # Penalize empty anchors
    score -= empty * 1.5

    # Penalize too many URL-only anchors (unnatural for editorial links)
    if url_pct > 40:
        score -= (url_pct - 40) * 0.5

    return max(0, min(100, round(score)))


def analyze_link_velocity(links):
    """
    Analyze link growth over time.
    If links have 'first_found' dates, compute velocity.
    Otherwise estimate based on domain age heuristics.
    """
    dated_links = []
    for link in links:
        ff = (link.get("first_found") or "").strip()
        ls = (link.get("last_seen") or "").strip()
        if ff:
            try:
                dated_links.append({
                    "first": datetime.strptime(ff[:10], "%Y-%m-%d"),
                    "last": datetime.strptime(ls[:10], "%Y-%m-%d") if ls else None,
                    "source": link.get("source_url", ""),
                })
            except ValueError:
                pass

    result = {
        "total_links": len(links),
        "dated_links": len(dated_links),
        "velocity_score": 100,  # start healthy
        "spikes": [],
        "warning": None,
    }

    if len(dated_links) < 3:
        result["warning"] = "Not enough dated links for velocity analysis (need 3+)"
        return result

    # Sort by first_found
    dated_links.sort(key=lambda x: x["first"])

    # Group by month
    monthly = collections.Counter()
    for dl in dated_links:
        month_key = dl["first"].strftime("%Y-%m")
        monthly[month_key] += 1

    months_sorted = sorted(monthly.keys())
    if len(months_sorted) < 2:
        result["warning"] = "Links span fewer than 2 months — insufficient data"
        return result

    # Calculate average per month
    counts = [monthly[m] for m in months_sorted]
    avg_per_month = sum(counts) / len(counts)

    # Detect spikes (months with > 3x the average)
    spikes = []
    for month, count in monthly.items():
        if avg_per_month > 0 and count > avg_per_month * 3 and count >= 3:
            spikes.append({"month": month, "count": count, "avg": round(avg_per_month, 1)})

    result["spikes"] = spikes
    result["monthly_counts"] = dict(monthly)
    result["avg_per_month"] = round(avg_per_month, 1)

    # Penalize velocity
    # Too many spikes = unnatural link building
    if len(spikes) >= 2:
        result["velocity_score"] -= min(40, len(spikes) * 20)
        result["warning"] = f"{len(spikes)} link acquisition spikes detected (unnatural pattern)"

    # Very high velocity (> 50 links/month)
    if avg_per_month > 50:
        result["velocity_score"] -= 20
        result["warning"] = f"Very high link velocity ({avg_per_month}/month)"
    elif avg_per_month > 20:
        result["velocity_score"] -= 10
        result["warning"] = f"High link velocity ({avg_per_month}/month)"

    result["velocity_score"] = max(0, min(100, result["velocity_score"]))
    return result


def analyze_toxicity(links):
    """
    Score each backlink source for toxicity.
    Returns list of toxic domains and overall profile health.
    """
    domain_scores = collections.defaultdict(lambda: {"score": 0, "reasons": [], "count": 0, "anchors": []})

    for link in links:
        source = link.get("source_url", "")
        anchor = link.get("anchor_text", "")
        domain = extract_domain(source)

        score, reasons = score_toxicity(source, anchor)
        domain_scores[domain]["score"] = max(domain_scores[domain]["score"], score)
        domain_scores[domain]["reasons"] = list(set(domain_scores[domain]["reasons"] + reasons))
        domain_scores[domain]["count"] += 1
        if anchor and anchor.strip():
            domain_scores[domain]["anchors"].append(anchor.strip()[:80])

    # Sort by toxicity score descending
    sorted_domains = sorted(
        domain_scores.items(),
        key=lambda x: x[1]["score"],
        reverse=True,
    )

    toxic_list = []
    total_toxic = 0
    for domain, info in sorted_domains:
        entry = {
            "domain": domain,
            "score": info["score"],
            "severity": "high" if info["score"] >= 50 else "medium" if info["score"] >= 25 else "low",
            "link_count": info["count"],
            "reasons": info["reasons"],
            "sample_anchors": info["anchors"][:3],
        }
        toxic_list.append(entry)
        if info["score"] >= 25:
            total_toxic += 1

    overall_toxicity = 0
    if toxic_list:
        overall_toxicity = round(
            sum(t["score"] for t in toxic_list) / len(toxic_list), 1
        )

    return {
        "domains": toxic_list,
        "total_domains": len(domain_scores),
        "toxic_domains": total_toxic,
        "toxic_pct": round((total_toxic / max(len(domain_scores), 1)) * 100, 1),
        "overall_toxicity": overall_toxicity,
        "health_score": max(0, 100 - overall_toxicity),
    }


# ─── Disavow generation ──────────────────────────────────────────────

def generate_disavow(toxicity_result, threshold=25):
    """
    Generate a Google disavow file for domains with toxicity score >= threshold.
    Returns the disavow text content.
    """
    lines = [
        "# Disavow file generated by backlink-auditor.py",
        f"# Date: {date_str()}",
        f"# Threshold: toxicity score >= {threshold}",
        f"# Total domains disavowed: {sum(1 for d in toxicity_result['domains'] if d['score'] >= threshold)}",
        "",
    ]

    for domain in toxicity_result["domains"]:
        if domain["score"] >= threshold:
            severity_comment = f"# Severity: {domain['severity']} | Score: {domain['score']}/100"
            if domain["reasons"]:
                severity_comment += f" | {domain['reasons'][0]}"
            lines.append(severity_comment)
            lines.append(f"domain:{domain['domain']}")
            lines.append("")

    return "\n".join(lines)


# ─── Report ───────────────────────────────────────────────────────────

def print_report(toxicity, anchor_diversity, velocity):
    """Print a formatted audit report to console."""
    print(f"\n{'='*65}")
    print(f"  🔗 BACKLINK AUDIT REPORT — {date_str()}")
    print(f"{'='*65}")

    # Toxicity section
    print(f"\n  📊 TOXICITY ANALYSIS")
    print(f"  {'─'*55}")
    print(f"    Total domains:      {toxicity['total_domains']}")
    print(f"    Toxic domains:      {toxicity['toxic_domains']} ({toxicity['toxic_pct']}%)")
    print(f"    Overall toxicity:   {toxicity['overall_toxicity']}/100")
    print(f"    Health score:       {toxicity['health_score']}/100 {'🟢' if toxicity['health_score'] >= 70 else '🟡' if toxicity['health_score'] >= 40 else '🔴'}")

    if toxicity["domains"]:
        print(f"\n    Top toxic domains:")
        for d in toxicity["domains"][:8]:
            icon = "🔴" if d["severity"] == "high" else "🟡" if d["severity"] == "medium" else "⚪"
            print(f"    {icon} {d['domain']:35s} {d['score']:3d}/100  ({d['link_count']} links)")
            if d["reasons"]:
                print(f"       └─ {d['reasons'][0][:65]}")

        if len(toxicity["domains"]) > 8:
            print(f"    ... and {len(toxicity['domains']) - 8} more domains")

    # Anchor diversity section
    print(f"\n  📝 ANCHOR TEXT ANALYSIS")
    print(f"  {'─'*55}")
    dist = anchor_diversity["distribution"]
    print(f"    Total anchors:      {anchor_diversity['total_anchors']}")
    print(f"    Health score:       {anchor_diversity['health_score']}/100 "
          f"{'🟢' if anchor_diversity['health_score'] >= 70 else '🟡' if anchor_diversity['health_score'] >= 40 else '🔴'}")

    # Sort by percentage descending for display
    for cat, pct in sorted(dist.items(), key=lambda x: x[1], reverse=True):
        bar = "█" * max(1, int(pct / 5))
        pct_str = f"{pct:5.1f}%"
        cat_pad = cat.replace("_", " ").title() + ":"
        print(f"    {cat_pad:18s} {bar} {pct_str}")

    if anchor_diversity["health_score"] < 50:
        print(f"\n    ⚠ WARNING: Unnatural anchor profile")
        if dist.get("exact_match", 0) > 50:
            print(f"      • Over-optimized ({dist['exact_match']}% exact match). Add branded/generic links.")
        if dist.get("commercial", 0) > 20:
            print(f"      • High commercial anchor ratio ({dist['commercial']}%). Diversify.")
        if dist.get("branded", 0) < 10:
            print(f"      • Low branded anchor ratio ({dist['branded']}%). Build brand mentions.")

    # Link velocity section
    print(f"\n  ⏱ LINK VELOCITY")
    print(f"  {'─'*55}")
    print(f"    Total links:        {velocity['total_links']}")
    if velocity.get("dated_links", 0) > 0:
        print(f"    Dated links:        {velocity['dated_links']}")
    print(f"    Velocity score:     {velocity['velocity_score']}/100 "
          f"{'🟢' if velocity['velocity_score'] >= 70 else '🟡' if velocity['velocity_score'] >= 40 else '🔴'}")
    if velocity.get("avg_per_month"):
        print(f"    Avg links/month:    {velocity['avg_per_month']}")

    if velocity.get("spikes"):
        print(f"\n    ⚠ Link acquisition spikes:")
        for s in velocity["spikes"]:
            print(f"      • {s['month']}: {s['count']} links (avg was {s['avg']})")

    if velocity.get("warning"):
        print(f"\n    ⚠ {velocity['warning']}")

    # Overall
    overall = _overall_health(toxicity, anchor_diversity, velocity)
    print(f"\n  {'─'*55}")
    icon = "🟢" if overall["grade"] == "A" else "🟡" if overall["grade"] == "B" else "🔴"
    print(f"  {icon} OVERALL PROFILE HEALTH: {overall['score']}/100 (Grade {overall['grade']})")
    for rec in overall["recommendations"]:
        print(f"     • {rec}")
    print(f"\n{'='*65}\n")


def _overall_health(toxicity, anchor_diversity, velocity):
    """Compute overall health score 0-100 with grade and recommendations."""
    tox_h = toxicity["health_score"]
    anc_h = anchor_diversity["health_score"]
    vel_h = velocity["velocity_score"]

    score = round(tox_h * 0.5 + anc_h * 0.3 + vel_h * 0.2)

    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"

    recommendations = []
    if toxicity["toxic_domains"] > 0:
        recommendations.append(f"Disavow {toxicity['toxic_domains']} toxic domains (score >= 25)")
    if toxicity["toxic_domains"] > 5:
        recommendations.append("High number of toxic domains — review link acquisition sources")
    if anchor_diversity["health_score"] < 50:
        recommendations.append("Diversify anchor text profile (more branded/generic anchors)")
    if velocity.get("spikes") and len(velocity["spikes"]) >= 2:
        recommendations.append("Investigate link velocity spikes — pattern suggests unnatural acquisition")

    if not recommendations:
        recommendations.append("Profile looks healthy — continue monitoring")

    return {
        "score": score,
        "grade": grade,
        "toxicity_weight": tox_h * 0.5,
        "anchor_weight": anc_h * 0.3,
        "velocity_weight": vel_h * 0.2,
        "recommendations": recommendations,
    }


# ─── Web crawl (basic) ───────────────────────────────────────────────

def crawl_backlinks(target_url):
    """
    Basic backlink discovery via common free sources.
    Since we don't have Ahrefs/Moz API access, this is limited.
    Uses a simple heuristic: check if major SEO tools have data.
    For real backlink data, use Google Search Console API.
    """
    print(f"  Note: Free backlink crawling is limited. For full data:")
    print(f"    • Export from Google Search Console (Links report)")
    print(f"    • Use Ahrefs/Moz/Semrush free backlink checkers")
    print(f"    • Then run: python3 scripts/backlink-auditor.py --file export.csv")
    return []


# ─── File I/O ─────────────────────────────────────────────────────────

def save_report(toxicity, anchor_diversity, velocity):
    """Save audit report to JSON."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / f"audit-{date_str()}.json"

    # Check if we should append or overwrite
    if path.exists():
        existing = json.loads(path.read_text())
        if not isinstance(existing, list):
            existing = [existing]
    else:
        existing = []

    entry = {
        "date": date_str(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "toxicity": {
            "total_domains": toxicity["total_domains"],
            "toxic_domains": toxicity["toxic_domains"],
            "toxic_pct": toxicity["toxic_pct"],
            "overall_toxicity": toxicity["overall_toxicity"],
            "health_score": toxicity["health_score"],
        },
        "anchor_diversity": anchor_diversity,
        "link_velocity": {
            "total_links": velocity["total_links"],
            "velocity_score": velocity["velocity_score"],
            "avg_per_month": velocity.get("avg_per_month"),
            "spikes": velocity.get("spikes"),
            "warning": velocity.get("warning"),
        },
    }

    existing.append(entry)
    path.write_text(json.dumps(existing, indent=2))
    return path


def save_disavow(disavow_text):
    """Save disavow file."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / f"disavow-{date_str()}.txt"
    path.write_text(disavow_text)
    return path


# ─── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Backlink auditor — toxicity, anchor diversity, velocity, disavow"
    )
    parser.add_argument("--file", help="CSV file with backlink data")
    parser.add_argument("--url", help="Your site URL (for future crawl support)")
    parser.add_argument("--generate-disavow", action="store_true",
                        help="Generate disavow file for toxic domains")
    parser.add_argument("--disavow-threshold", type=int, default=25,
                        help="Minimum toxicity score for disavow (default: 25)")
    parser.add_argument("--summary-only", action="store_true",
                        help="Show only the summary, skip full report")
    args = parser.parse_args()

    if not args.file and not args.url:
        parser.print_help()
        print("\nProvide either --file (CSV of backlinks) or --url (for crawl)")
        return False

    # Load links
    links = []
    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"File not found: {path}")
            return False
        links = load_backlinks(path)
        print(f"\nLoaded {len(links)} backlinks from {path.name}")
    elif args.url:
        links = crawl_backlinks(args.url)
        if not links:
            return True

    if not links:
        print("No backlinks to analyze.")
        return True

    # Run analyses
    print("Analyzing toxicity... ", end="", flush=True)
    toxicity = analyze_toxicity(links)
    print("OK")

    print("Analyzing anchor diversity... ", end="", flush=True)
    anchor_diversity = analyze_anchor_diversity(links)
    print("OK")

    print("Analyzing link velocity... ", end="", flush=True)
    velocity = analyze_link_velocity(links)
    print("OK")

    # Save report
    report_path = save_report(toxicity, anchor_diversity, velocity)
    print(f"\nReport saved: {report_path}")

    # Disavow
    if args.generate_disavow:
        disavow_text = generate_disavow(toxicity, threshold=args.disavow_threshold)
        disavow_path = save_disavow(disavow_text)
        print(f"Disavow saved: {disavow_path}")

        # Count disavowed
        disavowed_count = disavow_text.count("domain:")
        print(f"  Domains disavowed: {disavowed_count}")
        print(f"  Upload to: https://search.google.com/search-console/disavow-links")

    # Print report
    if not args.summary_only:
        print_report(toxicity, anchor_diversity, velocity)

    return True


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
