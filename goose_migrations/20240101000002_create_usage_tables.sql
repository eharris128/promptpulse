-- +goose Up
-- Create usage tracking tables with all related indexes and triggers
-- Handles daily aggregates, sessions, blocks, and upload history

-- Daily usage aggregates
CREATE TABLE usage_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,               -- Machine identifier
  date TEXT NOT NULL,                     -- Date in YYYY-MM-DD format
  
  -- Token usage breakdown
  input_tokens INTEGER DEFAULT 0,        -- Input tokens used
  output_tokens INTEGER DEFAULT 0,       -- Output tokens generated
  cache_creation_tokens INTEGER DEFAULT 0, -- Tokens used for cache creation
  cache_read_tokens INTEGER DEFAULT 0,   -- Tokens from cache reads
  total_tokens INTEGER DEFAULT 0,        -- Total tokens (sum of above)
  
  -- Cost tracking
  total_cost REAL DEFAULT 0,             -- Total cost in USD
  
  -- Model usage tracking
  models_used TEXT,                      -- JSON array of models used
  model_breakdowns TEXT,                 -- JSON object with per-model stats
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, machine_id, date)
);

-- Session-level usage data
CREATE TABLE usage_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,               -- Machine identifier
  session_id TEXT NOT NULL,               -- Unique session identifier
  project_path TEXT,                      -- Project path for the session
  
  -- Session timing
  start_time DATETIME NOT NULL,          -- Session start time
  end_time DATETIME,                     -- Session end time (if completed)
  duration_minutes INTEGER,              -- Session duration in minutes
  
  -- Token usage breakdown (same as usage_data)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_cost REAL DEFAULT 0,
  
  -- Model usage tracking
  models_used TEXT,
  model_breakdowns TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, machine_id, session_id)
);

-- Block-level usage data (5-hour billing periods)
CREATE TABLE usage_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,               -- Machine identifier
  block_id TEXT NOT NULL,                 -- Unique block identifier
  
  -- Block timing
  start_time DATETIME NOT NULL,          -- Block start time
  end_time DATETIME NOT NULL,            -- Block scheduled end time
  actual_end_time DATETIME,              -- Actual end time (if completed)
  is_active BOOLEAN DEFAULT 0,           -- Whether block is currently active
  entry_count INTEGER DEFAULT 0,         -- Number of entries in this block
  
  -- Token usage breakdown (same as usage_data)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_cost REAL DEFAULT 0,
  
  -- Model usage tracking
  models_used TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, machine_id, block_id)
);

-- Upload tracking table (prevents duplicate uploads)
CREATE TABLE upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,               -- Machine identifier
  upload_type TEXT NOT NULL,              -- Type of upload (session, block, daily)
  identifier TEXT NOT NULL,               -- Unique identifier for the upload
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, machine_id, upload_type, identifier)
);

-- Usage data indexes for leaderboard queries
CREATE INDEX idx_usage_data_user_date ON usage_data(user_id, date DESC);
CREATE INDEX idx_usage_data_user_machine_date ON usage_data(user_id, machine_id, date DESC);

-- Session indexes for detailed analysis
CREATE INDEX idx_sessions_user_time ON usage_sessions(user_id, start_time DESC);
CREATE INDEX idx_sessions_user_machine_time ON usage_sessions(user_id, machine_id, start_time DESC);
CREATE INDEX idx_sessions_project ON usage_sessions(user_id, project_path) WHERE project_path IS NOT NULL;

-- Block indexes for billing period analysis
CREATE INDEX idx_blocks_user_time ON usage_blocks(user_id, start_time DESC);
CREATE INDEX idx_blocks_user_active ON usage_blocks(user_id, is_active) WHERE is_active = 1;
CREATE INDEX idx_blocks_user_machine_time ON usage_blocks(user_id, machine_id, start_time DESC);

-- Upload history indexes for deduplication
CREATE INDEX idx_upload_history_user_machine ON upload_history(user_id, machine_id, upload_type, uploaded_at DESC);

-- Update timestamp triggers for usage tables
CREATE TRIGGER update_usage_data_timestamp AFTER UPDATE ON usage_data
BEGIN
  UPDATE usage_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_usage_sessions_timestamp AFTER UPDATE ON usage_sessions
BEGIN
  UPDATE usage_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_usage_blocks_timestamp AFTER UPDATE ON usage_blocks
BEGIN
  UPDATE usage_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- +goose Down
-- Drop triggers first
DROP TRIGGER IF EXISTS update_usage_blocks_timestamp;
DROP TRIGGER IF EXISTS update_usage_sessions_timestamp;
DROP TRIGGER IF EXISTS update_usage_data_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_upload_history_user_machine;
DROP INDEX IF EXISTS idx_blocks_user_machine_time;
DROP INDEX IF EXISTS idx_blocks_user_active;
DROP INDEX IF EXISTS idx_blocks_user_time;
DROP INDEX IF EXISTS idx_sessions_project;
DROP INDEX IF EXISTS idx_sessions_user_machine_time;
DROP INDEX IF EXISTS idx_sessions_user_time;
DROP INDEX IF EXISTS idx_usage_data_user_machine_date;
DROP INDEX IF EXISTS idx_usage_data_user_date;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS upload_history;
DROP TABLE IF EXISTS usage_blocks;
DROP TABLE IF EXISTS usage_sessions;
DROP TABLE IF EXISTS usage_data;