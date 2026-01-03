"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUser, isAuthenticated, clearAuth, authenticatedFetch } from "@/lib/auth";

interface DeviceDetails {
  device_id: string;
  name: string;
  status: string;
  location?: string | null;
  local_ip?: string | null;
  public_ip?: string | null;
  claimed: boolean;
  owner_user_id?: string | null;
  company_id?: string | null;
  owner_type?: string | null;
  assigned_tenant_id?: string | null;
  hardware_id?: string | null;
  last_seen?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  is_online?: boolean;
  iracing_connected?: boolean;
  time_since_last_seen?: number;
  telemetry?: {
    speed_kph?: number | null;
    rpm?: number | null;
    track_name?: string | null;
    car_name?: string | null;
    current_lap?: number | null;
    in_car?: boolean | null;
    engine_running?: boolean | null;
    in_pit_stall?: boolean | null;
  } | null;
  pc_service_version?: string | null;
  system_info?: {
    os_name?: string | null;
    os_version?: string | null;
    os_arch?: string | null;
    cpu_name?: string | null;
    cpu_count?: number | null;
    cpu_cores?: number | null;
    ram_total_gb?: number | null;
    ram_available_gb?: number | null;
    ram_used_percent?: number | null;
    gpu_name?: string | null;
    disk_total_gb?: number | null;
    disk_used_gb?: number | null;
    disk_free_gb?: number | null;
    disk_used_percent?: number | null;
    disk_low_space?: boolean | null;
    iracing_process_running?: boolean | null;
    iracing_processes?: string[] | null;
    python_version?: string | null;
  } | null;
}

interface QueueEntry {
  id: string;
  user_id: string;
  position: number;
  status: string;
  joined_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  user?: {
    email?: string;
    name?: string;
  };
}

export default function DeviceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.deviceId as string;
  
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<DeviceDetails | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFullHardwareId, setShowFullHardwareId] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    if (!deviceId) return;
    
    fetchDeviceDetails();
    fetchQueue();
    
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchDeviceDetails();
      fetchQueue();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [deviceId, router]);

  const fetchDeviceDetails = async () => {
    try {
      setError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${deviceId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setDevice(data.data.device);
      } else {
        setError(data.error?.message || "Failed to fetch device details");
      }
    } catch (err) {
      setError("Failed to load device details");
      console.error("Error fetching device:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const response = await authenticatedFetch(`/api/v1/devices/${deviceId}/queue`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setQueue(data.data.queue || []);
      }
    } catch (err) {
      console.error("Error fetching queue:", err);
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

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? "bg-green-500" : "bg-red-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading device details...</div>
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
          <a
            href="/devices"
            className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition inline-block"
          >
            ← Back to Devices
          </a>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="text-center py-12">
            <div className="text-neutral-500 mb-4">Device not found</div>
            <a
              href="/devices"
              className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition inline-block"
            >
              ← Back to Devices
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(device.is_online || false);
  const timeAgo = device.time_since_last_seen
    ? formatTimeAgo(device.time_since_last_seen)
    : "Never";

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <a
              href="/devices"
              className="text-neutral-400 hover:text-white transition"
            >
              ← Back
            </a>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold text-white">
                  {device.name || device.device_id}
                </h1>
                <div className={`w-3 h-3 rounded-full ${statusColor}`} title={device.is_online ? "Online" : "Offline"} />
              </div>
              <p className="text-sm text-neutral-500 font-mono">{device.device_id}</p>
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

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Status</h2>
              
              {/* Warnings */}
              {device.system_info?.disk_low_space && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <span>⚠️</span>
                    <span className="font-medium">Low Disk Space Warning</span>
                  </div>
                  <p className="text-sm text-red-300 mt-1">
                    Disk is {device.system_info.disk_used_percent}% full. Free up space to prevent issues.
                  </p>
                </div>
              )}
              {device.system_info?.iracing_process_running === false && device.is_online && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <span>⚠️</span>
                    <span className="font-medium">iRacing Process Not Running</span>
                  </div>
                  <p className="text-sm text-yellow-300 mt-1">
                    iRacing simulator is not running on this device.
                  </p>
                </div>
              )}
              
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Status" value={device.status || "Unknown"} />
                <InfoRow 
                  label="Connection" 
                  value={
                    device.is_online ? (
                      <span className="text-green-400">Online</span>
                    ) : (
                      <span className="text-red-400">Offline</span>
                    )
                  } 
                />
                <InfoRow label="Last Seen" value={timeAgo} />
                <InfoRow 
                  label="iRacing" 
                  value={
                    device.iracing_connected ? (
                      <span className="text-green-400">Connected</span>
                    ) : (
                      <span className="text-neutral-500">Disconnected</span>
                    )
                  } 
                />
                {device.pc_service_version && (
                  <InfoRow label="PC Service Version" value={device.pc_service_version} />
                )}
                {device.location && (
                  <InfoRow label="Location" value={device.location} />
                )}
              </div>
            </div>

            {/* Telemetry Card */}
            {device.telemetry && (
              <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
                <h2 className="text-xl font-semibold text-white mb-4">Live Telemetry</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {device.telemetry.track_name && (
                    <InfoRow label="Track" value={device.telemetry.track_name} />
                  )}
                  {device.telemetry.car_name && (
                    <InfoRow label="Car" value={device.telemetry.car_name} />
                  )}
                  {device.telemetry.speed_kph !== null && device.telemetry.speed_kph !== undefined && (
                    <InfoRow label="Speed" value={`${device.telemetry.speed_kph.toFixed(1)} km/h`} />
                  )}
                  {device.telemetry.rpm !== null && device.telemetry.rpm !== undefined && (
                    <InfoRow label="RPM" value={Math.round(device.telemetry.rpm).toLocaleString()} />
                  )}
                  {device.telemetry.current_lap !== null && (
                    <InfoRow label="Current Lap" value={`Lap ${device.telemetry.current_lap}`} />
                  )}
                  <InfoRow 
                    label="In Car" 
                    value={device.telemetry.in_car ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-neutral-500">No</span>
                    )} 
                  />
                  <InfoRow 
                    label="Engine" 
                    value={device.telemetry.engine_running ? (
                      <span className="text-green-400">Running</span>
                    ) : (
                      <span className="text-neutral-500">Off</span>
                    )} 
                  />
                  {device.telemetry.in_pit_stall !== null && (
                    <InfoRow 
                      label="Pit Stall" 
                      value={device.telemetry.in_pit_stall ? (
                        <span className="text-yellow-400">In Pit</span>
                      ) : (
                        <span className="text-neutral-500">On Track</span>
                      )} 
                    />
                  )}
                </div>
              </div>
            )}

            {/* Device Info Card */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Device Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {device.hardware_id && (
                  <div className="sm:col-span-2">
                    <div className="text-sm text-neutral-400 mb-1">Hardware ID</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 w-full">
                        <code 
                          className={`text-xs font-mono bg-neutral-800 px-2 py-1 rounded ${
                            showFullHardwareId 
                              ? 'break-all whitespace-normal' 
                              : 'truncate whitespace-nowrap overflow-hidden'
                          } flex-1 min-w-0`}
                          title={device.hardware_id}
                        >
                          {device.hardware_id}
                        </code>
                        <div className="flex gap-2 flex-shrink-0">
                          {device.hardware_id.length > 50 && (
                            <button
                              onClick={() => setShowFullHardwareId(!showFullHardwareId)}
                              className="px-2 py-1 text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded transition whitespace-nowrap"
                            >
                              {showFullHardwareId ? 'Hide' : 'Show All'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(device.hardware_id || '');
                            }}
                            className="px-2 py-1 text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded transition whitespace-nowrap"
                            title="Copy to clipboard"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {device.local_ip && (
                  <InfoRow label="Local IP" value={device.local_ip} />
                )}
                {device.public_ip && (
                  <InfoRow label="Public IP" value={device.public_ip} />
                )}
                {device.owner_type && (
                  <InfoRow label="Owner Type" value={device.owner_type} />
                )}
                {device.created_at && (
                  <InfoRow label="Created" value={new Date(device.created_at).toLocaleString()} />
                )}
                {device.updated_at && (
                  <InfoRow label="Last Updated" value={new Date(device.updated_at).toLocaleString()} />
                )}
              </div>
            </div>

            {/* System Information Card */}
            {device.system_info && (
              <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
                <h2 className="text-xl font-semibold text-white mb-4">System Information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {device.system_info.os_name && (
                    <InfoRow label="Operating System" value={device.system_info.os_name} />
                  )}
                  {device.system_info.os_version && (
                    <InfoRow label="OS Version" value={device.system_info.os_version} />
                  )}
                  {device.system_info.os_arch && (
                    <InfoRow label="Architecture" value={device.system_info.os_arch} />
                  )}
                  {device.system_info.cpu_name && (
                    <InfoRow label="CPU" value={device.system_info.cpu_name} />
                  )}
                  {device.system_info.cpu_cores !== null && device.system_info.cpu_count !== null && (
                    <InfoRow 
                      label="CPU Cores" 
                      value={`${device.system_info.cpu_cores} physical, ${device.system_info.cpu_count} logical`} 
                    />
                  )}
                  {device.system_info.ram_total_gb !== null && (
                    <InfoRow 
                      label="RAM" 
                      value={
                        <div>
                          {device.system_info.ram_total_gb} GB total
                          {device.system_info.ram_available_gb !== null && (
                            <span className="text-neutral-500">, {device.system_info.ram_available_gb} GB available</span>
                          )}
                          {device.system_info.ram_used_percent !== null && device.system_info.ram_used_percent !== undefined && (
                            <span className={`ml-2 ${device.system_info.ram_used_percent > 90 ? 'text-yellow-400' : 'text-neutral-400'}`}>
                              ({device.system_info.ram_used_percent}% used)
                            </span>
                          )}
                        </div>
                      } 
                    />
                  )}
                  {device.system_info.gpu_name && (
                    <InfoRow label="Graphics Card" value={device.system_info.gpu_name} />
                  )}
                  {device.system_info.disk_total_gb !== null && (
                    <InfoRow 
                      label="Storage" 
                      value={
                        <div>
                          {device.system_info.disk_total_gb} GB total
                          {device.system_info.disk_free_gb !== null && (
                            <span className="text-neutral-500">, {device.system_info.disk_free_gb} GB free</span>
                          )}
                          {device.system_info.disk_used_percent !== null && device.system_info.disk_used_percent !== undefined && (
                            <span className={`ml-2 ${device.system_info.disk_low_space ? 'text-red-400 font-semibold' : device.system_info.disk_used_percent > 80 ? 'text-yellow-400' : 'text-neutral-400'}`}>
                              ({device.system_info.disk_used_percent}% used)
                              {device.system_info.disk_low_space && ' ⚠️ Low Space'}
                            </span>
                          )}
                        </div>
                      } 
                    />
                  )}
                  {device.system_info.iracing_process_running !== null && (
                    <InfoRow 
                      label="iRacing Process" 
                      value={
                        device.system_info.iracing_process_running ? (
                          <span className="text-green-400">Running</span>
                        ) : (
                          <span className="text-red-400">Not Running</span>
                        )
                      } 
                    />
                  )}
                  {device.system_info.iracing_processes && device.system_info.iracing_processes.length > 0 && (
                    <InfoRow 
                      label="iRacing Processes" 
                      value={device.system_info.iracing_processes.join(", ")} 
                    />
                  )}
                  {device.system_info.python_version && (
                    <InfoRow label="Python Version" value={device.system_info.python_version} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Queue Card */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Queue</h2>
              {queue.length === 0 ? (
                <p className="text-sm text-neutral-500">No one in queue</p>
              ) : (
                <div className="space-y-2">
                  {queue.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border border-neutral-800 bg-neutral-900"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          Position {entry.position}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          entry.status === "active" ? "bg-green-900/30 text-green-400" :
                          entry.status === "waiting" ? "bg-yellow-900/30 text-yellow-400" :
                          "bg-neutral-800 text-neutral-400"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.user?.email && (
                        <p className="text-xs text-neutral-500">{entry.user.email}</p>
                      )}
                      {entry.started_at && (
                        <p className="text-xs text-neutral-600 mt-1">
                          Started: {new Date(entry.started_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <a
                  href={`/devices/${deviceId}/queue`}
                  className="block w-full px-4 py-2 text-sm text-center bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
                >
                  View Queue
                </a>
                <a
                  href={`/devices/${deviceId}/laps`}
                  className="block w-full px-4 py-2 text-sm text-center border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-lg transition"
                >
                  View Laps
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-neutral-400 mb-1">{label}</div>
      <div className="text-white font-medium break-words">{value}</div>
    </div>
  );
}
