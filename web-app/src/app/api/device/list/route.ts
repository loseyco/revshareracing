import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export async function GET(request: Request) {
  try {
    // Try to get user ID from query params first (sent by client)
    const { searchParams } = new URL(request.url);
    let userId: string | null = searchParams.get("userId");

    // If not in query params, try to get from cookies
    if (!userId) {
      const cookieStore = await cookies();
      
      try {
        const supabaseClient = createClient(
          serverEnv.NEXT_PUBLIC_SUPABASE_URL,
          serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll().map(cookie => ({
                  name: cookie.name,
                  value: cookie.value
                }));
              },
              set() {},
              remove() {}
            }
          }
        );

        const {
          data: { user },
          error: authError
        } = await supabaseClient.auth.getUser();
        
        if (authError) {
          console.warn("[listDevices] Auth error:", authError);
        } else {
          userId = user?.id ?? null;
        }
      } catch (error) {
        console.warn("[listDevices] Could not get user from session:", error);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServiceClient();

    // Get all devices owned by this user
    const { data: devices, error: fetchError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, status, location, local_ip, public_ip, claimed, last_seen, updated_at")
      .eq("owner_user_id", userId)
      .eq("claimed", true)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      console.error("[listDevices] fetchError", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ devices: devices || [] });
  } catch (error) {
    console.error("[listDevices] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

