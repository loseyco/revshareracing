import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/auth";

/**
 * POST /api/v1/devices/{deviceId}/remote-desktop/input
 * 
 * Send input events (mouse/keyboard) to the device for remote control.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json();
    const { session_id, type, ...eventData } = body;

    if (!session_id || !type) {
      return Response.json(
        { success: false, error: "session_id and type are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Create command to send input event to device
    const { data: command, error: commandError } = await supabase
      .from("irc_device_commands")
      .insert({
        device_id: deviceId,
        command_type: "owner",
        command_action: "remote_desktop_input",
        command_params: {
          session_id: session_id,
          input_type: type,
          ...eventData,
        },
        status: "pending",
      })
      .select()
      .single();

    if (commandError) {
      console.error("Error creating input command:", commandError);
      return Response.json(
        {
          success: false,
          error: commandError.message || "Failed to send input event",
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: { command_id: command.id },
    });
  } catch (error: any) {
    console.error("Input event error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
