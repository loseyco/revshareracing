"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

import { useSupabase } from "@/components/providers/supabase-provider";
import { checkAdminAccess } from "@/lib/admin";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/roles", label: "Roles", icon: "🔐" },
  { href: "/admin/devices", label: "Devices", icon: "🖥️" },
  { href: "/admin/commands", label: "Commands", icon: "⚡" },
  { href: "/admin/laps", label: "Laps", icon: "🏁" }
];

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, supabase } = useSupabase();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    
    if (!session) {
      router.push("/auth/login?redirectTo=/admin");
      return;
    }

    // Check admin access (client-side quick check)
    const userEmail = session.user.email;
    const hasAdminAccess = checkAdminAccess(userEmail);
    
    // Also check via API for database roles
    const checkAdminViaAPI = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.access_token) {
          setIsAdmin(false);
          router.push("/dashboard?error=admin_access_required");
          return;
        }

        const response = await fetch("/api/admin/check-role", {
          headers: {
            "Authorization": `Bearer ${currentSession.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin || false);
          
          if (!data.isAdmin) {
            router.push("/dashboard?error=admin_access_required");
          }
        } else {
          // If API check fails, fall back to client-side check
          setIsAdmin(hasAdminAccess);
          if (!hasAdminAccess) {
            router.push("/dashboard?error=admin_access_required");
          }
        }
      } catch (err) {
        console.error("Error checking admin access:", err);
        // Fall back to client-side check
        setIsAdmin(hasAdminAccess);
        if (!hasAdminAccess) {
          router.push("/dashboard?error=admin_access_required");
        }
      }
    };

    checkAdminViaAPI();
  }, [session, loading, router, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
          </div>
          <p className="text-slate-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || isAdmin === null) {
    return null; // Will redirect or still checking
  }

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="glass rounded-2xl p-8 max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-slate-400 mb-6">You don't have permission to access the admin panel.</p>
            <Link href="/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="glass rounded-2xl p-6 sticky top-24">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Admin Panel</h2>
              <p className="text-xs text-slate-400">System Management</p>
            </div>
            <nav className="space-y-2">
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 pt-6 border-t border-slate-800/50">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800/50 hover:text-white transition-all duration-200"
              >
                <span className="text-lg">←</span>
                <span className="font-medium">Back to Dashboard</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

