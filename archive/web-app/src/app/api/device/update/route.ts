import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { isSuperAdminEmail, isAdminRole } from "@/lib/admin";

const updateSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  userId: z.string().optional() // User ID from client session
});

async function handleUpdate(request: Request) {
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

  const { deviceId, deviceName, location, address, latitude, longitude, city, region, country, postalCode, userId } = parsed.data;
  const supabase = createSupabaseServiceClient();
  
  // Geocode address if provided to get coordinates
  let geocodedData: {
    latitude?: number;
    longitude?: number;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  } = {};
  
  if (address && address.trim()) {
    try {
      // Small delay to respect Nominatim rate limits (1 request/second)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Use OpenStreetMap Nominatim for geocoding (free, no API key)
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'RevShareRacing-WebApp/1.0'
          }
        }
      );
      
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json();
        if (geocodeData && geocodeData.length > 0) {
          const result = geocodeData[0];
          // Validate parseFloat results to prevent NaN values
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          geocodedData = {
            latitude: !isNaN(lat) && isFinite(lat) ? lat : undefined,
            longitude: !isNaN(lon) && isFinite(lon) ? lon : undefined,
            city: result.address?.city || result.address?.town || result.address?.village,
            region: result.address?.state,
            country: result.address?.country,
            postalCode: result.address?.postcode
          };
        }
      }
    } catch (error) {
      console.error("[updateDevice] Geocoding error:", error);
      // Continue without geocoding - user can still save the address
    }
  }

  // First, verify the device exists and check ownership
  const { data: deviceRecord, error: fetchError } = await supabase
    .from("irc_devices")
    .select("device_id, owner_user_id, claimed")
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

  // Check if user is super admin
  let isSuperAdmin = false;
  if (userId) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        if (isSuperAdminEmail(userData.user.email)) {
          isSuperAdmin = true;
        } else {
          const { data: profile } = await supabase
            .from("irc_user_profiles")
            .select("role")
            .eq("id", userId)
            .maybeSingle();
          const role = profile?.role || "user";
          if (role === "super_admin" || (role === "admin" && isAdminRole(role))) {
            isSuperAdmin = true;
          }
        }
      }
    } catch (err) {
      // If admin check fails, continue as regular user
      console.warn("[updateDevice] Admin check failed:", err);
    }
  }

  // Verify device is claimed and user owns it (unless super admin)
  if (!deviceRecord.claimed && !isSuperAdmin) {
    return NextResponse.json(
      { error: "Device must be claimed before it can be updated." },
      { status: 403 }
    );
  }

  if (userId && deviceRecord.owner_user_id !== userId && !isSuperAdmin) {
    return NextResponse.json(
      { error: "You don't have permission to update this device." },
      { status: 403 }
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
  
  if (address !== undefined) {
    updates.address = address.trim() || null;
    // If address is cleared, also clear geocoded data
    if (!address.trim()) {
      updates.latitude = null;
      updates.longitude = null;
      updates.city = null;
      updates.region = null;
      updates.country = null;
      updates.postal_code = null;
    } else if (Object.keys(geocodedData).length > 0) {
      // Update coordinates and location data from geocoding
      // Validate that values are valid numbers (not NaN) before storing
      if (geocodedData.latitude !== undefined && 
          typeof geocodedData.latitude === 'number' && 
          !isNaN(geocodedData.latitude) && 
          isFinite(geocodedData.latitude)) {
        updates.latitude = geocodedData.latitude;
      }
      if (geocodedData.longitude !== undefined && 
          typeof geocodedData.longitude === 'number' && 
          !isNaN(geocodedData.longitude) && 
          isFinite(geocodedData.longitude)) {
        updates.longitude = geocodedData.longitude;
      }
      if (geocodedData.city) {
        updates.city = geocodedData.city;
      }
      if (geocodedData.region) {
        updates.region = geocodedData.region;
      }
      if (geocodedData.country) {
        updates.country = geocodedData.country;
      }
      if (geocodedData.postalCode) {
        updates.postal_code = geocodedData.postalCode;
      }
    }
  }
  
  // Direct coordinate updates (from browser geolocation)
  if (latitude !== undefined) {
    updates.latitude = latitude;
  }
  if (longitude !== undefined) {
    updates.longitude = longitude;
  }
  if (city !== undefined) {
    updates.city = city || null;
  }
  if (region !== undefined) {
    updates.region = region || null;
  }
  if (country !== undefined) {
    updates.country = country || null;
  }
  if (postalCode !== undefined) {
    updates.postal_code = postalCode || null;
  }

  const { data: updatedDevice, error: updateError } = await supabase
    .from("irc_devices")
    .update(updates)
    .eq("device_id", deviceId)
    .select()
    .single();

  if (updateError) {
    console.error("[updateDevice] updateError", updateError);
    const errorMessage = updateError.message || "";
    // Check if it's a foreign key constraint violation
    if (errorMessage.toLowerCase().includes("foreign key") || 
        errorMessage.toLowerCase().includes("violates foreign key constraint")) {
      return NextResponse.json(
        { error: "Invalid reference detected. Please refresh the page and try again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, device: updatedDevice });
}

// Support both POST and PATCH methods
export async function POST(request: Request) {
  return handleUpdate(request);
}

export async function PATCH(request: Request) {
  return handleUpdate(request);
}

