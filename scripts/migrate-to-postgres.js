// scripts/migrate-to-postgres.js
#!/usr/bin/env node

import 'dotenv/config';
import { runMigrations, migrateFromKV } from '../src/database/migrate.js';
import { initDatabase } from '../src/database/connection.js';
import { kv, safeKV } from '../api/credits.js';
import logger from '../src/monitoring/logger.js';

async function main() {
  try {
    logger.info('Starting PostgreSQL migration');

    // Initialize database connection
    initDatabase();

    // Run schema migrations
    await runMigrations();

    // Migrate data from KV store if available
    if (typeof kv !== 'undefined' && kv) {
      logger.info('KV store detected, starting data migration');
      await migrateFromKV(kv.get.bind(kv), kv.set.bind(kv));
    } else {
      logger.info('No KV store available, skipping data migration');
    }

    logger.info('PostgreSQL migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('PostgreSQL migration failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();