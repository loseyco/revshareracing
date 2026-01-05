import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/profile - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("[profile] Error fetching profile:", profileError);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    // If profile doesn't exist, return basic info from auth
    if (!profile) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        display_name: null,
        role: "user",
        credits: 0,
        created_at: user.created_at
      });
    }

    return NextResponse.json({
      ...profile,
      credits: profile.credits ?? 0, // Ensure credits is always a number
      email: user.email // Always use email from auth
    });
  } catch (error) {
    console.error("[profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServiceClient();

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { display_name } = body;

    // Validate input
    if (display_name !== undefined && display_name !== null) {
      if (typeof display_name !== "string") {
        return NextResponse.json({ error: "display_name must be a string" }, { status: 400 });
      }
      if (display_name.length > 100) {
        return NextResponse.json({ error: "display_name must be 100 characters or less" }, { status: 400 });
      }
    }

    // Prepare update data (only allow updating display_name, not role or other fields)
    const updateData: { display_name?: string | null } = {};
    if (display_name !== undefined) {
      updateData.display_name = display_name === "" ? null : display_name.trim() || null;
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("irc_user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    let result;
    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from("irc_user_profiles")
        .update(updateData)
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        console.error("[profile] Error updating profile:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }

      result = data;
    } else {
      // Create new profile if it doesn't exist
      const { data, error } = await supabase
        .from("irc_user_profiles")
        .insert({
          id: user.id,
          email: user.email,
          role: "user",
          display_name: updateData.display_name || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("[profile] Error creating profile:", error);
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({
      ...result,
      email: user.email // Always use email from auth
    });
  } catch (error) {
    console.error("[profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

