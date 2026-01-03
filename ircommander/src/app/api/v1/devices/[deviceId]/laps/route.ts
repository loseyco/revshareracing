import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const lapSchema = z.object({
  lap_number: z.number().int().positive(),
  lap_time: z.number().positive().optional(),
  track_id: z.string().optional(),
  car_id: z.string().optional(),
  driver_id: z.string().uuid().optional(),
  telemetry: z.record(z.unknown()).optional()
});

/**
 * GET /api/v1/devices/:deviceId/laps
 * Get lap statistics for a device.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "10");
    
    const supabase = createSupabaseServiceClient();

    // Get total lap count
    const { count: totalLaps } = await supabase
      .from("irc_laps")
      .select("*", { count: "exact", head: true })
      .eq("device_id", deviceId);

    // Get best lap time
    const { data: bestLap } = await supabase
      .from("irc_laps")
      .select("lap_time, lap_number, track_id, car_id, timestamp")
      .eq("device_id", deviceId)
      .not("lap_time", "is", null)
      .order("lap_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get recent laps
    const { data: recentLaps } = await supabase
      .from("irc_laps")
      .select("lap_id, lap_number, lap_time, track_id, car_id, timestamp, driver_id")
      .eq("device_id", deviceId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    // Get lap count by track
    const { data: lapsByTrack } = await supabase
      .from("irc_laps")
      .select("track_id")
      .eq("device_id", deviceId)
      .not("track_id", "is", null);

    const trackCounts: Record<string, number> = {};
    if (lapsByTrack) {
      lapsByTrack.forEach(lap => {
        const track = lap.track_id || "Unknown";
        trackCounts[track] = (trackCounts[track] || 0) + 1;
      });
    }

    return apiSuccess({
      total_laps: totalLaps || 0,
      best_lap: bestLap || null,
      recent_laps: recentLaps || [],
      laps_by_track: trackCounts
    });
  } catch (err) {
    console.error("[laps] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * POST /api/v1/devices/:deviceId/laps
 * Record a new lap for a device.
 * Called by the PC service when a lap is completed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json().catch(() => ({}));

    // Validate input
    const parsed = lapSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const lapData = parsed.data;
    const supabase = createSupabaseServiceClient();

    // Verify device exists
    const { data: device } = await supabase
      .from("irc_devices")
      .select("device_id")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    // Insert lap record
    const { data: lap, error: insertError } = await supabase
      .from("irc_laps")
      .insert({
        device_id: deviceId,
        lap_number: lapData.lap_number,
        lap_time: lapData.lap_time,
        track_id: lapData.track_id,
        car_id: lapData.car_id,
        driver_id: lapData.driver_id,
        telemetry: lapData.telemetry,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("[laps] Insert error:", insertError);
      return ApiErrors.serverError("Failed to record lap");
    }

    return apiSuccess({
      message: "Lap recorded",
      lap
    });
  } catch (err) {
    console.error("[laps] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

