# Backlink Strategy — YT SEO Architect

**Current state:** 9 backlinks from 3 domains (1 dofollow) — DR 0
**Target:** 20+ dofollow backlinks from DR 40+ domains within 90 days

---

## Architecture: Three-Tier Backlink System

```
TIER 1: Automated (Set once, runs forever)
  ├── npm package → DR 92 dofollow
  ├── GitHub repo → DR 96 dofollow
  ├── dev.to cross-posts → DR 91 dofollow (canonical)
  ├── Hashnode cross-posts → DR 82 dofollow (canonical)
  └── Medium cross-posts → DR 95 dofollow (canonical)

TIER 2: Manual (One-time setup, high ROI)
  ├── Directory submissions → DR 40-80
  ├── Product Hunt launch → DR 89
  ├── AlternativeTo listing → DR 78
  └── Betalist submission → DR 72

TIER 3: Outreach (Recurring, highest ROI)
  ├── Broken link building → DR 30-80
  ├── Resource page outreach → DR 40-80
  ├── Guest posting → DR 40-90
  └── HARO/journalist queries → DR 60-95
```

---

## TIER 1: Automated (RUN NOW)

### 1.1 npm Package — `youtube-title-scorer`

**Status:** Built, pending `npm login` + `npm publish`

```bash
cd opensource/youtube-title-scorer
npm login
npm publish --access public
```

**What this gets you:**
- npmjs.com backlink (DR 92, dofollow)
- GitHub repo backlink (DR 96, dofollow) — after pushing to GitHub
- Organic backlinks from devs who install and blog about it
- Natural-looking backlink profile (open source → commercial tool)

**After publishing:**
```bash
# Push to GitHub for the DR 96 backlink
git init
git add -A
git commit -m "Initial release: YouTube Title Scorer v1.0.0"
git remote add origin https://github.com/nhlaka/youtube-title-scorer.git
git push -u origin main

# Promote on:
# - Reddit r/node, r/javascript, r/NewTubers
# - Twitter/X with #buildinpublic
# - dev.to as a "I built a tool" post
```

### 1.2 Cross-Posting (dev.to + Hashnode)

**Script:** `scripts/backlink-crosspost.py`

```bash
# Setup (one-time)
export DEVTO_API_KEY="your_key_from_https://dev.to/settings/extensions"
export HASHNODE_TOKEN="your_token_from_https://hashnode.com/settings/developer"
export HASHNODE_PUBLICATION_ID="your_publication_id"

# Cross-post all blog posts (wait 2-3 days between each)
python3 scripts/backlink-crosspost.py youtube-description-templates-2026
python3 scripts/backlink-crosspost.py youtube-thumbnail-ab-testing-guide
python3 scripts/backlink-crosspost.py github-seo-backlinks-guide
# ... repeat for all 10+ posts

# Dry-run to preview
python3 scripts/backlink-crosspost.py <slug> --dry-run

# List available posts
python3 scripts/backlink-crosspost.py --list
```

**What this gets you per post:**
- dev.to link (DR 91, dofollow, canonical points to you)
- Hashnode link (DR 82, dofollow, canonical points to you)
- Medium link (DR 95, dofollow) — via existing `scripts/publish-to-medium.mjs`

**Platform** | **DR** | **Link type** | **Setup needed**
dev.to | 91 | dofollow + canonical | DEVTO_API_KEY
Hashnode | 82 | dofollow + canonical | HASHNODE_TOKEN
Medium | 95 | dofollow + canonical | MEDIUM_SID + MEDIUM_UID

### 1.3 Broken Link Finder

**Script:** `scripts/backlink-finder.py`

```bash
# Find outreach opportunities
python3 scripts/backlink-finder.py "youtube seo tools guide"
python3 scripts/backlink-finder.py "youtube description templates" --pages 20
python3 scripts/backlink-finder.py "best youtube analytics tools 2026" --output outreach.csv
```

**Typical results:** 10-50 broken links per query → 1-5 actual backlinks from outreach

---

## TIER 2: Directory Submissions (ONE-TIME)

| Directory | DR | Type | URL to submit |
|-----------|-----|------|---------------|
| **Product Hunt** | 89 | dofollow | Launch on a Tuesday, use /?ref=producthunt landing page |
| **AlternativeTo** | 78 | dofollow | Submit 7+ days after launch |
| **Betalist** | 72 | dofollow | Submit as "YouTube SEO tool" |
| **SaaSHub** | 65 | dofollow | Rejects vercel.app — use once on custom domain |
| **FeedMyApp** | 58 | dofollow | Submit as free/freemium tool |
| **StackScope** | 35 | nofollow | Already listed (useless for SEO) |
| **SideProjectors** | 70 | ? | Already listed |

**Action plan:**
1. Product Hunt launch → Tuesday, 12:01 AM PST
2. Wait 7 days → submit to AlternativeTo
3. Submit to Betalist + FeedMyApp same week
4. Update existing SideProjectors listing with better description

---

## TIER 3: Outreach Strategy

### 3.1 Broken Link Building (highest ROI)

**Script handles discovery. You handle outreach.**

For each broken link found:
1. Verify it's actually broken (script does this)
2. Find contact: check /about, /contact, or use hunter.io
3. Send template (script generates)
4. Track in spreadsheet
5. Follow up once after 5 days

**Targets by niche:**
- "youtube seo tools" resource pages
- "best youtube analytics" listicles
- "youtube creator toolkit" guides
- University .edu pages about YouTube/video (DR 85+)
- GitHub awesome-youtube lists (DR 96)

### 3.2 Resource Page Outreach

Search and pitch to these page types:
```
"youtube seo tools" + "resources"
"youtube creator" + "useful links"
"youtube growth" + "recommended tools"
"video seo" + "best tools"
```

Template:
```
Subject: Suggestion for your [Page Name] resource list

Hi [Name],

Found your excellent [page name] at [URL]. Really liked
[one specific thing you genuinely liked].

I built YT SEO Architect — a free AI YouTube SEO tool
with title optimizer, tag generator, and keyword research.
It might be a useful addition to your list.

https://yt-seo-architect.vercel.app

Features:
- AI YouTube title optimizer (scores titles 0-100)
- Free tag generator with 47 niches
- Keyword research with competition data
- Channel audit diagnostics

Free tier available, no credit card needed.

Let me know if it fits your list!

Best,
Patrick
```

### 3.3 Guest Posting Targets

| Site | DR | Topic ideas |
|------|-----|-------------|
| vidIQ blog | 78 | "How to use AI for YouTube title optimization" |
| TubeBuddy blog | 75 | "YouTube description templates that boost SEO" |
| Social Media Examiner | 86 | "YouTube SEO trends for 2026" |
| Later blog | 76 | "YouTube thumbnail A/B testing guide" |
| HubSpot (video) | 92 | "YouTube analytics metrics that matter" |

### 3.4 HARO / Journalist Queries

Sign up at:
- helpareporter.com (HARO)
- qwoted.com
- sourcebottle.com

Monitor for queries about:
- YouTube growth
- Content creator tools
- Video SEO
- AI tools for creators

---

## 90-Day Backlink Timeline

**Week 1-2: Automated (3-5 backlinks)**
- [ ] npm publish youtube-title-scorer
- [ ] Push to GitHub
- [ ] Cross-post 3 best blog posts to dev.to
- [ ] Cross-post 3 to Hashnode
- [ ] Cross-post 3 to Medium

**Week 3-4: Directories (3-5 backlinks)**
- [ ] Product Hunt launch (Tuesday)
- [ ] Submit to Betalist
- [ ] Submit to FeedMyApp
- [ ] Update SideProjectors listing

**Week 5-8: Outreach (5-10 backlinks)**
- [ ] Run broken link finder — send 20 outreach emails
- [ ] Run resource page outreach — send 10 emails
- [ ] Follow up on non-responders

**Week 9-12: Content (5-10 backlinks)**
- [ ] Pitch 3 guest posts to YouTube/creator blogs
- [ ] Cross-post remaining blog posts
- [ ] Monitor HARO for relevant queries

**Expected outcome:** 20-30 dofollow backlinks from DR 40+ domains

---

## Success Metrics

| Metric | Current | 30-day target | 90-day target |
|--------|---------|---------------|---------------|
| Referring domains | 3 | 10 | 25 |
| Dofollow backlinks | 1 | 8 | 20 |
| Domain Rating | 0 | 5-10 | 15-25 |
| Blog posts ranking | 0 | 2-3 | 5-8 |
| Organic traffic | ~0 | 50-100/mo | 500-1000/mo |

---

## Anti-Patterns (DON'T DO)

- Buy backlinks (Google penalty — manual action)
- Comment spam ("great post, check out my site")
- Link exchanges / PBNs (detected and devalued)
- Exact-match anchor text on all links (unnatural)
- Submit to low-quality directories (DR <20)
- Cross-post all posts same day (duplicate content flag)
