# YouTube SEO Master Pro

**Automate Your YouTube Growth with AI-Powered SEO Tools**

---

## What Is YouTube SEO Master Pro?

A complete YouTube optimization platform that automates video auditing, metadata generation, thumbnail creation, and bulk metadata injection using AI.

## Key Features

- **AI Channel Audit** - Deep analysis of your channel's SEO health
- **Smart Metadata** - AI-generated titles, descriptions, and tags
- **Thumbnail Suite** - Create and upload custom thumbnails
- **Bulk Operations** - Inject tags to multiple videos at once
- **Evergreen Flagging** - Identify videos that need refresh
- **Auto-Responder** - AI-powered comment replies
- **Playlist Optimization** - Gateway links and session links

## What's Included

- Full source code (Node.js + HTML/JS)
- PostgreSQL database with Neon serverless
- Comprehensive monitoring and error tracking
- YouTube API integration
- Groq AI integration for content generation
- Detailed documentation

## Requirements

- Node.js 20+
- YouTube Data API v3 credentials
- Groq API key (free tier available)
- Neon PostgreSQL account (free tier available)
- Sentry account (optional, for error tracking)

## Database Setup

### Neon PostgreSQL Setup

1. Create a free account at [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy the connection string from the dashboard
4. Add it to your `.env` file as `DATABASE_URL`

### Database Migration

Run the migration script to set up tables and migrate data:

```bash
npm run db:migrate
```

This will:
- Create all necessary tables
- Set up indexes for performance
- Migrate existing data from KV store (if available)

## Quick Start

1. Extract the ZIP file
2. Run `npm install`
3. Edit `.env` with your API keys and database URL
4. Run `npm run db:migrate` to set up the database
5. Run `npm start`
6. Open `http://localhost:5175`

## Health Checks

The application includes comprehensive health checks:

- `GET /api/health` - Overall system health
- `GET /api/health/database` - Database connectivity
- `GET /api/health/external` - External service status
- `GET /api/health/system` - System resources
- `GET /api/health/application` - Application configuration

## Support

Email: support@yourdomain.com

## License

Single-user license. Resale not permitted.
