-- Email preferences and reporting functionality
-- Adds tables for user email preferences and email send logging

-- User email preferences table
CREATE TABLE user_email_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'test'
  email_address TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  resend_email_id TEXT, -- Store Resend's email ID for tracking
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for email preferences
CREATE INDEX idx_email_preferences_user ON user_email_preferences(user_id);
CREATE INDEX idx_email_preferences_enabled ON user_email_preferences(email_reports_enabled) WHERE email_reports_enabled = 1;
CREATE INDEX idx_email_preferences_frequency ON user_email_preferences(report_frequency, preferred_time) WHERE email_reports_enabled = 1;

-- Indexes for email send log
CREATE INDEX idx_email_log_user_type ON email_send_log(user_id, email_type, sent_at DESC);
CREATE INDEX idx_email_log_status ON email_send_log(status, sent_at DESC);
CREATE INDEX idx_email_log_sent_at ON email_send_log(sent_at DESC);

-- Update timestamp trigger for email preferences
CREATE TRIGGER update_email_preferences_timestamp AFTER UPDATE ON user_email_preferences
BEGIN
  UPDATE user_email_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;