import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

async function testTeamCreation() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    // Get the most recent team to see if invite_code is working
    const teams = await db.sql`SELECT * FROM teams ORDER BY created_at DESC LIMIT 1`;
    
    if (teams.length > 0) {
      console.log('Most recent team:');
      console.log('ID:', teams[0].id);
      console.log('Name:', teams[0].name);
      console.log('Invite Code:', teams[0].invite_code);
      console.log('Owner ID:', teams[0].owner_id);
    } else {
      console.log('No teams found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

testTeamCreation();