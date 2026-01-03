import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "./supabase";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  api_key_hash: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantContext {
  tenant: Tenant;
  apiKey: string;
}

export interface Device {
  device_id: string;
  name: string;
  status: string;
  owner_type: "tenant" | "gridpass" | "operator";
  owner_id: string | null;
  assigned_tenant_id: string | null;
  company_id: string | null;
  hardware_id: string | null;
}

export interface DeviceContext {
  device: Device;
  apiKey: string;
}

/**
 * Validate a tenant API key and return the tenant context.
 * API key should be passed in the X-Tenant-Key header.
 */
export async function validateTenantKey(request: NextRequest): Promise<TenantContext | null> {
  const apiKey = request.headers.get("X-Tenant-Key");
  
  if (!apiKey) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  
  // Look up the API key and join with tenant
  const { data: apiKeyRecord, error: keyError } = await supabase
    .from("irc_api_keys")
    .select(`
      id,
      tenant_id,
      scopes,
      is_active,
      expires_at
    `)
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (keyError || !apiKeyRecord) {
    return null;
  }

  // Check expiration
  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    return null;
  }

  // Get the tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("irc_tenants")
    .select("*")
    .eq("id", apiKeyRecord.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (tenantError || !tenant) {
    return null;
  }

  // Update last_used_at on the API key
  await supabase
    .from("irc_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyRecord.id);

  return {
    tenant,
    apiKey
  };
}

/**
 * Middleware helper to require tenant authentication.
 * Returns the tenant context or an error response.
 */
export async function requireTenant(request: NextRequest): Promise<TenantContext | NextResponse> {
  const context = await validateTenantKey(request);
  
  if (!context) {
    return NextResponse.json(
      { 
        error: "Unauthorized", 
        message: "Valid X-Tenant-Key header required" 
      },
      { status: 401 }
    );
  }

  return context;
}

/**
 * Check if the result from requireTenant is an error response.
 */
export function isTenantError(result: TenantContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Validate user authentication token.
 * Token should be passed in the Authorization header as "Bearer <token>".
 */
export async function validateUserToken(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseServiceClient();
  
  // Verify the Supabase auth token
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email || ""
  };
}

/**
 * Middleware helper to require user authentication.
 */
export async function requireUser(request: NextRequest): Promise<{ userId: string; email: string } | NextResponse> {
  const user = await validateUserToken(request);
  
  if (!user) {
    return NextResponse.json(
      { 
        error: "Unauthorized", 
        message: "Valid Authorization Bearer token required" 
      },
      { status: 401 }
    );
  }

  return user;
}

/**
 * Check if the result from requireUser is an error response.
 */
export function isUserError(result: { userId: string; email: string } | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

// ============================================
// DEVICE AUTHENTICATION
// ============================================

/**
 * Validate a device API key and return the device context.
 * API key should be passed in the X-Device-Key header.
 */
export async function validateDeviceKey(request: NextRequest): Promise<DeviceContext | null> {
  const apiKey = request.headers.get("X-Device-Key");
  
  if (!apiKey) {
    console.error("[validateDeviceKey] No X-Device-Key header found");
    return null;
  }

  console.log("[validateDeviceKey] Starting lookup for:", apiKey.substring(0, 30) + "...");

  const supabase = createSupabaseServiceClient();
  
  // Look up the device API key - use same query pattern as test-key endpoint (proven to work)
  // Don't filter in query, check is_active/revoked_at in code instead
  const { data: keyRecord, error: keyError } = await supabase
    .from("irc_device_api_keys")
    .select("id, device_id, api_key, is_active, revoked_at")
    .eq("api_key", apiKey)
    .maybeSingle();
  
  console.log("[validateDeviceKey] Query result:", {
    found: !!keyRecord,
    error: keyError ? keyError.message : null,
    key_id: keyRecord?.id,
    is_active: keyRecord?.is_active
  });

  if (keyError) {
    console.error("[validateDeviceKey] Database error:", keyError);
    return null;
  }

  if (!keyRecord) {
    console.error("[validateDeviceKey] API key not found in database");
    return null;
  }

  // Check if key is active and not revoked (do this in code, not query)
  if (!keyRecord.is_active || keyRecord.revoked_at) {
    console.error("[validateDeviceKey] Key exists but is inactive or revoked:", {
      id: keyRecord.id,
      is_active: keyRecord.is_active,
      revoked_at: keyRecord.revoked_at
    });
    return null;
  }

  // Get the device
  const { data: device, error: deviceError } = await supabase
    .from("irc_devices")
    .select("device_id, name, status, owner_type, owner_id, assigned_tenant_id, company_id, hardware_id")
    .eq("device_id", keyRecord.device_id)
    .maybeSingle();

  if (deviceError) {
    console.error("[validateDeviceKey] Device lookup error:", deviceError);
    return null;
  }

  if (!device) {
    console.error("[validateDeviceKey] Device not found for device_id:", keyRecord.device_id);
    return null;
  }

  // Update last_used_at on the device API key
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  
  await supabase
    .from("irc_device_api_keys")
    .update({ 
      last_used_at: new Date().toISOString(),
      last_ip: clientIp
    })
    .eq("id", keyRecord.id);

  return {
    device: device as Device,
    apiKey
  };
}

/**
 * Middleware helper to require device authentication.
 * Returns the device context or an error response.
 */
export async function requireDevice(request: NextRequest): Promise<DeviceContext | NextResponse> {
  const context = await validateDeviceKey(request);
  
  if (!context) {
    return NextResponse.json(
      { 
        error: "Unauthorized", 
        message: "Valid X-Device-Key header required" 
      },
      { status: 401 }
    );
  }

  return context;
}

/**
 * Check if the result from requireDevice is an error response.
 */
export function isDeviceError(result: DeviceContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Validate device key from query parameter (for registration endpoint).
 * This is used when a device doesn't have a key yet.
 */
export async function validateRegistrationRequest(request: NextRequest): Promise<{
  hardwareId: string;
  deviceId: string;
  tenantId?: string;
} | null> {
  try {
    const body = await request.json();
    
    // Hardware ID is required for fingerprinting
    if (!body.hardware_id || typeof body.hardware_id !== "string") {
      return null;
    }
    
    // Device ID can be provided or will be generated
    const deviceId = body.device_id || `rig-${body.hardware_id.substring(0, 12)}`;
    
    return {
      hardwareId: body.hardware_id,
      deviceId,
      tenantId: body.tenant_id
    };
  } catch {
    return null;
  }
}

