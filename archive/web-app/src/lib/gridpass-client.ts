/**
 * GridPass API Client
 * 
 * This client handles all communication with the GridPass platform API.
 * RevShareRacing uses this instead of direct Supabase access for most operations.
 */

// GridPass API base URL - configurable via environment
const GRIDPASS_API_URL = process.env.NEXT_PUBLIC_GRIDPASS_API_URL || "https://gridpass.app";

// Tenant API key for B2B operations
const GRIDPASS_TENANT_KEY = process.env.GRIDPASS_TENANT_KEY || "";

export interface GridPassResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface GridPassUser {
  id: string;
  email: string;
  display_name?: string;
  credits: number;
  role: string;
  iracing_connected: boolean;
  created_at: string;
}

export interface GridPassSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

export interface GridPassDevice {
  device_id: string;
  device_name: string;
  status: string;
  location?: string;
  claimed: boolean;
  is_online: boolean;
  iracing_connected: boolean;
  owner_user_id?: string;
  company_id?: string;
  last_seen?: string;
  time_since_last_seen?: number;
  telemetry?: {
    speed_kph: number | null;
    rpm: number | null;
    track_name: string | null;
    car_name: string | null;
    current_lap: number | null;
    in_car: boolean | null;
    engine_running: boolean | null;
  };
}

export interface GridPassQueueEntry {
  id: string;
  user_id: string;
  position: number;
  status: "waiting" | "active" | "completed" | "cancelled";
  joined_at: string;
  started_at?: string;
  completed_at?: string;
  user?: {
    id: string;
    email: string;
    display_name?: string;
  };
}

class GridPassClient {
  private baseUrl: string;
  private tenantKey: string;
  private accessToken: string | null = null;

  constructor(baseUrl?: string, tenantKey?: string) {
    this.baseUrl = baseUrl || GRIDPASS_API_URL;
    this.tenantKey = tenantKey || GRIDPASS_TENANT_KEY;
  }

  /**
   * Set the user's access token for authenticated requests.
   */
  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  /**
   * Get the current access token.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Make an API request to GridPass.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GridPassResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add tenant key if available
    if (this.tenantKey) {
      headers["X-Tenant-Key"] = this.tenantKey;
    }

    // Add auth token if available
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const url = `${this.baseUrl}/api/v1${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      return data as GridPassResponse<T>;
    } catch (error) {
      console.error(`[GridPassClient] Request failed: ${endpoint}`, error);
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network request failed",
        },
      };
    }
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async login(email: string, password: string): Promise<GridPassResponse<{ user: GridPassUser; session: GridPassSession }>> {
    const result = await this.request<{ user: GridPassUser; session: GridPassSession }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data?.session) {
      this.setAccessToken(result.data.session.access_token);
    }

    return result;
  }

  async register(email: string, password: string, displayName?: string): Promise<GridPassResponse<{ user: GridPassUser; session: GridPassSession | null; message: string }>> {
    const result = await this.request<{ user: GridPassUser; session: GridPassSession | null; message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    });

    if (result.success && result.data?.session) {
      this.setAccessToken(result.data.session.access_token);
    }

    return result;
  }

  async refreshToken(refreshToken: string): Promise<GridPassResponse<{ user: GridPassUser; session: GridPassSession }>> {
    const result = await this.request<{ user: GridPassUser; session: GridPassSession }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (result.success && result.data?.session) {
      this.setAccessToken(result.data.session.access_token);
    }

    return result;
  }

  async getCurrentUser(): Promise<GridPassResponse<{ user: GridPassUser }>> {
    return this.request<{ user: GridPassUser }>("/auth/me");
  }

  // ============================================
  // DEVICE ENDPOINTS
  // ============================================

  async getDevices(userId?: string): Promise<GridPassResponse<{ devices: GridPassDevice[]; total: number }>> {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    
    return this.request<{ devices: GridPassDevice[]; total: number }>(`/devices?${params}`);
  }

  async getDevice(deviceId: string): Promise<GridPassResponse<{ device: GridPassDevice }>> {
    return this.request<{ device: GridPassDevice }>(`/devices/${deviceId}`);
  }

  async getDeviceStatus(deviceId: string): Promise<GridPassResponse<{
    is_service_online: boolean;
    iracing_connected: boolean;
    can_execute_commands: boolean;
    reason: string | null;
    car_state: { in_car: boolean | null; engine_running: boolean | null };
    telemetry: GridPassDevice["telemetry"];
    last_seen: string;
    time_since_last_seen: number;
  }>> {
    return this.request(`/devices/${deviceId}/status`);
  }

  // ============================================
  // QUEUE ENDPOINTS
  // ============================================

  async getQueue(deviceId: string): Promise<GridPassResponse<{
    device: { device_id: string; device_name: string; claimed: boolean; is_online: boolean } | null;
    queue: GridPassQueueEntry[];
    total_waiting: number;
    active: GridPassQueueEntry | null;
  }>> {
    return this.request(`/devices/${deviceId}/queue`);
  }

  async joinQueue(deviceId: string): Promise<GridPassResponse<{
    queue_entry: GridPassQueueEntry;
    message: string;
    credits_deducted: number;
    credits_remaining: number;
  }>> {
    return this.request(`/devices/${deviceId}/queue`, { method: "POST" });
  }

  async leaveQueue(deviceId: string): Promise<GridPassResponse<{
    message: string;
    credits_refunded: number;
  }>> {
    return this.request(`/devices/${deviceId}/queue`, { method: "DELETE" });
  }

  async activateSession(deviceId: string): Promise<GridPassResponse<{
    message: string;
    queue_entry_id: string;
    started_at: string;
    duration_seconds: number;
  }>> {
    return this.request(`/devices/${deviceId}/queue/activate`, { method: "POST" });
  }

  async completeSession(deviceId: string, userId?: string, reason?: string): Promise<GridPassResponse<{
    message: string;
    completed: boolean;
    queue_entry_id?: string;
    user_id?: string;
    completed_at?: string;
    reason?: string;
  }>> {
    return this.request(`/devices/${deviceId}/queue/complete`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, reason }),
    });
  }

  // ============================================
  // LAPS ENDPOINTS
  // ============================================

  async getLapStats(deviceId: string, limit = 10): Promise<GridPassResponse<{
    total_laps: number;
    best_lap: { lap_time: number; lap_number: number; track_id: string; car_id: string; timestamp: string } | null;
    recent_laps: Array<{ lap_id: string; lap_number: number; lap_time: number; track_id: string; car_id: string; timestamp: string }>;
    laps_by_track: Record<string, number>;
  }>> {
    return this.request(`/devices/${deviceId}/laps?limit=${limit}`);
  }

  async recordLap(deviceId: string, lap: {
    lap_number: number;
    lap_time?: number;
    track_id?: string;
    car_id?: string;
    driver_id?: string;
    telemetry?: Record<string, unknown>;
  }): Promise<GridPassResponse<{ message: string; lap: unknown }>> {
    return this.request(`/devices/${deviceId}/laps`, {
      method: "POST",
      body: JSON.stringify(lap),
    });
  }

  // ============================================
  // LEADERBOARDS ENDPOINTS
  // ============================================

  async getLeaderboards(options?: {
    trackId?: string;
    carId?: string;
    limit?: number;
  }): Promise<GridPassResponse<{
    leaderboards: Array<{
      track_id: string;
      track_config: string | null;
      car_id: string;
      best_lap_time: number;
      lap_count: number;
      best_lap_timestamp: string;
      device_id: string;
      device_name: string | null;
      driver_id: string | null;
      driver_name: string | null;
    }>;
    total: number;
  }>> {
    const params = new URLSearchParams();
    if (options?.trackId) params.set("trackId", options.trackId);
    if (options?.carId) params.set("carId", options.carId);
    if (options?.limit) params.set("limit", options.limit.toString());
    
    return this.request(`/leaderboards?${params}`);
  }

  // ============================================
  // CREDITS ENDPOINTS
  // ============================================

  async getCreditBalance(): Promise<GridPassResponse<{
    credits: number;
    session_cost: number;
  }>> {
    return this.request("/credits/balance");
  }

  async purchaseCredits(amount: number, paymentMethod = "test"): Promise<GridPassResponse<{
    message: string;
    credits_purchased?: number;
    previous_balance?: number;
    new_balance?: number;
    payment_method?: string;
    payment_url?: string | null;
  }>> {
    return this.request("/credits/purchase", {
      method: "POST",
      body: JSON.stringify({ amount, payment_method: paymentMethod }),
    });
  }
}

// Export singleton instance
export const gridpass = new GridPassClient();

// Export class for creating custom instances
export { GridPassClient };

