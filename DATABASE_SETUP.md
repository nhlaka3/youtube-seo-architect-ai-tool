# Database Setup Guide

## Quick Start

### 1. Set Up Neon PostgreSQL

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project or use existing
3. Get your connection string from the dashboard
4. Update `.env` file with your connection string:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/youtube_seo_db?sslmode=require
   ```

### 2. Run Migrations

Option 1: Using the setup script
```bash
node scripts/setup-database.js
```

Option 2: Manual drizzle commands
```bash
# Generate migrations (if schema changes)
npx drizzle-kit generate

# Run migrations
npx drizzle-kit migrate
```

### 3. Verify Connection

The setup script will automatically verify:
- Database connection
- Table creation
- Health check

## Database Schema

### Tables Created

1. **users** - User accounts with channel IDs
2. **sessions** - Active user sessions
3. **credit_transactions** - Credit usage and purchases
4. **api_logs** - API request logging
5. **paypal_orders** - Payment order tracking

### Indexes

All tables have appropriate indexes for:
- Primary key lookups
- Foreign key relationships
- Common query patterns
- Performance optimization

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Neon PostgreSQL connection string |
| NODE_ENV | No | development or production |
| LOG_LEVEL | No | debug, info, warn, error (default: info) |

### Production Notes

- Use pooled connection string for production: `...pooler...neon.tech/...`
- Ensure `sslmode=require` is in the connection string
- Neon handles backups automatically
- Consider setting up database branching for development

## Troubleshooting

### Connection Issues

1. Verify DATABASE_URL is set correctly
2. Check Neon dashboard for connection limits
3. Ensure sslmode=require is in the URL

### Migration Failures

1. Check database permissions
2. Verify connection string works
3. Review error logs in `logs/error-*.log`

## Status

Current Status: Ready for connection
- Migration files: Created
- Schema: Defined
- Setup script: Ready
- Next: Add your DATABASE_URL and run `node scripts/setup-database.js`
