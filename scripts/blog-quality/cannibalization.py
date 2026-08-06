#!/usr/bin/env python3
"""
scripts/blog-quality/cannibalization.py

Keyword cannibalization detection for YT SEO Architect blog posts.
Local-only (no API keys). Extracts primary keyword candidates from each
post's title/H1/H2s/meta description, clusters posts by overlap
(exact → stem → subset → shared word), and flags competing pairs.

Usage:
  python3 scripts/blog-quality/cannibalization.py [--dir public/blog] [--min-overlap 2]
  python3 scripts/blog-quality/cannibalization.py --json -o /tmp/cannibalization.json

Output: severity-scored clusters with merge/differentiate recommendations.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "for", "with", "your", "you", "to",
    "of", "in", "on", "at", "by", "is", "are", "was", "were", "be", "how",
    "what", "why", "can", "do", "does", "get", "make", "use", "using", "best",
    "top", "tips", "guide", "2026", "2025", "2024", "complete", "this", "that",
    "from", "into", "over", "under", "about", "more", "most", "it", "its",
    "not", "no", "so", "than", "then", "as", "has", "have", "had",
}

STEM_RULES = [
    (re.compile(r"optimiz(s|e|ation|ing)$"), "optimize"),
    (re.compile(r"strateg(y|ies)$"), "strategy"),
    (re.compile(r"grow(s|ing|th)?$"), "growth"),
    (re.compile(r"monetiz(s|e|ation|ing)$"), "monetize"),
    (re.compile(r"traffic$"), "traffic"),
    (re.compile(r"rank(s|ing)?$"), "rank"),
    (re.compile(r"view(s)?$"), "views"),
    (re.compile(r"subscriber(s)?$"), "subscribers"),
    (re.compile(r"video(s)?$"), "video"),
    (re.compile(r"channel(s)?$"), "channel"),
    (re.compile(r"content$"), "content"),
    (re.compile(r"algorithm(s)?$"), "algorithm"),
    (re.compile(r"keyword(s)?$"), "keyword"),
    (re.compile(r"title(s)?$"), "title"),
    (re.compile(r"thumbnail(s)?$"), "thumbnail"),
    (re.compile(r"seo$"), "seo"),
    (re.compile(r"youtube$"), "youtube"),
    (re.compile(r"engag(ing|ement)?$"), "engage"),
]

# Site-context words that every post shares — useless for overlap detection.
CONTEXT_WORDS = {"youtube", "seo", "video", "channel"}

# Topic words — real differentiation signals for this corpus. Pairs that
# share these are genuinely competing for the same search intent.
TOPIC_WORDS = {
    "thumbnail", "title", "tag", "keyword", "description", "ctr",
    "algorithm", "rank", "retention", "watch", "impression",
    "monetize", "revenue", "sponsorship", "adsense", "ypp", "affiliate",
    "analytics", "metric", "traffic", "impression",
    "gaming", "shorts", "live", "tutorial", "vlog", "podcast", "education",
    "subscriber", "growth", "branding", "community", "engage", "audience",
    "calendar", "schedule", "visibility", "strategy", "thumbnails",
    "beginner", "hook", "script", "story", "brand",
}

# Broad niche words that legitimately appear across many posts. Sharing ONLY
# these (without a specific topic) is not cannibalization.
GENERIC_TOPICS = {
    "growth", "strategy", "content", "visibility", "engage", "audience",
    "brand", "branding", "community", "calendar", "beginner", "schedule",
    "subscriber", "creator",
}

SPECIFIC_TOPICS = TOPIC_WORDS - GENERIC_TOPICS


def stem(word: str) -> str:
    w = word.lower().strip("():!?.,'\"")
    if w in STOPWORDS:
        return ""
    if w.isdigit():
        return ""
    for rx, rep in STEM_RULES:
        if rx.match(w):
            return rep
    return w


def tokenize(text: str) -> list[str]:
    return [stem(w) for w in re.findall(r"[A-Za-z0-9]+", text) if stem(w)]


def extract_signal(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    title = ""
    m = re.search(r"<title>([^<]+)</title>", raw, re.IGNORECASE)
    if m:
        title = re.sub(r"\s*—\s*YT SEO Architect.*$", "", m.group(1)).strip()
    h1 = ""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.DOTALL | re.IGNORECASE)
    if m:
        h1 = re.sub(r"<[^>]+>", "", m.group(1)).strip()
    h2s = [re.sub(r"<[^>]+>", "", h).strip()
           for h in re.findall(r"<h2[^>]*>(.*?)</h2>", raw, re.DOTALL | re.IGNORECASE)]
    desc = ""
    m = re.search(r'<meta name="description" content="([^"]*)"', raw, re.IGNORECASE)
    if m:
        desc = m.group(1)

    body_tokens: list[str] = []
    for w in tokenize(" ".join(h2s)):
        body_tokens.append(w)
    primary_pool = []
    for src in (title, h1):
        if src:
            primary_pool += tokenize(src)
    # Score n-grams (2-3 words) from title+H1, weighted
    grams: dict[tuple, int] = defaultdict(int)
    for words in (tokenize(title + " " + h1), tokenize(desc)):
        for n in (2, 3):
            for i in range(len(words) - n + 1):
                gram = tuple(words[i:i + n])
                if all(gram):
                    grams[gram] += 1
    primary = ""
    if grams:
        primary = " ".join(max(grams, key=lambda g: (grams[g], len(g))))
    return {
        "slug": path.stem,
        "title": title,
        "h1": h1,
        "primary": primary,
        "secondary": sorted(set(w for w in body_tokens if w)),
        "tokens": sorted(set(primary_pool)),
    }


def cluster(posts: list[dict]) -> list[dict]:
    """Pair-based cannibalization for narrow posts sharing a topic.

    Two-pass: first compute raw pair signals, then detect hub posts (degree>4)
    and require a HIGHER bar (2+ topic words) for hub-involving pairs. This
    stops broad pillar posts (which mention everything) from drowning out the
    real signal, which is two NARROW posts targeting the same topic
    (thumbnail↔thumbnail, algorithm↔algorithm, gaming↔gaming).
    """
    n = len(posts)
    toks = [set(p["tokens"]) - CONTEXT_WORDS for p in posts]

    def shared_with(i, j):
        return toks[i] & toks[j]

    # Pass 1: rough signals (>=1 topic word shared)
    rough: list[tuple[int, int, set[str]]] = []
    for i in range(n):
        for j in range(i + 1, n):
            s = shared_with(i, j)
            if s & TOPIC_WORDS:
                rough.append((i, j, s))

    degree = {i: 0 for i in range(n)}
    for i, j, _ in rough:
        degree[i] += 1
        degree[j] += 1

    # Pass 2:
    #  - narrow-narrow pairs: >=1 SPECIFIC topic, or >=2 GENERIC topics
    #  - hub-involving pairs: >=2 SPECIFIC topics (broad pillar posts mention
    #    everything — sharing one topic with them is expected, not a clash)
    pairs: list[tuple[dict, dict, float, list[str]]] = []
    for i, j, s in rough:
        both_narrow = degree[i] <= 4 and degree[j] <= 4
        specific = s & SPECIFIC_TOPICS
        generic = s & GENERIC_TOPICS
        if both_narrow:
            if not specific and len(generic) < 2:
                continue
        else:
            if len(specific) < 2:
                continue
        score = (len(specific) * 0.4) + (len(generic) * 0.15)
        pairs.append((posts[i], posts[j], round(min(1.0, score), 2), sorted(s)))
    if not pairs:
        return []

    # Connected components of the pair graph
    adj: dict[int, set[int]] = {i: set() for i in range(n)}
    for a, b, sc, shared in pairs:
        ia, ib = posts.index(a), posts.index(b)
        adj[ia].add(ib)
        adj[ib].add(ia)

    used: set[int] = set()
    clusters: list[list[dict]] = []
    for i in range(n):
        if i in used:
            continue
        stack = [i]
        comp = []
        while stack:
            x = stack.pop()
            if x in used:
                continue
            used.add(x)
            comp.append(posts[x])
            stack.extend(adj[x] - used)
        if len(comp) >= 2:
            clusters.append(comp)
    return clusters


def overlap(p: dict, q: dict) -> tuple[bool, float, list[str]]:
    """Return (is_overlap, score, shared_terms). Context words ignored.

    Real signals require 2+ shared terms where at least one is a TOPIC_WORDS
    term (thumbnail, algorithm, gaming, monetize, ...). Generic shared verbs
    (creating, improving) alone do not count — the whole corpus shares them.
    """
    if p["primary"] and p["primary"] == q["primary"]:
        return True, 1.0, [p["primary"]]
    p_tok = set(p["tokens"]) - CONTEXT_WORDS
    q_tok = set(q["tokens"]) - CONTEXT_WORDS
    shared = p_tok & q_tok
    if len(shared) >= 2 and shared & TOPIC_WORDS:
        score = (len(shared & TOPIC_WORDS) * 0.35) + (len(shared - TOPIC_WORDS) * 0.1)
        return True, round(min(1.0, score), 2), sorted(shared)
    # subset: primary of one is contained in the other's token set
    for a, b in ((p, q), (q, p)):
        if a["primary"]:
            a_toks = set(a["primary"].split()) - CONTEXT_WORDS
            if len(a_toks) >= 2 and a_toks <= q_tok and a_toks & TOPIC_WORDS:
                return True, 0.7, list(a_toks)
    return False, 0.0, []


def severity(score: float) -> str:
    if score >= 0.9:
        return "CRITICAL"
    if score >= 0.6:
        return "HIGH"
    if score >= 0.4:
        return "MEDIUM"
    return "LOW"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default="public/blog", help="Blog HTML directory")
    ap.add_argument("--json", action="store_true", help="JSON output")
    ap.add_argument("-o", "--output", help="Write report to path")
    args = ap.parse_args()

    d = Path(args.dir)
    files = sorted(d.glob("*.html"))
    files = [f for f in files if not f.name.startswith("_")]
    posts = [extract_signal(f) for f in files]

    clusters = cluster(posts)
    report = {"total_posts": len(posts), "clusters": []}
    toksets = {p["slug"]: set(p["tokens"]) - CONTEXT_WORDS for p in posts}
    for group in clusters:
        pairs = []
        max_score = 0.0
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                shared = toksets[a["slug"]] & toksets[b["slug"]]
                specific = shared & SPECIFIC_TOPICS
                generic = shared & GENERIC_TOPICS
                if not specific and len(generic) < 2:
                    continue
                sc = round(min(1.0, (len(specific) * 0.4) + (len(generic) * 0.15)), 2)
                pairs.append({
                    "a": a["slug"], "b": b["slug"],
                    "score": sc, "shared_terms": sorted(shared),
                })
                max_score = max(max_score, sc)
        report["clusters"].append({
            "severity": severity(max_score),
            "posts": [p["slug"] for p in group],
            "primary_keywords": [p["primary"] for p in group],
            "pairs": sorted(pairs, key=lambda x: -x["score"]),
            "recommendation": (
                "MERGE or differentiate: rewrite one post to target a distinct intent "
                "(e.g., one becomes a comparison, one becomes a tutorial)."
                if max_score >= 0.6 else
                "DIFFERENTIATE: add a distinct angle/year/audience to each post."
            ),
        })

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        if args.json:
            out.write_text(json.dumps(report, indent=2))
        else:
            out.write_text(render_md(report))
        print(f"Report saved to {out}")
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render_md(report))
    return 0


def render_md(report: dict) -> str:
    lines = [f"# Blog Cannibalization Report\n",
             f"**Posts analyzed:** {report['total_posts']}  \n"]
    if not report["clusters"]:
        lines.append("\nNo overlapping clusters detected. ✅\n")
        return "\n".join(lines)
    for i, c in enumerate(report["clusters"], 1):
        lines.append(f"\n## Cluster {i} — {c['severity']}")
        lines.append(f"- Posts: {', '.join(c['posts'])}")
        lines.append(f"- Primary keywords: {', '.join(c['primary_keywords'])}")
        for p in c["pairs"]:
            lines.append(f"  - `{p['a']}` ↔ `{p['b']}` (score {p['score']}, shared: {', '.join(p['shared_terms'])})")
        lines.append(f"- Recommendation: {c['recommendation']}")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
