-- +goose Up
-- Create users table with all user-related fields and indexes
-- Includes display name settings for both public and team contexts

-- Users table with KSUID as primary key
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

-- Users table indexes for performance
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash) WHERE is_deleted = 0;
CREATE INDEX idx_users_email ON users(email) WHERE is_deleted = 0;
CREATE INDEX idx_users_username ON users(username) WHERE is_deleted = 0;
CREATE INDEX idx_users_leaderboard ON users(leaderboard_enabled, leaderboard_updated_at) WHERE is_deleted = 0;
CREATE INDEX idx_users_claude_plan ON users(claude_plan) WHERE is_deleted = 0;

-- Update users timestamp trigger
CREATE TRIGGER update_users_timestamp AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- +goose Down
-- Drop trigger first
DROP TRIGGER IF EXISTS update_users_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_users_claude_plan;
DROP INDEX IF EXISTS idx_users_leaderboard;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_api_key_hash;

-- Drop table
DROP TABLE IF EXISTS users;