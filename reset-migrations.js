import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

async function resetMigrations() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    console.log('Clearing migrations table...');
    await db.exec('DELETE FROM migrations');
    console.log('✓ Migrations table cleared');
    
    console.log('Dropping any existing tables...');
    const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table' AND name != 'migrations'`;
    
    for (const table of tables) {
      console.log(`Dropping table: ${table.name}`);
      await db.exec(`DROP TABLE IF EXISTS ${table.name}`);
    }
    
    console.log('✓ All tables cleared, ready for fresh migration');
    
  } catch (error) {
    console.error('Reset failed:', error);
  } finally {
    await db.close();
  }
}

resetMigrations();