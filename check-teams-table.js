import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

async function checkTeamsTable() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    // Check table structure
    const columns = await db.sql`PRAGMA table_info(teams)`;
    console.log('Teams table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type} (nullable: ${col.notnull === 0})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkTeamsTable();