import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * Dashboard layout — wraps all protected pages.
 *
 * Double-checks authentication server-side here as well as the middleware.
 * If for any reason the middleware lets through an unauthenticated request,
 * this will catch it and redirect to login.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top nav */}
        <MobileNav />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
