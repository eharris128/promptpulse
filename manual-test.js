import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';
import fs from 'fs';

async function testManualMigration() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    // Try to manually execute the users table creation
    const usersSql = fs.readFileSync('./migrations/002_create_users_table.sql', 'utf8');
    console.log('Users migration SQL:', usersSql.substring(0, 200) + '...');
    
    // Split by semicolon like the migration script does
    const statements = usersSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}:`, statement.substring(0, 100) + '...');
        try {
          await db.exec(statement);
          console.log(`✓ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`✗ Statement ${i + 1} failed:`, error.message);
        }
      }
    }
    
    // Check if users table now exists
    const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('Tables after manual execution:', tables);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

testManualMigration();