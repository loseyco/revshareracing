import Link from "next/link";

export default function GettingStartedPage() {
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
          <h1 className="text-4xl font-semibold text-white mb-2">Getting Started</h1>
          <p className="text-lg text-neutral-400">
            Learn how to integrate with iRCommander APIs
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
          <div className="prose prose-invert max-w-none text-neutral-300 space-y-4">
            <p>
              iRCommander provides RESTful APIs for managing iRacing rigs, queues, telemetry, and more. 
              This guide will help you get started with API integration.
            </p>
          </div>
        </section>

        {/* API Base URL */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">API Base URL</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <code className="block text-orange-400 text-lg font-mono mb-4">
              https://ircommander.gridpass.app/api/v1
            </code>
            <p className="text-sm text-neutral-400">
              All endpoints are versioned under <code className="text-orange-400">/api/v1</code>. 
              The API uses standard HTTP methods (GET, POST, PUT, DELETE) and returns JSON responses.
            </p>
          </div>
        </section>

        {/* Authentication Methods */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Authentication Methods</h2>
          <div className="space-y-6">
            <AuthMethod
              title="User Authentication (Bearer Token)"
              description="For user-facing applications. Users log in and receive access tokens."
              header="Authorization: Bearer &lt;token&gt;"
              useCase="Web applications, mobile apps where users need to authenticate"
              link="/help/authentication#user-auth"
            />
            <AuthMethod
              title="Tenant API Key"
              description="For child sites and multi-tenant applications. Provides access to tenant-specific resources."
              header="X-Tenant-Key: &lt;api-key&gt;"
              useCase="Child sites like RevShareRacing that need tenant-scoped access"
              link="/help/authentication#tenant-auth"
            />
            <AuthMethod
              title="Device API Key"
              description="For racing rig devices. Each device gets a unique API key during registration."
              header="X-Device-Key: &lt;api-key&gt;"
              useCase="Racing rig software that needs to report status, upload laps, receive commands"
              link="/help/authentication#device-auth"
            />
          </div>
        </section>

        {/* Quick Start Examples */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Quick Start Examples</h2>
          
          <ExampleCard
            title="1. Health Check"
            description="Verify API availability"
            method="GET"
            endpoint="/api/v1/health"
            code={`curl https://ircommander.gridpass.app/api/v1/health`}
          />

          <ExampleCard
            title="2. User Login"
            description="Authenticate a user and get an access token"
            method="POST"
            endpoint="/api/v1/auth/login"
            code={`curl -X POST https://ircommander.gridpass.app/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`}
          />

          <ExampleCard
            title="3. List Devices (with Tenant Key)"
            description="Get list of devices using tenant API key"
            method="GET"
            endpoint="/api/v1/devices"
            code={`curl https://ircommander.gridpass.app/api/v1/devices \\
  -H "X-Tenant-Key: your-tenant-api-key"`}
          />

          <ExampleCard
            title="4. Register Device"
            description="Register a new racing rig device"
            method="POST"
            endpoint="/api/v1/device/register"
            code={`curl -X POST https://ircommander.gridpass.app/api/v1/device/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "hardware_id": "unique-hardware-identifier",
    "name": "Racing Rig #1",
    "tenant_id": "optional-tenant-id"
  }'`}
          />
        </section>

        {/* CORS */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Cross-Origin Requests (CORS)</h2>
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
            <p className="text-neutral-300 mb-4">
              iRCommander APIs support CORS and can be called directly from web browsers. 
              The API allows requests from any origin, making it easy to integrate with child sites.
            </p>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-white mb-2">CORS Headers</h3>
              <ul className="text-sm text-neutral-400 space-y-1 font-mono">
                <li>Access-Control-Allow-Origin: *</li>
                <li>Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS</li>
                <li>Access-Control-Allow-Headers: Authorization, X-Tenant-Key, X-Device-Key, Content-Type</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/help/api"
              className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-orange-500/50 transition"
            >
              <h3 className="font-semibold text-white mb-2">Browse API Reference</h3>
              <p className="text-sm text-neutral-400">
                Complete endpoint documentation with request/response examples
              </p>
            </Link>
            <Link
              href="/help/authentication"
              className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-orange-500/50 transition"
            >
              <h3 className="font-semibold text-white mb-2">Learn Authentication</h3>
              <p className="text-sm text-neutral-400">
                Detailed guide on authentication methods and usage
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthMethod({
  title,
  description,
  header,
  useCase,
  link,
}: {
  title: string;
  description: string;
  header: string;
  useCase: string;
  link: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 mb-4">{description}</p>
      <div className="mb-3">
        <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-orange-400 text-sm font-mono">
          {header}
        </code>
      </div>
      <div className="text-xs text-neutral-500">
        <strong>Use case:</strong> {useCase}
      </div>
      <Link
        href={link as any}
        className="inline-block mt-3 text-sm text-orange-400 hover:text-orange-300"
      >
        Learn more →
      </Link>
    </div>
  );
}

function ExampleCard({
  title,
  description,
  method,
  endpoint,
  code,
}: {
  title: string;
  description: string;
  method: string;
  endpoint: string;
  code: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    POST: "bg-green-500/20 text-green-400 border-green-500/50",
    PUT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/50",
  };

  return (
    <div className="mb-6 p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-neutral-400">{description}</p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-semibold border ${methodColors[method] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/50"}`}
        >
          {method}
        </span>
      </div>
      <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs font-mono whitespace-pre-wrap break-all">
        {code}
      </code>
      <div className="mt-2 text-xs text-neutral-500 font-mono">{endpoint}</div>
    </div>
  );
}
