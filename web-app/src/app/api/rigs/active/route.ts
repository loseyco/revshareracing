import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();

    // Get all claimed devices that are online and iRacing connected
    // A device is considered "online" if last_seen is within the last 60 seconds
    const now = new Date();
    const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

    const { data: devices, error: fetchError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, claimed, iracing_connected, last_seen, city, region, country")
      .eq("claimed", true)
      .eq("iracing_connected", true)
      .gte("last_seen", sixtySecondsAgo.toISOString())
      .order("device_name", { ascending: true });

    if (fetchError) {
      console.error("[rigs/active] fetchError", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Get queue counts for each device
    const devicesWithQueues = await Promise.all(
      (devices || []).map(async (device) => {
        // Get queue count for this device
        const { count: queueCount, error: queueError } = await supabase
          .from("irc_device_queue")
          .select("*", { count: "exact", head: true })
          .eq("device_id", device.device_id)
          .in("status", ["waiting", "active"]);

        if (queueError) {
          console.error(`[rigs/active] Error fetching queue for ${device.device_id}:`, queueError);
        }

        // Get active driver info if any
        const { data: activeEntry, error: activeError } = await supabase
          .from("irc_device_queue")
          .select("id, user_id")
          .eq("device_id", device.device_id)
          .eq("status", "active")
          .maybeSingle();

        let activeDriver = null;
        if (activeEntry && !activeError) {
          // Fetch user profile separately
          const { data: profile } = await supabase
            .from("irc_user_profiles")
            .select("id, email, display_name")
            .eq("id", activeEntry.user_id)
            .maybeSingle();

          if (profile) {
            activeDriver = {
              email: profile.email,
              display_name: profile.display_name,
            };
          }
        }

        if (activeError && activeError.code !== "PGRST116") {
          console.error(`[rigs/active] Error fetching active entry for ${device.device_id}:`, activeError);
        }

        return {
          ...device,
          queueCount: queueCount || 0,
          activeDriver,
        };
      })
    );

    console.log(`[rigs/active] Found ${devicesWithQueues.length} active rigs`);

    return NextResponse.json({ rigs: devicesWithQueues });
  } catch (error) {
    console.error("[rigs/active] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

