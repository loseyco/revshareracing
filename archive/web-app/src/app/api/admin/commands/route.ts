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
    const status = searchParams.get("status");

    let query = supabase
      .from("irc_device_commands")
      .select("*", { count: "exact" });

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: commands, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[admin/commands] Error fetching commands:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      commands: commands || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error("[admin/commands] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

