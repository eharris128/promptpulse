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

export interface ProjectData {
  project_path: string;
  project_name: string;
  session_count: number;
  total_cost: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  avg_duration: number | null;
  last_activity: string;
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
    total_thinking_tokens: number;
    thinking_sessions_count: number;
    average_thinking_percentage: number;
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
  is_current_user?: boolean;
}

export interface LeaderboardData {
  period: "daily" | "weekly";
  entries: LeaderboardEntry[];
  user_rank?: number;
  total_participants: number;
}

export interface LeaderboardSettings {
  leaderboard_enabled: boolean;
  display_name?: string;
  team_leaderboard_enabled: boolean;
  team_display_name?: string;
}

export interface EmailPreferences {
  email?: string;
  daily_digest: boolean;
  weekly_summary: boolean;
  leaderboard_updates: boolean;
  team_invitations: boolean;
  security_alerts: boolean;
  email_frequency: "immediate" | "daily" | "weekly" | "none";
  timezone_for_emails: string;
}

export type ClaudePlan = "pro_17" | "max_100" | "max_200";

export interface PlanSettings {
  claude_plan: ClaudePlan;
}

export interface PlanPricing {
  plan: ClaudePlan;
  name: string;
  price: number; // Monthly price in USD
  description: string;
}

export interface Team {
  id: string; // KSUID
  name: string;
  description?: string;
  owner_id: string; // KSUID of team owner
  invite_code: string; // Simple invite code for joining
  is_public: boolean;
  max_members: number;
  is_active: boolean;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeamWithRole extends Team {
  role: "owner" | "admin" | "member";
  status: "active" | "inactive" | "removed";
  joined_at: string;
}

export interface TeamMember {
  id: number;
  team_id: string; // KSUID
  user_id: string; // KSUID
  username: string;
  display_name?: string;
  email?: string;
  role: "owner" | "admin" | "member";
  status: "active" | "inactive" | "removed";
  joined_at: string;
  invited_by?: string; // KSUID
}

export interface TeamInvitation {
  id: string; // KSUID
  team_id: string; // KSUID
  team_name?: string;
  email: string;
  invited_by: string; // KSUID
  invited_by_username?: string;
  token: string;
  role: "owner" | "admin" | "member";
  message?: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  used_at?: string;
  used_by?: string; // KSUID
  created_at: string;
  updated_at: string;
}

export interface TeamSettings {
  team_leaderboard_enabled: boolean;
}

export interface TeamLeaderboardEntry {
  user_id: string; // KSUID
  username: string;
  display_name?: string;
  total_tokens: number;
  total_cost: number;
  daily_average: number;
  rank: number;
  percentile: number;
  is_current_user?: boolean;
}

export interface TeamLeaderboardData {
  team_id: string; // KSUID
  team_name: string;
  period: "daily" | "weekly";
  entries: TeamLeaderboardEntry[];
  user_rank?: number;
  total_participants: number;
}


export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}
