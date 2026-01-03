/**
 * Test endpoint to check if an API key exists in the database
 * GET /api/v1/device/test-key?api_key=...
 */
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { apiResponse, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.nextUrl.searchParams.get("api_key");
    
    if (!apiKey) {
      return apiError("api_key parameter required", 400);
    }
    
    const supabase = createSupabaseServiceClient();
    
    // Try to find the key
    const { data: keyRecord, error: keyError } = await supabase
      .from("irc_device_api_keys")
      .select("id, device_id, api_key, is_active, revoked_at, created_at")
      .eq("api_key", apiKey)
      .maybeSingle();
    
    if (keyError) {
      return apiResponse({
        found: false,
        error: keyError.message,
        code: keyError.code,
        details: keyError.details
      });
    }
    
    if (!keyRecord) {
      // Check if ANY key exists with similar prefix
      const prefix = apiKey.substring(0, 30);
      const { data: similarKeys } = await supabase
        .from("irc_device_api_keys")
        .select("id, device_id, api_key, is_active")
        .like("api_key", `${prefix}%`)
        .limit(5);
      
      return apiResponse({
        found: false,
        message: "Key not found",
        similar_keys: similarKeys?.map(k => ({
          id: k.id,
          device_id: k.device_id,
          api_key_preview: k.api_key.substring(0, 40) + "...",
          is_active: k.is_active
        }))
      });
    }
    
    // Check if it's active
    const isUsable = keyRecord.is_active && !keyRecord.revoked_at;
    
    return apiResponse({
      found: true,
      usable: isUsable,
      key: {
        id: keyRecord.id,
        device_id: keyRecord.device_id,
        is_active: keyRecord.is_active,
        revoked_at: keyRecord.revoked_at,
        created_at: keyRecord.created_at,
        api_key_match: keyRecord.api_key === apiKey
      }
    });
  } catch (err) {
    console.error("[test-key] Error:", err);
    return apiError("Internal server error", 500);
  }
}
