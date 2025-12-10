"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";

type Device = {
  device_id: string;
  device_name: string;
  status: string;
  location?: string;
  local_ip?: string;
  public_ip?: string;
  claimed: boolean;
  last_seen?: string;
  lap_count?: number;
  iracing_connected?: boolean;
};

// Helper function to check if service is online (last_seen within last 60 seconds)
function isServiceOnline(lastSeen?: string): boolean {
  if (!lastSeen) return false;
  const lastSeenTime = new Date(lastSeen).getTime();
  const now = Date.now();
  const timeSinceLastSeen = (now - lastSeenTime) / 1000; // seconds
  return timeSinceLastSeen < 60; // Service is online if seen within last 60 seconds
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSupabase();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) {
      return; // Still loading, wait
    }
    
    if (!session) {
      // Redirect to login if not authenticated
      router.push("/auth/login?redirectTo=/dashboard");
      return;
    }
    
    // Session exists, fetch devices
    fetchDevices();
  }, [session, sessionLoading, router]);

  const fetchDevices = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);
    try {
      // Include user ID in the request to help with authentication
      const response = await fetch(`/api/device/list?userId=${session.user.id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch devices");
      }
      const data = await response.json();
      const devicesWithLaps = await Promise.all(
        (data.devices || []).map(async (device: Device) => {
          try {
            const lapsResponse = await fetch(`/api/device/laps?deviceId=${device.device_id}`);
            if (lapsResponse.ok) {
              const lapsData = await lapsResponse.json();
              return { ...device, lap_count: lapsData.totalLaps || 0 };
            }
          } catch (err) {
            console.error(`Failed to fetch laps for ${device.device_id}:`, err);
          }
          return { ...device, lap_count: 0 };
        })
      );
      setDevices(devicesWithLaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading dashboard...</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <section className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">My Rigs</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Manage your claimed rigs and monitor their status in real-time
          </p>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          To claim a rig, use the "Claim This Rig" button from the PC service
        </p>
      </div>

      {error && (
        <div className="glass rounded-xl border-rose-500/50 bg-rose-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-rose-400">⚠</span>
            <p className="text-sm font-medium text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="glass rounded-2xl p-12 md:p-16 text-center">
          <div className="inline-flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-6">
            <svg className="w-8 h-8 md:w-10 md:h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">No rigs claimed yet</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm md:text-base">
            Get started by claiming your first rig from the PC service. Once claimed, you'll be able to monitor and manage it from here.
          </p>
          <p className="text-sm text-slate-400">
            To claim a rig, use the "Claim This Rig" button from the PC service application.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {devices.map((device, index) => (
            <div
              key={device.device_id}
              className="card group relative overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-colors" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                        {device.device_name || "Unnamed Rig"}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono truncate">{device.device_id}</p>
                    </div>
                  </div>
                  <span
                    className={`badge flex-shrink-0 ${
                      device.iracing_connected === true && isServiceOnline(device.last_seen)
                        ? "badge-success"
                        : "badge-warning"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current mr-1.5"></span>
                    <span className="hidden sm:inline">
                      {device.iracing_connected === true && isServiceOnline(device.last_seen) ? "active" : "inactive"}
                    </span>
                    <span className="sm:hidden">•</span>
                  </span>
                </div>

                <div className="space-y-3 mb-6 p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 w-20 flex-shrink-0 text-xs">Laps</span>
                    <span className="text-red-400 font-bold">{device.lap_count?.toLocaleString() || 0}</span>
                  </div>
                  {device.location && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0 text-xs">Location</span>
                      <span className="text-slate-200 font-medium truncate">{device.location}</span>
                    </div>
                  )}
                  {device.local_ip && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0 text-xs">Local IP</span>
                      <span className="text-slate-200 font-mono text-xs md:text-sm truncate">{device.local_ip}</span>
                    </div>
                  )}
                  {device.public_ip && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0 text-xs">Public IP</span>
                      <span className="text-slate-200 font-mono text-xs md:text-sm truncate">{device.public_ip}</span>
                    </div>
                  )}
                  {device.last_seen && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-20 flex-shrink-0 text-xs">Last seen</span>
                      <span className="text-slate-200 text-xs md:text-sm">{new Date(device.last_seen).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800/50">
                  <Link
                    href={`/device/${device.device_id}/details`}
                    className="btn-secondary flex-1 text-center text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>View Details</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

