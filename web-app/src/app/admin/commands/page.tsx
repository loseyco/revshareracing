"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRealtimeSubscription } from "@/lib/use-realtime";

type Command = {
  id: string;
  device_id: string;
  command_type: string;
  command_action: string;
  command_params?: Record<string, any>;
  status: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
};

export default function AdminCommandsPage() {
  const { supabase } = useSupabase();
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    fetchCommands();
  }, [page, filterStatus]);

  // Subscribe to realtime changes for commands
  useRealtimeSubscription(
    supabase,
    "irc_device_commands",
    (payload) => {
      console.log("[Realtime] Command changed:", payload);
      
      if (payload.eventType === "INSERT" && payload.new) {
        // Add new command to the beginning of the list
        setCommands(prevCommands => {
          // Check if already in list
          if (prevCommands.find(c => c.id === payload.new.id)) {
            return prevCommands;
          }
          // Check if matches status filter
          const matchesFilter = !filterStatus || payload.new.status === filterStatus;
          return matchesFilter ? [payload.new, ...prevCommands] : prevCommands;
        });
        setTotal(prev => prev + 1);
      } else if (payload.eventType === "UPDATE" && payload.new) {
        // Update existing command
        setCommands(prevCommands => {
          const updated = prevCommands.map(command => 
            command.id === payload.new.id 
              ? { ...command, ...payload.new }
              : command
          );
          // If status filter is active and command no longer matches, remove it
          if (filterStatus && payload.new.status !== filterStatus) {
            return updated.filter(c => c.id !== payload.new.id);
          }
          return updated;
        });
      } else if (payload.eventType === "DELETE" && payload.old) {
        // Remove command from list
        setCommands(prevCommands => 
          prevCommands.filter(command => command.id !== payload.old.id)
        );
        setTotal(prev => Math.max(0, prev - 1));
      }
    }
  );

  const fetchCommands = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;
      let url = `/api/admin/commands?limit=${limit}&offset=${offset}`;
      if (filterStatus) {
        url += `&status=${filterStatus}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch commands");
      }
      const data = await response.json();
      setCommands(data.commands || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commands");
    } finally {
      setLoading(false);
    }
  };

  if (loading && commands.length === 0) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading commands...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Commands</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Total: {total.toLocaleString()} commands
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus(null)}
            className={`btn-secondary px-4 py-2 text-sm ${filterStatus === null ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`btn-secondary px-4 py-2 text-sm ${filterStatus === "pending" ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`btn-secondary px-4 py-2 text-sm ${filterStatus === "completed" ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilterStatus("failed")}
            className={`btn-secondary px-4 py-2 text-sm ${filterStatus === "failed" ? "bg-red-500/20 border-red-500/50" : ""}`}
          >
            Failed
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Device</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {commands.map((command) => (
                <tr key={command.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-slate-400">{command.id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-slate-300">{command.device_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{command.command_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{command.command_action}</div>
                    {command.command_params && Object.keys(command.command_params).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {JSON.stringify(command.command_params).substring(0, 50)}...
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      command.status === "completed" ? "badge-success" :
                      command.status === "pending" ? "badge-warning" :
                      command.status === "failed" ? "badge-error" :
                      "badge-info"
                    }`}>
                      {command.status}
                    </span>
                    {command.error_message && (
                      <div className="text-xs text-rose-400 mt-1">{command.error_message}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {new Date(command.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {command.completed_at ? new Date(command.completed_at).toLocaleString() : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {commands.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-slate-400">No commands found</p>
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

