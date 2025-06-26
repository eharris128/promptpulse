-- Migration: Add environmental tracking columns to sessions and blocks tables
-- Date: 2025-06-26
-- Description: Add environmental impact tracking to usage_sessions and usage_blocks tables to match usage_data table

-- Add environmental columns to usage_sessions table
ALTER TABLE usage_sessions ADD COLUMN energy_wh DECIMAL(10,6);
ALTER TABLE usage_sessions ADD COLUMN co2_emissions_g DECIMAL(10,6);
ALTER TABLE usage_sessions ADD COLUMN carbon_intensity_g_kwh DECIMAL(8,2);
ALTER TABLE usage_sessions ADD COLUMN tree_equivalent DECIMAL(8,3);
ALTER TABLE usage_sessions ADD COLUMN environmental_source TEXT; -- 'ecologits', 'fallback_estimate', etc.

-- Add environmental columns to usage_blocks table
ALTER TABLE usage_blocks ADD COLUMN energy_wh DECIMAL(10,6);
ALTER TABLE usage_blocks ADD COLUMN co2_emissions_g DECIMAL(10,6);
ALTER TABLE usage_blocks ADD COLUMN carbon_intensity_g_kwh DECIMAL(8,2);
ALTER TABLE usage_blocks ADD COLUMN tree_equivalent DECIMAL(8,3);
ALTER TABLE usage_blocks ADD COLUMN environmental_source TEXT; -- 'ecologits', 'fallback_estimate', etc.