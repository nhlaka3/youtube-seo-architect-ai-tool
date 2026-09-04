# GEO — AI Search Readiness Re-Audit
Site: https://yt-seo-architect.vercel.app
Date: 2026-08-05 | Pass: Re-audit | Analyst: GEO specialist (AI Search Readiness)

## Score: 68 / 100

---

## 1. robots.txt AI Crawler Policy — PASS (with gaps)

File: https://yt-seo-architect.vercel.app/robots.txt (HTTP 200, 42 lines, sitemap declared)

### Required policy — verified
| Crawler | Policy | Status |
|---|---|---|
| ChatGPT-User | Allow: / | OK |
| Google-Extended | Allow: / | OK |
| PerplexityBot | Allow: / | OK |
| ClaudeBot | Allow: / | OK |
| anthropic-ai | Allow: / | OK |
| OAI-SearchBot | Allow: / | OK |
| Applebot-Extended | Allow: / | OK |
| Bytespider | Allow: / | OK |
| GPTBot | Disallow: / | OK (blocked) |
| CCBot | Disallow: / | OK (blocked) |

### Issues
- CRITICAL-ISH: 0 of 11 secondary AI/training crawlers are addressed. No rules for
  GrokBot (xAI — trains on crawled data), Cohere-Research, Amazonbot, Meta-ExternalAgent,
  YouBot, DuckAssistBot, Timpibot, AI2Bot, Diffbot, OmgiliBot, ExaBot, Perplexity-User.
  The catch-all `User-agent: * / Allow: /` silently permits all of them. Given GPTBot/CCBot
  are explicitly blocked (training protection intent), GrokBot being unblocked is an
  inconsistency — xAI's crawler trains on web data.
- Catch-all `User-agent: * Allow: /` means unknown future AI crawlers are allowed by default.
  Consider an explicit AI-crawler allowlist + Deny-by-default for unknown training bots.
- /dashboard is noindexed in-page but NOT disallowed in robots.txt — acceptable (noindex
  is the stronger signal), but note dashboard URL appears in llms.txt, which contradicts
  the noindex intent (AI crawlers reading llms.txt WILL cite /dashboard).

## 2. /llms.txt — PRESENT, structurally sound, content quality WEAK

HTTP 200, 43,583 bytes, 172 lines, 4 sections:
Core Platform (6) | Blog Posts (52 claimed) | Topic Guides (95 claimed) | Glossary (84).

### Coverage gaps (counts vs live site)
- BLOG: header claims 52 posts, file lists only 30. Live blog listing exposes 50 posts.
  >=20 real posts missing from llms.txt (e.g. /blog/youtube-tags-2026,
  /blog/youtube-description-templates-2026, /blog/youtube-impressions-guide-2026,
  /blog/youtube-ai-seo-coach-phronesis-2026, /blog/youtube-seo-for-fitness-channels-2026,
  /blog/how-to-increase-youtube-retention-2026, ...). 2 listed entries weren't found on the
  live listing page (possible pagination/ordering drift).
- TOPIC GUIDES: header claims 95, file lists only 40. llms-full lists 50. Tools hub page
  links only 23 /public/tools/*.html. The "95" number is not reproducible anywhere.
- GLOSSARY: claims 84, lists 84 — matches live (85 slugs incl. hub). OK.

### Description quality — FAIL
- 31 blog entries use the slug-injected template:
  "Learn how to youtube seo optimization for gaming channels 2026. Step-by-step guide..."
  i.e. the slug is regurgitated as a sentence — grammatically broken, low signal for AI
  answer extraction.
- 16 tool entries use generic mismatched filler:
  "Analyze your text for SEO keywords, topic clusters, and readability..." — this exact
  description is pasted onto unrelated tools (Best Posting Time Finder, Channel Audit Score,
  Competition Analyzer, Cost Per View Calculator, etc.). Descriptions do NOT describe the tool.
- 5 entries leak raw HTML into the text file: `&amp;` entities un-decoded AND truncated
  `<a href=` tags (e.g. "YouTube SEO Checklist for Beginners", "YouTube SEO Audit",
  "YouTube Metadata Auditor vs vidIQ" — descriptions end with a literal `<a href=`).
- 3 entries have EMPTY descriptions: Description Writer, Best YouTube Tags (tag-generator),
  YouTube Title Optimizer (title-optimizer). Empty entries are citation dead-ends.
- Glossary tail (last ~10 entries, e.g. "Keyword Research for Small Channels", "Video SEO for
  Gaming Channels", "Content Strategy for Channel Growth") is template garbage with truncated
  mid-word text ("...that work for small channels channels", "...music channels channe",
  "chann") — visibly cut off.

### What's good
- Correct structure: `# Title`, `> Site:`, `> Updated: 2026-08-03`, markdown link lists.
- Core platform entries have clean, human-written descriptions.
- Glossary top ~74 entries have genuinely useful one-line definitions (AI-answer friendly).
- Dated and maintained (2026-08-03), matches recent posts.

## 3. /llms-full.txt — PRESENT, better coverage, same template disease

HTTP 200, ~78,931 bytes, 1,160 lines. Sections: Homepage, Free Tools Hub, Blog Posts (50),
Glossary (84), Topic Guides (50).

- Blog coverage: 50 entries — covers live posts (48/50 real posts; misses
  /blog/categories and /blog/how-to-increase-youtube-retention-2026). Better than llms.txt.
- 41 "Learn how to ..." slug-injected summaries still present (same disease as llms.txt).
- 7 HTML entity leaks (`&amp;`) incl. Homepage description.
- SECTION ORDER BUG: sections render as 1, 2, 3, 5, 4 — "## 5. Glossary" appears BEFORE
  "## 4. Topic Guides". Numbering/order inconsistent.
- Homepage summary contains odd noise: "Key Sections: Upgrade Your Plan" (a pricing CTA label
  leaked into the summary) and "Pricing: Free core tools, 100 AI credits/month" — but the site
  is "100% Free, Unlimited". Contradictory AI-facing claims.

## 4. AI-answer readiness of page content (schema)
- Blog posts: Article + FAQPage (5 Q&A) + SpeakableSpecification + BreadcrumbList — strong
  answer-extraction surface. FAQPage JSON-LD verified well-formed (Question/acceptedAnswer).
- Glossary terms: Article + FAQPage (3 Q&A) — good.
- Homepage: Organization + WebSite + SoftwareApplication + FAQPage (8 Q&A) — good.
- Guide (/guide/youtube-seo): Article only, no FAQPage — minor.
- Tools hub: WebPage + ItemList — fine.

## Top issues (priority)
1. llms.txt blog coverage: 30 listed vs 52 claimed / 50 live — regenerate from live content index.
2. llms.txt tool guides: 40 listed vs 95 claimed — either list all 95 or fix the header count.
3. Slug-injected + generic-filler descriptions (31 blog + 16 tool + 41 in llms-full) — rewrite
   descriptions as real 1-2 sentence summaries; never echo the slug as a sentence.
4. Raw HTML leaks (`&amp;`, truncated `<a href=`) and empty descriptions — sanitize before emit.
5. Add GrokBot + secondary AI crawler rules; decide dashboard policy (noindex vs llms.txt listing
   contradiction).
6. Glossary template tail truncated mid-word — fix or drop.
7. llms-full section order bug (5 before 4).

## Positives
- robots.txt policy for the primary AI search crawlers is exactly right; GPTBot/CCBot blocked.
- llms.txt + llms-full.txt both exist, valid markdown, dated, sitemap declared.
- FAQPage schema on blog + glossary + homepage feeds AI answers well.
