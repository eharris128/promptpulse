-- Migration: Add environmental tracking columns
-- Date: 2025-06-25
-- Description: Add environmental impact tracking to support EcoLogits integration

-- Add environmental columns to usage_data table
ALTER TABLE usage_data ADD COLUMN energy_wh DECIMAL(10,6);
ALTER TABLE usage_data ADD COLUMN co2_emissions_g DECIMAL(10,6);
ALTER TABLE usage_data ADD COLUMN carbon_intensity_g_kwh DECIMAL(8,2);
ALTER TABLE usage_data ADD COLUMN tree_equivalent DECIMAL(8,3);
ALTER TABLE usage_data ADD COLUMN environmental_source TEXT; -- 'ecologits', 'fallback_estimate', etc.

-- Add environmental columns to daily_usage table
ALTER TABLE daily_usage ADD COLUMN total_energy_wh DECIMAL(10,6) DEFAULT 0;
ALTER TABLE daily_usage ADD COLUMN total_co2_emissions_g DECIMAL(10,6) DEFAULT 0;
ALTER TABLE daily_usage ADD COLUMN avg_carbon_intensity_g_kwh DECIMAL(8,2);
ALTER TABLE daily_usage ADD COLUMN total_tree_equivalent DECIMAL(8,3) DEFAULT 0;

-- Add environmental columns to session_usage table
ALTER TABLE session_usage ADD COLUMN total_energy_wh DECIMAL(10,6) DEFAULT 0;
ALTER TABLE session_usage ADD COLUMN total_co2_emissions_g DECIMAL(10,6) DEFAULT 0;
ALTER TABLE session_usage ADD COLUMN avg_carbon_intensity_g_kwh DECIMAL(8,2);
ALTER TABLE session_usage ADD COLUMN total_tree_equivalent DECIMAL(8,3) DEFAULT 0;

-- Create environmental cache table for performance
CREATE TABLE environmental_cache (
  cache_key TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  energy_wh DECIMAL(10,6) NOT NULL,
  co2_emissions_g DECIMAL(10,6) NOT NULL,
  carbon_intensity_g_kwh DECIMAL(8,2) NOT NULL,
  tree_equivalent DECIMAL(8,3) NOT NULL,
  equivalent_text TEXT NOT NULL,
  source TEXT NOT NULL, -- 'ecologits', 'fallback_estimate'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster cache lookups
CREATE INDEX idx_environmental_cache_lookup ON environmental_cache(model_name, input_tokens, output_tokens);
CREATE INDEX idx_environmental_cache_created ON environmental_cache(created_at);

-- Create environmental summary view for reporting
CREATE VIEW environmental_summary AS
SELECT 
  user_id,
  DATE(created_at) as date,
  COUNT(*) as session_count,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost,
  SUM(energy_wh) as total_energy_wh,
  SUM(co2_emissions_g) as total_co2_emissions_g,
  SUM(tree_equivalent) as total_tree_equivalent,
  AVG(carbon_intensity_g_kwh) as avg_carbon_intensity
FROM usage_data 
WHERE energy_wh IS NOT NULL
GROUP BY user_id, DATE(created_at);

-- Add environmental settings to users table
ALTER TABLE users ADD COLUMN environmental_tracking_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN environmental_location TEXT DEFAULT 'us-west-1';

-- Create table for tracking environmental achievements/milestones
CREATE TABLE environmental_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_type TEXT NOT NULL, -- 'low_impact_session', 'efficiency_milestone', etc.
  achievement_data TEXT, -- JSON data for achievement details
  trees_equivalent DECIMAL(8,3),
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_environmental_achievements_user ON environmental_achievements(user_id);
CREATE INDEX idx_environmental_achievements_type ON environmental_achievements(achievement_type);
CREATE INDEX idx_environmental_achievements_date ON environmental_achievements(achieved_at);