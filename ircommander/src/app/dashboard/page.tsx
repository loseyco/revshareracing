"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated, clearAuth } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-5xl px-6 py-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Dashboard</h1>
            <p className="text-neutral-400">
              Welcome back, {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>

        {/* Content */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </div>
  );
}
