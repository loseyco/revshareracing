import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const lapSchema = z.object({
  user_id: z.string().uuid().optional(),
  driver_name: z.string().optional(),
  lap_time: z.number().positive(),
  lap_number: z.number().int().positive().optional(),
  track_name: z.string(),
  car_name: z.string(),
  session_type: z.string().optional(),
  is_valid: z.boolean().optional().default(true),
  sector_times: z.array(z.number()).optional(),
  incident_count: z.number().int().optional(),
  fuel_used: z.number().optional(),
  tire_wear: z.record(z.number()).optional(),
  weather: z.string().optional(),
  recorded_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const batchLapSchema = z.object({
  laps: z.array(lapSchema).min(1).max(100),
});

/**
 * POST /api/v1/device/laps
 * 
 * Upload lap data from the device.
 * Supports single lap or batch upload.
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
    const body = await request.json();
    
    // Check if batch or single lap
    let lapsToInsert: z.infer<typeof lapSchema>[] = [];
    
    if (body.laps && Array.isArray(body.laps)) {
      // Batch upload
      const validation = batchLapSchema.safeParse(body);
      if (!validation.success) {
        return apiError("Invalid request body", 400, validation.error.errors);
      }
      lapsToInsert = validation.data.laps;
    } else {
      // Single lap
      const validation = lapSchema.safeParse(body);
      if (!validation.success) {
        return apiError("Invalid request body", 400, validation.error.errors);
      }
      lapsToInsert = [validation.data];
    }
    
    const supabase = createSupabaseServiceClient();
    
    // Get tenant from device
    const tenantId = device.assigned_tenant_id || device.company_id;
    
    // Prepare lap records
    const lapRecords = lapsToInsert.map(lap => ({
      device_id: device.device_id,
      user_id: lap.user_id || null,
      driver_name: lap.driver_name || null,
      lap_time: lap.lap_time,
      lap_number: lap.lap_number || null,
      track_name: lap.track_name,
      car_name: lap.car_name,
      session_type: lap.session_type || null,
      is_valid: lap.is_valid ?? true,
      sector_times: lap.sector_times || null,
      incident_count: lap.incident_count || null,
      fuel_used: lap.fuel_used || null,
      tire_wear: lap.tire_wear || null,
      weather: lap.weather || null,
      recorded_at: lap.recorded_at || new Date().toISOString(),
      metadata: lap.metadata || null,
      company_id: tenantId,
    }));
    
    // Insert laps
    const { data: insertedLaps, error: insertError } = await supabase
      .from("irc_laps")
      .insert(lapRecords)
      .select("id, lap_time, track_name, car_name, recorded_at");
    
    if (insertError) {
      console.error("Error inserting laps:", insertError);
      return apiError("Failed to save lap data", 500);
    }
    
    return apiResponse({
      device_id: device.device_id,
      laps_saved: insertedLaps?.length || 0,
      laps: insertedLaps,
    }, 201);
    
  } catch (error) {
    console.error("Lap upload error:", error);
    return apiError("Internal server error", 500);
  }
}

/**
 * GET /api/v1/device/laps
 * 
 * Get recent laps for this device.
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
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    
    // Fetch recent laps
    const { data: laps, error: fetchError } = await supabase
      .from("irc_laps")
      .select("*")
      .eq("device_id", device.device_id)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    
    if (fetchError) {
      console.error("Error fetching laps:", fetchError);
      return apiError("Failed to fetch laps", 500);
    }
    
    return apiResponse({
      device_id: device.device_id,
      count: laps?.length || 0,
      laps: laps || [],
    });
    
  } catch (error) {
    console.error("Get laps error:", error);
    return apiError("Internal server error", 500);
  }
}

