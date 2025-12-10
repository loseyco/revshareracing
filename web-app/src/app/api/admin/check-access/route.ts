import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import { checkAdminAccess } from "@/lib/admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Check if the current user has admin access
 * This endpoint can be used to verify admin status on the client
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

    // Check admin access
    const hasAccess = checkAdminAccess(user.email);

    return NextResponse.json({
      isAdmin: hasAccess,
      email: user.email
    });
  } catch (error) {
    console.error("[admin/check-access] Error:", error);
    return NextResponse.json(
      { isAdmin: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

