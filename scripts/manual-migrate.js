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

async function manualMigrate(sqlFilePath) {
  if (!sqlFilePath) {
    console.error('Usage: node manual-migrate.js <path-to-sql-file>');
    process.exit(1);
  }

  const db = new Database(DATABASE_URL);
  
  try {
    // Ensure migrations table exists
    await db.sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Get the filename from the path
    const filename = path.basename(sqlFilePath);
    
    // Check if migration has already been applied
    const existing = await db.sql`SELECT filename FROM migrations WHERE filename = ${filename}`;
    if (existing.length > 0) {
      console.log(`✓ Migration ${filename} has already been applied`);
      return;
    }

    // Read the entire SQL file
    const fullPath = path.isAbsolute(sqlFilePath) ? sqlFilePath : path.resolve(sqlFilePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Migration file not found: ${fullPath}`);
    }

    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    console.log(`Running migration: ${filename}`);
    console.log(`File: ${fullPath}`);
    
    // Remove comments and empty lines
    const cleanedSQL = sqlContent
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      })
      .join('\n');

    if (!cleanedSQL.trim()) {
      throw new Error('Migration file appears to be empty after removing comments');
    }

    // Split into individual statements more carefully
    // Split on semicolons that are followed by whitespace or newlines (not inside strings)
    const statements = cleanedSQL
      .split(/;\s*(?=\n|$)/)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  Executing statement ${i + 1}/${statements.length}...`);
          await db.exec(statement);
          console.log(`  ✓ Statement ${i + 1} completed`);
        } catch (error) {
          console.error(`  ✗ Error in statement ${i + 1}:`);
          console.error(`  Statement: ${statement.substring(0, 100)}...`);
          console.error(`  Error: ${error.message}`);
          throw error;
        }
      }
    }

    // Record migration as completed
    await db.sql`INSERT INTO migrations (filename) VALUES (${filename})`;
    
    console.log(`✓ Migration ${filename} completed successfully`);
    console.log(`✓ Migration recorded in database`);

  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Get the SQL file path from command line arguments
const sqlFilePath = process.argv[2];
manualMigrate(sqlFilePath);