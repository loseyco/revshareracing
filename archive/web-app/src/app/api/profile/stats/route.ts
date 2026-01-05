import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/profile/stats - Get current user's statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = user.id;

    // Get devices owned by this user
    const { data: ownedDevices, error: devicesError } = await supabase
      .from("irc_devices")
      .select("device_id")
      .eq("owner_user_id", userId);

    if (devicesError) {
      console.error("[profile/stats] Error fetching owned devices:", devicesError);
    }

    const ownedDeviceIds = ownedDevices?.map(d => d.device_id) || [];

    // Get laps where driver_id matches the user
    const { data: driverLaps, error: driverLapsError } = await supabase
      .from("irc_laps")
      .select("lap_id, lap_time, lap_number, track_id, car_id, timestamp, device_id, driver_id")
      .eq("driver_id", userId)
      .not("lap_time", "is", null);

    if (driverLapsError) {
      console.error("[profile/stats] Error fetching driver laps:", driverLapsError);
    }

    // Get laps from owned devices where driver_id is null (fallback to owner)
    let ownedDeviceLaps: any[] = [];
    if (ownedDeviceIds.length > 0) {
      const { data: deviceLaps, error: deviceLapsError } = await supabase
        .from("irc_laps")
        .select("lap_id, lap_time, lap_number, track_id, car_id, timestamp, device_id, driver_id")
        .in("device_id", ownedDeviceIds)
        .is("driver_id", null)
        .not("lap_time", "is", null);

      if (deviceLapsError) {
        console.error("[profile/stats] Error fetching device laps:", deviceLapsError);
      } else {
        ownedDeviceLaps = deviceLaps || [];
      }
    }

    // Combine both sets of laps (driver_id matches OR owned device with null driver_id)
    const userLaps = [
      ...(driverLaps || []),
      ...ownedDeviceLaps
    ];

    // Calculate statistics
    const totalLaps = userLaps.length;
    
    // Best lap time
    let bestLap = null;
    if (userLaps.length > 0) {
      const sortedLaps = [...userLaps].sort((a, b) => a.lap_time - b.lap_time);
      bestLap = {
        lap_time: sortedLaps[0].lap_time,
        lap_number: sortedLaps[0].lap_number,
        track_id: sortedLaps[0].track_id || null,
        car_id: sortedLaps[0].car_id || null,
        timestamp: sortedLaps[0].timestamp,
        device_id: sortedLaps[0].device_id
      };
    }

    // Recent laps (last 10)
    const recentLaps = userLaps
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(lap => ({
        lap_id: lap.lap_id,
        lap_number: lap.lap_number,
        lap_time: lap.lap_time,
        track_id: lap.track_id || null,
        car_id: lap.car_id || null,
        timestamp: lap.timestamp,
        device_id: lap.device_id
      }));

    // Laps by track
    const lapsByTrack: Record<string, number> = {};
    userLaps.forEach(lap => {
      const track = lap.track_id || "Unknown";
      lapsByTrack[track] = (lapsByTrack[track] || 0) + 1;
    });

    // Laps by car
    const lapsByCar: Record<string, number> = {};
    userLaps.forEach(lap => {
      const car = lap.car_id || "Unknown";
      lapsByCar[car] = (lapsByCar[car] || 0) + 1;
    });

    // Average lap time
    let averageLapTime = null;
    if (userLaps.length > 0) {
      const totalTime = userLaps.reduce((sum, lap) => sum + lap.lap_time, 0);
      averageLapTime = totalTime / userLaps.length;
    }

    // Laps in last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentLapsCount = userLaps.filter(
      lap => new Date(lap.timestamp) >= yesterday
    ).length;

    // Laps in last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const weekLapsCount = userLaps.filter(
      lap => new Date(lap.timestamp) >= lastWeek
    ).length;

    // Get device names for owned devices
    const deviceNames: Record<string, string> = {};
    if (ownedDeviceIds.length > 0) {
      const { data: devices } = await supabase
        .from("irc_devices")
        .select("device_id, device_name")
        .in("device_id", ownedDeviceIds);
      
      devices?.forEach(device => {
        deviceNames[device.device_id] = device.device_name || "Unnamed Device";
      });
    }

    return NextResponse.json({
      totalLaps,
      bestLap,
      recentLaps,
      lapsByTrack,
      lapsByCar,
      averageLapTime,
      recentLapsCount, // Last 24 hours
      weekLapsCount, // Last 7 days
      ownedDevicesCount: ownedDeviceIds.length,
      deviceNames
    });
  } catch (error) {
    console.error("[profile/stats] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

