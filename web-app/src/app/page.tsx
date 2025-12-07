"use client";

import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";

const featureCards = [
  {
    title: "Live Telemetry Sync",
    description:
      "Capture laps, driver changes, and pit activity from each rig. Data streams directly into Supabase for instant reporting."
  },
  {
    title: "Remote Queue Commands",
    description:
      "Trigger iRacing macros, pit stop requests, or reset sequences from the web dashboard, even when you’re not trackside."
  },
  {
    title: "Enterprise Rig Tracking",
    description:
      "Fingerprint each simulator and keep its history through hardware upgrades or reinstallations. Claiming is secured with one-time codes."
  }
];

const steps = [
  {
    step: "01",
    title: "Install the PC Service",
    copy:
      "Download the Rev Share Racing PC service and run it on each simulator. The app fingerprints the rig and displays a claim code."
  },
  {
    step: "02",
    title: "Create Your Account",
    copy:
      "Register here in the portal and sign in. Everything runs through Supabase Auth so you can invite operators and team members."
  },
  {
    step: "03",
    title: "Claim the Rig",
    copy:
      "Use the device ID and claim code from the PC service to link the machine. Once claimed, lap logging and remote control unlock instantly."
  }
];

const audienceHighlights = [
  {
    label: "Event Operators",
    detail: "Automate lineup swaps and monitor performance from the paddock."
  },
  {
    label: "Commercial Sim Centers",
    detail: "Manage dozens of rigs with a single portal and hardware fingerprints."
  },
  {
    label: "Teams & Leagues",
    detail: "Keep Pro and Arrive & Drive machines in sync with a shared dashboard."
  }
];

export default function HomePage() {
  const { session, loading } = useSupabase();

  return (
    <div className="space-y-24 animate-fade-in">
      <section className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/90 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 shadow-2xl backdrop-blur-sm">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.15),_transparent_60%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 -z-10 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 -z-10 bg-red-600/5 rounded-full blur-3xl" />
        <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4 sm:space-y-6 md:space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 md:px-5 py-2 text-xs md:text-sm font-semibold uppercase tracking-widest text-red-200 shadow-lg shadow-red-500/20">
              <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Remote racing infrastructure</span>
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-tight text-white animate-slide-up">
              Claim every simulator.{" "}
              <span className="gradient-text">Log every lap.</span> Command every queue.
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-300 leading-relaxed">
              Rev Share Racing ties the on-track PC service to this cloud portal so you can manage
              rigs, drivers, queues, and telemetry from anywhere. Designed for commercial sim
              centers, traveling events, and pro teams who can't afford missed laps.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 md:gap-4">
              {loading ? (
                  <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                  <span className="text-sm">Checking session…</span>
                </div>
              ) : session ? (
                <>
                  <Link href="/dashboard" className="btn-primary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Open dashboard</span>
                  </Link>
                  <Link href="/dashboard" className="btn-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Open dashboard</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/register" className="btn-primary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Create free account</span>
                  </Link>
                  <Link href="/auth/login" className="btn-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign in</span>
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-slate-800/50 bg-slate-900/80 p-6 md:p-8 shadow-xl backdrop-blur-sm glass">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-red-300 mb-2">
              Who uses Rev Share Racing?
            </h3>
            <ul className="space-y-3 md:space-y-4">
              {audienceHighlights.map(({ label, detail }, index) => (
                <li key={label} className="rounded-lg sm:rounded-xl border border-slate-800/50 bg-slate-950/50 p-3 sm:p-4 md:p-5 hover:border-red-500/30 transition-colors" style={{ animationDelay: `${index * 0.1}s` }}>
                  <p className="text-sm md:text-base font-bold text-white mb-2">{label}</p>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">{detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((card, index) => (
          <div
            key={card.title}
            className="card animate-slide-up group"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="mb-3 sm:mb-4 inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 group-hover:scale-110 transition-transform">
              {index === 0 ? (
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ) : index === 1 ? (
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{card.description}</p>
          </div>
        ))}
      </section>

      <section className="glass rounded-3xl p-8 md:p-12 shadow-2xl">
        <div className="mb-10 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Setup in three steps</h3>
          <p className="text-slate-400 text-sm md:text-base">Get started in minutes</p>
        </div>
        <div className="grid gap-6 md:gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ step, title, copy }, index) => (
            <div 
              key={step} 
              className="card relative overflow-hidden group text-center"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-colors" />
              <div className="relative z-10">
                <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/30 to-red-600/30 border border-red-500/40 mb-3 sm:mb-4">
                  <span className="text-2xl md:text-3xl font-bold gradient-text">{step}</span>
                </div>
                <h4 className="text-lg md:text-xl font-bold text-white mb-3">{title}</h4>
                <p className="text-sm leading-relaxed text-slate-400">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative rounded-xl sm:rounded-2xl md:rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-red-500/5 to-red-500/10 p-6 sm:p-8 md:p-10 lg:p-12 text-center shadow-xl backdrop-blur-sm overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.1),_transparent_70%)]" />
        <div className="relative z-10">
          <div className="inline-flex h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-xl sm:rounded-2xl bg-red-500/20 border border-red-500/30 mb-4 sm:mb-6">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 md:mb-4">Ready to share the podium?</h3>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-red-100/90 max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
            The PC service is already logging laps locally. Claim each rig to start streaming data to
            the cloud and unlock remote control from the Rev Share Racing portal.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 text-xs sm:text-sm font-bold text-red-700 shadow-lg shadow-red-500/20 transition-all duration-300 hover:bg-red-50 hover:shadow-xl hover:shadow-red-500/30 hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Get started free</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-300/50 bg-red-500/10 px-4 py-2.5 sm:px-6 sm:py-3 md:px-8 md:py-4 text-xs sm:text-sm font-bold text-red-50 backdrop-blur-sm transition-all duration-300 hover:bg-red-500/20 hover:border-red-300 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>View dashboard</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
