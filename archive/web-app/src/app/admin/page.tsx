"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRealtimeSubscription } from "@/lib/use-realtime";

type Stats = {
  users: { total: number };
  devices: { total: number; claimed: number; unclaimed: number };
  commands: { total: number; pending: number; completed: number };
  laps: { total: number; last24Hours: number };
};

export default function AdminDashboardPage() {
  const { supabase } = useSupabase();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  // Subscribe to realtime changes for all tables to update stats
  useRealtimeSubscription(supabase, "irc_devices", (payload) => {
    if (payload.eventType === "INSERT") {
      setStats(prev => prev ? {
        ...prev,
        devices: {
          ...prev.devices,
          total: prev.devices.total + 1,
          ...(payload.new?.claimed ? { claimed: prev.devices.claimed + 1 } : { unclaimed: prev.devices.unclaimed + 1 })
        }
      } : null);
    } else if (payload.eventType === "DELETE") {
      setStats(prev => prev ? {
        ...prev,
        devices: {
          ...prev.devices,
          total: Math.max(0, prev.devices.total - 1),
          ...(payload.old?.claimed ? { claimed: Math.max(0, prev.devices.claimed - 1) } : { unclaimed: Math.max(0, prev.devices.unclaimed - 1) })
        }
      } : null);
    } else if (payload.eventType === "UPDATE" && payload.new && payload.old) {
      // Handle claimed status change
      if (payload.new.claimed !== payload.old.claimed) {
        setStats(prev => prev ? {
          ...prev,
          devices: {
            ...prev.devices,
            claimed: payload.new.claimed ? prev.devices.claimed + 1 : Math.max(0, prev.devices.claimed - 1),
            unclaimed: payload.new.claimed ? Math.max(0, prev.devices.unclaimed - 1) : prev.devices.unclaimed + 1
          }
        } : null);
      }
    }
  });

  useRealtimeSubscription(supabase, "irc_device_commands", (payload) => {
    if (payload.eventType === "INSERT") {
      setStats(prev => prev ? {
        ...prev,
        commands: {
          ...prev.commands,
          total: prev.commands.total + 1,
          ...(payload.new?.status === "pending" ? { pending: prev.commands.pending + 1 } : {}),
          ...(payload.new?.status === "completed" ? { completed: prev.commands.completed + 1 } : {})
        }
      } : null);
    } else if (payload.eventType === "UPDATE" && payload.new && payload.old) {
      // Handle status changes
      if (payload.new.status !== payload.old.status) {
        setStats(prev => prev ? {
          ...prev,
          commands: {
            ...prev.commands,
            pending: payload.old.status === "pending" ? Math.max(0, prev.commands.pending - 1) : 
                     payload.new.status === "pending" ? prev.commands.pending + 1 : prev.commands.pending,
            completed: payload.old.status === "completed" ? Math.max(0, prev.commands.completed - 1) :
                       payload.new.status === "completed" ? prev.commands.completed + 1 : prev.commands.completed
          }
        } : null);
      }
    } else if (payload.eventType === "DELETE") {
      setStats(prev => prev ? {
        ...prev,
        commands: {
          ...prev.commands,
          total: Math.max(0, prev.commands.total - 1),
          ...(payload.old?.status === "pending" ? { pending: Math.max(0, prev.commands.pending - 1) } : {}),
          ...(payload.old?.status === "completed" ? { completed: Math.max(0, prev.commands.completed - 1) } : {})
        }
      } : null);
    }
  });

  useRealtimeSubscription(supabase, "irc_laps", (payload) => {
    if (payload.eventType === "INSERT") {
      const isLast24Hours = payload.new?.timestamp && 
        (Date.now() - new Date(payload.new.timestamp).getTime()) < 24 * 60 * 60 * 1000;
      setStats(prev => prev ? {
        ...prev,
        laps: {
          ...prev.laps,
          total: prev.laps.total + 1,
          last24Hours: isLast24Hours ? prev.laps.last24Hours + 1 : prev.laps.last24Hours
        }
      } : null);
    } else if (payload.eventType === "DELETE") {
      setStats(prev => prev ? {
        ...prev,
        laps: {
          ...prev.laps,
          total: Math.max(0, prev.laps.total - 1)
        }
      } : null);
    }
  });

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
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Admin Dashboard</h1>
        <p className="text-slate-400 text-xs sm:text-sm md:text-base">Overview of system statistics and activity</p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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

