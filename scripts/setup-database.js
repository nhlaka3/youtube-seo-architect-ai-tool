#!/usr/bin/env node
// Database setup script for YouTube SEO Tool
// Run with: node scripts/setup-database.js

import { runMigrations } from '../src/database/migrate.js';
import { initDatabase, checkDatabaseHealth } from '../src/database/connection.js';
import logger from '../src/monitoring/logger.js';

const setupDatabase = async () => {
  try {
    console.log('YouTube SEO Tool - Database Setup');
    console.log('=====================================\n');

    // Check environment variables
    const requiredVars = ['DATABASE_URL'];
    const missing = requiredVars.filter(v => !process.env[v]);

    if (missing.length > 0) {
      console.error('Missing required environment variables:');
      missing.forEach(v => console.error(`   - ${v}`));
      console.error('\nPlease add them to your .env file');
      process.exit(1);
    }

    console.log('Environment variables found\n');

    // Initialize database connection
    console.log('Initializing database connection...');
    initDatabase();
    console.log('Database connection initialized\n');

    // Run migrations
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Migrations completed successfully\n');

    // Check health
    console.log('Checking database health...');
    const health = await checkDatabaseHealth();

    if (health.status === 'healthy') {
      console.log('Database health check passed');
      console.log(`   Status: ${health.status}`);
      console.log(`   Message: ${health.message}\n`);
    } else {
      console.error('Database health check failed:');
      console.error(`   ${health.message}\n`);
      process.exit(1);
    }

    console.log('Database setup complete!');
    console.log('   Your PostgreSQL database is ready to use.\n');
    console.log('Next steps:');
    console.log('   1. Update .env with your API keys');
    console.log('   2. Run the application: npm run dev');
    process.exit(0);

  } catch (error) {
    console.error('\nDatabase setup failed:');
    console.error(`   ${error.message}\n`);
    logger.error('Database setup failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

setupDatabase();
