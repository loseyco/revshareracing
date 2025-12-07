"use client";

import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";

export default function HomePage() {
  const { session, loading } = useSupabase();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <h1 className="text-4xl font-bold text-white">Welcome</h1>
      
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          <span>Loading...</span>
        </div>
      ) : session ? (
        <div className="flex flex-col gap-4">
          <Link href="/dashboard" className="btn-primary text-center">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Link href="/auth/login" className="btn-primary text-center">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn-secondary text-center">
            Register
          </Link>
        </div>
      )}
    </div>
  );
}
