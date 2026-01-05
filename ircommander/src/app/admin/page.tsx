"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, isAuthenticated, clearAuth, authenticatedFetch, type User } from "@/lib/auth";

interface AdminStats {
  total_users: number;
  total_devices: number;
  total_laps: number;
  active_devices: number;
  total_credits: number;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  credit_balance?: number;
  role: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Device {
  device_id: string;
  name: string | null;
  device_name: string | null;
  status: string;
  hardware_id: string | null;
  owner_type: string | null;
  owner_id: string | null;
  assigned_tenant_id: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  last_seen: string | null;
  is_online?: boolean;
}

interface QueueEntry {
  id: string;
  user_id: string;
  device_id: string;
  position: number;
  status: "waiting" | "active" | "completed" | "cancelled";
  joined_at: string;
  started_at: string | null;
  completed_at: string | null;
  user?: {
    email: string;
    display_name: string | null;
  };
}

interface CreditBalance {
  credits: number;
  session_cost: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type TabType = "overview" | "queue" | "credits" | "devices" | "users" | "timed-session" | "systems-check";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  
  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Queue testing state
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  
  // Timed session state
  const [sessionDuration, setSessionDuration] = useState("60");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [sessionPolling, setSessionPolling] = useState(false);

  // Credit testing state
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState("1000");
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");

  // Device testing state
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [newDeviceHardwareId, setNewDeviceHardwareId] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState("");
  const [commandDeviceId, setCommandDeviceId] = useState("");
  const [commandAction, setCommandAction] = useState("enter_car");
  const [commandParams, setCommandParams] = useState("{}");
  const [commandLoading, setCommandLoading] = useState(false);

  // User testing state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");

  // Systems check state
  const [systemsCheckLoading, setSystemsCheckLoading] = useState(false);
  const [systemsCheckResults, setSystemsCheckResults] = useState<any>(null);
  const [systemsCheckDeviceId, setSystemsCheckDeviceId] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth/login");
      return;
    }
    const currentUser = getUser();
    setUser(currentUser);
    setLoading(false);
    loadStats();
    if (activeTab === "credits") {
      loadCreditBalance();
    }
  }, [router]);

  useEffect(() => {
    if (activeTab === "devices" || activeTab === "queue" || activeTab === "timed-session" || activeTab === "systems-check") {
      loadDevices();
    } else if (activeTab === "users") {
      loadUsers();
    }
  }, [activeTab]);

  const loadSessionStatus = async () => {
    if (!selectedDeviceId) return;
    try {
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/timed-session`);
      const result = await response.json();
      if (response.ok && result.success) {
        setSessionStatus(result.data);
        // Update polling state based on whether session is active
        if (result.data.active) {
          setSessionPolling(true);
        } else {
          setSessionPolling(false);
        }
      }
    } catch (error) {
      console.error("Error loading session status:", error);
    }
  };

  // Poll session status continuously when device is selected
  useEffect(() => {
    if (!selectedDeviceId) {
      setSessionPolling(false);
      return;
    }
    
    // Load initial status
    loadSessionStatus();
    
    // Poll every second for live updates
    const interval = setInterval(() => {
      loadSessionStatus();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [selectedDeviceId]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const response = await authenticatedFetch("/api/v1/admin/stats");
      if (!response.ok) {
        if (response.status === 403) {
          setStatsError("Access denied: Admin privileges required");
          router.push("/dashboard");
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: Failed to load statistics`;
        setStatsError(errorMessage);
        setStats(null);
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
        setStatsError(null);
      } else {
        const errorMessage = result.message || "Invalid response format";
        setStatsError(errorMessage);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      setStatsError(error instanceof Error ? error.message : "Failed to load statistics");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [router]);

  const loadDevices = async () => {
    try {
      setDevicesLoading(true);
      const response = await authenticatedFetch("/api/v1/admin/devices?limit=100");
      if (!response.ok) {
        // 401 means not authenticated - will be handled by authenticatedFetch redirect
        if (response.status === 401) {
          return; // authenticatedFetch will redirect to login
        }
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || "Failed to load devices";
        console.error("Error loading devices:", errorMessage, response.status);
        setDevices([]);
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        setDevices(result.data.devices || []);
      } else {
        console.error("Devices response not successful:", result);
        setDevices([]);
      }
    } catch (error) {
      console.error("Error loading devices:", error);
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const url = `/api/v1/admin/users?limit=100${usersSearch ? `&search=${encodeURIComponent(usersSearch)}` : ''}`;
      const response = await authenticatedFetch(url);
      if (!response.ok) throw new Error("Failed to load users");
      const result = await response.json();
      if (result.success && result.data) {
        setUsers(result.data.users || []);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadCreditBalance = async () => {
    try {
      setCreditLoading(true);
      const response = await authenticatedFetch("/api/v1/credits/balance");
      if (!response.ok) throw new Error("Failed to load balance");
      const result = await response.json();
      if (result.success && result.data) {
        setCreditBalance(result.data);
      }
    } catch (error) {
      console.error("Error loading credit balance:", error);
    } finally {
      setCreditLoading(false);
    }
  };

  const loadQueue = async (deviceId: string) => {
    try {
      setQueueLoading(true);
      setQueueError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${deviceId}/queue`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to load queue");
      }
      const result = await response.json();
      if (result.success && result.data) {
        setQueueEntries(result.data.queue || []);
      }
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to load queue");
    } finally {
      setQueueLoading(false);
    }
  };

  const handleJoinQueue = async () => {
    if (!selectedDeviceId) {
      alert("Please select a device first");
      return;
    }
    try {
      setQueueError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join queue");
      }
      await loadQueue(selectedDeviceId);
      alert("Successfully joined queue!");
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to join queue");
      alert(error instanceof Error ? error.message : "Failed to join queue");
    }
  };

  const handleActivateQueue = async () => {
    if (!selectedDeviceId) {
      alert("Please select a device first");
      return;
    }
    try {
      setQueueError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/activate`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to activate queue");
      }
      await loadQueue(selectedDeviceId);
      alert("Session activated!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to activate queue");
    }
  };

  const handleCompleteQueue = async () => {
    if (!selectedDeviceId) {
      alert("Please select a device first");
      return;
    }
    try {
      setQueueError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/complete`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to complete session");
      }
      await loadQueue(selectedDeviceId);
      alert("Session completed!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to complete session");
    }
  };

  const handleLeaveQueue = async () => {
    if (!selectedDeviceId) {
      alert("Please select a device first");
      return;
    }
    try {
      setQueueError(null);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to leave queue");
      }
      await loadQueue(selectedDeviceId);
      alert("Left queue successfully!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to leave queue");
    }
  };

  const handlePurchaseCredits = async () => {
    try {
      setCreditLoading(true);
      const amount = parseInt(purchaseAmount);
      if (isNaN(amount) || amount < 100) {
        alert("Amount must be at least 100 credits");
        return;
      }
      const response = await authenticatedFetch("/api/v1/credits/purchase", {
        method: "POST",
        body: JSON.stringify({ amount, payment_method: "test" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to purchase credits");
      }
      const result = await response.json();
      await loadCreditBalance();
      alert(`Successfully purchased ${amount} credits! New balance: ${result.data.new_balance / 100}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to purchase credits");
    } finally {
      setCreditLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    if (!newDeviceHardwareId) {
      alert("Hardware ID is required");
      return;
    }
    try {
      setDevicesLoading(true);
      const response = await fetch("/api/v1/device/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardware_id: newDeviceHardwareId,
          name: newDeviceName || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to register device");
      }
      const result = await response.json();
      await loadDevices();
      setNewDeviceHardwareId("");
      setNewDeviceName("");
      alert(`Device registered! Device ID: ${result.data.device_id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to register device");
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleUpdateDeviceStatus = async (deviceId: string, status: string) => {
    try {
      const response = await authenticatedFetch(`/api/v1/devices/${deviceId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }
      await loadDevices();
      alert("Device status updated!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleStartTimedSession = async () => {
    if (!selectedDeviceId) {
      alert("Please select a device first");
      return;
    }
    try {
      setSessionLoading(true);
      setQueueError(null);
      const duration = parseInt(sessionDuration);
      if (isNaN(duration) || duration < 30 || duration > 600) {
        alert("Duration must be between 30 and 600 seconds");
        return;
      }
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/timed-session`, {
        method: "POST",
        body: JSON.stringify({ duration_seconds: duration }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        alert(`Timed session started! ${result.data.message}`);
        // Refresh session status to get latest state
        await loadSessionStatus();
        setSessionPolling(true);
      } else {
        alert(result.message || result.error?.message || "Failed to start timed session");
        // Still refresh status in case state changed
        await loadSessionStatus();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start timed session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCancelTimedSession = async () => {
    if (!selectedDeviceId) {
      return;
    }
    if (!confirm("Are you sure you want to cancel the active timed session?")) {
      return;
    }
    try {
      setSessionLoading(true);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/timed-session`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        alert("Timed session cancelled");
        // Refresh session status to clear the active session display
        await loadSessionStatus();
        setSessionPolling(false);
        setSessionStatus(null); // Clear the status immediately
      } else {
        alert(result.message || result.error?.message || "Failed to cancel timed session");
        // Still refresh status
        await loadSessionStatus();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to cancel timed session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleStartTimer = async () => {
    if (!selectedDeviceId) {
      return;
    }
    try {
      setSessionLoading(true);
      const response = await authenticatedFetch(`/api/v1/devices/${selectedDeviceId}/queue/timed-session/start-timer`, {
        method: "POST",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        // Refresh session status to show the timer has started
        await loadSessionStatus();
      } else {
        alert(result.message || result.error?.message || "Failed to start timer");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start timer");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSendCommand = async () => {
    if (!commandDeviceId || !commandAction) {
      alert("Device ID and command action are required");
      return;
    }
    try {
      setCommandLoading(true);
      let params = {};
      try {
        params = JSON.parse(commandParams || "{}");
      } catch (e) {
        alert("Invalid JSON in command parameters");
        return;
      }
      const response = await authenticatedFetch(`/api/v1/devices/${commandDeviceId}/commands`, {
        method: "POST",
        body: JSON.stringify({
          command_action: commandAction,
          command_params: params,
          command_type: "owner",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send command");
      }
      const result = await response.json();
      alert(`Command sent successfully! Command ID: ${result.data.command_id}`);
      setCommandParams("{}");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send command");
    } finally {
      setCommandLoading(false);
    }
  };

  const handleSystemsCheck = async () => {
    if (!systemsCheckDeviceId) {
      alert("Please select a device first");
      return;
    }
    
    setSystemsCheckLoading(true);
    setSystemsCheckResults(null);
    
    const results: any = {
      timestamp: new Date().toISOString(),
      device_id: systemsCheckDeviceId,
      tests: {},
      overall: "running"
    };
    
    try {
      // Test 1: Health Check
      results.tests.health = { status: "running", message: "Testing API health..." };
      setSystemsCheckResults({ ...results });
      try {
        const healthResponse = await fetch("/api/v1/health");
        const healthData = await healthResponse.json();
        results.tests.health = {
          status: healthResponse.ok ? "pass" : "fail",
          message: healthResponse.ok ? "API is healthy" : "API health check failed",
          data: healthData
        };
      } catch (error) {
        results.tests.health = {
          status: "fail",
          message: `Health check error: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
      
      // Test 2: Database Connectivity (via stats)
      results.tests.database = { status: "running", message: "Testing database connection..." };
      setSystemsCheckResults({ ...results });
      try {
        const statsResponse = await authenticatedFetch("/api/v1/admin/stats");
        results.tests.database = {
          status: statsResponse.ok ? "pass" : "fail",
          message: statsResponse.ok ? "Database connection successful" : "Database connection failed",
          data: statsResponse.ok ? await statsResponse.json() : null
        };
      } catch (error) {
        results.tests.database = {
          status: "fail",
          message: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
      
      // Test 3: Device Status
      results.tests.deviceStatus = { status: "running", message: "Checking device status..." };
      setSystemsCheckResults({ ...results });
      try {
        const statusResponse = await authenticatedFetch(`/api/v1/devices/${systemsCheckDeviceId}/status`);
        const statusData = await statusResponse.json();
        results.tests.deviceStatus = {
          status: statusResponse.ok ? "pass" : "fail",
          message: statusResponse.ok ? "Device status retrieved" : "Failed to get device status",
          data: statusData
        };
      } catch (error) {
        results.tests.deviceStatus = {
          status: "fail",
          message: `Device status error: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
      
      // Test 4: Send Test Command (enter_car)
      results.tests.commandEnterCar = { status: "running", message: "Sending enter_car command..." };
      setSystemsCheckResults({ ...results });
      try {
        const commandResponse = await authenticatedFetch(`/api/v1/devices/${systemsCheckDeviceId}/commands`, {
          method: "POST",
          body: JSON.stringify({
            command_action: "enter_car",
            command_params: {},
            command_type: "owner"
          })
        });
        let commandData;
        try {
          const text = await commandResponse.text();
          commandData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          commandData = {};
          console.warn("Failed to parse command response as JSON:", parseError);
        }
        
        results.tests.commandEnterCar = {
          status: commandResponse.ok ? "pass" : "fail",
          message: commandResponse.ok ? "Command sent successfully" : "Failed to send command",
          data: commandData
        };
        
        // Wait a bit and check if command was processed
        if (commandResponse.ok && commandData.data?.command_id) {
          const commandId = commandData.data.command_id;
          results.tests.commandEnterCar.message += ` (Command ID: ${commandId.substring(0, 8)}...)`;
          
          // Poll for command status (device processes commands asynchronously)
          let commandCompleted = false;
          let attempts = 0;
          const maxAttempts = 10; // Poll for up to 10 seconds
          
          while (!commandCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between checks
            attempts++;
            
            try {
              const statusResponse = await authenticatedFetch(`/api/v1/admin/commands/${commandId}`);
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.success && statusData.data?.command) {
                  const cmd = statusData.data.command;
                  if (cmd.status === "completed") {
                    commandCompleted = true;
                    results.tests.commandEnterCar.status = "pass";
                    results.tests.commandEnterCar.iracingResponse = true;
                    results.tests.commandEnterCar.message += ` ✓ Executed successfully`;
                    if (cmd.result?.success !== undefined) {
                      results.tests.commandEnterCar.message += ` (Device confirmed: ${cmd.result.success})`;
                    }
                  } else if (cmd.status === "failed") {
                    commandCompleted = true;
                    results.tests.commandEnterCar.status = "fail";
                    results.tests.commandEnterCar.iracingResponse = false;
                    results.tests.commandEnterCar.message += ` ✗ Failed: ${cmd.error_message || "Unknown error"}`;
                  } else if (cmd.status === "pending") {
                    // Still pending, continue polling
                    results.tests.commandEnterCar.message = `Command sent (polling... ${attempts}/${maxAttempts})`;
                    setSystemsCheckResults({ ...results });
                  }
                }
              }
            } catch (checkError) {
              // If status check fails, continue polling
              console.warn("Error checking command status:", checkError);
            }
          }
          
          if (!commandCompleted) {
            results.tests.commandEnterCar.message += ` (Timeout: Command still pending after ${maxAttempts}s)`;
            results.tests.commandEnterCar.iracingResponse = "timeout";
          }
        }
      } catch (error) {
        // Check if it's a JSON parsing error (empty response)
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        if (errorMsg.includes("JSON") || errorMsg.includes("Unexpected end")) {
          // Command was likely sent but response parsing failed - still mark as pass if we got command_id
          if (results.tests.commandEnterCar?.data?.data?.command_id) {
            results.tests.commandEnterCar.status = "pass";
            results.tests.commandEnterCar.message = "Command sent successfully (response parsing issue)";
          } else {
            results.tests.commandEnterCar = {
              status: "fail",
              message: `Command error: ${errorMsg}`
            };
          }
        } else {
          results.tests.commandEnterCar = {
            status: "fail",
            message: `Command error: ${errorMsg}`
          };
        }
      }
      
      // Test 5: Send Test Command (reset_car)
      results.tests.commandResetCar = { status: "running", message: "Sending reset_car command..." };
      setSystemsCheckResults({ ...results });
      try {
        const commandResponse = await authenticatedFetch(`/api/v1/devices/${systemsCheckDeviceId}/commands`, {
          method: "POST",
          body: JSON.stringify({
            command_action: "reset_car",
            command_params: {},
            command_type: "owner"
          })
        });
        let commandData;
        try {
          const text = await commandResponse.text();
          commandData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          commandData = {};
          console.warn("Failed to parse command response as JSON:", parseError);
        }
        
        results.tests.commandResetCar = {
          status: commandResponse.ok ? "pass" : "fail",
          message: commandResponse.ok ? "Command sent successfully" : "Failed to send command",
          data: commandData
        };
        
        // Wait and check if command was processed
        if (commandResponse.ok && commandData.data?.command_id) {
          const commandId = commandData.data.command_id;
          results.tests.commandResetCar.message += ` (Command ID: ${commandId.substring(0, 8)}...)`;
          
          // Poll for command status
          let commandCompleted = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!commandCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            try {
              const statusResponse = await authenticatedFetch(`/api/v1/admin/commands/${commandId}`);
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.success && statusData.data?.command) {
                  const cmd = statusData.data.command;
                  if (cmd.status === "completed") {
                    commandCompleted = true;
                    results.tests.commandResetCar.status = "pass";
                    results.tests.commandResetCar.iracingResponse = true;
                    results.tests.commandResetCar.message += ` ✓ Executed successfully`;
                    if (cmd.result?.success !== undefined) {
                      results.tests.commandResetCar.message += ` (Device confirmed: ${cmd.result.success})`;
                    }
                  } else if (cmd.status === "failed") {
                    commandCompleted = true;
                    results.tests.commandResetCar.status = "fail";
                    results.tests.commandResetCar.iracingResponse = false;
                    results.tests.commandResetCar.message += ` ✗ Failed: ${cmd.error_message || "Unknown error"}`;
                  } else if (cmd.status === "pending") {
                    results.tests.commandResetCar.message = `Command sent (polling... ${attempts}/${maxAttempts})`;
                    setSystemsCheckResults({ ...results });
                  }
                }
              }
            } catch (checkError) {
              console.warn("Error checking command status:", checkError);
            }
          }
          
          if (!commandCompleted) {
            results.tests.commandResetCar.message += ` (Timeout: Command still pending after ${maxAttempts}s)`;
            results.tests.commandResetCar.iracingResponse = "timeout";
          }
        }
      } catch (error) {
        results.tests.commandResetCar = {
          status: "fail",
          message: `Command error: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
      
      // Test 6: Send Test Command (ignition)
      results.tests.commandIgnition = { status: "running", message: "Sending ignition command..." };
      setSystemsCheckResults({ ...results });
      try {
        const commandResponse = await authenticatedFetch(`/api/v1/devices/${systemsCheckDeviceId}/commands`, {
          method: "POST",
          body: JSON.stringify({
            command_action: "ignition",
            command_params: {},
            command_type: "owner"
          })
        });
        let commandData;
        try {
          const text = await commandResponse.text();
          commandData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          commandData = {};
          console.warn("Failed to parse command response as JSON:", parseError);
        }
        
        results.tests.commandIgnition = {
          status: commandResponse.ok ? "pass" : "fail",
          message: commandResponse.ok ? "Command sent successfully" : "Failed to send command",
          data: commandData
        };
        
        // Wait and check if command was processed
        if (commandResponse.ok && commandData.data?.command_id) {
          const commandId = commandData.data.command_id;
          results.tests.commandIgnition.message += ` (Command ID: ${commandId.substring(0, 8)}...)`;
          
          // Poll for command status
          let commandCompleted = false;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!commandCompleted && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            try {
              const statusResponse = await authenticatedFetch(`/api/v1/admin/commands/${commandId}`);
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.success && statusData.data?.command) {
                  const cmd = statusData.data.command;
                  if (cmd.status === "completed") {
                    commandCompleted = true;
                    results.tests.commandIgnition.status = "pass";
                    results.tests.commandIgnition.iracingResponse = true;
                    results.tests.commandIgnition.message += ` ✓ Executed successfully`;
                    if (cmd.result?.success !== undefined) {
                      results.tests.commandIgnition.message += ` (Device confirmed: ${cmd.result.success})`;
                    }
                  } else if (cmd.status === "failed") {
                    commandCompleted = true;
                    results.tests.commandIgnition.status = "fail";
                    results.tests.commandIgnition.iracingResponse = false;
                    results.tests.commandIgnition.message += ` ✗ Failed: ${cmd.error_message || "Unknown error"}`;
                  } else if (cmd.status === "pending") {
                    results.tests.commandIgnition.message = `Command sent (polling... ${attempts}/${maxAttempts})`;
                    setSystemsCheckResults({ ...results });
                  }
                }
              }
            } catch (checkError) {
              console.warn("Error checking command status:", checkError);
            }
          }
          
          if (!commandCompleted) {
            results.tests.commandIgnition.message += ` (Timeout: Command still pending after ${maxAttempts}s)`;
            results.tests.commandIgnition.iracingResponse = "timeout";
          }
        }
      } catch (error) {
        // Check if it's a JSON parsing error (empty response)
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        if (errorMsg.includes("JSON") || errorMsg.includes("Unexpected end")) {
          // Command was likely sent but response parsing failed - still mark as pass if we got command_id
          if (results.tests.commandIgnition?.data?.data?.command_id) {
            results.tests.commandIgnition.status = "pass";
            results.tests.commandIgnition.message = "Command sent successfully (response parsing issue)";
          } else {
            results.tests.commandIgnition = {
              status: "fail",
              message: `Command error: ${errorMsg}`
            };
          }
        } else {
          results.tests.commandIgnition = {
            status: "fail",
            message: `Command error: ${errorMsg}`
          };
        }
      }
      
      // Calculate overall status
      const testResults = Object.values(results.tests);
      const passed = testResults.filter((t: any) => t.status === "pass").length;
      const failed = testResults.filter((t: any) => t.status === "fail").length;
      const total = testResults.length;
      
      results.overall = failed === 0 ? "pass" : failed > 0 ? "fail" : "partial";
      results.summary = {
        total,
        passed,
        failed,
        running: testResults.filter((t: any) => t.status === "running").length
      };
      
    } catch (error) {
      results.overall = "fail";
      results.error = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setSystemsCheckResults(results);
      setSystemsCheckLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  if (loading || !user) {
    // If not authenticated, show login prompt instead of loading
    if (!isAuthenticated()) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <div className="text-center">
            <div className="text-white text-xl font-semibold mb-4">Authentication Required</div>
            <div className="text-neutral-400 mb-6">Please log in to access the admin dashboard.</div>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Admin Testing Dashboard</h1>
            <p className="text-neutral-400">
              Comprehensive testing interface for all iRCommander functionality
            </p>
          </div>
          <div className="flex gap-3">
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-neutral-800 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "systems-check", label: "Systems Check" },
            { id: "queue", label: "Queue Testing" },
            { id: "timed-session", label: "Timed Session Testing" },
            { id: "credits", label: "Credit Testing" },
            { id: "devices", label: "Device Testing" },
            { id: "users", label: "User Management" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            {statsLoading ? (
              <div className="text-center py-12 text-neutral-400">Loading statistics...</div>
            ) : stats ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                  <div className="text-neutral-400 text-sm mb-2">Total Users</div>
                  <div className="text-3xl font-semibold text-white">{stats.total_users.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                  <div className="text-neutral-400 text-sm mb-2">Total Devices</div>
                  <div className="text-3xl font-semibold text-white">{stats.total_devices.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                  <div className="text-neutral-400 text-sm mb-2">Active Devices</div>
                  <div className="text-3xl font-semibold text-green-400">{stats.active_devices.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                  <div className="text-neutral-400 text-sm mb-2">Total Laps</div>
                  <div className="text-3xl font-semibold text-white">{stats.total_laps.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                  <div className="text-neutral-400 text-sm mb-2">Total Credits</div>
                  <div className="text-3xl font-semibold text-blue-400">{(stats.total_credits / 100).toFixed(2)}</div>
                  <div className="text-xs text-neutral-500 mt-1">${(stats.total_credits / 100).toFixed(2)}</div>
                </div>
              </div>
            ) : statsError ? (
              <div className="text-center py-12">
                <div className="text-red-400 mb-2 font-semibold">Failed to load statistics</div>
                <div className="text-sm text-neutral-500 mb-4">{statsError}</div>
                <button
                  onClick={loadStats}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition text-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">Failed to load statistics</div>
            )}
            <div className="mt-8 p-6 rounded-xl border border-orange-500/50 bg-orange-500/10">
              <h3 className="text-lg font-semibold text-white mb-2">Testing Interface</h3>
              <p className="text-neutral-300 text-sm">
                Use the tabs above to test all functionality: queues, credits, devices, and user management.
                All operations are performed with your authenticated user account.
              </p>
            </div>
          </div>
        )}

        {/* Timed Session Testing Tab */}
        {activeTab === "timed-session" && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-orange-500/50 bg-orange-500/10">
              <h2 className="text-xl font-semibold text-white mb-4">Timed Session Testing</h2>
              
              {/* Device Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Select Device</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    if (e.target.value) {
                      loadSessionStatus();
                    }
                  }}
                  className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                >
                  <option value="">-- Select a device --</option>
                  {devices.map((device) => (
                    <option key={device.device_id} value={device.device_id}>
                      {device.name || device.device_name || device.device_id}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Session Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(e.target.value)}
                    min="30"
                    max="600"
                    placeholder="60"
                    className="w-full max-w-xs px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Duration in seconds (30-600). Timer starts when car begins moving.
                  </p>
                </div>

                {!sessionStatus?.active ? (
                  <>
                    <button
                      onClick={handleStartTimedSession}
                      disabled={sessionLoading || !selectedDeviceId}
                      className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sessionLoading ? "Starting..." : "Start Drive (Timed Session)"}
                    </button>
                    {!selectedDeviceId && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Please select a device first
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleCancelTimedSession}
                    disabled={sessionLoading}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sessionLoading ? "Cancelling..." : "Cancel Active Session"}
                  </button>
                )}

                {sessionStatus?.active && (
                  <div className="mt-4 p-6 rounded-lg border border-orange-500/50 bg-neutral-900/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-white">Active Session</h3>
                      <div className="flex items-center gap-3">
                        {!sessionStatus.session.timer_started_at && (
                          <button
                            onClick={handleStartTimer}
                            disabled={sessionLoading}
                            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition disabled:opacity-50"
                          >
                            Start Timer (Test)
                          </button>
                        )}
                        <span className="px-3 py-1 rounded text-sm bg-green-500/20 text-green-300 capitalize">
                          {sessionStatus.session.state?.replace(/_/g, " ") || "Active"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Remaining Time Display */}
                    <div className="mb-4">
                      {sessionStatus.session.time_remaining_seconds !== null && sessionStatus.session.time_remaining_seconds > 0 ? (
                        <>
                          <div className="text-4xl font-bold text-orange-400 mb-1">
                            {Math.floor(sessionStatus.session.time_remaining_seconds / 60)}:
                            {(sessionStatus.session.time_remaining_seconds % 60).toString().padStart(2, "0")}
                          </div>
                          <div className="text-sm text-neutral-400">
                            Time Remaining
                          </div>
                        </>
                      ) : sessionStatus.session.state === "waiting_for_movement" || sessionStatus.session.state === "entering_car" ? (
                        <>
                          <div className="text-4xl font-bold text-blue-400 mb-1">
                            {Math.floor(sessionStatus.session.duration_seconds / 60)}:
                            {(sessionStatus.session.duration_seconds % 60).toString().padStart(2, "0")}
                          </div>
                          <div className="text-sm text-neutral-400">
                            Session Duration (timer starts when car moves)
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-bold text-yellow-400 mb-1">
                            {sessionStatus.session.duration_seconds}s
                          </div>
                          <div className="text-sm text-neutral-400">
                            Session Duration
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-sm text-neutral-400 space-y-1">
                      <div>Total Duration: {sessionStatus.session.duration_seconds} seconds</div>
                      {sessionStatus.session.calculated_duration && sessionStatus.session.calculated_duration !== sessionStatus.session.duration_seconds && (
                        <div className="text-orange-400">
                          Adjusted Duration: {Math.floor(sessionStatus.session.calculated_duration / 60)}:{(sessionStatus.session.calculated_duration % 60).toString().padStart(2, "0")} (based on avg lap time)
                        </div>
                      )}
                      {sessionStatus.session.average_lap_time && (
                        <div className="text-blue-400">
                          Avg Lap Time: {sessionStatus.session.average_lap_time.toFixed(2)}s
                          {sessionStatus.session.track_name && sessionStatus.session.car_name && (
                            <span className="text-neutral-500"> ({sessionStatus.session.car_name} @ {sessionStatus.session.track_name})</span>
                          )}
                        </div>
                      )}
                      {sessionStatus.session.laps_target && (
                        <div className="text-green-400">
                          Target Laps: ~{sessionStatus.session.laps_target}
                        </div>
                      )}
                      {sessionStatus.session.timer_started_at && (
                        <div>Timer started: {new Date(sessionStatus.session.timer_started_at).toLocaleTimeString()}</div>
                      )}
                      {sessionStatus.session.timer_expires_at && (
                        <div>Timer expires: {new Date(sessionStatus.session.timer_expires_at).toLocaleTimeString()}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Queue Operations</h2>
              
              {/* Device Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Select Device</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    if (e.target.value) loadQueue(e.target.value);
                  }}
                  className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                >
                  <option value="">-- Select a device --</option>
                  {devices.map((device) => (
                    <option key={device.device_id} value={device.device_id}>
                      {device.name || device.device_name || device.device_id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Queue Actions */}
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={handleJoinQueue}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  Join Queue
                </button>
                <button
                  onClick={handleActivateQueue}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Activate Session
                </button>
                <button
                  onClick={handleCompleteQueue}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  Complete Session
                </button>
                <button
                  onClick={handleLeaveQueue}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Leave Queue
                </button>
                <button
                  onClick={() => selectedDeviceId && loadQueue(selectedDeviceId)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition"
                  disabled={queueLoading}
                >
                  {queueLoading ? "Loading..." : "Refresh Queue"}
                </button>
              </div>

              {queueError && (
                <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-400 text-sm mb-4">
                  {queueError}
                </div>
              )}

              {/* Queue Display */}
              {selectedDeviceId && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Current Queue</h3>
                  {queueEntries.length === 0 ? (
                    <p className="text-neutral-400">Queue is empty</p>
                  ) : (
                    <div className="space-y-2">
                      {queueEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-4 rounded-lg border ${
                            entry.status === "active"
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-neutral-800 bg-neutral-900/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-medium">
                                Position {entry.position} - {entry.user?.email || entry.user_id}
                              </div>
                              <div className="text-sm text-neutral-400">
                                Status: {entry.status} • Joined: {formatDate(entry.joined_at)}
                              </div>
                            </div>
                            <span
                              className={`px-3 py-1 rounded text-sm ${
                                entry.status === "active"
                                  ? "bg-green-500/20 text-green-300"
                                  : "bg-neutral-700 text-neutral-300"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credit Testing Tab */}
        {activeTab === "credits" && (
          <div className="space-y-6">
            {/* Current Balance */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Your Credit Balance</h2>
              {creditLoading ? (
                <p className="text-neutral-400">Loading...</p>
              ) : creditBalance ? (
                <div>
                  <div className="text-3xl font-semibold text-white mb-2">
                    {(creditBalance.credits / 100).toFixed(2)} credits
                  </div>
                  <div className="text-sm text-neutral-400">
                    Session cost: {(creditBalance.session_cost / 100).toFixed(2)} credits
                  </div>
                </div>
              ) : (
                <p className="text-neutral-400">Failed to load balance</p>
              )}
              <button
                onClick={loadCreditBalance}
                className="mt-4 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition"
              >
                Refresh Balance
              </button>
            </div>

            {/* Purchase Credits */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Purchase Credits (Test Mode)</h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-xs">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Amount (credits)</label>
                  <input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    min="100"
                    step="100"
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <button
                  onClick={handlePurchaseCredits}
                  disabled={creditLoading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {creditLoading ? "Processing..." : "Purchase"}
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Minimum purchase: 100 credits. Uses test payment method (no real charge).
              </p>
            </div>
          </div>
        )}

        {/* Device Testing Tab */}
        {activeTab === "devices" && (
          <div className="space-y-6">
            {/* Send Command to Device */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Send Command to Device</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Device ID *</label>
                  <select
                    value={commandDeviceId}
                    onChange={(e) => setCommandDeviceId(e.target.value)}
                    className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                  >
                    <option value="">-- Select a device --</option>
                    {devices.map((device) => (
                      <option key={device.device_id} value={device.device_id}>
                        {device.name || device.device_name || device.device_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Command Action *</label>
                  <select
                    value={commandAction}
                    onChange={(e) => setCommandAction(e.target.value)}
                    className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                  >
                    <option value="enter_car">Enter Car</option>
                    <option value="reset_car">Reset Car</option>
                    <option value="ignition">Ignition</option>
                    <option value="starter">Starter</option>
                    <option value="pit_speed_limiter">Pit Speed Limiter</option>
                  </select>
                  <p className="text-xs text-neutral-500 mt-1">
                    Select the command action to send to the device
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Command Parameters (JSON)</label>
                  <textarea
                    value={commandParams}
                    onChange={(e) => setCommandParams(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                    className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono text-sm"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Optional JSON object with command parameters. Examples: {"{"}"car": "ford_gt", "track": "daytona"{"}"}
                  </p>
                </div>
                <button
                  onClick={handleSendCommand}
                  disabled={commandLoading || !commandDeviceId || !commandAction}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {commandLoading ? "Sending..." : "Send Command"}
                </button>
              </div>
            </div>

            {/* Register New Device */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h2 className="text-xl font-semibold text-white mb-4">Register New Device</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Hardware ID *</label>
                  <input
                    type="text"
                    value={newDeviceHardwareId}
                    onChange={(e) => setNewDeviceHardwareId(e.target.value)}
                    placeholder="unique-hardware-identifier"
                    className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Device Name (optional)</label>
                  <input
                    type="text"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="Racing Rig #1"
                    className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <button
                  onClick={handleRegisterDevice}
                  disabled={devicesLoading || !newDeviceHardwareId}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {devicesLoading ? "Registering..." : "Register Device"}
                </button>
              </div>
            </div>

            {/* Device List */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">All Devices</h2>
                <button
                  onClick={loadDevices}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition text-sm"
                >
                  Refresh
                </button>
              </div>
              {devicesLoading ? (
                <p className="text-neutral-400">Loading devices...</p>
              ) : devices.length === 0 ? (
                <p className="text-neutral-400">No devices found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Device ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {devices.map((device) => (
                        <tr key={device.device_id} className="hover:bg-neutral-800/30">
                          <td className="px-4 py-3 text-sm text-white font-mono">{device.device_id}</td>
                          <td className="px-4 py-3 text-sm text-white">{device.name || device.device_name || "-"}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                device.status === "active" || device.is_online
                                  ? "bg-green-900/50 text-green-300"
                                  : "bg-neutral-700 text-neutral-300"
                              }`}
                            >
                              {device.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <a
                              href={`/devices/${device.device_id}`}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                  className="flex-1 max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
                <button
                  onClick={loadUsers}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition"
                >
                  Search
                </button>
              </div>
              {usersLoading ? (
                <p className="text-neutral-400">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-neutral-400">No users found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Credits</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-neutral-400">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-neutral-800/30">
                          <td className="px-4 py-3 text-sm text-white">{user.email}</td>
                          <td className="px-4 py-3 text-sm text-neutral-400">{user.display_name || "-"}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                user.role === "admin"
                                  ? "bg-purple-900/50 text-purple-300"
                                  : "bg-neutral-700 text-neutral-300"
                              }`}
                            >
                              {user.role || "user"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-white">
                            {((user.credits || user.credit_balance || 0) / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(user.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Systems Check Tab */}
        {activeTab === "systems-check" && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-orange-500/50 bg-orange-500/10">
              <h2 className="text-xl font-semibold text-white mb-4">Systems Check</h2>
              <p className="text-neutral-300 text-sm mb-4">
                Comprehensive system health check that tests database connectivity, API endpoints, device communication, and iRacing command responses.
              </p>
              
              {/* Device Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Select Device to Test</label>
                <select
                  value={systemsCheckDeviceId}
                  onChange={(e) => setSystemsCheckDeviceId(e.target.value)}
                  className="w-full max-w-md px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                >
                  <option value="">-- Select a device --</option>
                  {devices.map((device) => (
                    <option key={device.device_id} value={device.device_id}>
                      {device.name || device.device_name || device.device_id}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleSystemsCheck}
                disabled={systemsCheckLoading || !systemsCheckDeviceId}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {systemsCheckLoading ? "Running Tests..." : "Run Systems Check"}
              </button>
            </div>

            {/* Results */}
            {systemsCheckResults && (
              <div className="space-y-4">
                {/* Overall Status */}
                <div className={`p-6 rounded-xl border ${
                  systemsCheckResults.overall === "pass" 
                    ? "border-green-500/50 bg-green-500/10"
                    : systemsCheckResults.overall === "fail"
                    ? "border-red-500/50 bg-red-500/10"
                    : "border-yellow-500/50 bg-yellow-500/10"
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Overall Status</h3>
                    <span className={`px-4 py-2 rounded text-sm font-medium ${
                      systemsCheckResults.overall === "pass"
                        ? "bg-green-500/20 text-green-300"
                        : systemsCheckResults.overall === "fail"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      {systemsCheckResults.overall === "pass" ? "✓ All Tests Passed" : 
                       systemsCheckResults.overall === "fail" ? "✗ Tests Failed" : 
                       "⚠ Partial Success"}
                    </span>
                  </div>
                  {systemsCheckResults.summary && (
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-neutral-400">Total Tests</div>
                        <div className="text-white text-lg font-semibold">{systemsCheckResults.summary.total}</div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Passed</div>
                        <div className="text-green-400 text-lg font-semibold">{systemsCheckResults.summary.passed}</div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Failed</div>
                        <div className="text-red-400 text-lg font-semibold">{systemsCheckResults.summary.failed}</div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Running</div>
                        <div className="text-yellow-400 text-lg font-semibold">{systemsCheckResults.summary.running}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Individual Test Results */}
                <div className="space-y-3">
                  {Object.entries(systemsCheckResults.tests || {}).map(([testName, testResult]: [string, any]) => (
                    <div
                      key={testName}
                      className={`p-4 rounded-lg border ${
                        testResult.status === "pass"
                          ? "border-green-500/30 bg-green-500/5"
                          : testResult.status === "fail"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-yellow-500/30 bg-yellow-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-white capitalize">
                          {testName.replace(/([A-Z])/g, " $1").trim()}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          testResult.status === "pass"
                            ? "bg-green-500/20 text-green-300"
                            : testResult.status === "fail"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {testResult.status === "pass" ? "✓ Pass" : 
                           testResult.status === "fail" ? "✗ Fail" : 
                           "⏳ Running"}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400">{testResult.message}</p>
                      {testResult.iracingResponse !== undefined && (
                        <p className="text-xs text-neutral-500 mt-1">
                          iRacing Response: {testResult.iracingResponse ? "✓ Responded" : "✗ No Response"}
                        </p>
                      )}
                      {testResult.data && (
                        <details className="mt-2">
                          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-400">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-neutral-900 rounded text-xs text-neutral-300 overflow-x-auto">
                            {JSON.stringify(testResult.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
