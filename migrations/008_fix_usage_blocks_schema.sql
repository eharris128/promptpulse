-- Fix usage_blocks table schema to match code expectations
-- Adds missing columns that are being queried in routes/usage.js

-- Add missing session_id column
ALTER TABLE usage_blocks ADD COLUMN session_id TEXT;

-- Add missing model_name column (used by GET /api/usage/blocks)
ALTER TABLE usage_blocks ADD COLUMN model_name TEXT;

-- Add missing data_type column (used by GET /api/usage/blocks)
ALTER TABLE usage_blocks ADD COLUMN data_type TEXT;

-- Add missing tokens_used column alias (code expects this instead of total_tokens)
ALTER TABLE usage_blocks ADD COLUMN tokens_used INTEGER DEFAULT 0;

-- Add missing cost column alias (code expects this instead of total_cost)  
ALTER TABLE usage_blocks ADD COLUMN cost REAL DEFAULT 0;

-- Add indexes for new columns to maintain query performance
CREATE INDEX idx_blocks_session_id ON usage_blocks(user_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_blocks_model_name ON usage_blocks(user_id, model_name) WHERE model_name IS NOT NULL;
CREATE INDEX idx_blocks_data_type ON usage_blocks(user_id, data_type) WHERE data_type IS NOT NULL;