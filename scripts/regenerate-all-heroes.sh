#!/usr/bin/env bash
# Regenerate every blog hero + og image with the dashboard-scene generator.
# Skips secondary "-diagram-hero" images (no matching <slug>.html) and generic heroes.
set -u
cd "$(dirname "$0")/.." || exit 1
LOG=/tmp/hero-regen.log
: > "$LOG"
COUNT=0
for png in public/blog/*-hero.png; do
  slug="$(basename "$png" -hero.png)"
  html="public/blog/$slug.html"
  [ -f "$html" ] || { echo "SKIP $slug (no $slug.html)" >> "$LOG"; continue; }
  # h1 → two wrapped title lines (strip tags/entities); one per line so bash
  # readarray doesn't split on spaces inside the title
  readarray -t LINES < <(python3 - "$html" <<'PY'
import sys, re, html as H
raw = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
m = re.search(r'<h1[^>]*>(.*?)</h1>', raw, re.S | re.I)
t = H.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip() if m else ''
def wrap2(s, maxw=52):
    lines = ['']
    for w in s.split():
        if len(lines[-1]) + len(w) + 1 <= maxw:
            lines[-1] = (lines[-1] + ' ' + w).strip()
        else:
            lines.append(w)
    if len(lines) > 2:
        lines[1] = ' '.join(lines[1:])
    while len(lines) < 2:
        lines.append('')
    return lines[0][:56], lines[1][:56]
a, b = wrap2(t)
print(a)
print(b)
PY
)
  L1="${LINES[0]:-}"
  L2="${LINES[1]:-}"
  # keyword chip: slug words minus year + stopwords
  kw="$(echo "$slug" | tr '-' ' ' | sed -E 's/\b(2026|2025|2024|2023|2022|how|to|for|and|the|a|in|on|of|guide|tips)\b//g' | tr -s ' ' | sed 's/^ //;s/ $//')"
  [ -z "$kw" ] && kw="$slug"
  echo "GEN $slug | L1=$L1 | L2=$L2 | kw=$kw" >> "$LOG"
  node scripts/generate-hero-scene.mjs "$slug" "$L1" "$L2" "$kw" "GUIDE" >> "$LOG" 2>&1 || echo "FAIL $slug" >> "$LOG"
  COUNT=$((COUNT+1))
done
echo "DONE: $COUNT heroes regenerated" >> "$LOG"
