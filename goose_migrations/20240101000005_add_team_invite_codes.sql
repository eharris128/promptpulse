-- +goose Up
-- Add invite_code field back to teams table for simple team joining
-- This restores the original simple invitation system

ALTER TABLE teams ADD COLUMN invite_code TEXT;

-- Generate unique invite codes for existing teams
UPDATE teams SET invite_code = lower(hex(randomblob(8))) WHERE invite_code IS NULL;

-- Create index for invite code lookups (will be unique in practice)
CREATE INDEX idx_teams_invite_code ON teams(invite_code) WHERE is_active = 1;

-- +goose Down
-- Drop index first
DROP INDEX IF EXISTS idx_teams_invite_code;

-- Remove invite_code column
ALTER TABLE teams DROP COLUMN invite_code;