#!/usr/bin/env python3
"""
scripts/backlink-outreach-sender.py

Reads outreach opportunities CSV (from backlink-finder.py, competitor-backlink-replicator.py,
or resource-page-outreach.py) and sends personalized emails via SMTP.

Features:
- Auto-discovers contact emails via footer, mailto, contact pages, WHOIS, security.txt
- Accepts `contact_email` CSV column as override (skips auto-discovery)
- Tracks sent emails to avoid duplicates
- Strips surrounding quotes from .env values automatically
- Supports SMTP_FROM_NAME for body personalization

Usage:
  python3 scripts/backlink-outreach-sender.py                      # Send all unsent
  python3 scripts/backlink-outreach-sender.py --dry-run             # Preview only
  python3 scripts/backlink-outreach-sender.py --file <path>        # Specific CSV
  python3 scripts/backlink-outreach-sender.py --status              # Show sent/remaining

Env vars (set in .env):
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your@email.com
  SMTP_PASS=your_app_password
  SMTP_FROM=Your Name <your@email.com>
  SMTP_FROM_NAME=Your Name     (optional, used for body personalization)
  OUTREACH_DB=marketing/backlink-reports/sent-outreach.json  (optional, default)

CSV expected columns:
  source_page, broken_url, subject, body, our_replacement
  contact_email  (optional — if present, used instead of auto-discovery)
"""

import os
import sys
import json
import csv
import time
import argparse
import smtplib
import re
import urllib.request
import urllib.parse
import subprocess
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

import dns.resolver
import requests

PROJECT = Path(__file__).resolve().parent.parent
SENT_DB = PROJECT / "marketing" / "backlink-reports" / "sent-outreach.json"
RATE_LIMIT_SECONDS = 45  # delay between sends to avoid spam flags

# ─── Config loading ───────────────────────────────────────────────────

def load_env():
    """Load SMTP config from .env. Strips surrounding quotes from values."""
    env_path = PROJECT / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                # Strip surrounding quotes (" or ')
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
                    val = val[1:-1]
                os.environ.setdefault(key, val)

def get_config():
    return {
        "host": os.getenv("SMTP_HOST", ""),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", ""),
        "from_addr": os.getenv("SMTP_FROM", ""),
        "from_name": os.getenv("SMTP_FROM_NAME", ""),
    }

# ─── Sent DB ──────────────────────────────────────────────────────────

def load_sent_db():
    if SENT_DB.exists():
        return json.loads(SENT_DB.read_text())
    return []

def save_sent_record(record):
    SENT_DB.parent.mkdir(parents=True, exist_ok=True)
    existing = load_sent_db()
    existing.append(record)
    SENT_DB.write_text(json.dumps(existing, indent=2))

# ─── CSV loading ──────────────────────────────────────────────────────

def load_opportunities(csv_path):
    opportunities = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            opportunities.append(row)
    return opportunities

# ─── DNS & RDAP helpers ────────────────────────────────────────────────

KNOWN_SPAM_DOMAINS = {
    "example.com", "example.org", "example.net",
    "domain.com", "domain.net", "domain.org",
    "test.com", "test.org", "test.net",
    "sample.com", "yourdomain.com", "mydomain.com",
    "email.com", "mail.com", "tempmail.com",
}

def has_mx_record(domain):
    """Check if a domain has valid MX records (accepts email)."""
    try:
        mx_records = dns.resolver.resolve(domain, "MX", lifetime=5)
        return len(mx_records) > 0
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout):
        pass
    # Fallback: check for A/AAAA records
    try:
        a_records = dns.resolver.resolve(domain, "A", lifetime=5)
        return len(a_records) > 0
    except Exception:
        return False


def rdap_lookup(domain):
    """
    RDAP fallback for email discovery via public RDAP servers.
    Returns a set of email addresses found.
    """
    rdap_urls = [
        f"https://rdap.verisign.com/com/v1/domain/{domain}",
        f"https://rdap.nominet.uk/uk/v1/domain/{domain}",
        f"https://rdap.registry.name/v1/domain/{domain}",
    ]
    emails = set()
    for url in rdap_urls:
        try:
            r = requests.get(url, timeout=8, headers={"User-Agent": "OutreachBot/1.0"})
            if r.status_code != 200:
                continue
            data = r.json()
            if not isinstance(data, dict):
                continue
            # Extract emails from entities' vcard data
            for entity in data.get("entities", []):
                if not isinstance(entity, dict):
                    continue
                for vcard_arr in entity.get("vcardArray", []):
                    if not isinstance(vcard_arr, list):
                        continue
                    for vcard_entry in vcard_arr:
                        if not isinstance(vcard_entry, list):
                            continue
                        for item in vcard_entry:
                            if (isinstance(item, list) and len(item) >= 3
                                    and str(item[0]).lower() == "email"):
                                addr = item[-1]  # email is last element
                                if isinstance(addr, str) and "@" in addr:
                                    emails.add(addr)
        except Exception:
            continue
    return emails


# ─── Enhanced email finder ────────────────────────────────────────────

def find_contact_email(source_page):
    """
    Enhanced email finder — tries multiple strategies to find a contact email
    for the site owner of a given source page.

    Strategies (in order):
    1. Parse the source page HTML for mailto: links (catches footer emails)
    2. Check common contact pages: /contact, /about, /team, /support
    3. Check /.well-known/security.txt
    4. RDAP lookup (registrar/abuse contacts via HTTP RDAP protocol)
    5. WHOIS lookup (falls back gracefully if 'whois' command unavailable)
    6. DNS MX check to validate email domains

    Returns None if all strategies fail.
    """
    parsed = urllib.parse.urlparse(source_page)
    base = f"{parsed.scheme}://{parsed.netloc}"
    domain = parsed.netloc
    domain_clean = re.sub(r"^www\.", "", domain).lower()

    all_emails = set()

    def extract_emails(html_content):
        """Extract mailto, CloudFlare-protected, and plain email addresses from HTML."""
        found = set()
        # mailto: links
        mailtos = re.findall(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', html_content)
        found.update(mailtos)
        # CloudFlare email protection (data-cfemail is hex-encoded)
        cf_encoded = re.findall(r'data-cfemail="([a-fA-F0-9]+)"', html_content)
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
        plain = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', html_content)
        found.update(plain)
        return found

    def fetch_url(url, timeout=8):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; OutreachBot/1.0)"},
                timeout=timeout,
            )
            with urllib.request.urlopen(req) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception:
            return None

    # Strategy 1: Check source page AND root homepage for footer emails
    html = fetch_url(source_page)
    if html:
        all_emails.update(extract_emails(html))
    if source_page != base:
        html_home = fetch_url(base)
        if html_home:
            all_emails.update(extract_emails(html_home))

    # Strategy 2: Check common contact pages
    contact_paths = [
        "/contact", "/about", "/about-us", "/contact-us",
        "/team", "/support", "/help", "/feedback",
    ]
    for path in contact_paths:
        html = fetch_url(f"{base}{path}")
        if html:
            all_emails.update(extract_emails(html))

    # Strategy 3: Check .well-known/security.txt
    html = fetch_url(f"{base}/.well-known/security.txt", timeout=5)
    if html:
        all_emails.update(extract_emails(html))

    # Strategy 4: RDAP lookup
    try:
        rdap_emails = rdap_lookup(domain_clean)
        all_emails.update(rdap_emails)
    except Exception:
        pass

    # Strategy 5: WHOIS lookup (if 'whois' command is available)
    try:
        result = subprocess.run(
            ["whois", domain_clean],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            whois_emails = re.findall(
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                result.stdout,
            )
            all_emails.update(whois_emails)
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass  # whois not available — continue

    # Filter results
    skip_hard = {"noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster"}
    image_exts = {".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".ico", ".css", ".js"}
    fake_domains = KNOWN_SPAM_DOMAINS

    # Filter + deduplicate by normalized email
    seen_norm = set()
    filtered = []
    for e in all_emails:
        el = e.lower()
        # Skip noreply patterns, image extensions, fake domains
        if any(s in el for s in skip_hard):
            continue
        if any(el.endswith(ext) for ext in image_exts):
            continue
        email_domain = el.split("@")[1] if "@" in el else ""
        if email_domain in fake_domains:
            continue
        # Dedup by normalized email
        if el not in seen_norm:
            seen_norm.add(el)
            filtered.append(e)

    # Validate via DNS MX check
    validated = []
    for e in filtered:
        email_domain = e.split("@")[1] if "@" in e else ""
        if email_domain and has_mx_record(email_domain):
            validated.append(e)
    # Fall back to unvalidated if none pass MX
    final_emails = validated if validated else filtered

    # Prefer emails containing the domain (more likely real contact)
    domain_emails = [e for e in final_emails if domain_clean in e.lower()]
    if domain_emails:
        return domain_emails[0]
    return final_emails[0] if final_emails else None


# ─── Email building ───────────────────────────────────────────────────

def build_email(from_addr, to_addr, subject, body):
    msg = MIMEMultipart("alternative")
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    return msg

def send_email(config, to_addr, subject, body, dry_run=False):
    """Send an email via SMTP, or print it in dry-run mode."""
    if dry_run:
        print(f"  [DRY RUN] To: {to_addr}")
        print(f"  [DRY RUN] Subject: {subject}")
        print(f"  [DRY RUN] Body preview: {body[:200]}...")
        return True

    try:
        msg = build_email(config["from_addr"], to_addr, subject, body)
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            server.login(config["user"], config["password"])
            server.sendmail(config["from_addr"], [to_addr], msg.as_string())
        return True
    except Exception as e:
        print(f"  [FAIL] {to_addr}: {e}", file=sys.stderr)
        return False

def personalize_body(body, from_name):
    """Replace placeholder names in the email body."""
    if not from_name:
        return body
    result = body.replace("Patrick", from_name)
    result = result.replace("[NHLAKA]", from_name)
    return result

# ─── Main outreach workflow ───────────────────────────────────────────

def run_outreach(csv_path, dry_run=False, limit=None, skip_existing=True):
    config = get_config()
    if not config["host"]:
        print("ERROR: SMTP_HOST not set in .env. Configure email first.")
        print("  Add to .env:")
        print("    SMTP_HOST=smtp.gmail.com")
        print("    SMTP_PORT=587")
        print("    SMTP_USER=your@email.com")
        print("    SMTP_PASS=your_app_password")
        print('    SMTP_FROM=Your Name <your@email.com>')
        print("    SMTP_FROM_NAME=Your Name")
        return False

    if not config["from_addr"]:
        print("ERROR: SMTP_FROM not set in .env. Example:")
        print("    SMTP_FROM=Your Name <your@email.com>")
        return False

    if not dry_run and (not config["user"] or not config["password"]):
        print("ERROR: SMTP_USER and SMTP_PASS must be set in .env")
        return False

    opportunities = load_opportunities(csv_path)
    if not opportunities:
        print(f"No opportunities found in {csv_path}")
        return True

    sent_records = load_sent_db() if skip_existing else []
    sent_keys = {(r["source_page"], r["broken_url"]) for r in sent_records}

    print(f"\n{'='*60}")
    print(f"BACKLINK OUTREACH SENDER")
    print(f"Source: {csv_path}")
    print(f"Total opportunities: {len(opportunities)}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'='*60}\n")

    sent_count = 0
    skip_count = 0
    fail_count = 0
    no_contact_count = 0

    for i, opp in enumerate(opportunities):
        if limit and sent_count >= limit:
            print(f"\nReached limit of {limit} sends. Stopping.")
            break

        source = opp.get("source_page", "")
        broken = opp.get("broken_url", "")
        subject = opp.get("subject", "")
        body = opp.get("body", "")
        key = (source, broken)

        # Skip if already sent
        if skip_existing and key in sent_keys:
            skip_count += 1
            continue

        print(f"\n[{i+1}/{len(opportunities)}] {source}")

        # Determine contact email: CSV override > auto-discovery
        csv_email = opp.get("contact_email", "").strip()
        if csv_email:
            to_email = csv_email
            print(f"  Using CSV contact_email column: {to_email}")
        else:
            print(f"  Auto-discovering contact email...")
            to_email = find_contact_email(source)

        if not to_email:
            print(f"  [SKIP] No contact email found")
            no_contact_count += 1
            continue

        # Personalize body with sender name
        from_name = config.get("from_name", "").strip()
        personalized_body = personalize_body(body, from_name)

        # Send
        success = send_email(config, to_email, subject, personalized_body, dry_run)

        if success:
            sent_count += 1
            if not dry_run:
                record = {
                    "source_page": source,
                    "broken_url": broken,
                    "to_email": to_email,
                    "subject": subject,
                    "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                save_sent_record(record)
                print(f"  [SENT] {to_email}")
                if limit is None or sent_count < limit:
                    print(f"  ⏱ Waiting {RATE_LIMIT_SECONDS}s...")
                    time.sleep(RATE_LIMIT_SECONDS)
        else:
            fail_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"  Sent:          {sent_count}")
    print(f"  Skipped (dup): {skip_count}")
    print(f"  No contact:    {no_contact_count}")
    print(f"  Failed:        {fail_count}")
    print(f"{'='*60}\n")

    if dry_run and sent_count > 0:
        print(f"To send for real, run without --dry-run")
        print(f"  python3 scripts/backlink-outreach-sender.py\n")

    if sent_count == 0 and no_contact_count > 0:
        print(f"Tip: Many sites don't list public emails.")
        print(f"      Add a 'contact_email' column to your CSV with known addresses.")
        print(f"      Or try finding them via WHOIS, LinkedIn, or hunter.io\n")

    return True

# ─── Status ───────────────────────────────────────────────────────────

def show_status():
    config = get_config()
    sent = load_sent_db()

    print(f"\n{'='*60}")
    print(f"OUTREACH STATUS")
    print(f"{'='*60}")
    print(f"  SMTP configured: {'Yes' if config['host'] else 'No'}")
    print(f"  Sent emails:     {len(sent)}")

    if sent:
        print(f"  Last sent:       {sent[-1]['sent_at'] if sent else 'Never'}")
        print(f"\n  Recent sends:")
        for r in sent[-5:]:
            print(f"    {r['sent_at']} -> {r['to_email']} ({r['source_page'][:50]}...)")

    print(f"{'='*60}\n")
    return True

# ─── Entry point ──────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Send outreach emails from backlink opportunity CSVs"
    )
    parser.add_argument("--file", help="Path to CSV with outreach opportunities")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    parser.add_argument("--limit", type=int, help="Max number of emails to send")
    parser.add_argument("--status", action="store_true", help="Show outreach status")
    parser.add_argument("--no-skip", action="store_true", help="Re-send already sent")

    args = parser.parse_args()
    load_env()

    if args.status:
        return show_status()

    if args.file:
        csv_path = Path(args.file)
    else:
        reports_dir = PROJECT / "marketing" / "backlink-reports"
        csv_files = sorted(reports_dir.glob("opportunities-*.csv")) if reports_dir.exists() else []
        if not csv_files:
            print("No opportunities CSV found. Run backlink-finder.py first:")
            print('  python3 scripts/backlink-finder.py "youtube seo tools" --output marketing/backlink-reports/opportunities-$(date +%Y-%m-%d).csv')
            return False
        csv_path = csv_files[-1]
        print(f"Using latest report: {csv_path}")

    if not csv_path.exists():
        print(f"File not found: {csv_path}")
        return False

    return run_outreach(
        csv_path,
        dry_run=args.dry_run,
        limit=args.limit,
        skip_existing=not args.no_skip,
    )


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
