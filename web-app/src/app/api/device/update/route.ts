import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

const updateSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  location: z.string().optional()
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const { deviceId, deviceName, location } = parsed.data;
  const supabase = createSupabaseServiceClient();

  // First, verify the device exists and get current user
  const { data: deviceRecord, error: fetchError } = await supabase
    .from("irc_devices")
    .select("device_id, owner_user_id")
    .eq("device_id", deviceId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[updateDevice] fetchError", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!deviceRecord) {
    return NextResponse.json(
      { error: "Device not found." },
      { status: 404 }
    );
  }

  // Build update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (deviceName !== undefined) {
    updates.device_name = deviceName.trim() || null;
  }

  if (location !== undefined) {
    updates.location = location.trim() || null;
  }

  const { data: updatedDevice, error: updateError } = await supabase
    .from("irc_devices")
    .update(updates)
    .eq("device_id", deviceId)
    .select()
    .single();

  if (updateError) {
    console.error("[updateDevice] updateError", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, device: updatedDevice });
}

