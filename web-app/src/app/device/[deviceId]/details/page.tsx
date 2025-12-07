"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";

type DeviceInfo = {
  deviceId: string;
  deviceName?: string;
  status: string;
  location?: string;
  localIp?: string;
  publicIp?: string;
  lastSeen?: string;
  claimed?: boolean;
  ownerUserId?: string;
};

type LapStats = {
  totalLaps: number;
  bestLap: {
    lap_time: number;
    lap_number: number;
    track_id?: string;
    car_id?: string;
    timestamp: string;
  } | null;
  recentLaps: Array<{
    lap_id: string;
    lap_number: number;
    lap_time: number;
    track_id?: string;
    car_id?: string;
    timestamp: string;
  }>;
  lapsByTrack: Record<string, number>;
};

export default function DeviceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { session, loading: sessionLoading, supabase } = useSupabase();
  const deviceId = params.deviceId as string;
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [lapStats, setLapStats] = useState<LapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [iracingStatus, setIracingStatus] = useState<{
    iracingConnected: boolean;
    canExecuteCommands: boolean;
    reason: string | null;
    carState: {
      inCar: boolean | null;
      engineRunning: boolean | null;
    };
    telemetry: {
      speedKph: number | null;
      rpm: number | null;
      trackName: string | null;
      carName: string | null;
      currentLap: number | null;
      inPitStall: boolean | null;
      engineRunning: boolean | null;
    } | null;
  } | null>(null);

  useEffect(() => {
    if (!sessionLoading) {
      if (!session) {
        router.push(`/auth/login?redirectTo=/device/${deviceId}/details`);
        return;
      }
      fetchDeviceInfo();
      fetchLapStats();
      fetchIracingStatus(); // Initial fetch
      
      // Poll for lap stats updates (every 10 seconds) to catch new laps
      const lapStatsInterval = setInterval(() => {
        fetchLapStats();
      }, 10000);
      
      // Subscribe to real-time updates for this device
      let fallbackInterval: NodeJS.Timeout | null = null;
      
      const channel = supabase
        .channel(`device:${deviceId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'irc_devices',
            filter: `device_id=eq.${deviceId}`,
          },
          (payload) => {
            // Device data changed - fetch updated status immediately
            console.log('Device data updated via Realtime:', payload);
            fetchIracingStatus();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'irc_laps',
            filter: `device_id=eq.${deviceId}`,
          },
          (payload) => {
            // New lap recorded - refresh lap stats immediately
            console.log('New lap recorded via Realtime:', payload);
            fetchLapStats();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Real-time subscription active for device:', deviceId);
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Real-time subscription error - falling back to polling');
            // Fallback to polling if Realtime fails
            fallbackInterval = setInterval(() => {
              fetchIracingStatus();
            }, 5000);
          }
        });
      
      return () => {
        supabase.removeChannel(channel);
        clearInterval(lapStatsInterval);
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
        }
      };
    }
  }, [session, sessionLoading, deviceId, router, supabase]);

  const fetchDeviceInfo = async () => {
    try {
      const response = await fetch(`/api/device/info?deviceId=${deviceId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch device information");
      }
      const data = await response.json();
      
      // Check if device is claimed by current user
      if (data.claimed && data.ownerUserId !== session?.user.id) {
        setError("You don't have access to this device.");
        return;
      }
      
      setDeviceInfo(data);
      setEditName(data.deviceName || "");
      setEditLocation(data.location || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device information");
    } finally {
      setLoading(false);
    }
  };

  const fetchLapStats = async () => {
    try {
      // Add cache-busting parameter to ensure fresh data
      const response = await fetch(`/api/device/laps?deviceId=${deviceId}&_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[DeviceDetails] Fetched lap stats:`, data);
        setLapStats(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DeviceDetails] Failed to fetch lap stats:`, response.status, errorData);
      }
    } catch (err) {
      console.error("Failed to fetch lap statistics:", err);
    }
  };

  const pollCommandStatus = async (commandId: string, action: string, maxAttempts: number = 20) => {
    // Poll for command status updates to verify execution
    // For longer-running commands like reset_car, use a longer timeout
    let initialMaxAttempts: number;
    if (action === 'reset_car') {
      initialMaxAttempts = 120; // 60 seconds for reset_car (can take time with grace period, waiting for car to stop, etc.)
    } else if (action === 'enter_car') {
      initialMaxAttempts = 40; // 20 seconds for enter_car
    } else {
      initialMaxAttempts = 20; // 10 seconds for other commands
    }
    
    let attempts = 0;
    let timeoutShown = false;
    let finalMaxAttempts = initialMaxAttempts + 60; // Give extra time after initial timeout
    
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(`/api/device/${deviceId}/commands`);
        const data = await response.json();
        const command = data.commands?.find((cmd: any) => cmd.id === commandId);
        
        if (command) {
          if (command.status === 'completed') {
            clearInterval(pollInterval);
            setCommandMessage(`✓ ${action} completed successfully`);
            // Force status refresh to get updated state
            setTimeout(() => {
              fetchIracingStatus();
            }, 500);
            setTimeout(() => setCommandMessage(null), 5000);
            return;
          } else if (command.status === 'failed') {
            clearInterval(pollInterval);
            setCommandMessage(`✗ ${action} failed: ${command.error_message || 'Unknown error'}`);
            setTimeout(() => setCommandMessage(null), 5000);
            return;
          } else if (command.status === 'processing') {
            if (timeoutShown) {
              setCommandMessage(`Still processing ${action}... (this may take a while)`);
            } else {
              setCommandMessage(`Processing ${action}...`);
            }
          }
        }
        
        // Show timeout warning but continue polling
        if (attempts >= initialMaxAttempts && !timeoutShown) {
          setCommandMessage(`Command ${action} taking longer than expected (still checking status...)`);
          timeoutShown = true;
        }
        
        // Final timeout - stop polling
        if (attempts >= finalMaxAttempts) {
          clearInterval(pollInterval);
          setCommandMessage(`Command ${action} status unknown (may still be processing)`);
          setTimeout(() => setCommandMessage(null), 5000);
        }
      } catch (err) {
        if (attempts >= finalMaxAttempts) {
          clearInterval(pollInterval);
        }
      }
    }, 500); // Poll every 500ms
  };

  const fetchIracingStatus = async () => {
    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/device/${deviceId}/status?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[DeviceDetails] Fetched iRacing status:`, data);
        setIracingStatus(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DeviceDetails] Status API error:`, response.status, errorData);
        // If status endpoint fails, assume not connected
        setIracingStatus({
          iracingConnected: false,
          canExecuteCommands: false,
          reason: "Unable to check status",
          carState: {
            inCar: null,
            engineRunning: null,
          },
          telemetry: null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch iRacing status:", err);
      setIracingStatus({
        iracingConnected: false,
        canExecuteCommands: false,
        reason: "Unable to check status",
        carState: {
          inCar: null,
          engineRunning: null,
        },
        telemetry: null,
      });
    }
  };

  const handleSave = async () => {
    if (!deviceInfo) return;
    
    setSaving(true);
    try {
      const response = await fetch("/api/device/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceInfo.deviceId,
          deviceName: editName.trim() || undefined,
          location: editLocation.trim() || undefined,
          userId: session?.user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update device");
      }

      await fetchDeviceInfo();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setSaving(false);
    }
  };

  const queueCommand = async (action: string, params?: Record<string, any>) => {
    if (!deviceInfo || !deviceInfo.claimed) {
      console.warn(`[queueCommand] Cannot queue command - device not claimed`);
      setCommandMessage("Device must be claimed before queuing commands");
      return;
    }
    
    setCommandLoading(true);
    setCommandMessage(null);
    
    try {
      console.log(`[queueCommand] Queuing command: action=${action}, params=`, params);
      const response = await fetch(`/api/device/${deviceId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner",
          action: action,
          params: params || {}
        })
      });

      console.log(`[queueCommand] Response status: ${response.status}, ok: ${response.ok}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[queueCommand] Error response:`, errorData);
        const errorMessage = errorData.error || errorData.details || "Failed to queue command";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[queueCommand] Success response:`, data);
      const commandId = data.command?.id;
      
      if (commandId) {
        // Poll for command status updates
        pollCommandStatus(commandId, action);
        setCommandMessage(`Command queued: ${action}`);
      } else {
        console.warn(`[queueCommand] No command ID in response:`, data);
        setCommandMessage(`Command queued: ${action}`);
        setTimeout(() => setCommandMessage(null), 3000);
      }
    } catch (err) {
      console.error(`[queueCommand] Exception:`, err);
      const errorMessage = err instanceof Error ? err.message : "Failed to queue command";
      setCommandMessage(errorMessage);
    } finally {
      setCommandLoading(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <section className="space-y-4 sm:space-y-6 animate-fade-in w-full px-3 sm:px-4 md:px-6">
        <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading device details...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4 sm:space-y-6 animate-fade-in w-full px-3 sm:px-4 md:px-6">
        <div className="glass rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center">
            <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Error</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <Link href="/dashboard" className="btn-primary inline-flex">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!deviceInfo) {
    return null;
  }

  return (
    <section className="space-y-4 sm:space-y-6 animate-fade-in w-full px-3 sm:px-4 md:px-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="btn-secondary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-white gradient-text">Device Details</h1>
      </div>

      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input text-xl sm:text-2xl font-bold"
                    placeholder="Device name"
                  />
                </div>
              ) : (
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {deviceInfo.deviceName || "Unnamed Rig"}
                </h2>
              )}
              <p className="text-sm text-slate-400 font-mono">{deviceInfo.deviceId}</p>
            </div>
            {deviceInfo.claimed && deviceInfo.ownerUserId === session?.user.id && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditName(deviceInfo.deviceName || "");
                        setEditLocation(deviceInfo.location || "");
                      }}
                      className="btn-secondary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-secondary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Device Information</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-sm text-slate-500">Location</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="input text-sm flex-1 max-w-[200px] ml-4"
                    placeholder="Location"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-200">{deviceInfo.location || "Not set"}</span>
                )}
              </div>
              {deviceInfo.localIp && (
                <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                  <span className="text-sm text-slate-500">Local IP</span>
                  <span className="text-sm font-mono text-slate-200">{deviceInfo.localIp}</span>
                </div>
              )}
              {deviceInfo.publicIp && (
                <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                  <span className="text-sm text-slate-500">Public IP</span>
                  <span className="text-sm font-mono text-slate-200">{deviceInfo.publicIp}</span>
                </div>
              )}
              {deviceInfo.lastSeen && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">Last Seen</span>
                  <span className="text-sm text-slate-200">{new Date(deviceInfo.lastSeen).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                <span className="text-sm text-slate-500">Claim Status</span>
                <span className={`text-sm font-medium ${deviceInfo.claimed ? "text-red-400" : "text-slate-400"}`}>
                  {deviceInfo.claimed ? "Claimed" : "Unclaimed"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500">PC Service</span>
                <span className="text-sm font-medium text-slate-200">
                  {iracingStatus?.iracingConnected ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {lapStats && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Lap Statistics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                  <span className="text-sm text-slate-500">Total Laps</span>
                  <span className="text-lg font-bold text-red-400">{lapStats.totalLaps.toLocaleString()}</span>
                </div>
                {lapStats.bestLap && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                    <span className="text-sm text-slate-500">Best Lap</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-red-400">{lapStats.bestLap.lap_time.toFixed(3)}s</span>
                      {lapStats.bestLap.track_id && (
                        <p className="text-xs text-slate-400">{lapStats.bestLap.track_id}</p>
                      )}
                    </div>
                  </div>
                )}
                {Object.keys(lapStats.lapsByTrack).length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 mb-2">Laps by Track</p>
                    <div className="space-y-1">
                      {Object.entries(lapStats.lapsByTrack)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([track, count]) => (
                          <div key={track} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 truncate flex-1">{track}</span>
                            <span className="text-slate-200 font-medium ml-2">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {lapStats && lapStats.recentLaps.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Recent Laps</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lapStats.recentLaps.map((lap) => (
                  <div key={lap.lap_id} className="flex items-center justify-between py-2 border-b border-slate-800/30 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Lap {lap.lap_number}</span>
                        <span className="text-red-400 font-mono font-semibold">{lap.lap_time.toFixed(3)}s</span>
                      </div>
                      {lap.track_id && (
                        <p className="text-xs text-slate-500 truncate">{lap.track_id}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 ml-4">
                      {new Date(lap.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deviceInfo.claimed && deviceInfo.ownerUserId === session?.user.id && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Remote Controls</h3>
              
              {/* iRacing Status Indicator */}
              {iracingStatus && (
                <div className={`mb-4 p-4 rounded-lg text-sm border ${
                  iracingStatus.iracingConnected
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : "bg-red-500/20 text-red-300 border-red-500/30"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        iracingStatus.iracingConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                      }`}></div>
                      <span className="font-medium">
                        {iracingStatus.iracingConnected 
                          ? "iRacing Connected"
                          : "iRacing Not Connected"}
                      </span>
                    </div>
                    {!iracingStatus.iracingConnected && iracingStatus.reason && (
                      <span className="text-xs text-red-200/80">
                        {iracingStatus.reason}
                      </span>
                    )}
                  </div>
                  
                  {/* Car State - Show even if other telemetry isn't available yet */}
                  {iracingStatus.iracingConnected && iracingStatus.carState?.inCar !== null && (
                    <div className="space-y-2 pt-2 border-t border-current/20">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Status:</span>
                        <span className="font-medium">
                          {iracingStatus.carState.inCar ? "In Car" : "Out of Car"}
                          {iracingStatus.telemetry?.inPitStall && " • In Pit"}
                        </span>
                      </div>
                      {iracingStatus.carState.inCar && iracingStatus.carState.engineRunning !== null && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Engine:</span>
                          <span className="font-medium">
                            {iracingStatus.carState.engineRunning ? "Running" : "Off"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Telemetry Information - Only show when in car */}
                  {iracingStatus.iracingConnected && iracingStatus.telemetry && iracingStatus.carState?.inCar === true && (
                    <div className="space-y-2 pt-2 border-t border-current/20">
                      
                      {/* Track and Car */}
                      {(iracingStatus.telemetry.trackName || iracingStatus.telemetry.carName) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Track:</span>
                          <span className="font-medium truncate ml-2">
                            {iracingStatus.telemetry.trackName || "Unknown"}
                          </span>
                        </div>
                      )}
                      {iracingStatus.telemetry.carName && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Car:</span>
                          <span className="font-medium truncate ml-2">
                            {iracingStatus.telemetry.carName}
                          </span>
                        </div>
                      )}
                      
                      {/* Speed and RPM removed - too fast to verify, not needed for control */}
                      
                      {/* Current Lap */}
                      {iracingStatus.telemetry.currentLap !== null && iracingStatus.telemetry.currentLap > 0 && (
                        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-current/10">
                          <span className="text-slate-400">Current Lap:</span>
                          <span className="font-medium">
                            Lap {iracingStatus.telemetry.currentLap}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show message when out of car */}
                  {iracingStatus.iracingConnected && iracingStatus.carState?.inCar === false && (
                    <div className="mt-2 pt-2 border-t border-current/20 text-xs text-slate-400">
                      Out of car - Use "Enter Car" button to get in the car
                    </div>
                  )}
                  
                  {/* Fallback when connected but no telemetry yet - only show if car state is also unknown */}
                  {iracingStatus.iracingConnected && !iracingStatus.telemetry && iracingStatus.carState?.inCar === null && (
                    <div className="mt-2 pt-2 border-t border-current/20 text-xs text-slate-400">
                      Waiting for telemetry data...
                    </div>
                  )}
                  
                  {/* Show message when we have car state but no other telemetry yet */}
                  {iracingStatus.iracingConnected && !iracingStatus.telemetry && iracingStatus.carState?.inCar !== null && (
                    <div className="mt-2 pt-2 border-t border-current/20 text-xs text-slate-400">
                      Telemetry data will appear here when available
                    </div>
                  )}
                </div>
              )}
              
              {commandMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  commandMessage.includes("queued") 
                    ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                    : "bg-red-600/20 text-red-400 border border-red-600/30"
                }`}>
                  {commandMessage}
                </div>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                {/* Show Reset Car if in car, Enter Car if not in car */}
                {iracingStatus?.carState?.inCar === true ? (
                  <button
                    onClick={() => queueCommand("reset_car", { grace_period: 0 })}
                    disabled={commandLoading || !iracingStatus?.canExecuteCommands}
                    className="btn-primary text-xs sm:text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!iracingStatus?.canExecuteCommands ? iracingStatus?.reason || "iRacing not connected" : "Reset car to pits"}
                  >
                    {commandLoading ? "..." : "Reset Car"}
                  </button>
                ) : (
                  <button
                    onClick={() => queueCommand("enter_car")}
                    disabled={commandLoading || !iracingStatus?.canExecuteCommands || !iracingStatus?.iracingConnected}
                    className="btn-primary text-xs sm:text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!iracingStatus?.canExecuteCommands ? iracingStatus?.reason || "iRacing not connected" : "Enter car"}
                  >
                    {commandLoading ? "..." : "Enter Car"}
                  </button>
                )}
                {/* Only show Ignition button when in car */}
                {iracingStatus?.carState?.inCar === true && (
                  <button
                    onClick={() => queueCommand("ignition")}
                    disabled={commandLoading || !iracingStatus?.canExecuteCommands}
                    className="btn-primary text-xs sm:text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!iracingStatus?.canExecuteCommands ? iracingStatus?.reason || "iRacing not connected" : 
                      (iracingStatus?.carState?.engineRunning ? "Turn off ignition" : "Turn on ignition")}
                  >
                    {commandLoading ? "..." : 
                      (iracingStatus?.carState?.engineRunning ? "Turn Off Ignition" : "Turn On Ignition")}
                  </button>
                )}
                {/* Only show Pit Speed Limiter when in car */}
                {iracingStatus?.carState?.inCar === true && (
                  <button
                    onClick={() => queueCommand("pit_speed_limiter")}
                    disabled={commandLoading || !iracingStatus?.canExecuteCommands}
                    className="btn-primary text-xs sm:text-sm py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!iracingStatus?.canExecuteCommands ? iracingStatus?.reason || "iRacing not connected" : "Toggle pit speed limiter"}
                  >
                    {commandLoading ? "..." : "Pit Speed Limiter"}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Commands are queued and executed by the PC service. Check the Controls Log tab in the PC service GUI to see execution status.
                {!iracingStatus?.canExecuteCommands && (
                  <span className="block mt-2 text-yellow-400">
                    ⚠️ Buttons are disabled because {iracingStatus?.reason || "iRacing is not connected"}.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

