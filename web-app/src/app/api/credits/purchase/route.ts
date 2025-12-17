import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/credits/purchase
 * Purchase credits (free demo - up to 1000 credits total)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
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
        { error: "Invalid or expired session. Please log in again." },
        { status: 401 }
      );
    }

    const userId = user.id;
    const supabase = createSupabaseServiceClient();

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { amount } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Please specify a positive number of credits." },
        { status: 400 }
      );
    }

    // Demo limits: users can get up to 1000 credits for free
    const MAX_FREE_CREDITS = 1000;
    const MAX_CREDITS_PER_PURCHASE = 1000;

    // Check amount doesn't exceed max per purchase
    if (amount > MAX_CREDITS_PER_PURCHASE) {
      return NextResponse.json(
        { 
          error: `Maximum ${MAX_CREDITS_PER_PURCHASE} credits per purchase.`,
          maxPerPurchase: MAX_CREDITS_PER_PURCHASE
        },
        { status: 400 }
      );
    }

    // Get current user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("[purchaseCredits] Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch user profile", details: profileError.message },
        { status: 500 }
      );
    }

    const currentCredits = userProfile?.credits ?? 0;
    const newCredits = currentCredits + amount;

    // Check if adding these credits would exceed the free limit
    if (newCredits > MAX_FREE_CREDITS) {
      const availableToAdd = MAX_FREE_CREDITS - currentCredits;
      if (availableToAdd <= 0) {
        return NextResponse.json(
          { 
            error: `You have reached the maximum free credits limit (${MAX_FREE_CREDITS} credits).`,
            currentCredits,
            maxFreeCredits: MAX_FREE_CREDITS,
            availableToAdd: 0
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `You can only add up to ${MAX_FREE_CREDITS} total credits for free. You currently have ${currentCredits} credits. You can add ${availableToAdd} more credits.`,
          currentCredits,
          maxFreeCredits: MAX_FREE_CREDITS,
          availableToAdd,
          requestedAmount: amount
        },
        { status: 400 }
      );
    }

    // Update credits
    const { data: updatedProfile, error: updateError } = await supabase
      .from("irc_user_profiles")
      .update({ credits: newCredits })
      .eq("id", userId)
      .select("credits")
      .single();

    if (updateError) {
      console.error("[purchaseCredits] Error updating credits:", updateError);
      return NextResponse.json(
        { error: "Failed to add credits", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[purchaseCredits] Added ${amount} credits to user ${userId}. New balance: ${newCredits}`);

    return NextResponse.json({
      success: true,
      creditsAdded: amount,
      previousBalance: currentCredits,
      newBalance: newCredits,
      message: `Successfully added ${amount} credits! Your new balance is ${newCredits} credits ($${(newCredits / 100).toFixed(2)}).`
    });
  } catch (err) {
    console.error("[purchaseCredits] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

