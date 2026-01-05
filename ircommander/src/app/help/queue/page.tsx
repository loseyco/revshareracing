import Link from "next/link";

export default function QueuePage() {
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
          <h1 className="text-4xl font-semibold text-white mb-2">Queue System</h1>
          <p className="text-lg text-neutral-400">
            How the queue system manages shared device access
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
          <div className="prose prose-invert max-w-none text-neutral-300 space-y-4">
            <p>
              The queue system allows multiple users to share access to racing rigs in an organized, 
              fair manner. Users join a queue for a device and are served in order when their turn arrives.
            </p>
            <p>
              The queue system is designed for scenarios where devices are shared among multiple users, 
              ensuring fair access and preventing conflicts.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            <QueueStep
              number={1}
              title="Join the Queue"
              description="User requests to join the queue for a specific device. They're added to the end of the queue or at a priority position if specified."
            />
            <QueueStep
              number={2}
              title="Wait for Turn"
              description="Users wait in the queue, checking their position periodically. When they reach the front and the device is available, they can activate."
            />
            <QueueStep
              number={3}
              title="Activate Session"
              description="When at the front of the queue, the user activates their session, gaining control of the device."
            />
            <QueueStep
              number={4}
              title="Complete Session"
              description="After finishing their session, the user completes it, automatically removing them from the queue and allowing the next user to activate."
            />
          </div>
        </section>

        {/* API Endpoints */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">API Endpoints</h2>
          
          <div className="space-y-6">
            <EndpointCard
              method="GET"
              path="/devices/:deviceId/queue"
              title="Get Queue Status"
              description="Retrieve current queue status, including position and estimated wait time"
              auth="Bearer Token"
              example={`GET /api/v1/devices/rig-abc123/queue
Headers:
  Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "device_id": "rig-abc123",
    "current_user_position": 2,
    "total_in_queue": 5,
    "active_user": {
      "user_id": "user-456",
      "session_started": "2025-01-15T10:00:00Z"
    },
    "queue": [
      {
        "user_id": "user-456",
        "position": 0,
        "status": "active",
        "joined_at": "2025-01-15T09:55:00Z"
      },
      {
        "user_id": "user-789",
        "position": 1,
        "status": "waiting",
        "joined_at": "2025-01-15T10:05:00Z"
      },
      // ... more queue entries
    ]
  }
}`}
            />

            <EndpointCard
              method="POST"
              path="/devices/:deviceId/queue"
              title="Join Queue"
              description="Join the queue for a device. Optional priority parameter can place user higher in queue."
              auth="Bearer Token"
              example={`POST /api/v1/devices/rig-abc123/queue
Headers:
  Authorization: Bearer <token>
Content-Type: application/json

{
  "priority": 0  // Optional: 0 = normal, higher = priority
}

// Response
{
  "success": true,
  "data": {
    "position": 3,
    "total_in_queue": 4,
    "estimated_wait": 900,  // seconds
    "joined_at": "2025-01-15T10:10:00Z"
  }
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/devices/:deviceId/queue"
              title="Leave Queue"
              description="Remove yourself from the queue before your turn"
              auth="Bearer Token"
              example={`DELETE /api/v1/devices/rig-abc123/queue
Headers:
  Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "message": "Removed from queue"
  }
}`}
            />

            <EndpointCard
              method="POST"
              path="/devices/:deviceId/queue/activate"
              title="Activate Session"
              description="Activate your session when you're at the front of the queue and the device is available"
              auth="Bearer Token"
              example={`POST /api/v1/devices/rig-abc123/queue/activate
Headers:
  Authorization: Bearer <token>

// Response
{
  "success": true,
  "data": {
    "session_id": "session-123",
    "activated_at": "2025-01-15T10:15:00Z",
    "device_id": "rig-abc123"
  }
}`}
            />

            <EndpointCard
              method="POST"
              path="/devices/:deviceId/queue/complete"
              title="Complete Session"
              description="Mark your session as complete, automatically removing you from the queue"
              auth="Bearer Token"
              example={`POST /api/v1/devices/rig-abc123/queue/complete
Headers:
  Authorization: Bearer <token>
Content-Type: application/json

{
  "session_duration": 3600,  // Optional: session duration in seconds
  "notes": "Great session!"  // Optional
}

// Response
{
  "success": true,
  "data": {
    "session_id": "session-123",
    "completed_at": "2025-01-15T11:15:00Z",
    "duration": 3600
  }
}`}
            />
          </div>
        </section>

        {/* Queue States */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Queue States</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StateCard
              state="waiting"
              description="User is in the queue waiting for their turn"
              color="bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
            />
            <StateCard
              state="active"
              description="User is currently using the device"
              color="bg-green-500/20 border-green-500/50 text-green-400"
            />
            <StateCard
              state="completed"
              description="User has completed their session and left the queue"
              color="bg-blue-500/20 border-blue-500/50 text-blue-400"
            />
            <StateCard
              state="cancelled"
              description="User left the queue before their turn"
              color="bg-red-500/20 border-red-500/50 text-red-400"
            />
          </div>
        </section>

        {/* Typical Workflow */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Typical Workflow</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <ol className="space-y-4 text-sm text-neutral-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-semibold">1</span>
                <div>
                  <strong className="text-white">User joins queue:</strong> POST /devices/:deviceId/queue
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-semibold">2</span>
                <div>
                  <strong className="text-white">Poll queue status:</strong> Periodically GET /devices/:deviceId/queue to check position
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-semibold">3</span>
                <div>
                  <strong className="text-white">Activate when at front:</strong> POST /devices/:deviceId/queue/activate when position is 0 and device is available
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-semibold">4</span>
                <div>
                  <strong className="text-white">Use the device:</strong> User has control for their session
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-semibold">5</span>
                <div>
                  <strong className="text-white">Complete session:</strong> POST /devices/:deviceId/queue/complete when finished
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Best Practices</h2>
          <div className="space-y-3">
            <PracticeItem
              title="Poll Queue Status Regularly"
              description="Check queue status every 10-30 seconds to provide accurate position updates to users. Don't poll too frequently to avoid unnecessary load."
            />
            <PracticeItem
              title="Handle Activation Gracefully"
              description="Check if user is at front of queue before allowing activation. The API will return an error if conditions aren't met."
            />
            <PracticeItem
              title="Clean Up on Disconnect"
              description="If a user disconnects during an active session, automatically complete their session to free up the device for others."
            />
            <PracticeItem
              title="Show Estimated Wait Times"
              description="Calculate and display estimated wait times based on average session duration and current queue length."
            />
            <PracticeItem
              title="Implement Session Timeouts"
              description="Consider implementing maximum session durations to ensure fair access for all users in the queue."
            />
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Error Handling</h2>
          <div className="space-y-3">
            <ErrorCard
              code="409 Conflict"
              message="User already in queue"
              description="User is already in the queue for this device. Use GET to check current position."
            />
            <ErrorCard
              code="403 Forbidden"
              message="Cannot activate - not at front of queue"
              description="User must be at position 0 and device must be available to activate."
            />
            <ErrorCard
              code="404 Not Found"
              message="Not in queue"
              description="User is not currently in the queue. Join the queue first before attempting to activate or leave."
            />
            <ErrorCard
              code="400 Bad Request"
              message="Device not available"
              description="Device is currently unavailable (offline, maintenance, or in use by another user)."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function QueueStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-neutral-300">{description}</p>
      </div>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  title,
  description,
  auth,
  example,
}: {
  method: string;
  path: string;
  title: string;
  description: string;
  auth: string;
  example: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    POST: "bg-green-500/20 text-green-400 border-green-500/50",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/50",
  };

  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-2 py-1 rounded text-xs font-semibold border ${methodColors[method] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/50"}`}
            >
              {method}
            </span>
            <code className="text-orange-400 font-mono text-sm">{path}</code>
          </div>
          <h3 className="font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-neutral-300 mb-2">{description}</p>
          <div className="text-xs text-neutral-500">
            <strong>Auth:</strong> {auth}
          </div>
        </div>
      </div>
      <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 font-mono overflow-x-auto">
        {example}
      </pre>
    </div>
  );
}

function StateCard({
  state,
  description,
  color,
}: {
  state: string;
  description: string;
  color: string;
}) {
  return (
    <div className={`p-4 rounded-xl border ${color}`}>
      <code className="block font-mono font-semibold mb-2">{state}</code>
      <p className="text-sm text-neutral-300">{description}</p>
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

function ErrorCard({
  code,
  message,
  description,
}: {
  code: string;
  message: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10">
      <div className="flex items-start justify-between gap-4 mb-2">
        <code className="text-red-400 font-mono font-semibold">{code}</code>
        <strong className="text-red-300">{message}</strong>
      </div>
      <p className="text-sm text-neutral-300">{description}</p>
    </div>
  );
}
