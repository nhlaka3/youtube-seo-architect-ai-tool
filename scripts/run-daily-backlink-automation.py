#!/usr/bin/env python3
"""
scripts/run-daily-backlink-automation.py

Runs all automated backlink-generation tasks in sequence:
1. auto-internal-links.mjs — adds related posts links to blog
2. generate-comparisons.mjs — generates /vs/ comparison pages
3. google-indexing.mjs — submits new pages to Google Indexing API
4. competitor-backlink-replicator.py — finds sites linking competitors but not us

Weekly tasks (run separately):
  bash scripts/weekly-backlink-cron.sh

Usage:
  python3 scripts/run-daily-backlink-automation.py              # Run all
  python3 scripts/run-daily-backlink-automation.py --dry-run    # Preview only
  python3 scripts/run-daily-backlink-automation.py --status     # Check status
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent

STATUS_DB = PROJECT / "marketing" / "backlink-reports" / "auto-run-status.json"


def run_node_script(script_name, args=None):
    """Run a Node.js script and return (success, output)."""
    script_path = PROJECT / "scripts" / script_name
    cmd = ["node", str(script_path)]
    if args:
        cmd.extend(args)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=PROJECT,
        )
        output = result.stdout + result.stderr
        if result.returncode == 0:
            return True, output
        else:
            return False, output
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"
    except Exception as e:
        return False, str(e)


def run_google_indexing(args=None):
    """Run the Google Indexing API script."""
    key_path = os.getenv("GOOGLE_INDEXING_KEY", "")
    if not key_path:
        # Check if file exists at default location
        default_key = PROJECT / "config" / "google-indexing-key.json"
        if default_key.exists():
            key_path = str(default_key)
        else:
            return False, "GOOGLE_INDEXING_KEY not set and no key file found at config/google-indexing-key.json"

    env = os.environ.copy()
    env["GOOGLE_INDEXING_KEY"] = key_path

    script = PROJECT / "scripts" / "google-indexing.mjs"
    cmd = ["node", str(script), "--submit-latest"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=PROJECT,
            env=env,
        )
        output = result.stdout + result.stderr
        if result.returncode == 0:
            return True, output
        else:
            return False, output
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"
    except Exception as e:
        return False, str(e)


def log_status(results):
    """Log run results to status DB."""
    STATUS_DB.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "timestamp": datetime.now().isoformat(),
        "results": results,
    }

    if STATUS_DB.exists():
        data = json.loads(STATUS_DB.read_text())
    else:
        data = {"runs": []}

    data["runs"].append(entry)
    # Keep only last 30 entries
    data["runs"] = data["runs"][-30:]
    STATUS_DB.write_text(json.dumps(data, indent=2))


def show_status():
    """Display recent automation run status."""
    if not STATUS_DB.exists():
        print("No automation runs recorded yet.")
        return True

    data = json.loads(STATUS_DB.read_text())
    runs = data.get("runs", [])

    print(f"\n{'='*60}")
    print(f"BACKLINK AUTOMATION STATUS")
    print(f"{'='*60}")
    print(f"  Total runs: {len(runs)}")

    if runs:
        last = runs[-1]
        print(f"  Last run:   {last['timestamp']}")
        print(f"\n  Last results:")
        for task_name, result in last.get("results", {}).items():
            status = "✅" if result.get("success") else "❌"
            detail = result.get("detail", "")[:100]
            print(f"    {status} {task_name}: {detail}")

    print(f"{'='*60}")
    return True


def run_python_script(script_name, args=None):
    """Run a Python script and return (success, output)."""
    script_path = PROJECT / "scripts" / script_name
    cmd = [sys.executable, str(script_path)]
    if args:
        cmd.extend(args)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=PROJECT,
        )
        output = result.stdout + result.stderr
        if result.returncode == 0:
            return True, output
        else:
            return False, output
    except subprocess.TimeoutExpired:
        return False, "TIMEOUT"
    except Exception as e:
        return False, str(e)


def run_all(dry_run=False):
    """Run all automation tasks."""
    results = {}

    print(f"\n{'='*60}")
    print(f"BACKLINK AUTOMATION RUN")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'='*60}\n")

    # 1. Internal links
    print("Task 1/4: Auto internal links...")
    if dry_run:
        success, output = run_node_script("auto-internal-links.mjs", ["--dry-run"])
        results["auto-internal-links"] = {"success": True, "detail": "Dry-run mode"}
    else:
        success, output = run_node_script("auto-internal-links.mjs")
        results["auto-internal-links"] = {"success": success, "detail": output[:200] if not success else "OK"}
    print(f"  {'✅' if success else '❌'} {'Done' if success else output[:200]}")

    # 2. Comparison pages
    print("Task 2/4: Comparison pages...")
    if dry_run:
        success, output = run_node_script("generate-comparisons.mjs", ["--list"])
        results["generate-comparisons"] = {"success": True, "detail": "Dry-run mode"}
    else:
        success, output = run_node_script("generate-comparisons.mjs")
        results["generate-comparisons"] = {"success": success, "detail": output[:200] if not success else "OK"}
    print(f"  {'✅' if success else '❌'} {'Done' if success else output[:200]}")

    # 3. Auto-Index (submit latest blog + core pages only, not all 86)
    print("Task 3/4: Auto-index (latest blog + core pages)...")
    if dry_run:
        results["auto-index"] = {"success": True, "detail": "Dry-run mode"}
    else:
        success, output = run_node_script("auto-index.mjs", ["--url", "https://yt-seo-architect.vercel.app/"])
        blog_success, blog_output = run_node_script("google-indexing.mjs", ["--submit-latest"])
        results["auto-index"] = {"success": success or blog_success, "detail": "Submitted core pages"}
    print(f"  {'✅' if success else '❌'} {'Done' if success else output[:200]}")

    # 4. Competitor backlink replicator (find sites linking competitors but not us)
    print("Task 4/4: Competitor backlink replicator...")
    if dry_run:
        success, output = run_python_script("competitor-backlink-replicator.py", ["--dry-run"])
        results["competitor-backlink-replicator"] = {"success": True, "detail": "Dry-run mode"}
    else:
        success, output = run_python_script("competitor-backlink-replicator.py", ["--pages", "10"])
        results["competitor-backlink-replicator"] = {"success": success, "detail": output[:200] if not success else "OK"}
    print(f"  {'✅' if success else '❌'} {'Done' if success else output[:200]}")

    # Save status
    if not dry_run:
        log_status(results)

    # Summary
    success_count = sum(1 for r in results.values() if r["success"])
    print(f"\n{'='*60}")
    print(f"SUMMARY: {success_count}/4 tasks completed")
    print(f"{'='*60}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Run daily backlink automation tasks"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--status", action="store_true", help="Show run history")

    args = parser.parse_args()

    if args.status:
        return show_status()
    else:
        return run_all(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
