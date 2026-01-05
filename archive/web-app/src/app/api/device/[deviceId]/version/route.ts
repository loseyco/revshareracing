import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/device/[deviceId]/version
 * Get PC service version info including current version and latest available version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = createSupabaseServiceClient();

    // Get device info including version
    // Use * to avoid errors if pc_service_version column doesn't exist yet
    const { data: device, error: deviceError } = await supabase
      .from("irc_devices")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (deviceError) {
      console.error(`[getVersion] Database error for deviceId=${deviceId}:`, deviceError);
      return NextResponse.json(
        { error: "Database error", details: deviceError.message },
        { status: 500 }
      );
    }

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    // Access pc_service_version if it exists
    const currentVersion = (device as any).pc_service_version || null;

    // Check if service is online
    const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
    const now = Date.now();
    const timeSinceLastSeen = (now - lastSeen) / 1000; // seconds
    const isServiceOnline = timeSinceLastSeen < 60;

    // Get latest version from GitHub
    let latestVersion: string | null = null;
    let updateAvailable = false;
    let releaseUrl: string | null = null;
    let downloadUrl: string | null = null;

    try {
      const githubResponse = await fetch(
        'https://api.github.com/repos/loseyco/revshareracing/releases/latest',
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RevShareRacing-WebApp',
          },
          next: { revalidate: 300 }, // Cache for 5 minutes
        }
      );

      if (githubResponse.ok) {
        const release = await githubResponse.json();
        latestVersion = release.tag_name || null;
        releaseUrl = release.html_url || null;

        // Find the RevShareRacing.exe asset
        const exeAsset = release.assets?.find((asset: any) =>
          asset.name === 'RevShareRacing.exe' || asset.name.toLowerCase().includes('revshareracing')
        );

        if (exeAsset && latestVersion) {
          const tagName = latestVersion;
          downloadUrl = `https://github.com/loseyco/revshareracing/releases/download/${tagName}/RevShareRacing.exe`;
        }

        // Compare versions if we have both
        if (currentVersion && latestVersion) {
          updateAvailable = isNewerVersion(latestVersion.replace(/^v/, ''), currentVersion.replace(/^v/, ''));
        }
      }
    } catch (error) {
      console.error("[getVersion] Error fetching latest release:", error);
      // Continue without latest version info
    }

    return NextResponse.json({
      currentVersion: currentVersion,
      latestVersion: latestVersion,
      updateAvailable: updateAvailable,
      isUpToDate: currentVersion && latestVersion ? !updateAvailable : null,
      releaseUrl: releaseUrl,
      downloadUrl: downloadUrl,
      isServiceOnline: isServiceOnline,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Simple version comparison (semantic versioning)
 */
function isNewerVersion(latest: string, current: string): boolean {
  try {
    const latestParts = latest.split('.').map(x => parseInt(x, 10));
    const currentParts = current.split('.').map(x => parseInt(x, 10));

    // Pad to same length
    const maxLen = Math.max(latestParts.length, currentParts.length);
    while (latestParts.length < maxLen) latestParts.push(0);
    while (currentParts.length < maxLen) currentParts.push(0);

    // Compare from left to right
    for (let i = 0; i < maxLen; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false; // Same version
  } catch {
    // If parsing fails, do string comparison
    return latest > current;
  }
}

