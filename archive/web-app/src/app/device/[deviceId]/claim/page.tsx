"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";

function ClaimFormContent() {
  const { session, loading: sessionLoading } = useSupabase();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = params.deviceId as string;
  const claimCode = searchParams.get("claimCode");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceName?: string;
    claimed?: boolean;
  } | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(`/device/${deviceId}/claim?claimCode=${claimCode || ''}`)}`);
    }
  }, [session, sessionLoading, deviceId, claimCode, router]);

  // Fetch device info
  useEffect(() => {
    if (session && deviceId) {
      fetchDeviceInfo();
    }
  }, [session, deviceId]);

  const fetchDeviceInfo = async () => {
    try {
      const response = await fetch(`/api/device/info?deviceId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setDeviceInfo(data);
        
        // If already claimed by this user, redirect to details
        if (data.claimed && data.ownerUserId === session?.user.id) {
          router.replace(`/device/${deviceId}/details`);
          return;
        }
        
        // If claimed by another user, show error
        if (data.claimed && data.ownerUserId !== session?.user.id) {
          setError("This device has already been claimed by another user.");
        }
      }
    } catch (err) {
      console.error("Failed to fetch device info:", err);
    }
  };

  const handleClaim = async () => {
    if (!claimCode) {
      setError("Claim code is missing. Please check the URL.");
      return;
    }

    if (!session) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(`/device/${deviceId}/claim?claimCode=${claimCode}`)}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/device/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          claimCode: claimCode.toUpperCase(),
          userId: session.user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim device");
      }

      setSuccess(true);
      // Redirect to device details after a short delay
      setTimeout(() => {
        router.replace(`/device/${deviceId}/details`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim device");
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <section className="mx-auto max-w-md animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-3 sm:mb-4">
              <div className="h-7 w-7 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Loading...</h2>
          </div>
        </div>
      </section>
    );
  }

  if (!session) {
    return null; // Will redirect to login
  }

  if (success) {
    return (
      <section className="mx-auto max-w-md animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 mb-3 sm:mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Device Claimed!</h2>
            <p className="text-slate-400 text-xs sm:text-sm md:text-base">
              Redirecting to device details...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md animate-fade-in">
      <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-3 sm:mb-4">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Claim Device</h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base">
            Claim this rig to manage it from your dashboard
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Device ID</span>
                <p className="text-sm font-mono text-slate-200 mt-1">{deviceId}</p>
              </div>
              {deviceInfo?.deviceName && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Device Name</span>
                  <p className="text-sm font-medium text-slate-200 mt-1">{deviceInfo.deviceName}</p>
                </div>
              )}
              {claimCode && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Claim Code</span>
                  <p className="text-lg font-bold font-mono text-red-400 mt-1">{claimCode.toUpperCase()}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-medium text-rose-200">{error}</p>
              </div>
            </div>
          )}

          {!claimCode ? (
            <div className="rounded-xl border border-yellow-500/50 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm font-medium text-yellow-200">
                Claim code is missing. Please use the link from your PC service.
              </p>
            </div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={loading || deviceInfo?.claimed}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Claiming device…</span>
                </>
              ) : (
                <span>Claim This Device</span>
              )}
            </button>
          )}

          <div className="pt-4 border-t border-slate-800/50">
            <Link
              href="/dashboard"
              className="btn-secondary w-full text-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <section className="mx-auto max-w-md animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-3 sm:mb-4">
              <div className="h-7 w-7 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Loading...</h2>
          </div>
        </div>
      </section>
    }>
      <ClaimFormContent />
    </Suspense>
  );
}


