import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "./supabase";
import { requireUser, isUserError } from "./tenant";
import { ApiErrors } from "./api-response";

/**
 * Check if a user has admin role
 */
export async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userResult = await requireUser(request);
  if (isUserError(userResult)) {
    return userResult;
  }

  const { userId } = userResult;
  const supabase = createSupabaseServiceClient();

  // Get user profile to check role
  const { data: profile, error } = await supabase
    .from("irc_user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return ApiErrors.forbidden("Unable to verify user role");
  }

  // Check if user is admin (role === "admin" or "super_admin")
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return ApiErrors.forbidden("Admin access required");
  }

  return { userId };
}

/**
 * Check if the result from requireAdmin is an error response
 */
export function isAdminError(result: { userId: string } | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
