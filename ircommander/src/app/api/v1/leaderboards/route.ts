import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LeaderboardEntry {
  track_id: string;
  track_config: string | null;
  car_id: string;
  best_lap_time: number;
  lap_count: number;
  best_lap_timestamp: string;
  device_id: string;
  device_name: string | null;
  driver_id: string | null;
  driver_name: string | null;
}

/**
 * GET /api/v1/leaderboards
 * Get leaderboard data grouped by track/car combinations.
 * 
 * Query params:
 * - trackId: Filter by track (optional)
 * - carId: Filter by car (optional)
 * - limit: Maximum entries to return (optional, default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const trackId = searchParams.get("trackId");
    const carId = searchParams.get("carId");
    const limit = parseInt(searchParams.get("limit") || "100");

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
      return ApiErrors.serverError("Failed to fetch lap data");
    }

    if (!laps || laps.length === 0) {
      return apiSuccess({ leaderboards: [], total: 0 });
    }

    // Get device info
    const deviceIds = Array.from(new Set(laps.map(l => l.device_id).filter(Boolean)));
    const deviceMap = new Map<string, { device_name: string | null; owner_user_id: string | null }>();
    
    if (deviceIds.length > 0) {
      const { data: devices } = await supabase
        .from("irc_devices")
        .select("device_id, device_name, owner_user_id")
        .in("device_id", deviceIds);

      devices?.forEach(d => {
        deviceMap.set(d.device_id, {
          device_name: d.device_name,
          owner_user_id: d.owner_user_id
        });
      });
    }

    // Get driver profiles
    const driverIds = Array.from(new Set([
      ...laps.map(l => l.driver_id).filter(Boolean),
      ...Array.from(deviceMap.values()).map(d => d.owner_user_id).filter(Boolean)
    ])) as string[];

    const driverMap = new Map<string, string>();
    
    if (driverIds.length > 0) {
      const { data: profiles } = await supabase
        .from("irc_user_profiles")
        .select("id, display_name, email")
        .in("id", driverIds);

      profiles?.forEach(p => {
        driverMap.set(p.id, p.display_name || p.email?.split("@")[0] || "Unknown");
      });
    }

    // Group laps by track/car combination
    const leaderboardMap = new Map<string, LeaderboardEntry>();

    for (const lap of laps) {
      const trackConfig = (lap.telemetry as Record<string, unknown>)?.track_config as string || null;
      const key = `${lap.track_id}|||${trackConfig || "default"}|||${lap.car_id}`;

      const deviceInfo = deviceMap.get(lap.device_id);
      const effectiveDriverId = lap.driver_id || deviceInfo?.owner_user_id || null;
      const driverName = effectiveDriverId ? driverMap.get(effectiveDriverId) || null : null;

      if (!leaderboardMap.has(key)) {
        leaderboardMap.set(key, {
          track_id: lap.track_id!,
          track_config: trackConfig,
          car_id: lap.car_id!,
          best_lap_time: lap.lap_time!,
          lap_count: 1,
          best_lap_timestamp: lap.timestamp,
          device_id: lap.device_id,
          device_name: deviceInfo?.device_name || null,
          driver_id: effectiveDriverId,
          driver_name: driverName
        });
      } else {
        const entry = leaderboardMap.get(key)!;
        entry.lap_count += 1;

        if (lap.lap_time! < entry.best_lap_time) {
          entry.best_lap_time = lap.lap_time!;
          entry.best_lap_timestamp = lap.timestamp;
          entry.device_id = lap.device_id;
          entry.device_name = deviceInfo?.device_name || null;
          entry.driver_id = effectiveDriverId;
          entry.driver_name = driverName;
        }
      }
    }

    // Sort by best lap time and limit results
    const leaderboards = Array.from(leaderboardMap.values())
      .sort((a, b) => a.best_lap_time - b.best_lap_time)
      .slice(0, limit);

    return apiSuccess({
      leaderboards,
      total: leaderboards.length
    });
  } catch (err) {
    console.error("[leaderboards] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

