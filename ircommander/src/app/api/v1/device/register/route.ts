import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiResponse, apiError } from "@/lib/api-response";
import { z } from "zod";

const registerSchema = z.object({
  hardware_id: z.string().min(8).max(64),
  device_id: z.string().optional(),
  name: z.string().optional(),
  tenant_id: z.string().uuid().optional(),
  owner_type: z.enum(["tenant", "gridpass", "operator"]).optional().default("tenant"),
});

/**
 * POST /api/v1/device/register
 * 
 * Register a new device (rig) with the GridPass platform.
 * Returns a device API key for subsequent authenticated requests.
 * 
 * If the device already exists, returns the existing API key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.errors);
    }
    
    const { hardware_id, device_id, name, tenant_id, owner_type } = validation.data;
    
    // Generate device_id if not provided
    const finalDeviceId = device_id || `rig-${hardware_id.substring(0, 12)}`;
    
    // Debug: Check environment variables
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    console.log("[register] Environment check:", {
      serviceKeyLength: serviceKey.length,
      serviceKeyPrefix: serviceKey.substring(0, 30) + "...",
      supabaseUrl,
      hasServiceKey: !!serviceKey
    });
    
    const supabase = createSupabaseServiceClient();
    
    // Test Supabase connection by checking if we can query
    const { data: testData, error: testError } = await supabase
      .from("irc_devices")
      .select("device_id")
      .limit(1);
    
    if (testError) {
      console.error("[register] Supabase connection test failed:", {
        message: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint
      });
      return apiError(`Database connection failed: ${testError.message}`, 500);
    }
    
    console.log("[register] Supabase connection test passed");
    
    // Check if device already exists
    const { data: existingDevice } = await supabase
      .from("irc_devices")
      .select("device_id, device_name")
      .eq("device_id", finalDeviceId)
      .maybeSingle();
    
    let isNewDevice = false;
    
    if (!existingDevice) {
      // Create new device
      const insertData = {
        device_id: finalDeviceId,
        name: name || `Rig ${finalDeviceId.substring(4, 12)}`,
        hardware_id,
        company_id: tenant_id || null,
        assigned_tenant_id: tenant_id || null,
        owner_type,
        status: "inactive",
      };
      
      console.log("[register] Inserting device:", JSON.stringify(insertData, null, 2));
      
      const { data: insertedData, error: createError } = await supabase
        .from("irc_devices")
        .insert(insertData)
        .select();
      
      if (createError) {
        console.error("[register] Error creating device:", {
          message: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
          fullError: JSON.stringify(createError, null, 2)
        });
        
        // Check if it's an API key error specifically
        if (createError.message?.includes("Invalid API key") || createError.code === "PGRST301") {
          console.error("[register] API key validation failed - checking environment variables");
          return apiError(`Authentication failed: Please verify SUPABASE_SERVICE_ROLE_KEY is set correctly in Vercel environment variables. Error: ${createError.message}`, 500);
        }
        
        return apiError(`Failed to create device: ${createError.message}`, 500);
      }
      
      console.log("[register] Device created successfully:", insertedData);
      
      isNewDevice = true;
    }
    
    // Check for existing active API key
    const { data: existingKey, error: keyLookupError } = await supabase
      .from("irc_device_api_keys")
      .select("api_key, is_active, revoked_at, id")
      .eq("device_id", finalDeviceId)
      .eq("is_active", true)
      .is("revoked_at", null)
      .maybeSingle();
    
    if (keyLookupError) {
      console.error("[register] Error looking up existing key:", {
        message: keyLookupError.message,
        code: keyLookupError.code,
        details: keyLookupError.details
      });
    }
    
    if (existingKey) {
      console.log("[register] Found existing active API key for device:", {
        device_id: finalDeviceId,
        key_id: existingKey.id,
        api_key_preview: existingKey.api_key.substring(0, 30) + "...",
        is_active: existingKey.is_active,
        revoked_at: existingKey.revoked_at
      });
      
      // Verify the key can actually be used (double-check)
      const { data: verifyExisting, error: verifyErr } = await supabase
        .from("irc_device_api_keys")
        .select("id, api_key, is_active, revoked_at")
        .eq("api_key", existingKey.api_key)
        .eq("is_active", true)
        .is("revoked_at", null)
        .maybeSingle();
      
      if (verifyErr || !verifyExisting) {
        console.error("[register] WARNING: Existing key cannot be verified! Creating new one.", {
          verifyError: verifyErr,
          verifyResult: verifyExisting
        });
        // Fall through to create new key
      } else {
        return apiResponse({
          device_id: finalDeviceId,
          api_key: existingKey.api_key,
          is_new: false,
          message: "Device already registered, returning existing key",
        });
      }
    }
    
    console.log("[register] No active API key found, creating new one for device:", finalDeviceId);
    
    // Generate new API key
    const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    const apiKey = `irc_device_${finalDeviceId.substring(0, 12)}_${randomSuffix}`;
    
    // Insert the API key - use service client to bypass RLS
    console.log("[register] Inserting API key:", {
      device_id: finalDeviceId,
      api_key_preview: apiKey.substring(0, 30) + "...",
      api_key_length: apiKey.length
    });
    
    const { data: insertedKey, error: keyError } = await supabase
      .from("irc_device_api_keys")
      .insert({
        device_id: finalDeviceId,
        api_key: apiKey,
        name: "Auto-generated key",
        is_active: true, // Explicitly set to true
      })
      .select()
      .single();
    
    if (keyError) {
      console.error("[register] Error creating API key:", {
        message: keyError.message,
        code: keyError.code,
        details: keyError.details,
        hint: keyError.hint,
        fullError: JSON.stringify(keyError, null, 2)
      });
      console.error("[register] API key that failed:", apiKey);
      console.error("[register] Device ID:", finalDeviceId);
      
      // Check if device exists
      const { data: deviceCheck } = await supabase
        .from("irc_devices")
        .select("device_id")
        .eq("device_id", finalDeviceId)
        .maybeSingle();
      console.error("[register] Device exists check:", deviceCheck ? "YES" : "NO");
      
      return apiError("Failed to create API key", 500);
    }
    
    // Verify the key was inserted correctly
    if (!insertedKey) {
      console.error("[register] API key insert returned no data");
      return apiError("Failed to create API key - no data returned", 500);
    }
    
    console.log("[register] API key created successfully:", {
      id: insertedKey.id,
      device_id: insertedKey.device_id,
      api_key_preview: apiKey.substring(0, 30) + "...",
      is_active: insertedKey.is_active,
      full_api_key: apiKey  // Log full key for debugging
    });
    
    // Verify the key can be looked up immediately using the same service client
    const { data: verifyKey, error: verifyError } = await supabase
      .from("irc_device_api_keys")
      .select("id, api_key, is_active, revoked_at, device_id")
      .eq("api_key", apiKey)
      .maybeSingle();
    
    if (verifyError) {
      console.error("[register] ERROR: Key verification query failed:", {
        message: verifyError.message,
        code: verifyError.code,
        details: verifyError.details
      });
    } else if (!verifyKey) {
      console.error("[register] WARNING: Created key cannot be found immediately!");
      console.error("[register] This suggests an RLS policy or database issue.");
    } else {
      console.log("[register] Key verification successful:", {
        id: verifyKey.id,
        device_id: verifyKey.device_id,
        is_active: verifyKey.is_active,
        revoked_at: verifyKey.revoked_at,
        api_key_match: verifyKey.api_key === apiKey
      });
    }
    
    return apiResponse({
      device_id: finalDeviceId,
      api_key: apiKey,
      is_new: isNewDevice,
      message: isNewDevice ? "Device registered successfully" : "New API key generated",
    }, 201);
    
  } catch (error) {
    console.error("Device registration error:", error);
    return apiError("Internal server error", 500);
  }
}

