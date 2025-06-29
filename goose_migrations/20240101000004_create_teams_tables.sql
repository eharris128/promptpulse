-- +goose Up
-- Create team-related tables for team management and invitations
-- Handles teams, team membership, and invitation system

-- Teams table
CREATE TABLE teams (
  id TEXT PRIMARY KEY,                      -- KSUID for team ID
  name TEXT NOT NULL,                       -- Team display name
  description TEXT,                         -- Optional team description
  
  -- Team settings
  is_public BOOLEAN DEFAULT 0,              -- Whether team is publicly visible
  max_members INTEGER DEFAULT 50,           -- Maximum team size
  
  -- Team ownership
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Team status
  is_active BOOLEAN DEFAULT 1,              -- Whether team is active
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members table (many-to-many between users and teams)
CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Member role and status
  role TEXT DEFAULT 'member',               -- 'owner', 'admin', 'member'
  status TEXT DEFAULT 'active',             -- 'active', 'inactive', 'removed'
  
  -- Join information
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by TEXT REFERENCES users(id),     -- Who invited this member
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(team_id, user_id)
);

-- Team invitations table
CREATE TABLE team_invitations (
  id TEXT PRIMARY KEY,                      -- KSUID for invitation ID
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Invitation details
  email TEXT NOT NULL,                      -- Email address being invited
  token TEXT UNIQUE NOT NULL,               -- Unique invitation token
  
  -- Invitation metadata
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',               -- Role being offered
  message TEXT,                             -- Optional invitation message
  
  -- Invitation status and timing
  status TEXT DEFAULT 'pending',            -- 'pending', 'accepted', 'declined', 'expired'
  expires_at DATETIME NOT NULL,             -- When invitation expires
  used_at DATETIME,                         -- When invitation was used
  used_by TEXT REFERENCES users(id),        -- Who used the invitation
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams table indexes
CREATE INDEX idx_teams_owner ON teams(owner_id, is_active);
CREATE INDEX idx_teams_public ON teams(is_public, is_active) WHERE is_public = 1;
CREATE INDEX idx_teams_name ON teams(name) WHERE is_active = 1;

-- Team members indexes for membership queries
CREATE INDEX idx_team_members_team ON team_members(team_id, status);
CREATE INDEX idx_team_members_user ON team_members(user_id, status);
CREATE INDEX idx_team_members_role ON team_members(team_id, role, status);

-- Team invitations indexes for invitation management
CREATE INDEX idx_invitations_team ON team_invitations(team_id, status);
CREATE INDEX idx_invitations_email ON team_invitations(email, status);
CREATE INDEX idx_invitations_token ON team_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_invitations_expires ON team_invitations(expires_at, status) WHERE status = 'pending';
CREATE INDEX idx_invitations_invited_by ON team_invitations(invited_by, created_at DESC);

-- Update timestamp triggers for team tables
CREATE TRIGGER update_teams_timestamp AFTER UPDATE ON teams
BEGIN
  UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_team_members_timestamp AFTER UPDATE ON team_members
BEGIN
  UPDATE team_members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_team_invitations_timestamp AFTER UPDATE ON team_invitations
BEGIN
  UPDATE team_invitations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- +goose Down
-- Drop triggers first
DROP TRIGGER IF EXISTS update_team_invitations_timestamp;
DROP TRIGGER IF EXISTS update_team_members_timestamp;
DROP TRIGGER IF EXISTS update_teams_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_invitations_invited_by;
DROP INDEX IF EXISTS idx_invitations_expires;
DROP INDEX IF EXISTS idx_invitations_token;
DROP INDEX IF EXISTS idx_invitations_email;
DROP INDEX IF EXISTS idx_invitations_team;
DROP INDEX IF EXISTS idx_team_members_role;
DROP INDEX IF EXISTS idx_team_members_user;
DROP INDEX IF EXISTS idx_team_members_team;
DROP INDEX IF EXISTS idx_teams_name;
DROP INDEX IF EXISTS idx_teams_public;
DROP INDEX IF EXISTS idx_teams_owner;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS team_invitations;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;