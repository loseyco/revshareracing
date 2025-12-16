import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/device/[deviceId]/queue/complete
 * Mark the active driver's queue entry as completed
 * This is called automatically when a timed session ends
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const supabase = createSupabaseServiceClient();

  try {
    // Find the active driver for this device
    const { data: activeEntry, error: findError } = await supabase
      .from("irc_device_queue")
      .select("id, user_id")
      .eq("device_id", deviceId)
      .eq("status", "active")
      .maybeSingle();

    if (findError) {
      console.error("[completeDriver] Error finding active entry:", findError);
      return NextResponse.json(
        { error: "Failed to find active driver", details: findError.message },
        { status: 500 }
      );
    }

    if (!activeEntry) {
      // No active driver - this is fine, just return success
      return NextResponse.json({
        success: true,
        message: "No active driver to complete",
      });
    }

    // Mark as completed
    const { data: updatedEntry, error: updateError } = await supabase
      .from("irc_device_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", activeEntry.id)
      .select()
      .single();

    if (updateError) {
      console.error("[completeDriver] Error updating queue entry:", updateError);
      return NextResponse.json(
        { error: "Failed to complete driver session", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queueEntry: updatedEntry,
      message: "Driver session marked as completed",
    });
  } catch (err) {
    console.error("[completeDriver] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

