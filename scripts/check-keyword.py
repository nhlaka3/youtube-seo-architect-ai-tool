#!/usr/bin/env python3
"""YouTube Keyword Competition Checker — FULLY AUTOMATIC
==========================================================
Analyzes SERP competition using DuckDuckGo. No API keys. No manual work.

USAGE:
  python3 scripts/check-keyword.py "youtube description templates 2026"
  python3 scripts/check-keyword.py "best youtube seo tools" --results 10
"""

import sys
import json
import urllib.request
import urllib.parse
import re
from datetime import datetime

KNOWN_BRANDS = [
    'youtube.com', 'google.com', 'ahrefs.com', 'semrush.com', 'hubspot.com',
    'neilpatel.com', 'backlinko.com', 'moz.com', 'vidiq.com', 'tubebuddy.com',
    'blog.google', 'support.google.com', 'wikipedia.org', 'reddit.com',
    'quora.com', 'medium.com', 'canva.com', 'hootsuite.com', 'sproutsocial.com',
    'buffer.com', 'later.com', 'socialmediaexaminer.com', 'forbes.com',
    'entrepreneur.com', 'businessinsider.com', 'shopify.com', 'wix.com'
]

def search_duckduckgo(query, num=10):
    """Search DuckDuckGo and return structured results. No API key needed."""
    # DuckDuckGo HTML search (non-JS version)
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
    
    # Parse results from HTML
    results = []
    # Find result blocks
    blocks = re.findall(r'<a rel="nofollow" class="result__a" href="(.*?)">(.*?)</a>', html)
    snippets = re.findall(r'<a class="result__snippet" .*?>(.*?)</a>', html)
    
    for i, (url, title_html) in enumerate(blocks[:num]):
        title = re.sub(r'<.*?>', '', title_html)
        snippet = re.sub(r'<.*?>', '', snippets[i]) if i < len(snippets) else ''
        
        # Extract domain
        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', url)
        domain = domain_match.group(1) if domain_match else url
        
        results.append({
            'title': title.strip(),
            'url': url.strip(),
            'domain': domain.strip(),
            'snippet': snippet.strip()
        })
    
    return results, None

def analyze_serp(results, keyword):
    """Analyze SERP results for competition signals."""
    if not results:
        return {'error': 'No results found'}
    
    keyword_lower = keyword.lower()
    signals = []
    
    # Signal 1: Big brand dominance
    brand_count = sum(1 for r in results if any(b in r['domain'].lower() for b in KNOWN_BRANDS))
    if brand_count >= 5:
        signals.append({'name': 'Brand dominance', 'score': -30, 
                       'detail': f'{brand_count}/{len(results)} results are big brands (very hard to beat)'})
    elif brand_count >= 3:
        signals.append({'name': 'Moderate brand presence', 'score': -15,
                       'detail': f'{brand_count}/{len(results)} are big brands'})
    else:
        signals.append({'name': 'Low brand competition', 'score': +15,
                       'detail': f'Only {brand_count}/{len(results)} big brands — small sites rank here'})
    
    # Signal 2: Exact keyword in title
    exact_matches = sum(1 for r in results if keyword_lower in r['title'].lower())
    if exact_matches >= 7:
        signals.append({'name': 'Highly optimized titles', 'score': -15,
                       'detail': f'{exact_matches}/{len(results)} have exact keyword match'})
    elif exact_matches >= 4:
        signals.append({'name': 'Moderate optimization', 'score': -5,
                       'detail': f'{exact_matches}/{len(results)} have exact keyword'})
    else:
        signals.append({'name': 'Weak title optimization', 'score': +15,
                       'detail': f'Only {exact_matches}/{len(results)} target this exact keyword'})
    
    # Signal 3: Content freshness signals
    year_keywords = ['2026', '2025', '2024']
    fresh_count = sum(1 for r in results if any(y in r['title'] or (r['snippet'] and y in r['snippet']) for y in year_keywords))
    if fresh_count <= 2:
        signals.append({'name': 'Outdated content', 'score': +15,
                       'detail': f'Only {fresh_count}/{len(results)} mention recent years — freshness wins'})
    
    # Signal 4: Word count of keyword
    word_count = len(keyword.split())
    if word_count >= 5:
        signals.append({'name': 'Very long-tail', 'score': +20, 'detail': f'{word_count} words — highly specific'})
    elif word_count >= 4:
        signals.append({'name': 'Long-tail', 'score': +15, 'detail': f'{word_count} words — specific query'})
    elif word_count >= 3:
        signals.append({'name': 'Moderate specificity', 'score': +5, 'detail': '3-word keyword'})
    else:
        signals.append({'name': 'Broad keyword', 'score': -15, 'detail': '1-2 words — very competitive'})
    
    # Signal 5: Intent type
    info_words = ['how', 'what', 'why', 'guide', 'tutorial', 'template', 'tips', 'learn', 'examples', 'ideas']
    commercial_words = ['best', 'top', 'review', 'cheap', 'buy', 'price', 'vs', 'comparison']
    
    info_hits = sum(1 for w in info_words if w in keyword_lower)
    commercial_hits = sum(1 for w in commercial_words if w in keyword_lower)
    
    if info_hits > commercial_hits:
        signals.append({'name': 'Informational intent', 'score': +10, 'detail': 'Easier to rank with content vs affiliate pages'})
    elif commercial_hits > info_hits:
        signals.append({'name': 'Commercial intent', 'score': -10, 'detail': 'Dominated by review/affiliate sites'})
    
    # Signal 6: Niche specificity bonus
    niche_words = ['youtube', 'tiktok', 'shorts', 'podcast', 'vlog', 'thumbnail', 'seo', 'instagram']
    niche_hits = [w for w in niche_words if w in keyword_lower]
    if niche_hits:
        signals.append({'name': 'Niche-specific', 'score': +10, 'detail': f'Contains: {", ".join(niche_hits)}'})
    
    # Signal 7: Year targeting
    years = re.findall(r'\b20\d{2}\b', keyword)
    if years:
        signals.append({'name': 'Year-targeted', 'score': +10, 'detail': f'Targeting {years[0]} — beats older content'})
    
    # Calculate final score
    base_score = 50
    total = sum(s['score'] for s in signals)
    final = max(0, min(100, base_score + total))
    
    if final >= 75:
        diff = '🟢 VERY EASY'
    elif final >= 60:
        diff = '🟢 EASY'
    elif final >= 45:
        diff = '🟡 MEDIUM'
    elif final >= 30:
        diff = '🟠 HARD'
    else:
        diff = '🔴 VERY HARD'
    
    return {
        'keyword': keyword,
        'results_analyzed': len(results),
        'score': final,
        'difficulty': diff,
        'signals': signals,
        'top_results': results[:5],
        'checked_at': datetime.now().isoformat()
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/check-keyword.py \"your keyword here\"")
        print("Example: python3 scripts/check-keyword.py \"youtube description templates 2026\"")
        sys.exit(1)
    
    keyword = ' '.join(sys.argv[1:])
    
    print(f"\n🔍 Searching DuckDuckGo for: \"{keyword}\"\n")
    
    results, error = search_duckduckgo(keyword)
    
    if error or not results:
        print(f"⚠️  {error or 'No results found'}")
        print("\nFalling back to structural analysis...\n")
        
        # Basic structural analysis
        word_count = len(keyword.split())
        if word_count >= 5:
            print(f"   🟢 {word_count} words — very long-tail, likely low competition")
        elif word_count >= 4:
            print(f"   🟢 {word_count} words — long-tail, good chance")
        elif word_count >= 3:
            print(f"   🟡 {word_count} words — moderate")
        else:
            print(f"   🔴 {word_count} words — broad, likely competitive")
        sys.exit(0)
    
    analysis = analyze_serp(results, keyword)
    
    print(f"╔══════════════════════════════════════════════════╗")
    print(f"║  COMPETITION ANALYSIS ({analysis['results_analyzed']} results analyzed)              ║")
    print(f"╚══════════════════════════════════════════════════╝")
    print(f"\n   Score: {analysis['score']}/100 — {analysis['difficulty']}\n")
    
    print("   Signals:")
    for s in analysis['signals']:
        sign = '+' if s['score'] >= 0 else ''
        print(f"   {sign}{s['score']:<4} {s['name']}")
        print(f"         {s['detail']}")
    
    print(f"\n   Top Results:")
    for i, r in enumerate(analysis['top_results'], 1):
        print(f"   {i}. {r['domain']}")
        print(f"      {r['title'][:90]}")
    
    print(f"\n   💡 VERDICT: ", end='')
    if analysis['score'] >= 75:
        print("Target this keyword NOW. Build a 1,500+ word page with FAQ schema and you'll rank within 2-4 weeks.")
    elif analysis['score'] >= 60:
        print("Good target. Write content better than top 3 (more words, FAQ schema, fresher date).")
    elif analysis['score'] >= 45:
        print("Achievable but needs effort. Better content + 2-3 backlinks to break top 5.")
    else:
        print("Consider a more specific variation. Add words like 'template', '2026', 'free', or 'for beginners'.")

if __name__ == '__main__':
    main()
