#!/usr/bin/env python3
"""YouTube Keyword Competition Checker — Free Tool
===================================================
Checks competition level for any keyword using Google Custom Search API.
Free tier: 100 queries/day. No paid tools needed.

SETUP (one-time):
1. Go to https://programmablesearchengine.google.com/
2. Create a new search engine (search the entire web)
3. Get your Search Engine ID (cx)
4. Go to https://console.cloud.google.com/apis/credentials
5. Create an API key for "Custom Search API"
6. Set env vars: export GOOGLE_API_KEY="your-key" GOOGLE_CX="your-cx"

USAGE:
  python3 check-keyword.py "youtube description templates 2026"
  python3 check-keyword.py "best youtube seo tools" --top 5
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime

API_KEY = os.environ.get('GOOGLE_API_KEY', '')
CX = os.environ.get('GOOGLE_CX', '')

def search_google(query, num=10):
    """Search Google via Custom Search API. Returns list of results."""
    url = 'https://www.googleapis.com/customsearch/v1'
    params = {
        'key': API_KEY,
        'cx': CX,
        'q': query,
        'num': min(num, 10),
        'fields': 'items(title,link,snippet,displayLink,pagemap/metatags)'
    }
    url += '?' + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url, headers={'User-Agent': 'KeywordChecker/1.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return data.get('items', [])

def analyze_competition(results, keyword):
    """Score competition level from search results. Lower = easier to rank."""
    if not results:
        return {"error": "No results found"}
    
    word_count = len(keyword.split())
    signals = []
    
    # Signal 1: Domain authority (rough proxy via TLD and known brands)
    high_auth_domains = 0
    known_brands = ['youtube.com', 'google.com', 'ahrefs.com', 'semrush.com',
                    'hubspot.com', 'neilpatel.com', 'backlinko.com', 'moz.com',
                    'vidIQ.com', 'tubebuddy.com', 'blog.google', 'support.google.com',
                    'wikipedia.org', 'reddit.com', 'quora.com', 'medium.com']
    
    for r in results:
        domain = r.get('displayLink', '')
        is_brand = any(brand in domain.lower() for brand in known_brands)
        if is_brand:
            high_auth_domains += 1
    
    if high_auth_domains >= 5:
        signals.append({'signal': 'High-authority domains', 'score': -30, 
                       'detail': f'{high_auth_domains}/10 results are big brands (very hard to beat)'})
    elif high_auth_domains >= 3:
        signals.append({'signal': 'Medium authority', 'score': -15,
                       'detail': f'{high_auth_domains}/10 results are brands (moderate difficulty)'})
    else:
        signals.append({'signal': 'Low authority competition', 'score': +15,
                       'detail': f'Only {high_auth_domains}/10 are big brands — small sites can rank'})
    
    # Signal 2: Keyword specificity (long-tail bonus)
    if word_count >= 4:
        signals.append({'signal': 'Long-tail keyword', 'score': +20,
                       'detail': f'{word_count} words — specific queries have lower competition'})
    elif word_count >= 3:
        signals.append({'signal': 'Moderate specificity', 'score': +10,
                       'detail': '3-word keyword — decent specificity'})
    else:
        signals.append({'signal': 'Short keyword', 'score': -10,
                       'detail': '1-2 words — broad keywords are competitive'})
    
    # Signal 3: Result count (rough volume proxy)
    try:
        total_results = results[0].get('pagemap', {}).get('metatags', [{}])[0]
    except:
        total_results = None
    
    # Signal 4: Title analysis — are results optimized?
    keyword_lower = keyword.lower()
    exact_title_matches = 0
    for r in results:
        title = r.get('title', '').lower()
        # Check if keyword appears exactly in title
        if keyword_lower in title:
            exact_title_matches += 1
    
    if exact_title_matches >= 7:
        signals.append({'signal': 'Highly optimized titles', 'score': -15,
                       'detail': f'{exact_title_matches}/10 results have exact keyword in title — competitive SERP'})
    elif exact_title_matches >= 4:
        signals.append({'signal': 'Moderately optimized', 'score': -5,
                       'detail': f'{exact_title_matches}/10 have exact keyword match in title'})
    else:
        signals.append({'signal': 'Weak title optimization', 'score': +15,
                       'detail': f'Only {exact_title_matches}/10 have exact keyword in title — easy to beat with optimized title'})
    
    # Signal 5: Presence of "how to" / informational content (less competitive than commercial)
    informational_results = sum(1 for r in results if any(w in r.get('title','').lower() 
                               for w in ['how', 'guide', 'tutorial', 'template', 'tips', 'learn']))
    commercial_results = sum(1 for r in results if any(w in r.get('title','').lower()
                              for w in ['best', 'top', 'review', 'vs', 'buy', 'price', 'cheap']))
    
    if informational_results > commercial_results:
        signals.append({'signal': 'Informational intent', 'score': +10,
                       'detail': f'{informational_results} informational vs {commercial_results} commercial results — easier to rank with content'})
    elif commercial_results > informational_results:
        signals.append({'signal': 'Commercial intent', 'score': -10,
                       'detail': f'{commercial_results} commercial results — harder to compete with affiliate content'})
    
    # Calculate final score (0-100, higher = easier to rank)
    base_score = 50
    total_modifier = sum(s['score'] for s in signals)
    final_score = max(0, min(100, base_score + total_modifier))
    
    # Difficulty label
    if final_score >= 70:
        difficulty = '🟢 LOW — Easy to rank with good content'
    elif final_score >= 50:
        difficulty = '🟡 MEDIUM — Achievable with optimization'
    elif final_score >= 30:
        difficulty = '🟠 HIGH — Needs strong backlinks + content'
    else:
        difficulty = '🔴 VERY HARD — Dominated by big brands'
    
    return {
        'keyword': keyword,
        'competition_score': final_score,
        'difficulty': difficulty,
        'signals': signals,
        'top_results': [{'title': r['title'], 'domain': r['displayLink']} for r in results[:5]],
        'checked_at': datetime.now().isoformat()
    }

def main():
    if not API_KEY or not CX:
        print("""
╔══════════════════════════════════════════════════╗
║  SETUP REQUIRED (one-time, 2 minutes)           ║
╠══════════════════════════════════════════════════╣
║ 1. Go to: https://programmablesearchengine.google.com/
║    Create a search engine for the entire web.
║    Copy the "Search Engine ID" (cx).
║                                                  ║
║ 2. Go to: https://console.cloud.google.com/apis/credentials
║    Create an API key for "Custom Search API".
║    Copy the API key.
║                                                  ║
║ 3. Run:                                          ║
║    export GOOGLE_API_KEY="your-api-key"           ║
║    export GOOGLE_CX="your-search-engine-id"       ║
║    python3 check-keyword.py "your keyword"        ║
╚══════════════════════════════════════════════════╝
""")
        # FALLBACK: Basic analysis without API
        if len(sys.argv) > 1:
            keyword = sys.argv[1]
            word_count = len(keyword.split())
            print(f"\n📊 Quick analysis for: \"{keyword}\"")
            print(f"   Words: {word_count}")
            if word_count >= 4:
                print(f"   🟢 Likely LOW competition (long-tail keyword)")
            elif word_count >= 3:
                print(f"   🟡 Likely MEDIUM competition")
            else:
                print(f"   🔴 Likely HIGH competition (broad keyword)")
            print(f"\n   To get full analysis, set up the API keys above.")
        sys.exit(0)
    
    keyword = sys.argv[1] if len(sys.argv) > 1 else input("Keyword to check: ")
    
    print(f"\n🔍 Checking competition for: \"{keyword}\"\n")
    
    try:
        results = search_google(keyword)
        analysis = analyze_competition(results, keyword)
        
        print(f"📊 Competition Score: {analysis['competition_score']}/100")
        print(f"   {analysis['difficulty']}\n")
        
        print("🔬 Signal Breakdown:")
        for s in analysis['signals']:
            sign = '+' if s['score'] >= 0 else ''
            print(f"   {sign}{s['score']}  {s['detail']}")
        
        print(f"\n📋 Top 5 Results:")
        for i, r in enumerate(analysis['top_results'], 1):
            print(f"   {i}. {r['domain']} — {r['title'][:80]}")
        
        print(f"\n💡 Verdict: ", end='')
        if analysis['competition_score'] >= 70:
            print("Target this keyword. Create comprehensive content with FAQ schema and you can rank.")
        elif analysis['competition_score'] >= 50:
            print("Worth targeting. You'll need better content than the top 3 results to break in.")
        else:
            print("Consider a more specific long-tail variation of this keyword.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("   Check your API key and search engine ID.")

if __name__ == '__main__':
    main()
