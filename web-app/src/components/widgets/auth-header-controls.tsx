"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";

export function AuthHeaderControls() {
  const { supabase, session, loading } = useSupabase();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
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
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all duration-300 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 hover:shadow-lg hover:shadow-rose-500/20"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Logout</span>
      </button>
    </div>
  );
}




