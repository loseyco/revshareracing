import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["online", "offline", "busy", "maintenance"]).optional(),
  current_user_id: z.string().uuid().nullable().optional(),
  current_driver_name: z.string().nullable().optional(),
  current_car: z.string().nullable().optional(),
  current_track: z.string().nullable().optional(),
  session_type: z.string().nullable().optional(),
  telemetry: z.record(z.unknown()).optional(),
});

/**
 * GET /api/v1/device/status
 * 
 * Get current device status.
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
    
    // Get full device status
    const { data: deviceData, error: fetchError } = await supabase
      .from("irc_devices")
      .select("*")
      .eq("device_id", device.device_id)
      .single();
    
    if (fetchError || !deviceData) {
      return apiError("Device not found", 404);
    }
    
    return apiResponse({
      device_id: deviceData.device_id,
      name: deviceData.name,
      status: deviceData.status,
      current_user_id: deviceData.current_user_id,
      current_driver_name: deviceData.current_driver_name,
      current_car: deviceData.current_car,
      current_track: deviceData.current_track,
      session_type: deviceData.session_type,
      last_seen: deviceData.last_seen,
      owner_type: deviceData.owner_type,
      company_id: deviceData.company_id,
      assigned_tenant_id: deviceData.assigned_tenant_id,
    });
    
  } catch (error) {
    console.error("Get status error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * PUT /api/v1/device/status
 * 
 * Update device status and telemetry.
 * Requires X-Device-Key header for authentication.
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate device
    const deviceResult = await requireDevice(request);
    if (isDeviceError(deviceResult)) {
      return deviceResult;
    }
    
    const { device } = deviceResult;
    
    const body = await request.json();
    const validation = statusSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const updateData = validation.data;
    const supabase = createSupabaseServiceClient();
    
    // Build update object
    const updatePayload: Record<string, unknown> = {
      last_seen: new Date().toISOString(),
    };
    
    if (updateData.status) updatePayload.status = updateData.status;
    if (updateData.current_user_id !== undefined) updatePayload.current_user_id = updateData.current_user_id;
    if (updateData.current_driver_name !== undefined) updatePayload.current_driver_name = updateData.current_driver_name;
    if (updateData.current_car !== undefined) updatePayload.current_car = updateData.current_car;
    if (updateData.current_track !== undefined) updatePayload.current_track = updateData.current_track;
    if (updateData.session_type !== undefined) updatePayload.session_type = updateData.session_type;
    
    // Update device
    const { error: updateError } = await supabase
      .from("irc_devices")
      .update(updatePayload)
      .eq("device_id", device.device_id);
    
    if (updateError) {
      console.error("Error updating device status:", updateError);
      return apiError("Failed to update status", 500);
    }
    
    return apiResponse({
      device_id: device.device_id,
      updated: true,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("Update status error:", error);
    return apiError("Internal server error", 500);
  }
}

