"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRealtimeSubscription } from "@/lib/use-realtime";

type User = {
  id: string;
  email: string;
  role?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
};

const VALID_ROLES = ["user", "admin", "super_admin", "driver"];

export default function AdminUsersPage() {
  const { session, supabase } = useSupabase();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    fetchUsers();
  }, [page]);

  // Subscribe to realtime changes for user profiles (roles)
  useRealtimeSubscription(
    supabase,
    "irc_user_profiles",
    (payload) => {
      console.log("[Realtime] User profile changed:", payload);
      
      if (payload.eventType === "UPDATE" && payload.new) {
        // Update the specific user's role in the list
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === payload.new.id 
              ? { ...user, role: payload.new.role }
              : user
          )
        );
      } else if (payload.eventType === "INSERT" && payload.new) {
        // New profile created - update if user already exists in list
        setUsers(prevUsers => {
          const existingUser = prevUsers.find(u => u.id === payload.new.id);
          if (existingUser) {
            return prevUsers.map(user => 
              user.id === payload.new.id 
                ? { ...user, role: payload.new.role }
                : user
            );
          }
          return prevUsers;
        });
      }
    }
  );

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;
      const response = await fetch(`/api/admin/users?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    if (!session) return;

    try {
      setUpdating(userId);
      setError(null);

      // Get auth token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("No session token");
      }

      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({ userId, role: newRole })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update role");
      }

      // Optimistically update the UI immediately (realtime will confirm)
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, role: newRole }
            : user
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "badge-error";
      case "admin":
        return "badge-warning";
      default:
        return "badge-info";
    }
  };

  if (loading && users.length === 0) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading users...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">Users</h1>
          <p className="text-slate-400 text-sm md:text-base">
            Total: {total.toLocaleString()} users
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </span>
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

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">User ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Change Role</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Last Sign In</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-mono text-slate-400">{user.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {user.role || "user"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role || "user"}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={updating === user.id}
                      className="input text-sm py-2 px-3 min-w-[140px]"
                    >
                      {VALID_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {updating === user.id && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                        <span>Updating...</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : "Never"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${user.email_confirmed_at ? "badge-success" : "badge-warning"}`}>
                      {user.email_confirmed_at ? "Verified" : "Unverified"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && !loading && (
          <div className="p-12 text-center">
            <p className="text-slate-400">No users found</p>
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

