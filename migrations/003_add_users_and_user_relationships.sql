-- Migration: Add users table and user relationships
-- Created: 2025-06-22

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Add user_id to usage_data table only (sessions and blocks tables don't exist yet)
ALTER TABLE usage_data ADD COLUMN user_id INTEGER REFERENCES users(id);

-- Create index for user relationship
CREATE INDEX IF NOT EXISTS idx_usage_data_user_id ON usage_data(user_id);