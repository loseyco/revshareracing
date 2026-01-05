"use client";

import { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type SupabaseContextValue = {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  session: Session | null;
  loading: boolean;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

const client = createSupabaseBrowserClient();

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Initial session load
    const loadSession = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (mounted) {
          setSession(data.session ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error("[SupabaseProvider] Error loading session:", error);
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      }
    };
    
    loadSession();

    // Listen for auth state changes
    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event, newSession) => {
      console.log("[SupabaseProvider] Auth state changed:", event, newSession ? "session exists" : "no session");
      if (mounted) {
        setSession(newSession ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      supabase: client,
      session,
      loading
    }),
    [session, loading]
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
}




