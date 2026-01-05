"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { clientEnv } from "./env";

export const createSupabaseBrowserClient = () =>
  createClientComponentClient({
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

