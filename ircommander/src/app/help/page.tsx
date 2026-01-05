import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-semibold text-white">iRCommander Help</h1>
          </div>
          <p className="text-lg text-neutral-400">
            Complete documentation for the iRacing rig management platform
          </p>
        </div>

        {/* Overview Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">What is iRCommander?</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-neutral-300 mb-4">
              iRCommander is a centralized API platform that powers sim racing experiences worldwide. 
              It serves as the "mother site" that provides device management, queue systems, telemetry, 
              and real-time operations for iRacing rigs.
            </p>
            <p className="text-neutral-300 mb-4">
              Child sites like <strong>RevShareRacing</strong> and others consume these APIs to provide 
              their own user-facing interfaces while leveraging iRCommander's robust backend infrastructure.
            </p>
          </div>
        </section>

        {/* Key Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Key Features</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              }
              title="Device Management"
              description="Register, monitor, and manage racing rigs remotely. Track device status, health, and configuration."
            />
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              title="Queue System"
              description="Automated queue management for shared rigs. Users can join queues, activate sessions, and track their position."
            />
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Telemetry & Stats"
              description="Collect lap times, track leaderboards, and analyze performance data from racing sessions."
            />
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              title="Authentication"
              description="Multi-tenant API key authentication, user authentication, and device authentication systems."
            />
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Credits System"
              description="Credit balance tracking and purchase system for managing usage-based billing."
            />
            <FeatureCard
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="Remote Desktop"
              description="WebRTC-based remote desktop access for controlling racing rigs remotely."
            />
          </div>
        </section>

        {/* Documentation Links */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Documentation</h2>
          <div className="grid gap-4">
            <DocLink
              href="/help/integration"
              title="Building Child Sites"
              description="Complete guide for building sites that integrate with iRCommander (like RevShareRacing)"
            />
            <DocLink
              href="/help/getting-started"
              title="Getting Started"
              description="Learn how to get started with iRCommander APIs and integration"
            />
            <DocLink
              href="/help/api"
              title="API Reference"
              description="Complete API endpoint documentation with request/response examples"
            />
            <DocLink
              href="/help/authentication"
              title="Authentication Guide"
              description="Understand authentication methods: user auth, tenant keys, and device keys"
            />
            <DocLink
              href="/help/devices"
              title="Device Management"
              description="How to register, monitor, and manage racing rig devices"
            />
            <DocLink
              href="/help/queue"
              title="Queue System"
              description="How the queue system works for managing shared rig access"
            />
          </div>
        </section>

        {/* API Base URL */}
        <section className="mb-12 p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
          <h2 className="text-xl font-semibold text-white mb-3">API Base URL</h2>
          <code className="block p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-orange-400 text-sm font-mono">
            https://ircommander.gridpass.app/api/v1
          </code>
          <p className="text-sm text-neutral-400 mt-3">
            All API endpoints are prefixed with this base URL. The API uses RESTful conventions and returns JSON responses.
          </p>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/v1/health"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition text-sm"
            >
              Health Check
            </a>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/auth/login"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition text-sm"
            >
              Sign In
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-orange-500">{icon}</div>
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  );
}

function DocLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href as any}
      className="block p-5 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-orange-500/50 hover:bg-neutral-900 transition group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1 group-hover:text-orange-400 transition">
            {title}
          </h3>
          <p className="text-sm text-neutral-400">{description}</p>
        </div>
        <svg
          className="h-5 w-5 text-neutral-600 group-hover:text-orange-500 transition flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
