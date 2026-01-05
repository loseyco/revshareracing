import Link from "next/link";
import DownloadButton from "./download-button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        {/* Logo */}
        <div className="flex items-center justify-center mb-16">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-white">iRCommander</span>
              <span className="text-xs text-neutral-500">by GridPass.App</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-semibold text-white mb-4">
            iRacing Rig Management
          </h1>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Device management, queue systems, and real-time telemetry for sim racing operations.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-16">
          <FeatureCard
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            }
            title="Devices"
            description="Register and monitor racing rigs remotely."
          />
          <FeatureCard
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            title="Queue"
            description="Automated queue management for shared rigs."
          />
          <FeatureCard
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="Telemetry"
            description="Lap times and leaderboard statistics."
          />
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <DownloadButton />
          <Link
            href="/auth/login"
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-2.5 text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-700 hover:text-white transition"
          >
            Sign Up
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-center gap-6 mb-4">
            <Link
              href="/help"
              className="text-sm text-neutral-400 hover:text-white transition"
            >
              Help & Documentation
            </Link>
          </div>
          <p className="text-center text-sm text-neutral-600">
            &copy; {new Date().getFullYear()} iRCommander by GridPass.App
          </p>
        </div>
      </footer>
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
        <div className="text-orange-500">
          {icon}
        </div>
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-500">{description}</p>
    </div>
  );
}
