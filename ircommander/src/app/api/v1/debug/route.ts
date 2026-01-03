import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/debug
 * Debug endpoint to check environment variables (remove in production!)
 */
export async function GET(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  return NextResponse.json({
    service_key_length: serviceKey.length,
    service_key_prefix: serviceKey.substring(0, 30),
    service_key_suffix: serviceKey.substring(serviceKey.length - 20),
    url_length: url.length,
    url: url,
    anon_key_length: anonKey.length,
    anon_key_prefix: anonKey.substring(0, 30),
  });
}


