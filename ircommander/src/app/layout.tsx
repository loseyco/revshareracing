import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iRCommander - iRacing Rig Management",
  description: "The platform powering sim racing experiences worldwide. Device management, queue systems, and real-time telemetry for iRacing.",
  keywords: ["sim racing", "iRacing", "racing simulator", "queue management", "iRCommander", "GridPass"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-950 text-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
