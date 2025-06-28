import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

async function testDatabase() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    console.log('Testing database connection...');
    const result = await db.sql`SELECT 1 as test`;
    console.log('✓ Database connection successful:', result);
    
    console.log('Checking existing tables...');
    const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('Tables:', tables);
    
    console.log('Checking migrations table...');
    try {
      const migrations = await db.sql`SELECT * FROM migrations ORDER BY executed_at`;
      console.log('Migrations executed:', migrations);
    } catch (e) {
      console.log('No migrations table found');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await db.close();
  }
}

testDatabase();