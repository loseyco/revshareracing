"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useSupabase } from "@/components/providers/supabase-provider";
import { RigMap } from "@/components/rig-map";
import { ActiveRigsList } from "@/components/active-rigs-list";

function HomePageContent() {
  const { session, loading, supabase } = useSupabase();
  const searchParams = useSearchParams();

  // Force refresh session if we came from logout
  useEffect(() => {
    const logoutParam = searchParams.get("logout");
    if (logoutParam) {
      // Force refresh the session to ensure it's cleared
      supabase.auth.getSession().then(({ data }) => {
        // If session still exists, try to clear it
        if (data.session) {
          console.log("[HomePage] Session still exists after logout, clearing...");
          supabase.auth.signOut().then(() => {
            // Remove the logout parameter from URL
            window.history.replaceState({}, "", "/");
            // Force a page reload to clear all state
            window.location.reload();
          });
        } else {
          // Remove the logout parameter from URL
          window.history.replaceState({}, "", "/");
        }
      });
    }
  }, [searchParams, supabase]);

  // Direct download link to latest release
  const downloadUrl = "https://github.com/loseyco/revshareracing/releases/download/1.0.0/RevShareRacing.exe";

  return (
    <div className="flex flex-col items-center min-h-[60vh] space-y-8 px-4 py-8 w-full max-w-7xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white gradient-text">Rev Share Racing</h1>
        <p className="text-slate-400 text-lg">Connect your iRacing rig to the cloud</p>
      </div>

      {/* Download Section */}
      <div className="glass rounded-2xl p-8 max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Download PC Service</h2>
          <p className="text-slate-400">
            Get the latest version of the Rev Share Racing PC Service
          </p>
        </div>
        
        <a
          href={downloadUrl}
          className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download Latest Release (v1.0.0)</span>
        </a>
        
        <p className="text-xs text-slate-500">
          Downloads RevShareRacing.exe (~60 MB) - No installation required
        </p>
      </div>
      
      {/* Auth Section */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
            <span>Loading...</span>
          </div>
        ) : session ? (
          <Link href="/dashboard" className="btn-primary text-center">
            Go to Dashboard
          </Link>
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

      {/* Active Rigs Section */}
      <div className="w-full">
        <ActiveRigsList />
      </div>

      {/* Map Section - Moved to bottom */}
      <div className="w-full">
        <RigMap />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center min-h-[60vh] space-y-8 px-4 py-8 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          <span>Loading...</span>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
