"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/auth";

interface RemoteDesktopViewerProps {
  deviceId: string;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export default function RemoteDesktopViewer({
  deviceId,
  onError,
  onConnected,
  onDisconnected,
}: RemoteDesktopViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const answerReceivedRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const lastMouseMoveTime = useRef(0);
  const MOUSE_MOVE_THROTTLE = 16; // ~60fps

  useEffect(() => {
    // Cleanup function - only runs on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (e) {
          // Ignore errors
        }
        pcRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only cleanup on unmount

  const startConnection = async () => {
    if (status === "connecting" || status === "connected") {
      return;
    }

    setStatus("connecting");
    setErrorMessage(null);
    answerReceivedRef.current = false;

    // Close any existing connection first
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {
        // Ignore errors closing old connection
      }
      pcRef.current = null;
    }

    try {
      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      pcRef.current = pc;

      // Handle incoming video stream
      pc.ontrack = (event) => {
        console.log("Received track:", event);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus("connected");
          // Focus video element to receive keyboard events
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.focus();
            }
          }, 100);
          if (onConnected) onConnected();
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate && sessionId) {
          // Send ICE candidate to server (optional - can be handled server-side)
          try {
            await authenticatedFetch(`/api/v1/devices/${deviceId}/remote-desktop/ice-candidate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: sessionId,
                candidate: event.candidate,
              }),
            });
          } catch (err) {
            console.warn("Failed to send ICE candidate:", err);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          // Only set error if we haven't received answer yet
          if (!answerReceivedRef.current) {
            setStatus("error");
            setErrorMessage("Connection failed before answer received");
            if (onDisconnected) onDisconnected();
          }
        } else if (pc.connectionState === "connected") {
          setStatus("connected");
          if (onConnected) onConnected();
        }
      };
      
      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
        if (pc.signalingState === "closed" && !answerReceivedRef.current) {
          console.warn("Signaling state closed before answer received");
          setStatus("error");
          setErrorMessage("Connection closed before answer received");
        }
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      // Send offer to device via API
      const response = await authenticatedFetch(`/api/v1/devices/${deviceId}/remote-desktop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer: offer.sdp,
          session_id: `rd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = 
          data.error?.message || 
          (typeof data.error === 'string' ? data.error : null) ||
          data.message ||
          `Server error: ${response.status}`;
        console.error("API error:", data);
        throw new Error(errorMsg);
      }
      
      if (!data.success) {
        const errorMsg = 
          data.error?.message || 
          (typeof data.error === 'string' ? data.error : null) ||
          "Failed to send offer";
        console.error("API response not successful:", data);
        throw new Error(errorMsg);
      }

      const newSessionId = data.data.session_id;
      setSessionId(newSessionId);

      // Poll for answer
      const pollForAnswer = async () => {
        if (answerReceivedRef.current) {
          return;
        }

        // Check if peer connection is still valid before polling
        if (!pcRef.current || pcRef.current.signalingState === "closed") {
          console.warn("Peer connection closed, stopping polling");
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          return;
        }

        try {
          const statusResponse = await authenticatedFetch(
            `/api/v1/devices/${deviceId}/remote-desktop?session_id=${newSessionId}`
          );
          const statusData = await statusResponse.json();

          if (statusData.success && statusData.data.status === "ready" && statusData.data.answer) {
            answerReceivedRef.current = true;
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }

            // Get current peer connection (may have changed)
            const currentPc = pcRef.current;
            if (!currentPc || currentPc.signalingState === "closed") {
              console.warn("Peer connection closed before answer received");
              setStatus("error");
              setErrorMessage("Connection closed before answer received");
              return;
            }

            // Set remote description (answer)
            try {
              await currentPc.setRemoteDescription({
                type: "answer",
                sdp: statusData.data.answer,
              });
              console.log("Remote description set successfully");
            } catch (err: any) {
              console.error("Error setting remote description:", err);
              setStatus("error");
              setErrorMessage(err.message || "Failed to set remote description");
              if (onError) onError(err.message || "Failed to set remote description");
            }
          } else if (statusData.success && statusData.data.status === "failed") {
            answerReceivedRef.current = true;
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            const errorMsg = statusData.data.message || "WebRTC negotiation failed";
            setStatus("error");
            setErrorMessage(errorMsg);
            if (onError) onError(errorMsg);
          }
        } catch (err: any) {
          console.error("Error polling for answer:", err);
          // Don't set error status on network errors, just log
          // The timeout will handle final error state
        }
      };

      // Start polling
      const interval = setInterval(pollForAnswer, 500); // Poll every 500ms
      setPollingInterval(interval);

      // Initial poll
      pollForAnswer();

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!answerReceivedRef.current) {
          clearInterval(interval);
          setStatus("error");
          setErrorMessage("Connection timeout - device may not be responding");
          if (onError) onError("Connection timeout");
        }
      }, 30000);
    } catch (err: any) {
      console.error("Connection error:", err);
      setStatus("error");
      const errorMsg = err.message || "Failed to establish connection";
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }
  };

  const stopConnection = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    if (pcRef.current) {
      // Clear timeout if exists
      if ((pcRef.current as any)._timeoutId) {
        clearTimeout((pcRef.current as any)._timeoutId);
      }
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
    setSessionId(null);
    answerReceivedRef.current = false;
    if (onDisconnected) onDisconnected();
  };

  // Calculate relative coordinates from video element
  const getRelativeCoordinates = (e: React.MouseEvent<HTMLVideoElement> | React.WheelEvent<HTMLVideoElement>) => {
    if (!videoRef.current) return { x: 0, y: 0 };
    const rect = videoRef.current.getBoundingClientRect();
    const video = videoRef.current;
    
    // Get actual video dimensions (may be scaled)
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = rect.width / rect.height;
    
    let displayWidth, displayHeight, offsetX, offsetY;
    
    if (videoAspect > containerAspect) {
      // Video is wider - letterboxed vertically
      displayWidth = rect.width;
      displayHeight = rect.width / videoAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    } else {
      // Video is taller - letterboxed horizontally
      displayWidth = rect.height * videoAspect;
      displayHeight = rect.height;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    }
    
    const x = ((e.clientX - rect.left - offsetX) / displayWidth) * video.videoWidth;
    const y = ((e.clientY - rect.top - offsetY) / displayHeight) * video.videoHeight;
    
    return { x: Math.max(0, Math.min(video.videoWidth, x)), y: Math.max(0, Math.min(video.videoHeight, y)) };
  };

  const sendInputEvent = async (event: { type: string; [key: string]: any }) => {
    if (!sessionId || status !== "connected") return;
    
    try {
      await authenticatedFetch(`/api/v1/devices/${deviceId}/remote-desktop/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          ...event,
        }),
      });
    } catch (err) {
      console.warn("Failed to send input event:", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLVideoElement>) => {
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    sendInputEvent({
      type: "mousedown",
      x: coords.x,
      y: coords.y,
      button: e.button, // 0=left, 1=middle, 2=right
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLVideoElement>) => {
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    sendInputEvent({
      type: "mouseup",
      x: coords.x,
      y: coords.y,
      button: e.button,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (e.buttons === 0) return; // Only send if button is pressed
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    sendInputEvent({
      type: "mousemove",
      x: coords.x,
      y: coords.y,
      buttons: e.buttons,
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLVideoElement>) => {
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    sendInputEvent({
      type: "wheel",
      x: coords.x,
      y: coords.y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    e.preventDefault();
    sendInputEvent({
      type: "keydown",
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    e.preventDefault();
    sendInputEvent({
      type: "keyup",
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-neutral-600"
            }`}
          />
          <span className="text-sm text-neutral-400">
            {status === "connected"
              ? "Connected"
              : status === "connecting"
              ? "Connecting..."
              : status === "error"
              ? "Error"
              : "Disconnected"}
          </span>
          {errorMessage && (
            <span className="text-sm text-red-400 ml-4">{errorMessage}</span>
          )}
        </div>
        <div className="flex gap-2">
          {status === "idle" || status === "error" ? (
            <button
              onClick={startConnection}
              className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={stopConnection}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 bg-black relative overflow-hidden" ref={videoContainerRef}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          style={{ background: "#000", cursor: status === "connected" ? "none" : "default" }}
          onMouseDown={status === "connected" ? handleMouseDown : undefined}
          onMouseUp={status === "connected" ? handleMouseUp : undefined}
          onMouseMove={status === "connected" ? handleMouseMove : undefined}
          onWheel={status === "connected" ? handleWheel : undefined}
          onKeyDown={status === "connected" ? handleKeyDown : undefined}
          onKeyUp={status === "connected" ? handleKeyUp : undefined}
          tabIndex={status === "connected" ? 0 : -1}
        />
        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-neutral-500">
              <p className="text-lg mb-2">Remote Desktop</p>
              <p className="text-sm">Click Connect to start streaming</p>
            </div>
          </div>
        )}
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-neutral-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
              <p>Establishing connection...</p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-400">
              <p className="text-lg mb-2">Connection Failed</p>
              <p className="text-sm">{errorMessage || "Unknown error"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
