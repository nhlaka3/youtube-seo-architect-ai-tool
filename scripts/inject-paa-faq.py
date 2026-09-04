#!/usr/bin/env python3
"""Inject PAA-mined questions into best-fit pages' existing FAQ sections.

For each PAA cluster, appends up to 3 unanswered questions (with concise
answers) to the target page's <section class="faq"> as <details> pairs.
Skips questions already present in the page. Idempotent per question.

Usage: python3 scripts/inject-paa-faq.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path("/mnt/c/Users/nhlaka/Desktop/Youtube seo tool")
DATA = ROOT / "marketing" / "dataforseo"

# PAA cluster -> target page + answer templates
TARGETS = {
    "youtube shorts seo": ("public/blog/youtube-shorts-seo-guide-2026.html", {
        "do youtube shorts help with seo": "Yes. Shorts are indexed by YouTube search and the Shorts shelf. Keywords in titles and descriptions help them surface for relevant queries.",
        "do youtube shorts get more views": "Shorts get algorithmic distribution through the Shorts shelf, which can produce more views faster than long-form for new channels.",
        "can i disable shorts on youtube": "You can filter Shorts out of your feed, but YouTube still recommends them. There is no global off-switch for the Shorts feed itself.",
    }),
    "youtube analytics report": ("public/blog/youtube-analytics-dashboard-setup-2026.html", {
        "how to check my youtube analytics": "Open YouTube Studio, select Analytics in the left menu, and use the Overview tab to see views, watch time, and revenue at a glance.",
        "are youtube analytics accurate": "YouTube Analytics counts views and watch time from server-side data, so it is highly accurate for totals; small delays of a few hours can occur.",
        "how to download youtube analytics report": "In YouTube Studio Analytics, set your date range, then click Download report (CSV) to export the full dataset for offline analysis.",
    }),
    "youtube monetization rates": ("public/blog/youtube-monetization-2026.html", {
        "what is the youtube monetization rate": "The YouTube monetization rate (RPM) varies by niche, typically $1-$10 RPM; gaming and entertainment run lower, finance and tech higher.",
        "how much money per 1000 views youtube": "Average payout is $1-$3 per 1,000 views (RPM), before revenue share. Actual earnings depend on niche, geography, and ad formats.",
    }),
    "youtube channel monetization checker": ("public/blog/youtube-monetization-2026.html", {
        "how to check if a youtube channel is monetized": "Look for the monetization badge or check the channel's About page; if the creator shows 'member-only' perks, the channel is likely monetized.",
    }),
    "youtube end cards": ("public/blog/youtube-end-screens-cards-guide-2026.html", {
        "how to add end cards to youtube video": "In YouTube Studio, open your video, select Editor, then End screen. Drag in the element (video, playlist, subscribe) and position it in the timeline.",
        "what is an end card on youtube": "An end card is an interactive element shown in the final seconds of a video that links to other videos, playlists, channels, or subscribe buttons.",
    }),
    "youtube end screen template": ("public/blog/youtube-end-screens-cards-guide-2026.html", {
        "how to make a youtube end screen template": "Use a design tool (Canva, Photoshop) to build a branded 1920x1080 end-screen background, then overlay your cards in YouTube Studio's editor.",
    }),
    "youtube video description template": ("public/blog/youtube-description-templates-2026.html", {
        "how to write a youtube video description": "Start with a keyword-rich first 150 characters, add a 2-3 sentence summary, timestamps, links, and hashtags, then close with a CTA.",
        "what should a youtube description include": "Include your primary keyword early, a clear summary, chapters/timestamps, social links, and 3-5 relevant hashtags for discovery.",
    }),
    "youtube video optimization": ("public/blog/youtube-optimization-for-new-channels-in-2026.html", {
        "what is youtube video optimization": "Video optimization means structuring title, description, tags, thumbnail, and metadata so YouTube's algorithm understands and ranks your content.",
    }),
    "youtube playlist settings": ("public/blog/youtube-playlist-optimization-strategy.html", {
        "how to make a playlist on youtube": "In YouTube Studio, go to Playlists, click New playlist, name it, add videos, and set visibility to Public to make it discoverable.",
    }),
}

def main():
    paa_files = sorted(DATA.glob("paa-free-*.json"))
    if not paa_files:
        print("No paa-free-*.json — run mine-paa-free.py first")
        sys.exit(1)
    paa = json.loads(paa_files[-1].read_text(encoding="utf-8"))

    for cluster, (rel, answers) in TARGETS.items():
        qs = paa.get(cluster, [])
        if not qs:
            print(f"⏭ {cluster}: no mined questions")
            continue
        p = ROOT / rel
        if not p.exists():
            print(f"✗ {rel}: file not found")
            continue
        t = p.read_text(encoding="utf-8", errors="ignore")
        # find FAQ section
        m = re.search(r'(<section class="faq"[^>]*>\s*<h2>[^<]*</h2>)', t)
        if not m:
            print(f"✗ {rel}: no FAQ section found")
            continue
        insert_at = m.end()
        added = 0
        blocks = []
        for q in qs:
            q_clean = q.rstrip("?").strip()
            if q_clean.lower() in t.lower():
                continue  # already present
            ans = answers.get(q.lower())
            if not ans:
                continue
            block = (
                f'\n      <details open>\n'
                f'        <summary>{q_clean}?</summary>\n'
                f'        <div class="faq-answer">\n'
                f'          <p>{ans}</p>\n'
                f'        </div>\n'
                f'      </details>'
            )
            blocks.append(block)
            added += 1
            if added >= 3:
                break
        if not blocks:
            print(f"⏭ {rel}: all questions already present or no answers")
            continue
        t2 = t[:insert_at] + "\n" + "\n".join(blocks) + t[insert_at:]
        p.write_text(t2, encoding="utf-8")
        print(f"✓ {rel}: +{added} PAA questions ({cluster})")

    print("\n✅ FAQ injection complete")

if __name__ == "__main__":
    main()
