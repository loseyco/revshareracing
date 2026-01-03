import { NextRequest } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

/**
 * POST /api/v1/auth/reset-password
 * Reset password using the session from email link.
 * Note: Supabase sends tokens in URL hash, which should be extracted client-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { password, access_token, refresh_token } = parsed.data;
    
    if (!access_token) {
      return ApiErrors.badRequest("Reset token is required. Please use the link from your email.");
    }

    const supabase = createSupabaseAnonClient();
    
    // Set the session from the tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token || ""
    });

    if (sessionError || !sessionData.session) {
      console.error("[auth/reset-password] Session error:", sessionError?.message);
      return ApiErrors.badRequest("Invalid or expired reset token. Please request a new password reset.");
    }

    // Update password using the session
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error("[auth/reset-password] Reset failed:", error.message);
      return ApiErrors.badRequest(error.message);
    }

    if (!data.user) {
      return ApiErrors.serverError("Password reset failed");
    }

    return apiSuccess({
      message: "Password has been reset successfully. You can now sign in with your new password.",
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  } catch (err) {
    console.error("[auth/reset-password] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
