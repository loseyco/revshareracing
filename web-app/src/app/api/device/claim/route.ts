import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

const requestSchema = z.object({
  deviceId: z.string().min(1),
  claimCode: z.string().min(1),
  userId: z.string().optional() // User ID from client session
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const { deviceId, claimCode, userId } = parsed.data;
  const supabase = createSupabaseServiceClient();

  // First, check if device exists
  const { data: deviceRecord, error: fetchError } = await supabase
    .from("irc_devices")
    .select("*")
    .eq("device_id", deviceId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[claimDevice] fetchError", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!deviceRecord) {
    return NextResponse.json(
      { error: "Device not found." },
      { status: 404 }
    );
  }

  // Check if already claimed
  if (deviceRecord.claimed) {
    // Check if it's claimed by the current user
    if (userId && deviceRecord.owner_user_id === userId) {
      // Already claimed by this user - return success
      return NextResponse.json(
        { success: true, userId, alreadyClaimed: true, message: "You already own this device." },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: "This device has already been claimed by another user." },
      { status: 400 }
    );
  }

  // Verify claim code matches
  if (deviceRecord.claim_code !== claimCode.toUpperCase()) {
    return NextResponse.json(
      { error: "Invalid claim code. Please check the code shown on your PC service." },
      { status: 400 }
    );
  }

  // Validate userId exists if provided (to avoid foreign key constraint violations)
  // The FK constraint likely references irc_user_profiles, so ensure the profile exists
  if (userId) {
    try {
      console.log("[claimDevice] Validating userId:", userId);
      
      // First verify user exists in auth
      const { data: userData, error: userFetchError } = await supabase.auth.admin.getUserById(userId);

      if (userFetchError || !userData?.user) {
        console.error("[claimDevice] userFetchError", userFetchError);
        console.error("[claimDevice] userFetchError details:", JSON.stringify(userFetchError, null, 2));
        return NextResponse.json(
          { error: "Invalid user. Please sign in again." },
          { status: 400 }
        );
      }
      console.log("[claimDevice] User validated successfully:", userData.user.id, userData.user.email);
      
      // Check if user profile exists (FK constraint might reference this table)
      const { data: profile, error: profileError } = await supabase
        .from("irc_user_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      
      if (profileError && profileError.code !== "PGRST116") {
        console.error("[claimDevice] profileError", profileError);
      }
      
      // If profile doesn't exist, create it to satisfy FK constraint
      if (!profile) {
        console.log("[claimDevice] User profile not found, creating it...");
        const { error: createError } = await supabase
          .from("irc_user_profiles")
          .insert({
            id: userId,
            email: userData.user.email,
            role: "driver"
          });
        
        if (createError) {
          console.error("[claimDevice] Failed to create user profile:", createError);
          // Continue anyway - the FK constraint will catch it if needed
        } else {
          console.log("[claimDevice] User profile created successfully");
        }
      }
    } catch (error) {
      // If admin API is not available, skip validation and rely on FK constraint
      // The FK constraint will catch invalid user IDs during the update
      console.warn("[claimDevice] Could not validate user via admin API, relying on FK constraint:", error);
    }
  } else {
    console.warn("[claimDevice] No userId provided - device will be claimed without owner");
  }

  const updates: Record<string, unknown> = {
    claim_code: null,
    claimed: true,
    status: "active",
    updated_at: new Date().toISOString()
  };

  // Link device to user if authenticated and validated
  if (userId) {
    updates.owner_user_id = userId;
  }

  const { error: updateError } = await supabase
    .from("irc_devices")
    .update(updates)
    .eq("device_id", deviceId);

  if (updateError) {
    console.error("[claimDevice] updateError", updateError);
    console.error("[claimDevice] updateError details:", JSON.stringify(updateError, null, 2));
    console.error("[claimDevice] Attempted update with userId:", userId);
    // Check if it's a foreign key constraint violation
    const errorMessage = updateError.message || "";
    const errorCode = updateError.code || "";
    if (errorMessage.toLowerCase().includes("foreign key") || 
        errorMessage.toLowerCase().includes("violates foreign key constraint") ||
        errorCode.includes("23503")) { // PostgreSQL foreign key violation code
      console.error("[claimDevice] Foreign key constraint violation detected");
      console.error("[claimDevice] UserId that failed:", userId);
      return NextResponse.json(
        { error: "Invalid user reference. Please sign in again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId });
}

