import { NextRequest } from "next/server";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

/**
 * POST /api/v1/auth/login
 * Authenticate a user and return access tokens.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { email, password } = parsed.data;
    const supabase = createSupabaseAnonClient();

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), // Normalize email
      password
    });

    if (error) {
      console.error("[auth/login] Login failed:", error.message);
      console.error("[auth/login] Error code:", error.status);
      console.error("[auth/login] Error details:", JSON.stringify(error));
      console.error("[auth/login] Email attempted:", email.trim().toLowerCase());
      console.error("[auth/login] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "MISSING");
      console.error("[auth/login] Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "MISSING");
      // Don't expose exact error to client for security, but log it
      return ApiErrors.unauthorized("Invalid email or password");
    }

    if (!data.session) {
      return ApiErrors.unauthorized("Login failed - no session created");
    }

    // Get user's tenant info
    const serviceClient = createSupabaseServiceClient();
    const { data: profile } = await serviceClient
      .from("irc_user_profiles")
      .select("company_id, irc_tenants:company_id(id, name, slug)")
      .eq("id", data.user.id)
      .maybeSingle();
    
    const tenant = profile?.irc_tenants as unknown as { id: string; name: string; slug: string } | null;

    return apiSuccess({
      user: {
        id: data.user.id,
        email: data.user.email,
        tenant_id: tenant?.id || profile?.company_id || null,
        tenant_name: tenant?.name || null,
        created_at: data.user.created_at
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in
    });
  } catch (err) {
    console.error("[auth/login] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

