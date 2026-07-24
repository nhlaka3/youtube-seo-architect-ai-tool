# Format Requirements for New Pages

When creating new pages (tools, glossary, blog posts), these steps ensure they integrate with the SEO infrastructure.

## Blog Posts (`.html` in `public/blog/`)

Each blog post static HTML file must be generated via `auto-blog-generator.mjs` which auto-applies:
- [x] Glossary term links (`<a href="/glossary/{slug}" class="glossary-link">`)
- [x] Category badges on the blog index (categories inferred from slug/title)
- [x] Canonical URL (no trailing slash)
- [x] Article + FAQPage schema
- [x] Breadcrumb nav
- [x] Proper meta/OG tags

**DO NOT manually create blog HTML files** — always use the generator.

**If you MUST create one manually:** after writing, run:
```bash
node scripts/add-glossary-links.mjs        # Add glossary links
node scripts/add-glossary-links-dist.mjs   # Same for dist/
```

## Glossary Pages (`public/glossary/{slug}.html`)

Generated from `scripts/glossary-data.json` via `scripts/generate-glossary.mjs`:
```bash
node scripts/generate-glossary.mjs
```

To add a new term, edit `scripts/glossary-data.json`
- Add an entry to the `terms` array with: `slug`, `term`, `shortDefinition`, `expandedDefinition`, `category`, `relatedTerms[]`, `relatedBlogs[]`
- Regenerate all pages: `node scripts/generate-glossary.mjs`

## Tool Pages (`public/tools/{name}.html`)

Must be created manually as they need interactive JavaScript.

**Format requirements:**
- [ ] Canonical URL: no trailing slash (e.g., `/tools/tag-generator` not `/tools/tag-generator/`)
- [ ] WebApplication schema (`<script type="application/ld+json">`)
- [ ] Proper `<title>`, `<meta name="description">`, OG tags
- [ ] Breadcrumb nav (Home > Tools > Tool Name)
- [ ] Links to related blog posts and glossary terms where relevant

## Comparison Pages (`public/vs/{name}.html`)

- [ ] Product + Article schema (see `/vs/vidiq.html` for reference)
- [ ] Canonical URL without trailing slash
- [ ] Link to this page from relevant blog posts

## GitHub Actions Workflows

| Workflow | Schedule | File |
|----------|----------|------|
| Daily Blog Publisher | 6:00 AM UTC daily | `.github/workflows/daily-blog-publisher.yml` |
| Glossary Publisher | 8:00 AM UTC Mondays | `.github/workflows/glossary-publisher.yml` |
| Auto-Index Sitemap | Every 6 hours | `.github/workflows/auto-index.yml` |

The blog publisher now auto-runs `add-glossary-links.mjs` after generating each post.

## Quick Reference

```bash
# After manually creating a blog post
node scripts/add-glossary-links.mjs
node scripts/add-glossary-links-dist.mjs

# To regenerate all glossary pages after adding terms to glossary-data.json
node scripts/generate-glossary.mjs

# Deploy
npx vercel --prod --yes --force
```
