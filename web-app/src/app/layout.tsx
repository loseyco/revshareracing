import "./globals.css";
import type { Metadata, Viewport } from "next";

import { SupabaseProvider } from "@/components/providers/supabase-provider";
import DriverHeader from "@/components/driver-header";

const APP_NAME = "Rev Share Racing";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Rig management portal for Rev Share Racing."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
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
            <DriverHeader />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}

