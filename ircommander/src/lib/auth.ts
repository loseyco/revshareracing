/**
 * Client-side authentication utilities
 */

export interface User {
  id: string;
  email: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  created_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

/**
 * Get stored user
 */
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Store authentication data
 */
export function setAuth(tokens: AuthTokens, user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  localStorage.setItem("user", JSON.stringify(user));
}

/**
 * Clear authentication data
 */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

/**
 * Make authenticated API request
 * Automatically redirects to login on 401/403 responses
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  // If no token, redirect to login immediately
  if (!token) {
    if (typeof window !== "undefined") {
      clearAuth();
      window.location.href = "/auth/login";
    }
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get 401 or 403, user is not authenticated - redirect to login
  if (response.status === 401 || response.status === 403) {
    if (typeof window !== "undefined") {
      clearAuth();
      window.location.href = "/auth/login";
    }
  }

  return response;
}
