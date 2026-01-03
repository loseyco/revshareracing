import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/v1/devices/:deviceId/queue/activate
 * Activate the user at position 1 in the queue.
 * This starts their driving session.
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

    // Get user's queue entry
    const { data: queueEntry, error: queueError } = await supabase
      .from("irc_device_queue")
      .select("id, position, status")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .eq("status", "waiting")
      .maybeSingle();

    if (queueError) {
      console.error("[queue/activate] Error finding queue entry:", queueError);
      return ApiErrors.serverError("Failed to find queue entry");
    }

    if (!queueEntry) {
      return ApiErrors.notFound("Queue entry");
    }

    if (queueEntry.position !== 1) {
      return ApiErrors.forbidden(`Cannot activate - you are at position ${queueEntry.position}, not position 1`);
    }

    // Check device status
    const { data: device } = await supabase
      .from("irc_devices")
      .select("device_id, last_seen, iracing_connected")
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

    // Activate the queue entry
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("irc_device_queue")
      .update({
        status: "active",
        started_at: now
      })
      .eq("id", queueEntry.id);

    if (updateError) {
      console.error("[queue/activate] Error activating:", updateError);
      return ApiErrors.serverError("Failed to activate session");
    }

    // Initialize timed session state on device
    await supabase
      .from("irc_devices")
      .update({
        timed_session_state: {
          active: true,
          user_id: userId,
          started_at: now,
          duration_seconds: 60,
          waitingForMovement: true
        },
        updated_at: now
      })
      .eq("device_id", deviceId);

    return apiSuccess({
      message: "Session activated! Your 1-minute session begins when you start moving.",
      queue_entry_id: queueEntry.id,
      started_at: now,
      duration_seconds: 60
    });
  } catch (err) {
    console.error("[queue/activate] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

