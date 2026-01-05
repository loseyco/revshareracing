"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";

type QueueEntry = {
  id: string;
  user_id: string;
  position: number;
  status: "waiting" | "active" | "completed" | "cancelled";
  joined_at: string;
  started_at?: string;
  became_position_one_at?: string;
  irc_user_profiles?: {
    id: string;
    email: string;
    display_name?: string;
  } | null;
};

type DeviceStatus = {
  isServiceOnline: boolean;
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
};

type LeaderboardEntry = {
  track_id: string;
  track_config: string | null;
  car_id: string;
  best_lap_time: number;
  lap_count: number;
  best_lap_timestamp: string;
  best_lap_device_id: string;
  device_name: string | null;
  driver_id: string | null;
  driver_email: string | null;
  driver_name: string | null;
};

type RecentLap = {
  lap_id: string;
  lap_number: number;
  lap_time: number;
  track_id?: string;
  car_id?: string;
  timestamp: string;
};

export default function DriverPage() {
  const params = useParams();
  const router = useRouter();
  const { session, supabase } = useSupabase();
  const deviceId = params.deviceId as string;

  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [queueData, setQueueData] = useState<{
    queue: QueueEntry[];
    totalWaiting: number;
    active: QueueEntry | null;
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentLaps, setRecentLaps] = useState<RecentLap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [timedSessionRemaining, setTimedSessionRemaining] = useState<number | null>(null);
  const [positionOneTimer, setPositionOneTimer] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [movementStatus, setMovementStatus] = useState<{
    waiting: boolean;
    speed: number | null;
    detected: boolean;
  } | null>(null);
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string | null;
    latestVersion: string | null;
    updateAvailable: boolean;
    isUpToDate: boolean | null;
    isServiceOnline: boolean;
    downloadUrl?: string | null;
  } | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format lap time as MM:SS.mmm
  const formatLapTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(3);
    return minutes > 0 ? `${minutes}:${seconds.padStart(6, "0")}` : `${seconds}s`;
  };

  // Format countdown as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch user credits
  const fetchUserCredits = useCallback(async () => {
    if (!session) {
      setUserCredits(null);
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits ?? 0);
      }
    } catch (err) {
      console.error("[fetchUserCredits] Error:", err);
    }
  }, [session, supabase]);

  // Fetch device status
  const fetchDeviceStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/status?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setDeviceStatus(data);
      }
    } catch (err) {
      console.error("[fetchDeviceStatus] Error:", err);
    }
  }, [deviceId]);

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/queue`);
      if (!response.ok) {
        throw new Error("Failed to fetch queue");
      }
      const data = await response.json();
      
      setDeviceName(data.device?.device_name || null);
      setQueueData({
        queue: data.queue || [],
        totalWaiting: data.totalWaiting || 0,
        active: data.active || null,
      });

      // Check user position
      if (session?.user?.id) {
        const userEntry = data.queue?.find((entry: QueueEntry) => entry.user_id === session.user.id);
        if (userEntry) {
          setUserPosition(userEntry.position);
          setUserStatus(userEntry.status);
        } else {
          setUserPosition(null);
          setUserStatus(null);
        }
      }

      // Calculate position 1 timer
      const positionOneEntry = data.queue?.find((entry: QueueEntry) => entry.position === 1 && entry.status === "waiting");
      const hasActiveDriver = data.queue?.some((entry: QueueEntry) => entry.status === "active");
      
      if (positionOneEntry && positionOneEntry.became_position_one_at && !hasActiveDriver) {
        const becameAt = new Date(positionOneEntry.became_position_one_at).getTime();
        const elapsed = Math.floor((Date.now() - becameAt) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setPositionOneTimer(remaining);
      } else {
        setPositionOneTimer(null);
      }
    } catch (err) {
      console.error("[fetchQueue] Error:", err);
    }
  }, [deviceId, session]);

  // Fetch timed session status
  const fetchTimedSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/timed-session`);
      if (response.ok) {
        const data = await response.json();
        const sessionState = data.sessionState;
        
        if (sessionState && sessionState.active) {
          const elapsed = Math.floor((Date.now() - sessionState.startTime) / 1000);
          const remaining = sessionState.duration - elapsed;
          setTimedSessionRemaining(remaining > 0 ? remaining : null);
        } else if (sessionState && sessionState.waitingForMovement) {
          // Show movement waiting status
          setMovementStatus({
            waiting: true,
            speed: deviceStatus?.telemetry?.speedKph ?? null,
            detected: (deviceStatus?.telemetry?.speedKph ?? 0) > 5
          });
          setTimedSessionRemaining(null);
        } else {
          setTimedSessionRemaining(null);
          setMovementStatus(null);
        }
      }
    } catch (err) {
      console.error("[fetchTimedSession] Error:", err);
    }
  }, [deviceId, deviceStatus?.telemetry?.speedKph]);

  // Fetch leaderboard for current track/car
  const fetchLeaderboard = useCallback(async (trackId: string, carId: string) => {
    try {
      const params = new URLSearchParams();
      if (trackId) params.append("trackId", trackId);
      if (carId) params.append("carId", carId);
      
      const response = await fetch(`/api/leaderboards?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.leaderboards || [])
          .filter((entry: LeaderboardEntry) => 
            entry.track_id === trackId && entry.car_id === carId
          )
          .slice(0, 10);
        setLeaderboard(filtered);
      }
    } catch (err) {
      console.error("[fetchLeaderboard] Error:", err);
    }
  }, []);

  // Fetch recent laps
  const fetchRecentLaps = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/laps?deviceId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setRecentLaps(data.recentLaps || []);
      }
    } catch (err) {
      console.error("[fetchRecentLaps] Error:", err);
    }
  }, [deviceId]);

  // Fetch version info
  const fetchVersionInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/version?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setVersionInfo(data);
      }
    } catch (err) {
      console.error("[fetchVersionInfo] Error:", err);
    }
  }, [deviceId]);

  // Join queue
  const handleJoinQueue = async () => {
    if (!session) {
      router.push(`/auth/login?redirectTo=/device/${deviceId}/driver`);
      return;
    }

    setJoining(true);
    setMessage(null);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        router.push(`/auth/login?redirectTo=/device/${deviceId}/driver`);
        return;
      }

      const response = await fetch(`/api/device/${deviceId}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join queue");
      }

      setMessage(data.message || "Successfully joined the queue!");
      await fetchQueue();
      await fetchUserCredits();
      // Trigger header refresh
      window.dispatchEvent(new CustomEvent("refresh-credits"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join queue");
    } finally {
      setJoining(false);
    }
  };

  // Leave queue
  const handleLeaveQueue = async () => {
    if (!session) return;

    setLeaving(true);
    setMessage(null);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) return;

      // If user is active, also exit car and clear session
      if (userStatus === "active") {
        await fetch(`/api/device/${deviceId}/commands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "driver",
            action: "reset_car",
            params: { grace_period: 0 }
          })
        }).catch(console.error);

        await fetch(`/api/device/${deviceId}/timed-session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ sessionState: null })
        }).catch(console.error);

        await fetch(`/api/device/${deviceId}/queue/complete`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }).catch(console.error);
      }

      const response = await fetch(`/api/device/${deviceId}/queue`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to leave queue");
      }

      setMessage(userStatus === "active" 
        ? "Session ended. You've left the queue." 
        : data.message || "Successfully left the queue");
      setUserPosition(null);
      setUserStatus(null);
      setTimedSessionRemaining(null);
      setMovementStatus(null);
      await fetchQueue();
      await fetchUserCredits();
      window.dispatchEvent(new CustomEvent("refresh-credits"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave queue");
    } finally {
      setLeaving(false);
    }
  };

  // Activate driver
  const handleActivateDriver = async () => {
    if (!session) return;

    setActivating(true);
    setMessage(null);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) return;

      const response = await fetch(`/api/device/${deviceId}/queue/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to activate driver");
      }

      setMessage(data.message || "You're now the active driver! Start driving to begin your session.");
      await fetchQueue();
      await fetchTimedSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate driver");
    } finally {
      setActivating(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchDeviceStatus(),
        fetchQueue(),
        fetchTimedSession(),
        fetchRecentLaps(),
        fetchUserCredits(),
        fetchVersionInfo(),
      ]);
      setLoading(false);
    };

    fetchAll();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchDeviceStatus();
      fetchQueue();
      fetchTimedSession();
      fetchRecentLaps();
    }, 3000);

    // Poll version info less frequently (every 60 seconds)
    const versionInterval = setInterval(fetchVersionInfo, 60000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      clearInterval(versionInterval);
    };
  }, [deviceId, session, fetchDeviceStatus, fetchQueue, fetchTimedSession, fetchRecentLaps, fetchUserCredits, fetchVersionInfo]);

  // Fetch leaderboard when track/car changes
  useEffect(() => {
    if (deviceStatus?.telemetry?.trackName && deviceStatus?.telemetry?.carName) {
      fetchLeaderboard(deviceStatus.telemetry.trackName, deviceStatus.telemetry.carName);
    } else {
      setLeaderboard([]);
    }
  }, [deviceStatus?.telemetry?.trackName, deviceStatus?.telemetry?.carName, fetchLeaderboard]);

  // Update timers every second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (timedSessionRemaining !== null && timedSessionRemaining > 0) {
        setTimedSessionRemaining(prev => prev !== null && prev > 0 ? prev - 1 : null);
      }
      if (positionOneTimer !== null && positionOneTimer > 0) {
        setPositionOneTimer(prev => prev !== null && prev > 0 ? prev - 1 : null);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [timedSessionRemaining, positionOneTimer]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 text-lg">Loading rig info...</p>
        </div>
      </div>
    );
  }

  const activeDriver = queueData?.active;
  const waitingQueue = queueData?.queue.filter(e => e.status === "waiting") || [];
  const currentTrack = deviceStatus?.telemetry?.trackName;
  const currentCar = deviceStatus?.telemetry?.carName;
  const isUserPositionOne = userPosition === 1 && userStatus === "waiting" && !activeDriver;
  const canJoinQueue = deviceStatus?.isServiceOnline && (userCredits === null || userCredits >= 100);
  const canActivate = isUserPositionOne && 
    deviceStatus?.isServiceOnline && 
    deviceStatus?.iracingConnected && 
    !timedSessionRemaining &&
    deviceStatus?.carState?.inCar !== true;

  return (
    <div className="space-y-4">
      {/* Rig Name Bar */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/30">
              <span className="text-red-400 text-xl">📍</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {deviceName || `Rig ${deviceId.slice(0, 8)}`}
              </h1>
              <div className="flex items-center gap-2 text-sm">
                {deviceStatus?.isServiceOnline ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                    Offline
                  </span>
                )}
                {deviceStatus?.iracingConnected && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-blue-400">iRacing Connected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Service Offline Warning */}
        {deviceStatus && !deviceStatus.isServiceOnline && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3">
            <p className="text-rose-400 font-semibold">⚠️ PC Service Offline</p>
            <p className="text-rose-300/80 text-sm mt-1">
              {deviceStatus.reason || "The PC service is not responding"}. You cannot join the queue or drive until it comes back online.
              {userStatus === "waiting" && (
                <span className="block mt-2 text-rose-300/60">
                  If the service remains offline for more than 3 minutes, you will be automatically removed from the queue.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Version Info */}
        {versionInfo && versionInfo.isServiceOnline && (
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">PC Service:</span>
                <span className="text-white font-mono font-semibold text-xs">
                  v{versionInfo.currentVersion || "?"}
                </span>
              </div>
              {versionInfo.latestVersion && (
                <div className="flex items-center gap-2">
                  {versionInfo.updateAvailable ? (
                    <>
                      <span className="text-yellow-400 text-xs">Update Available:</span>
                      <span className="text-yellow-300 font-mono font-semibold text-xs">
                        v{versionInfo.latestVersion}
                      </span>
                    </>
                  ) : (
                    <span className="text-emerald-400 text-xs">✓ Up to date</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {message && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 animate-fade-in">
            <p className="text-emerald-300 text-sm">{message}</p>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 animate-fade-in">
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {/* User Queue Status Card */}
        {session && (
          <section className="glass rounded-2xl overflow-hidden">
            <div className="p-5">
              {userPosition !== null ? (
                <div className="space-y-4">
                  {/* Status Display */}
                  <div className="flex items-center justify-between">
                    <div>
                      {userStatus === "active" ? (
                        <div className="space-y-1">
                          <div className="text-2xl font-bold text-yellow-400">🎮 Your Turn!</div>
                          {timedSessionRemaining !== null && timedSessionRemaining > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400">Time remaining:</span>
                              <span className={`text-2xl font-mono font-bold ${
                                timedSessionRemaining <= 10 ? "text-red-400 animate-pulse" :
                                timedSessionRemaining <= 30 ? "text-yellow-400" : "text-emerald-400"
                              }`}>
                                {formatTime(timedSessionRemaining)}
                              </span>
                            </div>
                          ) : movementStatus?.waiting ? (
                            <div className="text-sm text-yellow-400">
                              ⏳ Start driving to begin your session...
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xl font-bold text-white">
                            Position <span className="text-red-400">#{userPosition}</span> in Queue
                          </div>
                          {userPosition === 1 ? (
                            <div className="text-sm text-emerald-400">You're next! Get ready to drive.</div>
                          ) : (
                            <div className="text-sm text-slate-400">
                              {userPosition - 1} {userPosition - 1 === 1 ? "person" : "people"} ahead of you
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Position 1 Timer */}
                    {isUserPositionOne && positionOneTimer !== null && (
                      <div className="text-right">
                        <div className="text-xs text-slate-400 mb-1">Time to activate</div>
                        <div className={`text-3xl font-mono font-bold ${
                          positionOneTimer <= 10 ? "text-red-400 animate-pulse" :
                          positionOneTimer <= 20 ? "text-orange-400" : "text-yellow-400"
                        }`}>
                          {formatTime(positionOneTimer)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Movement Detection Status */}
                  {movementStatus?.waiting && userStatus === "active" && (
                    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></div>
                          <span className="font-semibold text-yellow-300">Waiting for Movement</span>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-yellow-200/80">Current Speed:</span>
                          <span className="font-mono font-semibold text-yellow-300">
                            {movementStatus.speed !== null && movementStatus.speed !== undefined 
                              ? `${movementStatus.speed.toFixed(1)} km/h` 
                              : "No data"}
                          </span>
                        </div>
                        {!deviceStatus?.iracingConnected && (
                          <div className="text-xs text-yellow-200/60">
                            ⚠️ iRacing not connected
                          </div>
                        )}
                        {deviceStatus?.iracingConnected && deviceStatus?.carState?.inCar !== true && (
                          <div className="text-xs text-yellow-200/60">
                            ⚠️ Not in car - enter car first
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-yellow-200/60">
                          <span>Threshold:</span>
                          <span className="font-mono">5.0 km/h</span>
                        </div>
                        {movementStatus.speed !== null && movementStatus.speed !== undefined ? (
                          <div className={`text-xs mt-2 pt-2 border-t border-yellow-500/20 ${
                            movementStatus.speed > 5 ? "text-emerald-300" : "text-yellow-200/60"
                          }`}>
                            {movementStatus.speed > 5 
                              ? "✓ Speed detected! Timer will start..." 
                              : `⏳ Need ${(5 - movementStatus.speed).toFixed(1)} km/h more`}
                          </div>
                        ) : (
                          <div className="text-xs mt-2 pt-2 border-t border-yellow-500/20 text-yellow-200/60">
                            ⚠️ Waiting for speed data... Make sure you're in a session.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    {isUserPositionOne && (
                      <button
                        onClick={handleActivateDriver}
                        disabled={activating || !canActivate}
                        className="flex-1 min-w-[140px] px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                      >
                        {activating ? "Activating..." : "🚗 Start Driving"}
                      </button>
                    )}
                    <button
                      onClick={handleLeaveQueue}
                      disabled={leaving}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                        userStatus === "active"
                          ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                          : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {leaving ? "Leaving..." : userStatus === "active" ? "End Session" : "Leave Queue"}
                    </button>
                  </div>

                  {/* Activation Requirements */}
                  {isUserPositionOne && !canActivate && (
                    <div className="text-xs text-slate-400 space-y-1">
                      {!deviceStatus?.isServiceOnline && <p>⚠️ PC service is offline</p>}
                      {deviceStatus?.isServiceOnline && !deviceStatus?.iracingConnected && (
                        <p>⚠️ iRacing not connected - waiting for session</p>
                      )}
                      {timedSessionRemaining && <p>⏱️ Previous session still active</p>}
                      {deviceStatus?.carState?.inCar && <p>🚗 Previous driver still in car</p>}
                    </div>
                  )}
                </div>
              ) : (
                /* Join Queue */
                <div className="text-center space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Ready to Race?</h3>
                    <p className="text-sm text-slate-400">
                      Join the queue for a 1-minute driving session
                    </p>
                  </div>
                  
                  <button
                    onClick={handleJoinQueue}
                    disabled={joining || !canJoinQueue}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105"
                  >
                    {joining ? "Joining..." : "Join Queue"}
                  </button>

                  <div className="text-sm text-slate-400 space-y-1">
                    <p>💰 Cost: <span className="text-yellow-400 font-semibold">100 credits</span></p>
                    {userCredits !== null && userCredits < 100 && (
                      <p className="text-rose-400">⚠️ Insufficient credits ({userCredits} available)</p>
                    )}
                    {!deviceStatus?.isServiceOnline && (
                      <p className="text-rose-400">⚠️ PC service is offline</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Not Logged In */}
        {!session && (
          <section className="glass rounded-2xl p-6 text-center space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Ready to Race?</h3>
              <p className="text-sm text-slate-400">Sign in to join the queue and start driving</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/auth/login?redirectTo=/device/${deviceId}/driver`}
                className="btn-secondary px-6 py-3"
              >
                Log In
              </Link>
              <Link
                href={`/auth/register?redirectTo=/device/${deviceId}/driver`}
                className="btn-primary px-6 py-3"
              >
                Sign Up
              </Link>
            </div>
          </section>
        )}

        {/* Current Session Card */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 px-5 py-3 border-b border-slate-700/50">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="text-xl">🏁</span>
              Current Session
            </h2>
          </div>
          
          <div className="p-5">
            {currentTrack && currentCar ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Track</div>
                  <div className="text-lg font-bold text-white truncate">{currentTrack}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Car</div>
                  <div className="text-lg font-bold text-red-400 truncate">{currentCar}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-400">
                  {!deviceStatus?.isServiceOnline 
                    ? "PC service offline" 
                    : !deviceStatus?.iracingConnected 
                    ? "Waiting for iRacing..."
                    : "No session data"}
                </p>
              </div>
            )}

            {/* Active Driver */}
            {activeDriver && (
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
                <div>
                  <div className="text-xs text-yellow-400 font-semibold mb-0.5">Now Driving</div>
                  <div className="text-base font-bold text-white">
                    {activeDriver.irc_user_profiles?.display_name || 
                     activeDriver.irc_user_profiles?.email || 
                     "Driver"}
                  </div>
                </div>
                {timedSessionRemaining !== null && timedSessionRemaining > 0 && (
                  <div className={`text-2xl font-mono font-bold ${
                    timedSessionRemaining <= 10 ? "text-red-400 animate-pulse" :
                    timedSessionRemaining <= 30 ? "text-yellow-400" : "text-emerald-400"
                  }`}>
                    {formatTime(timedSessionRemaining)}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Queue Section */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 px-5 py-3 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-xl">👥</span>
                Up Next
              </h2>
              <span className="text-xs text-slate-400">
                {waitingQueue.length} waiting
              </span>
            </div>
          </div>

          <div className="p-4">
            {waitingQueue.length > 0 ? (
              <div className="space-y-2">
                {waitingQueue.slice(0, 5).map((entry) => {
                  const isCurrentUser = session?.user?.id === entry.user_id;
                  return (
                    <div 
                      key={entry.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCurrentUser 
                          ? "bg-blue-500/10 border border-blue-500/30" 
                          : "bg-slate-800/30"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        entry.position === 1 
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black" 
                          : "bg-slate-700 text-slate-300"
                      }`}>
                        {entry.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {entry.irc_user_profiles?.display_name || 
                           entry.irc_user_profiles?.email || 
                           "Driver"}
                          {isCurrentUser && <span className="ml-2 text-xs text-blue-400">(You)</span>}
                        </div>
                      </div>
                      {entry.position === 1 && !activeDriver && positionOneTimer !== null && (
                        <div className={`text-xs font-mono ${positionOneTimer <= 10 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>
                          {formatTime(positionOneTimer)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {waitingQueue.length > 5 && (
                  <p className="text-center text-xs text-slate-500 pt-2">
                    +{waitingQueue.length - 5} more
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-400 text-sm">No one waiting</p>
              </div>
            )}
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Leaderboard */}
          <section className="glass rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 px-5 py-3 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-xl">🏆</span>
                Leaderboard
              </h2>
              {currentTrack && currentCar && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {currentTrack} • {currentCar}
                </p>
              )}
            </div>

            <div className="p-3">
              {leaderboard.length > 0 ? (
                <div className="space-y-1">
                  {leaderboard.map((entry, index) => (
                    <div 
                      key={`${entry.track_id}-${entry.car_id}-${index}`}
                      className={`flex items-center gap-2 p-2.5 rounded-lg ${
                        index === 0 ? "bg-yellow-500/10" : 
                        index === 1 ? "bg-slate-500/10" :
                        index === 2 ? "bg-amber-700/10" : ""
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black" :
                        index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black" :
                        index === 2 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white" :
                        "bg-slate-700 text-slate-400"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {entry.driver_name || entry.driver_email || "Unknown"}
                        </div>
                      </div>
                      <div className="text-sm font-mono text-red-400 font-bold">
                        {formatLapTime(entry.best_lap_time)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">
                    {currentTrack ? "No records yet" : "No session"}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Recent Laps */}
          <section className="glass rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 px-5 py-3 border-b border-slate-700/50">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                Recent Laps
              </h2>
            </div>

            <div className="p-3">
              {recentLaps.length > 0 ? (
                <div className="space-y-1">
                  {recentLaps.slice(0, 8).map((lap, index) => (
                    <div 
                      key={lap.lap_id}
                      className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                        {lap.lap_number || "-"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-500 truncate">
                          {lap.track_id || "Unknown"}
                        </div>
                      </div>
                      <div className={`text-sm font-mono font-bold ${
                        index === 0 ? "text-emerald-400" : "text-slate-300"
                      }`}>
                        {lap.lap_time ? formatLapTime(lap.lap_time) : "--:--.---"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-500 text-sm">No laps recorded</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="text-center py-4">
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link href={`/device/${deviceId}/details`} className="text-slate-500 hover:text-white transition-colors">
              Rig Details
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/leaderboards" className="text-slate-500 hover:text-white transition-colors">
              Global Leaderboards
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
