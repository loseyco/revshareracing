import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  if (!deviceId) {
    return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: deviceRecord, error: fetchError } = await supabase
    .from("irc_devices")
    .select("device_id, device_name, claim_code, status, claimed, owner_user_id, location, local_ip, public_ip, last_seen, updated_at")
    .eq("device_id", deviceId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[getDeviceInfo] fetchError", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!deviceRecord) {
    return NextResponse.json(
      { error: "Device not found" },
      { status: 404 }
    );
  }

  // Only return claim code if device is unclaimed
  const response: {
    deviceId: string;
    deviceName?: string;
    claimCode?: string;
    status: string;
    claimed?: boolean;
    ownerUserId?: string;
    location?: string;
    localIp?: string;
    publicIp?: string;
    lastSeen?: string;
  } = {
    deviceId: deviceRecord.device_id,
    deviceName: deviceRecord.device_name,
    status: deviceRecord.status,
    claimed: deviceRecord.claimed || false,
    ownerUserId: deviceRecord.owner_user_id || undefined,
    location: deviceRecord.location || undefined,
    localIp: deviceRecord.local_ip || undefined,
    publicIp: deviceRecord.public_ip || undefined,
    lastSeen: deviceRecord.last_seen || deviceRecord.updated_at || undefined
  };

  if (deviceRecord.status === "unclaimed" && deviceRecord.claim_code) {
    response.claimCode = deviceRecord.claim_code;
  }

  return NextResponse.json(response);
}

