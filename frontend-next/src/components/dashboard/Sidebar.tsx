"use client";

/**
 * DashboardShell — wraps a sidebar + main content area.
 * Used by both /clippers/dashboard and /brands/dashboard.
 *
 * Props:
 *  - role: "clipper" | "brand"   → swaps sidebar items + accent color
 *  - user: { name, email, handle, avatar? }
 *  - active: string             → the active sidebar item key
 *  - onSelect: (key) => void    → nav handler (mocked, doesn't change route)
 *  - children: main content
 *
 * No external router integration — dashboards are mock data for the demo.
 * When real auth ships, swap onSelect for next/navigation.
 */

import { motion } from "framer-motion";
import Link from "next/link";

export type SidebarKey =
  | "overview"
  | "clips"
  | "earnings"
  | "campaigns"
  | "queue"
  | "billing"
  | "analytics"
  | "payouts"
  | "resources"
  | "settings";

export type SidebarItem = {
  key: SidebarKey;
  label: string;
  icon: string; // emoji or short symbol
  badge?: string | number; // e.g. "3" pending
};

const CLIPPER_NAV: SidebarItem[] = [
  { key: "overview", label: "Overview", icon: "◉" },
  { key: "clips", label: "My Clips", icon: "▶" },
  { key: "earnings", label: "Earnings", icon: "$" },
  { key: "campaigns", label: "Open Campaigns", icon: "◇" },
  { key: "payouts", label: "Payouts", icon: "↑" },
  { key: "resources", label: "Resources", icon: "?" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

const BRAND_NAV: SidebarItem[] = [
  { key: "overview", label: "Overview", icon: "◉" },
  { key: "campaigns", label: "Campaigns", icon: "▤", badge: 3 },
  { key: "queue", label: "Clips Queue", icon: "▶", badge: 12 },
  { key: "analytics", label: "Analytics", icon: "↗" },
  { key: "billing", label: "Billing", icon: "$" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export interface DashboardShellProps {
  role: "clipper" | "brand";
  user: { name: string; handle: string; initials?: string };
  active: SidebarKey;
  onSelect: (k: SidebarKey) => void;
  pageTitle: string;
  pageSubtitle?: string;
  children: React.ReactNode;
}

export default function DashboardShell({
  role,
  user,
  active,
  onSelect,
  pageTitle,
  pageSubtitle,
  children,
}: DashboardShellProps) {
  const nav = role === "clipper" ? CLIPPER_NAV : BRAND_NAV;
  const accentColor = role === "clipper" ? "var(--color-accent-tertiary)" : "var(--color-accent)";
  const accentGlow = role === "clipper" ? "var(--color-glow-violet)" : "var(--color-glow-primary)";

  return (
    <div className="relative min-h-screen pt-20 px-4 md:px-6 pb-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full opacity-30 blur-[140px]"
          style={{ background: accentColor }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* ─── Sidebar ─── */}
        <aside className="lg:sticky lg:top-24 self-start rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/80 backdrop-blur p-4">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[color:var(--color-border)]">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-[color:var(--color-bg-base)]"
              style={{ background: accentColor }}
            >
              {user.initials || user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate">{user.name}</div>
              <div className="text-[10px] font-mono text-text-muted truncate">{user.handle}</div>
            </div>
          </div>

          <div className="text-[10px] font-mono tracking-widest text-text-faint px-2 mb-2">
            {role === "clipper" ? "CLIPPER" : "BRAND"}
          </div>
          <nav className="space-y-0.5">
            {nav.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className={`relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                    isActive
                      ? "text-text-primary bg-[color:var(--color-surface-2)]"
                      : "text-text-secondary hover:text-text-primary hover:bg-[color:var(--color-surface-2)]/50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="text-base w-5 text-center"
                      style={{ color: isActive ? accentColor : "var(--color-text-muted)" }}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                  {item.badge != null && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r"
                      style={{ background: accentColor, boxShadow: `0 0 12px ${accentGlow}` }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-[color:var(--color-border)] space-y-2">
            <Link
              href={role === "clipper" ? "/clippers/apply" : "/brands"}
              className="block w-full text-center text-xs font-mono text-text-muted hover:text-text-primary transition-colors py-1"
            >
              ← Back to public site
            </Link>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="min-w-0">
          <motion.div
            key={pageTitle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <h1 className="font-display font-bold text-3xl md:text-4xl text-text-primary tracking-tight">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="mt-2 text-text-secondary">{pageSubtitle}</p>
            )}
          </motion.div>
          {children}
        </main>
      </div>
    </div>
  );
}
