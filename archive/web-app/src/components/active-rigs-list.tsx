"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ActiveRig = {
  device_id: string;
  device_name: string;
  claimed: boolean;
  iracing_connected: boolean;
  last_seen: string;
  city?: string;
  region?: string;
  country?: string;
  address?: string;
  display_address?: string;
  location?: string;
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
    <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Active Rigs</h2>
        <p className="text-slate-400 text-xs sm:text-sm">
          {rigs.length} {rigs.length === 1 ? "rig" : "rigs"} ready to drive
        </p>
      </div>

      <div className="space-y-3">
        {rigs.map((rig) => {
          // Prefer display_address, then address, then location, then city/region/country combo
          const location = rig.display_address || rig.address || rig.location || 
            [rig.city, rig.region, rig.country].filter(Boolean).join(", ") || "Unknown Location";

          return (
            <Link
              key={rig.device_id}
              href={`/device/${rig.device_id}/driver`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-red-500/50 hover:bg-slate-800/70 transition-all group"
            >
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="flex-shrink-0">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" title="Online & Connected"></div>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                    {rig.device_name || rig.device_id}
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-400">
                  <span className="truncate">{location}</span>
                  {rig.queueCount > 0 && (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span className="text-slate-500">•</span>
                      <span>{rig.queueCount} in queue</span>
                    </span>
                  )}
                  {rig.activeDriver && (
                    <span className="flex items-center gap-1 text-yellow-400 whitespace-nowrap">
                      <span className="text-slate-500">•</span>
                      <span className="truncate">🏎️ {rig.activeDriver.display_name || rig.activeDriver.email}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center w-full sm:w-auto">
                <span className="px-4 py-2 bg-red-500 group-hover:bg-red-600 text-white font-semibold rounded-lg transition-colors text-sm whitespace-nowrap w-full sm:w-auto text-center">
                  View Rig →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

