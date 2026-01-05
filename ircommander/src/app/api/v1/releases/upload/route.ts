import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for hobby plan

export async function POST(request: NextRequest) {
  try {
    // Check authorization - you might want to add proper auth here
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.UPLOAD_API_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const version = formData.get("version") as string;
    const releaseNotes = formData.get("releaseNotes") as string || "";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!version) {
      return NextResponse.json(
        { error: "No version provided" },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const filename = `iRCommander-${version}.exe`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    // Also upload as iRCommander.exe for latest
    const latestBlob = await put("iRCommander.exe", file, {
      access: "public",
      addRandomSuffix: false,
    });

    // Create version.json
    const versionData = {
      version: version,
      filename: "iRCommander.exe",
      release_notes: releaseNotes,
      published_at: new Date().toISOString(),
      size: file.size,
      download_url: latestBlob.url,
    };

    const versionBlob = await put("version.json", JSON.stringify(versionData, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      version: version,
      download_url: latestBlob.url,
      versioned_url: blob.url,
      version_json_url: versionBlob.url,
    });
  } catch (error: any) {
    console.error("[releases/upload] Error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
