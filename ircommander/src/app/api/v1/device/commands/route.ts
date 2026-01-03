import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";

/**
 * GET /api/v1/device/commands
 * 
 * Poll for pending commands for this device.
 * Requires X-Device-Key header for authentication.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate device
    const deviceResult = await requireDevice(request);
    if (isDeviceError(deviceResult)) {
      return deviceResult;
    }
    
    const { device } = deviceResult;
    const supabase = createSupabaseServiceClient();
    
    // Fetch pending commands
    const { data: commands, error: fetchError } = await supabase
      .from("irc_device_commands")
      .select("*")
      .eq("device_id", device.device_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);
    
    if (fetchError) {
      console.error("Error fetching commands:", fetchError);
      return apiError("Failed to fetch commands", 500);
    }
    
    return apiResponse({
      device_id: device.device_id,
      count: commands?.length || 0,
      commands: commands || [],
    });
    
  } catch (error) {
    console.error("Get commands error:", error);
    return apiError("Internal server error", 500);
  }
}

