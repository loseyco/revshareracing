"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated, clearAuth, authenticatedFetch, type User } from "@/lib/auth";

interface LapRecord {
  id: string;
  lap_time: number;
  track_name: string;
  car_name: string;
  driver_name: string | null;
  recorded_at: string;
  device_id: string;
}

interface TrackRecord {
  track_name: string;
  best_lap_time: number;
  car_name: string;
  driver_name: string | null;
  recorded_at: string;
  lap_count: number;
}

interface CarLayoutRecord {
  track_name: string;
  car_name: string;
  best_lap_time: number;
  driver_name: string | null;
  recorded_at: string;
  lap_count: number;
}

interface LapStats {
  latest_laps: LapRecord[];
  fastest_laps: LapRecord[];
  track_records: TrackRecord[];
  car_layout_records: CarLayoutRecord[];
}

function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return minutes > 0 ? `${minutes}:${secs.padStart(6, '0')}` : `${secs}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LapStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const response = await authenticatedFetch("/api/v1/stats/laps");
      
      if (!response.ok) {
        throw new Error("Failed to load statistics");
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        throw new Error(result.error?.message || "Failed to load statistics");
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      setStatsError(error instanceof Error ? error.message : "Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check authentication immediately - redirect if not logged in
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    
    // User is authenticated, load user data and stats
    const currentUser = getUser();
    setUser(currentUser);
    setLoading(false);
    loadStats();
  }, [router, loadStats]);

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  // Show loading state while checking authentication
  // This prevents any content from showing to unauthenticated users
  if (loading || !user) {
    // If not authenticated, show login prompt instead of loading
    if (!isAuthenticated()) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <div className="text-center">
            <div className="text-white text-xl font-semibold mb-4">Authentication Required</div>
            <div className="text-neutral-400 mb-6">Please log in to access your dashboard.</div>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Dashboard</h1>
            <p className="text-neutral-400">
              Welcome back, {user?.email}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
            >
              Admin
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          <a
            href="/devices"
            className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-900 transition cursor-pointer"
          >
            <h3 className="font-medium text-white mb-2">Devices</h3>
            <p className="text-sm text-neutral-500">Manage your racing rigs</p>
          </a>
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <h3 className="font-medium text-white mb-2">Queue</h3>
            <p className="text-sm text-neutral-500">View queue status</p>
          </div>
          <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <h3 className="font-medium text-white mb-2">Telemetry</h3>
            <p className="text-sm text-neutral-500">Lap times and stats</p>
          </div>
        </div>

        {/* Lap Statistics */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Lap Statistics</h2>
            <button
              onClick={loadStats}
              disabled={statsLoading}
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition disabled:opacity-50"
            >
              {statsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {statsError && (
            <div className="p-4 rounded-lg border border-red-800 bg-red-900/20 text-red-400">
              {statsError}
            </div>
          )}

          {statsLoading && !stats && (
            <div className="text-center py-12 text-neutral-400">Loading statistics...</div>
          )}

          {stats && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Latest Laps */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Latest Laps</h3>
                {stats.latest_laps.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No laps recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.latest_laps.map((lap, idx) => (
                      <div key={lap.id || `latest-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{lap.track_name}</div>
                          <div className="text-neutral-400 text-sm truncate">{lap.car_name}</div>
                          {lap.driver_name && (
                            <div className="text-neutral-500 text-xs">{lap.driver_name}</div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-white font-semibold">{formatLapTime(lap.lap_time)}</div>
                          <div className="text-neutral-500 text-xs">{formatDate(lap.recorded_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fastest Laps */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fastest Laps</h3>
                {stats.fastest_laps.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No laps recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.fastest_laps.map((lap, index) => (
                      <div key={lap.id || `fastest-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-neutral-500 text-sm font-medium w-6">#{index + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium truncate">{lap.track_name}</div>
                            <div className="text-neutral-400 text-sm truncate">{lap.car_name}</div>
                            {lap.driver_name && (
                              <div className="text-neutral-500 text-xs">{lap.driver_name}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-green-400 font-semibold">{formatLapTime(lap.lap_time)}</div>
                          <div className="text-neutral-500 text-xs">{formatDate(lap.recorded_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Track Records */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Track Records</h3>
                {stats.track_records.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No track records yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.track_records.map((record, idx) => (
                      <div key={`track-${record.track_name}-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{record.track_name}</div>
                          <div className="text-neutral-400 text-sm truncate">{record.car_name}</div>
                          <div className="text-neutral-500 text-xs">
                            {record.lap_count} lap{record.lap_count !== 1 ? 's' : ''}
                            {record.driver_name && ` • ${record.driver_name}`}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-yellow-400 font-semibold">{formatLapTime(record.best_lap_time)}</div>
                          <div className="text-neutral-500 text-xs">{formatDate(record.recorded_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Car Layout Records */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Car Layout Records</h3>
                {stats.car_layout_records.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No car layout records yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.car_layout_records.slice(0, 10).map((record, idx) => (
                      <div key={`layout-${record.track_name}-${record.car_name}-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{record.track_name}</div>
                          <div className="text-neutral-400 text-sm truncate">{record.car_name}</div>
                          <div className="text-neutral-500 text-xs">
                            {record.lap_count} lap{record.lap_count !== 1 ? 's' : ''}
                            {record.driver_name && ` • ${record.driver_name}`}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-blue-400 font-semibold">{formatLapTime(record.best_lap_time)}</div>
                          <div className="text-neutral-500 text-xs">{formatDate(record.recorded_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
