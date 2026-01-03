import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireDevice, isDeviceError } from "@/lib/tenant";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const completeSchema = z.object({
  status: z.enum(["completed", "failed"]).optional().default("completed"),
  result: z.record(z.unknown()).optional(),
  error_message: z.string().optional(),
});

interface RouteContext {
  params: Promise<{
    commandId: string;
  }>;
}

/**
 * POST /api/v1/device/commands/{commandId}/complete
 * 
 * Mark a command as completed or failed.
 * Requires X-Device-Key header for authentication.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Authenticate device
    const deviceResult = await requireDevice(request);
    if (isDeviceError(deviceResult)) {
      return deviceResult;
    }
    
    const { device } = deviceResult;
    const { commandId } = await context.params;
    
    const body = await request.json();
    const validation = completeSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const { status, result, error_message } = validation.data;
    const supabase = createSupabaseServiceClient();
    
    // Verify the command belongs to this device and is pending
    const { data: command, error: fetchError } = await supabase
      .from("irc_device_commands")
      .select("id, device_id, status")
      .eq("id", commandId)
      .maybeSingle();
    
    if (fetchError || !command) {
      return apiError("Command not found", 404);
    }
    
    if (command.device_id !== device.device_id) {
      return apiError("Command does not belong to this device", 403);
    }
    
    if (command.status !== "pending") {
      return apiError("Command is not pending", 400);
    }
    
    // Update command status
    const updatePayload: Record<string, unknown> = {
      status,
      completed_at: new Date().toISOString(),
    };
    
    if (result) updatePayload.result = result;
    if (error_message) updatePayload.error_message = error_message;
    
    const { error: updateError } = await supabase
      .from("irc_device_commands")
      .update(updatePayload)
      .eq("id", commandId);
    
    if (updateError) {
      console.error("Error updating command:", updateError);
      return apiError("Failed to update command", 500);
    }
    
    return apiResponse({
      command_id: commandId,
      status,
      completed: true,
    });
    
  } catch (error) {
    console.error("Complete command error:", error);
    return apiError("Internal server error", 500);
  }
}

