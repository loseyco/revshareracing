import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { checkAdminAccess, isSuperAdminEmail, isAdminRole } from "@/lib/admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Check if the current user has admin access (checks both hardcoded list and database roles)
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ isAdmin: false, error: "No authorization header" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();

    // Verify the token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ isAdmin: false, error: "Invalid token" }, { status: 401 });
    }

    const userEmail = user.email;

    // Check hardcoded super admin list
    if (isSuperAdminEmail(userEmail)) {
      return NextResponse.json({
        isAdmin: true,
        isSuperAdmin: true,
        role: "super_admin",
        email: userEmail
      });
    }

    // Check database role
    const { data: profile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("role")
        .eq("id", user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("[admin/check-role] Error fetching profile:", profileError);
    }

    const role = profile?.role || "user";
    const hasAdminAccess = isAdminRole(role);

    return NextResponse.json({
      isAdmin: hasAdminAccess,
      isSuperAdmin: role === "super_admin",
      role: role,
      email: userEmail
    });
  } catch (error) {
    console.error("[admin/check-role] Error:", error);
    return NextResponse.json(
      { isAdmin: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

