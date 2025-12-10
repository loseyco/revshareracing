import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching and ensure dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const deviceId = searchParams.get("deviceId");
    const trackId = searchParams.get("trackId");

    let query = supabase
      .from("irc_laps")
      .select("*", { count: "exact" });

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    if (trackId) {
      query = query.eq("track_id", trackId);
    }

    const { data: laps, error, count } = await query
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[admin/laps] Error fetching laps:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      laps: laps || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error("[admin/laps] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

