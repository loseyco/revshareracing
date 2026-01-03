"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated, clearAuth, authenticatedFetch } from "@/lib/auth";

interface Device {
  device_id: string;
  name?: string | null;
  status: string;
  location?: string | null;
  local_ip?: string | null;
  public_ip?: string | null;
  claimed: boolean;
  last_seen?: string | null;
  updated_at?: string | null;
  iracing_connected?: boolean | null;
  owner_user_id?: string | null;
  company_id?: string | null;
  owner_type?: string | null;
  assigned_tenant_id?: string | null;
  is_online?: boolean;
  time_since_last_seen?: number;
}

export default function DevicesPage() {
  const router = useRouter();
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    fetchDevices();
    
    // Refresh devices every 10 seconds
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchDevices = async () => {
    try {
      setError(null);
      const response = await authenticatedFetch("/api/v1/devices");
      const data = await response.json();
      
      if (data.success && data.data) {
        setDevices(data.data.devices || []);
      } else {
        setError(data.error?.message || "Failed to fetch devices");
      }
    } catch (err) {
      setError("Failed to load devices");
      console.error("Error fetching devices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusColor = (device: Device): string => {
    if (device.is_online) {
      return "bg-green-500";
    }
    if (device.time_since_last_seen && device.time_since_last_seen < 300) {
      return "bg-yellow-500";
    }
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading devices...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Devices</h1>
            <p className="text-neutral-400">
              Manage and monitor your racing rigs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
            >
              Dashboard
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Devices Grid */}
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-500 mb-4">No devices found</div>
            <p className="text-sm text-neutral-600">
              Register a device using the iRCommander client to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.device_id} device={device} formatTimeAgo={formatTimeAgo} getStatusColor={getStatusColor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceCard({
  device,
  formatTimeAgo,
  getStatusColor,
}: {
  device: Device;
  formatTimeAgo: (seconds: number) => string;
  getStatusColor: (device: Device) => string;
}) {
  const statusColor = getStatusColor(device);
  const timeAgo = device.time_since_last_seen
    ? formatTimeAgo(device.time_since_last_seen)
    : "Never";

  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{device.name || device.device_id}</h3>
            <div className={`w-2 h-2 rounded-full ${statusColor}`} title={device.is_online ? "Online" : "Offline"} />
          </div>
          <p className="text-xs text-neutral-500">
            {device.name && device.name !== device.device_id ? device.name : device.device_id}
          </p>
        </div>
      </div>

      {/* Status Info */}
      <div className="space-y-2 mb-4">
        {device.name && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">PC Name</span>
            <span className="text-white">{device.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Status</span>
          <span className="text-white capitalize">{device.status || "Unknown"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Last Seen</span>
          <span className="text-white">{timeAgo}</span>
        </div>
        {/* Only show iRacing status if device is online - offline devices can't be connected */}
        {device.is_online && device.iracing_connected !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">iRacing</span>
            <span className={device.iracing_connected ? "text-green-400" : "text-neutral-500"}>
              {device.iracing_connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        )}
        {device.location && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Location</span>
            <span className="text-white">{device.location}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-neutral-800">
        <a
          href={`/devices/${device.device_id}`}
          className="flex-1 px-3 py-2 text-sm text-center bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
        >
          View Details
        </a>
      </div>
    </div>
  );
}
