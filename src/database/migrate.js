// src/database/migrate.js
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema.js';
import { captureError } from '../monitoring/sentry.js';
import logger from '../monitoring/logger.js';

export const runMigrations = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for migrations');
  }

  logger.info('Starting database migrations');

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT UNIQUE NOT NULL,
        email TEXT,
        plan TEXT DEFAULT 'free' NOT NULL,
        credits INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        plan_expires_at TIMESTAMP WITH TIME ZONE,
        last_refresh TIMESTAMP WITH TIME ZONE,
        is_verified BOOLEAN DEFAULT false NOT NULL,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        reference TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS api_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_time INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        error TEXT,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS paypal_orders (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        order_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT DEFAULT 'USD' NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS optimization_queue (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_title TEXT,
        current_title TEXT,
        current_description TEXT,
        current_tags JSONB DEFAULT '[]',
        proposed_title TEXT,
        proposed_description TEXT,
        proposed_tags JSONB DEFAULT '[]',
        score_before INTEGER DEFAULT 0,
        score_after INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        actioned_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_opt_queue_channel ON optimization_queue(channel_id);
      CREATE INDEX IF NOT EXISTS idx_opt_queue_status ON optimization_queue(status);

      -- Add action_type column if missing (phronesismind.txt fix)
      ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS action_type TEXT;
      -- Add confidence, ev_score, rationale columns (inbox detail fix)
      ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS confidence INTEGER;
      ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS ev_score REAL;
      ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS rationale TEXT;

      -- Add video_title column to scan_results if missing
      ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS video_title TEXT;

      -- Add agent_calibration table (phronesismind.txt Layer 1)
      CREATE TABLE IF NOT EXISTS agent_calibration (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        action_type TEXT NOT NULL,
        video_id TEXT,
        predicted_conf REAL NOT NULL,
        actual_success REAL DEFAULT 0,
        impact_measured REAL,
        niche TEXT DEFAULT 'General',
        notes TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add agent_rules table (phronesismind.txt Layer 3)
      CREATE TABLE IF NOT EXISTS agent_rules (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        rule_name TEXT NOT NULL UNIQUE,
        description TEXT,
        condition TEXT NOT NULL,
        action TEXT DEFAULT 'reject',
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 5,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS optimization_trials (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        channel_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_title TEXT,
        optimization_type TEXT NOT NULL,
        before_metrics JSONB,
        after_metrics JSONB,
        applied_data JSONB,
        seo_score_before INTEGER,
        seo_score_after INTEGER,
        status TEXT DEFAULT 'pending' NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        measured_at TIMESTAMP WITH TIME ZONE,
        measurement_window INTEGER DEFAULT 7,
        improvement_pct INTEGER,
        notes TEXT,
        metadata JSONB
      );

      -- Phronesis Pipeline tables
      CREATE TABLE IF NOT EXISTS scan_results (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        title_score INTEGER DEFAULT 0,
        desc_score INTEGER DEFAULT 0,
        tag_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        ctr_signal REAL DEFAULT 0,
        retention_score INTEGER DEFAULT 0,
        niche_alignment INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        engagement REAL DEFAULT 0,
        issues JSONB DEFAULT '[]',
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_recommendations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        read_status BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add depth isolation columns to agent_settings (phronesismind.txt)
      ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS max_active_branches INTEGER DEFAULT 3;
      ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS memory_limit_mb INTEGER DEFAULT 512;
      ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 25;
      ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS reasoning_depth INTEGER DEFAULT 2;

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS users_channel_id_idx ON users(channel_id);
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON sessions(session_token);
      CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON credit_transactions(user_id);
      CREATE INDEX IF NOT EXISTS api_logs_user_id_idx ON api_logs(user_id);
      CREATE INDEX IF NOT EXISTS api_logs_created_at_idx ON api_logs(created_at);
      CREATE INDEX IF NOT EXISTS paypal_orders_order_id_idx ON paypal_orders(order_id);
    `;

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Database migration failed', { error: error.message, stack: error.stack });
    captureError(error, { tags: { category: 'database', operation: 'migration' } });
    throw error;
  }
};

export const migrateFromKV = async (kvGet, kvSet) => {
  logger.info('Starting data migration from KV store');

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  try {
    // Migrate users data
    const userKeys = await getAllKVKeys(kvGet, 'credits:*');
    const migratedUsers = new Set();

    for (const key of userKeys) {
      const channelId = key.replace('credits:', '');
      if (migratedUsers.has(channelId)) continue;

      try {
        const credits = await kvGet(key) || 0;
        const plan = await kvGet(`plan:${channelId}`) || 'free';

        // Check if user already exists
        const existingUser = await db.select().from(schema.users).where(eq(schema.users.channelId, channelId)).limit(1);

        if (existingUser.length === 0) {
          await db.insert(schema.users).values({
            channelId,
            plan: typeof plan === 'string' ? plan : 'free',
            credits: typeof credits === 'number' ? credits : parseInt(credits) || 0,
            isVerified: true, // Assume verified since they have data
          });

          logger.info('Migrated user', { channelId, credits, plan });
        }

        migratedUsers.add(channelId);
      } catch (error) {
        logger.error('Failed to migrate user', { channelId, error: error.message });
      }
    }

    logger.info(`Data migration completed. Migrated ${migratedUsers.size} users`);
  } catch (error) {
    logger.error('Data migration failed', { error: error.message });
    captureError(error, { tags: { category: 'database', operation: 'data_migration' } });
    throw error;
  }
};

// Helper to get all keys matching a pattern (simplified for KV)
const getAllKVKeys = async (kvGet, pattern) => {
  // This is a simplified version. In a real implementation,
  // you'd need to scan all keys or maintain an index
  const keys = [];

  // For this demo, we'll assume we have a way to list keys
  // In Vercel KV, you might need to maintain a separate index
  try {
    // This would need to be implemented based on your KV provider
    // For now, return empty array - manual migration may be needed
    return keys;
  } catch (error) {
    logger.warn('Could not retrieve KV keys for migration', { error: error.message });
    return keys;
  }
};

export default { runMigrations, migrateFromKV };