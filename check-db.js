import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database(process.env.DATABASE_URL);

try {
  const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table'`;
  console.log('Available tables:', tables.map(t => t.name));
  
  if (tables.find(t => t.name === 'migrations')) {
    const migrations = await db.sql`SELECT filename FROM migrations ORDER BY executed_at`;
    console.log('Executed migrations:', migrations.map(m => m.filename));
  } else {
    console.log('No migrations table found');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await db.close();
}