import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/admin/stats
 * Get overall platform statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin access
    const adminResult = await requireAdmin(request);
    if (isAdminError(adminResult)) {
      return adminResult;
    }

    const supabase = createSupabaseServiceClient();

    // Get total users count
    const { count: totalUsers } = await supabase
      .from("irc_user_profiles")
      .select("*", { count: "exact", head: true });

    // Get total devices count
    const { count: totalDevices } = await supabase
      .from("irc_devices")
      .select("*", { count: "exact", head: true });

    // Get total laps count
    const { count: totalLaps } = await supabase
      .from("irc_laps")
      .select("*", { count: "exact", head: true });

    // Get active devices count
    const { count: activeDevices } = await supabase
      .from("irc_devices")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Get users with credits
    const { data: usersWithCredits } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .gt("credits", 0);

    const totalCredits = usersWithCredits?.reduce((sum, user) => sum + (user.credits || 0), 0) || 0;

    return apiSuccess({
      total_users: totalUsers || 0,
      total_devices: totalDevices || 0,
      total_laps: totalLaps || 0,
      active_devices: activeDevices || 0,
      total_credits: totalCredits,
    });
  } catch (err) {
    console.error("[admin/stats] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
