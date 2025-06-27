-- Consolidated database schema with KSUID as primary identity
-- This migration drops and recreates all tables with KSUID-based primary keys
-- Safe to run since there are no production users

-- Drop all existing tables and triggers in reverse dependency order
DROP TRIGGER IF EXISTS update_teams_timestamp;
DROP TRIGGER IF EXISTS update_email_preferences_timestamp;
DROP TRIGGER IF EXISTS update_usage_blocks_timestamp;
DROP TRIGGER IF EXISTS update_usage_sessions_timestamp;
DROP TRIGGER IF EXISTS update_usage_data_timestamp;
DROP TRIGGER IF EXISTS update_users_timestamp;

DROP TABLE IF EXISTS team_invitations;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS email_send_log;
DROP TABLE IF EXISTS user_email_preferences;
DROP TABLE IF EXISTS upload_history;
DROP TABLE IF EXISTS usage_blocks;
DROP TABLE IF EXISTS usage_sessions;
DROP TABLE IF EXISTS usage_data;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS migrations;

-- Recreate migrations tracking table
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table with KSUID as primary key
CREATE TABLE users (
  id TEXT PRIMARY KEY,  -- KSUID string like "2z4ow5OVJUJaib0QEHj7PC2K7dB"
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
  claude_plan TEXT DEFAULT 'max_100',
  team_leaderboard_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily usage aggregates
CREATE TABLE usage_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  upload_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machine_id, upload_type, identifier)
);

-- User email preferences table
CREATE TABLE user_email_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_reports_enabled BOOLEAN DEFAULT 0,
  report_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
  preferred_time TEXT DEFAULT '09:00', -- HH:MM format
  timezone TEXT DEFAULT 'UTC',
  last_sent_daily DATE,
  last_sent_weekly DATE,
  last_sent_monthly DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Email send log table for tracking delivery and debugging
CREATE TABLE email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'test'
  email_address TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  resend_email_id TEXT, -- Store Resend's email ID for tracking
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Teams table
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  max_members INTEGER DEFAULT 50,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members table (many-to-many relationship between users and teams)
CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by TEXT REFERENCES users(id),
  UNIQUE(team_id, user_id)
);

-- Team invitations table for tracking pending invitations
CREATE TABLE team_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'declined'
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  UNIQUE(team_id, email)
);

-- Users table indexes
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash) WHERE is_deleted = 0;
CREATE INDEX idx_users_email ON users(email) WHERE is_deleted = 0;
CREATE INDEX idx_users_username ON users(username) WHERE is_deleted = 0;
CREATE INDEX idx_users_leaderboard ON users(leaderboard_enabled, leaderboard_updated_at) WHERE is_deleted = 0;
CREATE INDEX idx_users_claude_plan ON users(claude_plan) WHERE is_deleted = 0;

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

-- Email preferences indexes
CREATE INDEX idx_email_preferences_user ON user_email_preferences(user_id);
CREATE INDEX idx_email_preferences_enabled ON user_email_preferences(email_reports_enabled) WHERE email_reports_enabled = 1;
CREATE INDEX idx_email_preferences_frequency ON user_email_preferences(report_frequency, preferred_time) WHERE email_reports_enabled = 1;

-- Email send log indexes
CREATE INDEX idx_email_log_user_type ON email_send_log(user_id, email_type, sent_at DESC);
CREATE INDEX idx_email_log_status ON email_send_log(status, sent_at DESC);
CREATE INDEX idx_email_log_sent_at ON email_send_log(sent_at DESC);

-- Teams indexes
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_teams_invite_code ON teams(invite_code) WHERE is_active = 1;
CREATE INDEX idx_teams_active ON teams(is_active, created_at DESC) WHERE is_active = 1;

-- Team members indexes
CREATE INDEX idx_team_members_team ON team_members(team_id, joined_at DESC);
CREATE INDEX idx_team_members_user ON team_members(user_id, joined_at DESC);
CREATE INDEX idx_team_members_role ON team_members(team_id, role);

-- Team invitations indexes
CREATE INDEX idx_team_invitations_team ON team_invitations(team_id, status, created_at DESC);
CREATE INDEX idx_team_invitations_email ON team_invitations(email, status);
CREATE INDEX idx_team_invitations_token ON team_invitations(invite_token);
CREATE INDEX idx_team_invitations_expires ON team_invitations(expires_at) WHERE status = 'pending';

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

CREATE TRIGGER update_email_preferences_timestamp AFTER UPDATE ON user_email_preferences
BEGIN
  UPDATE user_email_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_teams_timestamp AFTER UPDATE ON teams
BEGIN
  UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;