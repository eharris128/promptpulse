import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';
import crypto from 'crypto';

async function fixExistingTeam() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    // Generate invite code for existing team
    const inviteCode = crypto.randomBytes(8).toString('hex');
    
    const result = await db.sql`
      UPDATE teams SET invite_code = ${inviteCode} 
      WHERE id = '2z7VsY1cEwbhNU9DJtlKO150bus'
    `;
    
    console.log('Updated team with invite code:', inviteCode);
    
    // Verify the update
    const team = await db.sql`SELECT * FROM teams WHERE id = '2z7VsY1cEwbhNU9DJtlKO150bus'`;
    console.log('Team invite code now:', team[0].invite_code);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixExistingTeam();