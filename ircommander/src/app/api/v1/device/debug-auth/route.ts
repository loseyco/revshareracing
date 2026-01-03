/**
 * Debug endpoint to test device authentication
 * POST /api/v1/device/debug-auth
 * Headers: X-Device-Key
 */
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiResponse, apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("X-Device-Key");
    
    if (!apiKey) {
      return apiError("X-Device-Key header required", 400);
    }
    
    const supabase = createSupabaseServiceClient();
    
    // Test the exact same query as validateDeviceKey
    const { data: keyRecord, error: keyError } = await supabase
      .from("irc_device_api_keys")
      .select("id, device_id, api_key, is_active, revoked_at")
      .eq("api_key", apiKey)
      .maybeSingle();
    
    return apiResponse({
      header_received: !!apiKey,
      api_key_preview: apiKey.substring(0, 30) + "...",
      api_key_length: apiKey.length,
      query_result: {
        found: !!keyRecord,
        error: keyError ? {
          message: keyError.message,
          code: keyError.code,
          details: keyError.details
        } : null,
        key_record: keyRecord ? {
          id: keyRecord.id,
          device_id: keyRecord.device_id,
          is_active: keyRecord.is_active,
          revoked_at: keyRecord.revoked_at,
          api_key_match: keyRecord.api_key === apiKey
        } : null
      },
      validation: keyRecord ? {
        is_active: keyRecord.is_active,
        not_revoked: !keyRecord.revoked_at,
        valid: keyRecord.is_active && !keyRecord.revoked_at
      } : null
    });
  } catch (err) {
    console.error("[debug-auth] Error:", err);
    return apiError("Internal server error", 500);
  }
}
