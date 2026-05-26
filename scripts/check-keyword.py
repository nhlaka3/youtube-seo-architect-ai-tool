#!/usr/bin/env python3
"""YouTube Keyword Competition Checker — No API Required
==========================================================
Analyzes competition for any keyword using signals that don't need Google API.
Gives you a competition score + a checklist for manual SERP verification.

USAGE:
  python3 scripts/check-keyword.py "youtube description templates 2026"
"""

import sys
import re

def analyze_keyword(keyword):
    """Score keyword competition based on structural signals."""
    words = keyword.split()
    word_count = len(words)
    char_count = len(keyword)
    
    signals = []
    
    # Signal 1: Word count (long-tail bonus)
    if word_count >= 5:
        signals.append(('Long-tail keyword (5+ words)', +25, 'Very specific — easiest to rank'))
    elif word_count >= 4:
        signals.append(('Long-tail keyword (4 words)', +20, 'Specific — good chance of ranking'))
    elif word_count >= 3:
        signals.append(('Moderate specificity (3 words)', +10, 'Decent specificity'))
    else:
        signals.append(('Broad keyword (1-2 words)', -15, 'Very competitive — need strong domain'))
    
    # Signal 2: Character count (longer = more specific)
    if char_count > 40:
        signals.append(('Very specific query', +15, f'{char_count} chars — niche intent'))
    elif char_count > 25:
        signals.append(('Moderately specific', +5, f'{char_count} chars'))
    
    # Signal 3: Intent words (informational = easier than commercial)
    info_words = ['how', 'what', 'why', 'guide', 'tutorial', 'template', 'tips', 
                  'learn', 'examples', 'ideas', 'checklist', 'meaning', 'definition']
    commercial_words = ['best', 'top', 'review', 'cheap', 'buy', 'price', 'vs', 
                        'comparison', 'discount', 'deal', 'free trial', 'premium']
    
    info_score = sum(1 for w in info_words if w in keyword.lower())
    commercial_score = sum(1 for w in commercial_words if w in keyword.lower())
    
    if info_score > commercial_score:
        signals.append(('Informational intent', +10, f'{info_score} info signals — easier for content to rank'))
    elif commercial_score > info_score:
        signals.append(('Commercial intent', -10, f'{commercial_score} commercial signals — harder, dominated by review sites'))
    else:
        signals.append(('Mixed intent', 0, 'Neutral — depends on search results'))
    
    # Signal 4: Year/date in keyword (freshness targeting)
    years = re.findall(r'\b20\d{2}\b', keyword)
    if years:
        signals.append(('Year-targeted', +10, f'Targeting {years[0]} — freshness beats older content'))
    
    # Signal 5: Contains numbers (listicle-friendly, good CTR)
    if re.search(r'\d+', keyword):
        signals.append(('Contains numbers', +5, 'Higher CTR potential with numbered content'))
    
    # Signal 6: Niche specificity
    niche_terms = ['youtube', 'tiktok', 'instagram', 'shorts', 'podcast', 'vlog',
                   'thumbnail', 'seo', 'algorithm', 'monetization', 'analytics']
    niche_matches = [t for t in niche_terms if t in keyword.lower()]
    if niche_matches:
        signals.append(('Niche-specific', +10, f'Contains: {", ".join(niche_matches)} — narrower audience, less competition'))
    
    # Calculate score
    base_score = 50
    total_modifier = sum(s[1] for s in signals)
    final_score = max(0, min(100, base_score + total_modifier))
    
    # Difficulty
    if final_score >= 70:
        difficulty = '🟢 LOW COMPETITION'
    elif final_score >= 55:
        difficulty = '🟡 MEDIUM'
    elif final_score >= 40:
        difficulty = '🟠 HIGH'
    else:
        difficulty = '🔴 VERY HIGH'
    
    return {
        'keyword': keyword,
        'word_count': word_count,
        'char_count': char_count,
        'score': final_score,
        'difficulty': difficulty,
        'signals': signals
    }

def print_serp_checklist(keyword):
    """Manual SERP verification steps."""
    print(f"""
╔══════════════════════════════════════════════════════╗
║  MANUAL SERP CHECK (2 minutes)                      ║
║  Open incognito window, search: "{keyword}"          ║
╚══════════════════════════════════════════════════════╝

For each of the top 5 results, answer:

1. What's the word count? [ ] < 500  [ ] 500-1000  [ ] 1000-1500  [ ] 1500+
   → If most are < 1000 words: EASY to beat with 1500+ words

2. Do they have FAQ schema? [ ] Yes [ ] No
   → Check: Right-click → View Page Source → Search "FAQPage"
   → If NO: You can capture FAQ snippets with schema

3. When was it published/updated? [ ] 2026 [ ] 2025 [ ] 2024 [ ] Older
   → If most are 2024 or older: Freshness advantage

4. Do they have a Table of Contents? [ ] Yes [ ] No
   → If NO: Your page with TOC signals better UX

5. Is it a big brand? [ ] YouTube/Google [ ] Ahrefs/Semrush [ ] Blog [ ] Small site
   → Count big brands: 0-2 = winnable, 3-5 = tough, 6+ = very hard

6. Do they answer the query DIRECTLY in the first paragraph? [ ] Yes [ ] No
   → If NO: Your TL;DR box wins for AI overviews

7. What subtopics do they COVER? (list them)
   _________________________________
   What subtopics do they MISS? (your opportunity)
   _________________________________

SCORING THE SERP:
• 3+ weaknesses across results = 🟢 Can rank top 5
• 1-2 weaknesses = 🟡 Needs backlinks to compete  
• 0 weaknesses = 🔴 Very competitive — pick a longer keyword
""")

def main():
    keyword = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else input("Keyword to check: ")
    
    # Structural analysis
    result = analyze_keyword(keyword)
    
    print(f"""
╔══════════════════════════════════════════════════════╗
║  KEYWORD COMPETITION ANALYSIS                       ║
╚══════════════════════════════════════════════════════╝

Keyword: "{result['keyword']}"
Words: {result['word_count']} | Characters: {result['char_count']}
Score: {result['score']}/100 — {result['difficulty']}

Signal Breakdown:
""")
    for signal, score, detail in result['signals']:
        sign = '+' if score >= 0 else ''
        print(f"  {sign}{score:<4} {signal}")
        print(f"         {detail}")
    
    # Recommendations
    print(f"\n💡 RECOMMENDATION: ", end='')
    if result['score'] >= 70:
        print("TARGET THIS KEYWORD. Write comprehensive content with FAQ schema, TOC, and 1,500+ words.")
    elif result['score'] >= 55:
        print("WORTH TARGETING. Your content must be BETTER than top 3 results (more words, better structure, FAQ schema).")
    elif result['score'] >= 40:
        print("CONSIDER A VARIATION. Try adding year ('2026'), format ('template', 'checklist'), or niche ('for gaming').")
    else:
        print("FIND A LONGER KEYWORD. Add 1-2 more words to increase specificity.")
    
    # Show variation suggestions
    if result['score'] < 70:
        words = keyword.split()
        print(f"\n🔀 Try these variations (higher chance of ranking):")
        variations = []
        if '2026' not in keyword.lower() and not any(c.isdigit() for c in keyword):
            variations.append(f'"{keyword} 2026"')
        if 'template' not in keyword.lower():
            variations.append(f'"{keyword} template"')
        if 'free' not in keyword.lower():
            variations.append(f'"free {keyword}"')
        if 'how to' not in keyword.lower() and 'what' not in keyword.lower():
            variations.append(f'"how to {keyword}"')
        if len(words) < 5:
            variations.append(f'"{keyword} for beginners"')
        for v in variations[:4]:
            print(f"   • {v}")
    
    # Manual checklist
    print_serp_checklist(keyword)
    
    # Competitor gap summary
    print(f"""
╔══════════════════════════════════════════════════════╗
║  HOW TO BEAT COMPETITORS                            ║
╚══════════════════════════════════════════════════════╝

Our default competitive advantage (every page we publish):
  1. FAQ + Article + Breadcrumb schema (most competitors: none)
  2. TL;DR direct answer box (Google AI Overview optimized)
  3. 1,500+ word minimum (most competitors: 500-800)
  4. Table of Contents with jump links
  5. Author credentials box (E-E-A-T signal)
  6. Last updated date visible (freshness signal)

If competitors lack any of the above, your page outranks them
within 2-6 weeks with 2-3 backlinks from our awesome-list PRs.
""")

if __name__ == '__main__':
    main()
