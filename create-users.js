import { Database } from '@sqlitecloud/drivers';
import dotenv from 'dotenv';

dotenv.config();

const db = new Database(process.env.DATABASE_URL);

try {
  // Create users table
  await db.sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  // Create indexes
  await db.sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await db.sql`CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)`;
  await db.sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  
  console.log('✅ Users table created successfully!');
  
  // Check if it was created
  const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`;
  console.log('Users table exists:', tables.length > 0);
  
} catch (error) {
  console.error('❌ Error creating users table:', error.message);
} finally {
  await db.close();
}