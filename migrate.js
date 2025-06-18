import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigrations() {
  const db = new Database(DATABASE_URL);
  
  try {
    // Create migrations table if it doesn't exist
    await db.sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Get list of executed migrations
    const executedMigrations = await db.sql`SELECT filename FROM migrations`;
    const executed = executedMigrations.map(row => row.filename);
    
    // Read migration files
    const migrationsPath = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      if (!executed.includes(file)) {
        console.log(`Running migration: ${file}`);
        
        const migrationSQL = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
          if (statement.trim()) {
            await db.sql`${statement}`;
          }
        }
        
        // Record migration as executed
        await db.sql`INSERT INTO migrations (filename) VALUES (${file})`;
        
        console.log(`✓ Migration ${file} completed`);
      }
    }
    
    console.log('All migrations completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };