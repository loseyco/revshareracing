import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LapRecord {
  id: string;
  lap_time: number;
  track_name: string;
  car_name: string;
  driver_name: string | null;
  recorded_at: string;
  device_id: string;
}

interface TrackRecord {
  track_name: string;
  best_lap_time: number;
  car_name: string;
  driver_name: string | null;
  recorded_at: string;
  lap_count: number;
}

interface CarLayoutRecord {
  track_name: string;
  car_name: string;
  best_lap_time: number;
  driver_name: string | null;
  recorded_at: string;
  lap_count: number;
}

/**
 * GET /api/v1/stats/laps
 * Get comprehensive lap statistics including latest laps, fastest laps, track records, and car layout records.
 * Requires user authentication.
 * 
 * Query params:
 * - limit: Number of latest laps to return (default: 20)
 * - fastestLimit: Number of fastest laps to return (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authenticated user
    const userResult = await requireUser(request);
    if (isUserError(userResult)) {
      return userResult;
    }

    const { userId } = userResult;
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "20");
    const fastestLimit = parseInt(searchParams.get("fastestLimit") || "10");

    // Build base query - irc_laps table doesn't have company_id, so we fetch all laps
    let query = supabase
      .from("irc_laps")
      .select("lap_id, lap_time, track_id, car_id, driver_id, timestamp, device_id")
      .not("lap_time", "is", null)
      .order("timestamp", { ascending: false });

    // Get all valid laps
    const { data: allLaps, error: lapsError } = await query;

    if (lapsError) {
      console.error("[stats/laps] Error fetching laps:", lapsError);
      return ApiErrors.serverError("Failed to fetch lap data");
    }

    if (!allLaps || allLaps.length === 0) {
      return apiSuccess({
        latest_laps: [],
        fastest_laps: [],
        track_records: [],
        car_layout_records: [],
      });
    }

    // Get device names for display
    const deviceIds = Array.from(new Set(allLaps.map(l => l.device_id).filter(Boolean)));
    const deviceMap = new Map<string, string>();
    
    if (deviceIds.length > 0) {
      const { data: devices } = await supabase
        .from("irc_devices")
        .select("device_id, name")
        .in("device_id", deviceIds);

      devices?.forEach(d => {
        deviceMap.set(d.device_id, d.name || d.device_id);
      });
    }

    // 1. Latest laps (most recent)
    const latestLaps: LapRecord[] = allLaps
      .slice(0, limit)
      .map(lap => ({
        id: lap.lap_id,
        lap_time: lap.lap_time,
        track_name: lap.track_id || "Unknown Track",
        car_name: lap.car_id || "Unknown Car",
        driver_name: lap.driver_id || null,
        recorded_at: lap.timestamp,
        device_id: lap.device_id,
      }));

    // 2. Fastest laps (overall best times)
    const fastestLaps: LapRecord[] = allLaps
      .sort((a, b) => a.lap_time - b.lap_time)
      .slice(0, fastestLimit)
      .map(lap => ({
        id: lap.lap_id,
        lap_time: lap.lap_time,
        track_name: lap.track_id || "Unknown Track",
        car_name: lap.car_id || "Unknown Car",
        driver_name: lap.driver_id || null,
        recorded_at: lap.timestamp,
        device_id: lap.device_id,
      }));

    // 3. Track records (best lap per track)
    const trackRecordMap = new Map<string, TrackRecord>();
    
    for (const lap of allLaps) {
      const trackName = lap.track_id || "Unknown Track";
      
      if (!trackRecordMap.has(trackName)) {
        trackRecordMap.set(trackName, {
          track_name: trackName,
          best_lap_time: lap.lap_time,
          car_name: lap.car_id || "Unknown Car",
          driver_name: lap.driver_id || null,
          recorded_at: lap.timestamp,
          lap_count: 1,
        });
      } else {
        const record = trackRecordMap.get(trackName)!;
        record.lap_count += 1;
        
        if (lap.lap_time < record.best_lap_time) {
          record.best_lap_time = lap.lap_time;
          record.car_name = lap.car_id || "Unknown Car";
          record.driver_name = lap.driver_id || null;
          record.recorded_at = lap.timestamp;
        }
      }
    }

    const trackRecords: TrackRecord[] = Array.from(trackRecordMap.values())
      .sort((a, b) => a.best_lap_time - b.best_lap_time);

    // 4. Car layout records (best lap per track+car combination)
    const carLayoutRecordMap = new Map<string, CarLayoutRecord>();
    
    for (const lap of allLaps) {
      const trackName = lap.track_id || "Unknown Track";
      const carName = lap.car_id || "Unknown Car";
      const key = `${trackName}|||${carName}`;
      
      if (!carLayoutRecordMap.has(key)) {
        carLayoutRecordMap.set(key, {
          track_name: trackName,
          car_name: carName,
          best_lap_time: lap.lap_time,
          driver_name: lap.driver_id || null,
          recorded_at: lap.timestamp,
          lap_count: 1,
        });
      } else {
        const record = carLayoutRecordMap.get(key)!;
        record.lap_count += 1;
        
        if (lap.lap_time < record.best_lap_time) {
          record.best_lap_time = lap.lap_time;
          record.driver_name = lap.driver_id || null;
          record.recorded_at = lap.timestamp;
        }
      }
    }

    const carLayoutRecords: CarLayoutRecord[] = Array.from(carLayoutRecordMap.values())
      .sort((a, b) => a.best_lap_time - b.best_lap_time);

    return apiSuccess({
      latest_laps: latestLaps,
      fastest_laps: fastestLaps,
      track_records: trackRecords,
      car_layout_records: carLayoutRecords,
    });
  } catch (err) {
    console.error("[stats/laps] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
