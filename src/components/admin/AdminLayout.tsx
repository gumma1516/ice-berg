import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Settings,
  Users,
  IceCreamCone,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { useAdminAuth } from "@/lib/admin-auth";
import { AdminGate } from "./AdminGate";

const navItems = [
  { to: "/admin" as const, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders" as const, label: "Orders", icon: ShoppingBag, exact: false },
  { to: "/admin/analytics" as const, label: "Analytics", icon: BarChart3, exact: false },
  { to: "/admin/store" as const, label: "Store", icon: Settings, exact: false },
  { to: "/admin/team" as const, label: "Team", icon: Users, exact: false, adminOnly: true },
];

/** The staff portal. Everything below the gate requires a staff identity. */
export function AdminLayout() {
  return (
    <AdminGate>
      <AdminShell />
    </AdminGate>
  );
}

function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { staff, signOut } = useAdminAuth();

  return (
    <div className="flex min-h-screen bg-[#f5f3f0]">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#1a1410] text-white transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <IceCreamCone className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-none">Ice Age</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Admin</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden">
            <X className="h-5 w-5 text-white/60" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems
            .filter((item) => !item.adminOnly || staff?.role === "admin")
            .map((item) => {
              const isActive = item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to) &&
                  (item.exact || item.to !== "/admin" || pathname === "/admin");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/15 text-white shadow-lg shadow-black/20"
                      : "text-white/60 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* Session + back to site */}
        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          {staff && (
            <div className="px-4 pb-2">
              <p className="truncate text-sm font-medium text-white/90">{staff.name}</p>
              <p className="truncate text-[11px] uppercase tracking-wider text-white/40">
                {staff.role}
              </p>
            </div>
          )}
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-black/5 bg-[#f5f3f0]/80 px-4 py-3 backdrop-blur-lg md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold capitalize">
              {pathname === "/admin" ? "Dashboard" : pathname.split("/").pop()}
            </h1>
          </div>
          <div className="hidden text-sm text-muted-foreground sm:block">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
