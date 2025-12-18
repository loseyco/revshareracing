"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";

type UserProfile = {
  id: string;
  email: string;
  display_name?: string;
  credits: number;
  role?: string;
};

export default function DriverHeader() {
  const { session, supabase, loading: sessionLoading } = useSupabase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user profile and check admin access
  const fetchProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        console.log("[DriverHeader] No token available");
        return;
      }

      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[DriverHeader] Profile fetched:", data.credits, "credits");
        setProfile({
          id: session.user.id,
          email: data.email || session.user.email || "",
          display_name: data.display_name,
          credits: data.credits ?? 0,
          role: data.role,
        });
        
        // Check if user is admin
        setIsAdmin(data.role === "admin" || data.role === "super_admin");
      } else {
        console.error("[DriverHeader] Profile fetch failed:", response.status);
      }
    } catch (err) {
      console.error("[DriverHeader] Error fetching profile:", err);
    }
  }, [session, supabase]);

  // Initial fetch when session is ready
  useEffect(() => {
    if (!sessionLoading && session) {
      fetchProfile();
    }
  }, [sessionLoading, session, fetchProfile]);

  // Refresh credits periodically (every 5 seconds)
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(fetchProfile, 5000);
    return () => clearInterval(interval);
  }, [session, fetchProfile]);

  // Listen for refresh-credits events from other components
  useEffect(() => {
    const handleRefreshCredits = () => {
      fetchProfile();
    };

    window.addEventListener("refresh-credits", handleRefreshCredits);
    return () => window.removeEventListener("refresh-credits", handleRefreshCredits);
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const displayName = profile?.display_name || profile?.email?.split("@")[0] || "Driver";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/90 border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:shadow-red-500/50 transition-shadow">
              <span className="text-white text-xl">🏎️</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold text-white">Rev Share </span>
              <span className="text-lg font-light text-red-400">Racing</span>
            </div>
          </Link>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {sessionLoading ? (
              <div className="h-8 w-24 bg-slate-800/50 rounded-lg animate-pulse"></div>
            ) : session ? (
              <>
                {/* Credits Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
                  <span className="text-yellow-400 text-sm">💰</span>
                  <span className="text-yellow-300 font-bold text-sm">
                    {profile?.credits?.toLocaleString() ?? "..."}
                  </span>
                  <span className="text-yellow-400/60 text-xs hidden sm:inline">credits</span>
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all"
                  >
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xs font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:block text-sm text-white font-medium max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden z-50">
                        {/* User Info */}
                        <div className="px-4 py-3 border-b border-slate-700/50">
                          <p className="text-sm font-medium text-white truncate">{displayName}</p>
                          <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
                        </div>

                        {/* Mobile Credits */}
                        <div className="sm:hidden px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">Credits</span>
                            <span className="text-yellow-300 font-bold">
                              {profile?.credits?.toLocaleString() ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <Link
                            href="/profile"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <span className="text-lg">👤</span>
                            My Profile
                          </Link>
                          <Link
                            href="/dashboard"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <span className="text-lg">📊</span>
                            Dashboard
                          </Link>
                          <Link
                            href="/leaderboards"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                          >
                            <span className="text-lg">🏆</span>
                            Leaderboards
                          </Link>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              onClick={() => setMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                            >
                              <span className="text-lg">⚙️</span>
                              Admin Panel
                            </Link>
                          )}
                        </div>

                        {/* Sign Out */}
                        <div className="border-t border-slate-700/50 py-2">
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <span className="text-lg">🚪</span>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/auth/register"
                  className="btn-primary text-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Export a hook to refresh credits from other components
export function useDriverHeaderRefresh() {
  return {
    refreshCredits: () => {
      // Trigger a custom event that the header listens to
      window.dispatchEvent(new CustomEvent("refresh-credits"));
    }
  };
}

