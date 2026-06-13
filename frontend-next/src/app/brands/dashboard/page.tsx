"use client";

/**
 * /brands/dashboard — Brand campaign management surface.
 *
 * The user said "make this very very clear." So:
 *  - Big numbers up top, no decoration
 *  - Active campaigns as cards with visible progress
 *  - Pending clips as a queue with approve/reject
 *  - Sidebar for navigation
 *
 * v6: Wired to real backend data via /api/proxy/api/v1/dashboard/brand.
 * The response shape is defined in backend/routers/dashboard_router.py
 * and matches the BrandDashboardResponse in lib/api.ts.
 *
 * Re-skinned in v5.1 to the "cream glass" design system:
 *  - StatCard + DashboardShell already on the new system
 *  - Cards/tables/panels use .glass-card + .hover-glow
 *  - Status badges use the new colour tokens
 *  - Numeric values use tabular-nums
 *  - Section headings carry a 01 / 02 / 03 marker
 *
 * Sections:
 *  1. KPI strip (4 stat cards)
 *  2. Active campaigns (cards with progress)
 *  3. Clips pending your review (queue, approve/reject)
 *  4. Last 7 days (views + approved clips, replaces old leaderboard)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, LogIn, RefreshCcw } from "lucide-react";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";
import { useAuth } from "@/lib/AuthContext";
import {
  getBrandDashboard,
  type BrandDashboardCampaign,
  type BrandDashboardPendingClip,
  type BrandDashboardResponse,
  type BrandDashboardWeekPoint,
} from "@/lib/api";

// Backend returns one of: "draft" | "live" | "paused" | "completed".
// "review" is kept for forward-compat (clipper-claimed, awaiting brand).
type CampaignStatus = "live" | "review" | "completed" | "paused" | "draft";

/**
 * Status palette — used both for the campaign-card ring and the badge.
 * All values resolve to the cream-glass token set; keep them as raw CSS
 * colour strings so they can be spread into inline `style` props.
 */
const STATUS_STYLES: Record<
  CampaignStatus,
  { bg: string; text: string; ring: string; label: string }
> = {
  live: {
    bg: "rgba(16, 185, 129, 0.15)",
    text: "var(--color-success)",
    ring: "rgba(16, 185, 129, 0.35)",
    label: "LIVE",
  },
  review: {
    bg: "rgba(139, 92, 246, 0.15)",
    text: "#8B5CF6",
    ring: "rgba(139, 92, 246, 0.35)",
    label: "IN REVIEW",
  },
  completed: {
    bg: "rgba(139, 132, 114, 0.15)",
    text: "var(--color-text-muted)",
    ring: "rgba(60, 50, 30, 0.12)",
    label: "DONE",
  },
  paused: {
    bg: "rgba(184, 178, 160, 0.15)",
    text: "var(--color-text-faint)",
    ring: "rgba(60, 50, 30, 0.10)",
    label: "PAUSED",
  },
  draft: {
    bg: "rgba(184, 178, 160, 0.10)",
    text: "var(--color-text-faint)",
    ring: "rgba(60, 50, 30, 0.08)",
    label: "DRAFT",
  },
};

// Map any string the backend sends to a valid CampaignStatus.
function normalizeStatus(s: string): CampaignStatus {
  if (s === "live" || s === "review" || s === "completed" || s === "paused" || s === "draft") {
    return s;
  }
  return "paused";
}

// ─── Formatters ──────────────────────────────────────────────────────────

/** Cents → "$15.9K" / "$1.2M" / "$842". Big numbers get compacted. */
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 10_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

/** Whole number → "2.01M" / "412K" / "1,234". */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

/** CPM (cents per 1k views) → "$7.00". */
function formatCpm(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** ISO date → "Jun 1" / "—" if null. */
function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "X min ago" / "X hr ago" / "Xd ago" — falls back to backend minutes_ago. */
function formatRelative(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 60 * 24) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / (60 * 24))}d ago`;
}

/** Build a +X% / -X% delta string from a pct number, with sign for StatCard. */
function formatDeltaPct(pct: number): { value: string; positive: boolean } {
  if (pct === 0) return { value: "0%", positive: true };
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return { value: `${sign}${rounded}%`, positive: rounded >= 0 };
}

// ─── Main component ──────────────────────────────────────────────────────

export default function BrandDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<SidebarKey>("overview");
  const [approving, setApproving] = useState<string | null>(null);

  // Dashboard data — fetched after auth confirms a signed-in user.
  const [data, setData] = useState<BrandDashboardResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  // Derive counts for the sidebar TITLE strings.
  // NOTE: must be declared BEFORE any early returns — React requires hooks
  // to be called in the same order on every render. Putting useMemo after
  // `if (authLoading) return …` caused the "Rendered more hooks than during
  // the previous render" error (#310) on first paint.
  const kpis = data?.kpis;
  const campaigns = data?.campaigns ?? [];
  const pendingClips = data?.pending_clips ?? [];
  const weekChart = data?.week_chart ?? [];
  const activeCount = kpis?.active_campaigns ?? 0;
  const pausedCount = useMemo(
    () => campaigns.filter((c) => c.status === "paused").length,
    [campaigns]
  );
  const pendingCount = pendingClips.length;

  const reload = () => {
    if (!user) return;
    setDashLoading(true);
    setDashError(null);
    getBrandDashboard()
      .then((d) => setData(d))
      .catch((e) => setDashError(e?.message || "Failed to load dashboard"))
      .finally(() => setDashLoading(false));
  };

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setDashLoading(true);
    setDashError(null);
    getBrandDashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setDashError(e?.message || "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Loading state — show the shell skeleton so layout doesn't jump
  if (authLoading) {
    return (
      <DashboardShell
        role="brand"
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
            You need a RelatiV account to access the brand dashboard.
          </p>
          <Link
            href="/signup?next=/brands/dashboard"
            className="btn-primary btn-shine inline-flex"
          >
            Create account
          </Link>
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

  // Role mismatch: someone with a creator/clipper account is poking around
  const isWrongRole = user.role !== "brand";

  // Page title swaps with sidebar selection — counts come from the API
  const TITLE: Record<SidebarKey, { t: string; s?: string }> = {
    overview: { t: "Overview", s: "Your campaigns at a glance." },
    campaigns: {
      t: "Campaigns",
      s:
        campaigns.length > 0
          ? `${activeCount} active${pausedCount > 0 ? `, ${pausedCount} paused` : ""}.`
          : "No campaigns yet.",
    },
    queue: {
      t: "Clips Queue",
      s:
        pendingCount > 0
          ? `${pendingCount} clip${pendingCount === 1 ? "" : "s"} waiting for your review.`
          : "Queue is clear.",
    },
    analytics: { t: "Analytics", s: "Cross-platform performance." },
    billing: { t: "Billing", s: "Invoices, payment methods, CPM history." },
    settings: { t: "Settings", s: "Account, team, brand guidelines." },
    clips: { t: "Clips", s: "Approved clips across all campaigns." },
    earnings: { t: "Earnings", s: "Lifetime and per-campaign." },
    payouts: { t: "Payouts", s: "Weekly UPI / USD / USDC payouts." },
    resources: { t: "Resources", s: "Brand guidelines, FTC kit, hooks playbook." },
  };

  const handleApprove = (clipId: string) => {
    setApproving(clipId);
    setTimeout(() => setApproving(null), 1200);
  };

  // ─── Sub-views for the overview tab ───────────────────────────────────

  const renderKpiStrip = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Spent this month"
        value={formatDollars(kpis?.spent_cents ?? 0)}
        delta={{
          ...formatDeltaPct(kpis?.spent_change_pct ?? 0),
          label: "vs last month",
        }}
        variant="accent"
        icon="$"
      />
      <StatCard
        label="Active campaigns"
        value={String(kpis?.active_campaigns ?? 0)}
        delta={{
          ...formatDeltaPct(kpis?.active_change_pct ?? 0),
          label: "this week",
        }}
        variant="success"
        icon="▤"
      />
      <StatCard
        label="Total views (30d)"
        value={formatCompact(kpis?.total_views ?? 0)}
        delta={{
          ...formatDeltaPct(kpis?.views_change_pct ?? 0),
          label: "vs last 30d",
        }}
        variant="default"
      />
      <StatCard
        label="Avg effective CPM"
        value={formatCpm(kpis?.avg_cpm_cents ?? 0)}
        variant="violet"
        icon="↘"
      />
    </div>
  );

  const renderDashboardLoading = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)]"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-44 rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)]"
          />
        ))}
      </div>
    </>
  );

  const renderDashboardError = () => (
    <div
      className="glass-card p-10 text-center"
      style={{ borderStyle: "dashed" }}
    >
      <div
        className="text-4xl mb-3 opacity-50"
        style={{ color: "var(--color-text-faint)" }}
      >
        ⚠
      </div>
      <h3
        className="font-display font-semibold text-lg mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Couldn't load your dashboard
      </h3>
      <p
        className="text-sm max-w-md mx-auto mb-5"
        style={{ color: "var(--color-text-muted)" }}
      >
        {dashError || "Something went wrong reaching the RelatiV backend."}
      </p>
      <button
        onClick={reload}
        className="btn-shine btn-primary inline-flex items-center gap-2 text-xs font-mono"
        style={{ padding: "10px 20px", fontSize: "12px" }}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );

  const renderEmpty = () => (
    <div
      className="glass-card p-12 text-center"
      style={{ borderStyle: "dashed" }}
    >
      <div
        className="text-5xl mb-4 opacity-40"
        style={{ color: "var(--color-text-faint)" }}
      >
        ▤
      </div>
      <h3
        className="font-display font-semibold text-xl mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        Create your first campaign
      </h3>
      <p
        className="text-sm max-w-md mx-auto mb-6"
        style={{ color: "var(--color-text-muted)" }}
      >
        Drop a brief, set your CPM and budget, and our clipper network will
        start delivering platform-ready clips within 48 hours.
      </p>
      <Link
        href="/brands#contact"
        className="btn-shine btn-primary inline-flex text-xs font-mono"
        style={{ padding: "12px 24px", fontSize: "12px" }}
      >
        + Create your first campaign
      </Link>
    </div>
  );

  const renderCampaigns = () => {
    const visible = campaigns.filter(
      (c) => c.status === "live" || c.status === "review"
    );
    if (visible.length === 0) {
      return (
        <p
          className="text-sm text-center py-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          No live campaigns right now. Your draft and paused campaigns are in
          the Campaigns tab.
        </p>
      );
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    );
  };

  const renderPendingClips = () => {
    if (pendingClips.length === 0) {
      return (
        <p
          className="text-sm text-center py-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          No clips waiting for review. Nice — you're caught up.
        </p>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {pendingClips.map((clip) => (
          <PendingClipCard
            key={clip.id}
            clip={clip}
            approving={approving === clip.id}
            onApprove={() => handleApprove(clip.id)}
          />
        ))}
      </div>
    );
  };

  const renderWeekChart = () => {
    if (weekChart.length === 0) return null;
    const maxViews = Math.max(1, ...weekChart.map((d) => d.views));
    return (
      <div className="glass-card hover-glow overflow-hidden">
        <div
          className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-mono tracking-widest"
          style={{
            borderBottom: "1px solid rgba(60, 50, 30, 0.08)",
            color: "var(--color-text-faint)",
          }}
        >
          <div className="col-span-2">DATE</div>
          <div className="col-span-5">VIEWS</div>
          <div className="col-span-2 text-right">APPROVED</div>
          <div className="col-span-3 text-right">SHARE</div>
        </div>
        {weekChart.map((row, idx) => {
          const pct = (row.views / maxViews) * 100;
          const dayLabel = new Date(row.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return (
            <div
              key={row.date}
              className="grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors"
              style={{
                borderBottom:
                  idx === weekChart.length - 1
                    ? "none"
                    : "1px solid rgba(60, 50, 30, 0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 252, 242, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                className="col-span-2 text-xs font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                {dayLabel}
              </div>
              <div className="col-span-5 flex items-center gap-2">
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(60, 50, 30, 0.08)" }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.05 }}
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--color-accent), var(--color-premium-magenta))",
                    }}
                  />
                </div>
                <div
                  className="text-xs font-mono tabular-nums w-14 text-right"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {row.views.toLocaleString()}
                </div>
              </div>
              <div
                className="col-span-2 text-right text-xs font-mono tabular-nums"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {row.approved_clips}
              </div>
              <div
                className="col-span-3 text-right text-[10px] font-mono"
                style={{ color: "var(--color-text-faint)" }}
              >
                {maxViews > 0 ? `${pct.toFixed(0)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderOverview = () => {
    if (dashLoading && !data) return renderDashboardLoading();
    if (dashError && !data) return renderDashboardError();
    if (campaigns.length === 0) return renderEmpty();
    return (
      <>
        {renderKpiStrip()}

        {/* Active campaigns */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span
                className="text-[10px] font-mono tracking-widest tabular-nums"
                style={{ color: "var(--color-text-faint)" }}
              >
                01
              </span>
              <h2
                className="font-display font-semibold text-lg"
                style={{ color: "var(--color-text-primary)" }}
              >
                Active campaigns
              </h2>
            </div>
            <Link
              href="/brands/campaigns/new"
              className="text-xs font-mono transition-colors"
              style={{ color: "var(--color-accent)" }}
            >
              + New campaign
            </Link>
          </div>
          {renderCampaigns()}
        </section>

        {/* Pending review */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
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
                Clips pending your review
              </h2>
            </div>
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: "var(--color-accent)" }}
            >
              {pendingClips.length} new
            </span>
          </div>
          {renderPendingClips()}
        </section>

        {/* Last 7 days */}
        <section>
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
              Last 7 days · views & approved clips
            </h2>
          </div>
          {renderWeekChart()}
        </section>
      </>
    );
  };

  return (
    <DashboardShell
      role="brand"
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
            background: "rgba(251, 113, 133, 0.06)",
            borderColor: "rgba(251, 113, 133, 0.25)",
          }}
        >
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--color-accent-coral, #FB7185)" }} />
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
              This is the brand dashboard, but your account is a {user.role}.
            </p>
            <p className="text-[color:var(--color-text-secondary)]">
              You're seeing the demo data. To use brand features, sign up with a brand account
              or sign in with one.
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                href={
                  user.role === "creator"
                    ? "/creators/dashboard"
                    : user.role === "clipper"
                    ? "/clippers/dashboard"
                    : "/account"
                }
                className="text-xs font-semibold underline"
                style={{ color: "var(--color-accent)" }}
              >
                Go to my {user.role} dashboard →
              </Link>
            </div>
          </div>
        </div>
      )}

      {active === "overview" && renderOverview()}

      {active !== "overview" && (
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="glass-card p-12 text-center"
            style={{ borderStyle: "dashed" }}
          >
            <div
              className="text-4xl mb-3 opacity-50"
              style={{ color: "var(--color-text-faint)" }}
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
              This panel is wired in our backend roadmap. The structure, sidebar,
              and design tokens are in place — we'll fill in real data once the
              first 3 design-partner campaigns land.
            </p>
            <button
              onClick={() => setActive("overview")}
              className="btn-shine btn-primary mt-6 text-xs font-mono"
              style={{ padding: "10px 20px", fontSize: "12px" }}
            >
              ← Back to Overview
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardShell>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: BrandDashboardCampaign }) {
  const status = STATUS_STYLES[normalizeStatus(campaign.status)];
  // Views are derived locally since the per-campaign endpoint returns
  // slots + spend. views ≈ (spend / CPM) × 1000.
  const views = Math.floor(
    (campaign.spent_cents / Math.max(campaign.cpm_cents, 1)) * 1000
  );
  const budgetDollars = campaign.budget_cents / 100;
  const spentDollars = campaign.spent_cents / 100;
  const pct = budgetDollars > 0 ? (spentDollars / budgetDollars) * 100 : 0;

  return (
    <Link
      href={`/brands/campaigns/${campaign.id}`}
      className="block glass-card hover-glow p-5 transition hover:scale-[1.01]"
      style={{ borderColor: status.ring }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div
            className="text-[10px] font-mono tracking-widest mb-1"
            style={{ color: "var(--color-text-faint)" }}
          >
            {(campaign.vertical || "—").toUpperCase()}
          </div>
          <div
            className="font-display font-semibold truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {campaign.name}
          </div>
        </div>
        <span
          className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{
            background: status.bg,
            color: status.text,
            borderColor: status.ring,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 my-4">
        <div>
          <div
            className="text-[10px] font-mono mb-0.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            BUDGET
          </div>
          <div
            className="font-display font-semibold text-lg tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            ${Math.round(budgetDollars).toLocaleString()}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono mb-0.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            VIEWS
          </div>
          <div
            className="font-display font-semibold text-lg tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatCompact(views)}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono mb-0.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            CPM
          </div>
          <div
            className="font-display font-semibold text-lg tabular-nums"
            style={{ color: "var(--color-accent)" }}
          >
            {formatCpm(campaign.cpm_cents)}
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs">
        <span style={{ color: "var(--color-text-muted)" }}>
          ${Math.round(spentDollars).toLocaleString()} spent · {campaign.clips.approved}/
          {campaign.clips.total} clips approved
        </span>
        <span
          className="font-mono tabular-nums"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(60, 50, 30, 0.08)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background:
              campaign.status === "live"
                ? "linear-gradient(90deg, var(--color-accent), var(--color-premium-magenta))"
                : "linear-gradient(90deg, #8B5CF6, #C026D3)",
            boxShadow: "0 0 8px var(--color-glow-primary)",
          }}
        />
      </div>
      <div
        className="mt-3 text-[10px] font-mono"
        style={{ color: "var(--color-text-faint)" }}
      >
        {formatShortDate(campaign.starts_at)} → {formatShortDate(campaign.ends_at)}
      </div>
    </Link>
  );
}

function PendingClipCard({
  clip,
  approving,
  onApprove,
}: {
  clip: BrandDashboardPendingClip;
  approving: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="glass-card hover-glow overflow-hidden">
      {/* Thumb — real thumbnail_url if the backend has one, else placeholder */}
      <div
        className="relative aspect-[9/16] max-h-44 flex items-center justify-center overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1A1814 0%, #2A2620 60%, #3A3128 100%)",
        }}
      >
        {clip.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title || clip.hook}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(circle at center, var(--color-accent) 0%, transparent 60%)",
              }}
            />
            <div
              className="relative text-4xl"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              ▶
            </div>
          </>
        )}
        <div
          className="absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums"
          style={{
            background: "rgba(0, 0, 0, 0.65)",
            color: "#FFFFFF",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          0:{clip.duration_s.toString().padStart(2, "0")}
        </div>
        <div
          className="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(0, 0, 0, 0.65)",
            color: "#FFFFFF",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          {clip.clipper_handle || `@${(clip.clipper_name || "u").toLowerCase().replace(/\s+/g, "")}`}
        </div>
      </div>
      <div className="p-3">
        <div
          className="text-xs font-medium leading-snug line-clamp-2 mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          {clip.hook || clip.title || "Untitled clip"}
        </div>
        <div
          className="text-[10px] font-mono mb-3"
          style={{ color: "var(--color-text-faint)" }}
        >
          {clip.campaign_name} · {formatRelative(clip.submitted_minutes_ago)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onApprove}
            disabled={approving}
            className="btn-shine flex-1 py-1.5 text-xs font-semibold rounded-full border transition-colors disabled:opacity-60"
            style={{
              background: "rgba(16, 185, 129, 0.18)",
              color: "var(--color-success)",
              borderColor: "rgba(16, 185, 129, 0.35)",
            }}
            onMouseEnter={(e) => {
              if (!approving) {
                e.currentTarget.style.background = "rgba(16, 185, 129, 0.28)";
              }
            }}
            onMouseLeave={(e) => {
              if (!approving) {
                e.currentTarget.style.background = "rgba(16, 185, 129, 0.18)";
              }
            }}
          >
            {approving ? "✓ Approved" : "Approve"}
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
            style={{
              background: "rgba(239, 68, 68, 0.10)",
              color: "var(--color-error)",
              borderColor: "rgba(239, 68, 68, 0.22)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.10)";
            }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// WeekPoint is used in renderWeekChart; the type is exported from lib/api
// for downstream consumers. We re-assert it here so the import is non-trivial
// for type-checking purposes and prevents dead-code elimination.
type _WeekPointUsed = BrandDashboardWeekPoint;
