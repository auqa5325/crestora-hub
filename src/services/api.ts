const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://3.110.143.60:8000/api";
console.log("API_BASE_URL", API_BASE_URL);
export { API_BASE_URL };
export interface Team {
  id: number;
  team_id: string;
  team_name: string;
  leader_name: string;
  leader_register_number: string;
  leader_contact: string;
  leader_email: string;
  current_round: number;
  status: 'ACTIVE' | 'ELIMINATED' | 'COMPLETED';
  overall_score?: number; // Weighted average of all frozen rounds
  created_at: string;
  updated_at?: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: number;
  team_id: string;
  member_name: string;
  register_number: string;
  member_position: string;
  created_at: string;
}

export interface Event {
  id: number;
  event_id: string;
  event_code: string;
  name: string;
  type: 'title' | 'rolling';
  start_date?: string;
  end_date?: string;
  venue?: string;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  created_at: string;
  updated_at?: string;
  rounds: Round[];
}

export interface Round {
  id: number;
  event_id: string;
  round_number: number;
  name: string;
  mode?: 'online' | 'offline';
  club?: string;
  date?: string;
  description?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  is_frozen: boolean;
  is_evaluated: boolean;
  max_score?: number;
  min_score?: number;
  avg_score?: number;
  criteria?: Array<{name: string, max_points: number}>;
  created_at: string;
  updated_at?: string;
}

export interface DashboardStats {
  teams: {
    total: number;
    active: number;
    eliminated: number;
    completed: number;
  };
  events: {
    total: number;
    title_events: number;
    rolling_events: number;
    active: number;
    completed: number;
  };
  rounds: {
    total: number;
    ongoing: number;
    completed: number;
    upcoming: number;
    breakdown: Record<string, number>;
  };
  prize_pool: number;
}

export interface TeamStats {
  total_teams: number;
  active_teams: number;
  eliminated_teams: number;
  completed_teams: number;
  teams_by_round: Record<string, number>;
}

export interface EventStats {
  total_events: number;
  title_events: number;
  rolling_events: number;
  upcoming_events: number;
  in_progress_events: number;
  completed_events: number;
  total_rounds: number;
  upcoming_rounds: number;
  in_progress_rounds: number;
  completed_rounds: number;
}

export interface TeamScore {
  id: number;
  team_id: string;
  round_id: number;
  event_id: string;
  score: number;
  criteria_scores?: Record<string, number>;
  raw_total_score: number;
  is_normalized: boolean;
  created_at: string;
  updated_at?: string;
}

export interface RoundWeight {
  id: number;
  round_id: number;
  weight_percentage: number;
  created_at: string;
  updated_at?: string;
}

export interface RoundStats {
  round_id: number;
  round_name: string;
  is_frozen: boolean;
  is_evaluated: boolean;
  max_score?: number;
  min_score?: number;
  avg_score?: number;
  participated_count: number;
  total_teams: number;
  shortlisted_count: number;
  top_3_teams: Array<{team_id: string, team_name: string, score: number}>;
}

export interface LeaderboardTeam {
  rank: number;
  team_id: string;
  team_name: string;
  leader_name: string;
  final_score: number;
  weighted_average: number;
  normalized_score: number;
  rounds_completed: number;
  current_round: number;
  status: string;
}

export interface LeaderboardData {
  teams: LeaderboardTeam[];
  message?: string;
}

export interface EvaluatedRound {
  round_id: number;
  round_name: string;
  event_id: string;
  weight_percentage: number;
  is_frozen?: boolean;
  is_evaluated?: boolean;
}


class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          // Ensure the detail is a string, not an object
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // Handle array of errors
            errorMessage = errorData.detail.map((err: any) => 
              typeof err === 'string' ? err : JSON.stringify(err)
            ).join(', ');
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
        console.error('Failed to parse error response:', e);
      }
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).response = response;
      throw error;
    }

    return response.json();
  }

  // Teams API
  async getTeams(params?: {
    skip?: number;
    limit?: number;
    status?: 'ACTIVE' | 'ELIMINATED' | 'COMPLETED';
  }): Promise<Team[]> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);

    const queryString = searchParams.toString();
    return this.request<Team[]>(`/teams${queryString ? `?${queryString}` : ''}`);
  }

  async getTeam(teamId: string): Promise<Team> {
    return this.request<Team>(`/teams/${teamId}`);
  }

  async getTeamStats(): Promise<TeamStats> {
    return this.request<TeamStats>('/teams/stats');
  }

  // Events API
  async getEvents(params?: {
    skip?: number;
    limit?: number;
    event_type?: 'title' | 'rolling';
    status?: 'upcoming' | 'in_progress' | 'completed';
  }): Promise<Event[]> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.event_type) searchParams.append('event_type', params.event_type);
    if (params?.status) searchParams.append('status', params.status);

    const queryString = searchParams.toString();
    return this.request<Event[]>(`/events${queryString ? `?${queryString}` : ''}`);
  }

  async getEvent(eventId: string): Promise<Event> {
    return this.request<Event>(`/events/${eventId}`);
  }

  async createEvent(eventData: {
    event_id: string;
    event_code: string;
    name: string;
    type: 'title' | 'rolling';
    status?: 'upcoming' | 'in_progress' | 'completed';
    start_date?: string;
    end_date?: string;
    venue?: string;
    description?: string;
  }): Promise<Event> {
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async getEventRounds(eventId: string): Promise<Round[]> {
    return this.request<Round[]>(`/events/${eventId}/rounds`);
  }

  async getEventStats(): Promise<EventStats> {
    return this.request<EventStats>('/events/stats');
  }

  // Dashboard API
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats');
  }

  async getRecentActivities(): Promise<any> {
    return this.request<any>('/dashboard/recent-activities');
  }

  async getProgressStats(): Promise<any> {
    return this.request<any>('/dashboard/progress');
  }

  // Authentication API
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Login failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error('Invalid response format from server');
    }
  }

  async register(userData: {
    username: string;
    email: string;
    full_name: string;
    password: string;
    role: string;
  }): Promise<any> {
    return this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(token: string): Promise<any> {
    return this.request<any>('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // Round Management API
  async createRound(roundData: {
    event_id: string;
    event_code: string;
    round_number: number;
    name: string;
    type: 'title' | 'rolling';
    mode?: 'online' | 'offline';
    club?: string;
    date?: string;
    description?: string;
    round_code?: string;
  }): Promise<Round> {
    return this.request<Round>('/rounds/rounds', {
      method: 'POST',
      body: JSON.stringify(roundData),
    });
  }

  async updateRound(eventId: string, roundNumber: number, roundData: {
    name?: string;
    mode?: 'online' | 'offline';
    club?: string;
    date?: string;
    description?: string;
    status?: 'upcoming' | 'in_progress' | 'completed';
    round_code?: string;
  }): Promise<Round> {
    return this.request<Round>(`/rounds/${eventId}/${roundNumber}`, {
      method: 'PUT',
      body: JSON.stringify(roundData),
    });
  }

  async deleteRound(eventId: string, roundNumber: number): Promise<{message: string}> {
    return this.request<{message: string}>(`/rounds/${eventId}/${roundNumber}`, {
      method: 'DELETE',
    });
  }

  async updateRoundCriteria(roundId: number, criteria: Array<{name: string, max_points: number}>): Promise<any> {
    return this.request<any>(`/rounds/rounds/${roundId}/criteria`, {
      method: 'PUT',
      body: JSON.stringify(criteria),
    });
  }

  async getRoundEvaluations(roundId: number): Promise<TeamScore[]> {
    return this.request<TeamScore[]>(`/rounds/rounds/${roundId}/evaluations`);
  }

  async evaluateTeam(roundId: number, teamId: string, criteriaScores: Record<string, number>): Promise<TeamScore> {
    return this.request<TeamScore>(`/rounds/rounds/${roundId}/evaluate/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(criteriaScores),
    });
  }

  async freezeRound(roundId: number): Promise<any> {
    return this.request<any>(`/rounds/rounds/${roundId}/freeze`, {
      method: 'POST',
    });
  }


  async getRoundStats(roundId: number): Promise<RoundStats> {
    return this.request<RoundStats>(`/rounds/rounds/${roundId}/stats`);
  }

  async exportRoundData(roundId: number): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/rounds/rounds/${roundId}/export`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  }

  async exportRoundDataViaEmail(roundId: number, toEmails: string[], eventName: string = "Crestora'25"): Promise<{
    message: string;
    recipients: string[];
    round_name: string;
    event_name: string;
  }> {
    return this.request(`/rounds/rounds/${roundId}/export-email`, {
      method: 'POST',
      body: JSON.stringify({
        to_emails: toEmails,
        event_name: eventName
      }),
    });
  }

  // Team Scores API
  async getTeamScores(teamId: string): Promise<TeamScore[]> {
    return this.request<TeamScore[]>(`/team-scores/${teamId}`);
  }

  async updateTeamScore(roundId: number, teamId: string, scoreUpdate: Partial<TeamScore>): Promise<TeamScore> {
    return this.request<TeamScore>(`/team-scores/${roundId}/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(scoreUpdate),
    });
  }

  // Leaderboard API
  async getLeaderboard(): Promise<LeaderboardData> {
    return this.request<LeaderboardData>('/leaderboard');
  }

  async getEvaluatedRounds(): Promise<{evaluated_rounds: EvaluatedRound[]}> {
    return this.request<{evaluated_rounds: EvaluatedRound[]}>('/leaderboard/evaluated-rounds');
  }


  async updateRoundWeight(roundId: number, weightPercentage: number): Promise<RoundWeight> {
    return this.request<RoundWeight>(`/leaderboard/weights/${roundId}`, {
      method: 'PUT',
      body: JSON.stringify({ weight_percentage: weightPercentage }),
    });
  }

  async exportLeaderboard(): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/leaderboard/export`);
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    return response.blob();
  }

  async exportLeaderboardViaEmail(toEmails: string[], eventName: string = "Crestora'25"): Promise<{
    message: string;
    recipients: string[];
    event_name: string;
  }> {
    return this.request('/leaderboard/export-email', {
      method: 'POST',
      body: JSON.stringify({
        to_emails: toEmails,
        event_name: eventName
      }),
    });
  }

  // Enhanced Teams API
  async updateTeamStatus(teamId: string, status: 'ACTIVE' | 'ELIMINATED' | 'COMPLETED'): Promise<any> {
    return this.request<any>(`/teams/${teamId}/status?status=${status}`, {
      method: 'PUT',
    });
  }

  async getTeamScoresForTeam(teamId: string): Promise<TeamScore[]> {
    return this.request<TeamScore[]>(`/teams/${teamId}/scores`);
  }

  // Shortlist API (old per-round method - kept for backwards compatibility)
  async shortlistTeams(roundId: number, shortlistType: 'top_k' | 'threshold', value: number): Promise<{
    shortlisted_count: number;
    eliminated_count: number;
    shortlisted_teams: string[];
    shortlist_type: string;
    shortlist_value: number;
  }> {
    return this.request(`/rounds/rounds/${roundId}/shortlist`, {
      method: 'POST',
      body: JSON.stringify({
        type: shortlistType,
        value: value
      }),
    });
  }

  // New leaderboard shortlist API (based on overall scores)
  async shortlistTeamsByOverallScore(shortlistType: 'top_k' | 'threshold', value: number): Promise<{
    shortlisted_count: number;
    eliminated_count: number;
    shortlisted_teams: string[];
    frozen_rounds_count: number;
    shortlist_type: string;
    shortlist_value: number;
  }> {
    return this.request(`/leaderboard/shortlist`, {
      method: 'POST',
      body: JSON.stringify({
        type: shortlistType,
        value: value
      }),
    });
  }
}

export const apiService = new ApiService();
