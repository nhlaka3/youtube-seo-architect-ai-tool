# Reddit Growth Agent

AI-powered agent that finds YouTube creators asking for help on Reddit and generates replies you can post manually. Never auto-posts — you review and post each reply yourself.

## What It Does

1. Every 15 minutes, scans 8 YouTube-related subreddits via Reddit's public API
2. Finds posts matching 30+ keyword triggers (views, tags, SEO, growth, etc.)
3. Skips posts older than 24h, stickied posts, and posts with 5+ comments
4. AI generates a 2-3 sentence genuinely helpful reply
5. **You copy the reply and post it manually** — full control, no automation risk

## Link Options (NEW)

Set `REDDIT_INCLUDE_LINKS` in your `.env` to control whether replies include URLs:

| Setting | Behavior |
|---|---|
| `REDDIT_INCLUDE_LINKS=true` (default) | Replies can include links to the tool or relevant blog posts |
| `REDDIT_INCLUDE_LINKS=false` | Help-only mode — no URLs, pure advice. Builds trust first. |

When links are enabled, the agent also matches post keywords to specific blog posts and suggests which URL to include.

## Setup

1. **Get Reddit API credentials:**
   - Go to https://www.reddit.com/prefs/apps
   - Click "Create App" → choose "script"
   - Fill in name, description, redirect URI (can be http://localhost)
   - Copy CLIENT_ID (under app name) and CLIENT_SECRET

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Reddit credentials + Groq API key
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Test (dry run — no replies posted):**
   ```bash
   node test.js
   ```

5. **Run locally (posts real replies):**
   ```bash
   npm start
   ```

## How It Works

- Scans 8 YouTube-related subreddits every 15 minutes
- Finds posts matching 30+ keyword triggers (views, tags, SEO, growth)
- AI generates a helpful 2-4 sentence reply using your context
- Replies with a soft recommendation for YT SEO Architect
- Tracks replied posts to avoid duplicates
- Rate limited to 10 replies/day with 3-5 min gaps

## Customization

Edit `config.js` to:
- Add/remove subreddits
- Change keyword triggers
- Adjust rate limits
- Modify the tool mention text

## Deploy to Vercel

```bash
vercel --prod
# Add env vars in Vercel dashboard
```
