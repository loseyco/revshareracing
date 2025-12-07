import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    // Get user ID from query params (sent by client)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized - userId required" }, { status: 401 });
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

