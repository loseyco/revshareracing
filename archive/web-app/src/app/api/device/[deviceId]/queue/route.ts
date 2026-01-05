import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/device/[deviceId]/queue
 * Get the current queue for a device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const supabase = createSupabaseServiceClient();

  try {
    // First, check for expired position 1 entries (waiting > 60 seconds)
    // and remove them automatically (only if the column exists)
    // This is wrapped in try-catch to handle cases where migration hasn't been run yet
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const { data: expiredEntries, error: expiredError } = await supabase
        .from("irc_device_queue")
        .select("id, user_id")
        .eq("device_id", deviceId)
        .eq("position", 1)
        .eq("status", "waiting")
        .not("became_position_one_at", "is", null)
        .lt("became_position_one_at", sixtySecondsAgo.toISOString());

      // If error occurs (e.g., column doesn't exist), skip this check
      if (expiredError) {
        // Check if it's a column not found error (PostgreSQL error code 42703 or similar)
        const errorMessage = expiredError.message || "";
        if (errorMessage.includes("column") && errorMessage.includes("does not exist")) {
          console.log("[getQueue] became_position_one_at column doesn't exist yet, skipping expired check");
        } else {
          console.error("[getQueue] Error checking expired entries:", expiredError);
        }
      } else if (expiredEntries && expiredEntries.length > 0) {
        console.log(`[getQueue] Removing ${expiredEntries.length} expired position 1 entries`);
        for (const expired of expiredEntries) {
          const { error: deleteError } = await supabase
            .from("irc_device_queue")
            .delete()
            .eq("id", expired.id);
          
          if (deleteError) {
            console.error(`[getQueue] Error removing expired entry ${expired.id}:`, deleteError);
          } else {
            console.log(`[getQueue] Removed expired position 1 entry for user ${expired.user_id}`);
          }
        }
      }
    } catch (expiredCheckError) {
      // Column might not exist yet, skip expired check
      console.log("[getQueue] Skipping expired entries check (migration may not be run yet):", expiredCheckError);
    }

    // Get queue entries - try to include became_position_one_at, but handle if it doesn't exist
    let queueEntries;
    let queueError;
    
    // First try with the new column
    const { data: entriesWithTimestamp, error: errorWithTimestamp } = await supabase
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

    // If column doesn't exist, try without it
    if (errorWithTimestamp) {
      const errorMessage = errorWithTimestamp.message || "";
      if (errorMessage.includes("column") && errorMessage.includes("does not exist")) {
        console.log("[getQueue] became_position_one_at column doesn't exist, fetching without it");
        const { data: entriesWithoutTimestamp, error: errorWithoutTimestamp } = await supabase
          .from("irc_device_queue")
          .select(`
            id,
            user_id,
            position,
            status,
            joined_at,
            started_at,
            completed_at
          `)
          .eq("device_id", deviceId)
          .in("status", ["waiting", "active"])
          .order("position", { ascending: true });
        
        queueEntries = entriesWithoutTimestamp;
        queueError = errorWithoutTimestamp;
      } else {
        // Some other error occurred
        queueEntries = entriesWithTimestamp;
        queueError = errorWithTimestamp;
      }
    } else {
      queueEntries = entriesWithTimestamp;
      queueError = errorWithTimestamp;
    }

    // Fetch user profiles separately if queue entries exist
    let queueWithProfiles = queueEntries || [];
    if (queueEntries && queueEntries.length > 0) {
      const userIds = queueEntries.map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from("irc_user_profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      // Merge profiles with queue entries
      queueWithProfiles = queueEntries.map((entry) => ({
        ...entry,
        irc_user_profiles: profiles?.find((p) => p.id === entry.user_id) || null,
      }));
    }

    if (queueError) {
      console.error("[getQueue] Error fetching queue:", queueError);
      return NextResponse.json(
        { error: "Failed to fetch queue", details: queueError.message },
        { status: 500 }
      );
    }

    // Get device info including last_seen and in_car status to check service health
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, last_seen, in_car, timed_session_state")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError) {
      console.error("[getQueue] Error fetching device:", deviceError);
    }

    // Check if service is online
    const lastSeen = device?.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
    const isServiceOnline = timeSinceLastSeen < 60;

    // If service has been offline for more than 3 minutes, remove all waiting drivers
    // This prevents people from waiting indefinitely when service is down
    if (device && !isServiceOnline && timeSinceLastSeen > 180) {
      console.log(`[getQueue] Service offline for ${timeSinceLastSeen.toFixed(0)}s - removing all waiting drivers`);
      
      const { data: waitingEntries, error: waitingError } = await supabase
        .from("irc_device_queue")
        .select("id, user_id")
        .eq("device_id", deviceId)
        .eq("status", "waiting");
      
      if (!waitingError && waitingEntries && waitingEntries.length > 0) {
        for (const entry of waitingEntries) {
          const { error: deleteError } = await supabase
            .from("irc_device_queue")
            .delete()
            .eq("id", entry.id);
          
          if (deleteError) {
            console.error(`[getQueue] Error removing waiting entry ${entry.id}:`, deleteError);
          } else {
            console.log(`[getQueue] Removed waiting entry for user ${entry.user_id} (service offline > 3 minutes)`);
          }
        }
      }
    }

    // Check for active drivers when pc_service is offline
    // If a driver is "active" but service went down before they started driving, revert them to waiting
    if (device && queueWithProfiles) {
      const activeEntry = queueWithProfiles.find((e) => e.status === "active");
      
      if (activeEntry) {
        // Check if service is online (last_seen within last 60 seconds)
        const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
        const now = Date.now();
        const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
        const isServiceOnline = timeSinceLastSeen < 60;
        
        // If service is offline, check if driver has actually started driving
        // Note: isServiceOnline is already calculated above
        if (!isServiceOnline) {
          // Check if driver is in car (they've started driving)
          const inCar = device.in_car === true;
          
          // Check if timed session has started (movement detected)
          const sessionState = device.timed_session_state;
          const sessionStarted = sessionState && 
            sessionState.active === true && 
            sessionState.waitingForMovement === false;
          
          // If driver hasn't started driving (not in car and session hasn't started), revert to waiting
          if (!inCar && !sessionStarted) {
            console.log(`[getQueue] Service offline and driver ${activeEntry.user_id} hasn't started driving - reverting to waiting`);
            
            const { error: revertError } = await supabase
              .from("irc_device_queue")
              .update({
                status: "waiting",
                started_at: null, // Clear started_at since they didn't actually start
              })
              .eq("id", activeEntry.id);
            
            if (revertError) {
              console.error(`[getQueue] Error reverting active driver to waiting:`, revertError);
            } else {
              // Update the entry in our response
              activeEntry.status = "waiting";
              activeEntry.started_at = undefined;
              
              // Clear timed session state if it exists
              if (sessionState) {
                await supabase
                  .from("irc_devices")
                  .update({
                    timed_session_state: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("device_id", deviceId);
              }
              
              console.log(`[getQueue] Reverted driver ${activeEntry.user_id} from active to waiting due to service offline`);
            }
          } else {
            // Driver has started (in car or session started), keep them active
            console.log(`[getQueue] Service offline but driver ${activeEntry.user_id} has started driving - keeping active`);
          }
        }
      }
    }

    // Re-fetch queue after potential status change
    const { data: updatedQueueEntries } = await supabase
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

    // Re-fetch profiles if needed
    let finalQueueWithProfiles = updatedQueueEntries || [];
    if (updatedQueueEntries && updatedQueueEntries.length > 0) {
      const userIds = updatedQueueEntries.map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from("irc_user_profiles")
        .select("id, email, display_name")
        .in("id", userIds);

      finalQueueWithProfiles = updatedQueueEntries.map((entry) => ({
        ...entry,
        irc_user_profiles: profiles?.find((p) => p.id === entry.user_id) || null,
      }));
    }

    return NextResponse.json({
      device: device ? {
        device_id: device.device_id,
        device_name: device.device_name,
        claimed: device.claimed,
      } : null,
      queue: finalQueueWithProfiles || [],
      totalWaiting: finalQueueWithProfiles?.filter((e) => e.status === "waiting").length || 0,
      active: finalQueueWithProfiles?.find((e) => e.status === "active") || null,
    });
  } catch (err) {
    console.error("[getQueue] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/device/[deviceId]/queue
 * Join the queue for a device
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  
  try {
    const body = await request.json().catch(() => ({}));
    const authHeader = request.headers.get("authorization");
    
    // Get user from auth token
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const supabaseClient = createClient(
        serverEnv.NEXT_PUBLIC_SUPABASE_URL,
        serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError) {
        console.error("[joinQueue] Error verifying token:", userError);
        return NextResponse.json(
          { error: "Invalid or expired session. Please log in again.", details: userError.message },
          { status: 401 }
        );
      }
      
      userId = user?.id || null;
    }

    if (!userId) {
      console.error("[joinQueue] No userId found - authHeader present:", !!authHeader);
      return NextResponse.json(
        { error: "Authentication required. Please log in to join the queue." },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Check if device exists and get service status
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, last_seen")
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
        { error: "Device must be claimed before joining the queue" },
        { status: 403 }
      );
    }

    // Check if PC service is online
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
    const isServiceOnline = timeSinceLastSeen < 60;

    if (!isServiceOnline) {
      return NextResponse.json(
        { 
          error: "Cannot join queue - PC service is offline",
          reason: "PC service offline (not seen recently). Please wait for the service to come back online before joining the queue."
        },
        { status: 503 }
      );
    }

    // Check if user is already in queue
    const { data: existingEntry, error: existingError } = await supabase
      .from("irc_device_queue")
      .select("id, position, status")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .in("status", ["waiting", "active"])
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[joinQueue] Error checking existing entry:", existingError);
      return NextResponse.json(
        { error: "Failed to check queue status", details: existingError.message },
        { status: 500 }
      );
    }

    if (existingEntry) {
      return NextResponse.json(
        {
          error: "You are already in the queue",
          position: existingEntry.position,
          status: existingEntry.status,
        },
        { status: 400 }
      );
    }

    // Check user's credit balance (1-minute session costs 100 credits)
    const SESSION_COST_CREDITS = 100;
    const { data: userProfile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("[joinQueue] Error checking user credits:", profileError);
      return NextResponse.json(
        { error: "Failed to check credit balance", details: profileError.message },
        { status: 500 }
      );
    }

    const userCredits = userProfile?.credits ?? 0;
    if (userCredits < SESSION_COST_CREDITS) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          details: `You need ${SESSION_COST_CREDITS} credits to join the queue (1-minute session). You have ${userCredits} credits.`,
          creditsRequired: SESSION_COST_CREDITS,
          creditsAvailable: userCredits,
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // Deduct credits immediately when joining queue
    const newCredits = userCredits - SESSION_COST_CREDITS;
    const { error: deductError } = await supabase
      .from("irc_user_profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (deductError) {
      console.error("[joinQueue] Error deducting credits:", deductError);
      return NextResponse.json(
        { error: "Failed to deduct credits", details: deductError.message },
        { status: 500 }
      );
    }

    console.log(`[joinQueue] Deducted ${SESSION_COST_CREDITS} credits from user ${userId}. Previous: ${userCredits}, New: ${newCredits}`);

    // Insert new queue entry (position will be assigned by trigger)
    const { data: queueEntry, error: insertError } = await supabase
      .from("irc_device_queue")
      .insert({
        device_id: deviceId,
        user_id: userId,
        status: "waiting",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[joinQueue] Error inserting queue entry:", insertError);
      return NextResponse.json(
        { error: "Failed to join queue", details: insertError.message },
        { status: 500 }
      );
    }

    // Fetch the entry with position (trigger should have set it)
    const { data: entryWithPosition } = await supabase
      .from("irc_device_queue")
      .select("id, position, status, joined_at")
      .eq("id", queueEntry.id)
      .single();

    return NextResponse.json({
      success: true,
      queueEntry: entryWithPosition || queueEntry,
      message: `You've joined the queue! Position: ${entryWithPosition?.position || "pending"}. ${SESSION_COST_CREDITS} credits deducted.`,
      creditsDeducted: SESSION_COST_CREDITS,
      creditsRemaining: newCredits,
    });
  } catch (err) {
    console.error("[joinQueue] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/device/[deviceId]/queue
 * Leave the queue for a device
 */
export async function DELETE(
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
    const SESSION_COST_CREDITS = 100;

    // First, find the user's queue entry to check status
    const { data: existingEntry, error: findError } = await supabase
      .from("irc_device_queue")
      .select("id, status, started_at")
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .in("status", ["waiting", "active"])
      .maybeSingle();

    if (findError) {
      console.error("[leaveQueue] Error finding queue entry:", findError);
      return NextResponse.json(
        { error: "Failed to check queue status", details: findError.message },
        { status: 500 }
      );
    }

    if (!existingEntry) {
      return NextResponse.json(
        { error: "You are not in the queue" },
        { status: 404 }
      );
    }

    // Check if user should get a refund (waiting status = never started driving)
    const shouldRefund = existingEntry.status === "waiting";

    // Delete the queue entry
    const { error: deleteError } = await supabase
      .from("irc_device_queue")
      .delete()
      .eq("id", existingEntry.id);

    if (deleteError) {
      console.error("[leaveQueue] Error deleting queue entry:", deleteError);
      return NextResponse.json(
        { error: "Failed to leave queue", details: deleteError.message },
        { status: 500 }
      );
    }

    // Refund credits if user was still waiting (never drove)
    let creditsRefunded = 0;
    if (shouldRefund) {
      const { data: userProfile } = await supabase
        .from("irc_user_profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();

      const currentCredits = userProfile?.credits ?? 0;
      const newCredits = currentCredits + SESSION_COST_CREDITS;

      const { error: refundError } = await supabase
        .from("irc_user_profiles")
        .update({ credits: newCredits })
        .eq("id", userId);

      if (refundError) {
        console.error("[leaveQueue] Error refunding credits:", refundError);
        // Don't fail the leave operation, just log the error
      } else {
        creditsRefunded = SESSION_COST_CREDITS;
        console.log(`[leaveQueue] Refunded ${SESSION_COST_CREDITS} credits to user ${userId}. New balance: ${newCredits}`);
      }
    }

    // If an active driver left, reset the became_position_one_at for the next person
    // This gives them a fresh 60-second window
    if (existingEntry.status === "active") {
      const { data: nextInLine, error: nextError } = await supabase
        .from("irc_device_queue")
        .select("id")
        .eq("device_id", deviceId)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextError && nextInLine) {
        const { error: resetError } = await supabase
          .from("irc_device_queue")
          .update({ became_position_one_at: new Date().toISOString() })
          .eq("id", nextInLine.id);

        if (resetError) {
          console.error("[leaveQueue] Error resetting position 1 timer:", resetError);
        } else {
          console.log(`[leaveQueue] Reset became_position_one_at for next driver (queue entry ${nextInLine.id})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: shouldRefund 
        ? `You've left the queue. ${creditsRefunded} credits refunded.`
        : "You've left the queue.",
      creditsRefunded,
    });
  } catch (err) {
    console.error("[leaveQueue] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

