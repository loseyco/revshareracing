import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { requireUser, isUserError } from "@/lib/tenant";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { z } from "zod";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const purchaseSchema = z.object({
  amount: z.number().int().positive().min(100, "Minimum purchase is 100 credits"),
  // In a real implementation, this would include payment details
  payment_method: z.enum(["test", "stripe", "paypal"]).optional().default("test")
});

/**
 * POST /api/v1/credits/purchase
 * Purchase credits for the authenticated user.
 * 
 * Note: This is a simplified implementation. In production,
 * you would integrate with a payment provider like Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const userResult = await requireUser(request);
    if (isUserError(userResult)) {
      return userResult;
    }

    const { userId } = userResult;
    const body = await request.json().catch(() => ({}));

    // Validate input
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.format());
    }

    const { amount, payment_method } = parsed.data;
    const supabase = createSupabaseServiceClient();

    // Get current balance
    const { data: profile, error: profileError } = await supabase
      .from("irc_user_profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[credits/purchase] Error fetching profile:", profileError);
      return ApiErrors.serverError("Failed to fetch current balance");
    }

    const currentCredits = profile?.credits ?? 0;

    // In production, you would:
    // 1. Create a payment intent with Stripe
    // 2. Wait for payment confirmation
    // 3. Then add credits

    // For test mode, just add the credits directly
    if (payment_method === "test") {
      const newCredits = currentCredits + amount;
      
      const { error: updateError } = await supabase
        .from("irc_user_profiles")
        .update({ credits: newCredits })
        .eq("id", userId);

      if (updateError) {
        console.error("[credits/purchase] Error updating credits:", updateError);
        return ApiErrors.serverError("Failed to add credits");
      }

      return apiSuccess({
        message: `Added ${amount} credits (test mode)`,
        credits_purchased: amount,
        previous_balance: currentCredits,
        new_balance: newCredits,
        payment_method: "test"
      });
    }

    // For real payment methods, return instructions
    return apiSuccess({
      message: "Payment processing not yet implemented",
      payment_method,
      amount,
      // In production, you would return a payment URL or client secret
      payment_url: null
    });
  } catch (err) {
    console.error("[credits/purchase] Exception:", err);
    return ApiErrors.serverError();
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

