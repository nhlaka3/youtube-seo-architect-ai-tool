# Images Findings (score 50/100)

## Evidence
- Homepage: **0 `<img>` tags** (fast, but zero visual/image-SERP presence)
- Blog posts: 1 hero each; sampled alts present (good intent)
- **Alt corruption**: `youtube-shorts-seo-guide-2026` hero alt contains raw `<a href="/glossary/youtube-shorts" class="glossary-link">` (glossary-link injection into attribute)
- **Hotlink remaining**: `youtube-description-templates-2026` hero = `https://picsum.photos/seed/.../800/400`
- Formats: PNG heroes (no WebP/AVIF); some lack width/height

## Fixes
1. Fix injector to never touch attribute values; re-render affected posts
2. Replace picsum hotlink with self-hosted branded hero
3. Convert heroes to WebP with width/height + srcset
4. Consider adding a branded OG/hero image to the homepage (currently image-less)
