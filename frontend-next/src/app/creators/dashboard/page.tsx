"use client";

/**
 * /creators/dashboard — Creator-facing dashboard.
 *
 * Creators are the long-form publishers (YouTube, podcast hosts, etc.)
 * whose content RelatiV auto-clips + matches with brands.
 *
 * Wired to GET /api/proxy/api/v1/dashboard/creator (see lib/api.ts).
 * Sections rendered from the response payload:
 *
 *  1. KPI strip — monthly earnings, auto-clips shipped, channels, brand deals
 *  2. Earnings chart — 6-month bar chart
 *  3. Auto-clips — recent clips the engine generated
 *  4. Channels — connected channels + monthly earnings
 *  5. Brand deals — campaigns matched to your content (sign / negotiating)
 *
 * States handled:
 *  - loading  → skeleton in the dashboard shell
 *  - error    → retry card with the failure detail
 *  - empty    → "no data yet" state per section
 *  - wrong role → notice + deep link to the right dashboard
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  LogIn,
  Mic,
  Play,
  RefreshCw,
  Rss,
  Sparkles,
  Store,
  Video,
  X,
} from "lucide-react";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchCreatorDashboard,
  type CreatorAutoClip,
  type CreatorBrandDeal,
  type CreatorChannel,
  type CreatorDashboardData,
} from "@/lib/api";

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function formatUsd(cents: number, fractionDigits = 0): string {
  const dollars = centsToDollars(cents);
  return dollars.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Map backend platform string → icon + accent colour. */
const PLATFORM_ICON: Record<string, { Icon: typeof Video; color: string; bg: string; border: string; label: string }> = {
  youtube: {
    Icon: Video,
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.30)",
    label: "YouTube",
  },
  youtube_shorts: {
    Icon: Video,
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.30)",
    label: "Shorts",
  },
  tiktok: {
    Icon: Video,
    color: "#1A1814",
    bg: "rgba(60, 50, 30, 0.08)",
    border: "rgba(60, 50, 30, 0.20)",
    label: "TikTok",
  },
  instagram: {
    Icon: Mic,
    color: "#8B5CF6",
    bg: "rgba(139, 92, 246, 0.10)",
    border: "rgba(139, 92, 246, 0.30)",
    label: "Instagram",
  },
  podcast: {
    Icon: Mic,
    color: "#8B5CF6",
    bg: "rgba(139, 92, 246, 0.10)",
    border: "rgba(139, 92, 246, 0.30)",
    label: "Podcast",
  },
};

function platformMeta(platform: string) {
  return (
    PLATFORM_ICON[platform.toLowerCase()] || {
      Icon: Rss,
      color: "var(--color-text-muted)",
      bg: "rgba(60, 50, 30, 0.08)",
      border: "rgba(60, 50, 30, 0.20)",
      label: platform,
    }
  );
}

/* ─── Section heading (the 01 / 02 / 03 motif) ──────────────────────────── */

function SectionHeader({
  index,
  label,
  trailing,
}: {
  index: string;
  label: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
        {index}
      </span>
      <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
      <span
        className="text-[11px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      {trailing && (
        <span
          className="ml-auto text-[11px] font-mono tabular-nums"
          style={{ color: "var(--color-text-muted)" }}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}

/* ─── Skeletons (loading state) ─────────────────────────────────────────── */

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 rounded-[var(--radius-lg)] animate-pulse"
          style={{
            background: "rgba(255, 252, 242, 0.65)",
            border: "1px solid rgba(60, 50, 30, 0.10)",
          }}
        />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="h-64 rounded-[var(--radius-lg)] animate-pulse"
      style={{
        background: "rgba(255, 252, 242, 0.65)",
        border: "1px solid rgba(60, 50, 30, 0.10)",
      }}
    />
  );
}

function RowsSkeleton({ rows = 3, height = 88 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] animate-pulse"
          style={{
            height,
            background: "rgba(255, 252, 242, 0.65)",
            border: "1px solid rgba(60, 50, 30, 0.10)",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Error state ──────────────────────────────────────────────────────── */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="glass-card p-10 text-center"
      style={{ borderColor: "rgba(239, 68, 68, 0.30)" }}
    >
      <div
        className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(239, 68, 68, 0.10)" }}
      >
        <AlertCircle className="h-5 w-5" style={{ color: "#EF4444" }} />
      </div>
      <p
        className="text-[15px] font-semibold mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        Couldn’t load your dashboard
      </p>
      <p
        className="text-[12px] max-w-md mx-auto"
        style={{ color: "var(--color-text-muted)" }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        className="btn-primary btn-shine mt-5 inline-flex items-center gap-2 text-[13px]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}

/* ─── Empty state (per section) ─────────────────────────────────────────── */

function EmptySection({ message }: { message: string }) {
  return (
    <div
      className="glass-card p-8 text-center"
      style={{ borderStyle: "dashed", borderColor: "rgba(60, 50, 30, 0.18)" }}
    >
      <Sparkles className="h-5 w-5 mx-auto mb-2" style={{ color: "var(--color-text-faint)" }} />
      <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
        {message}
      </p>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function CreatorsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<SidebarKey>("overview");
  const [data, setData] = useState<CreatorDashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const d = await fetchCreatorDashboard();
      setData(d);
    } catch (e: any) {
      setDataError(e?.message || "Failed to load dashboard");
      setData(null);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch once we know the user is authenticated.
    if (authLoading) return;
    if (!user) {
      setDataLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  /* ── Auth gate ─────────────────────────────────────────────────────── */

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
        <KpiSkeleton />
        <div className="mt-10" />
        <ChartSkeleton />
        <div className="mt-10" />
        <RowsSkeleton />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <h1 className="font-display font-bold text-2xl mb-2">Sign in to continue</h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            You need a RelatiV creator account to access this dashboard.
          </p>
          <Link
            href="/signup?next=/creators/dashboard&role=creator"
            className="btn-primary btn-shine inline-flex"
          >
            Create creator account
          </Link>
        </div>
      </section>
    );
  }

  const initials =
    (user.name || user.email)
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const sidebarUser = { name: user.name, handle: user.email, initials };
  const isWrongRole = user.role !== "creator";

  const TITLE: Record<SidebarKey, { t: string; s?: string }> = {
    overview: { t: "Creator workspace", s: "Auto-clips, channels, and brand deals — at a glance." },
    campaigns: { t: "Campaigns", s: "Brand campaigns matched to your content." },
    queue: { t: "Clips Queue", s: "Clips waiting for review." },
    analytics: { t: "Analytics", s: "Cross-platform performance." },
    billing: { t: "Billing", s: "Invoices and payout history." },
    settings: { t: "Settings", s: "Account, channels, payout details." },
    clips: { t: "Clips", s: "All generated clips." },
    earnings: { t: "Earnings", s: "Lifetime and per-channel." },
    payouts: { t: "Payouts", s: "Weekly UPI / USD / USDC payouts." },
    resources: { t: "Resources", s: "Hook playbook, FTC kit, best practices." },
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
          <AlertCircle
            className="h-5 w-5 mt-0.5 shrink-0"
            style={{ color: "var(--color-sunset-coral, #FB7185)" }}
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
              This is the creator dashboard, but your account is a {user.role}.
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              You’re seeing the dashboard demo. Switch to your role’s view for real data.
            </p>
            <div className="mt-2">
              <Link
                href={
                  user.role === "brand"
                    ? "/brands/dashboard"
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

      {active !== "overview" ? (
        <div
          className="glass-card p-16 text-center"
          style={{ borderStyle: "dashed", borderColor: "rgba(217, 70, 239, 0.30)" }}
        >
          <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <p
            className="text-[15px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Coming soon
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--color-text-muted)" }}>
            {active} panel is on the roadmap.
          </p>
          <button
            onClick={() => setActive("overview")}
            className="btn-glass mt-5 inline-flex items-center gap-2 text-[13px]"
          >
            ← Back to overview
          </button>
        </div>
      ) : dataError ? (
        <ErrorState message={dataError} onRetry={load} />
      ) : dataLoading || !data ? (
        <>
          <KpiSkeleton />
          <div className="mt-10" />
          <ChartSkeleton />
          <div className="mt-10" />
          <RowsSkeleton />
        </>
      ) : (
        <CreatorOverview data={data} />
      )}
    </DashboardShell>
  );
}

/* ─── Overview renderer (data-driven) ──────────────────────────────────── */

function CreatorOverview({ data }: { data: CreatorDashboardData }) {
  const { kpis, earnings_chart, auto_clips, channels, brand_deals } = data;
  const isEmpty =
    earnings_chart.length === 0 &&
    auto_clips.length === 0 &&
    channels.length === 0 &&
    brand_deals.length === 0;

  if (isEmpty) {
    return (
      <EmptySection message="No creator data yet. Paste a YouTube URL to get started." />
    );
  }

  const sparkEarnings = earnings_chart.map((p) => centsToDollars(p.cents));
  const thisMonthCents = kpis.earnings_cents_month;
  const totalEarningsCents = earnings_chart.reduce((s, p) => s + p.cents, 0);
  const changePct = kpis.earnings_change_pct;
  const changePositive = changePct >= 0;

  return (
    <>
      {/* 01 · KPI strip */}
      <section className="mb-10">
        <SectionHeader index="01" label="This month" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Earnings"
            value={`$${formatUsd(thisMonthCents)}`}
            unit="USD"
            delta={{
              value: `${changePositive ? "+" : ""}${changePct.toFixed(0)}% MoM`,
              positive: changePositive,
            }}
            variant="accent"
            sparkline={sparkEarnings}
          />
          <StatCard
            label="Auto-clips"
            value={kpis.auto_clips_count.toString()}
            unit="clips"
            delta={{
              value: `${kpis.auto_clips_count} in pipeline`,
              positive: true,
            }}
            variant="success"
          />
          <StatCard
            label="Channels"
            value={kpis.channels_count.toString()}
            unit="active"
            caption={
              channels.length > 0
                ? channels.map((c) => c.handle).join(" · ")
                : "No channels yet"
            }
            variant="default"
            icon="📡"
          />
          <StatCard
            label="Open deals"
            value={`$${formatUsd(kpis.open_deals_cents)}`}
            unit="pending"
            delta={{
              value: `${brand_deals.filter((d) => d.status === "pending").length} to sign`,
              positive: brand_deals.some((d) => d.status === "pending"),
            }}
            variant="warning"
            icon="🤝"
          />
        </div>
      </section>

      {/* 02 · Earnings chart */}
      <section className="mb-10">
        <SectionHeader
          index="02"
          label="Earnings · 6 mo"
          trailing={`Total $${formatUsd(totalEarningsCents)}`}
        />
        {earnings_chart.length === 0 ? (
          <EmptySection message="No earnings yet. Once brands pay for your clips, you’ll see a 6-month breakdown here." />
        ) : (
          <EarningsChart points={earnings_chart} />
        )}
      </section>

      {/* 03 · Auto-clips */}
      <section className="mb-10">
        <SectionHeader
          index="03"
          label="Auto-clips"
          trailing={`${auto_clips.length} generated`}
        />
        {auto_clips.length === 0 ? (
          <EmptySection message="No clips generated yet. Drop a YouTube URL below to spin up your first batch." />
        ) : (
          <div className="space-y-3">
            {auto_clips.slice(0, 6).map((clip) => (
              <AutoClipRow key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </section>

      {/* 04 · Channels */}
      <section className="mb-10">
        <SectionHeader index="04" label="Channels" />
        {channels.length === 0 ? (
          <EmptySection message="No channels connected. Link a YouTube or podcast channel to start auto-clipping." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {channels.map((ch, i) => (
              <ChannelCard key={`${ch.platform}-${i}`} channel={ch} />
            ))}
          </div>
        )}
      </section>

      {/* 05 · Brand deals */}
      <section className="mb-10">
        <SectionHeader
          index="05"
          label="Brand deals"
          trailing={`${brand_deals.filter((d) => d.status === "pending").length} pending signature`}
        />
        {brand_deals.length === 0 ? (
          <EmptySection message="No brand deals matched to your content yet. Keep uploading — the matcher needs a few clips to learn your niche." />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {brand_deals.map((deal) => (
                <BrandDealRow key={deal.id} deal={deal} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* 06 · CTA */}
      <section className="mb-6">
        <div
          className="glass-panel p-8 text-center relative overflow-hidden"
          style={{ borderRadius: "var(--radius-2xl)" }}
        >
          <div
            className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                06
              </span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span
                className="text-[11px] font-mono uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Upload a new episode
              </span>
            </div>
            <h2
              className="font-display font-semibold tracking-tight mb-3"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", lineHeight: 1.1 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Drop a YouTube link. </span>
              <span className="hero-text text-gradient-sunset">Get 10 clips.</span>
            </h2>
            <p
              className="text-[14px] max-w-md mx-auto"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Paste a URL from your channel. The engine transcribes, scores, and renders clips
              matched to active brand deals.
            </p>
            <Link href="/" className="btn-primary btn-shine mt-6 inline-flex items-center gap-2">
              <Play className="h-4 w-4" fill="white" />
              Paste a URL
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function EarningsChart({ points }: { points: { month: string; cents: number }[] }) {
  const max = Math.max(...points.map((p) => p.cents), 1);
  return (
    <div className="glass-card p-6">
      <div className="flex items-end gap-3 h-44">
        {points.map((p, i) => {
          const h = (p.cents / max) * 100;
          return (
            <div key={`${p.month}-${i}`} className="flex-1 flex flex-col items-center gap-2">
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: "var(--color-text-muted)" }}
              >
                ${formatUsd(p.cents)}
              </span>
              <motion.div
                className="w-full rounded-t-lg"
                style={{
                  background: "var(--gradient-sunset)",
                  boxShadow: "0 0 12px rgba(217, 70, 239, 0.30)",
                }}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
              />
              <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                {p.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoClipRow({ clip }: { clip: CreatorAutoClip }) {
  const meta = platformMeta(clip.platform);
  const { Icon } = meta;
  const isReady = clip.status === "ready";
  return (
    <div className="glass-card hover-glow p-5">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          <Icon className="h-5 w-5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-semibold leading-snug"
            style={{ color: "var(--color-text-primary)" }}
          >
            {clip.title}
          </p>
          {clip.hook && (
            <p
              className="text-[12px] mt-0.5 line-clamp-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              “{clip.hook}”
            </p>
          )}
          <div
            className="mt-1.5 flex items-center gap-3 text-[11px] font-mono flex-wrap"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>{meta.label}</span>
            <span>·</span>
            <span className="tabular-nums">{formatDuration(clip.duration_s)}</span>
            <span>·</span>
            <span className="tabular-nums">viral {clip.viral_score}/100</span>
            <span>·</span>
            <span>{timeAgo(clip.generated_at)}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <div
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: isReady ? "rgba(16, 185, 129, 0.10)" : "rgba(251, 191, 36, 0.12)",
              color: isReady ? "var(--color-success)" : "#B45309",
            }}
          >
            {isReady ? "Ready" : "Processing"}
          </div>
          {clip.source_url && (
            <a
              href={clip.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--color-text-muted)" }}
            >
              source <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: CreatorChannel }) {
  const meta = platformMeta(channel.platform);
  const { Icon } = meta;
  return (
    <a
      href={channel.url || "#"}
      target="_blank"
      rel="noreferrer"
      className="glass-card hover-glow p-5 block"
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          <Icon className="h-5 w-5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p
              className="text-[14px] font-semibold truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {channel.handle}
            </p>
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
          </div>
          <p
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            {meta.label}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div
            className="text-[10px] font-mono mb-0.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            TOTAL VIEWS
          </div>
          <div
            className="font-display font-semibold text-lg tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatCompact(channel.total_views)}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono mb-0.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            MONTHLY EARNINGS
          </div>
          <div
            className="font-display font-semibold text-lg tabular-nums"
            style={{ color: "var(--color-accent)" }}
          >
            ${formatUsd(channel.monthly_earnings_cents)}
          </div>
        </div>
      </div>
    </a>
  );
}

function BrandDealRow({ deal }: { deal: CreatorBrandDeal }) {
  const isPending = deal.status === "pending";
  const isNegotiating = deal.status === "negotiating";
  const isSigned = deal.status === "signed" || deal.status === "approved";
  const isRejected = deal.status === "rejected" || deal.status === "passed";

  // Border + accent colour per status
  const ring = isPending
    ? "rgba(217, 70, 239, 0.30)"
    : isNegotiating
    ? "rgba(139, 92, 246, 0.30)"
    : isSigned
    ? "rgba(16, 185, 129, 0.30)"
    : "rgba(60, 50, 30, 0.10)";

  return (
    <motion.div
      layout
      className="glass-card p-5"
      style={{ borderColor: ring, opacity: isRejected ? 0.55 : 1 }}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(60, 50, 30, 0.06)" }}
            >
              <Store className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <p
              className="text-[15px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {deal.brand_name}
            </p>
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {deal.vertical}
            </span>
          </div>
          <div
            className="flex items-center gap-3 text-[11px] font-mono"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span className="tabular-nums">${formatUsd(deal.value_cents)}</span>
            <span>·</span>
            <span>expires {formatExpiresAt(deal.expires_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPending ? (
            <>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-full transition-colors"
                style={{
                  background: "rgba(255, 252, 242, 0.6)",
                  border: "1px solid rgba(60, 50, 30, 0.10)",
                  color: "var(--color-text-muted)",
                }}
              >
                <X className="h-3.5 w-3.5" />
                Pass
              </button>
              <button
                className="btn-primary btn-shine inline-flex items-center gap-1.5 text-[12px]"
                style={{ padding: "8px 16px" }}
              >
                <Check className="h-3.5 w-3.5" />
                Sign a deal
              </button>
            </>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider rounded-full"
              style={
                isNegotiating
                  ? {
                      background: "rgba(139, 92, 246, 0.10)",
                      color: "#8B5CF6",
                    }
                  : isSigned
                  ? {
                      background: "rgba(16, 185, 129, 0.10)",
                      color: "var(--color-success)",
                    }
                  : {
                      background: "rgba(60, 50, 30, 0.06)",
                      color: "var(--color-text-muted)",
                    }
              }
            >
              {isNegotiating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Negotiating
                </>
              ) : isSigned ? (
                <>✓ Signed</>
              ) : isRejected ? (
                <>✗ Passed</>
              ) : (
                <>{deal.status}</>
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
