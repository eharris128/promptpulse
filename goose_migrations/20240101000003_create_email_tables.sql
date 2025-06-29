-- +goose Up
-- Create email-related tables with preferences and logging
-- Handles user email preferences and email send history tracking

-- User email preferences
CREATE TABLE user_email_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email notification preferences
  daily_digest BOOLEAN DEFAULT 1,           -- Daily usage digest emails
  weekly_summary BOOLEAN DEFAULT 1,         -- Weekly summary emails
  leaderboard_updates BOOLEAN DEFAULT 1,    -- Leaderboard position changes
  team_invitations BOOLEAN DEFAULT 1,       -- Team invitation emails
  security_alerts BOOLEAN DEFAULT 1,        -- Security-related notifications
  
  -- Email delivery preferences
  email_frequency TEXT DEFAULT 'daily',     -- 'immediate', 'daily', 'weekly', 'none'
  timezone_for_emails TEXT DEFAULT 'UTC',   -- Timezone for scheduled emails
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- Email send log for tracking and preventing duplicates
CREATE TABLE email_send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email details
  email_type TEXT NOT NULL,                 -- 'daily_digest', 'weekly_summary', 'team_invitation', etc.
  recipient_email TEXT NOT NULL,            -- Email address where sent
  subject TEXT NOT NULL,                    -- Email subject line
  
  -- Send status
  status TEXT DEFAULT 'pending',            -- 'pending', 'sent', 'failed', 'bounced'
  sent_at DATETIME,                         -- When email was actually sent
  
  -- Email service details
  external_id TEXT,                         -- ID from email service (Resend, etc.)
  error_message TEXT,                       -- Error details if failed
  
  -- Email content identifiers
  template_version TEXT,                    -- Version of email template used
  data_period_start DATE,                   -- For digest emails, data period start
  data_period_end DATE,                     -- For digest emails, data period end
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Email preferences indexes for user lookups
CREATE INDEX idx_email_prefs_user ON user_email_preferences(user_id);

-- Email log indexes for analytics and deduplication
CREATE INDEX idx_email_log_user_type ON email_send_log(user_id, email_type, created_at DESC);
CREATE INDEX idx_email_log_status ON email_send_log(status, created_at DESC);
CREATE INDEX idx_email_log_external_id ON email_send_log(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_email_log_data_period ON email_send_log(user_id, email_type, data_period_start, data_period_end);

-- Update timestamp triggers for email tables
CREATE TRIGGER update_email_prefs_timestamp AFTER UPDATE ON user_email_preferences
BEGIN
  UPDATE user_email_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_email_log_timestamp AFTER UPDATE ON email_send_log
BEGIN
  UPDATE email_send_log SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- +goose Down
-- Drop triggers first
DROP TRIGGER IF EXISTS update_email_log_timestamp;
DROP TRIGGER IF EXISTS update_email_prefs_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_email_log_data_period;
DROP INDEX IF EXISTS idx_email_log_external_id;
DROP INDEX IF EXISTS idx_email_log_status;
DROP INDEX IF EXISTS idx_email_log_user_type;
DROP INDEX IF EXISTS idx_email_prefs_user;

-- Drop tables
DROP TABLE IF EXISTS email_send_log;
DROP TABLE IF EXISTS user_email_preferences;