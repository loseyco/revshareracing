import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/admin/commands/{commandId}
 * Get command status (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commandId: string }> }
) {
  try {
    const { commandId } = await params;
    
    // Require admin access
    const adminResult = await requireAdmin(request);
    if (isAdminError(adminResult)) {
      return adminResult;
    }

    const supabase = createSupabaseServiceClient();

    // Get command details
    const { data: command, error } = await supabase
      .from("irc_device_commands")
      .select("*")
      .eq("id", commandId)
      .maybeSingle();

    if (error) {
      console.error("[admin/commands] Error fetching command:", error);
      return ApiErrors.serverError("Failed to fetch command");
    }

    if (!command) {
      return ApiErrors.notFound("Command");
    }

    return apiSuccess({
      command,
    });
  } catch (err) {
    console.error("[admin/commands] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
