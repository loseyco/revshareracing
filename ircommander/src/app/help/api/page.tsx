import Link from "next/link";

export default function ApiReferencePage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/help"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Help
          </Link>
          <h1 className="text-4xl font-semibold text-white mb-2">API Reference</h1>
          <p className="text-lg text-neutral-400">
            Complete API endpoint documentation
          </p>
        </div>

        {/* Base URL */}
        <div className="mb-8 p-4 rounded-xl border border-orange-500/50 bg-orange-500/10">
          <div className="text-sm text-orange-300 mb-1">Base URL</div>
          <code className="text-orange-400 font-mono text-lg">https://ircommander.gridpass.app/api/v1</code>
        </div>

        {/* Authentication Endpoints */}
        <EndpointSection
          title="Authentication"
          description="User authentication and token management"
          endpoints={[
            {
              method: "POST",
              path: "/auth/login",
              description: "Authenticate a user and return access tokens",
              auth: "None",
              body: { email: "string", password: "string" },
            },
            {
              method: "POST",
              path: "/auth/register",
              description: "Register a new user account",
              auth: "None",
              body: { email: "string", password: "string", name: "string (optional)" },
            },
            {
              method: "POST",
              path: "/auth/refresh",
              description: "Refresh an access token using a refresh token",
              auth: "Bearer Token",
              body: { refresh_token: "string" },
            },
            {
              method: "GET",
              path: "/auth/me",
              description: "Get current authenticated user's profile",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/auth/forgot-password",
              description: "Request a password reset email",
              auth: "None",
              body: { email: "string" },
            },
            {
              method: "POST",
              path: "/auth/reset-password",
              description: "Reset password using a reset token",
              auth: "None",
              body: { token: "string", password: "string" },
            },
          ]}
        />

        {/* Device Endpoints */}
        <EndpointSection
          title="Device Management"
          description="Register, monitor, and manage racing rig devices"
          endpoints={[
            {
              method: "POST",
              path: "/device/register",
              description: "Register a new racing rig device",
              auth: "None (first-time) or X-Device-Key",
              body: { hardware_id: "string", device_id: "string (optional)", name: "string (optional)", tenant_id: "string (optional)" },
            },
            {
              method: "POST",
              path: "/device/heartbeat",
              description: "Send a heartbeat to keep device status active",
              auth: "X-Device-Key",
              body: { status: "string (optional)" },
            },
            {
              method: "GET",
              path: "/device/status",
              description: "Get current device status",
              auth: "X-Device-Key",
            },
            {
              method: "PUT",
              path: "/device/status",
              description: "Update device status",
              auth: "X-Device-Key",
              body: { status: "string", metadata: "object (optional)" },
            },
            {
              method: "POST",
              path: "/device/laps",
              description: "Upload lap data from a racing session",
              auth: "X-Device-Key",
              body: { laps: "array of lap objects" },
            },
            {
              method: "GET",
              path: "/device/commands",
              description: "Poll for pending commands for the device",
              auth: "X-Device-Key",
            },
            {
              method: "POST",
              path: "/device/commands/:commandId/complete",
              description: "Mark a command as completed",
              auth: "X-Device-Key",
              body: { result: "object (optional)" },
            },
            {
              method: "GET",
              path: "/device/test-key",
              description: "Test if a device API key is valid",
              auth: "X-Device-Key",
            },
          ]}
        />

        {/* Devices Endpoints (User/Tenant) */}
        <EndpointSection
          title="Devices (User/Tenant)"
          description="Access devices from user or tenant perspective"
          endpoints={[
            {
              method: "GET",
              path: "/devices",
              description: "List all devices (filtered by tenant/user)",
              auth: "Bearer Token or X-Tenant-Key",
            },
            {
              method: "GET",
              path: "/devices/:deviceId",
              description: "Get detailed information about a specific device",
              auth: "Bearer Token or X-Tenant-Key",
            },
            {
              method: "GET",
              path: "/devices/:deviceId/status",
              description: "Get device status",
              auth: "Bearer Token or X-Tenant-Key",
            },
            {
              method: "GET",
              path: "/devices/:deviceId/laps",
              description: "Get lap data for a device",
              auth: "Bearer Token or X-Tenant-Key",
            },
            {
              method: "GET",
              path: "/devices/:deviceId/queue",
              description: "Get current queue status for a device",
              auth: "Bearer Token or X-Tenant-Key",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue",
              description: "Join the queue for a device",
              auth: "Bearer Token",
              body: { priority: "number (optional)" },
            },
            {
              method: "DELETE",
              path: "/devices/:deviceId/queue",
              description: "Leave the queue for a device",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue/activate",
              description: "Activate/start a session when at front of queue",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue/complete",
              description: "Complete/end a session and leave queue",
              auth: "Bearer Token",
            },
          ]}
        />

        {/* Queue Endpoints */}
        <EndpointSection
          title="Queue System"
          description="Manage queues for shared device access"
          endpoints={[
            {
              method: "GET",
              path: "/devices/:deviceId/queue",
              description: "Get current queue position and status",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue",
              description: "Join the queue for a device",
              auth: "Bearer Token",
              body: { priority: "number (optional)" },
            },
            {
              method: "DELETE",
              path: "/devices/:deviceId/queue",
              description: "Leave the queue",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue/activate",
              description: "Activate session when at front of queue",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/devices/:deviceId/queue/complete",
              description: "Complete session and remove from queue",
              auth: "Bearer Token",
            },
          ]}
        />

        {/* Leaderboards & Credits */}
        <EndpointSection
          title="Leaderboards & Credits"
          description="View leaderboards and manage credits"
          endpoints={[
            {
              method: "GET",
              path: "/leaderboards",
              description: "Get global leaderboards",
              auth: "None or Bearer Token",
              query: { track: "string (optional)", car: "string (optional)", limit: "number (optional)" },
            },
            {
              method: "GET",
              path: "/credits/balance",
              description: "Get user's credit balance",
              auth: "Bearer Token",
            },
            {
              method: "POST",
              path: "/credits/purchase",
              description: "Purchase credits",
              auth: "Bearer Token",
              body: { amount: "number", payment_method: "string" },
            },
          ]}
        />

        {/* Stats */}
        <EndpointSection
          title="Statistics"
          description="Access lap statistics and analytics"
          endpoints={[
            {
              method: "GET",
              path: "/stats/laps",
              description: "Get lap statistics",
              auth: "Bearer Token or X-Tenant-Key",
              query: { device_id: "string (optional)", track: "string (optional)", start_date: "string (optional)", end_date: "string (optional)" },
            },
          ]}
        />

        {/* Admin Endpoints */}
        <EndpointSection
          title="Admin (Service Role Required)"
          description="Administrative endpoints for platform management"
          endpoints={[
            {
              method: "GET",
              path: "/admin/devices",
              description: "List all devices (admin only)",
              auth: "Service Role Key",
            },
            {
              method: "GET",
              path: "/admin/users",
              description: "List all users (admin only)",
              auth: "Service Role Key",
            },
            {
              method: "GET",
              path: "/admin/stats",
              description: "Get platform statistics (admin only)",
              auth: "Service Role Key",
            },
            {
              method: "GET",
              path: "/admin/laps",
              description: "Get all lap data (admin only)",
              auth: "Service Role Key",
            },
          ]}
        />

        {/* Health */}
        <EndpointSection
          title="Health & Debug"
          description="System health and debugging endpoints"
          endpoints={[
            {
              method: "GET",
              path: "/health",
              description: "Health check endpoint - returns API status and version",
              auth: "None",
            },
            {
              method: "GET",
              path: "/debug",
              description: "Debug information (development only)",
              auth: "Service Role Key",
            },
          ]}
        />

        {/* Response Format */}
        <section className="mt-12 p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
          <h2 className="text-2xl font-semibold text-white mb-4">Response Format</h2>
          <p className="text-neutral-300 mb-4">
            All API endpoints return JSON responses. Successful responses typically follow this format:
          </p>
          <pre className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`{
  "success": true,
  "data": {
    // Response data here
  }
}`}
          </pre>
          <p className="text-neutral-300 mt-4 mb-2">Error responses follow this format:</p>
          <pre className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message"
}`}
          </pre>
        </section>
      </div>
    </main>
  );
}

function EndpointSection({
  title,
  description,
  endpoints,
}: {
  title: string;
  description: string;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    auth: string;
    body?: Record<string, string>;
    query?: Record<string, string>;
  }>;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    POST: "bg-green-500/20 text-green-400 border-green-500/50",
    PUT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/50",
    PATCH: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  };

  return (
    <section className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
        <p className="text-neutral-400">{description}</p>
      </div>
      <div className="space-y-4">
        {endpoints.map((endpoint, idx) => (
          <div
            key={idx}
            className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold border ${methodColors[endpoint.method] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/50"}`}
                  >
                    {endpoint.method}
                  </span>
                  <code className="text-orange-400 font-mono text-sm">{endpoint.path}</code>
                </div>
                <p className="text-sm text-neutral-300 mb-2">{endpoint.description}</p>
                <div className="text-xs text-neutral-500">
                  <strong>Auth:</strong> {endpoint.auth}
                </div>
              </div>
            </div>
            {endpoint.body && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <div className="text-xs text-neutral-500 mb-2 font-semibold">Request Body:</div>
                <pre className="text-xs text-neutral-400 font-mono bg-neutral-950 p-2 rounded border border-neutral-800">
                  {JSON.stringify(endpoint.body, null, 2)}
                </pre>
              </div>
            )}
            {endpoint.query && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <div className="text-xs text-neutral-500 mb-2 font-semibold">Query Parameters:</div>
                <pre className="text-xs text-neutral-400 font-mono bg-neutral-950 p-2 rounded border border-neutral-800">
                  {JSON.stringify(endpoint.query, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
