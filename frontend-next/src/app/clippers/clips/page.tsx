"use client";

/**
 * /clippers/clips — Clipper's submitted-clips board.
 *
 *  - Fetches /api/v1/me/clips and groups by lifecycle status:
 *      Pending review  (status="submitted")
 *      Approved / Live (status="approved" or "live")
 *      Verified        (status="verified")
 *      Rejected        (status="rejected")
 *  - Each card: title, hook, platform, views, earnings, status badge,
 *    posted_url link
 *  - Header CTA → "Browse campaigns →" linking to /clippers/campaigns
 *  - Optional ?submitted=1 query param shows a success toast (fired by
 *    the new-clip form after a successful submission)
 *  - Auth guard via useAuth() (loading / signed-out / wrong-role)
 *  - Loading / Error / Empty / Loaded states
 *
 * Aesthetic mirrors the rest of the clipper surface: cream glass,
 * violet (#8B5CF6) role accent, monospace labels, framer-motion stagger.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Film,
  Inbox,
  LogIn,
  RefreshCw,
  Target,
  XCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { listMyClips, type Clip } from "@/lib/api";

// ─── Display helpers ──────────────────────────────────────────────────────
function formatCents(cents: number): string {
  if (!cents || cents <= 0) return "$0";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function platformLabel(p: string | null | undefined): string {
  if (!p) return "—";
  const map: Record<string, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube_shorts: "YouTube Shorts",
    twitter: "X / Twitter",
    x: "X / Twitter",
  };
  return map[p] || p;
}

// Map raw status → the four visible groups + their palette.
type GroupKey = "pending" | "approved" | "verified" | "rejected";

function groupForStatus(status: Clip["status"]): GroupKey {
  switch (status) {
    case "submitted":
      return "pending";
    case "approved":
    case "live":
      return "approved";
    case "verified":
    case "paid":
      return "verified";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

const GROUP_META: Record<
  GroupKey,
  { label: string; num: string; color: string; icon: any; description: string }
> = {
  pending: {
    num: "01",
    label: "Pending review",
    color: "#F59E0B",
    icon: Clock,
    description: "Submitted and waiting on the brand to approve.",
  },
  approved: {
    num: "02",
    label: "Approved / Live",
    color: "#10B981",
    icon: CheckCircle2,
    description: "Brand-approved. Views are accumulating.",
  },
  verified: {
    num: "03",
    label: "Verified",
    color: "#8B5CF6",
    icon: Film,
    description: "Verified by RelatiV. Payout processed on Monday.",
  },
  rejected: {
    num: "04",
    label: "Rejected",
    color: "#EF4444",
    icon: XCircle,
    description: "Did not pass review. See brand notes to retry.",
  },
};

const GROUP_ORDER: GroupKey[] = ["pending", "approved", "verified", "rejected"];

// ─── Section marker (matches the rest of the app) ─────────────────────────
function SectionMarker({
  num,
  label,
  subtitle,
}: {
  num: string;
  label: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span
        className="text-[10px] font-mono tracking-widest tabular-nums"
        style={{ color: "var(--color-text-faint)" }}
      >
        {num}
      </span>
      <h1
        className="font-display font-semibold text-2xl md:text-3xl tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {label}
      </h1>
      {subtitle && (
        <span
          className="text-[11px] font-mono ml-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ─── Skeleton block ───────────────────────────────────────────────────────
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)] ${className}`}
    />
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Clip["status"] }) {
  const group = groupForStatus(status);
  const meta = GROUP_META[group];
  return (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{
        background: `${meta.color}14`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {status.toUpperCase()}
    </span>
  );
}

// ─── Single clip card ─────────────────────────────────────────────────────
function ClipCard({ clip }: { clip: Clip }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card hover-glow rounded-[var(--radius-lg)] p-4 flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-mono tracking-widest mb-1.5"
            style={{ color: "var(--color-text-faint)" }}
          >
            {platformLabel(clip.platform).toUpperCase()} ·{" "}
            {(clip.campaign?.name || "Campaign").toUpperCase()}
          </div>
          <h3
            className="font-display font-semibold text-sm leading-snug line-clamp-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            {clip.title}
          </h3>
        </div>
        <StatusBadge status={clip.status} />
      </div>

      {clip.hook && (
        <p
          className="text-xs italic line-clamp-2 mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          &ldquo;{clip.hook}&rdquo;
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-3 mt-auto">
        <div>
          <div
            className="text-[10px] font-mono"
            style={{ color: "var(--color-text-faint)" }}
          >
            VIEWS
          </div>
          <div
            className="font-display font-semibold text-sm tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatViews(clip.views || 0)}
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
            className="font-display font-semibold text-sm tabular-nums"
            style={{ color: "#8B5CF6" }}
          >
            {formatCents(clip.earnings_cents || 0)}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono"
            style={{ color: "var(--color-text-faint)" }}
          >
            DURATION
          </div>
          <div
            className="font-display font-semibold text-sm tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {clip.duration_s ? `${clip.duration_s}s` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[color:var(--color-border)]">
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--color-text-faint)" }}
        >
          {formatRelative(clip.submitted_at || clip.approved_at || null)}
        </span>
        {clip.posted_url ? (
          <a
            href={clip.posted_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold transition-colors"
            style={{ color: "#8B5CF6" }}
          >
            View post <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--color-text-faint)" }}
          >
            No link yet
          </span>
        )}
      </div>

      {clip.status === "rejected" && clip.brand_notes && (
        <div
          className="mt-3 px-3 py-2 rounded-lg text-[11px]"
          style={{
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.20)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span
            className="font-mono font-semibold mr-1"
            style={{ color: "var(--color-error)" }}
          >
            Brand:
          </span>
          {clip.brand_notes}
        </div>
      )}
    </motion.article>
  );
}

// ─── Auth-guard wrapper (must wrap a useSearchParams consumer) ────────────
function ClipperClipsBody() {
  const { user, loading: authLoading } = useAuth();
  const search = useSearchParams();
  const justSubmitted = search.get("submitted") === "1";

  const [clips, setClips] = useState<Clip[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(justSubmitted);

  // Auto-dismiss the success toast after 4s
  useEffect(() => {
    if (!toastVisible) return;
    const t = setTimeout(() => setToastVisible(false), 4000);
    return () => clearTimeout(t);
  }, [toastVisible]);

  const load = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const res = await listMyClips();
      setClips(res.items || []);
    } catch (e: any) {
      setDataError(e?.message || "Failed to load your clips");
      setClips([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (user.role !== "clipper") return;
    load();
  }, [authLoading, user, load]);

  // ─── Group the clips (must be a hook, called before any early return) ──
  const grouped = useMemo(() => {
    const out: Record<GroupKey, Clip[]> = {
      pending: [],
      approved: [],
      verified: [],
      rejected: [],
    };
    for (const c of clips) out[groupForStatus(c.status)].push(c);
    return out;
  }, [clips]);

  // ─── Auth: still resolving ─────────────────────────────────────────────
  if (authLoading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32">
        <div
          className="inline-block h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
        />
      </section>
    );
  }

  // ─── Auth: not signed in ───────────────────────────────────────────────
  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "#8B5CF6" }} />
          <h1 className="font-display font-bold text-2xl mb-2">
            Sign in to continue
          </h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            Sign in to see your submitted clips, statuses, and earnings.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/login?next=/clippers/clips" className="btn-primary btn-shine">
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

  // ─── Auth: wrong role ──────────────────────────────────────────────────
  if (user.role !== "clipper") {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-md">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
            style={{
              background: "rgba(139, 92, 246, 0.10)",
              border: "1px solid rgba(139, 92, 246, 0.25)",
            }}
          >
            <Target className="h-6 w-6" style={{ color: "#8B5CF6" }} />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">
            Clipper accounts only
          </h1>
          <p
            className="text-sm mb-5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            This is the clipper clips board — your account is a{" "}
            <span className="font-mono text-[12px]">{user.role}</span>. Apply
            to join the network and start submitting clips.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/clippers/apply" className="btn-primary btn-shine">
              Apply as a clipper
            </Link>
            <Link
              href={
                user.role === "creator"
                  ? "/creators/dashboard"
                  : user.role === "brand"
                  ? "/brands/dashboard"
                  : "/account"
              }
              className="btn-secondary"
            >
              Go to my dashboard
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Derived counts (pure, no hooks needed) ────────────────────────────
  const grouped2 = grouped;

  const isFirstLoad = dataLoading && !clips.length && !dataError;
  const isError = !dataLoading && !!dataError && !clips.length;
  const isEmpty = !dataLoading && !dataError && clips.length === 0;
  const lifetimeEarnings = clips.reduce(
    (acc, c) => acc + (c.earnings_cents || 0),
    0
  );
  const liveCount = grouped.approved.length + grouped.verified.length;

  return (
    <section className="relative pt-28 md:pt-32 pb-20 px-4 md:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-0 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.20) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 left-1/4 h-[350px] w-[350px] rounded-full blur-3xl opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Success toast (shown when ?submitted=1) */}
        <AnimatePresence>
          {toastVisible && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="mb-6 flex items-start gap-3 p-4 rounded-2xl border"
              style={{
                background: "rgba(16, 185, 129, 0.06)",
                borderColor: "rgba(16, 185, 129, 0.30)",
              }}
            >
              <CheckCircle2
                className="h-5 w-5 mt-0.5 shrink-0"
                style={{ color: "#10B981" }}
              />
              <div className="flex-1 text-sm">
                <p
                  className="font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Clip submitted for review
                </p>
                <p style={{ color: "var(--color-text-secondary)" }}>
                  The brand has 48 hours to approve. You&apos;ll get an email
                  the moment they do.
                </p>
              </div>
              <button
                onClick={() => setToastVisible(false)}
                className="text-xs font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <SectionMarker
              num="01"
              label="My clips"
              subtitle={
                !isFirstLoad
                  ? `${clips.length} total · ${liveCount} earning · ${formatCents(
                      lifetimeEarnings
                    )} lifetime`
                  : undefined
              }
            />
            <p
              className="text-sm md:text-base max-w-2xl mt-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <span className="font-serif italic" style={{ color: "var(--color-text-primary)" }}>
                Every clip you&apos;ve posted,
              </span>{" "}
              grouped by lifecycle stage. Click through to view the live post.
            </p>
          </div>
          <Link
            href="/clippers/campaigns"
            className="btn-shine inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5 shrink-0"
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.30)",
            }}
          >
            Browse campaigns <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* ─── LOADING ──────────────────────────────────────────────── */}
        {isFirstLoad && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} className="h-44" />
            ))}
          </div>
        )}

        {/* ─── ERROR ────────────────────────────────────────────────── */}
        {isError && (
          <div
            className="flex items-start gap-3 p-5 rounded-2xl border"
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              borderColor: "rgba(239, 68, 68, 0.30)",
            }}
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
            <div className="flex-1 text-sm">
              <p
                className="font-semibold mb-0.5"
                style={{ color: "var(--color-text-primary)" }}
              >
                Couldn&apos;t load your clips
              </p>
              <p style={{ color: "var(--color-text-secondary)" }}>{dataError}</p>
              <button
                onClick={load}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                style={{ color: "#8B5CF6" }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          </div>
        )}

        {/* ─── EMPTY ────────────────────────────────────────────────── */}
        {isEmpty && (
          <div
            className="glass-card p-10 text-center"
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
              <Inbox className="h-6 w-6" style={{ color: "#8B5CF6" }} />
            </div>
            <h3
              className="font-display font-semibold text-lg mb-1"
              style={{ color: "var(--color-text-primary)" }}
            >
              No clips submitted yet
            </h3>
            <p
              className="text-sm max-w-md mx-auto mb-5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Claim a campaign, post your first 30-second hook, and your
              earnings start the moment the brand approves.
            </p>
            <Link
              href="/clippers/campaigns"
              className="btn-shine inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                boxShadow: "0 6px 18px rgba(139, 92, 246, 0.35)",
              }}
            >
              Browse open campaigns <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ─── LOADED: groups ──────────────────────────────────────── */}
        {!isFirstLoad && !isError && !isEmpty && (
          <div className="space-y-10">
            {GROUP_ORDER.map((key) => {
              const list = grouped[key];
              if (list.length === 0) return null;
              const meta = GROUP_META[key];
              const Icon = meta.icon;
              return (
                <section key={key}>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="text-[10px] font-mono tracking-widest tabular-nums"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      {meta.num}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono"
                      style={{
                        background: `${meta.color}14`,
                        color: meta.color,
                        border: `1px solid ${meta.color}40`,
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {list.length}
                    </span>
                    <h2
                      className="font-display font-semibold text-lg"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {meta.label}
                    </h2>
                    <span
                      className="text-[11px] hidden sm:inline"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      · {meta.description}
                    </span>
                  </div>
                  <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  >
                    <AnimatePresence mode="popLayout">
                      {list.map((c) => (
                        <ClipCard key={c.id} clip={c} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Suspense-wrapped default export (Next 16 requires a Suspense boundary
//     around any component that calls useSearchParams) ──────────────────
export default function ClipperClipsPage() {
  return (
    <Suspense fallback={null}>
      <ClipperClipsBody />
    </Suspense>
  );
}
