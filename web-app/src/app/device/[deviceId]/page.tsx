"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = params.deviceId as string;
  const claimCode = searchParams.get("claimCode");

  // Redirect to claim page if claimCode exists, otherwise redirect to details
  useEffect(() => {
    if (claimCode) {
      router.replace(`/device/${deviceId}/claim?claimCode=${claimCode}`);
    } else {
      router.replace(`/device/${deviceId}/details`);
    }
  }, [claimCode, deviceId, router]);

  // Show loading state while redirecting
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
        </div>
        <p className="text-slate-300">Redirecting...</p>
      </div>
    </div>
  );
}
