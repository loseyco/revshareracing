import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/device/[deviceId]/timed-session
 * Get current timed session state for a device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    // Get device record
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, timed_session_state")
      .eq("device_id", deviceId)
      .single();

    if (deviceError) {
      console.error("Error fetching device:", deviceError);
      // If column doesn't exist, return null (graceful degradation)
      if (deviceError.message?.includes("column") || deviceError.code === "PGRST116") {
        return NextResponse.json({
          sessionState: null,
        });
      }
      return NextResponse.json(
        { error: "Device not found", details: deviceError.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionState: device?.timed_session_state || null,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/device/[deviceId]/timed-session
 * Update timed session state for a device
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { sessionState } = body;
    const supabase = createSupabaseServiceClient();

    // Verify device exists
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, claimed, owner_user_id")
      .eq("device_id", deviceId)
      .single();

    if (deviceError) {
      console.error("Error fetching device:", deviceError);
      return NextResponse.json(
        { error: "Device not found", details: deviceError.message },
        { status: 404 }
      );
    }

    if (!device.claimed) {
      return NextResponse.json(
        { error: "Device must be claimed before managing timed sessions" },
        { status: 403 }
      );
    }

    // Update timed session state
    // Note: This requires a `timed_session_state` JSONB column in the irc_devices table
    console.log(`[timed-session API] Updating session state for device ${deviceId}:`, sessionState);
    const { error: updateError, data: updateData } = await supabase
      .from("irc_devices")
      .update({
        timed_session_state: sessionState,
        updated_at: new Date().toISOString(),
      })
      .eq("device_id", deviceId)
      .select("timed_session_state");
    
    console.log(`[timed-session API] Update result:`, updateError, updateData);

    if (updateError) {
      console.error("Error updating timed session state:", updateError);
      // If column doesn't exist, return a helpful error
      if (updateError.message?.includes("column") || updateError.code === "42703") {
        return NextResponse.json(
          { 
            error: "Database schema update required", 
            details: "The timed_session_state column needs to be added to the irc_devices table. Run: ALTER TABLE irc_devices ADD COLUMN timed_session_state JSONB;" 
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update timed session state", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionState,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

