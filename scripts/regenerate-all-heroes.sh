#!/usr/bin/env bash
# Regenerate every blog hero + og image with the per-post dashboard scene:
# each hero embeds the post's OWN first inline chart + real stats from the
# post text. Skips secondary "-diagram-hero" images (no matching <slug>.html).
set -u
cd "$(dirname "$0")/.." || exit 1
LOG=/tmp/hero-regen.log
CHARTS=/tmp/hero-charts
mkdir -p "$CHARTS"
: > "$LOG"
COUNT=0
for png in public/blog/*-hero.png; do
  slug="$(basename "$png" -hero.png)"
  html="public/blog/$slug.html"
  [ -f "$html" ] || { echo "SKIP $slug (no $slug.html)" >> "$LOG"; continue; }

  # h1 → two wrapped title lines (one per line so readarray doesn't split)
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

  # extract the post's OWN first content chart + real stats (single helper)
  python3 scripts/extract-hero-data.py "$html" "$CHARTS/$slug.svg" > /tmp/hero-stats-$slug.txt
  STATS="$(cat /tmp/hero-stats-$slug.txt)"
  if [ -s "$CHARTS/$slug.svg" ]; then
    CHART_ARG="--chart=$CHARTS/$slug.svg"
    CHART_SRC="own"
  else
    # old posts predate the visual standard (no inline chart in static HTML):
    # generate a per-post chart (type + palette hashed by slug — see
    # gen-hero-chart.mjs) so every hero is visibly distinct.
    node scripts/gen-hero-chart.mjs "$slug" "$kw" > "$CHARTS/$slug.svg" 2>>"$LOG"
    if [ -s "$CHARTS/$slug.svg" ]; then
      CHART_ARG="--chart=$CHARTS/$slug.svg"
      CHART_SRC="generated"
    else
      CHART_ARG=""
      CHART_SRC="none"
    fi
  fi

  echo "GEN $slug | L1='$L1' L2='$L2' | kw=$kw | chart=$CHART_SRC | stats=$STATS" >> "$LOG"
  node scripts/generate-hero-scene.mjs "$slug" "$L1" "$L2" "$kw" "GUIDE" $CHART_ARG --stats="$STATS" >> "$LOG" 2>&1 || echo "FAIL $slug" >> "$LOG"
  COUNT=$((COUNT+1))
done
echo "DONE: $COUNT heroes regenerated" >> "$LOG"
