-- Migration: Add session and block-level usage tables
-- Created: 2025-06-21

-- Session-level usage data
CREATE TABLE IF NOT EXISTS usage_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project_path TEXT,
  start_time DATETIME,
  end_time DATETIME,
  duration_minutes INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER,
  total_tokens INTEGER,
  total_cost REAL,
  models_used TEXT,
  model_breakdowns TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(machine_id, session_id)
);

-- Block-level usage data (5-hour billing periods)
CREATE TABLE IF NOT EXISTS usage_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  actual_end_time DATETIME,
  is_active BOOLEAN DEFAULT 0,
  entry_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER,
  total_tokens INTEGER,
  total_cost REAL,
  models_used TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(machine_id, block_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_machine_time ON usage_sessions(machine_id, start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON usage_sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_blocks_machine_time ON usage_blocks(machine_id, start_time);
CREATE INDEX IF NOT EXISTS idx_blocks_active ON usage_blocks(is_active);