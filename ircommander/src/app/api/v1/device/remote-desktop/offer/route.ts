import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const offerSchema = z.object({
  offer: z.string(),
  session_id: z.string().optional(),
});

/**
 * POST /api/v1/device/remote-desktop/offer
 * 
 * Forward WebRTC offer from web client to device.
 * Device will create answer and return it via command result.
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
    const validation = offerSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const { offer, session_id } = validation.data;
    const supabase = createSupabaseServiceClient();
    
    // Create a command for the device to handle the WebRTC offer
    const { data: command, error: commandError } = await supabase
      .from("irc_device_commands")
      .insert({
        device_id: device.device_id,
        command_action: "webrtc_offer",
        command_params: {
          offer,
          session_id: session_id || `rd_${Date.now()}`,
        },
        status: "pending",
      })
      .select()
      .single();
    
    if (commandError || !command) {
      console.error("Error creating WebRTC command:", commandError);
      return apiError("Failed to create WebRTC command", 500);
    }
    
    return apiResponse({
      command_id: command.id,
      session_id: session_id || command.command_params.session_id,
      message: "Offer sent to device. Poll for answer using command result.",
    });
    
  } catch (error) {
    console.error("Remote desktop offer error:", error);
    return apiError("Internal server error", 500);
  }
}
