"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  track_id: string;
  track_config: string | null;
  car_id: string;
  best_lap_time: number;
  lap_count: number;
  best_lap_timestamp: string;
  best_lap_device_id: string;
  device_name: string | null;
  driver_id: string | null;
  driver_email: string | null;
  driver_name: string | null;
};

export default function LeaderboardsPage() {
  const [leaderboards, setLeaderboards] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTrack, setFilterTrack] = useState<string>("");
  const [filterCar, setFilterCar] = useState<string>("");
  const [sortBy, setSortBy] = useState<"time" | "track" | "car">("time");

  useEffect(() => {
    fetchLeaderboards();
  }, [filterTrack, filterCar]);

  const fetchLeaderboards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = "/api/leaderboards";
      const params = new URLSearchParams();
      if (filterTrack.trim()) {
        params.append("trackId", filterTrack.trim());
      }
      if (filterCar.trim()) {
        params.append("carId", filterCar.trim());
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboards");
      }
      const data = await response.json();
      setLeaderboards(data.leaderboards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboards");
    } finally {
      setLoading(false);
    }
  };

  const formatLapTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(3);
    return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : `${seconds}s`;
  };

  // Get unique tracks and cars for filters
  const uniqueTracks = Array.from(new Set(leaderboards.map((l) => l.track_id))).sort();
  const uniqueCars = Array.from(new Set(leaderboards.map((l) => l.car_id))).sort();

  // Sort leaderboards based on selected sort option
  const sortedLeaderboards = [...leaderboards].sort((a, b) => {
    if (sortBy === "time") {
      return a.best_lap_time - b.best_lap_time;
    } else if (sortBy === "track") {
      const trackCompare = a.track_id.localeCompare(b.track_id);
      if (trackCompare !== 0) return trackCompare;
      const configCompare = (a.track_config || "").localeCompare(b.track_config || "");
      if (configCompare !== 0) return configCompare;
      return a.best_lap_time - b.best_lap_time;
    } else {
      const carCompare = a.car_id.localeCompare(b.car_id);
      if (carCompare !== 0) return carCompare;
      return a.best_lap_time - b.best_lap_time;
    }
  });

  if (loading && leaderboards.length === 0) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading leaderboards...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Global Leaderboards</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Best lap times by track, layout, and car combination
          </p>
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

      {/* Filters */}
      <div className="glass rounded-xl p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Filter by Track
            </label>
            <input
              type="text"
              placeholder="Track name..."
              value={filterTrack}
              onChange={(e) => setFilterTrack(e.target.value)}
              className="input w-full px-4 py-2 text-sm"
              list="tracks-list"
            />
            <datalist id="tracks-list">
              {uniqueTracks.map((track) => (
                <option key={track} value={track} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Filter by Car
            </label>
            <input
              type="text"
              placeholder="Car name..."
              value={filterCar}
              onChange={(e) => setFilterCar(e.target.value)}
              className="input w-full px-4 py-2 text-sm"
              list="cars-list"
            />
            <datalist id="cars-list">
              {uniqueCars.map((car) => (
                <option key={car} value={car} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "time" | "track" | "car")}
              className="input w-full px-4 py-2 text-sm"
            >
              <option value="time">Best Time</option>
              <option value="track">Track</option>
              <option value="car">Car</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterTrack("");
                setFilterCar("");
              }}
              className="btn-secondary w-full px-4 py-2 text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Rig
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Layout
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Car
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Best Lap Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Total Laps
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Record Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedLeaderboards.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-slate-400">No records found</p>
                  </td>
                </tr>
              ) : (
                sortedLeaderboards.map((entry, index) => (
                  <tr
                    key={`${entry.track_id}-${entry.track_config || "default"}-${entry.car_id}`}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-300">
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {entry.driver_name || entry.driver_email || <span className="text-slate-500 italic">Unknown</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {entry.device_name || <span className="text-slate-500 italic">Unknown Rig</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{entry.track_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {entry.track_config || <span className="text-slate-500 italic">Default</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">{entry.car_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-red-400 font-bold">
                        {formatLapTime(entry.best_lap_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">{entry.lap_count.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-400">
                        {new Date(entry.best_lap_timestamp).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sortedLeaderboards.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800/50">
            <div className="text-sm text-slate-400">
              Showing {sortedLeaderboards.length} record{sortedLeaderboards.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

