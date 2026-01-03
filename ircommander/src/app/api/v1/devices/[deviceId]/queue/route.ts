import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { serverEnv } from "@/lib/env";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SESSION_COST_CREDITS = 100;

/**
 * GET /api/v1/devices/:deviceId/queue
 * Get the current queue for a device.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    // Check for expired position 1 entries (waiting > 60 seconds)
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const { data: expiredEntries } = await supabase
        .from("irc_device_queue")
        .select("id, user_id")
        .eq("device_id", deviceId)
        .eq("position", 1)
        .eq("status", "waiting")
        .not("became_position_one_at", "is", null)
        .lt("became_position_one_at", sixtySecondsAgo.toISOString());

      if (expiredEntries && expiredEntries.length > 0) {
        for (const expired of expiredEntries) {
          await supabase.from("irc_device_queue").delete().eq("id", expired.id);
        }
      }
    } catch (e) {
      // Column might not exist yet
    }

    // Get queue entries
    const { data: queueEntries, error: queueError } = await supabase
      .from("irc_device_queue")
      .select(`
        id,
        user_id,
        position,
        status,
        joined_at,
        started_at,
        completed_at,
        became_position_one_at
      `)
      .eq("device_id", deviceId)
      .in("status", ["waiting", "active"])
      .order("position", { ascending: true });

    if (queueError) {
      console.error("[queue] Error fetching queue:", queueError);
      return ApiErrors.serverError("Failed to fetch queue");
    }

    // Fetch user profiles
    let queueWithProfiles = queueEntries || [];
    if (queueEntries && queueEntries.length > 0) {
      const userIds = queueEntries.map(e => e.user_id);
      const { data: profiles } = await supabase
        .from("irc_user_profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      queueWithProfiles = queueEntries.map(entry => ({
        ...entry,
        user: profiles?.find(p => p.id === entry.user_id) || null
      }));
    }

    // Get device info
    const { data: device } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, last_seen, in_car, timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    const lastSeen = device?.last_seen ? new Date(device.last_seen).getTime() : 0;
    const timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
    const isServiceOnline = timeSinceLastSeen < 60;

    return apiSuccess({
      device: device ? {
        device_id: device.device_id,
        device_name: device.device_name,
        claimed: device.claimed,
        is_online: isServiceOnline
      } : null,
      queue: queueWithProfiles,
      total_waiting: queueWithProfiles.filter(e => e.status === "waiting").length,
      active: queueWithProfiles.find(e => e.status === "active") || null
    });
  } catch (err) {
    console.error("[queue] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * POST /api/v1/devices/:deviceId/queue
 * Join the queue for a device.
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

    // Check device exists and is claimed
    const { data: device } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, last_seen")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!device) {
      return ApiErrors.notFound("Device");
    }

    if (!device.claimed) {
      return ApiErrors.forbidden("Device must be claimed before joining the queue");
    }

    // Check if service is online
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
    if (timeSinceLastSeen >= 60) {
      return ApiErrors.serviceUnavailable("PC service is offline - please wait for it to come online");
    }

    // Check if user already in queue
    const { data: existingEntry } = await supabase
      .from("irc_device_queue")
      .select("id, position, status")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .in("status", ["waiting", "active"])
      .maybeSingle();

    if (existingEntry) {
      return ApiErrors.conflict("You are already in the queue");
    }

    // Check user credits
    const { data: userProfile } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    const userCredits = userProfile?.credits ?? 0;
    if (userCredits < SESSION_COST_CREDITS) {
      return ApiErrors.paymentRequired(
        `Insufficient credits. Need ${SESSION_COST_CREDITS}, have ${userCredits}.`,
        { credits_required: SESSION_COST_CREDITS, credits_available: userCredits }
      );
    }

    // Deduct credits
    const newCredits = userCredits - SESSION_COST_CREDITS;
    await supabase
      .from("irc_user_profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    // Insert queue entry
    const { data: queueEntry, error: insertError } = await supabase
      .from("irc_device_queue")
      .insert({
        device_id: deviceId,
        user_id: userId,
        status: "waiting"
      })
      .select()
      .single();

    if (insertError) {
      // Refund credits on failure
      await supabase
        .from("irc_user_profiles")
        .update({ credits: userCredits })
        .eq("id", userId);
      
      console.error("[queue/join] Insert error:", insertError);
      return ApiErrors.serverError("Failed to join queue");
    }

    // Get position
    const { data: entryWithPosition } = await supabase
      .from("irc_device_queue")
      .select("id, position, status, joined_at")
      .eq("id", queueEntry.id)
      .single();

    return apiSuccess({
      queue_entry: entryWithPosition || queueEntry,
      message: `Joined queue at position ${entryWithPosition?.position || "pending"}`,
      credits_deducted: SESSION_COST_CREDITS,
      credits_remaining: newCredits
    });
  } catch (err) {
    console.error("[queue/join] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * DELETE /api/v1/devices/:deviceId/queue
 * Leave the queue for a device.
 */
export async function DELETE(
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

    // Find user's queue entry
    const { data: existingEntry } = await supabase
      .from("irc_device_queue")
      .select("id, status, started_at")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .in("status", ["waiting", "active"])
      .maybeSingle();

    if (!existingEntry) {
      return ApiErrors.notFound("Queue entry");
    }

    // Refund if still waiting
    const shouldRefund = existingEntry.status === "waiting";

    // Delete entry
    await supabase.from("irc_device_queue").delete().eq("id", existingEntry.id);

    // Process refund
    let creditsRefunded = 0;
    if (shouldRefund) {
      const { data: userProfile } = await supabase
        .from("irc_user_profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();

      const currentCredits = userProfile?.credits ?? 0;
      await supabase
        .from("irc_user_profiles")
        .update({ credits: currentCredits + SESSION_COST_CREDITS })
        .eq("id", userId);
      
      creditsRefunded = SESSION_COST_CREDITS;
    }

    return apiSuccess({
      message: shouldRefund 
        ? `Left queue. ${creditsRefunded} credits refunded.`
        : "Left queue.",
      credits_refunded: creditsRefunded
    });
  } catch (err) {
    console.error("[queue/leave] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

