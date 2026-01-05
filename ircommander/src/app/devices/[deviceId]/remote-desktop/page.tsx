"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUser, isAuthenticated, clearAuth } from "@/lib/auth";
import RemoteDesktopViewer from "@/components/remote-desktop-viewer";

export default function RemoteDesktopPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.deviceId as string;

  const [user, setUser] = useState(getUser());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    if (!deviceId) {
      setError("Device ID is required");
    }
  }, [deviceId, router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  // Check if error is due to authentication
  if (error && (error.includes("401") || error.includes("403") || error.includes("Not authenticated"))) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl font-semibold mb-4">Authentication Required</div>
          <div className="text-neutral-400 mb-6">Your session has expired. Please log in again.</div>
          <button
            onClick={() => {
              clearAuth();
              router.push("/auth/login");
            }}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
          <a
            href={`/devices/${deviceId}`}
            className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition inline-block"
          >
            ← Back to Device
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <a
            href={`/devices/${deviceId}`}
            className="text-neutral-400 hover:text-white transition"
          >
            ← Back to Device
          </a>
          <div>
            <h1 className="text-xl font-semibold text-white">Remote Desktop</h1>
            <p className="text-sm text-neutral-500 font-mono">{deviceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/devices"
            className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
          >
            Devices
          </a>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Remote Desktop Viewer */}
      <div className="flex-1 min-h-0">
        <RemoteDesktopViewer
          deviceId={deviceId}
          onError={(err) => setError(err)}
          onConnected={() => setError(null)}
        />
      </div>
    </div>
  );
}
