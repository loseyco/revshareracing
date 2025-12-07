import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/device/[deviceId]/commands
 * Poll for pending commands for a device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    // Get commands for this device
    // For PC service polling: only return pending commands
    // For website status tracking: return all recent commands
    const statusFilter = request.nextUrl.searchParams.get("status");
    
    let query = supabase
      .from("irc_device_commands")
      .select("*")
      .eq("device_id", deviceId);
    
    // If status filter is provided, use it (for PC service polling)
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    
    // Order by created_at descending and limit
    const { data: commands, error } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching commands:", error);
      return NextResponse.json(
        { error: "Failed to fetch commands", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commands: commands || [],
      count: commands?.length || 0,
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
 * POST /api/device/[deviceId]/commands
 * Queue a new command for a device
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    console.log(`[queueCommand] Received request for deviceId: ${deviceId}`);
    
    const body = await request.json().catch((e) => {
      console.error("[queueCommand] Failed to parse request body:", e);
      return null;
    });
    
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    
    const { type, action, params: commandParams } = body;
    console.log(`[queueCommand] Parsed body: type=${type}, action=${action}, params=`, commandParams);

    if (!type || !action) {
      console.error(`[queueCommand] Missing required fields: type=${type}, action=${action}`);
      return NextResponse.json(
        { error: "type and action are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Verify device exists and is claimed
    console.log(`[queueCommand] Checking device: ${deviceId}`);
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, claimed, owner_user_id")
      .eq("device_id", deviceId)
      .single();

    if (deviceError) {
      console.error(`[queueCommand] Device lookup error:`, deviceError);
      return NextResponse.json(
        { error: "Device not found", details: deviceError.message },
        { status: 404 }
      );
    }
    
    if (!device) {
      console.error(`[queueCommand] Device not found: ${deviceId}`);
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }
    
    console.log(`[queueCommand] Device found: claimed=${device.claimed}, owner=${device.owner_user_id}`);

    if (!device.claimed) {
      console.error(`[queueCommand] Device not claimed: ${deviceId}`);
      return NextResponse.json(
        { error: "Device must be claimed before queuing commands" },
        { status: 403 }
      );
    }

    // Insert command
    console.log(`[queueCommand] Queuing command: deviceId=${deviceId}, type=${type}, action=${action}, params=`, commandParams);
    
    const insertPayload = {
      device_id: deviceId,
      command_type: type, // 'driver' or 'owner'
      command_action: action,
      command_params: commandParams || {},
      status: "pending",
    };
    
    console.log(`[queueCommand] Insert payload:`, JSON.stringify(insertPayload, null, 2));
    
    const { data: command, error: insertError } = await supabase
      .from("irc_device_commands")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("[queueCommand] Error inserting command:", insertError);
      console.error("[queueCommand] Error details:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to queue command", details: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }
    
    console.log(`[queueCommand] Successfully queued command:`, command?.id);

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

