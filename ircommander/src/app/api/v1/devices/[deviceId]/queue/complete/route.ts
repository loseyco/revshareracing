import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/v1/devices/:deviceId/queue/complete
 * Complete the active session for a device.
 * Called by the PC service when a timed session ends.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const body = await request.json().catch(() => ({}));
    const { user_id, reason } = body;

    const supabase = createSupabaseServiceClient();

    // Find the active queue entry
    let query = supabase
      .from("irc_device_queue")
      .select("id, user_id, started_at")
      .eq("device_id", deviceId)
      .eq("status", "active");

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: activeEntry, error: findError } = await query.maybeSingle();

    if (findError) {
      console.error("[queue/complete] Error finding active entry:", findError);
      return ApiErrors.serverError("Failed to find active session");
    }

    if (!activeEntry) {
      return apiSuccess({
        message: "No active session to complete",
        completed: false
      });
    }

    // Mark as completed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("irc_device_queue")
      .update({
        status: "completed",
        completed_at: now
      })
      .eq("id", activeEntry.id);

    if (updateError) {
      console.error("[queue/complete] Error completing:", updateError);
      return ApiErrors.serverError("Failed to complete session");
    }

    // Clear timed session state on device
    await supabase
      .from("irc_devices")
      .update({
        timed_session_state: null,
        updated_at: now
      })
      .eq("device_id", deviceId);

    // Set became_position_one_at for the next person in queue
    const { data: nextInLine } = await supabase
      .from("irc_device_queue")
      .select("id")
      .eq("device_id", deviceId)
      .eq("status", "waiting")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextInLine) {
      await supabase
        .from("irc_device_queue")
        .update({ became_position_one_at: now })
        .eq("id", nextInLine.id);
    }

    return apiSuccess({
      message: "Session completed",
      completed: true,
      queue_entry_id: activeEntry.id,
      user_id: activeEntry.user_id,
      completed_at: now,
      reason: reason || "session_ended"
    });
  } catch (err) {
    console.error("[queue/complete] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

