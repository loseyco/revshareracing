"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function DeviceTestPage() {
  const params = useParams();
  const deviceId = params.deviceId as string;

  const [commandType, setCommandType] = useState<"driver" | "owner">("owner");
  const [commandAction, setCommandAction] = useState("reset_car");
  const [commandParams, setCommandParams] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<any[]>([]);
  const [polling, setPolling] = useState(false);

  const queueCommand = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let paramsObj = {};
      try {
        paramsObj = JSON.parse(commandParams);
      } catch (e) {
        setError("Invalid JSON in params");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/device/${deviceId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: commandType,
          action: commandAction,
          params: paramsObj,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to queue command");
      } else {
        setResult(data);
        // Refresh pending commands
        fetchPendingCommands();
      }
    } catch (err: any) {
      setError(err.message || "Failed to queue command");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCommands = async () => {
    try {
      const response = await fetch(`/api/device/${deviceId}/commands`);
      const data = await response.json();
      if (response.ok) {
        setPendingCommands(data.commands || []);
      }
    } catch (err) {
      console.error("Failed to fetch commands:", err);
    }
  };

  const startPolling = () => {
    setPolling(true);
    const interval = setInterval(() => {
      fetchPendingCommands();
    }, 2000);

    // Store interval ID for cleanup
    (window as any).__pollInterval = interval;
  };

  const stopPolling = () => {
    setPolling(false);
    if ((window as any).__pollInterval) {
      clearInterval((window as any).__pollInterval);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Device Command Tester</h1>
        <p className="mt-2 text-slate-300">Device ID: {deviceId}</p>
      </div>

      {/* Queue Command Form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">Queue Command</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Command Type
            </label>
            <select
              value={commandType}
              onChange={(e) => setCommandType(e.target.value as "driver" | "owner")}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="owner">Owner</option>
              <option value="driver">Driver</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Command Action
            </label>
            <select
              value={commandAction}
              onChange={(e) => setCommandAction(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            >
              <option value="reset_car">Reset Car</option>
              <option value="enter_car">Enter Car</option>
              <option value="execute_action">Execute Action</option>
              <option value="enable_timed_reset">Enable Timed Reset</option>
              <option value="disable_timed_reset">Disable Timed Reset</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Parameters (JSON)
            </label>
            <textarea
              value={commandParams}
              onChange={(e) => setCommandParams(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white"
              placeholder='{"grace_period": 30, "interval": 300}'
            />
            <p className="mt-1 text-xs text-slate-400">
              Examples: reset_car: &quot;grace_period&quot;: 30 | execute_action: &quot;action&quot;: &quot;pit_speed_limiter&quot; | enable_timed_reset: &quot;interval&quot;: 300, &quot;grace_period&quot;: 30
            </p>
          </div>

          <button
            onClick={queueCommand}
            disabled={loading}
            className="w-full rounded-lg bg-fuchsia-500 px-4 py-2 font-semibold text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {loading ? "Queueing..." : "Queue Command"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
            Error: {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Pending Commands */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Pending Commands</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchPendingCommands}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
            >
              Refresh
            </button>
            {polling ? (
              <button
                onClick={stopPolling}
                className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1 text-sm text-red-200 hover:bg-red-500/20"
              >
                Stop Polling
              </button>
            ) : (
              <button
                onClick={startPolling}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200 hover:bg-emerald-500/20"
              >
                Start Polling (2s)
              </button>
            )}
          </div>
        </div>

        {pendingCommands.length === 0 ? (
          <p className="text-slate-400">No pending commands</p>
        ) : (
          <div className="space-y-2">
            {pendingCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-lg border border-slate-700 bg-slate-800 p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      {cmd.command_type} / {cmd.command_action}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      ID: {cmd.id} | Created: {new Date(cmd.created_at).toLocaleString()}
                    </div>
                    {Object.keys(cmd.command_params || {}).length > 0 && (
                      <div className="mt-2 text-xs text-slate-300">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(cmd.command_params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-200">
                    {cmd.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



