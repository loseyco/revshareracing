import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sendCommandSchema = z.object({
  command_action: z.string().min(1, "Command action is required"),
  command_params: z.record(z.unknown()).optional().default({}),
  command_type: z.enum(["owner", "system", "user"]).optional().default("owner"),
});

/**
 * POST /api/v1/devices/{deviceId}/commands
 * 
 * Send a command to a device.
 * Requires user authentication.
 * 
 * Common command actions:
 * - enter_car - Enter the car in iRacing
 * - exit_car - Exit the car
 * - start_session - Start a racing session
 * - stop_session - Stop the current session
 * - load_setup - Load a car setup
 * - update_settings - Update device settings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    
    // Require authenticated user
    const userResult = await requireUser(request);
    if (isUserError(userResult)) {
      return userResult;
    }

    const body = await request.json().catch(() => ({}));
    const validation = sendCommandSchema.safeParse(body);
    
    if (!validation.success) {
      return ApiErrors.validationError(validation.error.format());
    }

    const { command_action, command_params, command_type } = validation.data;
    const supabase = createSupabaseServiceClient();

    // Verify device exists
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, name, status")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError || !device) {
      return ApiErrors.notFound("Device");
    }

    // Create command
    const { data: command, error: commandError } = await supabase
      .from("irc_device_commands")
      .insert({
        device_id: deviceId,
        command_type: command_type,
        command_action: command_action,
        command_params: command_params || {},
        status: "pending",
      })
      .select()
      .single();

    if (commandError) {
      console.error("[devices/commands] Error creating command:", commandError);
      return ApiErrors.serverError("Failed to create command");
    }

    return apiSuccess({
      command_id: command.id,
      device_id: deviceId,
      command_action: command_action,
      status: "pending",
      message: "Command sent to device. Device will poll for and execute the command.",
    });

  } catch (error) {
    console.error("[devices/commands] Exception:", error);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
