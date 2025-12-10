"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  users: { total: number };
  devices: { total: number; claimed: number; unclaimed: number };
  commands: { total: number; pending: number; completed: number };
  laps: { total: number; last24Hours: number };
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-xl border-rose-500/50 bg-rose-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-rose-400">⚠</span>
            <p className="text-sm font-medium text-rose-200">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <section className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm md:text-base">Overview of system statistics and activity</p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Users Card */}
        <Link href="/admin/users" className="card group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-white">{stats.users.total.toLocaleString()}</p>
        </Link>

        {/* Devices Card */}
        <Link href="/admin/devices" className="card group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30">
              <span className="text-2xl">🖥️</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Devices</h3>
          <p className="text-3xl font-bold text-white">{stats.devices.total.toLocaleString()}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="text-emerald-400">{stats.devices.claimed} claimed</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400">{stats.devices.unclaimed} unclaimed</span>
          </div>
        </Link>

        {/* Commands Card */}
        <Link href="/admin/commands" className="card group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/20 border border-yellow-500/30">
              <span className="text-2xl">⚡</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Commands</h3>
          <p className="text-3xl font-bold text-white">{stats.commands.total.toLocaleString()}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="text-amber-400">{stats.commands.pending} pending</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">{stats.commands.completed} completed</span>
          </div>
        </Link>

        {/* Laps Card */}
        <Link href="/admin/laps" className="card group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 border border-red-500/30">
              <span className="text-2xl">🏁</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Laps</h3>
          <p className="text-3xl font-bold text-white">{stats.laps.total.toLocaleString()}</p>
          <div className="mt-3 text-xs text-slate-400">
            {stats.laps.last24Hours} in last 24h
          </div>
        </Link>
      </div>
    </section>
  );
}

