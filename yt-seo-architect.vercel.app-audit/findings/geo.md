# AI Search Readiness (GEO) Findings (score 78/100 — strongest category)

## Evidence
- robots.txt: **ChatGPT-User, Google-Extended, PerplexityBot, ClaudeBot, anthropic-ai, OAI-SearchBot, Applebot-Extended, Bytespider = Allow** ✅ · GPTBot/CCBot blocked (training only) ✅
- llms.txt: 200 ✅ · llms-full.txt: 33KB, 200 ✅
- FAQPage on blog posts feeds direct AI answers; 10,986 glossary terms = huge topical surface
- Hreflang en/es/pt/x-default on multilingual glossary ✅

## Issues
- llms.txt: `[null]` entry → /blog/generic-hero; stale counts (18 blog / 95 tools vs 58 / 37)
- Broken JSON-LD + 404 glossary URLs dilute source-validating AI crawlers' citation confidence

## Fixes
1. Regenerate llms.txt from live content
2. Fix JSON-LD + 404 issues (also improves AI citability)
3. Keep publishing structured FAQ/TL;DR blocks (they feed AI answers)
