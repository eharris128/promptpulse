import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

const createTableSQL = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- KSUID string like "2z4ow5OVJUJaib0QEHj7PC2K7dB"
  email TEXT UNIQUE,                      -- User's email address
  username TEXT UNIQUE NOT NULL,          -- Unique username
  api_key_hash TEXT UNIQUE NOT NULL,      -- Hashed API key for authentication
  
  -- Display names for different contexts
  display_name TEXT,                      -- Public leaderboard display name
  team_display_name TEXT,                 -- Team-specific display name
  
  -- User preferences and settings
  timezone TEXT DEFAULT 'UTC',            -- User's timezone
  country TEXT,                           -- User's country
  claude_plan TEXT DEFAULT 'max_100',     -- Claude subscription plan
  
  -- Leaderboard participation controls
  leaderboard_enabled BOOLEAN DEFAULT 0,      -- Public leaderboard opt-in
  team_leaderboard_enabled BOOLEAN DEFAULT 1, -- Team leaderboard opt-in
  leaderboard_updated_at DATETIME,            -- Last leaderboard settings change
  
  -- Account status and tracking
  is_deleted BOOLEAN DEFAULT 0,          -- Soft delete flag
  last_login_at DATETIME,                -- Last login timestamp
  total_sessions INTEGER DEFAULT 0,      -- Total sessions count
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

async function testCreateTable() {
  const db = new Database(process.env.DATABASE_URL);
  
  try {
    console.log('Executing CREATE TABLE statement...');
    await db.exec(createTableSQL);
    console.log('✓ CREATE TABLE executed successfully');
    
    // Check if table now exists
    const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('Tables after CREATE TABLE:', tables);
    
  } catch (error) {
    console.error('CREATE TABLE failed:', error);
  } finally {
    await db.close();
  }
}

testCreateTable();