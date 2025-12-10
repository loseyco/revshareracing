"use client";

import { useRouter } from "next/navigation";
import { useState, Suspense } from "react";

import { useSupabase } from "@/components/providers/supabase-provider";
import { clientEnv } from "@/lib/env";

function ForgotPasswordFormContent() {
  const { supabase } = useSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      // Always use production URL for password reset links
      // This ensures emails work correctly regardless of where the request is made from
      const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL || "https://revshareracing.com";
      const redirectTo = `${siteUrl}/auth/reset-password`;
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      // Store a flag that password reset was initiated (expires in 1 hour)
      localStorage.setItem("password_reset_initiated", Date.now().toString());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Check your email</h2>
            <p className="text-slate-400 text-xs sm:text-sm md:text-base">
              We've sent a password reset link to <span className="font-semibold text-white">{email}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 mb-6">
            <p className="text-sm text-slate-300">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="btn-secondary w-full"
          >
            Back to login
          </button>
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
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Reset your password</h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>
        <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-200">Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Sending reset link…</span>
              </>
            ) : (
              <span>Send reset link</span>
            )}
          </button>
        </form>
        {error && (
          <div className="mt-6 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-rose-200">{error}</p>
            </div>
          </div>
        )}
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
      </div>
    </section>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordFormContent />
    </Suspense>
  );
}

