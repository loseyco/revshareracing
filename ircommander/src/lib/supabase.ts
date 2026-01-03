import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

/**
 * Create a Supabase client with service role key for server-side operations.
 * This bypasses RLS and should only be used in API routes.
 */
export const createSupabaseServiceClient = (): SupabaseClient =>
  createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

/**
 * Create a Supabase client with anon key for user-authenticated operations.
 */
export const createSupabaseAnonClient = (): SupabaseClient =>
  createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);

