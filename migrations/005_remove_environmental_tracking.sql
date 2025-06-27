-- Migration: Remove environmental tracking features
-- This migration removes all environmental-related columns and tables
-- Note: Requires SQLite 3.35.0+ for DROP COLUMN support
-- For older SQLite versions, use table recreation method

-- Drop views first (dependencies)
DROP VIEW IF EXISTS environmental_summary;

-- Drop environmental-specific tables
DROP TABLE IF EXISTS environmental_cache;
DROP TABLE IF EXISTS environmental_achievements;

-- Remove columns from usage_data table (one column at a time)
ALTER TABLE usage_data DROP COLUMN energy_wh;
ALTER TABLE usage_data DROP COLUMN co2_emissions_g;
ALTER TABLE usage_data DROP COLUMN carbon_intensity_g_kwh;
ALTER TABLE usage_data DROP COLUMN tree_equivalent;
ALTER TABLE usage_data DROP COLUMN environmental_source;

-- Remove columns from daily_usage table
ALTER TABLE daily_usage DROP COLUMN total_energy_wh;
ALTER TABLE daily_usage DROP COLUMN total_co2_emissions_g;
ALTER TABLE daily_usage DROP COLUMN avg_carbon_intensity_g_kwh;
ALTER TABLE daily_usage DROP COLUMN total_tree_equivalent;

-- Remove columns from session_usage table
ALTER TABLE session_usage DROP COLUMN total_energy_wh;
ALTER TABLE session_usage DROP COLUMN total_co2_emissions_g;
ALTER TABLE session_usage DROP COLUMN avg_carbon_intensity_g_kwh;
ALTER TABLE session_usage DROP COLUMN total_tree_equivalent;

-- Remove columns from usage_sessions table
ALTER TABLE usage_sessions DROP COLUMN energy_wh;
ALTER TABLE usage_sessions DROP COLUMN co2_emissions_g;
ALTER TABLE usage_sessions DROP COLUMN carbon_intensity_g_kwh;
ALTER TABLE usage_sessions DROP COLUMN tree_equivalent;
ALTER TABLE usage_sessions DROP COLUMN environmental_source;

-- Remove columns from usage_blocks table
ALTER TABLE usage_blocks DROP COLUMN energy_wh;
ALTER TABLE usage_blocks DROP COLUMN co2_emissions_g;
ALTER TABLE usage_blocks DROP COLUMN carbon_intensity_g_kwh;
ALTER TABLE usage_blocks DROP COLUMN tree_equivalent;
ALTER TABLE usage_blocks DROP COLUMN environmental_source;

-- Remove columns from users table
ALTER TABLE users DROP COLUMN environmental_tracking_enabled;
ALTER TABLE users DROP COLUMN environmental_location;