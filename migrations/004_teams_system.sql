-- Teams system for team-based leaderboards and invitations
-- Enables users to create teams, invite others, and compare usage within teams

-- Teams table
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by INTEGER REFERENCES users(id),
  UNIQUE(team_id, user_id)
);

-- Team invitations table for tracking pending invitations
CREATE TABLE team_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'declined'
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  UNIQUE(team_id, email)
);

-- Add team_leaderboard_enabled to users table for team privacy control
ALTER TABLE users ADD COLUMN team_leaderboard_enabled BOOLEAN DEFAULT 1;

-- Indexes for teams
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_teams_invite_code ON teams(invite_code) WHERE is_active = 1;
CREATE INDEX idx_teams_active ON teams(is_active, created_at DESC) WHERE is_active = 1;

-- Indexes for team members
CREATE INDEX idx_team_members_team ON team_members(team_id, joined_at DESC);
CREATE INDEX idx_team_members_user ON team_members(user_id, joined_at DESC);
CREATE INDEX idx_team_members_role ON team_members(team_id, role);

-- Indexes for team invitations
CREATE INDEX idx_team_invitations_team ON team_invitations(team_id, status, created_at DESC);
CREATE INDEX idx_team_invitations_email ON team_invitations(email, status);
CREATE INDEX idx_team_invitations_token ON team_invitations(invite_token);
CREATE INDEX idx_team_invitations_expires ON team_invitations(expires_at) WHERE status = 'pending';

-- Update timestamp triggers
CREATE TRIGGER update_teams_timestamp AFTER UPDATE ON teams
BEGIN
  UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;