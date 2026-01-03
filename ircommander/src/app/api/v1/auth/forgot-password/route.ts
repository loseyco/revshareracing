import { NextRequest } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * POST /api/v1/auth/forgot-password
 * Send password reset email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { email } = parsed.data;
    const supabase = createSupabaseAnonClient();

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.NEXT_PUBLIC_IRCOMMANDER_URL || 'https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app'}/auth/reset-password`,
    });

    if (error) {
      console.error("[auth/forgot-password] Reset failed:", error.message);
      // Don't reveal if email exists or not for security
      return apiSuccess({
        message: "If an account exists with this email, a password reset link has been sent."
      });
    }

    return apiSuccess({
      message: "If an account exists with this email, a password reset link has been sent."
    });
  } catch (err) {
    console.error("[auth/forgot-password] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
