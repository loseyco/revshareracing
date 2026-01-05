import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/admin/laps
 * Get all laps (admin only)
 * 
 * Query params:
 * - limit: Number of laps to return (default: 100)
 * - offset: Offset for pagination (default: 0)
 * - device_id: Filter by device ID (optional)
 * - track_name: Filter by track name (optional)
 * - car_name: Filter by car name (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const adminResult = await requireAdmin(request);
    if (isAdminError(adminResult)) {
      return adminResult;
    }

    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");
    const deviceId = searchParams.get("device_id");
    const trackName = searchParams.get("track_name");
    const carName = searchParams.get("car_name");

    // Build query
    let query = supabase
      .from("irc_laps")
      .select("lap_id, device_id, driver_id, lap_time, lap_number, track_id, car_id, telemetry, timestamp")
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }
    if (trackName) {
      query = query.eq("track_id", trackName);
    }
    if (carName) {
      query = query.eq("car_id", carName);
    }

    const { data: laps, error } = await query;

    if (error) {
      console.error("[admin/laps] Error fetching laps:", error);
      return ApiErrors.serverError("Failed to fetch laps");
    }

    // Get device names for display
    const deviceIds = Array.from(new Set(laps?.map(l => l.device_id).filter(Boolean) || []));
    const deviceMap = new Map<string, string>();
    
    if (deviceIds.length > 0) {
      const { data: devices } = await supabase
        .from("irc_devices")
        .select("device_id, name, device_name")
        .in("device_id", deviceIds);

      devices?.forEach(d => {
        deviceMap.set(d.device_id, d.name || d.device_name || d.device_id);
      });
    }

    // Add device names to laps
    const lapsWithDeviceNames = laps?.map(lap => ({
      ...lap,
      device_name: deviceMap.get(lap.device_id) || lap.device_id,
    })) || [];

    // Get total count for pagination
    let countQuery = supabase
      .from("irc_laps")
      .select("*", { count: "exact", head: true });

    if (deviceId) {
      countQuery = countQuery.eq("device_id", deviceId);
    }
    if (trackName) {
      countQuery = countQuery.eq("track_id", trackName);
    }
    if (carName) {
      countQuery = countQuery.eq("car_id", carName);
    }

    const { count: totalCount } = await countQuery;

    return apiSuccess({
      laps: lapsWithDeviceNames,
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[admin/laps] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
