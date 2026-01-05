import Link from "next/link";

export default function AuthenticationPage() {
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
          <h1 className="text-4xl font-semibold text-white mb-2">Authentication Guide</h1>
          <p className="text-lg text-neutral-400">
            Understand the different authentication methods available
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
          <div className="prose prose-invert max-w-none text-neutral-300 space-y-4">
            <p>
              iRCommander supports three authentication methods, each designed for different use cases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-300">
              <li><strong>User Authentication</strong> - For user-facing applications (Bearer tokens)</li>
              <li><strong>Tenant API Keys</strong> - For child sites and multi-tenant applications</li>
              <li><strong>Device API Keys</strong> - For racing rig devices</li>
            </ul>
          </div>
        </section>

        {/* User Authentication */}
        <section id="user-auth" className="mb-12 scroll-mt-12">
          <h2 className="text-2xl font-semibold text-white mb-4">User Authentication (Bearer Token)</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">When to Use</h3>
              <p className="text-sm text-neutral-300">
                Use Bearer token authentication for user-facing applications where individual users need to authenticate. 
                This is the standard authentication method for web applications and mobile apps.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-300">
                <li>User logs in via <code className="text-orange-400">POST /api/v1/auth/login</code></li>
                <li>API returns access token and refresh token</li>
                <li>Include access token in <code className="text-orange-400">Authorization</code> header</li>
                <li>When token expires, use refresh token to get a new access token</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Header Format</h3>
              <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-orange-400 text-sm font-mono">
                Authorization: Bearer &lt;access-token&gt;
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Example</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`// Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Response
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}

// Use token
GET /api/v1/auth/me
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
              </pre>
            </div>
          </div>
        </section>

        {/* Tenant Authentication */}
        <section id="tenant-auth" className="mb-12 scroll-mt-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Tenant API Key</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">When to Use</h3>
              <p className="text-sm text-neutral-300">
                Use Tenant API keys for child sites (like <strong>RevShareRacing</strong>) that need to access 
                tenant-scoped resources. This allows child sites to act on behalf of a tenant without user authentication.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-300">
                <li>Tenant API keys are generated in the admin panel</li>
                <li>Each tenant has one or more API keys</li>
                <li>Include API key in <code className="text-orange-400">X-Tenant-Key</code> header</li>
                <li>API automatically filters resources to the tenant's scope</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Header Format</h3>
              <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-orange-400 text-sm font-mono">
                X-Tenant-Key: &lt;tenant-api-key&gt;
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Example</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`// List devices for tenant
GET /api/v1/devices
Headers:
  X-Tenant-Key: irc_tenant_abc123def456...

// Get tenant-specific stats
GET /api/v1/stats/laps
Headers:
  X-Tenant-Key: irc_tenant_abc123def456...
Query:
  ?start_date=2025-01-01&end_date=2025-01-31`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/50">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Tenant API keys provide access to all resources belonging to that tenant. 
                Keep them secure and rotate them regularly.
              </p>
            </div>
          </div>
        </section>

        {/* Device Authentication */}
        <section id="device-auth" className="mb-12 scroll-mt-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Device API Key</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">When to Use</h3>
              <p className="text-sm text-neutral-300">
                Use Device API keys for racing rig software that needs to report status, upload lap data, 
                receive commands, and interact with the platform on behalf of a specific device.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-300">
                <li>Device registers via <code className="text-orange-400">POST /api/v1/device/register</code></li>
                <li>API returns a unique device API key</li>
                <li>Include API key in <code className="text-orange-400">X-Device-Key</code> header</li>
                <li>Device can now send heartbeats, upload laps, poll for commands</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Header Format</h3>
              <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-orange-400 text-sm font-mono">
                X-Device-Key: &lt;device-api-key&gt;
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Example</h3>
              <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`// Register device (first time)
POST /api/v1/device/register
{
  "hardware_id": "unique-hardware-identifier",
  "name": "Racing Rig #1",
  "tenant_id": "optional-tenant-id"
}

// Response
{
  "success": true,
  "data": {
    "device_id": "rig-abc123",
    "api_key": "irc_device_xyz789...",
    ...
  }
}

// Send heartbeat
POST /api/v1/device/heartbeat
Headers:
  X-Device-Key: irc_device_xyz789...
Body:
  {
    "status": "idle"
  }

// Upload laps
POST /api/v1/device/laps
Headers:
  X-Device-Key: irc_device_xyz789...
Body:
  {
    "laps": [
      {
        "track": "Daytona",
        "car": "Ford GT",
        "time": 120.5,
        "timestamp": "2025-01-15T10:30:00Z"
      }
    ]
  }

// Poll for commands
GET /api/v1/device/commands
Headers:
  X-Device-Key: irc_device_xyz789...`}
              </pre>
            </div>

            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50">
              <p className="text-sm text-yellow-300">
                <strong>Note:</strong> Device API keys are unique to each device and should be stored securely 
                on the device. If compromised, revoke the key and re-register the device.
              </p>
            </div>
          </div>
        </section>

        {/* Security Best Practices */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Security Best Practices</h2>
          <div className="space-y-4">
            <SecurityTip
              title="Keep API Keys Secret"
              description="Never commit API keys to version control. Use environment variables or secure key management systems."
            />
            <SecurityTip
              title="Use HTTPS Only"
              description="Always use HTTPS when making API requests. Never send API keys over unencrypted connections."
            />
            <SecurityTip
              title="Rotate Keys Regularly"
              description="Periodically rotate API keys, especially if they may have been compromised. Generate new keys in the admin panel."
            />
            <SecurityTip
              title="Scope Access Properly"
              description="Use the appropriate authentication method for your use case. Don't use service role keys in client applications."
            />
            <SecurityTip
              title="Monitor Usage"
              description="Monitor API key usage for unusual patterns that might indicate unauthorized access."
            />
          </div>
        </section>

        {/* Token Expiration */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Token Expiration & Refresh</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <p className="text-sm text-neutral-300 mb-4">
              User access tokens expire after a certain period. When a token expires, you'll receive a 401 Unauthorized response.
            </p>
            <p className="text-sm text-neutral-300 mb-4">
              Use the refresh token to obtain a new access token:
            </p>
            <pre className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 font-mono overflow-x-auto">
{`POST /api/v1/auth/refresh
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Response
{
  "success": true,
  "data": {
    "access_token": "new-access-token",
    "refresh_token": "new-refresh-token",
    ...
  }
}`}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}

function SecurityTip({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-300">{description}</p>
    </div>
  );
}
