"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClaimDevicePage() {
  const router = useRouter();
  
  // Redirect to dashboard since claiming only happens via PC-service links
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  
  return (
    <section className="space-y-4 sm:space-y-6 animate-fade-in w-full px-3 sm:px-4 md:px-6">
      <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
        </div>
        <p className="text-slate-300 font-medium">Redirecting to dashboard...</p>
        <p className="text-sm text-slate-400 mt-2">
          To claim a rig, use the "Claim This Rig" button from the PC service.
        </p>
      </div>
    </section>
  );
}
