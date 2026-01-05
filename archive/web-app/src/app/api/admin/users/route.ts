import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching and ensure dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient();
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get all users from auth.users and join with profiles if they exist
    const page = Math.floor(offset / limit) + 1;
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
      page,
      perPage: limit
    });

    if (usersError) {
      console.error("[admin/users] Error fetching users:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const users = usersData?.users || [];

    // Get user profiles if users exist
    let profiles = null;
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("irc_user_profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) {
        console.error("[admin/users] Error fetching profiles:", profilesError);
        // Continue without profiles
      } else {
        profiles = profilesData;
      }
    }

    // Merge user data with profiles and roles
    const usersWithProfiles = users.map(user => {
      const profile = profiles?.find((p: any) => p.id === user.id);
      const role = profile?.role || "user"; // Default role is "user"
      return {
        id: user.id,
        email: user.email,
        role: role,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        ...profile
      };
    });

    // Note: Supabase admin API doesn't provide total count directly
    // This is an approximation. For accurate counts, you'd need to query the database directly
    return NextResponse.json({
      users: usersWithProfiles,
      total: usersWithProfiles.length, // Approximate - actual total may be higher
      limit,
      offset
    });
  } catch (error) {
    console.error("[admin/users] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

