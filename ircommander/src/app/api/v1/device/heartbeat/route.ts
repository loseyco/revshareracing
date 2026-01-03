import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";

/**
 * POST /api/v1/device/heartbeat
 * 
 * Update device online status and heartbeat timestamp.
 * Requires X-Device-Key header for authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate device
    const deviceResult = await requireDevice(request);
    if (isDeviceError(deviceResult)) {
      return deviceResult;
    }
    
    const { device } = deviceResult;
    const supabase = createSupabaseServiceClient();
    
    // Update device status and heartbeat
    const { error: updateError } = await supabase
      .from("irc_devices")
      .update({
        status: "online",
        last_seen: new Date().toISOString(),
      })
      .eq("device_id", device.device_id);
    
    if (updateError) {
      console.error("Error updating device heartbeat:", updateError);
      return apiError("Failed to update heartbeat", 500);
    }
    
    // Return current device info
    return apiResponse({
      device_id: device.device_id,
      status: "online",
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("Heartbeat error:", error);
    return apiError("Internal server error", 500);
  }
}

