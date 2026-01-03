import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const offerSchema = z.object({
  offer: z.string(),
  session_id: z.string().optional(),
});

/**
 * POST /api/v1/devices/{deviceId}/remote-desktop
 * 
 * Initiate remote desktop connection to a device.
 * Creates a WebRTC offer command for the device to process.
 * Requires user authentication.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json();
    const validation = offerSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const { offer, session_id } = validation.data;
    const supabase = createSupabaseServiceClient();
    
    // Verify device exists and user has access
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, name, status")
      .eq("device_id", deviceId)
      .maybeSingle();
    
    if (deviceError || !device) {
      return apiError("Device not found", 404);
    }
    
    // Create WebRTC offer command
    const finalSessionId = session_id || `rd_${Date.now()}`;
    
    const { data: command, error: commandError } = await supabase
      .from("irc_device_commands")
      .insert({
        device_id: deviceId,
        command_type: "owner",
        command_action: "webrtc_offer",
        command_params: {
          offer: offer,
          session_id: finalSessionId,
        },
        status: "pending",
      })
      .select()
      .single();
    
    if (commandError) {
      console.error("Error creating WebRTC command:", commandError);
      console.error("Command error details:", JSON.stringify(commandError, null, 2));
      return apiError(
        `Failed to create WebRTC command: ${commandError.message || "Unknown error"}`,
        500
      );
    }
    
    if (!command) {
      console.error("Command created but no data returned");
      return apiError("Failed to create WebRTC command - no data returned", 500);
    }
    
    // Extract session_id from command_params (it's stored as JSONB)
    const commandParams = command.command_params as { session_id?: string } | null;
    const returnedSessionId = commandParams?.session_id || finalSessionId;
    
    return apiResponse({
      command_id: command.id,
      session_id: returnedSessionId,
      device_id: deviceId,
      message: "WebRTC offer sent to device. Poll command result for answer.",
    });
    
  } catch (error) {
    console.error("Remote desktop initiation error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return apiError(`Internal server error: ${errorMessage}`, 500);
  }
}

/**
 * GET /api/v1/devices/{deviceId}/remote-desktop
 * 
 * Get remote desktop connection status and answer if available.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const sessionId = request.nextUrl.searchParams.get("session_id");
    
    if (!sessionId) {
      return apiError("session_id parameter required", 400);
    }
    
    const supabase = createSupabaseServiceClient();
    
    // Find the command by session_id
    const { data: command, error: commandError } = await supabase
      .from("irc_device_commands")
      .select("*")
      .eq("device_id", deviceId)
      .eq("command_action", "webrtc_offer")
      .eq("command_params->>session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (commandError) {
      console.error("Error fetching command:", commandError);
      return apiError("Failed to fetch command", 500);
    }
    
    if (!command) {
      return apiResponse({
        status: "not_found",
        message: "Command not found",
      });
    }
    
    const result = command.result as { success?: boolean; answer?: string; message?: string } | null;
    
    if (command.status === "pending") {
      return apiResponse({
        status: "pending",
        command_id: command.id,
        message: "Waiting for device to process offer...",
      });
    }
    
    if (command.status === "completed" && result?.success && result.answer) {
      return apiResponse({
        status: "ready",
        command_id: command.id,
        answer: result.answer,
        session_id: sessionId,
      });
    }
    
    if (command.status === "failed" || (result && !result.success)) {
      return apiResponse({
        status: "failed",
        command_id: command.id,
        message: result?.message || "WebRTC offer processing failed",
      });
    }
    
    return apiResponse({
      status: "unknown",
      command_id: command.id,
    });
    
  } catch (error) {
    console.error("Remote desktop status error:", error);
    return apiError("Internal server error", 500);
  }
}
