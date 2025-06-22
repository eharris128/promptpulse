-- Migration: Add leaderboard settings to users table
-- Created: 2025-06-22

-- Add leaderboard-related columns to users table
ALTER TABLE users ADD COLUMN leaderboard_enabled BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN leaderboard_updated_at DATETIME;

-- Update existing users with default timestamp
UPDATE users SET leaderboard_updated_at = CURRENT_TIMESTAMP WHERE leaderboard_updated_at IS NULL;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_leaderboard_enabled ON users(leaderboard_enabled);