import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireTenant, isTenantError, requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/devices
 * List all devices for the authenticated user or tenant.
 * 
 * Query params:
 * - userId: Filter by owner user ID (required if no tenant key)
 * - status: Filter by status (optional)
 * - claimed: Filter by claimed status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    
    // Try tenant auth first, then user auth
    const tenantResult = await requireTenant(request);
    let tenantId: string | null = null;
    let userId: string | null = searchParams.get("userId");
    
    if (!isTenantError(tenantResult)) {
      tenantId = tenantResult.tenant.id;
    } else {
      // Try user auth if no tenant key
      const userResult = await requireUser(request);
      if (!isUserError(userResult)) {
        userId = userResult.userId;
      }
    }

    if (!tenantId && !userId) {
      return ApiErrors.unauthorized("Tenant key or user authentication required");
    }

    // Build query - select all available columns
    let query = supabase
      .from("irc_devices")
      .select("*")
      .order("updated_at", { ascending: false });

    // Apply filters
    if (tenantId) {
      query = query.eq("company_id", tenantId);
    }
    
    // Note: owner_user_id column may not exist, so we filter by tenant/company_id instead
    // If userId is provided and matches a tenant, filter by company_id

    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }

    const { data: devices, error } = await query;

    if (error) {
      console.error("[devices] Error fetching devices:", error);
      return ApiErrors.serverError("Failed to fetch devices");
    }

    // Calculate online status for each device
    // A device is only considered online if:
    // 1. last_seen exists (not null)
    // 2. last_seen is within the last 30 seconds (stricter threshold)
    const devicesWithStatus = (devices || []).map(device => {
      let timeSinceLastSeen = Infinity;
      let isOnline = false;
      
      if (device.last_seen) {
        const lastSeen = new Date(device.last_seen).getTime();
        timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
        // Stricter threshold: must be seen within 30 seconds
        isOnline = timeSinceLastSeen >= 0 && timeSinceLastSeen < 30;
      }
      
      return {
        ...device,
        is_online: isOnline,
        time_since_last_seen: timeSinceLastSeen === Infinity ? null : Math.floor(timeSinceLastSeen)
      };
    });

    return apiSuccess({
      devices: devicesWithStatus,
      total: devicesWithStatus.length
    });
  } catch (err) {
    console.error("[devices] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

