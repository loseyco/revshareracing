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
  if (userId) {
    const { data: userRecord, error: userFetchError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (userFetchError) {
      console.error("[claimDevice] userFetchError", userFetchError);
      return NextResponse.json({ error: "Failed to validate user" }, { status: 500 });
    }

    if (!userRecord) {
      return NextResponse.json(
        { error: "Invalid user. Please sign in again." },
        { status: 400 }
      );
    }
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
    // Check if it's a foreign key constraint violation
    const errorMessage = updateError.message || "";
    if (errorMessage.toLowerCase().includes("foreign key") || 
        errorMessage.toLowerCase().includes("violates foreign key constraint")) {
      return NextResponse.json(
        { error: "Invalid user reference. Please sign in again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId });
}

