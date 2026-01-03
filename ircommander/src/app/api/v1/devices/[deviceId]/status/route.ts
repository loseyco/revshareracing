import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/devices/:deviceId/status
 * Get real-time status of a device including iRacing connection and telemetry.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: device, error } = await supabase
      .from("irc_devices")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) {
      console.error("[device/status] Error:", error);
      return ApiErrors.serverError("Database error");
    }

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    if (!device.claimed) {
      return apiSuccess({
        is_service_online: false,
        iracing_connected: false,
        can_execute_commands: false,
        reason: "Device not claimed",
        car_state: { in_car: null, engine_running: null },
        telemetry: null
      });
    }

    // Calculate service status
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000;
    const isServiceOnline = timeSinceLastSeen < 60;
    const isDataFresh = timeSinceLastSeen < 300;

    // Determine iRacing connection (only trust if service is online)
    let iracingConnected = false;
    if (isServiceOnline) {
      if (device.iracing_connected !== undefined && device.iracing_connected !== null) {
        iracingConnected = Boolean(device.iracing_connected);
      } else if (device.status === "active") {
        iracingConnected = true;
      }
    }

    const canExecuteCommands = isServiceOnline;

    // Build telemetry response
    const telemetry = (isDataFresh && iracingConnected) ? {
      speed_kph: device.speed_kph ?? null,
      rpm: device.rpm ?? null,
      track_name: device.track_name ?? null,
      car_name: device.car_name ?? null,
      current_lap: (device.current_lap && device.current_lap > 0) ? device.current_lap : null,
      in_pit_stall: device.in_pit_stall ?? null,
      engine_running: device.engine_running ?? null
    } : null;

    return apiSuccess({
      is_service_online: isServiceOnline,
      iracing_connected: iracingConnected,
      can_execute_commands: canExecuteCommands,
      reason: !isServiceOnline 
        ? "PC service offline (not seen recently)"
        : !iracingConnected
        ? "iRacing not connected"
        : null,
      car_state: {
        in_car: (isDataFresh && iracingConnected) ? device.in_car : null,
        engine_running: device.engine_running ?? null
      },
      telemetry,
      last_seen: device.last_seen,
      time_since_last_seen: Math.floor(timeSinceLastSeen),
      pc_service_version: device.pc_service_version ?? null
    });
  } catch (err) {
    console.error("[device/status] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

