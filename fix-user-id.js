import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database(process.env.DATABASE_URL);

try {
  // Check current schema
  const columns = await db.sql`PRAGMA table_info(usage_data)`;
  console.log('Current usage_data columns:', columns.map(c => c.name));
  
  // Check if user_id column exists
  const hasUserId = columns.some(c => c.name === 'user_id');
  
  if (!hasUserId) {
    console.log('Adding user_id column to usage_data...');
    await db.sql`ALTER TABLE usage_data ADD COLUMN user_id INTEGER REFERENCES users(id)`;
    console.log('✅ Added user_id column');
  } else {
    console.log('✅ user_id column already exists');
  }
  
  // Update existing records to belong to user 1 (the default user)
  const result = await db.sql`UPDATE usage_data SET user_id = 1 WHERE user_id IS NULL`;
  console.log(`✅ Updated ${result} existing records to belong to user 1`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await db.close();
}