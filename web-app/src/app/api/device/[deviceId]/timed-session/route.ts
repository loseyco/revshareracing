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

    // Check if session is starting (becoming active) and deduct credits
    const SESSION_COST_CREDITS = 100;
    if (sessionState && sessionState.active === true && sessionState.driver_user_id) {
      // Get current session state to check if it was previously inactive
      const { data: currentDevice } = await supabase
        .from("irc_devices")
        .select("timed_session_state")
        .eq("device_id", deviceId)
        .maybeSingle();
      
      const currentSessionState = currentDevice?.timed_session_state;
      const wasInactive = !currentSessionState || currentSessionState.active !== true;
      
      // Only deduct credits if session is transitioning from inactive to active
      if (wasInactive) {
        const driverUserId = sessionState.driver_user_id;
        
        // Deduct credits from user's account
        const { error: deductError } = await supabase.rpc('deduct_credits', {
          user_id_param: driverUserId,
          amount_param: SESSION_COST_CREDITS
        });
        
        // If RPC function doesn't exist, use direct update (fallback)
        if (deductError && (deductError.message?.includes('function') || deductError.code === '42883')) {
          console.log(`[timed-session API] RPC function not available, using direct update`);
          
          // Get current credits
          const { data: userProfile } = await supabase
            .from("irc_user_profiles")
            .select("credits")
            .eq("id", driverUserId)
            .single();
          
          if (userProfile) {
            const newCredits = Math.max(0, (userProfile.credits || 0) - SESSION_COST_CREDITS);
            const { error: updateCreditsError } = await supabase
              .from("irc_user_profiles")
              .update({ credits: newCredits })
              .eq("id", driverUserId);
            
            if (updateCreditsError) {
              console.error(`[timed-session API] Error deducting credits:`, updateCreditsError);
            } else {
              console.log(`[timed-session API] Deducted ${SESSION_COST_CREDITS} credits from user ${driverUserId}. New balance: ${newCredits}`);
            }
          }
        } else if (deductError) {
          console.error(`[timed-session API] Error deducting credits via RPC:`, deductError);
        } else {
          console.log(`[timed-session API] Successfully deducted ${SESSION_COST_CREDITS} credits from user ${driverUserId}`);
        }
      }
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

