# Content Cluster / Internal Linking Findings

## Evidence
- Hub-and-spoke exists: blog ↔ tools ↔ glossary with injected glossary links on posts
- Blog hub links to **47 of 58** posts (11 posts not linked from the hub)
- Sampled glossary page: 15 internal links but **0 blog links** ("Related Blog Posts" empty/absent) — glossary is a cul-de-sac
- **24 identical slugs under /blog/ and /tools/** → duplicate keyword targets (cannibalization) instead of clean hub spokes
- /guide pillar (would anchor a topical cluster) **404s**; /blog/category/ hubs are thin (74–82 words)
- vs pages (6) exist but are weakly linked from the rest of the site

## Fixes
1. Resolve 24 cannibalized pairs (one canonical home per keyword)
2. Add per-term "Related posts" links on glossary pages (generate from the glossary → blog topic map)
3. Build category pillar pages with real content; link hub → category → post
4. Interlink /vs/ pages and rebuild the /guide pillar
5. Ensure blog hub links all posts
