import re, json

with open('public/blog/youtube-shorts-seo-guide-2026.html', 'r') as f:
    content = f.read()

text = re.sub(r'<script[^>]*>.*?</script>', ' ', content, flags=re.DOTALL)
text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL)
text = re.sub(r'<[^>]+>', ' ', text)
text = re.sub(r'\s+', ' ', text).strip()
words = len(text.split())
print(f'Word count: ~{words}')

banned = ['excited', 'leverage', 'seamless', 'robust', 'embark', 'streamline', 'pivotal', 'cutting-edge']
for word in banned:
    if word.lower() in text.lower():
        print(f'WARNING - BANNED WORD: {word}')

if 'Does YouTube Shorts SEO actually work?' in content:
    print('FAQ Q1 text present')
if '"acceptedAnswer"' in content:
    print('FAQPage schema syntax present')

faq_match = re.search(r'"@type": "FAQPage".*?"mainEntity":.*?\]', content, re.DOTALL)
if faq_match:
    faq_json = faq_match.group(0)
    try:
        json.loads('{' + faq_json + '}')
        print('FAQ JSON-LD is valid JSON')
    except json.JSONDecodeError as e:
        print(f'FAQ JSON-LD error: {e}')
        # Find the problematic area
        pos = e.pos
        print(f'Error at position ~{pos} in matched json')
        print(f'Context: ...{faq_json[max(0,pos-50):pos+50]}...')
