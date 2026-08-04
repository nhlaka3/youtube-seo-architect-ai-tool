#!/usr/bin/env python3
"""Batch-run anti-slop Layer 0 scanners over extracted blog text.

Usage: python3 batch_slop_scan.py
Writes per-scan aggregate text+json to /tmp/slop/scans/ and a summary table to stdout.
"""
import json
import os
import subprocess
import sys

SCRIPTS = "/home/nhlaka/.hermes/skills/anti-slop/anti-slop-brain/scripts"
TEXTDIR = "/tmp/slop/blogtext"
OUTDIR = "/tmp/slop/scans"
os.makedirs(OUTDIR, exist_ok=True)

SCANNERS = [
    ("scan_residue.py", []),
    ("scan_placeholders.py", []),
    ("scan_refs.py", []),      # offline by default
    ("lint_voice.py", []),
]

files = sorted(os.path.join(TEXTDIR, f) for f in os.listdir(TEXTDIR) if f.endswith(".txt"))
print(f"Scanning {len(files)} files with {len(SCANNERS)} scanners\n")

summary = []
for name, extra in SCANNERS:
    for fmt in ("text", "json"):
        outfile = f"{OUTDIR}/{name.replace('.py','')}.{fmt}"
        cmd = ["python3", f"{SCRIPTS}/{name}", f"--format", fmt] + extra + files
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            out = r.stdout
            if fmt == "json":
                # json tallies per file
                with open(outfile + ".protected", "w") as f:
                    f.write(out)
        except subprocess.TimeoutExpired:
            print(f"[TIMEOUT] {name}")
            continue
    # read text format result
    txt_f = f"{OUTDIR}/{name.replace('.py','')}.txt"
    r = subprocess.run(
        ["python3", f"{SCRIPTS}/{name}", "--format", "text"] + extra + files,
        capture_output=True, text=True, timeout=600)
    with open(txt_f, "w") as f:
        f.write(r.stdout)
    print(f"### {name}  exit={r.returncode}  (output: {len(r.stdout)} chars)")

print("\nDone. Aggregate text outputs in /tmp/slop/scans/")