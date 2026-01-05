import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/admin/devices
 * Get all devices (admin only)
 * 
 * Query params:
 * - limit: Number of devices to return (default: 100)
 * - offset: Offset for pagination (default: 0)
 * - status: Filter by status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const adminResult = await requireAdmin(request);
    if (isAdminError(adminResult)) {
      return adminResult;
    }

    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    // Build query
    let query = supabase
      .from("irc_devices")
      .select("device_id, name, device_name, status, hardware_id, owner_type, owner_id, assigned_tenant_id, company_id, created_at, updated_at, last_seen")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      query = query.eq("status", status);
    }

    const { data: devices, error } = await query;

    if (error) {
      console.error("[admin/devices] Error fetching devices:", error);
      return ApiErrors.serverError("Failed to fetch devices");
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("irc_devices")
      .select("*", { count: "exact", head: true });

    if (status) {
      countQuery = countQuery.eq("status", status);
    }

    const { count: totalCount } = await countQuery;

    return apiSuccess({
      devices: devices || [],
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[admin/devices] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
