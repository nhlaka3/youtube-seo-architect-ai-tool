# YT SEO Architect

AI-powered YouTube SEO platform with 17 tools for keyword research, tag generation, metadata optimization, and channel growth.

**🔗 Live app:** [https://yt-seo-architect.vercel.app](https://yt-seo-architect.vercel.app) — free, no signup required

**🛠️ Featured tools**
- [Tag Generator](https://yt-seo-architect.vercel.app/tools/tag-generator) — 30 optimized tags per video
- [Title Optimizer](https://yt-seo-architect.vercel.app/tools/title-optimizer) — CTR-focused titles
- [Keyword Research](https://yt-seo-architect.vercel.app/tools/keywords-youtube) — search volume + difficulty
- [Description Writer](https://yt-seo-architect.vercel.app/tools/description-writer) — SEO descriptions
- [All 17 tools](https://yt-seo-architect.vercel.app/tools) + [YouTube SEO blog](https://yt-seo-architect.vercel.app/blog)

## Architecture

```
├── api/                    # Express API (Vercel serverless)
│   ├── index.js            # Main app + mount points
│   ├── credits.js          # Credit system (100 free/month, per-channel)
│   ├── ai-engine.js        # AI generation (Groq → Gemini failover)
│   ├── youtube-ops.js      # YouTube API operations
│   ├── _lib/ai-provider.js # Multi-brain AI provider
│   └── middleware/          # CSRF, validation, rate limiting
├── src/database/           # Drizzle ORM + Neon Postgres
│   ├── schema.js           # Table definitions
│   ├── services.js         # CRUD operations
│   ├── connection.js       # Neon serverless driver
│   └── migrate.js          # Migration runner
├── public/tools/           # Public SEO landing pages
│   ├── tag-generator.html  # Dynamic tag generation per niche
│   ├── title-optimizer.html
│   └── description-writer.html
├── public/blog/            # Blog articles
├── js/modules/             # Client-side modules
│   ├── credit-system.js    # PayPal + credit sync
│   └── feature-hub.js      # Feature orchestration
├── main.js                 # Dashboard (350KB vanilla JS)
├── dashboard.html          # Dashboard shell
├── index.html              # Homepage
└── vercel.json             # Routes, cron, CSP headers
```

## Blog Post SEO Guidelines (Strict Standards)

All new articles written for the blog must adhere to our search engine and SGE optimization standards:
*   **Template Boilerplate**: Always copy `public/blog/_TEMPLATE.html` as the starting point.
*   **Word Count**: Each blog post must contain at least 1,500 words (never less than 1,200 words) of high-yield, comprehensive SEO coverage.
*   **Live Reference Blueprint**: Refer to `public/blog/youtube-shorts-seo-ranking-guide.html` as the gold standard implementation of placeholders, semantic headings, and call-to-actions.
*   **Dual Structured Schema**: Each post must include both `Article` metadata and `FAQPage` rich snippets in JSON-LD. Visible body FAQs under `<details>` must match the `FAQPage` schema text exactly.
*   **LLM Summary Box**: Include a bulleted `⚡ TL;DR` box at the start of the article for AI Overview optimization.
*   **Styling**: Link directly to `/blog/blog.css`. Do not add inline `<style>` tags.
*   **Indexing Registration**: Always register the new post in `public/sitemap.xml` and add its card at the top of `blog.html` for internal link crawling.

## Key Features

| Feature | Endpoint | Description |
|---|---|---|
| Keyword Research | Client-side Alphabet Loop + Google Suggest | Scrapes A-Z + asterisk patterns |
| Metadata Auditor | Client-side scoring + AI fixes | Free, no credits required |
| SEO Bundle | `/api/ai/seo-bundle` | AI-generated titles, tags, description |
| Credit System | `/api/credits/*` | 100 free/month, per-channel isolation |
| Optimization Trials | `/api/youtube/optimization-history` | Before/after metrics tracking |
| Growth Engine | `/api/youtube/growth-engine/scan` | Auto-detects underperforming videos |
| PayPal | `/api/credits/purchase-success` | Pro ($5/mo) + Agency ($19/mo) |
| Cron | Daily 6am UTC | Measures pending optimization trials |

## Environment Variables

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection |
| `GROQ_API_KEY` | Primary AI provider (llama-3.1-8b) |
| `GEMINI_API_KEY` | Fallback AI provider |
| `PAYPAL_CLIENT_ID` | PayPal checkout |
| `PAYPAL_SECRET` | PayPal API secret |
| `CRON_SECRET` | Cron job authentication |
| `YOUTUBE_API_KEY` | Public YouTube Data API |
| `CSRF_SECRET` | CSRF token signing |
| `SESSION_SECRET` | Session encryption |

## Deployment

```bash
npm run build    # Vite production build
vercel --prod    # Deploy to Vercel
```

## Tech Stack

- **Frontend:** Vanilla JS, Vite, Lucide Icons
- **Backend:** Express 5, Vercel Serverless
- **Database:** Neon Postgres (serverless), Drizzle ORM
- **AI:** Groq (llama-3.1-8b-instant) → Gemini 2.0 Flash failover
- **Payments:** PayPal REST API
- **Monitoring:** Sentry, Vercel Analytics
- **Auth:** Google OAuth 2.0 (YouTube Data API v3)
