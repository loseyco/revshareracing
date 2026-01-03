import { NextRequest } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required")
});

/**
 * POST /api/v1/auth/refresh
 * Refresh an access token using a refresh token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { refresh_token } = parsed.data;
    const supabase = createSupabaseAnonClient();

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error("[auth/refresh] Token refresh failed:", error.message);
      return ApiErrors.unauthorized("Invalid or expired refresh token");
    }

    if (!data.session) {
      return ApiErrors.unauthorized("Token refresh failed - no session created");
    }

    return apiSuccess({
      user: {
        id: data.user?.id,
        email: data.user?.email
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      }
    });
  } catch (err) {
    console.error("[auth/refresh] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

