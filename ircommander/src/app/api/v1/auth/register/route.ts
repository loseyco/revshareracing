import { NextRequest } from "next/server";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "@/lib/supabase";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  display_name: z.string().min(1, "Display name is required").max(50, "Display name too long").optional()
});

/**
 * POST /api/v1/auth/register
 * Create a new user account.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { email, password, display_name } = parsed.data;
    const supabase = createSupabaseAnonClient();

    // Create the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: display_name || email.split("@")[0]
        }
      }
    });

    if (error) {
      console.error("[auth/register] Registration failed:", error.message);
      console.error("[auth/register] Error code:", error.status);
      console.error("[auth/register] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "MISSING");
      console.error("[auth/register] Anon Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "MISSING");
      
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        return ApiErrors.conflict("An account with this email already exists");
      }
      
      // Check for API key errors
      if (error.message.includes("Invalid API key") || error.message.includes("JWT")) {
        return ApiErrors.badRequest("Server configuration error. Please contact support.");
      }
      
      return ApiErrors.badRequest(error.message || "Registration failed");
    }

    if (!data.user) {
      return ApiErrors.serverError("Registration failed - no user created");
    }

    // Create the user profile in irc_user_profiles
    // This requires service role key, but we'll try and continue if it fails
    try {
      const serviceSupabase = createSupabaseServiceClient();
      const { error: profileError } = await serviceSupabase
        .from("irc_user_profiles")
        .insert({
          id: data.user.id,
          email: data.user.email,
          display_name: display_name || email.split("@")[0],
          credits: 0
        });

      if (profileError) {
        console.error("[auth/register] Profile creation failed:", profileError);
        // Don't fail registration if profile creation fails - it can be created later
        // This might happen if SUPABASE_SERVICE_ROLE_KEY is missing
      }
    } catch (profileErr) {
      console.error("[auth/register] Profile creation error (service role key may be missing):", profileErr);
      // Continue - user is created, profile can be created later
    }

    return apiSuccess({
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      },
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      } : null,
      message: data.session 
        ? "Account created successfully" 
        : "Account created - please check your email to verify your account"
    });
  } catch (err) {
    console.error("[auth/register] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

