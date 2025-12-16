"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/providers/supabase-provider";

type QueueEntry = {
  id: string;
  user_id: string;
  position: number;
  status: "waiting" | "active" | "completed" | "cancelled";
  joined_at: string;
  started_at?: string;
  completed_at?: string;
  became_position_one_at?: string;
  irc_user_profiles?: {
    id: string;
    email: string;
    display_name?: string;
  } | null;
};

type QueueData = {
  device: {
    device_id: string;
    device_name?: string;
    claimed: boolean;
  } | null;
  queue: QueueEntry[];
  totalWaiting: number;
  active: QueueEntry | null;
};

export default function QueuePage() {
  const params = useParams();
  const router = useRouter();
  const { session, supabase } = useSupabase();
  const deviceId = params.deviceId as string;

  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [iracingStatus, setIracingStatus] = useState<{
    iracingConnected: boolean;
    canExecuteCommands: boolean;
    reason: string | null;
    carState: {
      inCar: boolean | null;
      engineRunning: boolean | null;
    };
  } | null>(null);
  const [timedSessionActive, setTimedSessionActive] = useState(false);
  const [timedSessionRemaining, setTimedSessionRemaining] = useState<number | null>(null);
  const [movementStatus, setMovementStatus] = useState<{
    waiting: boolean;
    speed: number | null;
    detected: boolean;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<{
    speedKph: number | null;
  } | null>(null);
  const [positionOneTimer, setPositionOneTimer] = useState<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const iracingPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const positionOneTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if session is waiting for movement and start timer when car moves
  const checkAndStartTimerOnMovement = async (speedKphFromData?: number | null) => {
    try {
      // Get current session state
      const sessionResponse = await fetch(`/api/device/${deviceId}/timed-session`);
      if (!sessionResponse.ok) return;
      
      const sessionData = await sessionResponse.json();
      const sessionState = sessionData.sessionState;
      
      // Check if session is waiting for movement
      if (sessionState && sessionState.waitingForMovement && !sessionState.active) {
        // Use speed from parameter (fresh data) or fall back to telemetry state
        const speedKph = speedKphFromData !== undefined ? speedKphFromData : (telemetry?.speedKph ?? null);
        
        // Update visual status
        setMovementStatus({
          waiting: true,
          speed: speedKph,
          detected: speedKph !== null && speedKph !== undefined && speedKph > 5
        });
        
        // Check if car is moving (speed > 5 km/h)
        if (speedKph !== null && speedKph !== undefined && speedKph > 5) {
          console.log(`[checkAndStartTimerOnMovement] Car is moving (${speedKph} km/h), starting timer!`);
          
          // Start the timer now
          const startTime = Date.now();
          const activeSessionState = {
            active: true,
            waitingForMovement: false,
            startTime,
            duration: sessionState.duration,
            driver_user_id: sessionState.driver_user_id
          };
          
          // Update session state in database
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          await fetch(`/api/device/${deviceId}/timed-session`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ sessionState: activeSessionState })
          }).catch(console.error);
          
          // Clear movement status since timer started
          setMovementStatus(null);
          
          // Refresh timed session to show active timer
          await fetchTimedSession();
        }
      } else {
        // Not waiting for movement - clear status
        if (!sessionState || !sessionState.waitingForMovement) {
          setMovementStatus(null);
        }
      }
    } catch (err) {
      console.error("[checkAndStartTimerOnMovement] Error:", err);
    }
  };

  // Fetch timed session status
  const fetchTimedSession = async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/timed-session`);
      if (response.ok) {
        const data = await response.json();
        const sessionState = data.sessionState;
        
        if (sessionState && sessionState.active) {
          // Check if session is still active (not expired)
          const startTime = sessionState.startTime;
          const duration = sessionState.duration;
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = duration - elapsed;
          
          if (remaining > 0) {
            setTimedSessionActive(true);
            setTimedSessionRemaining(remaining);
          } else {
            setTimedSessionActive(false);
            setTimedSessionRemaining(null);
          }
        } else {
          setTimedSessionActive(false);
          setTimedSessionRemaining(null);
        }
        
        // Check for movement if waiting
        if (sessionState && sessionState.waitingForMovement && !sessionState.active) {
          checkAndStartTimerOnMovement(telemetry?.speedKph ?? null);
        }
      }
    } catch (err) {
      console.error("[fetchTimedSession] Error:", err);
      setTimedSessionActive(false);
      setTimedSessionRemaining(null);
    }
  };

  // Fetch iRacing status
  const fetchIracingStatus = async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/status?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[fetchIracingStatus] Response:`, {
          iracingConnected: data.iracingConnected,
          hasTelemetry: !!data.telemetry,
          speedKph: data.telemetry?.speedKph,
          inCar: data.carState?.inCar,
          reason: data.reason
        });
        
        setIracingStatus({
          iracingConnected: data.iracingConnected || false,
          canExecuteCommands: data.canExecuteCommands || false,
          reason: data.reason || null,
          carState: data.carState || { inCar: null, engineRunning: null },
        });
        
        // Store telemetry for movement detection
        // Accept speed even if it's 0 (car might be stationary)
        if (data.telemetry) {
          const speedKph = data.telemetry.speedKph !== null && data.telemetry.speedKph !== undefined 
            ? data.telemetry.speedKph 
            : null;
          console.log(`[fetchIracingStatus] Setting telemetry speed: ${speedKph} km/h`);
          setTelemetry({
            speedKph: speedKph,
          });
          // Check for movement with the fresh speed data
          setTimeout(() => checkAndStartTimerOnMovement(speedKph), 50);
        } else {
          // If no telemetry, clear it
          console.log(`[fetchIracingStatus] No telemetry data available`);
          setTelemetry({ speedKph: null });
        }
      } else {
        console.error(`[fetchIracingStatus] Response not OK: ${response.status}`);
      }
    } catch (err) {
      console.error("[fetchIracingStatus] Error:", err);
    }
  };

  // Fetch queue data
  const fetchQueue = async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/queue`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch queue");
      }
      const data: QueueData = await response.json();
      setQueueData(data);

      // Check if current user is in queue
      if (session?.user?.id) {
        const userEntry = data.queue.find((entry) => entry.user_id === session.user.id);
        if (userEntry) {
          setUserPosition(userEntry.position);
          setUserStatus(userEntry.status);
        } else {
          setUserPosition(null);
          setUserStatus(null);
        }
      }

      // Calculate position 1 timer (60 seconds from became_position_one_at)
      // Only if the column exists and has a value
      const positionOneEntry = data.queue.find((entry) => entry.position === 1 && entry.status === "waiting");
      if (positionOneEntry && positionOneEntry.became_position_one_at) {
        try {
          const becameAt = new Date(positionOneEntry.became_position_one_at).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - becameAt) / 1000);
          const remaining = Math.max(0, 60 - elapsed);
          setPositionOneTimer(remaining);
        } catch (err) {
          console.error("[fetchQueue] Error calculating position 1 timer:", err);
          setPositionOneTimer(null);
        }
      } else {
        setPositionOneTimer(null);
      }
    } catch (err) {
      console.error("[fetchQueue] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  // Join queue
  const handleJoinQueue = async () => {
    if (!session) {
      router.push(`/auth/login?redirectTo=/device/${deviceId}/queue`);
      return;
    }

    setJoining(true);
    setMessage(null);
    setError(null);

    try {
      // Get fresh session to ensure token is valid
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("[handleJoinQueue] Session error:", sessionError);
        router.push(`/auth/login?redirectTo=/device/${deviceId}/queue`);
        return;
      }

      const token = sessionData?.session?.access_token;
      
      if (!token) {
        console.error("[handleJoinQueue] No access token in session");
        router.push(`/auth/login?redirectTo=/device/${deviceId}/queue`);
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
      await fetchQueue(); // Refresh queue
    } catch (err) {
      console.error("[handleJoinQueue] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to join queue");
    } finally {
      setJoining(false);
    }
  };

  // Activate driver (when position 1)
  const handleActivateDriver = async () => {
    if (!session) {
      return;
    }

    setActivating(true);
    setMessage(null);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error("No session token available");
      }
      
      const token = sessionData.session.access_token;

      const response = await fetch(`/api/device/${deviceId}/queue/activate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to activate driver");
      }

      setMessage(data.message || "You are now the active driver! Your session will start when the previous driver's session ends.");
      await fetchQueue(); // Refresh queue
      await fetchTimedSession(); // Check for movement detection
    } catch (err) {
      console.error("[handleActivateDriver] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to activate driver");
    } finally {
      setActivating(false);
    }
  };

  // Leave queue (works for both waiting and active status)
  const handleLeaveQueue = async () => {
    if (!session) {
      return;
    }

    setLeaving(true);
    setMessage(null);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error("No session token available");
      }
      
      const token = sessionData.session.access_token;

      // If user is active, also exit car, mark as completed and clear timed session
      if (userStatus === "active") {
        try {
          // First, queue reset_car command to exit the car (tow back to pits)
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

          // Clear timed session state
          await fetch(`/api/device/${deviceId}/timed-session`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ sessionState: null })
          }).catch(console.error);

          // Mark queue entry as completed
          await fetch(`/api/device/${deviceId}/queue/complete`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          }).catch(console.error);
        } catch (err) {
          console.error("[handleLeaveQueue] Error completing session:", err);
          // Continue anyway - try to delete the queue entry
        }
      }

      // Delete/leave the queue entry
      const response = await fetch(`/api/device/${deviceId}/queue`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      setTimedSessionActive(false);
      setTimedSessionRemaining(null);
      await fetchQueue(); // Refresh queue
    } catch (err) {
      console.error("[handleLeaveQueue] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to leave queue");
    } finally {
      setLeaving(false);
    }
  };

  // Poll for queue updates, iRacing status, and timed session
  useEffect(() => {
    fetchQueue();
    fetchIracingStatus();
    fetchTimedSession();

    // Poll every 2 seconds for iRacing status (to detect movement faster)
    iracingPollIntervalRef.current = setInterval(() => {
      fetchIracingStatus().then(() => {
        // After fetching status, check for movement
        // Use the telemetry state that was just updated
        setTimeout(() => {
          if (telemetry?.speedKph !== undefined) {
            checkAndStartTimerOnMovement(telemetry.speedKph);
          }
        }, 100);
      });
    }, 2000);
    
    // Poll every 5 seconds for queue updates
    pollIntervalRef.current = setInterval(() => {
      fetchQueue();
      fetchTimedSession();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (iracingPollIntervalRef.current) {
        clearInterval(iracingPollIntervalRef.current);
      }
      if (positionOneTimerRef.current) {
        clearInterval(positionOneTimerRef.current);
      }
    };
  }, [deviceId, session]);

  // Update timer countdown in real-time when session is active
  useEffect(() => {
    if (timedSessionActive && timedSessionRemaining !== null && timedSessionRemaining > 0) {
      const timerInterval = setInterval(() => {
        setTimedSessionRemaining((prev) => {
          if (prev === null || prev <= 1) {
            setTimedSessionActive(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerInterval);
    }
  }, [timedSessionActive, timedSessionRemaining]);

  // Update position 1 timer countdown in real-time
  useEffect(() => {
    if (positionOneTimer !== null && positionOneTimer > 0) {
      positionOneTimerRef.current = setInterval(() => {
        setPositionOneTimer((prev) => {
          if (prev === null || prev <= 1) {
            // Timer expired, refresh queue to trigger removal
            fetchQueue();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (positionOneTimerRef.current) {
          clearInterval(positionOneTimerRef.current);
        }
      };
    } else {
      if (positionOneTimerRef.current) {
        clearInterval(positionOneTimerRef.current);
        positionOneTimerRef.current = null;
      }
    }
  }, [positionOneTimer]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300">Loading queue...</p>
        </div>
      </div>
    );
  }

  if (error && !queueData) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-red-300 hover:text-red-200 underline"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const waitingQueue = queueData?.queue.filter((e) => e.status === "waiting") || [];
  const activeEntry = queueData?.active;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">
          {queueData?.device?.device_name || `Rig ${deviceId}`}
        </h1>
        <p className="text-slate-400">Drive Queue</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <p className="text-green-400">{message}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* User Status */}
      {session && userPosition !== null && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 font-semibold">
                {userStatus === "active"
                  ? "🎮 Your turn to drive!"
                  : `You're #${userPosition} in queue`}
              </p>
              {userStatus === "waiting" && (
                <div className="mt-1 space-y-1">
                  {userPosition === 1 ? (
                    <>
                      <p className="text-sm text-slate-400">
                        You're next! Click 'Drive' to activate when ready.
                      </p>
                      {positionOneTimer !== null && (
                        <p className={`text-sm font-semibold ${
                          positionOneTimer <= 10 
                            ? "text-red-400 animate-pulse" 
                            : positionOneTimer <= 20 
                            ? "text-orange-400" 
                            : "text-yellow-400"
                        }`}>
                          ⏱️ Time to activate: <span className="font-mono font-bold">{formatTime(positionOneTimer)}</span>
                          {positionOneTimer <= 10 && " - Activate now or you'll be removed!"}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {userPosition - 1} {userPosition - 1 === 1 ? "person" : "people"} ahead of you
                    </p>
                  )}
                </div>
              )}
              {userStatus === "active" && (
                <div className="mt-1 space-y-1">
                  {timedSessionActive && timedSessionRemaining !== null ? (
                    <p className="text-sm text-green-300">
                      ⏱️ Your session: <span className="font-mono font-bold">{formatTime(timedSessionRemaining)}</span> remaining
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-400">
                      ⚠️ Session may have ended. Click "End Session" if you're done driving.
                    </p>
                  )}
                </div>
              )}
              
              {/* Movement Detection Status */}
              {movementStatus && movementStatus.waiting && userStatus === "active" && (
                <div className="mt-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <span className="font-medium text-yellow-300 text-sm">Waiting for Movement</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-200/80">Current Speed:</span>
                      <span className="font-mono font-semibold text-yellow-300">
                        {movementStatus.speed !== null && movementStatus.speed !== undefined 
                          ? `${movementStatus.speed.toFixed(1)} km/h` 
                          : "No data"}
                      </span>
                    </div>
                    {!iracingStatus?.iracingConnected && (
                      <div className="text-xs text-yellow-200/60 mt-1">
                        ⚠️ iRacing not connected
                      </div>
                    )}
                    {iracingStatus?.iracingConnected && iracingStatus?.carState?.inCar !== true && (
                      <div className="text-xs text-yellow-200/60 mt-1">
                        ⚠️ Not in car - enter car first
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-yellow-200/60">
                      <span>Threshold:</span>
                      <span className="font-mono">5.0 km/h</span>
                    </div>
                    {movementStatus.speed !== null && movementStatus.speed !== undefined ? (
                      <div className={`text-xs mt-2 pt-2 border-t border-yellow-500/20 ${
                        movementStatus.speed > 5 
                          ? "text-green-300" 
                          : "text-yellow-200/60"
                      }`}>
                        {movementStatus.speed > 5 
                          ? "✓ Speed detected! Timer will start..." 
                          : `⏳ Need ${(5 - movementStatus.speed).toFixed(1)} km/h more`}
                      </div>
                    ) : (
                      <div className="text-xs mt-2 pt-2 border-t border-yellow-500/20 text-yellow-200/60">
                        ⚠️ Waiting for speed data from iRacing... Make sure you're in a session and driving.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {userStatus === "active" && (
                <button
                  onClick={handleLeaveQueue}
                  disabled={leaving}
                  className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="End your driving session and leave the queue"
                >
                  {leaving ? "Ending..." : "End Session"}
                </button>
              )}
              {userStatus === "waiting" && userPosition === 1 && !activeEntry && (
                <button
                  onClick={handleActivateDriver}
                  disabled={
                    activating || 
                    !iracingStatus?.canExecuteCommands || 
                    timedSessionActive || 
                    iracingStatus?.carState?.inCar === true
                  }
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    !iracingStatus?.canExecuteCommands
                      ? iracingStatus?.reason || "iRacing not connected - cannot drive"
                      : timedSessionActive
                      ? "Previous driver's session is still active - please wait"
                      : iracingStatus?.carState?.inCar === true
                      ? "Previous driver is still in the car - please wait"
                      : "Click to activate and start driving when ready"
                  }
                >
                  {activating ? "Activating..." : "🚗 Drive"}
                </button>
              )}
              {userStatus === "waiting" && (
                <button
                  onClick={handleLeaveQueue}
                  disabled={leaving}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {leaving ? "Leaving..." : "Leave Queue"}
                </button>
              )}
            </div>
              {userStatus === "waiting" && userPosition === 1 && !activeEntry && (
                <div className="mt-2 space-y-1">
                  {!iracingStatus?.canExecuteCommands && (
                    <p className="text-xs text-yellow-400">
                      ⚠️ {iracingStatus?.reason || "iRacing must be connected to drive"}
                    </p>
                  )}
                  {timedSessionActive && timedSessionRemaining !== null && (
                    <p className="text-xs text-yellow-400">
                      ⏱️ Previous driver's session: <span className="font-mono font-semibold">{formatTime(timedSessionRemaining)}</span> remaining
                    </p>
                  )}
                  {iracingStatus?.carState?.inCar === true && !timedSessionActive && (
                    <p className="text-xs text-yellow-400">
                      🚗 Previous driver is still in the car - please wait
                    </p>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Currently Driving */}
      {activeEntry && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 font-semibold">
                🏎️ Currently Driving:{" "}
                {activeEntry.irc_user_profiles?.display_name ||
                  activeEntry.irc_user_profiles?.email ||
                  "Driver"}
              </p>
              {timedSessionActive && timedSessionRemaining !== null && (
                <p className="text-sm text-yellow-300 mt-1">
                  ⏱️ Time remaining: <span className="font-mono font-bold">{formatTime(timedSessionRemaining)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join Queue Button */}
      {session && userPosition === null && (
        <div className="text-center">
          <button
            onClick={handleJoinQueue}
            disabled={joining}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? "Joining..." : "Join Queue"}
          </button>
        </div>
      )}

      {!session && (
        <div className="text-center space-y-4">
          <p className="text-slate-300">
            Please log in or register to join the queue
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/auth/login?redirectTo=/device/${deviceId}/queue`}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Log In
            </Link>
            <Link
              href={`/auth/register?redirectTo=/device/${deviceId}/queue`}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Queue ({waitingQueue.length} {waitingQueue.length === 1 ? "person" : "people"} waiting)
        </h2>

        {waitingQueue.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            No one in queue. Be the first to join!
          </p>
        ) : (
          <div className="space-y-2">
            {waitingQueue.map((entry, index) => {
              const isCurrentUser = session?.user?.id === entry.user_id;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    isCurrentUser
                      ? "bg-blue-500/20 border border-blue-500/30"
                      : "bg-slate-700/50 border border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                        entry.position === 1
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-600 text-slate-300"
                      }`}
                    >
                      {entry.position}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {entry.irc_user_profiles?.display_name ||
                          entry.irc_user_profiles?.email ||
                          "Driver"}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-blue-400">(You)</span>
                        )}
                      </p>
                      <p className="text-sm text-slate-400">
                        Joined {new Date(entry.joined_at).toLocaleTimeString()}
                      </p>
                      {entry.position === 1 && positionOneTimer !== null && (
                        <p className={`text-xs font-semibold mt-1 ${
                          positionOneTimer <= 10 
                            ? "text-red-400 animate-pulse" 
                            : positionOneTimer <= 20 
                            ? "text-orange-400" 
                            : "text-yellow-400"
                        }`}>
                          ⏱️ {formatTime(positionOneTimer)} to activate
                        </p>
                      )}
                    </div>
                  </div>
                  {entry.position === 1 && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-green-400 font-semibold">Next</span>
                      {positionOneTimer !== null && positionOneTimer <= 10 && (
                        <span className="text-xs text-red-400 font-semibold animate-pulse">⚠️ Activate now!</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Links */}
      <div className="text-center space-y-2 text-sm text-slate-400">
        <Link
          href={`/device/${deviceId}/details`}
          className="hover:text-slate-300 underline"
        >
          View Device Details
        </Link>
        {session && (
          <>
            <span className="mx-2">•</span>
            <Link href="/dashboard" className="hover:text-slate-300 underline">
              Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

