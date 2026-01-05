import Link from "next/link";

export default function DevicesPage() {
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
          <h1 className="text-4xl font-semibold text-white mb-2">Device Management</h1>
          <p className="text-lg text-neutral-400">
            How to register, monitor, and manage racing rig devices
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
          <div className="prose prose-invert max-w-none text-neutral-300 space-y-4">
            <p>
              Devices represent physical racing rigs that connect to the iRCommander platform. 
              Each device can be registered, monitored, and controlled remotely through the API.
            </p>
            <p>
              Devices are identified by a unique <code className="text-orange-400">device_id</code> and 
              authenticated using a device-specific API key.
            </p>
          </div>
        </section>

        {/* Device Registration */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Device Registration</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              When a racing rig first connects to the platform, it must register itself. Registration 
              returns a unique API key that the device uses for all subsequent API calls.
            </p>

            <div>
              <h3 className="font-semibold text-white mb-2">Registration Request</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`POST /api/v1/device/register
Content-Type: application/json

{
  "hardware_id": "unique-hardware-identifier",
  "device_id": "rig-abc123",  // Optional, auto-generated if not provided
  "name": "Racing Rig #1",     // Optional
  "tenant_id": "tenant-id"     // Optional, assign to tenant
}`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Registration Response</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`{
  "success": true,
  "data": {
    "device_id": "rig-abc123",
    "api_key": "irc_device_xyz789abcdef...",
    "name": "Racing Rig #1",
    "status": "offline",
    "created_at": "2025-01-15T10:00:00Z"
  }
}`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/50">
              <p className="text-sm text-blue-300">
                <strong>Important:</strong> Store the API key securely on the device. This key is required 
                for all subsequent API calls. If the key is lost, the device will need to be re-registered.
              </p>
            </div>
          </div>
        </section>

        {/* Device Status */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Device Status</h2>
          <div className="space-y-4">
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
              <h3 className="font-semibold text-white mb-3">Status Values</h3>
              <div className="space-y-2 text-sm">
                <StatusItem status="online" description="Device is connected and active" />
                <StatusItem status="offline" description="Device is not connected" />
                <StatusItem status="idle" description="Device is online but not in use" />
                <StatusItem status="racing" description="Device is currently in a racing session" />
                <StatusItem status="maintenance" description="Device is in maintenance mode" />
                <StatusItem status="error" description="Device has encountered an error" />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Get Device Status</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`GET /api/v1/device/status
Headers:
  X-Device-Key: irc_device_xyz789...`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Update Device Status</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`PUT /api/v1/device/status
Headers:
  X-Device-Key: irc_device_xyz789...
Content-Type: application/json

{
  "status": "idle",
  "metadata": {
    "current_track": "Daytona",
    "current_car": "Ford GT"
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Heartbeat */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Device Heartbeat</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              Devices should send heartbeat requests periodically to indicate they're still connected and active. 
              This helps the platform track device availability and update last-seen timestamps.
            </p>

            <div>
              <h3 className="font-semibold text-white mb-2">Send Heartbeat</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`POST /api/v1/device/heartbeat
Headers:
  X-Device-Key: irc_device_xyz789...
Content-Type: application/json

{
  "status": "idle"  // Optional, update status with heartbeat
}`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50">
              <p className="text-sm text-yellow-300">
                <strong>Recommendation:</strong> Send heartbeats every 30-60 seconds when the device is active. 
                This ensures accurate status tracking and helps identify disconnected devices quickly.
              </p>
            </div>
          </div>
        </section>

        {/* Lap Data */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Uploading Lap Data</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              Devices can upload lap time data from racing sessions. This data is used for leaderboards, 
              statistics, and performance tracking.
            </p>

            <div>
              <h3 className="font-semibold text-white mb-2">Upload Laps</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`POST /api/v1/device/laps
Headers:
  X-Device-Key: irc_device_xyz789...
Content-Type: application/json

{
  "laps": [
    {
      "track": "Daytona International Speedway",
      "car": "Ford GT",
      "time": 120.5,  // Lap time in seconds
      "timestamp": "2025-01-15T10:30:00Z",
      "session_id": "session-123",  // Optional
      "metadata": {  // Optional
        "weather": "clear",
        "temperature": 75
      }
    }
  ]
}`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Retrieve Lap Data</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`GET /api/v1/devices/:deviceId/laps
Headers:
  Authorization: Bearer <token>  // or X-Tenant-Key
Query Parameters:
  ?start_date=2025-01-01
  &end_date=2025-01-31
  &track=Daytona
  &limit=100`}
              </pre>
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Device Commands</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              The platform can send commands to devices (e.g., start session, shutdown, update settings). 
              Devices poll for commands and mark them as completed.
            </p>

            <div>
              <h3 className="font-semibold text-white mb-2">Poll for Commands</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`GET /api/v1/device/commands
Headers:
  X-Device-Key: irc_device_xyz789...

// Response
{
  "success": true,
  "data": {
    "commands": [
      {
        "id": "cmd-123",
        "type": "start_session",
        "payload": {
          "track": "Daytona",
          "car": "Ford GT"
        },
        "created_at": "2025-01-15T10:00:00Z"
      }
    ]
  }
}`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Complete Command</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`POST /api/v1/device/commands/:commandId/complete
Headers:
  X-Device-Key: irc_device_xyz789...
Content-Type: application/json

{
  "result": {
    "success": true,
    "message": "Session started successfully"
  }
}`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/50">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Devices should poll for commands regularly (every 5-10 seconds) when active. 
                Commands are queued and returned in order. Mark commands as completed after executing them.
              </p>
            </div>
          </div>
        </section>

        {/* Device List (User/Tenant View) */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Viewing Devices (User/Tenant)</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <p className="text-sm text-neutral-300">
              Users and tenants can view devices through their respective authentication methods. 
              This provides a user-facing view of devices without requiring device API keys.
            </p>

            <div>
              <h3 className="font-semibold text-white mb-2">List Devices</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`// Using Bearer Token
GET /api/v1/devices
Headers:
  Authorization: Bearer <token>

// Using Tenant Key
GET /api/v1/devices
Headers:
  X-Tenant-Key: irc_tenant_abc123...`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Get Device Details</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`GET /api/v1/devices/:deviceId
Headers:
  Authorization: Bearer <token>  // or X-Tenant-Key

// Response
{
  "success": true,
  "data": {
    "device_id": "rig-abc123",
    "name": "Racing Rig #1",
    "status": "online",
    "last_seen": "2025-01-15T10:30:00Z",
    "assigned_tenant_id": "tenant-123",
    ...
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Best Practices</h2>
          <div className="space-y-3">
            <PracticeItem
              title="Store API Keys Securely"
              description="Device API keys should be stored securely on the device. Never expose them in client-side code or logs."
            />
            <PracticeItem
              title="Send Regular Heartbeats"
              description="Send heartbeat requests every 30-60 seconds to keep status accurate and detect disconnections."
            />
            <PracticeItem
              title="Poll for Commands Frequently"
              description="Poll for commands every 5-10 seconds when the device is active to ensure timely command processing."
            />
            <PracticeItem
              title="Handle Errors Gracefully"
              description="Implement retry logic for network errors. If registration fails, retry with exponential backoff."
            />
            <PracticeItem
              title="Upload Laps in Batches"
              description="Upload multiple laps in a single request when possible to reduce API calls and improve performance."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusItem({ status, description }: { status: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <code className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-orange-400 text-xs font-mono whitespace-nowrap">
        {status}
      </code>
      <span className="text-neutral-300">{description}</span>
    </div>
  );
}

function PracticeItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-neutral-300">{description}</p>
    </div>
  );
}
