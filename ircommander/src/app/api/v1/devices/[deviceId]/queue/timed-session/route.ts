import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const timedSessionSchema = z.object({
  duration_seconds: z.number().int().min(30).max(600), // 30 seconds to 10 minutes
});

/**
 * POST /api/v1/devices/:deviceId/queue/timed-session
 * Start a timed session for the next driver in queue.
 * This will:
 * 1. Put driver in car
 * 2. Wait for car to start moving
 * 3. Start timer
 * 4. When timer expires: complete lap, turn off ignition, wait for stop, exit car
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

    const { userId } = userResult;
    const supabase = createSupabaseServiceClient();

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = timedSessionSchema.safeParse(body);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error.format());
    }

    const { duration_seconds } = validation.data;

    // Get the next driver in queue (position 1, waiting status)
    // For testing: if no queue entry, use the current user
    let queueEntry: { id: string; user_id: string; position: number; status: string } | null = null;
    const { data: foundQueueEntry, error: queueError } = await supabase
      .from("irc_device_queue")
      .select("id, user_id, position, status")
      .eq("device_id", deviceId)
      .eq("position", 1)
      .eq("status", "waiting")
      .maybeSingle();

    if (queueError) {
      console.error("[queue/timed-session] Error finding queue entry:", queueError);
      return ApiErrors.serverError("Failed to find queue entry");
    }

    if (foundQueueEntry) {
      queueEntry = foundQueueEntry;
    } else {
      // For testing: create a temporary queue entry with the current user
      // This allows testing without requiring the queue system to work
      const { data: tempEntry, error: insertError } = await supabase
        .from("irc_device_queue")
        .insert({
          device_id: deviceId,
          user_id: userId,
          status: "waiting"
        })
        .select("id, user_id")
        .single();

      if (insertError) {
        console.error("[queue/timed-session] Error creating temp queue entry:", insertError);
        // Continue anyway - we'll use userId directly
        queueEntry = { id: `temp-${Date.now()}`, user_id: userId, position: 1, status: "waiting" };
      } else {
        // Get the position for the newly inserted entry
        const { data: entryWithPosition } = await supabase
          .from("irc_device_queue")
          .select("id, user_id, position, status")
          .eq("id", tempEntry.id)
          .single();
        queueEntry = entryWithPosition || { id: tempEntry.id, user_id: userId, position: 1, status: "waiting" };
      }
    }

    // Check device status
    const { data: device } = await supabase
      .from("irc_devices")
      .select("device_id, last_seen, timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    // Check if service is online
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
    if (timeSinceLastSeen >= 60) {
      return ApiErrors.serviceUnavailable("PC service is offline");
    }

    // Check if there's already an active timed session
    const existingState = device.timed_session_state as any;
    if (existingState?.active) {
      return ApiErrors.conflict("A timed session is already active");
    }

    // Activate the queue entry (only if it's a real queue entry, not a temp one)
    const now = new Date().toISOString();
    if (!queueEntry.id.startsWith("temp-")) {
      const { error: updateError } = await supabase
        .from("irc_device_queue")
        .update({
          status: "active",
          started_at: now
        })
        .eq("id", queueEntry.id);

      if (updateError) {
        console.error("[queue/timed-session] Error activating:", updateError);
        // Continue anyway for testing
      }
    }

    // Send enter_car command
    const { error: commandError } = await supabase
      .from("irc_device_commands")
      .insert({
        device_id: deviceId,
        command_type: "owner",
        command_action: "enter_car",
        command_params: {},
        status: "pending"
      });

    if (commandError) {
      console.error("[queue/timed-session] Error sending enter_car command:", commandError);
      // Continue anyway - session state will be set up
    }

    // Initialize timed session state on device
    const { error: stateError } = await supabase
      .from("irc_devices")
      .update({
        timed_session_state: {
          active: true,
          user_id: queueEntry.user_id,
          queue_entry_id: queueEntry.id,
          started_at: now,
          duration_seconds: duration_seconds,
          state: "entering_car", // entering_car -> waiting_for_movement -> racing -> completing_lap -> stopping -> exiting_car -> completed
          timer_started_at: null, // Set when movement detected
          timer_expires_at: null,
          updated_at: now
        },
        updated_at: now
      })
      .eq("device_id", deviceId);

    if (stateError) {
      console.error("[queue/timed-session] Error setting session state:", stateError);
      return ApiErrors.serverError("Failed to initialize timed session");
    }

    return apiSuccess({
      message: "Timed session started! Entering car...",
      queue_entry_id: queueEntry.id,
      duration_seconds: duration_seconds,
      state: "entering_car"
    });
  } catch (err) {
    console.error("[queue/timed-session] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * GET /api/v1/devices/:deviceId/queue/timed-session
 * Get current timed session status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: device, error } = await supabase
      .from("irc_devices")
      .select("timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) {
      console.error("[queue/timed-session] Error:", error);
      return ApiErrors.serverError("Database error");
    }

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    const sessionState = device.timed_session_state as any;

    // Check if session state is null, undefined, or not active
    if (!sessionState || !sessionState.active) {
      return apiSuccess({
        active: false,
        session: null
      });
    }

    // Calculate time remaining if timer has started
    let time_remaining_seconds = null;
    if (sessionState.timer_expires_at) {
      const expiresAt = new Date(sessionState.timer_expires_at).getTime();
      const now = Date.now();
      time_remaining_seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    }

    return apiSuccess({
      active: true,
      session: {
        user_id: sessionState.user_id,
        queue_entry_id: sessionState.queue_entry_id,
        state: sessionState.state,
        duration_seconds: sessionState.duration_seconds,
        timer_started_at: sessionState.timer_started_at,
        timer_expires_at: sessionState.timer_expires_at,
        time_remaining_seconds: time_remaining_seconds,
        average_lap_time: sessionState.average_lap_time || null,
        track_name: sessionState.track_name || null,
        car_name: sessionState.car_name || null,
        calculated_duration: sessionState.calculated_duration || sessionState.duration_seconds,
        laps_target: sessionState.laps_target || null
      }
    });
  } catch (err) {
    console.error("[queue/timed-session] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * DELETE /api/v1/devices/:deviceId/queue/timed-session
 * Cancel/stop the active timed session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: device, error } = await supabase
      .from("irc_devices")
      .select("timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) {
      console.error("[queue/timed-session] Error:", error);
      return ApiErrors.serverError("Database error");
    }

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    const sessionState = device.timed_session_state as any;

    if (!sessionState?.active) {
      return apiSuccess({
        message: "No active session to cancel",
        cancelled: false
      });
    }

    const now = new Date().toISOString();

    // Clear timed session state
    const { error: updateError } = await supabase
      .from("irc_devices")
      .update({
        timed_session_state: null,
        updated_at: now
      })
      .eq("device_id", deviceId);

    if (updateError) {
      console.error("[queue/timed-session] Error clearing session:", updateError);
      return ApiErrors.serverError("Failed to cancel session");
    }

    // If there's a queue entry, mark it as completed or cancelled
    if (sessionState.queue_entry_id && !sessionState.queue_entry_id.startsWith("temp-")) {
      await supabase
        .from("irc_device_queue")
        .update({
          status: "completed",
          completed_at: now
        })
        .eq("id", sessionState.queue_entry_id);
    }

    // Send exit_car command to get driver out
    await supabase
      .from("irc_device_commands")
      .insert({
        device_id: deviceId,
        command_type: "owner",
        command_action: "reset_car", // This will exit car if in pits
        command_params: {},
        status: "pending"
      });

    return apiSuccess({
      message: "Timed session cancelled",
      cancelled: true,
      queue_entry_id: sessionState.queue_entry_id
    });
  } catch (err) {
    console.error("[queue/timed-session] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
