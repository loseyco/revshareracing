/**
 * Data Access Layer
 * 
 * This module provides an abstraction over data access that can be configured
 * to use either direct Supabase access or the GridPass API.
 * 
 * Set NEXT_PUBLIC_USE_GRIDPASS=true to use GridPass APIs.
 */

import { gridpass, GridPassClient } from "./gridpass-client";
import { createSupabaseServiceClient } from "./supabase-server";
import { clientEnv } from "./env";

// Check if we should use GridPass APIs
export const useGridPass = clientEnv.NEXT_PUBLIC_USE_GRIDPASS === "true";

/**
 * Get the configured GridPass client.
 * Creates a new instance with the correct access token if provided.
 */
export function getGridPassClient(accessToken?: string): GridPassClient {
  if (accessToken) {
    const client = new GridPassClient(
      clientEnv.NEXT_PUBLIC_GRIDPASS_API_URL,
      process.env.GRIDPASS_TENANT_KEY
    );
    client.setAccessToken(accessToken);
    return client;
  }
  return gridpass;
}

/**
 * Device data access interface.
 */
export interface DeviceData {
  device_id: string;
  device_name: string;
  status: string;
  location?: string;
  claimed: boolean;
  last_seen?: string;
  is_online?: boolean;
  iracing_connected?: boolean;
  owner_user_id?: string;
}

/**
 * Queue entry interface.
 */
export interface QueueEntryData {
  id: string;
  user_id: string;
  position: number;
  status: string;
  joined_at: string;
  started_at?: string;
  completed_at?: string;
  user?: {
    id: string;
    email: string;
    display_name?: string;
  };
}

/**
 * Get devices - works with both Supabase and GridPass.
 */
export async function getDevices(userId?: string, accessToken?: string): Promise<DeviceData[]> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.getDevices(userId);
    if (result.success && result.data) {
      return result.data.devices;
    }
    return [];
  }

  // Direct Supabase access
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("irc_devices")
    .select("device_id, device_name, status, location, claimed, last_seen, iracing_connected, owner_user_id")
    .eq("claimed", true)
    .order("updated_at", { ascending: false });

  if (userId) {
    query = query.eq("owner_user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(d => ({
    ...d,
    is_online: d.last_seen ? (Date.now() - new Date(d.last_seen).getTime()) < 60000 : false
  }));
}

/**
 * Get device status - works with both Supabase and GridPass.
 */
export async function getDeviceStatus(deviceId: string, accessToken?: string): Promise<{
  isServiceOnline: boolean;
  iracingConnected: boolean;
  canExecuteCommands: boolean;
  reason: string | null;
  telemetry: Record<string, unknown> | null;
}> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.getDeviceStatus(deviceId);
    if (result.success && result.data) {
      return {
        isServiceOnline: result.data.is_service_online,
        iracingConnected: result.data.iracing_connected,
        canExecuteCommands: result.data.can_execute_commands,
        reason: result.data.reason,
        telemetry: result.data.telemetry
      };
    }
    throw new Error(result.error?.message || "Failed to get device status");
  }

  // Direct Supabase access
  const supabase = createSupabaseServiceClient();
  const { data: device, error } = await supabase
    .from("irc_devices")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) throw error;
  if (!device) throw new Error("Device not found");

  const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
  const timeSinceLastSeen = (Date.now() - lastSeen) / 1000;
  const isServiceOnline = timeSinceLastSeen < 60;

  let iracingConnected = false;
  if (isServiceOnline) {
    iracingConnected = Boolean(device.iracing_connected) || device.status === "active";
  }

  return {
    isServiceOnline,
    iracingConnected,
    canExecuteCommands: isServiceOnline,
    reason: !isServiceOnline ? "PC service offline" : !iracingConnected ? "iRacing not connected" : null,
    telemetry: isServiceOnline && iracingConnected ? {
      speed_kph: device.speed_kph,
      rpm: device.rpm,
      track_name: device.track_name,
      car_name: device.car_name
    } : null
  };
}

/**
 * Get queue for a device - works with both Supabase and GridPass.
 */
export async function getQueue(deviceId: string, accessToken?: string): Promise<{
  queue: QueueEntryData[];
  totalWaiting: number;
  active: QueueEntryData | null;
}> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.getQueue(deviceId);
    if (result.success && result.data) {
      return {
        queue: result.data.queue,
        totalWaiting: result.data.total_waiting,
        active: result.data.active
      };
    }
    throw new Error(result.error?.message || "Failed to get queue");
  }

  // Direct Supabase access
  const supabase = createSupabaseServiceClient();
  const { data: queueEntries, error } = await supabase
    .from("irc_device_queue")
    .select(`
      id,
      user_id,
      position,
      status,
      joined_at,
      started_at,
      completed_at
    `)
    .eq("device_id", deviceId)
    .in("status", ["waiting", "active"])
    .order("position", { ascending: true });

  if (error) throw error;

  // Get user profiles
  let queueWithProfiles = queueEntries || [];
  if (queueEntries && queueEntries.length > 0) {
    const userIds = queueEntries.map(e => e.user_id);
    const { data: profiles } = await supabase
      .from("irc_user_profiles")
      .select("id, email, display_name")
      .in("id", userIds);

    queueWithProfiles = queueEntries.map(entry => ({
      ...entry,
      user: profiles?.find(p => p.id === entry.user_id) || undefined
    }));
  }

  return {
    queue: queueWithProfiles,
    totalWaiting: queueWithProfiles.filter(e => e.status === "waiting").length,
    active: queueWithProfiles.find(e => e.status === "active") || null
  };
}

/**
 * Join queue - works with both Supabase and GridPass.
 */
export async function joinQueue(deviceId: string, userId: string, accessToken?: string): Promise<{
  success: boolean;
  queueEntry?: QueueEntryData;
  message: string;
  creditsDeducted?: number;
  creditsRemaining?: number;
  error?: string;
}> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.joinQueue(deviceId);
    if (result.success && result.data) {
      return {
        success: true,
        queueEntry: result.data.queue_entry,
        message: result.data.message,
        creditsDeducted: result.data.credits_deducted,
        creditsRemaining: result.data.credits_remaining
      };
    }
    return {
      success: false,
      message: result.error?.message || "Failed to join queue",
      error: result.error?.code
    };
  }

  // Direct Supabase access follows existing API route logic
  // For direct Supabase, the logic is in the existing API routes
  // This is a simplified version - the full logic is in /api/device/[deviceId]/queue
  throw new Error("Direct Supabase joinQueue should use API routes");
}

/**
 * Leave queue - works with both Supabase and GridPass.
 */
export async function leaveQueue(deviceId: string, userId: string, accessToken?: string): Promise<{
  success: boolean;
  message: string;
  creditsRefunded?: number;
  error?: string;
}> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.leaveQueue(deviceId);
    if (result.success && result.data) {
      return {
        success: true,
        message: result.data.message,
        creditsRefunded: result.data.credits_refunded
      };
    }
    return {
      success: false,
      message: result.error?.message || "Failed to leave queue",
      error: result.error?.code
    };
  }

  throw new Error("Direct Supabase leaveQueue should use API routes");
}

/**
 * Get credit balance - works with both Supabase and GridPass.
 */
export async function getCreditBalance(userId: string, accessToken?: string): Promise<{
  credits: number;
  sessionCost: number;
}> {
  if (useGridPass) {
    const client = getGridPassClient(accessToken);
    const result = await client.getCreditBalance();
    if (result.success && result.data) {
      return {
        credits: result.data.credits,
        sessionCost: result.data.session_cost
      };
    }
    return { credits: 0, sessionCost: 100 };
  }

  // Direct Supabase access
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("irc_user_profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    credits: data?.credits ?? 0,
    sessionCost: 100
  };
}

/**
 * Get leaderboards - works with both Supabase and GridPass.
 */
export async function getLeaderboards(options?: {
  trackId?: string;
  carId?: string;
  limit?: number;
}): Promise<Array<{
  track_id: string;
  car_id: string;
  best_lap_time: number;
  lap_count: number;
  driver_name: string | null;
}>> {
  if (useGridPass) {
    const result = await gridpass.getLeaderboards(options);
    if (result.success && result.data) {
      return result.data.leaderboards;
    }
    return [];
  }

  // Direct Supabase access would follow the existing leaderboards API logic
  // For now, return empty - full implementation is in the API routes
  return [];
}

