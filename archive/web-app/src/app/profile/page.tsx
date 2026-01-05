"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";

type Profile = {
  id: string;
  email: string;
  display_name?: string | null;
  role?: string;
  credits?: number;
  created_at?: string;
};

type UserStats = {
  totalLaps: number;
  bestLap: {
    lap_time: number;
    lap_number: number;
    track_id: string | null;
    car_id: string | null;
    timestamp: string;
    device_id: string;
  } | null;
  recentLaps: Array<{
    lap_id: string;
    lap_number: number;
    lap_time: number;
    track_id: string | null;
    car_id: string | null;
    timestamp: string;
    device_id: string;
  }>;
  lapsByTrack: Record<string, number>;
  lapsByCar: Record<string, number>;
  averageLapTime: number | null;
  recentLapsCount: number;
  weekLapsCount: number;
  ownedDevicesCount: number;
  deviceNames: Record<string, string>;
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, loading: sessionLoading, supabase } = useSupabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Form state
  const [displayName, setDisplayName] = useState("");
  
  // Credit purchase state
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError(null);
    try {
      // Get auth token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("No session token");
      }

      const response = await fetch("/api/profile", {
        headers: {
          "Authorization": `Bearer ${currentSession.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data);
      setDisplayName(data.display_name || "");
      // Clear purchase messages when profile refreshes
      setPurchaseError(null);
      setPurchaseSuccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  const fetchStats = useCallback(async () => {
    if (!session) return;

    setStatsLoading(true);
    try {
      // Get auth token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        return;
      }

      const response = await fetch("/api/profile/stats", {
        headers: {
          "Authorization": `Bearer ${currentSession.access_token}`
        }
      });

      if (!response.ok) {
        // Stats are optional, don't show error if it fails
        console.error("Failed to fetch stats");
        return;
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    if (sessionLoading) {
      return; // Still loading, wait
    }
    
    if (!session) {
      // Redirect to login if not authenticated
      router.push("/auth/login?redirectTo=/profile");
      return;
    }
    
    // Session exists, fetch profile and stats
    fetchProfile();
    fetchStats();
  }, [session, sessionLoading, router, fetchProfile, fetchStats]);

  const handlePurchaseCredits = async (amount: number) => {
    if (!session || purchasing) return;

    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(false);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("No session token");
      }

      const response = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({ amount })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to purchase credits");
      }

      setPurchaseSuccess(true);
      setPurchaseAmount("");
      
      // Refresh profile to show new balance
      await fetchProfile();
      
      // Clear success message after 5 seconds
      setTimeout(() => setPurchaseSuccess(false), 5000);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to purchase credits");
    } finally {
      setPurchasing(false);
    }
  };

  const handleQuickPurchase = (amount: number) => {
    setPurchaseAmount(amount.toString());
    handlePurchaseCredits(amount);
  };


  const formatLapTime = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return "--";
    return `${seconds.toFixed(3)}s`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Get auth token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error("No session token");
      }

      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({
          display_name: displayName.trim() || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }

      const data = await response.json();
      setProfile(data);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading profile...</p>
        </div>
      </section>
    );
  }

  if (!session || !profile) {
    return null; // Will redirect
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">My Profile</h1>
        <p className="text-slate-400 text-xs sm:text-sm md:text-base">
          Manage your account information and preferences
        </p>
      </div>

      {error && (
        <div className="glass rounded-xl border-rose-500/50 bg-rose-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-rose-400">⚠</span>
            <p className="text-sm font-medium text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="glass rounded-xl border-emerald-500/50 bg-emerald-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400">✓</span>
            <p className="text-sm font-medium text-emerald-200">Profile updated successfully!</p>
          </div>
        </div>
      )}

      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
        <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
          {/* Email (read-only) */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={profile.email}
              disabled
              className="input w-full bg-slate-800/50 text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500">
              Email cannot be changed. Contact support if you need to update your email.
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="display_name" className="block text-sm font-semibold text-slate-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name (optional)"
              maxLength={100}
              className="input w-full"
            />
            <p className="mt-1 text-xs text-slate-500">
              This name will be shown on leaderboards and in the queue. Leave empty to use your email.
            </p>
          </div>

          {/* Role (read-only) */}
          <div>
            <label htmlFor="role" className="block text-sm font-semibold text-slate-300 mb-2">
              Role
            </label>
            <input
              type="text"
              id="role"
              value={profile.role || "user"}
              disabled
              className="input w-full bg-slate-800/50 text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500">
              Your account role. Contact an administrator to change your role.
            </p>
          </div>

          {/* Credits Balance */}
          <div>
            <label htmlFor="credits" className="block text-sm font-semibold text-slate-300 mb-2">
              Credits Balance
            </label>
            <div className="relative">
              <input
                type="text"
                id="credits"
                value={`${(profile.credits ?? 0).toLocaleString()} credits`}
                disabled
                className="input w-full bg-slate-800/50 text-slate-400 cursor-not-allowed pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                ${((profile.credits ?? 0) / 100).toFixed(2)} USD
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              1 credit = $0.01. 1-minute test session costs 100 credits ($1.00).
            </p>
          </div>

          {/* Purchase Credits Section */}
          <div className="border-t border-slate-700/50 pt-6 mt-6">
            <h3 className="text-base font-semibold text-slate-300 mb-3">Purchase Credits (Free Demo)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Get up to 1,000 credits for free to test the system. Each 1-minute session costs 100 credits.
            </p>

            {purchaseError && (
              <div className="mb-4 rounded-lg border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-200">
                {purchaseError}
              </div>
            )}

            {purchaseSuccess && (
              <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Credits added successfully! Your balance has been updated.
              </div>
            )}

            {/* Quick Purchase Buttons */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Quick Purchase:</p>
              <div className="flex flex-wrap gap-2">
                {[100, 500, 1000].map((amount) => {
                  const currentCredits = profile.credits ?? 0;
                  const maxFreeCredits = 1000;
                  const availableToAdd = Math.max(0, maxFreeCredits - currentCredits);
                  const canPurchase = availableToAdd >= amount && currentCredits < maxFreeCredits;
                  const actualAmount = canPurchase ? amount : Math.min(amount, availableToAdd);
                  
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        if (canPurchase) {
                          handleQuickPurchase(amount);
                        } else if (availableToAdd > 0) {
                          handleQuickPurchase(availableToAdd);
                        }
                      }}
                      disabled={availableToAdd <= 0 || purchasing}
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={!canPurchase && availableToAdd > 0 ? `Only ${availableToAdd} credits available` : canPurchase ? `Add ${amount} credits` : "Maximum credits reached"}
                    >
                      {canPurchase ? (
                        <>
                          {amount} credits
                          <span className="ml-1 text-xs text-slate-500">
                            (${(amount / 100).toFixed(2)})
                          </span>
                        </>
                      ) : availableToAdd > 0 ? (
                        <>
                          {availableToAdd} credits
                          <span className="ml-1 text-xs text-slate-500">
                            (max)
                          </span>
                        </>
                      ) : (
                        <>
                          {amount} credits
                          <span className="ml-1 text-xs text-slate-400 line-through">
                            (max reached)
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div>
              <label htmlFor="purchase_amount" className="block text-sm font-medium text-slate-300 mb-2">
                Custom Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  id="purchase_amount"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder="Enter credits (1-1000)"
                  min="1"
                  max="1000"
                  disabled={purchasing}
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const amount = parseInt(purchaseAmount);
                    if (amount > 0 && amount <= 1000) {
                      handlePurchaseCredits(amount);
                    }
                  }}
                  disabled={!purchaseAmount || purchasing || parseInt(purchaseAmount) <= 0 || parseInt(purchaseAmount) > 1000}
                  className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {purchasing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2 inline-block"></div>
                      Adding...
                    </>
                  ) : (
                    "Add Credits"
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                You can add up to {Math.max(0, 1000 - (profile.credits ?? 0))} more credits (1,000 total limit for free demo).
              </p>
            </div>
          </div>

          {/* Account Created Date (read-only) */}
          {profile.created_at && (
            <div>
              <label htmlFor="created_at" className="block text-sm font-semibold text-slate-300 mb-2">
                Account Created
              </label>
              <input
                type="text"
                id="created_at"
                value={new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
                disabled
                className="input w-full bg-slate-800/50 text-slate-400 cursor-not-allowed"
              />
            </div>
          )}

          {/* Save Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-4 sm:px-6 py-2.5 sm:py-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayName(profile.display_name || "");
                setError(null);
                setSuccess(false);
              }}
              disabled={saving}
              className="btn-secondary px-4 sm:px-6 py-2.5 sm:py-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Statistics Section */}
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 gradient-text">Statistics</h2>
        
        {statsLoading ? (
          <div className="glass rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center">
            <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
              <div className="h-5 w-5 sm:h-6 sm:w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
            </div>
            <p className="text-slate-300 font-medium text-sm sm:text-base">Loading statistics...</p>
          </div>
        ) : stats && stats.totalLaps > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Credits Balance */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Credits</p>
                    <p className="text-2xl font-bold text-white">{(profile.credits ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">${((profile.credits ?? 0) / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Total Laps */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Total Laps</p>
                    <p className="text-2xl font-bold text-white">{stats.totalLaps.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Best Lap */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Best Lap</p>
                    <p className="text-2xl font-bold text-white">{formatLapTime(stats.bestLap?.lap_time || null)}</p>
                    {stats.bestLap?.track_id && (
                      <p className="text-xs text-slate-500 mt-1">{stats.bestLap.track_id}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Average Lap */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Average Lap</p>
                    <p className="text-2xl font-bold text-white">{formatLapTime(stats.averageLapTime)}</p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Last 24h</p>
                    <p className="text-2xl font-bold text-white">{stats.recentLapsCount}</p>
                    <p className="text-xs text-slate-500 mt-1">{stats.weekLapsCount} this week</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Laps by Track */}
            {Object.keys(stats.lapsByTrack).length > 0 && (
              <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Laps by Track</h3>
                <div className="space-y-2">
                  {Object.entries(stats.lapsByTrack)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([track, count]) => (
                      <div key={track} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-300 text-sm sm:text-base truncate pr-2">{track}</span>
                        <span className="text-red-400 font-semibold text-sm sm:text-base flex-shrink-0">{count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Laps */}
            {stats.recentLaps.length > 0 && (
              <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Recent Laps</h3>
                <div className="space-y-2">
                  {stats.recentLaps.slice(0, 10).map((lap) => (
                    <div key={lap.lap_id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className="text-slate-400 text-xs sm:text-sm">Lap {lap.lap_number}</span>
                          {lap.track_id && (
                            <span className="text-slate-500 text-xs sm:text-sm">• {lap.track_id}</span>
                          )}
                          {lap.car_id && (
                            <span className="text-slate-500 text-xs sm:text-sm">• {lap.car_id}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(lap.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-red-400 font-semibold text-xs sm:text-sm flex-shrink-0">{formatLapTime(lap.lap_time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Owned Devices */}
            {stats.ownedDevicesCount > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Owned Devices</h3>
                <p className="text-slate-300">You own {stats.ownedDevicesCount} device{stats.ownedDevicesCount !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        ) : stats ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50 mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-300 font-medium mb-2">No lap data yet</p>
            <p className="text-slate-500 text-sm">Start driving to see your statistics here!</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

