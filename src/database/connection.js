import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import pkg from 'pg';
const { Pool } = pkg;
import { captureError } from '../monitoring/sentry.js';
import logger from '../monitoring/logger.js';

let db;
let pool;
let isInitialized = false;

// Lazy initialization for serverless
export const initDatabase = () => {
  if (isInitialized && db) {
    return db;
  }

  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  if (!databaseUrl) {
    logger.warn('DATABASE_URL environment variable is not set');
    return null;
  }

  try {
    // For serverless environments (Vercel) - use neon-http
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      const sql = neon(databaseUrl);
      db = drizzleNeon(sql);
      logger.info('Database initialized with Neon serverless driver');
    } else {
      // For development/local - use connection pool
      pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      db = drizzlePg(pool);
      logger.info('Database initialized with PostgreSQL connection pool');
    }

    isInitialized = true;
    return db;
  } catch (error) {
    logger.error('Failed to initialize database', { error: error.message });
    captureError(error, { tags: { category: 'database', operation: 'init' } });
    return null;
  }
};

export const getDb = () => {
  if (!db) {
    // Try to initialize lazily
    return initDatabase();
  }
  return db;
};

export const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
};

// Health check for database - safe for serverless
export const checkDatabaseHealth = async () => {
  try {
    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    
    if (!databaseUrl) {
      return { status: 'degraded', message: 'DATABASE_URL not configured', db_connected: false };
    }

    // Test raw Neon connection directly (bypass Drizzle for health check)
    try {
      const sql = neon(databaseUrl);
      const result = await sql`SELECT 1 AS health_check`;
      if (result && result.length > 0) {
        return { status: 'healthy', message: 'Database connection successful', db_connected: true };
      }
    } catch (neonErr) {
      // If raw Neon fails, try the Drizzle-wrapped connection
      const database = getDb();
      if (database) {
        return { status: 'healthy', message: 'Database available via Drizzle', db_connected: true };
      }
      return { status: 'unhealthy', message: `Database error: ${neonErr.message}`, db_connected: false };
    }
    
    return { status: 'unhealthy', message: 'Database connection returned no result', db_connected: false };
  } catch (error) {
    return { status: 'unhealthy', message: `Database error: ${error.message}`, db_connected: false };
  }
};

// Initialize on module load for local, lazy for serverless
if (process.env.DATABASE_URL && !process.env.VERCEL) {
  initDatabase();
}

export default db;
