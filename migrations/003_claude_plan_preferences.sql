-- Claude plan preferences for ROI calculations
-- Adds claude_plan field to users table to track which subscription plan they're on

-- Add claude_plan field to users table
ALTER TABLE users ADD COLUMN claude_plan TEXT DEFAULT 'max_100';

-- Add index for claude_plan lookups
CREATE INDEX idx_users_claude_plan ON users(claude_plan) WHERE is_deleted = 0;