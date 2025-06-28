-- Migration: Add team_display_name field to users table
-- This allows users to have different display names for team vs public contexts

-- Add team_display_name field to users table
ALTER TABLE users ADD COLUMN team_display_name TEXT;

-- Add comment for documentation
PRAGMA table_info(users);