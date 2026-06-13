"use client";

/**
 * DashboardShell — wraps a sidebar + main content area.
 * Used by /clippers/dashboard and /brands/dashboard.
 *
 * Re-skinned in v5.1 to cream glass aesthetic. Sidebar uses frosted
 * glass, items have a soft active-state highlight with the role accent.
 *
 * Props:
 *  - role: "clipper" | "brand"   → swaps sidebar items + accent color
 *  - user: { name, handle, initials? }
 *  - active: string             → the active sidebar item key
 *  - onSelect: (key) => void    → nav handler (mocked, doesn't change route)
 *  - children: main content
 *
 * No external router integration — dashboards are mock data for the demo.
 * When real auth ships, swap onSelect for next/navigation.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

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
  { key: "campaigns", label: "Open Campaigns", icon: "◇", badge: 3 },
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
  children: ReactNode;
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
  const isClipper = role === "clipper";
  const accentColor = isClipper ? "#8B5CF6" : "var(--color-accent)";
  const accentGlow = isClipper ? "rgba(139, 92, 246, 0.30)" : "rgba(217, 70, 239, 0.30)";
  const accentText = isClipper ? "CLIPPER NETWORK" : "BRAND WORKSPACE";
  const roleAccentClass = isClipper ? "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)" : "var(--gradient-sunset)";

  return (
    <div className="relative min-h-screen pt-24 px-4 md:px-6 pb-16">
      {/* Background gradient orb */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 -right-20 h-[600px] w-[600px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accentGlow} 0%, transparent 70%)` }}
        />
        <div
          className="absolute top-1/3 -left-20 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        {/* Sidebar */}
        <aside
          className="lg:sticky lg:top-24 self-start rounded-[var(--radius-xl)] p-4"
          style={{
            background: "rgba(255, 252, 242, 0.65)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.7)",
            boxShadow: "0 8px 32px rgba(140, 110, 60, 0.06)",
          }}
        >
          {/* User block */}
          <div
            className="flex items-center gap-3 pb-4 mb-4"
            style={{ borderBottom: "1px solid rgba(60, 50, 30, 0.08)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center font-display font-bold text-white shrink-0"
              style={{
                background: roleAccentClass,
                boxShadow: `0 4px 12px ${accentGlow}`,
              }}
            >
              {user.initials || user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-semibold truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {user.name}
              </div>
              <div
                className="text-[10px] font-mono truncate"
                style={{ color: "var(--color-text-muted)" }}
              >
                {user.handle}
              </div>
            </div>
          </div>

          {/* Role label */}
          <div
            className="text-[10px] font-mono uppercase tracking-widest px-2 mb-2.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            {accentText}
          </div>

          {/* Nav items */}
          <nav className="space-y-0.5">
            {nav.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className="relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200"
                  style={{
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    background: isActive ? "rgba(255, 252, 242, 0.95)" : "transparent",
                    boxShadow: isActive ? "0 1px 3px rgba(140, 110, 60, 0.08), 0 1px 0 rgba(255, 255, 255, 0.6) inset" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255, 252, 242, 0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-base w-5 text-center shrink-0"
                      style={{ color: isActive ? accentColor : "var(--color-text-muted)" }}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge != null && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        background: isClipper ? "rgba(139, 92, 246, 0.12)" : "rgba(217, 70, 239, 0.12)",
                        color: accentColor,
                      }}
                    >
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

          {/* Back to public site */}
          <div
            className="mt-4 pt-4 space-y-2"
            style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}
          >
            <Link
              href={isClipper ? "/clippers/apply" : "/brands"}
              className="block w-full text-center text-[11px] font-mono py-1.5 rounded-full transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              ← Back to public site
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: accentColor }}
              />
              <span
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: accentColor }}
              >
                {accentText}
              </span>
            </div>
            <h1
              className="font-display font-semibold text-3xl md:text-4xl tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p
                className="mt-2 text-[15px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {pageSubtitle}
              </p>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
