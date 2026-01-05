import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/admin/users
 * Get all users (admin only)
 * 
 * Query params:
 * - limit: Number of users to return (default: 100)
 * - offset: Offset for pagination (default: 0)
 * - search: Search by email or display_name (optional)
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
    const search = searchParams.get("search") || "";

    // Build query
    let query = supabase
      .from("irc_user_profiles")
      .select("id, email, display_name, credits, credit_balance, role, company_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error("[admin/users] Error fetching users:", error);
      return ApiErrors.serverError("Failed to fetch users");
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("irc_user_profiles")
      .select("*", { count: "exact", head: true });

    if (search) {
      countQuery = countQuery.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { count: totalCount } = await countQuery;

    return apiSuccess({
      users: users || [],
      total: totalCount || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[admin/users] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
