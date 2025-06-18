-- Migration: Create usage_data table
-- Created: 2025-06-18

CREATE TABLE IF NOT EXISTS usage_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  date TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER,
  total_tokens INTEGER,
  total_cost REAL,
  models_used TEXT,
  model_breakdowns TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(machine_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_usage_data_machine_date ON usage_data(machine_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_data_date ON usage_data(date);
CREATE INDEX IF NOT EXISTS idx_usage_data_machine_id ON usage_data(machine_id);