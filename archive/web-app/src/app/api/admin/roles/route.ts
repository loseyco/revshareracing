import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { checkAdminAccess, isSuperAdminEmail, isAdminRole } from "@/lib/admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/admin/roles
 * Get all users with their roles
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Forbidden - Invalid token" }, { status: 403 });
    }

    // Check admin access: either hardcoded super admin OR database role
    const isSuperAdmin = isSuperAdminEmail(user.email);
    if (!isSuperAdmin) {
      // Check database role
      const { data: profile } = await supabase
        .from("irc_user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      
      const role = profile?.role || "user";
      if (!isAdminRole(role)) {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
      }
    }

    // Get all users
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (usersError) {
      console.error("[admin/roles] Error fetching users:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const users = usersData?.users || [];

    // Get user profiles with roles
    const userIds = users.map(u => u.id);
    const { data: profiles, error: profilesError } = await supabase
      .from("irc_user_profiles")
      .select("*")
      .in("id", userIds.length > 0 ? userIds : ["dummy"]);

    if (profilesError && profilesError.code !== "PGRST116") {
      console.error("[admin/roles] Error fetching profiles:", profilesError);
    }

    // Merge user data with profiles and roles
    const usersWithRoles = users.map(user => {
      const profile = profiles?.find((p: any) => p.id === user.id);
      const role = profile?.role || "user"; // Default role is "user"
      return {
        id: user.id,
        email: user.email,
        role: role,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at
      };
    });

    return NextResponse.json({ users: usersWithRoles });
  } catch (error) {
    console.error("[admin/roles] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/roles
 * Update a user's role
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Forbidden - Invalid token" }, { status: 403 });
    }

    // Check admin access: either hardcoded super admin OR database role
    const isSuperAdmin = isSuperAdminEmail(user.email);
    if (!isSuperAdmin) {
      // Check database role
      const { data: profile } = await supabase
        .from("irc_user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      
      const role = profile?.role || "user";
      if (!isAdminRole(role)) {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    // Get user email from auth.users
    const { data: targetUser, error: userFetchError } = await supabase.auth.admin.getUserById(userId);
    if (userFetchError || !targetUser?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userEmail = targetUser.user.email;

    // Validate role - check against database constraint
    // Common roles: user, admin, super_admin, driver
    const validRoles = ["user", "admin", "super_admin", "driver"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 });
    }

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("irc_user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[admin/roles] Error fetching profile:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existingProfile) {
      // Update existing profile (also update email in case it changed)
      const { data, error } = await supabase
        .from("irc_user_profiles")
        .update({ 
          role,
          email: userEmail // Update email in case it changed in auth.users
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        console.error("[admin/roles] Error updating role:", error);
        // Check if it's a constraint violation
        if (error.message?.includes("check constraint") || error.code === "23514") {
          return NextResponse.json({ 
            error: `Role "${role}" is not allowed by the database constraint. Please check the irc_user_profiles_role_check constraint in your database.` 
          }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, user: data });
    } else {
      // Create new profile with role and email
      const { data, error } = await supabase
        .from("irc_user_profiles")
        .insert({
          id: userId,
          email: userEmail,
          role
        })
        .select()
        .single();

      if (error) {
        console.error("[admin/roles] Error creating profile:", error);
        // Check if it's a constraint violation
        if (error.message?.includes("check constraint") || error.code === "23514") {
          return NextResponse.json({ 
            error: `Role "${role}" is not allowed by the database constraint. Please check the irc_user_profiles_role_check constraint in your database.` 
          }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, user: data });
    }
  } catch (error) {
    console.error("[admin/roles] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

