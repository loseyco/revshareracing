import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

/**
 * GET /api/v1/auth/me
 * Get the current authenticated user's profile.
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

    // Get user profile from irc_user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("id, email, display_name, credits, role, iracing_connected, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[auth/me] Error fetching profile:", profileError);
      return ApiErrors.serverError("Failed to fetch user profile");
    }

    if (!profile) {
      return ApiErrors.notFound("User profile");
    }

    return apiSuccess({
      user: {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        credits: profile.credits || 0,
        role: profile.role || "user",
        iracing_connected: profile.iracing_connected || false,
        created_at: profile.created_at
      }
    });
  } catch (err) {
    console.error("[auth/me] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

