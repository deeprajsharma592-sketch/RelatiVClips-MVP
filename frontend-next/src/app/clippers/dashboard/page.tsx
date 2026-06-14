"use client";

/**
 * /clippers/dashboard — Clipper earnings + activity surface.
 *
 * The user said "make this GOOD." The job:
 *  - Make clippers feel like running a small business, not a gig
 *  - Show money earned, momentum, and what to do next
 *  - Make the open-campaign board feel like an inbox of opportunities
 *  - Mirror the visual language of the brand dashboard (different accent)
 *
 * Sections (Overview):
 *  1. KPI strip — earnings, clips live, pending, avg CPM
 *  2. Earnings chart (last 7 days, bar chart, simple SVG)
 *  3. Open campaigns (apply CTA, 3 cards)
 *  4. Recent clips (3 with stats, claim payout)
 *  5. Tips from the top (3 cards, motivational)
 *
 * Re-skinned in v5.1 to the "cream glass" design system:
 *  - StatCard + DashboardShell already on the new system
 *  - Panels use .glass-card + .hover-glow
 *  - Violet (#8B5CF6 → #EC4899) is the clipper role accent
 *  - Numeric values use tabular-nums
 *  - Section headings carry a 01 / 02 / 03 marker
 *
 * Wired to live data in v6.1:
 *  - GET /api/proxy/api/v1/dashboard/clipper  (real cents, real week chart,
 *    real open campaigns, real recent clips)
 *  - Three UI states: loading (skeleton), error (retry), empty (CTA when
 *    the clipper has zero clips)
 *  - TIPS stay static — they're motivational copy, not data
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, LogIn, RefreshCw, Inbox } from "lucide-react";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchClipperDashboard,
  type ClipperDashboardData,
} from "@/lib/api";

// TIPS palette — three complementary accent tones for the tip badges.
// Clipper role accent is violet, so the trio spans violet → emerald → gold.
const TIPS = [
  {
    title: "Hook in 0.5s",
    body: "Open with a contradiction, a number, or a POV — not a 'hey guys'. Top 10% of clippers all do this.",
    color: "#8B5CF6", // violet
  },
  {
    title: "Track view velocity",
    body: "If a clip gets < 5K views in 24h, take it down. Dead clips hurt your profile score.",
    color: "#10B981", // emerald
  },
  {
    title: "Posting cadence wins",
    body: "Clippers posting 5+ clips/week earn 3.4x more than 1/week. The algorithm rewards consistency.",
    color: "#D4A574", // warm gold
  },
];

// ─── Display helpers ────────────────────────────────────────────────────
// All money values arrive from the backend in integer cents.

function formatCentsBig(cents: number): string {
  if (!cents || cents <= 0) return "$0";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatCentsCpm(cents: number): string {
  if (!cents || cents <= 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLetter(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "·";
  return d.toLocaleDateString("en-US", { weekday: "short" })[0];
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

// Simple inline bar chart for the last 7 days. The last bar uses the
// violet→pink gradient so today's earning is the visual focal point.
function EarningsBars({
  data,
}: {
  data: { date: string; earnings_cents: number }[];
}) {
  const values = data.map((d) => Math.round(d.earnings_cents / 100));
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => {
        const v = values[i];
        const h = (v / max) * 100;
        const isLatest = i === data.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="text-[10px] font-mono tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              ${v}
            </div>
            <div className="w-full h-20 flex items-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${h}%`,
                  minHeight: "2px",
                  background: isLatest
                    ? "linear-gradient(180deg, #8B5CF6 0%, #EC4899 100%)"
                    : "rgba(60, 50, 30, 0.08)",
                  boxShadow: isLatest
                    ? "0 0 12px rgba(139, 92, 246, 0.45)"
                    : undefined,
                  transition: `height 0.5s ease-out ${i * 0.05}s`,
                }}
              />
            </div>
            <div
              className="text-[10px] font-mono"
              style={{ color: "var(--color-text-faint)" }}
            >
              {dayLetter(d.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Skeleton block used while the dashboard is loading. Mirrors the
// cream-glass surface so the layout doesn't jump when data lands.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)] ${className}`}
    />
  );
}

export default function ClipperDashboard() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<SidebarKey>("overview");

  // Live backend data (v6.1)
  const [data, setData] = useState<ClipperDashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      const json = await fetchClipperDashboard();
      setData(json);
    } catch (e: any) {
      setDashError(e?.message || "Failed to load dashboard");
      setData(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to settle before deciding whether to hit the dashboard
    if (loading) return;
    if (!user) return;
    if (user.role !== "clipper") {
      // Wrong role: skip fetch (backend would 403). The role-mismatch banner
      // further down the tree explains the situation.
      setDashLoading(false);
      setData(null);
      return;
    }
    loadDashboard();
  }, [loading, user, loadDashboard]);

  // Loading state — show the shell skeleton so layout doesn't jump
  if (loading) {
    return (
      <DashboardShell
        role="clipper"
        user={{ name: "…", handle: "Loading", initials: "·" }}
        active={active}
        onSelect={setActive}
        pageTitle="Loading"
        pageSubtitle="Fetching your account…"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)]"
            />
          ))}
        </div>
      </DashboardShell>
    );
  }

  // Not signed in (middleware should have bounced — this is a safety net)
  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3 text-[color:var(--color-accent)]" />
          <h1 className="font-display font-bold text-2xl mb-2">Sign in to continue</h1>
          <p className="text-sm text-text-secondary mb-5">
            Clipper accounts are by application. Sign in if you have one, or apply below.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/login?next=/clippers/dashboard" className="btn-primary btn-shine">
              Sign in
            </Link>
            <Link href="/clippers/apply" className="btn-secondary">
              Apply
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Real-user identity for the sidebar
  const initials =
    (user.name || user.email)
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const sidebarUser = {
    name: user.name,
    handle: user.email,
    initials,
  };

  // Role mismatch: someone with a creator/brand account is poking around
  const isWrongRole = user.role !== "clipper";

  // Build a first name for the greeting (falls back to "there")
  const firstName =
    (user.name || user.email || "there").split(/\s+/)[0] || "there";

  // Dynamic subtitle for the overview tab — built from real KPIs
  const overviewSubtitle = data
    ? `You earned ${formatCentsBig(data.kpis.earnings_cents_week)} this week · ${data.kpis.clips_live} clips live · ${data.open_campaigns.length} open campaign${data.open_campaigns.length === 1 ? "" : "s"}.`
    : dashError
    ? "Couldn't load your live data — see error below."
    : "Loading your live earnings…";

  const TITLE: Record<SidebarKey, { t: string; s?: string }> = {
    overview: { t: `Welcome back, ${firstName}`, s: overviewSubtitle },
    clips: { t: "My Clips", s: "47 clips published · 23 still earning." },
    earnings: { t: "Earnings", s: "Lifetime $14.7K · 70/30 split with RelatiV." },
    campaigns: { t: "Open Campaigns", s: "8 active campaigns you can apply to." },
    payouts: { t: "Payouts", s: "Weekly UPI / USD / USDC." },
    resources: { t: "Resources", s: "Hooks playbook, FTC kit, capcut presets." },
    settings: { t: "Settings", s: "Account, payment method, tax info." },
    queue: { t: "Queue", s: "Clips pending brand review." },
    analytics: { t: "Analytics", s: "Per-platform performance." },
    billing: { t: "Billing", s: "Brand billing details." },
  };

  // Derived flags for the three live-data states
  const isFirstLoad = dashLoading && !data && !dashError;
  const isError = !dashLoading && !!dashError && !data;
  const isEmpty = !dashLoading && !dashError && !!data && data.recent_clips.length === 0;

  // Sparkline for the "Earned" stat card (dollars, 7 days)
  const earningsSparkline = data
    ? data.week_chart.map((p) => Math.round(p.earnings_cents / 100))
    : undefined;

  return (
    <DashboardShell
      role="clipper"
      user={sidebarUser}
      active={active}
      onSelect={setActive}
      pageTitle={TITLE[active].t}
      pageSubtitle={TITLE[active].s}
    >
      {isWrongRole && (
        <div
          className="mb-6 flex items-start gap-3 p-4 rounded-2xl border"
          style={{
            background: "rgba(139, 92, 246, 0.06)",
            borderColor: "rgba(139, 92, 246, 0.25)",
          }}
        >
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#8B5CF6" }} />
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
              This is the clipper dashboard, but your account is a {user.role}.
            </p>
            <p className="text-[color:var(--color-text-secondary)]">
              You're seeing the demo data. To use clipper features, sign up with a clipper account
              or sign in with one.
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                href={
                  user.role === "creator"
                    ? "/creators/dashboard"
                    : user.role === "brand"
                    ? "/brands/dashboard"
                    : "/account"
                }
                className="text-xs font-semibold underline"
                style={{ color: "#8B5CF6" }}
              >
                Go to my {user.role} dashboard →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error banner with retry — shown above the overview content */}
      {isError && (
        <div
          className="mb-6 flex items-start gap-3 p-4 rounded-2xl border"
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            borderColor: "rgba(239, 68, 68, 0.30)",
          }}
        >
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
              Couldn't load your dashboard
            </p>
            <p className="text-[color:var(--color-text-secondary)]">{dashError}</p>
            <button
              onClick={loadDashboard}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
              style={{ color: "#8B5CF6" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#7C3AED";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8B5CF6";
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        </div>
      )}

      {active === "overview" && (
        <>
          {/* ─── LOADING: KPI strip + chart + campaigns skeleton ───────── */}
          {isFirstLoad && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="h-28" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-10">
                <SkeletonBlock className="lg:col-span-2 h-64" />
                <SkeletonBlock className="lg:col-span-3 h-64" />
              </div>
            </>
          )}

          {/* ─── KPI strip (live data) ─────────────────────────────── */}
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Earned this week"
                value={formatCentsBig(data.kpis.earnings_cents_week)}
                delta={
                  data.kpis.earnings_change_pct
                    ? {
                        value: `${data.kpis.earnings_change_pct > 0 ? "+" : ""}${data.kpis.earnings_change_pct.toFixed(1)}%`,
                        positive: data.kpis.earnings_change_pct >= 0,
                        label: "vs last week",
                      }
                    : undefined
                }
                variant="violet"
                icon="$"
                sparkline={earningsSparkline}
              />
              <StatCard
                label="Clips live"
                value={String(data.kpis.clips_live)}
                variant="accent"
                icon="▶"
              />
              <StatCard
                label="Pending payout"
                value={formatCentsBig(data.kpis.pending_payout_cents)}
                caption="Settles Monday, 9 AM IST"
                variant="success"
                icon="↑"
              />
              <StatCard
                label="Your avg CPM"
                value={formatCentsCpm(data.kpis.avg_cpm_cents)}
                variant="warning"
                icon="↗"
              />
            </div>
          )}

          {/* ─── Earnings chart + open campaigns ────────────────────── */}
          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-10">
              <div className="lg:col-span-2 glass-card hover-glow p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div
                      className="text-[10px] font-mono tracking-widest"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      LAST 7 DAYS
                    </div>
                    <div
                      className="font-display font-semibold text-2xl tabular-nums mt-1"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {formatCentsBig(data.kpis.earnings_cents_week)}
                    </div>
                  </div>
                  <div
                    className="text-xs font-mono"
                    style={{
                      color:
                        data.kpis.earnings_change_pct >= 0
                          ? "var(--color-success)"
                          : "var(--color-error)",
                    }}
                  >
                    {data.kpis.earnings_change_pct >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(data.kpis.earnings_change_pct).toFixed(1)}% vs last week
                  </div>
                </div>
                <EarningsBars data={data.week_chart} />
              </div>

              <div className="lg:col-span-3 glass-card hover-glow p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-mono tracking-widest tabular-nums"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      02
                    </span>
                    <h2
                      className="font-display font-semibold text-lg"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Open campaigns · {data.open_campaigns.length} available
                    </h2>
                  </div>
                  <button
                    className="text-xs font-mono transition-colors"
                    style={{ color: "#8B5CF6" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#7C3AED";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8B5CF6";
                    }}
                  >
                    View all {data.open_campaigns.length} →
                  </button>
                </div>
                <div className="space-y-2">
                  {data.open_campaigns.slice(0, 3).map((c) => {
                    const pct =
                      c.slots_total > 0
                        ? (c.slots_filled / c.slots_total) * 100
                        : 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-[var(--radius-md)] border p-4 hover-glow transition-all"
                        style={{
                          background: c.premium
                            ? "rgba(212, 165, 116, 0.08)"
                            : "rgba(255, 252, 242, 0.5)",
                          borderColor: c.premium
                            ? "rgba(212, 165, 116, 0.35)"
                            : "rgba(60, 50, 30, 0.10)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: "var(--color-text-faint)" }}
                              >
                                {(c.vertical || "").toUpperCase()}
                              </span>
                              {c.premium && (
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: "rgba(212, 165, 116, 0.18)",
                                    color: "#B8860B",
                                    border: "1px solid rgba(212, 165, 116, 0.4)",
                                  }}
                                >
                                  PREMIUM
                                </span>
                              )}
                            </div>
                            <div
                              className="font-display font-semibold text-sm"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {c.brand_name}
                            </div>
                            <p
                              className="text-xs mt-1 line-clamp-2"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {c.brief}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className="font-display font-semibold text-lg tabular-nums"
                              style={{ color: "#8B5CF6" }}
                            >
                              {formatCentsCpm(c.cpm_cents)}
                            </div>
                            <div
                              className="text-[10px] font-mono"
                              style={{ color: "var(--color-text-faint)" }}
                            >
                              PER 1K VIEWS
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex-1 mr-4">
                            <div
                              className="flex items-center justify-between text-[10px] font-mono mb-1"
                              style={{ color: "var(--color-text-faint)" }}
                            >
                              <span>
                                {c.slots_filled}/{c.slots_total} slots filled
                              </span>
                              <span>Apply by {formatDeadline(c.deadline)}</span>
                            </div>
                            <div
                              className="h-1 rounded-full overflow-hidden"
                              style={{ background: "rgba(60, 50, 30, 0.08)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background:
                                    "linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%)",
                                  boxShadow: "0 0 8px rgba(139, 92, 246, 0.45)",
                                }}
                              />
                            </div>
                          </div>
                          <Link
                            href={`/clippers/campaigns?focus=${c.id}`}
                            className="btn-shine px-4 py-1.5 text-xs font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5"
                            style={{
                              background:
                                "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.30)",
                            }}
                          >
                            Apply
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                  {data.open_campaigns.length === 0 && (
                    <div
                      className="rounded-[var(--radius-md)] border border-dashed p-6 text-center text-xs"
                      style={{
                        color: "var(--color-text-muted)",
                        borderColor: "rgba(60, 50, 30, 0.15)",
                      }}
                    >
                      No open campaigns right now. Check back soon — new drops
                      land every week.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Recent clips (with empty state) ────────────────────── */}
          {data && (
            <section className="mb-10">
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[10px] font-mono tracking-widest tabular-nums"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  03
                </span>
                <h2
                  className="font-display font-semibold text-lg"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Your recent clips
                </h2>
              </div>

              {isEmpty ? (
                <div
                  className="glass-card hover-glow p-8 text-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(236, 72, 153, 0.04) 100%)",
                  }}
                >
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                    style={{
                      background: "rgba(139, 92, 246, 0.10)",
                      border: "1px solid rgba(139, 92, 246, 0.25)",
                    }}
                  >
                    <Inbox
                      className="h-6 w-6"
                      style={{ color: "#8B5CF6" }}
                    />
                  </div>
                  <h3
                    className="font-display font-semibold text-lg mb-1"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    No clips yet
                  </h3>
                  <p
                    className="text-sm max-w-md mx-auto mb-5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Claim your first campaign, cut your first 30-second hook, and
                    you'll start earning per 1K views. Lifetime earnings begin
                    the moment your first clip is approved.
                  </p>
                  {data.open_campaigns.length > 0 ? (
                    <button
                      className="btn-shine px-5 py-2 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5"
                      style={{
                        background:
                          "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                        boxShadow: "0 6px 18px rgba(139, 92, 246, 0.35)",
                      }}
                    >
                      Claim your first campaign
                    </button>
                  ) : (
                    <Link
                      href="/clippers/apply"
                      className="inline-block btn-shine px-5 py-2 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5"
                      style={{
                        background:
                          "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                        boxShadow: "0 6px 18px rgba(139, 92, 246, 0.35)",
                      }}
                    >
                      Browse all campaigns
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.recent_clips.slice(0, 3).map((c) => (
                    <div key={c.id} className="glass-card hover-glow p-4">
                      <div
                        className="text-[10px] font-mono tracking-widest mb-1"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        {(c.platform || "").toUpperCase()} ·{" "}
                        {(c.campaign_name || "").toUpperCase()}
                      </div>
                      <div
                        className="font-medium text-sm leading-snug line-clamp-2 mb-3"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {c.title}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div
                            className="text-[10px] font-mono"
                            style={{ color: "var(--color-text-faint)" }}
                          >
                            VIEWS
                          </div>
                          <div
                            className="font-display font-semibold text-base tabular-nums"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {formatViews(c.views)}
                          </div>
                        </div>
                        <div>
                          <div
                            className="text-[10px] font-mono"
                            style={{ color: "var(--color-text-faint)" }}
                          >
                            EARNED
                          </div>
                          <div
                            className="font-display font-semibold text-base tabular-nums"
                            style={{ color: "#8B5CF6" }}
                          >
                            {formatCentsBig(c.earnings_cents)}
                          </div>
                        </div>
                      </div>
                      <div
                        className="text-[10px] font-mono"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        {formatRelative(c.submitted_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ─── Tips from the top (static, always rendered) ────────── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-[10px] font-mono tracking-widest tabular-nums"
                style={{ color: "var(--color-text-faint)" }}
              >
                04
              </span>
              <h2
                className="font-display font-semibold text-lg"
                style={{ color: "var(--color-text-primary)" }}
              >
                Tips from the top 1%
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIPS.map((t, i) => (
                <div
                  key={t.title}
                  className="glass-card hover-glow p-4"
                >
                  <div
                    className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full mb-2"
                    style={{
                      color: t.color,
                      background: `${t.color}1F`,
                      border: `1px solid ${t.color}55`,
                    }}
                  >
                    TIP {i + 1}
                  </div>
                  <div
                    className="font-display font-semibold text-sm mb-1"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {t.title}
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {active !== "overview" && (
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-[var(--radius-xl)] border border-dashed p-12 text-center glass-card"
          >
            <div
              className="text-4xl mb-3 opacity-50"
              style={{ color: "#8B5CF6" }}
            >
              ◇
            </div>
            <h3
              className="font-display font-semibold text-lg mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {active.charAt(0).toUpperCase() + active.slice(1)} view — preview
            </h3>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "var(--color-text-muted)" }}
            >
              Built to spec, awaiting real data. Once you submit your first
              clips, this view lights up with real earnings, real payouts, and
              real campaign momentum.
            </p>
            <button
              onClick={() => setActive("overview")}
              className="btn-glass mt-6 px-4 py-2 text-xs font-mono transition-colors"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#8B5CF6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              ← Back to Overview
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardShell>
  );
}
