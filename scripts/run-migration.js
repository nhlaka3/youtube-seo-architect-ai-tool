import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('Connecting to Neon database...');
    const sql = neon(databaseUrl);
    
    console.log('Running migration...\n');
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'drizzle', '0000_initial.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split and execute statements
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sql.query(statement + ';');
          console.log('✓ Executed statement');
        } catch (err) {
          if (err.message && err.message.includes('already exists')) {
            console.log('⚠ Already exists, skipping');
          } else {
            throw err;
          }
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Verify tables
    console.log('\nVerifying tables...');
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`;
    console.log('Tables created:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
