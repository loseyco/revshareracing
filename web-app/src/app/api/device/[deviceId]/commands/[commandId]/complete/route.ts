import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/device/[deviceId]/commands/[commandId]/complete
 * Mark a command as completed
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ deviceId: string; commandId: string }>;
  }
) {
  try {
    const { deviceId, commandId } = await params;
    const body = await request.json();
    const { status = "completed", result, error_message } = body;

    const supabase = createSupabaseServiceClient();

    // Update command status
    const updateData: any = {
      status,
    };
    
    // Only set completed_at if status is completed or failed (not processing)
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    // Include result if provided
    if (result) {
      updateData.result = result;
    }
    
    // Include error_message if provided (for failed/cancelled commands)
    if (error_message) {
      updateData.error_message = error_message;
    }

    const { data: command, error } = await supabase
      .from("irc_device_commands")
      .update(updateData)
      .eq("id", commandId)
      .eq("device_id", deviceId)
      .select()
      .single();

    if (error) {
      console.error("Error updating command:", error);
      return NextResponse.json(
        { error: "Failed to update command", details: error.message },
        { status: 500 }
      );
    }

    if (!command) {
      return NextResponse.json(
        { error: "Command not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      command,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

