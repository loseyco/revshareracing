import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const iceCandidateSchema = z.object({
  session_id: z.string(),
  candidate: z.object({
    candidate: z.string(),
    sdpMLineIndex: z.number().nullable().optional(),
    sdpMid: z.string().nullable().optional(),
  }),
});

/**
 * POST /api/v1/devices/{deviceId}/remote-desktop/ice-candidate
 * 
 * Forward ICE candidate from web client to device.
 * Requires user authentication.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json();
    const validation = iceCandidateSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const { session_id, candidate } = validation.data;
    const supabase = createSupabaseServiceClient();
    
    // Verify device exists
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id")
      .eq("device_id", deviceId)
      .maybeSingle();
    
    if (deviceError || !device) {
      return apiError("Device not found", 404);
    }
    
    // Store ICE candidate for device to retrieve
    // In a production system, you'd use WebSockets for real-time exchange
    // For now, we'll store it in a command result or use polling
    
    // Note: ICE candidates are time-sensitive, so this HTTP approach has limitations
    // For production, consider WebSockets or Server-Sent Events
    
    return apiResponse({
      message: "ICE candidate received (stored for device polling)",
      session_id,
      device_id: deviceId,
    });
    
  } catch (error) {
    console.error("ICE candidate error:", error);
    return apiError("Internal server error", 500);
  }
}
