import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching and ensure dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type LeaderboardEntry = {
  track_id: string;
  track_config: string | null;
  car_id: string;
  best_lap_time: number;
  lap_count: number;
  best_lap_timestamp: string;
  best_lap_device_id: string;
  device_name: string | null;
  driver_id: string | null;
  driver_email: string | null;
  driver_name: string | null;
};

// Helper function to extract name from email or user metadata
function getDriverName(user: any, email: string | null): string | null {
  if (!user) return null;
  
  // Try to get name from user_metadata
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  if (metadata.full_name) return metadata.full_name;
  if (metadata.name) return metadata.name;
  if (metadata.display_name) return metadata.display_name;
  
  // Fallback: extract name from email (username part before @)
  if (email) {
    const emailParts = email.split('@');
    if (emailParts[0]) {
      // Capitalize first letter and replace dots/underscores with spaces
      const username = emailParts[0]
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      return username;
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const trackId = searchParams.get("trackId");
    const carId = searchParams.get("carId");

    // Fetch all laps with valid lap times
    let query = supabase
      .from("irc_laps")
      .select("lap_id, lap_time, track_id, car_id, timestamp, device_id, driver_id, telemetry")
      .not("lap_time", "is", null)
      .not("track_id", "is", null)
      .not("car_id", "is", null);

    if (trackId) {
      query = query.eq("track_id", trackId);
    }

    if (carId) {
      query = query.eq("car_id", carId);
    }

    const { data: laps, error } = await query.order("timestamp", { ascending: false });

    if (error) {
      console.error("[leaderboards] Error fetching laps:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!laps || laps.length === 0) {
      return NextResponse.json({ leaderboards: [] });
    }

    // Get unique device IDs from laps
    const deviceIds = Array.from(new Set(
      laps
        .map(lap => lap.device_id)
        .filter((id): id is string => id !== null && id !== undefined)
    ));

    // Fetch device information (device_name and owner_user_id)
    let deviceMap: Map<string, { device_name: string | null; owner_user_id: string | null }> = new Map();
    if (deviceIds.length > 0) {
      const { data: devices, error: devicesError } = await supabase
        .from("irc_devices")
        .select("device_id, device_name, owner_user_id")
        .in("device_id", deviceIds);

      if (!devicesError && devices) {
        devices.forEach((device: any) => {
          deviceMap.set(device.device_id, {
            device_name: device.device_name,
            owner_user_id: device.owner_user_id,
          });
        });
      }
    }

    // Get unique driver IDs from laps (including device owners as fallback)
    const driverIdsFromLaps = Array.from(new Set(
      laps
        .map(lap => lap.driver_id)
        .filter((id): id is string => id !== null && id !== undefined)
    ));

    // Also get owner_user_ids from devices as potential driver IDs
    const ownerUserIds = Array.from(new Set(
      Array.from(deviceMap.values())
        .map(device => device.owner_user_id)
        .filter((id): id is string => id !== null && id !== undefined)
    ));

    // Combine both sets of user IDs
    const allDriverIds = Array.from(new Set([...driverIdsFromLaps, ...ownerUserIds]));

    // Fetch user profiles for all potential driver IDs
    let driverProfiles: Map<string, { email: string }> = new Map();
    if (allDriverIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("irc_user_profiles")
        .select("id, email")
        .in("id", allDriverIds);

      if (!profilesError && profiles) {
        profiles.forEach((profile: any) => {
          driverProfiles.set(profile.id, { email: profile.email });
        });
      }
    }

    // Fetch auth users to get names from metadata
    let authUsersMap: Map<string, any> = new Map();
    if (allDriverIds.length > 0) {
      try {
        // Fetch users in batches (Supabase admin API has limits)
        const batchSize = 100;
        for (let i = 0; i < allDriverIds.length; i += batchSize) {
          const batch = allDriverIds.slice(i, i + batchSize);
          // Get users by fetching all and filtering (admin API doesn't support filtering by ID list)
          const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000
          });

          if (!usersError && usersData?.users) {
            usersData.users.forEach((user: any) => {
              if (batch.includes(user.id)) {
                authUsersMap.set(user.id, user);
              }
            });
          }
        }
      } catch (error) {
        console.error("[leaderboards] Error fetching auth users:", error);
        // Continue without auth user data
      }
    }

    // Group laps by track_id, track_config, and car_id
    const leaderboardMap = new Map<string, LeaderboardEntry>();

    for (const lap of laps) {
      // Extract track_config from telemetry
      let trackConfig: string | null = null;
      if (lap.telemetry && typeof lap.telemetry === 'object') {
        trackConfig = (lap.telemetry as any).track_config || null;
      }

      // Create a unique key for this combination
      const key = `${lap.track_id}|||${trackConfig || 'default'}|||${lap.car_id}`;

      if (!leaderboardMap.has(key)) {
        // Try to get driver from lap.driver_id, fallback to device owner
        const deviceInfo = deviceMap.get(lap.device_id);
        const effectiveDriverId = lap.driver_id || deviceInfo?.owner_user_id || null;
        const driverProfile = effectiveDriverId ? driverProfiles.get(effectiveDriverId) : null;
        const authUser = effectiveDriverId ? authUsersMap.get(effectiveDriverId) : null;
        const driverName = getDriverName(authUser, driverProfile?.email || null);
        
        leaderboardMap.set(key, {
          track_id: lap.track_id!,
          track_config: trackConfig,
          car_id: lap.car_id!,
          best_lap_time: lap.lap_time!,
          lap_count: 1,
          best_lap_timestamp: lap.timestamp,
          best_lap_device_id: lap.device_id,
          device_name: deviceInfo?.device_name || null,
          driver_id: effectiveDriverId,
          driver_email: driverProfile?.email || null,
          driver_name: driverName,
        });
      } else {
        const entry = leaderboardMap.get(key)!;
        entry.lap_count += 1;
        
        // Update best lap if this one is faster
        if (lap.lap_time! < entry.best_lap_time) {
          // Try to get driver from lap.driver_id, fallback to device owner
          const deviceInfo = deviceMap.get(lap.device_id);
          const effectiveDriverId = lap.driver_id || deviceInfo?.owner_user_id || null;
          const driverProfile = effectiveDriverId ? driverProfiles.get(effectiveDriverId) : null;
          const authUser = effectiveDriverId ? authUsersMap.get(effectiveDriverId) : null;
          const driverName = getDriverName(authUser, driverProfile?.email || null);
          
          entry.best_lap_time = lap.lap_time!;
          entry.best_lap_timestamp = lap.timestamp;
          entry.best_lap_device_id = lap.device_id;
          entry.device_name = deviceInfo?.device_name || null;
          entry.driver_id = effectiveDriverId;
          entry.driver_email = driverProfile?.email || null;
          entry.driver_name = driverName;
        }
      }
    }

    // Convert map to array and sort by best lap time (ascending)
    const leaderboards = Array.from(leaderboardMap.values()).sort(
      (a, b) => a.best_lap_time - b.best_lap_time
    );

    return NextResponse.json({
      leaderboards,
      total: leaderboards.length,
    });
  } catch (error) {
    console.error("[leaderboards] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

