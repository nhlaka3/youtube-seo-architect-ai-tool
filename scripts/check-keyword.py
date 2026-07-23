#!/usr/bin/env python3
"""YouTube Keyword Competition Checker + Demand Score — FULLY AUTOMATIC + DEDUP
=================================================================================
- Searches DuckDuckGo, analyzes SERP competition
- Google Suggest autocomplete API for search DEMAND estimation
- Combined Rankability Score = (Competition + Demand) / 2
- Filters out zero-demand keywords (the trap we were falling into)
- Generates keyword ideas from YouTube topics
- Checks against existing blog posts (no duplicates)
- Scores and ranks: pick the best untargeted keyword

USAGE:
  python3 scripts/check-keyword.py "youtube description templates 2026"         # Check one
  python3 scripts/check-keyword.py --suggest "youtube growth"                    # Generate ideas
  python3 scripts/check-keyword.py --suggest "youtube seo" --check 5            # Generate + check top 5
  python3 scripts/check-keyword.py --audit                                        # Find gaps in coverage
"""

import sys
import json
import urllib.request
import urllib.parse
import re
import os
from datetime import datetime

KNOWN_BRANDS = [
    'youtube.com', 'google.com', 'ahrefs.com', 'semrush.com', 'hubspot.com',
    'neilpatel.com', 'backlinko.com', 'moz.com', 'vidiq.com', 'tubebuddy.com',
    'blog.google', 'support.google.com', 'wikipedia.org', 'reddit.com',
    'quora.com', 'medium.com', 'canva.com', 'hootsuite.com', 'forbes.com',
    'entrepreneur.com', 'businessinsider.com', 'shopify.com', 'wix.com'
]

YOUTUBE_TOPICS = {
    'seo': ['seo', 'ranking', 'search', 'keywords', 'tags', 'metadata', 'description', 'title', 'optimization'],
    'growth': ['subscribers', 'views', 'growth', 'viral', 'algorithm', 'monetization', 'analytics', 'impressions'],
    'content': ['script', 'ideas', 'niche', 'trending', 'planning', 'calendar', 'series', 'playlist'],
    'production': ['editing', 'thumbnail', 'lighting', 'camera', 'audio', 'recording', 'livestream', 'shorts'],
    'engagement': ['comments', 'community', 'ctr', 'retention', 'watch time', 'likes', 'shares', 'end screen'],
}

MODIFIERS = ['template', 'guide', 'tutorial', 'tips', 'checklist', 'examples', 
             'for beginners', '2026', 'free', 'best', 'how to', 'step by step',
             'for small channels', 'for gaming', 'for vlogs', 'for tutorials']


# ═══════════════════════════════════════════════════════════════
# NEW: Google Suggest Demand Estimation
# ═══════════════════════════════════════════════════════════════

def get_google_suggestions(query):
    """Query Google Suggest autocomplete API and return suggestions list.
    
    If Google returns 0 suggestions → the keyword has near-zero search volume.
    More suggestions = higher relative demand.
    """
    url = 'http://suggestqueries.google.com/complete/search?client=firefox&q=' + urllib.parse.quote(query)
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        # Response format: [query, [suggestions...], ...]
        suggestions = data[1] if len(data) > 1 else []
        return suggestions
    except Exception as e:
        return None


def estimate_demand_score(keyword, suggestions):
    """Calculate a demand score (0-100) from Google Suggest data.
    
    Free proxy for search volume:
    - 0 suggestions  → 0-10  (ZERO demand — skip these!)
    - 1-3 suggestions → 15-35 (LOW demand)
    - 4-7 suggestions → 40-65 (MEDIUM demand)
    - 8-10 suggestions → 70-100 (HIGH demand)
    
    Bonus: If the exact keyword appears as a suggestion itself, boost score.
    Penalty: If no suggestions at all, score stays near zero.
    """
    if suggestions is None:
        return None, "Google Suggest API failed (no internet?)"
    
    if not suggestions:
        return 5, "ZERO suggestions — keyword has virtually no search volume"
    
    count = len(suggestions)
    keyword_lower = keyword.lower()
    
    # Base score from suggestion count
    if count <= 1:
        base = 10 + (count * 10)  # 10 or 20
    elif count <= 3:
        base = 25 + ((count - 1) * 10)  # 35, 45
    elif count <= 7:
        base = 50 + ((count - 3) * 8)  # 50-82
    else:
        base = 75 + min((count - 7) * 5, 25)  # 75-100
    
    # Check if the exact keyword appears in suggestions (strong demand signal)
    exact_boost = 0
    for s in suggestions:
        if keyword_lower in s.lower():
            exact_boost = 10
            break
    
    # Penalize extremely long-tail keywords that don't autocomplete naturally
    word_count = len(keyword.split())
    length_penalty = 0
    if word_count >= 6:
        length_penalty = -10
    elif word_count >= 5:
        length_penalty = -5
    
    final_score = max(0, min(100, base + exact_boost + length_penalty))
    
    # Generate human-readable assessment
    if final_score < 15:
        rating = f"ZERO demand ({count} suggestions) — people don't search this"
    elif final_score <= 30:
        rating = f"LOW demand ({count} suggestions) — narrow audience"
    elif final_score <= 55:
        rating = f"MEDIUM demand ({count} suggestions) — decent search volume"
    elif final_score <= 75:
        rating = f"HIGH demand ({count} suggestions) — good search volume"
    else:
        rating = f"VERY HIGH demand ({count} suggestions) — people actively search this"
    
    return final_score, rating


def estimate_serp_results_count(html):
    """Extract approximate result count from DuckDuckGo HTML response."""
    # Try to find the result count in various formats
    patterns = [
        r'About ([\d,]+) results',
        r'([\d,]+) results',
        r'of about ([\d,]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return int(match.group(1).replace(',', ''))
    return None


# ═══════════════════════════════════════════════════════════════
# EXISTING: DuckDuckGo Search + SERP Analysis
# ═══════════════════════════════════════════════════════════════

def search_duckduckgo(query, num=10):
    """Search DuckDuckGo and return structured results."""
    url = 'https://html.duckduckgo.com/html/'
    data = urllib.parse.urlencode({'q': query}).encode()
    
    req = urllib.request.Request(url, data=data, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')
    except Exception as e:
        return None, None, f"Search failed: {e}"
    
    results = []
    blocks = re.findall(r'<a rel="nofollow" class="result__a" href="(.*?)">(.*?)</a>', html)
    snippets = re.findall(r'<a class="result__snippet" .*?>(.*?)</a>', html)
    
    for i, (url, title_html) in enumerate(blocks[:num]):
        title = re.sub(r'<.*?>', '', title_html)
        snippet = re.sub(r'<.*?>', '', snippets[i]) if i < len(snippets) else ''
        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', url)
        domain = domain_match.group(1) if domain_match else url
        results.append({'title': title.strip(), 'url': url.strip(), 'domain': domain.strip(), 'snippet': snippet.strip()})
    
    # Estimate result count
    result_count = estimate_serp_results_count(html)
    
    return results, result_count, None


def analyze_serp(results, keyword, result_count=None):
    """Analyze SERP results for competition signals."""
    if not results:
        return {'error': 'No results found'}
    
    keyword_lower = keyword.lower()
    signals = []
    
    brand_count = sum(1 for r in results if any(b in r['domain'].lower() for b in KNOWN_BRANDS))
    if brand_count >= 5:
        signals.append({'name': 'Brand dominance', 'score': -30, 'detail': f'{brand_count}/{len(results)} big brands'})
    elif brand_count >= 3:
        signals.append({'name': 'Moderate brands', 'score': -15, 'detail': f'{brand_count}/{len(results)} big brands'})
    else:
        signals.append({'name': 'Low brand competition', 'score': +15, 'detail': f'Only {brand_count}/{len(results)} big brands'})
    
    exact_matches = sum(1 for r in results if keyword_lower in r['title'].lower())
    if exact_matches >= 7:
        signals.append({'name': 'Title saturated', 'score': -15, 'detail': f'{exact_matches}/{len(results)} exact match'})
    elif exact_matches >= 4:
        signals.append({'name': 'Moderate match', 'score': -5, 'detail': f'{exact_matches}/{len(results)} exact match'})
    else:
        signals.append({'name': 'Weak title competition', 'score': +15, 'detail': f'Only {exact_matches}/{len(results)} target this'})
    
    word_count = len(keyword.split())
    if word_count >= 5:
        signals.append({'name': 'Very long-tail', 'score': +20, 'detail': f'{word_count} words'})
    elif word_count >= 4:
        signals.append({'name': 'Long-tail', 'score': +15, 'detail': f'{word_count} words'})
    elif word_count >= 3:
        signals.append({'name': 'Moderate', 'score': +5, 'detail': '3 words'})
    else:
        signals.append({'name': 'Broad', 'score': -15, 'detail': '1-2 words — competitive'})
    
    info_words = ['how', 'what', 'why', 'guide', 'tutorial', 'template', 'tips', 'learn', 'examples', 'ideas']
    commercial_words = ['best', 'top', 'review', 'cheap', 'buy', 'price', 'vs']
    info_hits = sum(1 for w in info_words if w in keyword_lower)
    commercial_hits = sum(1 for w in commercial_words if w in keyword_lower)
    if info_hits > commercial_hits:
        signals.append({'name': 'Informational intent', 'score': +10, 'detail': 'Content-friendly query'})
    elif commercial_hits > info_hits:
        signals.append({'name': 'Commercial intent', 'score': -10, 'detail': 'Review/affiliate dominated'})
    
    niche_words = ['youtube', 'tiktok', 'shorts', 'podcast', 'vlog', 'thumbnail', 'seo', 'instagram']
    niche_hits = [w for w in niche_words if w in keyword_lower]
    if niche_hits:
        signals.append({'name': 'Niche-specific', 'score': +10, 'detail': f'Contains: {", ".join(niche_hits)}'})
    
    years = re.findall(r'\b20\d{2}\b', keyword)
    if years:
        signals.append({'name': 'Year-targeted', 'score': +10, 'detail': f'Targeting {years[0]}'})
    
    # ═══ NEW: SERP result count signal ═══
    if result_count and result_count > 0:
        if result_count >= 50000000:  # 50M+ results = very competitive topic
            signals.append({'name': 'SERP volume', 'score': -10, 'detail': f'~{result_count:,} results — very popular topic'})
        elif result_count >= 10000000:  # 10M-50M
            signals.append({'name': 'SERP volume', 'score': 0, 'detail': f'~{result_count:,} results — popular topic'})
        elif result_count >= 1000000:  # 1M-10M
            signals.append({'name': 'SERP volume', 'score': +5, 'detail': f'~{result_count:,} results — moderate topic'})
        else:  # < 1M
            signals.append({'name': 'SERP volume', 'score': +10, 'detail': f'~{result_count:,} results — niche topic'})
    
    base_score = 50
    total = sum(s['score'] for s in signals)
    competition_score = max(0, min(100, base_score + total))
    
    return {
        'keyword': keyword,
        'competition_score': competition_score,
        'signals': signals,
        'top_results': results[:3],
        'result_count': result_count
    }


def load_existing_posts():
    """Read blog.html and sitemap to find topics we've already covered."""
    covered = set()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(script_dir)
    
    # Check blog.html for existing posts
    blog_path = os.path.join(root, 'blog.html')
    if os.path.exists(blog_path):
        with open(blog_path, 'r') as f:
            content = f.read()
        titles = re.findall(r'<h3><a href="/blog/[^"]*">(.*?)</a></h3>', content)
        for t in titles:
            t_lower = t.lower()
            covered.add(t_lower)
            words = re.findall(r'[a-z]+', t_lower)
            covered.update(w for w in words if len(w) > 3)
    
    # Check sitemap
    sitemap_path = os.path.join(root, 'sitemap.xml')
    if os.path.exists(sitemap_path):
        with open(sitemap_path, 'r') as f:
            content = f.read()
        slugs = re.findall(r'/blog/([^<]+)</loc>', content)
        for s in slugs:
            terms = s.replace('-', ' ').lower().split()
            covered.update(t for t in terms if len(t) > 3 and t not in ['2026', '2025', '2024'])
    
    return covered


def generate_keywords(topic, max_count=20):
    """Generate keyword variations from a YouTube topic."""
    topic_lower = topic.lower()
    ideas = []
    topic_words = topic_lower.split()
    
    category = None
    for cat, words in YOUTUBE_TOPICS.items():
        if any(w in topic_lower for w in words):
            category = cat
            break
    
    if not category:
        category = 'seo'
    
    for modifier in MODIFIERS:
        ideas.append(f"{topic_lower} {modifier}")
    
    for word in YOUTUBE_TOPICS[category]:
        if word not in topic_lower:
            ideas.append(f"{word} {topic_lower}")
    
    for word in YOUTUBE_TOPICS[category]:
        if word not in topic_lower:
            ideas.append(f"how to {word} {topic_lower}")
    
    ideas.append(f"{topic_lower} 2026")
    
    for platform in ['youtube', 'for beginners', 'for creators']:
        if platform not in topic_lower:
            ideas.append(f"{topic_lower} {platform}")
    
    return list(set(ideas))[:max_count]


def print_score_bar(score):
    """Print a visual bar for any score (competition, demand, rankability)."""
    if score is None:
        return "  ⚪ API error"
    blocks = int(score / 10)
    bar = "█" * blocks + "░" * (10 - blocks)
    return f"  [{bar}] {score}/100"


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 scripts/check-keyword.py \"keyword\"             # Check one keyword")
        print("  python3 scripts/check-keyword.py --suggest \"topic\"     # Generate ideas")
        print("  python3 scripts/check-keyword.py --audit                  # Find content gaps")
        sys.exit(1)
    
    # ── AUDIT MODE: Find gaps in blog coverage ──
    if '--audit' in sys.argv:
        print("🔍 AUDIT: Checking blog coverage gaps...\n")
        covered = load_existing_posts()
        print(f"   Found {len(covered)} terms already covered in blog.\n")
        
        print("   Untargeted high-value YouTube keywords:\n")
        opportunities = []
        for category, words in YOUTUBE_TOPICS.items():
            for word in words:
                if word not in covered:
                    kw = f"youtube {word}"
                    opportunities.append((category, kw))
        
        if not opportunities:
            print("   ✅ All major topics covered! Try --suggest for long-tail variations.")
        else:
            for cat, kw in opportunities[:15]:
                print(f"   [{cat.upper()}] {kw}")
        print()
        sys.exit(0)
    
    # ── SUGGEST MODE: Generate keyword ideas ──
    if '--suggest' in sys.argv:
        suggest_idx = sys.argv.index('--suggest')
        topic = sys.argv[suggest_idx + 1] if suggest_idx + 1 < len(sys.argv) else 'youtube'
        
        check_count = 5
        if '--check' in sys.argv:
            check_idx = sys.argv.index('--check')
            if check_idx + 1 < len(sys.argv):
                check_count = int(sys.argv[check_idx + 1])
        
        print(f"\n💡 Generating keywords for: \"{topic}\"\n")
        ideas = generate_keywords(topic)
        
        covered = load_existing_posts()
        
        print(f"   Generated {len(ideas)} variations. Checking competition + demand for top {check_count}...\n")
        
        scored = []
        for kw in ideas[:check_count]:
            kw_words = set(kw.lower().split())
            overlap = len(kw_words & covered)
            if overlap >= 3:
                print(f"   ⏭  \"{kw}\" — SKIPPED (similar to existing post)")
                continue
            
            print(f"   🔍 Checking: \"{kw}\"...", end=' ', flush=True)
            results, result_count, error = search_duckduckgo(kw, 8)
            if error or not results:
                print(f"⚠️  No results")
                continue
            
            # Get demand estimate
            suggestions = get_google_suggestions(kw)
            demand_score, demand_rating = estimate_demand_score(kw, suggestions)
            
            analysis = analyze_serp(results, kw, result_count)
            analysis['demand_score'] = demand_score
            analysis['demand_rating'] = demand_rating
            
            # Calculate combined Rankability Score
            comp = analysis['competition_score']
            dem = demand_score if demand_score is not None else 50  # default to mid if API fails
            analysis['rankability_score'] = (comp + dem) / 2
            
            scored.append(analysis)
            print(f"Rankability: {analysis['rankability_score']:.0f}/100")
        
        scored.sort(key=lambda x: x['rankability_score'], reverse=True)
        
        print(f"\n{'='*65}")
        print(f"   🏆 BEST KEYWORDS TO TARGET (by Rankability):")
        print(f"{'='*65}\n")
        for i, s in enumerate(scored[:10], 1):
            rank = s['rankability_score']
            comp = s['competition_score']
            dem = s['demand_score']
            dem_str = f"{dem}/100" if dem is not None else "N/A"
            
            if rank >= 70:
                emoji = '🟢'
            elif rank >= 50:
                emoji = '🟡'
            elif rank >= 35:
                emoji = '🟠'
            else:
                emoji = '🔴'
            
            print(f"   {i}. {emoji} Rankability: {rank:.0f}/100 — \"{s['keyword']}\"")
            print(f"      Competition: {comp}/100  |  Demand: {dem_str}")
            if rank >= 60 and s['top_results']:
                print(f"      Top result: {s['top_results'][0]['domain']} — {s['top_results'][0]['title'][:70]}")
        
        if not scored:
            print("   No keywords found. Try a broader topic.")
        print()
        sys.exit(0)
    
    # ── SINGLE KEYWORD CHECK ──
    keyword = ' '.join(sys.argv[1:])
    
    print(f"\n🔍 Searching: \"{keyword}\"\n")
    
    # Step 1: Check Google Suggest first (fast, fails fast for zero-demand)
    print("   📊 Checking Google Suggest demand...", end=' ', flush=True)
    suggestions = get_google_suggestions(keyword)
    demand_score, demand_rating = estimate_demand_score(keyword, suggestions)
    if demand_score is not None:
        print(f"{demand_score}/100")
        print(f"      → {demand_rating}")
    else:
        print("⚠️  API unavailable (continuing anyway)")
    
    print()
    
    # Step 2: Check DuckDuckGo SERP
    results, result_count, error = search_duckduckgo(keyword)
    
    if error or not results:
        print(f"⚠️  {error or 'No SERP results'}")
        word_count = len(keyword.split())
        print(f"   Quick estimate: {'🟢 Low' if word_count >= 4 else '🟡 Medium' if word_count >= 3 else '🔴 High'} competition")
        sys.exit(0)
    
    covered = load_existing_posts()
    kw_words = set(keyword.lower().split())
    if len(kw_words & covered) >= 3:
        print(f"   ⚠️  WARNING: This topic may overlap with existing blog posts.\n")
    
    analysis = analyze_serp(results, keyword, result_count)
    analysis['demand_score'] = demand_score
    analysis['demand_rating'] = demand_rating
    
    # Combined Rankability Score
    comp = analysis['competition_score']
    dem = demand_score if demand_score is not None else 50
    rankability = (comp + dem) / 2
    analysis['rankability_score'] = rankability
    
    # ── RESULTS ──
    print(f"{'─'*60}")
    print(f"   📈 COMPETITION SCORE")
    print(f"{'─'*60}")
    print(f"\n   Score: {comp}/100 — ", end='')
    if comp >= 75: print("🟢 VERY EASY (low competition)")
    elif comp >= 60: print("🟢 EASY (low competition)")
    elif comp >= 45: print("🟡 MEDIUM")
    elif comp >= 30: print("🟠 HARD")
    else: print("🔴 VERY HARD (too competitive)")
    
    print(f"\n   Signals:")
    for s in analysis['signals']:
        sign = '+' if s['score'] >= 0 else ''
        print(f"   {sign}{s['score']:<4} {s['name']}: {s['detail']}")
    
    print(f"\n   Top results:")
    for i, r in enumerate(analysis['top_results'][:3], 1):
        print(f"   {i}. {r['domain']} — {r['title'][:80]}")
    
    print(f"\n{'─'*60}")
    print(f"   📊 DEMAND SCORE (Google Suggest)")
    print(f"{'─'*60}")
    if demand_score is not None:
        print(f"\n   Score: {demand_score}/100 — ", end='')
        if demand_score < 15: print("🔴 ZERO DEMAND")
        elif demand_score <= 30: print("🟠 LOW DEMAND")
        elif demand_score <= 55: print("🟡 MEDIUM DEMAND")
        elif demand_score <= 75: print("🟢 HIGH DEMAND")
        else: print("🟢 VERY HIGH DEMAND")
        print(f"\n   → {demand_rating}")
    else:
        print("\n   ⚠️  Could not determine (Google Suggest unavailable)")
        print("   Proceeding with competition score only.")
    
    print(f"\n{'─'*60}")
    print(f"   🎯 RANKABILITY SCORE (Competition + Demand) / 2")
    print(f"{'─'*60}")
    
    print(f"\n   COMPETITION:   {print_score_bar(comp)}")
    if demand_score is not None:
        print(f"   DEMAND:        {print_score_bar(demand_score)}")
    print(f"   ───────────────────────────────")
    print(f"   🎯 RANKABILITY: {print_score_bar(int(rankability))}")
    
    print(f"\n   💡 ", end='')
    if demand_score is not None and demand_score < 15:
        print("🔴 STOP. This keyword has zero search demand. Pick a different keyword.")
        print(f"      Try: python3 scripts/check-keyword.py --suggest \"{keyword.split()[0]}\"")
    elif rankability >= 70:
        print("🟢 WRITE NOW. Low competition + strong demand. Perfect target.")
    elif rankability >= 55:
        print("🟢 Good target. Strong on-page SEO should rank this.")
    elif rankability >= 40:
        print("🟡 Achievable. Write 1,500+ words with FAQ schema + 1-2 backlinks.")
    else:
        print("🔴 Weak target. Either too competitive or zero demand.")
        print(f"      Try: python3 scripts/check-keyword.py --suggest \"{keyword.split()[0]}\"")
    print()


if __name__ == '__main__':
    main()
