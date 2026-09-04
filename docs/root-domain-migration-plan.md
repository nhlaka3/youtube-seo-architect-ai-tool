# Root-Domain Migration Plan — yt-seo-architect.vercel.app → yourdomain.com

Status: DRAFT (pre-execution)
Author: Hermes + Patrick
Date: 2026-08-02
Why now: 0 confirmed backlinks = nothing to lose in a domain move. Every
link earned on the .vercel.app subdomain is equity you'd have to 301 later.
The cost of migrating rises with every backlink gained, so NOW is the
cheapest possible moment.

## Why migrate

1. **Link equity ceiling.** *.vercel.app is a free hosting subdomain.
   - Many roundup editors refuse to link to free-subdomain tools.
   - Google treats subdomain-hosted tools as weaker than a root domain.
   - AI answer engines weight root domains higher for citations.
2. **Brand control.** yt-seo-architect.vercel.app looks like a hobby
   project. ytseoarchitect.com looks like a product.
3. **Outreach conversion.** The 15 outreach emails just drafted will
   convert far better pointing at a real domain.
4. **Future-proofing.** Every link earned today on .vercel.app needs a 301
   later. Zero links now = zero redirect debt.

## Prerequisites (before any code changes)

- [ ] Register a domain (~$10-15/yr). Candidates in order of preference:
      ytseoarchitect.com / ytseo-architect.com / getytseo.com / tryytseo.com
      (ytseoarchitect.com currently does not resolve — likely available,
      verify at registrar before purchase)
- [ ] Vercel account: confirm you can add custom domains (free tier allows)
- [ ] Google Search Console: access to add a new property
- [ ] Decide the ONE canonical domain (www vs non-www) — recommend non-www
      (ytseoarchitect.com) to match current URL style

## Step 1 — Domain registration + DNS

1. Register the domain at a registrar (Namecheap/Cloudflare/Porkbun).
2. Add it to Vercel: Dashboard → yt-seo-architect → Settings → Domains
   → Add ytseoarchitect.com.
3. Vercel gives DNS instructions (A record @ → 76.76.21.21 or CNAME).
   Follow exactly. HTTPS cert auto-provisions (Let's Encrypt).

## Step 2 — Make the new domain canonical (code changes)

All URL references in the codebase currently hardcode the .vercel.app
domain. Replace with the new root domain. Find all occurrences:

```bash
grep -rn "yt-seo-architect.vercel.app" --include="*.html" --include="*.js" \
  --include="*.mjs" --include="*.json" --include="*.css" . | wc -l
```

Files to update (from prior audits, expect ~500+ hits):
- index.html, dashboard.html, all /public/*.html templates
- api/index.js + api/blog-renderer.js (canonical, og:, schema, sitemap URLs)
- scripts/*.mjs generators (glossary, tools, vs-pages, blog)
- marketing/backlink-reports/*.csv (outreach emails — future ones use
  new domain; do NOT rewrite already-sent emails)
- sitemap.xml static + dynamic (api/index.js builds it)
- robots.txt (via api/index.js)

Key URL fields to swap:
- `og:image`, `og:url`, canonical link tags
- JSON-LD: Organization.url, Organization.logo, Article.url, publisher,
  WebSite, BreadcrumbList item URLs
- sitemap.xml URLs
- RSS/llms.txt if present

## Step 3 — 301 redirects from old domain (preserve equity)

With 0 backlinks, the redirect set is tiny — but Google may still have the
subdomain indexed (it IS indexed — sitemap was submitted). Add vercel.json
redirects:

```json
{
  "redirects": [
    { "source": "/(.*)", "destination": "https://ytseoarchitect.com/$1",
      "permanent": true }
  ]
}
```

Better approach: keep BOTH domains deployed to the same project.
- Add ytseoarchitect.com as the primary domain in Vercel.
- Vercel automatically 301s the .vercel.app alias? NO — the .vercel.app
  subdomain stays live until you remove it. Decision:
  - Option A (recommended): keep .vercel.app live but add canonical tags
    pointing at the new domain. Let Google consolidate over time.
  - Option B: add a vercel.json rewrite on a THROWAWAY deployment that
    301s everything. Simpler to reason about, but you must keep the old
    project alive. With 0 links, Option A is overkill — just set
    canonicals and remove the subdomain after GSC confirms the move.

## Step 4 — Google Search Console migration

1. Add new property (domain property: ytseoarchitect.com) in GSC.
2. Verify via DNS TXT (recommended, survives redeploys).
3. Use GSC "Change of Address" tool (requires both properties + site
   verification) — available under Settings → Change of Address.
4. Submit new sitemap (https://ytseoarchitect.com/sitemap.xml).
5. Keep the OLD property alive for 6+ months; monitor 404s from
   legacy URLs that weren't redirected.

## Step 5 — Update outreach + external assets

- All 15 outreach emails in outreach-top15-2026-08-01.csv: update
  our_replacement URLs to the new domain BEFORE sending. (Do not send
  on the old domain — that's the whole point.)
- Update competitor-opportunities CSVs the same way.
- Update Twitter/LinkedIn/GitHub links in Organization schema sameAs.

## Step 6 — Verification checklist (pre-completion)

- [ ] `curl -sI https://ytseoarchitect.com` → 200
- [ ] `curl -sI https://ytseoarchitect.com/sitemap.xml` → 200
- [ ] `curl -s https://ytseoarchitect.com | grep canonical` → new domain
- [ ] `curl -s https://ytseoarchitect.com | grep og:url` → new domain
- [ ] JSON-LD Organization.url = new domain
- [ ] Old subdomain canonical points to new domain
- [ ] GSC: new property verified, sitemap submitted, change-of-address set
- [ ] grep count of old domain in codebase = 0 (except outreach history)

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Temporary ranking dip on move | Canonical tags + 301s + GSC change-of-address minimize this. With 0 backlinks and likely minimal organic traffic, impact ≈ zero. |
| Some external links already point at subdomain | There are 0 confirmed external links. None to preserve. |
| LLM/AI citations reference old domain | AI answers cite the subdomain currently (it appears in answer engines). Canonicals + eventual 301 fix over time. |
| Sitemap/indexation confusion | Submit new sitemap, remove old, keep both live 3-6 months. |

## Effort estimate

- Code change: ~1 hour (batch replace + generators) — the html-batch-
  transformation skill covers this exact pattern.
- DNS + Vercel + GSC: ~30 min.
- Total: ~2 hours of focused work, one deploy.

## Immediate next action (pick one)

1. Register the domain, then I execute Steps 2-3 (batch URL swap + vercel.json).
2. Keep the .vercel.app for now — update the 15 outreach emails to use
   the new domain the moment it's registered.
3. Full stop on migration; proceed with outreach on current domain
   (accepting future redirect debt).
