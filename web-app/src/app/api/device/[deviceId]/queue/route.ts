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

    // Get device info
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError) {
      console.error("[getQueue] Error fetching device:", deviceError);
    }

    return NextResponse.json({
      device: device || null,
      queue: queueWithProfiles || [],
      totalWaiting: queueWithProfiles?.filter((e) => e.status === "waiting").length || 0,
      active: queueWithProfiles?.find((e) => e.status === "active") || null,
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

    // Check if device exists
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
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
      message: `You've joined the queue! Position: ${entryWithPosition?.position || "pending"}`,
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

    // Find and delete user's queue entry
    const { data: deletedEntry, error: deleteError } = await supabase
      .from("irc_device_queue")
      .delete()
      .eq("device_id", deviceId)
      .eq("user_id", userId)
      .in("status", ["waiting", "active"])
      .select()
      .maybeSingle();

    if (deleteError) {
      console.error("[leaveQueue] Error deleting queue entry:", deleteError);
      return NextResponse.json(
        { error: "Failed to leave queue", details: deleteError.message },
        { status: 500 }
      );
    }

    if (!deletedEntry) {
      return NextResponse.json(
        { error: "You are not in the queue" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You've left the queue",
    });
  } catch (err) {
    console.error("[leaveQueue] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

