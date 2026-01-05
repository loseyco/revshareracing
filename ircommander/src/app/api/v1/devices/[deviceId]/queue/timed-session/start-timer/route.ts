import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/v1/devices/:deviceId/queue/timed-session/start-timer
 * Manually start the timer for testing purposes (simulates car movement detection)
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

    const supabase = createSupabaseServiceClient();

    const { data: device, error } = await supabase
      .from("irc_devices")
      .select("timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) {
      console.error("[queue/timed-session/start-timer] Error:", error);
      return ApiErrors.serverError("Database error");
    }

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    const sessionState = device.timed_session_state as any;

    if (!sessionState?.active) {
      return ApiErrors.badRequest("No active timed session");
    }

    if (sessionState.timer_started_at) {
      return ApiErrors.badRequest("Timer has already started");
    }

    // Start the timer
    const now = new Date();
    const durationMs = (sessionState.duration_seconds || 60) * 1000;
    const expiresAt = new Date(now.getTime() + durationMs);

    const { error: updateError } = await supabase
      .from("irc_devices")
      .update({
        timed_session_state: {
          ...sessionState,
          state: "racing",
          timer_started_at: now.toISOString(),
          timer_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString()
        },
        updated_at: now.toISOString()
      })
      .eq("device_id", deviceId);

    if (updateError) {
      console.error("[queue/timed-session/start-timer] Error:", updateError);
      return ApiErrors.serverError("Failed to start timer");
    }

    return apiSuccess({
      message: "Timer started",
      timer_started_at: now.toISOString(),
      timer_expires_at: expiresAt.toISOString(),
      duration_seconds: sessionState.duration_seconds
    });
  } catch (err) {
    console.error("[queue/timed-session/start-timer] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
