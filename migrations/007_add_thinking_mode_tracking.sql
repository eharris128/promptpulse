-- Add thinking mode tracking to usage tables
-- This enables tracking when Claude Code conversations use thinking mode

-- Add thinking mode fields to daily usage data
ALTER TABLE usage_data ADD COLUMN thinking_mode_detected BOOLEAN DEFAULT 0;
ALTER TABLE usage_data ADD COLUMN thinking_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_data ADD COLUMN thinking_percentage REAL DEFAULT 0;

-- Add thinking mode fields to session data
ALTER TABLE usage_sessions ADD COLUMN thinking_mode_detected BOOLEAN DEFAULT 0;
ALTER TABLE usage_sessions ADD COLUMN thinking_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_sessions ADD COLUMN thinking_percentage REAL DEFAULT 0;

-- Add thinking mode fields to block data
ALTER TABLE usage_blocks ADD COLUMN thinking_mode_detected BOOLEAN DEFAULT 0;
ALTER TABLE usage_blocks ADD COLUMN thinking_tokens INTEGER DEFAULT 0;
ALTER TABLE usage_blocks ADD COLUMN thinking_percentage REAL DEFAULT 0;

-- Create indexes for thinking mode queries
CREATE INDEX idx_usage_data_thinking ON usage_data(user_id, thinking_mode_detected) WHERE thinking_mode_detected = 1;
CREATE INDEX idx_sessions_thinking ON usage_sessions(user_id, thinking_mode_detected) WHERE thinking_mode_detected = 1;
CREATE INDEX idx_blocks_thinking ON usage_blocks(user_id, thinking_mode_detected) WHERE thinking_mode_detected = 1;