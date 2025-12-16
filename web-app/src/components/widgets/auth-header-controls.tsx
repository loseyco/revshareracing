"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";
import { checkAdminAccess } from "@/lib/admin";

export function AuthHeaderControls() {
  const { supabase, session, loading } = useSupabase();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      setIsAdmin(checkAdminAccess(session.user.email));
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-clicks
    
    setIsLoggingOut(true);
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[handleLogout] Error signing out:", error);
      }
      
      // Aggressively clear all Supabase-related storage
      try {
        // Clear localStorage items that might contain session data
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear sessionStorage as well
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      } catch (storageError) {
        console.error("[handleLogout] Error clearing storage:", storageError);
      }
      
      // Wait a bit to ensure signOut completes
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force a hard redirect with cache busting to ensure fresh page load
      // This works better in embedded browsers like Cursor
      window.location.href = `/?logout=${Date.now()}`;
    } catch (err) {
      console.error("[handleLogout] Unexpected error:", err);
      // Still redirect even on error, with cache busting
      window.location.href = `/?logout=${Date.now()}`;
    }
    // Note: We don't set isLoggingOut to false because we're redirecting
  };

  if (loading) {
    return <span className="text-sm text-slate-400">Loading…</span>;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="btn-secondary px-5 py-2.5 text-sm"
        >
          Login
        </Link>
        <Link
          href="/auth/register"
          className="btn-primary px-5 py-2.5 text-sm"
        >
          Register
        </Link>
      </div>
    );
  }

  return (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse"></div>
        <span className="text-xs text-slate-300">
          <span className="text-slate-400">Logged in as</span>{" "}
          <span className="font-semibold text-white">{session.user.email ?? "account"}</span>
        </span>
      </div>
      <Link
        href="/dashboard"
        className="btn-secondary px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span>Dashboard</span>
      </Link>
      <Link
        href="/leaderboards"
        className="btn-secondary px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
        <span className="hidden sm:inline">Leaderboards</span>
        <span className="sm:hidden">🏆</span>
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="btn-secondary px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all duration-300 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 hover:shadow-lg hover:shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoggingOut ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400 border-t-transparent"></div>
            <span>Logging out...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </>
        )}
      </button>
    </div>
  );
}




