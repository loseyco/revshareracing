import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching and ensure dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();

    // Get counts for all entities
    const [usersCount, devicesCount, commandsCount, lapsCount] = await Promise.all([
      supabase.auth.admin.listUsers().then(r => ({ count: r.data?.users?.length || 0, error: r.error })),
      supabase.from("irc_devices").select("*", { count: "exact", head: true }),
      supabase.from("irc_device_commands").select("*", { count: "exact", head: true }),
      supabase.from("irc_laps").select("*", { count: "exact", head: true })
    ]);

    // Get claimed vs unclaimed devices
    const { count: claimedDevices } = await supabase
      .from("irc_devices")
      .select("*", { count: "exact", head: true })
      .eq("claimed", true);

    const { count: unclaimedDevices } = await supabase
      .from("irc_devices")
      .select("*", { count: "exact", head: true })
      .eq("claimed", false);

    // Get commands by status
    const { count: pendingCommands } = await supabase
      .from("irc_device_commands")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: completedCommands } = await supabase
      .from("irc_device_commands")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    // Get recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: recentLaps } = await supabase
      .from("irc_laps")
      .select("*", { count: "exact", head: true })
      .gte("timestamp", yesterday.toISOString());

    return NextResponse.json({
      users: {
        total: usersCount.count || 0
      },
      devices: {
        total: devicesCount.count || 0,
        claimed: claimedDevices || 0,
        unclaimed: unclaimedDevices || 0
      },
      commands: {
        total: commandsCount.count || 0,
        pending: pendingCommands || 0,
        completed: completedCommands || 0
      },
      laps: {
        total: lapsCount.count || 0,
        last24Hours: recentLaps || 0
      }
    });
  } catch (error) {
    console.error("[admin/stats] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

