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
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
      page: Math.floor(offset / limit) + 1,
      perPage: limit
    });

    if (usersError) {
      console.error("[admin/users] Error fetching users:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // Get user profiles
    const userIds = users.users.map(u => u.id);
    const { data: profiles, error: profilesError } = await supabase
      .from("irc_user_profiles")
      .select("*")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("[admin/users] Error fetching profiles:", profilesError);
      // Continue without profiles
    }

    // Merge user data with profiles
    const usersWithProfiles = users.users.map(user => {
      const profile = profiles?.find(p => p.user_id === user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        ...profile
      };
    });

    // Get total count
    const { count: totalCount } = await supabase.auth.admin.listUsers();

    return NextResponse.json({
      users: usersWithProfiles,
      total: totalCount || usersWithProfiles.length,
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

