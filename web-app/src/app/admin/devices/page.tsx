"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRealtimeSubscription } from "@/lib/use-realtime";

type Device = {
  device_id: string;
  device_name?: string;
  status?: string;
  location?: string;
  local_ip?: string;
  public_ip?: string;
  claimed: boolean;
  owner_user_id?: string;
  last_seen?: string;
  updated_at?: string;
  iracing_connected?: boolean;
};

export default function AdminDevicesPage() {
  const { supabase } = useSupabase();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterClaimed, setFilterClaimed] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    fetchDevices();
  }, [page, filterClaimed]);

  // Subscribe to realtime changes for devices
  useRealtimeSubscription(
    supabase,
    "irc_devices",
    (payload) => {
      console.log("[Realtime] Device changed:", payload);
      
      if (payload.eventType === "INSERT" && payload.new) {
        // Add new device to the list
        setDevices(prevDevices => {
          // Check if already in list
          if (prevDevices.find(d => d.device_id === payload.new.device_id)) {
            return prevDevices;
          }
          // Add to beginning if matches filter
          const matchesFilter = filterClaimed === null || 
            (filterClaimed === "true" && payload.new.claimed) ||
            (filterClaimed === "false" && !payload.new.claimed);
          return matchesFilter ? [payload.new, ...prevDevices] : prevDevices;
        });
        setTotal(prev => prev + 1);
      } else if (payload.eventType === "UPDATE" && payload.new) {
        // Update existing device
        setDevices(prevDevices => 
          prevDevices.map(device => 
            device.device_id === payload.new.device_id 
              ? { ...device, ...payload.new }
              : device
          )
        );
      } else if (payload.eventType === "DELETE" && payload.old) {
        // Remove device from list
        setDevices(prevDevices => 
          prevDevices.filter(device => device.device_id !== payload.old.device_id)
        );
        setTotal(prev => Math.max(0, prev - 1));
      }
    }
  );

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;
      let url = `/api/admin/devices?limit=${limit}&offset=${offset}`;
      if (filterClaimed !== null) {
        url += `&claimed=${filterClaimed}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch devices");
      }
      const data = await response.json();
      setDevices(data.devices || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const isServiceOnline = (lastSeen?: string): boolean => {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeenTime) / 1000;
    return timeSinceLastSeen < 60;
  };

  if (loading && devices.length === 0) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading devices...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Devices</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Total: {total.toLocaleString()} devices
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterClaimed(null)}
            className={`btn-secondary px-4 py-2 text-sm ${filterClaimed === null ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterClaimed("true")}
            className={`btn-secondary px-4 py-2 text-sm ${filterClaimed === "true" ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            Claimed
          </button>
          <button
            onClick={() => setFilterClaimed("false")}
            className={`btn-secondary px-4 py-2 text-sm ${filterClaimed === "false" ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            Unclaimed
          </button>
        </div>
      </div>

      {error && (
        <div className="glass rounded-xl border-rose-500/50 bg-rose-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-rose-400">⚠</span>
            <p className="text-sm font-medium text-rose-200">{error}</p>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Device</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Last Seen</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {devices.map((device) => (
                <tr key={device.device_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">{device.device_name || "Unnamed"}</div>
                    <div className="text-xs font-mono text-slate-400">{device.device_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      device.claimed && device.iracing_connected === true && isServiceOnline(device.last_seen)
                        ? "badge-success"
                        : device.claimed
                        ? "badge-warning"
                        : "badge-info"
                    }`}>
                      {device.claimed 
                        ? (device.iracing_connected === true && isServiceOnline(device.last_seen) ? "Active" : "Inactive")
                        : "Unclaimed"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{device.location || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-slate-400">
                      {device.owner_user_id ? device.owner_user_id.substring(0, 8) + "..." : "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/device/${device.device_id}/details`}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {devices.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-slate-400">No devices found</p>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-slate-800/50 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

