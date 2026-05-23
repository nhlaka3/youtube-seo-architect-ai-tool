# YouTube SEO Tool - Detailed Summary

## Overview
This is a **YouTube SEO (Search Engine Optimization) optimization and analytics tool** designed to help content creators improve their video visibility, engagement, and rankings on YouTube based on 2025/2026 algorithm parameters. It's a full-stack web application with a Node.js/Express backend and a frontend interface.

---

## Core Features

### 1. OAuth 2.0 Authentication
- Users authenticate via Google OAuth 2.0 to grant the tool "Manage your YouTube account" permissions
- Supports connecting to multiple YouTube channels with a channel selector

### 2. Keyword Discovery Engine
- **Alphabet Loop Search**: Automatically tests all 26 letters with a seed keyword (e.g., "tutorial a", "tutorial b") to find long-tail variations
- **Asterisk Wildcard Search**: Tests patterns like `how to * topic`, `best * for topic`, `topic vs *`
- **Golden Keyword Filter**: Surfaces keywords meeting strict criteria (≥4 words, low competition, high relevancy)
- **Autocomplete Proxy**: Proxies through backend to bypass CORS restrictions

### 3. AI-Powered Metadata Generation
- Uses **Groq API (Llama 3.1)** to generate optimized:
  - **Titles** (≤60 characters, front-loaded keywords, power words)
  - **Descriptions** (≥200 words with timestamps, CTAs, hashtags)
  - **Tags** (10-15 relevant terms)
- Supports both regular videos and Shorts (<90 seconds)
- Handles rate limiting with automatic retry logic

### 4. Video Metadata Auditor
- Checks:
  - Title length (≤60 chars optimal)
  - Description length (≥200 words)
  - Timestamp presence
  - Hashtag usage
  - Thumbnail quality (heuristic scoring 0-100)
  - Video duration (Shorts vs. long-form detection)

### 5. One-Click Auto-Fix Injection
- Generates AI-optimized replacements for poor metadata
- **Directly updates YouTube via Data API** (`Videos: update` endpoint)
- Tracks API quota usage (costs: LIST=1, UPDATE=50, THUMBNAIL=50, COMMENT=50)

### 6. Channel & Playlist Management
- **Topic Clusters**: AI generates 5 playlist groupings with video ideas
- **Playlist Settings**: Manages collusion tags, gateway links, official series status
- **Session Watch Time Optimization**: Tools to create "session start links" for playlist first videos

### 7. Competitor "Sniping"
- Analyzes competitor channels/videos to extract their keywords
- AI rewrites your metadata to match competitor topical authority
- Helps appear in "Suggested Videos" sidebar next to competitor content

### 8. Quota Management System
- Tracks daily API quota usage (default limit: 10,000 units)
- Automatic daily reset at midnight
- Task scheduling for quota-heavy operations
- Warning system before risky operations

### 9. Analytics & Hijack Dashboard
- Tracks "Suggested Video" traffic metrics
- Playlist exit rate analysis
- Gateway score calculations
- Snapshot history for tracking growth

### 10. Evergreen Content Alert
- Flags videos older than 12 months
- Suggests title/tag updates to trigger re-indexing ("faint ping" technique)

### 11. Thumbnail Redesign Suggestions
- AI generates 3 high-heat thumbnail concepts for underperforming videos
- Based on title analysis and CTR best practices

### 12. Scheduled Tasks & Automation
- **Weekly Refresh**: AI can auto-trigger metadata refresh on enabled channels
- **Infinite Loop**: Enables algorithmic "ping" through playlist restructuring
- Cron-based scheduling for background tasks

### 13. Transcript & Caption Support
- Caption upload initiation endpoint
- Auto-caption checking via YouTube API
- Audio audit: Verifies if series title is verbally mentioned in video

### 14. Series Abstract Generator
- AI writes cinematic 3-4 sentence descriptions for playlist series
- Semantic tag filtering (removes unrelated tags)

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla JavaScript, Vite |
| Backend | Express.js, Node.js |
| Database | SQLite (sql.js) |
| AI | Groq API (Llama 3.1 8B) |
| Auth | Google OAuth 2.0 |
| Scheduling | node-cron |
| API Proxy | YouTube Data API v3 |

---

## Database Schema

- **channels**: Stores channel config (infinite loop, weekly refresh, verbal bridge flags)
- **playlists**: Playlist metadata, collusion tags, gateway links, official series status
- **analytics**: Video-level metrics (view duration, exit rates, gateway scores)
- **quota**: Daily API quota tracking
- **scheduled_tasks**: Queued background operations
- **analytics_snapshots**: Historical metric snapshots

---

## User Flow

1. User clicks "Connect YouTube" → OAuth popup
2. Selects channel → Backend syncs state
3. Enters Channel URL or Playlist URL
4. Tool fetches videos → Runs AI audits in batches
5. User reviews AI suggestions → Clicks "Inject SEO"
6. Backend updates YouTube directly → Tracks quota

---

## API Endpoints (Backend)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/proxy-keywords` | GET | Proxy for YouTube autocomplete |
| `/api/ai/generate` | POST | AI content generation via Groq |
| `/api/save-state` | POST | Save channel settings |
| `/api/load-state/:channelId` | GET | Load channel settings |
| `/api/analytics/save` | POST | Save video analytics |
| `/api/playlist/save` | POST | Save playlist config |
| `/api/quota/status` | GET | Get quota status |
| `/api/quota/track` | POST | Track API usage |
| `/api/validate-series` | POST | Validate Official Series eligibility |
| `/api/competitor-snipe` | POST | Analyze competitor keywords |
| `/api/validate-metadata-relevance` | POST | Check tag relevance |
| `/api/generate-series-abstract` | POST | Generate playlist description |
| `/api/evergreen-audit` | POST | Flag stale videos |
| `/api/bad-thumbnail-redesign` | POST | Get thumbnail suggestions |
| `/api/session-start-link` | POST | Generate playlist session link |
| `/api/audio-audit` | POST | Check verbal series title mention |

---

## Running the Tool

```bash
# Install dependencies
npm install

# Start backend server (runs on port 3000)
node server.js

# Or use Vite for development
npm run dev
```

---

## Files Structure

```
/Youtube seo tool/
├── server.js          # Express backend with all API endpoints
├── main.js           # Frontend JavaScript (main logic)
├── index.html        # Main HTML file
├── style.css        # Styling
├── db.sqlite        # SQLite database
├── package.json     # Dependencies
├── dist/            # Built frontend assets
└── instructions.md # Original specification document
```
