-- Initial database schema with KSUID support and secure API key storage
-- This creates all necessary tables, indexes, and triggers

-- Users table with KSUID and secure API key storage
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ksuid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  api_key_hash TEXT UNIQUE NOT NULL,
  display_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  country TEXT,
  leaderboard_enabled BOOLEAN DEFAULT 0,
  leaderboard_updated_at DATETIME,
  is_deleted BOOLEAN DEFAULT 0,
  last_login_at DATETIME,
  total_sessions INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily usage aggregates
CREATE TABLE usage_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  date TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  models_used TEXT,
  model_breakdowns TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_id, date)
);

-- Session-level usage data
CREATE TABLE usage_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project_path TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration_minutes INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  models_used TEXT,
  model_breakdowns TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_id, session_id)
);

-- Block-level usage data (5-hour billing periods)
CREATE TABLE usage_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  actual_end_time DATETIME,
  is_active BOOLEAN DEFAULT 0,
  entry_count INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  models_used TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_id, block_id)
);

-- Upload tracking table
CREATE TABLE upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  upload_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_id, upload_type, identifier)
);

-- Users table indexes
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash) WHERE is_deleted = 0;
CREATE INDEX idx_users_ksuid ON users(ksuid) WHERE is_deleted = 0;
CREATE INDEX idx_users_email ON users(email) WHERE is_deleted = 0;
CREATE INDEX idx_users_username ON users(username) WHERE is_deleted = 0;
CREATE INDEX idx_users_leaderboard ON users(leaderboard_enabled, leaderboard_updated_at) WHERE is_deleted = 0;

-- Usage data indexes
CREATE INDEX idx_usage_data_user_date ON usage_data(user_id, date DESC);
CREATE INDEX idx_usage_data_user_machine_date ON usage_data(user_id, machine_id, date DESC);

-- Session indexes
CREATE INDEX idx_sessions_user_time ON usage_sessions(user_id, start_time DESC);
CREATE INDEX idx_sessions_user_machine_time ON usage_sessions(user_id, machine_id, start_time DESC);
CREATE INDEX idx_sessions_project ON usage_sessions(user_id, project_path) WHERE project_path IS NOT NULL;

-- Block indexes
CREATE INDEX idx_blocks_user_time ON usage_blocks(user_id, start_time DESC);
CREATE INDEX idx_blocks_user_active ON usage_blocks(user_id, is_active) WHERE is_active = 1;
CREATE INDEX idx_blocks_user_machine_time ON usage_blocks(user_id, machine_id, start_time DESC);

-- Upload history indexes
CREATE INDEX idx_upload_history_user_machine ON upload_history(user_id, machine_id, upload_type, uploaded_at DESC);

-- Update timestamp triggers
CREATE TRIGGER update_users_timestamp AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

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