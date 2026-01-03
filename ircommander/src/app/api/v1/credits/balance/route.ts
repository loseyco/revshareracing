import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/v1/credits/balance
 * Get the current credit balance for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    // Require authenticated user
    const userResult = await requireUser(request);
    if (isUserError(userResult)) {
      return userResult;
    }

    const { userId } = userResult;
    const supabase = createSupabaseServiceClient();

    const { data: profile, error } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[credits/balance] Error:", error);
      return ApiErrors.serverError("Failed to fetch balance");
    }

    return apiSuccess({
      credits: profile?.credits ?? 0,
      session_cost: 100 // Cost per session in credits
    });
  } catch (err) {
    console.error("[credits/balance] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

