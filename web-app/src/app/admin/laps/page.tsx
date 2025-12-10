"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRealtimeSubscription } from "@/lib/use-realtime";

type Lap = {
  lap_id: string;
  device_id: string;
  lap_number: number;
  lap_time?: number;
  track_id?: string;
  car_id?: string;
  timestamp: string;
  telemetry?: Record<string, any>;
};

export default function AdminLapsPage() {
  const { supabase } = useSupabase();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterDeviceId, setFilterDeviceId] = useState<string>("");
  const limit = 50;

  useEffect(() => {
    fetchLaps();
  }, [page, filterDeviceId]);

  // Subscribe to realtime changes for laps
  useRealtimeSubscription(
    supabase,
    "irc_laps",
    (payload) => {
      console.log("[Realtime] Lap changed:", payload);
      
      if (payload.eventType === "INSERT" && payload.new) {
        // Check if matches device filter
        const matchesFilter = !filterDeviceId || payload.new.device_id === filterDeviceId;
        if (matchesFilter) {
          // Add new lap to the beginning of the list
          setLaps(prevLaps => {
            // Check if already in list
            if (prevLaps.find(l => l.lap_id === payload.new.lap_id)) {
              return prevLaps;
            }
            return [payload.new, ...prevLaps];
          });
          setTotal(prev => prev + 1);
        }
      } else if (payload.eventType === "UPDATE" && payload.new) {
        // Update existing lap
        setLaps(prevLaps => 
          prevLaps.map(lap => 
            lap.lap_id === payload.new.lap_id 
              ? { ...lap, ...payload.new }
              : lap
          )
        );
      } else if (payload.eventType === "DELETE" && payload.old) {
        // Remove lap from list
        setLaps(prevLaps => 
          prevLaps.filter(lap => lap.lap_id !== payload.old.lap_id)
        );
        setTotal(prev => Math.max(0, prev - 1));
      }
    },
    filterDeviceId ? { device_id: filterDeviceId } : undefined
  );

  const fetchLaps = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;
      let url = `/api/admin/laps?limit=${limit}&offset=${offset}`;
      if (filterDeviceId.trim()) {
        url += `&deviceId=${encodeURIComponent(filterDeviceId.trim())}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch laps");
      }
      const data = await response.json();
      setLaps(data.laps || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load laps");
    } finally {
      setLoading(false);
    }
  };

  const formatLapTime = (time?: number): string => {
    if (!time) return "N/A";
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(3);
    return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : `${seconds}s`;
  };

  if (loading && laps.length === 0) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading laps...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Laps</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Total: {total.toLocaleString()} laps
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter by Device ID..."
            value={filterDeviceId}
            onChange={(e) => setFilterDeviceId(e.target.value)}
            className="input px-4 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                fetchLaps();
              }
            }}
          />
          <button
            onClick={() => {
              setPage(1);
              fetchLaps();
            }}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Filter
          </button>
          {filterDeviceId && (
            <button
              onClick={() => {
                setFilterDeviceId("");
                setPage(1);
              }}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Clear
            </button>
          )}
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Lap ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Device</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Lap #</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Track</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Car</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {laps.map((lap) => (
                <tr key={lap.lap_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-slate-400">{lap.lap_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-slate-300">{lap.device_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{lap.lap_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-red-400 font-bold">
                      {formatLapTime(lap.lap_time)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{lap.track_id || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{lap.car_id || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {new Date(lap.timestamp).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {laps.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-slate-400">No laps found</p>
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

