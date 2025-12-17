import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/device/[deviceId]/status
 * Get iRacing connection status and car state for a device
 * This queries the device's last known status from Supabase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    // Get device info including iRacing connection status, car state, and telemetry
    // Use .maybeSingle() to avoid caching issues and ensure fresh data
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, status, last_seen, claimed, iracing_connected, in_car, speed_kph, rpm, track_name, car_name, current_lap, in_pit_stall, engine_running, pc_service_version")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Check if device is claimed
    if (!device.claimed) {
      return NextResponse.json({
        iracingConnected: false,
        canExecuteCommands: false,
        reason: "Device not claimed",
        carState: {
          inCar: null,
          engineRunning: null,
        },
        telemetry: null,
      });
    }

    // Check last_seen to determine if PC service is running
    // If last_seen is more than 60 seconds ago, assume offline
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
    const isServiceOnline = timeSinceLastSeen < 60;
    
    // Consider data "fresh" if it's less than 5 minutes old (for displaying last known state)
    const isDataFresh = timeSinceLastSeen < 300; // 5 minutes

    // Debug logging
    console.log(`[getDeviceStatus] deviceId=${deviceId}`);
    console.log(`[getDeviceStatus] last_seen=${device.last_seen}, timeSinceLastSeen=${timeSinceLastSeen.toFixed(1)}s, isServiceOnline=${isServiceOnline}`);
    console.log(`[getDeviceStatus] iracing_connected from DB: ${device.iracing_connected} (type: ${typeof device.iracing_connected}), status: ${device.status}`);

    // Use actual iRacing connection status from PC service ONLY if service is online
    // If service is offline, we can't trust the iracing_connected value (it's stale)
    // Fall back to inferring from status if column doesn't exist yet
    // Explicitly convert to boolean to handle any type issues
    let iracingConnected = false;
    if (isServiceOnline) {
      if (device.iracing_connected !== undefined && device.iracing_connected !== null) {
        iracingConnected = Boolean(device.iracing_connected);
      } else if (device.status === "active") {
        iracingConnected = true;
      }
    }
    // If service is offline, iracingConnected stays false
    
    console.log(`[getDeviceStatus] Final iracingConnected: ${iracingConnected}, canExecuteCommands: ${iracingConnected}`);
    
    // Get car state and telemetry from database (updated by PC service heartbeat)
    // Return the actual value if data is fresh (even if service appears offline)
    // This allows showing last known state when service is temporarily offline
    const inCar = (isDataFresh && iracingConnected)
      ? (device.in_car !== null && device.in_car !== undefined ? device.in_car : null)
      : null;
    
    // Always return telemetry structure if data is fresh and iRacing is/was connected
    // This allows the webpage to show last known telemetry even if service is temporarily offline
    // Include speed even if it's 0 (car might be stationary)
    const telemetry = (isDataFresh && iracingConnected) ? {
      speedKph: device.speed_kph !== null && device.speed_kph !== undefined ? device.speed_kph : null,
      rpm: device.rpm !== null && device.rpm !== undefined ? device.rpm : null,
      trackName: device.track_name || null,
      carName: device.car_name || null,
      currentLap: device.current_lap !== null && device.current_lap !== undefined && device.current_lap > 0 ? device.current_lap : null,
      inPitStall: device.in_pit_stall !== null && device.in_pit_stall !== undefined ? device.in_pit_stall : null,
      engineRunning: device.engine_running !== null && device.engine_running !== undefined ? device.engine_running : null,
    } : null;
    
    // Debug logging
    console.log(`[getDeviceStatus] Telemetry:`, {
      hasTelemetry: !!telemetry,
      speedKph: telemetry?.speedKph,
      inCar: inCar,
      isDataFresh,
      iracingConnected,
      speed_kph_from_db: device.speed_kph
    });
    
    return NextResponse.json({
      iracingConnected: iracingConnected,
      canExecuteCommands: iracingConnected,
      reason: !isServiceOnline 
        ? "PC service offline (not seen recently)" 
        : !iracingConnected
        ? "iRacing not connected (make sure iRacing is in a session, not just the UI)"
        : null,
      carState: {
        inCar: inCar,
        engineRunning: device.engine_running !== null && device.engine_running !== undefined ? device.engine_running : null,
      },
      telemetry: telemetry,
      lastSeen: device.last_seen,
      timeSinceLastSeen: timeSinceLastSeen,
      pcServiceVersion: device.pc_service_version || null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

