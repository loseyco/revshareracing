import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();

    // Public map shows all devices with location data (both claimed and unclaimed)
    // This is a public endpoint - no authentication required
    const { data: devices, error: fetchError } = await supabase
      .from("irc_devices")
      .select("device_id, device_name, latitude, longitude, city, region, country, iracing_connected, last_seen, claimed")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("device_id", { ascending: true });

    if (fetchError) {
      console.error("[rigs/map] fetchError", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`[rigs/map] Found ${devices?.length || 0} devices with location data`);
    
    // Log each device's coordinates for debugging
    devices?.forEach((device) => {
      console.log(`[rigs/map] Device ${device.device_id}: lat=${device.latitude}, lon=${device.longitude}, isNaN(lat)=${isNaN(device.latitude)}, isNaN(lon)=${isNaN(device.longitude)}`);
    });

    // Filter to only include devices with valid coordinates
    // Handle both number and string types for coordinates
    const rigsWithLocation = (devices || []).map((device) => {
      // Convert to numbers if they're strings
      const lat = typeof device.latitude === 'string' ? parseFloat(device.latitude) : device.latitude;
      const lon = typeof device.longitude === 'string' ? parseFloat(device.longitude) : device.longitude;
      
      return {
        ...device,
        latitude: lat,
        longitude: lon
      };
    }).filter(
      (device) => {
        const isValid = device.latitude !== null &&
          device.longitude !== null &&
          device.latitude !== undefined &&
          device.longitude !== undefined &&
          typeof device.latitude === 'number' &&
          typeof device.longitude === 'number' &&
          !isNaN(device.latitude) &&
          !isNaN(device.longitude) &&
          isFinite(device.latitude) &&
          isFinite(device.longitude) &&
          device.latitude >= -90 && device.latitude <= 90 &&
          device.longitude >= -180 && device.longitude <= 180;
        
        if (!isValid) {
          console.log(`[rigs/map] Filtered out device ${device.device_id}: lat=${device.latitude} (type: ${typeof device.latitude}), lon=${device.longitude} (type: ${typeof device.longitude})`);
        }
        
        return isValid;
      }
    );

    console.log(`[rigs/map] Returning ${rigsWithLocation.length} devices with valid coordinates`);
    
    return NextResponse.json({ rigs: rigsWithLocation });
  } catch (error) {
    console.error("[rigs/map] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

