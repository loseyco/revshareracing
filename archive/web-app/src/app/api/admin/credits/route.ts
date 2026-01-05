import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { isSuperAdminEmail } from "@/lib/admin";

/**
 * POST /api/admin/credits
 * Give credits to a user (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    
    // Verify super admin
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabaseClient = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!isSuperAdminEmail(user.email)) {
      // Also check database role
      const supabase = createSupabaseServiceClient();
      const { data: profile } = await supabase
        .from("irc_user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      
      if (profile?.role !== "super_admin") {
        return NextResponse.json(
          { error: "Super admin access required" },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { userId, amount, action } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (amount > 1000000) {
      return NextResponse.json(
        { error: "Maximum 1,000,000 credits per transaction" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Get current credits
    const { data: profile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("credits, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[admin/credits] Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile", details: profileError.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const currentCredits = profile.credits ?? 0;
    let newCredits: number;

    if (action === "set") {
      // Set credits to exact amount
      newCredits = amount;
    } else {
      // Default: add credits
      newCredits = currentCredits + amount;
    }

    // Update credits
    const { error: updateError } = await supabase
      .from("irc_user_profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error("[admin/credits] Error updating credits:", updateError);
      return NextResponse.json(
        { error: "Failed to update credits", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[admin/credits] ${user.email} gave ${amount} credits to user ${userId} (${profile.email}). Previous: ${currentCredits}, New: ${newCredits}`);

    return NextResponse.json({
      success: true,
      userId,
      previousCredits: currentCredits,
      creditsAdded: action === "set" ? newCredits - currentCredits : amount,
      newCredits,
      message: action === "set" 
        ? `Credits set to ${newCredits.toLocaleString()}`
        : `Added ${amount.toLocaleString()} credits. New balance: ${newCredits.toLocaleString()}`,
    });
  } catch (err) {
    console.error("[admin/credits] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}


