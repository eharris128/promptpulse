import { AggregateData, Machine, SessionData, BlockData, ApiResponse, LeaderboardData, LeaderboardSettings, EmailPreferences, PlanSettings } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://exciting-patience-production.up.railway.app';

class ApiClient {
  private apiKey: string | null = null;

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (typeof window !== 'undefined') {
      localStorage.setItem('promptpulse_api_key', apiKey);
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('promptpulse_api_key');
      // Handle case where localStorage returns "undefined" as a string
      this.apiKey = (stored && stored !== 'undefined') ? stored : null;
    }
    
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('promptpulse_api_key');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const apiKey = this.getApiKey();
    
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...options.headers,
    });

    if (apiKey) {
      headers.set('X-API-Key', apiKey);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Generic GET method
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  // Authentication
  async createUser(userData: { email: string; username: string }) {
    return this.request<ApiResponse>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Usage data
  async getUsageAggregate(params?: {
    since?: string;
    until?: string;
    machineId?: string;
  }): Promise<AggregateData> {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set('since', params.since);
    if (params?.until) searchParams.set('until', params.until);
    if (params?.machineId) searchParams.set('machineId', params.machineId);

    const query = searchParams.toString();
    return this.request<AggregateData>(`/api/usage/aggregate${query ? `?${query}` : ''}`);
  }

  async getMachines(): Promise<Machine[]> {
    return this.request<Machine[]>('/api/machines');
  }

  async getSessions(params?: {
    machineId?: string;
    projectPath?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<SessionData[]> {
    const searchParams = new URLSearchParams();
    if (params?.machineId) searchParams.set('machineId', params.machineId);
    if (params?.projectPath) searchParams.set('projectPath', params.projectPath);
    if (params?.since) searchParams.set('since', params.since);
    if (params?.until) searchParams.set('until', params.until);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return this.request<SessionData[]>(`/api/usage/sessions${query ? `?${query}` : ''}`);
  }

  async getBlocks(params?: {
    machineId?: string;
    since?: string;
    until?: string;
    activeOnly?: boolean;
  }): Promise<BlockData[]> {
    const searchParams = new URLSearchParams();
    if (params?.machineId) searchParams.set('machineId', params.machineId);
    if (params?.since) searchParams.set('since', params.since);
    if (params?.until) searchParams.set('until', params.until);
    if (params?.activeOnly) searchParams.set('activeOnly', 'true');

    const query = searchParams.toString();
    return this.request<BlockData[]>(`/api/usage/blocks${query ? `?${query}` : ''}`);
  }

  async getUsagePatterns(params?: {
    machineId?: string;
    period?: 'hour' | 'day' | 'week';
  }) {
    const searchParams = new URLSearchParams();
    if (params?.machineId) searchParams.set('machineId', params.machineId);
    if (params?.period) searchParams.set('period', params.period);

    const query = searchParams.toString();
    return this.request(`/api/usage/analytics/patterns${query ? `?${query}` : ''}`);
  }

  async getCostAnalytics(params?: {
    machineId?: string;
    groupBy?: 'session' | 'project' | 'day';
  }) {
    const searchParams = new URLSearchParams();
    if (params?.machineId) searchParams.set('machineId', params.machineId);
    if (params?.groupBy) searchParams.set('groupBy', params.groupBy);

    const query = searchParams.toString();
    return this.request(`/api/usage/analytics/costs${query ? `?${query}` : ''}`);
  }


  // Leaderboard methods
  async getLeaderboard(period: 'daily' | 'weekly'): Promise<LeaderboardData> {
    return this.request<LeaderboardData>(`/api/leaderboard/${period}`);
  }

  async getLeaderboardSettings(): Promise<LeaderboardSettings> {
    return this.request<LeaderboardSettings>('/api/user/leaderboard-settings');
  }

  async updateLeaderboardSettings(settings: LeaderboardSettings): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/user/leaderboard-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Email preferences methods
  async getEmailPreferences(): Promise<EmailPreferences> {
    return this.request<EmailPreferences>('/api/user/email-preferences');
  }

  async updateEmailPreferences(preferences: Partial<EmailPreferences>): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/user/email-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async sendTestEmail(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/user/test-email', {
      method: 'POST',
    });
  }

  async updateUserEmail(email: string): Promise<ApiResponse & { email: string }> {
    return this.request<ApiResponse & { email: string }>('/api/user/email', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
  }

  async getPlanSettings(): Promise<PlanSettings> {
    return this.request<PlanSettings>('/api/user/plan-settings');
  }

  async updatePlanSettings(settings: PlanSettings): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/user/plan-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

export const apiClient = new ApiClient();