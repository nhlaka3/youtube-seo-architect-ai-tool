# Schema / Structured Data Findings (score 55/100)

## Evidence
- Homepage: 1 block, 5,589 bytes, **valid** — Organization (logo.png ✅), WebSite, SoftwareApplication, FAQPage, BreadcrumbList, SearchAction, Offer, Question/Answer
- Tools pages: WebApplication ✅ parseable (12/12 sampled)
- /vs pages: FAQPage ✅ (6/6)
- Glossary: Article ✅ (16/18 sampled)
- **Blog: 7/14 sampled posts have unparseable ld+json blocks** (unescaped HTML in JSON strings):
  - youtube-intro-hook-first-3-seconds 4/5 · how-to-metadata-youtube 4/5
  - youtube-metadata-auditor-vs-vidiq-shadow-ban **1/3**
  - youtube-analytics-4-metrics-that-matter 1/2 · what-does-youtube-ctr-actually-mean 1/2
  - youtube-video-not-getting-views-diagnostic-fix-2026 1/2 · youtube-end-screens-cards-guide-2026 1/2

## Issues
- CRITICAL: broken JSON-LD on ~50% of posts → no rich results on newest content
- SearchAction → `https://yt-seo-architect.vercel.app/dashboard?q={search_term_string}` (login-gated, noindex)
- No ItemList/BreadcrumbList on hubs; no DefinedTerm on glossary

## Fixes
1. Real JSON serializer in blog template + re-render affected posts + CI schema check
2. Point SearchAction at indexable surface or remove
3. Add ItemList to hubs, DefinedTerm to glossary
