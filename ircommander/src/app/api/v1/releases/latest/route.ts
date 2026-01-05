import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch the latest release
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .eq("is_latest", true)
      .single();

    if (error) {
      // If table doesn't exist or no latest release, fallback to storage URL
      console.warn("[releases/latest] Error fetching release:", error.message);
      return NextResponse.json({
        version: "1.0.1",
        download_url: `${serverEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/releases/iRCommander.exe`,
        filename: "iRCommander.exe",
        release_notes: "",
        published_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[releases/latest] Error:", error);
    // Fallback to storage URL
    return NextResponse.json({
      version: "1.0.1",
      download_url: `${serverEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/releases/iRCommander.exe`,
      filename: "iRCommander.exe",
      release_notes: "",
      published_at: new Date().toISOString(),
    });
  }
}
