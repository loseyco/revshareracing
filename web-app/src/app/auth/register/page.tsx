"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useSupabase } from "@/components/providers/supabase-provider";

export default function RegisterPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      if (signUpError) {
        throw signUpError;
      }
      // Redirect to the intended destination (usually the claim page)
      router.replace(redirectTo as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error during registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-md w-full px-4 sm:px-6 animate-fade-in">
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-3 sm:mb-4">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Create an account</h2>
          <p className="text-slate-400 text-xs sm:text-sm md:text-base">
            Register to claim rigs and manage your Rev Share Racing equipment
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
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-200">Password</span>
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
            <span className="text-sm font-semibold text-slate-200">Confirm Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input"
              placeholder="Re-enter your password"
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
                <span>Creating account…</span>
              </>
            ) : (
              <span>Create account</span>
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
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => router.push(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`)}
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




