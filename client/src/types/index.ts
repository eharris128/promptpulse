export interface User {
  id: number;
  ksuid?: string;
  email?: string;
  username: string;
  created_at: string;
  leaderboard_enabled?: boolean;
  display_name?: string;
  leaderboard_updated_at?: string;
}

export interface Machine {
  machine_id: string;
  days_tracked: number;
  first_date: string;
  last_date: string;
  total_cost: number;
}

export interface UsageData {
  machine_id: string;
  date: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  total_cost: number;
  models_used: string[];
  model_breakdowns: Record<string, any>;
}

export interface SessionData {
  id: number;
  machine_id: string;
  session_id: string;
  project_path?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  total_cost: number;
  models_used: string[];
  model_breakdowns: Record<string, any>;
}

export interface BlockData {
  id: number;
  machine_id: string;
  block_id: string;
  start_time: string;
  end_time: string;
  actual_end_time?: string;
  is_active: boolean;
  entry_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  total_cost: number;
  models_used: string[];
}

export interface AggregateData {
  daily: UsageData[];
  totals: {
    total_machines: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_creation_tokens: number;
    total_cache_read_tokens: number;
    total_tokens: number;
    total_cost: number;
  };
}

export interface LeaderboardEntry {
  user_id: number;
  ksuid?: string;
  username: string;
  display_name?: string;
  total_tokens: number;
  total_cost: number;
  daily_average: number;
  rank: number;
  percentile: number;
}

export interface LeaderboardData {
  period: 'daily' | 'weekly';
  entries: LeaderboardEntry[];
  user_rank?: number;
  total_participants: number;
}

export interface LeaderboardSettings {
  leaderboard_enabled: boolean;
  display_name?: string;
}

export interface EmailPreferences {
  email?: string;
  email_reports_enabled: boolean;
  report_frequency: 'daily' | 'weekly' | 'monthly';
  preferred_time: string; // HH:MM format
  timezone: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}