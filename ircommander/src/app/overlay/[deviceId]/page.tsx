"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Disable SSR for overlay page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OverlayPage() {
  const params = useParams();
  const deviceId = params?.deviceId as string;

  const [status, setStatus] = useState<{
    iracing: boolean;
    api: boolean;
  }>({ iracing: false, api: false });
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    const fetchData = async () => {
      try {
        // Fetch timed session status (no auth required for read-only public state)
        const sessionResponse = await fetch(`/api/v1/devices/${deviceId}/queue/timed-session`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.success && sessionData.active) {
            setSession(sessionData.session);
          } else {
            setSession(null);
          }
        }
        setStatus({ iracing: false, api: sessionResponse.ok }); // Assume API is connected if request succeeds
      } catch (error) {
        console.error("Error fetching overlay data:", error);
        setStatus({ iracing: false, api: false });
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 1000); // Update every second

    return () => clearInterval(interval);
  }, [deviceId]);

  // Assume connected if we got data (could be improved)
  const apiConnected = !loading;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          padding: "15px 20px",
          minWidth: "200px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ fontSize: "10px", color: "#888", marginBottom: "8px", textAlign: "center" }}>
          Powered By GridPass.App
        </div>
        <div
          style={{
            fontSize: "12px",
            color: apiConnected ? "#00ff00" : "#ff0000",
            marginBottom: "5px",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Status: {apiConnected ? "Connected" : "Disconnected"}
        </div>
        {session && (
          <>
            <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "10px", textAlign: "center" }}>
              TIMED SESSION
            </div>
            <div
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                fontFamily: "monospace",
                textAlign: "center",
                marginTop: "5px",
                color:
                  session.time_remaining_seconds !== null && session.time_remaining_seconds < 10
                    ? "#ff0000"
                    : session.time_remaining_seconds !== null && session.time_remaining_seconds < 30
                    ? "#ff9500"
                    : "#00ff00",
              }}
            >
              {session.time_remaining_seconds !== null && session.time_remaining_seconds > 0
                ? `${Math.floor(session.time_remaining_seconds / 60)}:${(session.time_remaining_seconds % 60).toString().padStart(2, "0")}`
                : session.state === "waiting_for_movement" || session.state === "entering_car"
                ? `${Math.floor(session.duration_seconds / 60)}:${(session.duration_seconds % 60).toString().padStart(2, "0")}`
                : "--:--"}
            </div>
            <div style={{ fontSize: "12px", color: "#ccc", textAlign: "center", marginTop: "5px" }}>
              {session.state?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </div>
            {session.average_lap_time && (
              <div style={{ fontSize: "10px", color: "#888", textAlign: "center", marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                <div>Avg Lap: {session.average_lap_time.toFixed(1)}s</div>
                {session.laps_target && (
                  <div>Target: ~{session.laps_target} laps</div>
                )}
                {session.calculated_duration && session.calculated_duration !== session.duration_seconds && (
                  <div style={{ fontSize: "9px", color: "#666" }}>
                    Adjusted: {Math.floor(session.calculated_duration / 60)}:{(session.calculated_duration % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
