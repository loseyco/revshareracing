"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";
import { useRouter } from "next/navigation";

type ActiveRig = {
  device_id: string;
  device_name: string;
  claimed: boolean;
  iracing_connected: boolean;
  last_seen: string;
  city?: string;
  region?: string;
  country?: string;
  queueCount: number;
  activeDriver: {
    email: string;
    display_name?: string;
  } | null;
};

export function ActiveRigsList() {
  const [rigs, setRigs] = useState<ActiveRig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningQueue, setJoiningQueue] = useState<string | null>(null);
  const { session, supabase } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    fetchActiveRigs();
    // Poll every 10 seconds to update the list
    const interval = setInterval(fetchActiveRigs, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveRigs = async () => {
    try {
      const response = await fetch("/api/rigs/active");
      if (!response.ok) {
        throw new Error("Failed to fetch active rigs");
      }
      const data = await response.json();
      setRigs(data.rigs || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch active rigs:", err);
      setError("Failed to load active rigs");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinQueue = async (deviceId: string) => {
    if (!session) {
      router.push(`/auth/login?redirectTo=/device/${deviceId}/queue`);
      return;
    }

    setJoiningQueue(deviceId);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error("No session token available");
      }

      const response = await fetch(`/api/device/${deviceId}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join queue");
      }

      // Navigate to the queue page
      router.push(`/device/${deviceId}/queue`);
    } catch (err) {
      console.error("[handleJoinQueue] Error:", err);
      alert(err instanceof Error ? err.message : "Failed to join queue");
    } finally {
      setJoiningQueue(null);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 w-full">
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
            <span>Loading active rigs...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-8 w-full">
        <div className="text-center text-slate-400">{error}</div>
      </div>
    );
  }

  if (rigs.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Active Rigs</h2>
        <div className="text-center text-slate-400 py-8">
          No active rigs available at the moment. Check back soon!
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">Active Rigs</h2>
        <p className="text-slate-400 text-sm">
          {rigs.length} {rigs.length === 1 ? "rig" : "rigs"} ready to drive
        </p>
      </div>

      <div className="space-y-3">
        {rigs.map((rig) => {
          const location = [rig.city, rig.region, rig.country].filter(Boolean).join(", ") || "Unknown Location";
          const isJoining = joiningQueue === rig.device_id;

          return (
            <div
              key={rig.device_id}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" title="Online & Connected"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-white truncate">
                    {rig.device_name || rig.device_id}
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="truncate">{location}</span>
                  {rig.queueCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="text-slate-500">•</span>
                      <span>{rig.queueCount} {rig.queueCount === 1 ? "person" : "people"} in queue</span>
                    </span>
                  )}
                  {rig.activeDriver && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <span className="text-slate-500">•</span>
                      <span>🏎️ {rig.activeDriver.display_name || rig.activeDriver.email} driving</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <Link
                  href={`/device/${rig.device_id}/queue`}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  View Queue
                </Link>
                <button
                  onClick={() => handleJoinQueue(rig.device_id)}
                  disabled={isJoining}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isJoining ? "Joining..." : "Join Queue"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

