import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';
import crypto from 'crypto';

async function addInviteCode() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    console.log('Adding invite_code column...');
    await db.exec('ALTER TABLE teams ADD COLUMN invite_code TEXT');
    
    console.log('Generating invite codes for existing teams...');
    const teams = await db.sql`SELECT id FROM teams`;
    
    for (const team of teams) {
      const inviteCode = crypto.randomBytes(8).toString('hex');
      await db.sql`UPDATE teams SET invite_code = ${inviteCode} WHERE id = ${team.id}`;
      console.log(`Updated team ${team.id} with invite code: ${inviteCode}`);
    }
    
    console.log('Creating index...');
    await db.exec('CREATE INDEX idx_teams_invite_code ON teams(invite_code) WHERE is_active = 1');
    
    console.log('Done! Checking final result...');
    const result = await db.sql`SELECT id, name, invite_code FROM teams`;
    result.forEach(team => {
      console.log(`Team ${team.name}: ${team.invite_code}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

addInviteCode();