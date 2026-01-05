"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useLayoutEffect, Suspense } from "react";

import { useSupabase } from "@/components/providers/supabase-provider";

function ResetPasswordFormContent() {
  const { supabase, session, loading: sessionLoading } = useSupabase();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);
  const [pageLoadTime] = useState(() => Date.now());

  // Check for recovery token and listen to auth state changes
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check sessionStorage first (in case we already detected it)
    const stored = sessionStorage.getItem("password_reset_token_detected");
    if (stored === "true") {
      setHasRecoveryToken(true);
    }
    
    // Check URL hash for recovery token
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");

    if (accessToken && type === "recovery") {
      setHasRecoveryToken(true);
      sessionStorage.setItem("password_reset_token_detected", "true");
    }

    // Listen to auth state changes to detect recovery token processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && window.location.hash.includes("type=recovery"))) {
        setHasRecoveryToken(true);
        sessionStorage.setItem("password_reset_token_detected", "true");
        // Clear hash after processing
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Handle recovery token validation and form display
  useEffect(() => {
    if (sessionLoading) return;

    // Check sessionStorage - if recovery token was detected, allow reset
    const stored = sessionStorage.getItem("password_reset_token_detected");
    if (stored === "true" && session) {
      setHasRecoveryToken(true);
      setCheckingToken(false);
      return;
    }

    // Check if hash still has recovery token
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");

    if (accessToken && type === "recovery" && refreshToken) {
      // Still have token in hash - process it
      setHasRecoveryToken(true);
      sessionStorage.setItem("password_reset_token_detected", "true");
      
      const processToken = async () => {
        // Sign out any existing session first
        if (session) {
          await supabase.auth.signOut();
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Set session from recovery token
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError || !data.session) {
          setCheckingToken(false);
          setError("Invalid or expired reset token. Please request a new password reset link.");
          setHasRecoveryToken(false);
          sessionStorage.removeItem("password_reset_token_detected");
        } else {
          // Clear hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          setCheckingToken(false);
        }
      };

      processToken();
    } else if (hasRecoveryToken && session) {
      // Recovery token detected and session exists
      setCheckingToken(false);
    } else if (!hasRecoveryToken && session) {
      // No recovery token detected but user is logged in
      // Check if password reset was recently initiated
      const resetInitiated = localStorage.getItem("password_reset_initiated");
      const resetTime = resetInitiated ? parseInt(resetInitiated) : null;
      const timeSinceReset = resetTime ? Date.now() - resetTime : null;
      const isValidResetWindow = timeSinceReset && timeSinceReset < 3600000; // Within 1 hour
      
      // Check multiple indicators that this might be from a recovery token:
      const referrer = document.referrer;
      const sessionAge = session.expires_at ? (session.expires_at * 1000) - Date.now() : null;
      const isRecentSession = sessionAge && sessionAge > (3600 * 1000 - 120000); // Session expires in ~1 hour, so if it's very new, it's likely from recovery
      const timeSincePageLoad = Date.now() - pageLoadTime;
      const justLoaded = timeSincePageLoad < 10000; // Page loaded within last 10 seconds
      
      if (isValidResetWindow && justLoaded && (referrer.includes("supabase.co") || referrer.includes("supabase") || isRecentSession)) {
        // Password reset was initiated recently and user just arrived - allow reset
        setHasRecoveryToken(true);
        sessionStorage.setItem("password_reset_token_detected", "true");
        setCheckingToken(false);
      } else {
        // User is logged in but didn't come from recovery link - redirect
        setCheckingToken(false);
        router.push("/dashboard");
      }
    } else if (!hasRecoveryToken && !session) {
      // No recovery token and no session
      setCheckingToken(false);
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [session, sessionLoading, hasRecoveryToken, router, supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Prevent submission if there's no valid recovery token
    if (!hasRecoveryToken || !session) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      // Clear sessionStorage and localStorage
      sessionStorage.removeItem("password_reset_token_detected");
      localStorage.removeItem("password_reset_initiated");
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken || sessionLoading) {
    return (
      <section className="mx-auto max-w-md animate-fade-in">
        <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6 sm:mb-8 text-center">
            <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-3 sm:mb-4">
              <div className="h-7 w-7 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></div>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Verifying...</h2>
          </div>
        </div>
      </section>
    );
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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Password reset successful</h2>
            <p className="text-slate-400 text-xs sm:text-sm md:text-base">
              Your password has been updated. Redirecting to login...
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Set new password</h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base">
            Enter your new password below
          </p>
        </div>
        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-rose-200">{error}</p>
            </div>
          </div>
        )}
        {hasRecoveryToken && session && (
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">New Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input"
                placeholder="At least 6 characters"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-200">Confirm New Password</span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input"
                placeholder="Re-enter your password"
              />
            </label>
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Resetting password…</span>
                </>
              ) : (
                <span>Reset password</span>
              )}
            </button>
          </form>
        )}
        {!hasRecoveryToken && error && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/auth/forgot-password")}
              className="btn-secondary w-full"
            >
              Request new reset link
            </button>
          </div>
        )}
        {hasRecoveryToken && session && (
          <div className="mt-6 pt-6 border-t border-slate-800/50">
            <p className="text-center text-sm text-slate-400">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordFormContent />
    </Suspense>
  );
}

