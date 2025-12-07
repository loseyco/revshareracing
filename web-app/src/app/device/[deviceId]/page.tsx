"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function DevicePage() {
  const params = useParams();
  const deviceId = params.deviceId as string;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Device: {deviceId}</h1>
        <p className="mt-2 text-slate-300">Manage and test commands for this rig</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={`/device/${deviceId}/test`}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-fuchsia-500/60 hover:bg-slate-900/80"
        >
          <h2 className="text-xl font-semibold text-white">Command Tester</h2>
          <p className="mt-2 text-sm text-slate-300">
            Queue and test commands for this device. View pending commands and monitor execution.
          </p>
        </Link>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-white">Device Status</h2>
          <p className="mt-2 text-sm text-slate-300">
            View device information, telemetry status, and configuration.
          </p>
          <p className="mt-4 text-xs text-slate-400">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
