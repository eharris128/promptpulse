-- Add sessions_count column to usage_data table
-- This column tracks the number of sessions that occurred on a specific date/machine

ALTER TABLE usage_data ADD COLUMN sessions_count INTEGER DEFAULT 0;

-- Create index for sessions_count queries
CREATE INDEX idx_usage_data_sessions_count ON usage_data(user_id, sessions_count) WHERE sessions_count > 0;