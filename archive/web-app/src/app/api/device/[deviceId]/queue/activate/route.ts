import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/device/[deviceId]/queue/activate
 * Activate the next driver in queue (change status from 'waiting' to 'active')
 * This should only be called by the user who is position 1 in the queue
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  
  try {
    const authHeader = request.headers.get("authorization");
    
    // Get user from auth token
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const supabaseClient = createClient(
        serverEnv.NEXT_PUBLIC_SUPABASE_URL,
        serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Check if device exists and get iRacing status
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, iracing_connected, last_seen")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Check if device is claimed
    if (!device.claimed) {
      return NextResponse.json(
        { error: "Device must be claimed before drivers can activate" },
        { status: 403 }
      );
    }

    // Check if iRacing is connected and service is online
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
    const isServiceOnline = timeSinceLastSeen < 60;
    
    let iracingConnected = false;
    if (isServiceOnline) {
      if (device.iracing_connected !== undefined && device.iracing_connected !== null) {
        iracingConnected = Boolean(device.iracing_connected);
      }
    }

    if (!iracingConnected || !isServiceOnline) {
      return NextResponse.json(
        { 
          error: "Cannot activate driver - iRacing is not connected or PC service is offline",
          reason: !isServiceOnline 
            ? "PC service offline (not seen recently)" 
            : "iRacing not connected (make sure iRacing is in a session)"
        },
        { status: 503 }
      );
    }

    // Get the user's queue entry
    const { data: userEntry, error: entryError } = await supabase
      .from("irc_device_queue")
      .select("id, position, status")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .eq("status", "waiting")
      .maybeSingle();

    if (entryError) {
      console.error("[activateDriver] Error fetching queue entry:", entryError);
      return NextResponse.json(
        { error: "Failed to check queue status", details: entryError.message },
        { status: 500 }
      );
    }

    if (!userEntry) {
      return NextResponse.json(
        { error: "You are not in the queue or not waiting" },
        { status: 404 }
      );
    }

    // Check if user is position 1
    if (userEntry.position !== 1) {
      return NextResponse.json(
        { error: `You are position ${userEntry.position} in queue. Only position 1 can activate.` },
        { status: 403 }
      );
    }

    // Check if there's already an active driver
    const { data: activeEntry, error: activeError } = await supabase
      .from("irc_device_queue")
      .select("id, user_id")
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();

    if (activeError) {
      console.error("[activateDriver] Error checking active entry:", activeError);
      return NextResponse.json(
        { error: "Failed to check active driver", details: activeError.message },
        { status: 500 }
      );
    }

    if (activeEntry) {
      return NextResponse.json(
        { error: "There is already an active driver. Please wait for their session to end." },
        { status: 409 }
      );
    }

    // Check if there's an active timed session
    const { data: deviceWithSession, error: sessionError } = await supabase
      .from("irc_devices")
      .select("timed_session_state, in_car")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (sessionError) {
      console.error("[activateDriver] Error checking timed session:", sessionError);
      // Continue anyway - this is not critical
    } else if (deviceWithSession) {
      const sessionState = deviceWithSession.timed_session_state;
      
      // Check if timed session is active
      if (sessionState && sessionState.active) {
        const startTime = sessionState.startTime;
        const duration = sessionState.duration;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = duration - elapsed;
        
        if (remaining > 0) {
          return NextResponse.json(
            { 
              error: "Previous driver's timed session is still active. Please wait for it to finish.",
              remainingSeconds: remaining
            },
            { status: 409 }
          );
        }
      }

      // Check if someone is in the car
      if (deviceWithSession.in_car === true) {
        return NextResponse.json(
          { error: "Previous driver is still in the car. Please wait for them to exit." },
          { status: 409 }
        );
      }
    }

    // Activate the driver (change status to 'active' and set started_at)
    const { data: updatedEntry, error: updateError } = await supabase
      .from("irc_device_queue")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
      })
      .eq("id", userEntry.id)
      .select()
      .single();

    if (updateError) {
      console.error("[activateDriver] Error updating queue entry:", updateError);
      return NextResponse.json(
        { error: "Failed to activate driver", details: updateError.message },
        { status: 500 }
      );
    }

      // Now start the driver's session
      // Default session duration: 1 minute (for testing)
      const sessionMinutes = 1;
      const durationSeconds = sessionMinutes * 60;

      try {
        // Set up session state waiting for movement (PC service will handle movement detection)
        const sessionState = {
          active: false, // Will be set to true once car starts moving (by PC service)
          waitingForMovement: true,
          startTime: null, // Will be set when car starts moving (by PC service)
          duration: durationSeconds,
          driver_user_id: userId
        };

        // Save timed session state to database first
        const { error: sessionError } = await supabase
          .from("irc_devices")
          .update({
            timed_session_state: sessionState,
            updated_at: new Date().toISOString(),
          })
          .eq("device_id", deviceId);

        if (sessionError) {
          console.error("[activateDriver] Error saving timed session:", sessionError);
          return NextResponse.json(
            { error: "Failed to set up timed session", details: sessionError.message },
            { status: 500 }
          );
        }

        // Queue enter_car command with timed session parameters
        // PC service will detect movement and start the timer automatically
        const { data: command, error: commandError } = await supabase
          .from("irc_device_commands")
          .insert({
            device_id: deviceId,
            command_type: "driver",
            command_action: "enter_car",
            command_params: {
              timed_session: true,
              session_duration_seconds: durationSeconds,
              queue_driver_id: userId
            },
            status: "pending",
          })
          .select()
          .single();

        if (commandError) {
          console.error("[activateDriver] Error queuing enter_car command:", commandError);
          // Clear session state if command failed
          await supabase
            .from("irc_devices")
            .update({
              timed_session_state: null,
              updated_at: new Date().toISOString(),
            })
            .eq("device_id", deviceId);
          
          return NextResponse.json(
            { error: "Failed to queue enter_car command", details: commandError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          queueEntry: updatedEntry,
          message: `You are now driving! Timer will start automatically when you begin moving.`,
          sessionStarted: false,
          sessionDuration: durationSeconds,
          waitingForMovement: true,
        });
    } catch (err) {
      console.error("[activateDriver] Error starting session:", err);
      // Still return success since driver is activated
      return NextResponse.json({
        success: true,
        queueEntry: updatedEntry,
        message: "You are now the active driver. Session may take a moment to start.",
        sessionStarted: false,
      });
    }
  } catch (err) {
    console.error("[activateDriver] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

