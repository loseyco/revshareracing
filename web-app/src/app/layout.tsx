import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { AuthHeaderControls } from "@/components/widgets/auth-header-controls";

const APP_NAME = "Rev Share Racing";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Rig management portal for Rev Share Racing."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-950 text-slate-100">
        <SupabaseProvider>
          <div className="min-h-screen">
            <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-900/90 backdrop-blur-xl shadow-lg shadow-slate-900/50">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-4">
                <Link href="/" className="group flex items-center gap-3 transition-all duration-200 hover:scale-105">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-500/40 border border-red-400/30">
                    <span className="text-xl font-bold text-white">R</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-red-400 group-hover:text-red-300 transition-colors">
                      Rev Share Racing
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white group-hover:text-red-100 transition-colors">
                      Rig Management Portal
                    </span>
                  </div>
                </Link>
                <AuthHeaderControls />
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 lg:py-12">{children}</main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}

