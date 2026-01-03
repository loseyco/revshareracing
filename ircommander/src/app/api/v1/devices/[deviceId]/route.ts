import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/devices/:deviceId
 * Get detailed information about a specific device.
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
      console.error("[device] Error fetching device:", error);
      return ApiErrors.serverError("Failed to fetch device");
    }

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    // Calculate online status
    // A device is only considered online if:
    // 1. last_seen exists (not null)
    // 2. last_seen is within the last 30 seconds (stricter threshold)
    let timeSinceLastSeen = Infinity;
    let isOnline = false;
    let isDataFresh = false;
    
    if (device.last_seen) {
      const lastSeen = new Date(device.last_seen).getTime();
      timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
      // Stricter threshold: must be seen within 30 seconds
      isOnline = timeSinceLastSeen >= 0 && timeSinceLastSeen < 30;
      isDataFresh = timeSinceLastSeen < 300;
    }

    // Determine iRacing connection status
    // Only trust iRacing connection status if device is actually online
    // If device is offline, iRacing cannot be connected
    let iracingConnected = false;
    if (isOnline) {
      // Only check iRacing status if device is online
      if (device.iracing_connected !== undefined && device.iracing_connected !== null) {
        iracingConnected = Boolean(device.iracing_connected);
      } else if (device.status === "active") {
        iracingConnected = true;
      }
    }
    // If device is offline, iracingConnected remains false

    return apiSuccess({
      device: {
        device_id: device.device_id,
        name: device.name,
        status: device.status,
        location: device.location,
        local_ip: device.local_ip,
        public_ip: device.public_ip,
        claimed: device.claimed,
        owner_user_id: device.owner_user_id,
        company_id: device.company_id,
        owner_type: device.owner_type,
        assigned_tenant_id: device.assigned_tenant_id,
        hardware_id: device.hardware_id,
        last_seen: device.last_seen,
        updated_at: device.updated_at,
        created_at: device.created_at,
        // Computed fields
        is_online: isOnline,
        iracing_connected: iracingConnected,
        time_since_last_seen: timeSinceLastSeen === Infinity ? null : Math.floor(timeSinceLastSeen),
        // Telemetry (if available and fresh)
        telemetry: (isDataFresh && iracingConnected) ? {
          speed_kph: device.speed_kph ?? null,
          rpm: device.rpm ?? null,
          track_name: device.track_name ?? null,
          car_name: device.car_name ?? null,
          current_lap: device.current_lap ?? null,
          in_car: device.in_car ?? null,
          engine_running: device.engine_running ?? null,
          in_pit_stall: device.in_pit_stall ?? null
        } : null,
        pc_service_version: device.pc_service_version ?? null,
        // System information
        system_info: {
          os_name: device.os_name ?? null,
          os_version: device.os_version ?? null,
          os_arch: device.os_arch ?? null,
          cpu_name: device.cpu_name ?? null,
          cpu_count: device.cpu_count ?? null,
          cpu_cores: device.cpu_cores ?? null,
          ram_total_gb: device.ram_total_gb ?? null,
          ram_available_gb: device.ram_available_gb ?? null,
          ram_used_percent: device.ram_used_percent ?? null,
          gpu_name: device.gpu_name ?? null,
          disk_total_gb: device.disk_total_gb ?? null,
          disk_used_gb: device.disk_used_gb ?? null,
          disk_free_gb: device.disk_free_gb ?? null,
          disk_used_percent: device.disk_used_percent ?? null,
          disk_low_space: device.disk_low_space ?? null,
          iracing_process_running: device.iracing_process_running ?? null,
          iracing_processes: device.iracing_processes ?? null,
          python_version: device.python_version ?? null,
        }
      }
    });
  } catch (err) {
    console.error("[device] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

