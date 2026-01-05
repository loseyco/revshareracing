import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  if (!deviceId) {
    return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  try {
    // Debug: Log the deviceId being queried
    console.log(`[getLapStats] Fetching laps for deviceId: ${deviceId}`);
    
    // Get total lap count
    const { count: totalLaps, error: countError } = await supabase
      .from("irc_laps")
      .select("*", { count: "exact", head: true })
      .eq("device_id", deviceId);

    if (countError) {
      console.error("[getLapStats] countError", countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    
    console.log(`[getLapStats] Total laps found: ${totalLaps}`);

    // Get best lap time
    const { data: bestLap, error: bestLapError } = await supabase
      .from("irc_laps")
      .select("lap_time, lap_number, track_id, car_id, timestamp")
      .eq("device_id", deviceId)
      .not("lap_time", "is", null)
      .order("lap_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (bestLapError && bestLapError.code !== "PGRST116") {
      console.error("[getLapStats] bestLapError", bestLapError);
    }

    // Get recent laps (last 10)
    const { data: recentLaps, error: recentLapsError } = await supabase
      .from("irc_laps")
      .select("lap_id, lap_number, lap_time, track_id, car_id, timestamp, device_id")
      .eq("device_id", deviceId)
      .order("timestamp", { ascending: false })
      .limit(10);

    if (recentLapsError) {
      console.error("[getLapStats] recentLapsError", recentLapsError);
    }
    
    console.log(`[getLapStats] Recent laps found: ${recentLaps?.length || 0}`, recentLaps);

    // Get lap count by track
    const { data: lapsByTrack, error: trackError } = await supabase
      .from("irc_laps")
      .select("track_id")
      .eq("device_id", deviceId)
      .not("track_id", "is", null);

    const trackCounts: Record<string, number> = {};
    if (lapsByTrack) {
      lapsByTrack.forEach((lap) => {
        const track = lap.track_id || "Unknown";
        trackCounts[track] = (trackCounts[track] || 0) + 1;
      });
    }

    return NextResponse.json({
      totalLaps: totalLaps || 0,
      bestLap: bestLap || null,
      recentLaps: recentLaps || [],
      lapsByTrack: trackCounts
    });
  } catch (error) {
    console.error("[getLapStats] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch lap statistics" },
      { status: 500 }
    );
  }
}

