#!/usr/bin/env python3
"""YouTube Keyword Competition Checker — FULLY AUTOMATIC + DEDUP
=================================================================
- Searches DuckDuckGo, analyzes SERP competition
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
        return None, f"Search failed: {e}"
    
    results = []
    blocks = re.findall(r'<a rel="nofollow" class="result__a" href="(.*?)">(.*?)</a>', html)
    snippets = re.findall(r'<a class="result__snippet" .*?>(.*?)</a>', html)
    
    for i, (url, title_html) in enumerate(blocks[:num]):
        title = re.sub(r'<.*?>', '', title_html)
        snippet = re.sub(r'<.*?>', '', snippets[i]) if i < len(snippets) else ''
        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', url)
        domain = domain_match.group(1) if domain_match else url
        results.append({'title': title.strip(), 'url': url.strip(), 'domain': domain.strip(), 'snippet': snippet.strip()})
    
    return results, None

def analyze_serp(results, keyword):
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
    
    base_score = 50
    total = sum(s['score'] for s in signals)
    final = max(0, min(100, base_score + total))
    
    return {'keyword': keyword, 'score': final, 'signals': signals, 'top_results': results[:3]}

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
            # Extract key terms
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
    
    # Find matching category
    category = None
    for cat, words in YOUTUBE_TOPICS.items():
        if any(w in topic_lower for w in words):
            category = cat
            break
    
    if not category:
        category = 'seo'  # default
    
    # Generate variations
    for modifier in MODIFIERS:
        ideas.append(f"{topic_lower} {modifier}")
    
    # Generate from category keywords
    for word in YOUTUBE_TOPICS[category]:
        if word not in topic_lower:
            ideas.append(f"{word} {topic_lower}")
    
    # Generate how-to variations
    for word in YOUTUBE_TOPICS[category]:
        if word not in topic_lower:
            ideas.append(f"how to {word} {topic_lower}")
    
    # Add year
    ideas.append(f"{topic_lower} 2026")
    
    # Add platform variations
    for platform in ['youtube', 'for beginners', 'for creators']:
        if platform not in topic_lower:
            ideas.append(f"{topic_lower} {platform}")
    
    return list(set(ideas))[:max_count]

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
        
        # Get how many to check
        check_count = 5
        if '--check' in sys.argv:
            check_idx = sys.argv.index('--check')
            if check_idx + 1 < len(sys.argv):
                check_count = int(sys.argv[check_idx + 1])
        
        print(f"\n💡 Generating keywords for: \"{topic}\"\n")
        ideas = generate_keywords(topic)
        
        covered = load_existing_posts()
        
        print(f"   Generated {len(ideas)} variations. Checking competition for top {check_count}...\n")
        
        scored = []
        for kw in ideas[:check_count]:
            # Skip if keyword too similar to existing posts
            kw_words = set(kw.lower().split())
            overlap = len(kw_words & covered)
            if overlap >= 3:
                print(f"   ⏭  \"{kw}\" — SKIPPED (similar to existing post)")
                continue
            
            print(f"   🔍 Checking: \"{kw}\"...", end=' ', flush=True)
            results, error = search_duckduckgo(kw, 8)
            if error or not results:
                print(f"⚠️  No results")
                continue
            
            analysis = analyze_serp(results, kw)
            scored.append(analysis)
            print(f"Score: {analysis['score']}/100")
        
        # Sort by score (highest = easiest)
        scored.sort(key=lambda x: x['score'], reverse=True)
        
        print(f"\n{'='*60}")
        print(f"   🏆 BEST KEYWORDS TO TARGET (easiest first):")
        print(f"{'='*60}\n")
        for i, s in enumerate(scored[:10], 1):
            emoji = '🟢' if s['score'] >= 60 else '🟡' if s['score'] >= 45 else '🟠'
            print(f"   {i}. {emoji} {s['score']}/100 — \"{s['keyword']}\"")
            if s['score'] >= 60:
                print(f"      Top result: {s['top_results'][0]['domain']} — {s['top_results'][0]['title'][:70]}")
        
        if not scored:
            print("   No keywords found. Try a broader topic.")
        print()
        sys.exit(0)
    
    # ── SINGLE KEYWORD CHECK ──
    keyword = ' '.join(sys.argv[1:])
    
    print(f"\n🔍 Searching: \"{keyword}\"\n")
    
    results, error = search_duckduckgo(keyword)
    
    if error or not results:
        print(f"⚠️  {error or 'No results'}")
        word_count = len(keyword.split())
        print(f"   Quick estimate: {'🟢 Low' if word_count >= 4 else '🟡 Medium' if word_count >= 3 else '🔴 High'} competition")
        sys.exit(0)
    
    # Check if already covered
    covered = load_existing_posts()
    kw_words = set(keyword.lower().split())
    if len(kw_words & covered) >= 3:
        print(f"   ⚠️  WARNING: This topic may overlap with existing blog posts.\n")
    
    analysis = analyze_serp(results, keyword)
    
    print(f"   Score: {analysis['score']}/100 — ", end='')
    if analysis['score'] >= 75: print("🟢 VERY EASY")
    elif analysis['score'] >= 60: print("🟢 EASY")
    elif analysis['score'] >= 45: print("🟡 MEDIUM")
    elif analysis['score'] >= 30: print("🟠 HARD")
    else: print("🔴 VERY HARD")
    
    print(f"\n   Signals:")
    for s in analysis['signals']:
        sign = '+' if s['score'] >= 0 else ''
        print(f"   {sign}{s['score']:<4} {s['name']}: {s['detail']}")
    
    print(f"\n   Top results:")
    for i, r in enumerate(analysis['top_results'][:3], 1):
        print(f"   {i}. {r['domain']} — {r['title'][:80]}")
    
    print(f"\n   💡 ", end='')
    if analysis['score'] >= 75:
        print("WRITE NOW. Strong on-page SEO will rank.")
    elif analysis['score'] >= 60:
        print("Good target. Write 1,500+ words with FAQ schema.")
    elif analysis['score'] >= 45:
        print("Achievable. Better content + 2 backlinks needed.")
    else:
        print("Try: python3 scripts/check-keyword.py --suggest \"{keyword}\"")
    print()

if __name__ == '__main__':
    main()
