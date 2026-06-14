"use client";

/**
 * /clippers/campaigns — Open (live) campaign board for clippers.
 *
 *  - Lists every campaign with status="live" the clipper can claim
 *  - Each card shows: name, vertical, brief excerpt, CPM, slots remaining
 *  - "Claim slot" button (primary gradient); when already claimed by this
 *    user, it disables and reveals a "Submit clip" link to the new-clip
 *    form pre-bound to that claim id
 *  - Filter chips: All · High CPM ($10+) · Tech · Health · Business · Closing soon
 *  - Auth-guard via useAuth(): loading / not-signed-in / wrong-role handled
 *  - Three live-data states: loading (skeleton) / error (retry) / empty (CTA)
 *  - Everything flows through @/lib/api helpers — no direct fetches
 *
 * Aesthetic: cream glass, fuchsia→violet primary buttons, monospace
 * section labels, Instrument Serif accents. Mirrors the clipper dashboard.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Filter,
  Inbox,
  LogIn,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  claimSlot,
  listCampaigns,
  myClaims,
  type Campaign,
  type Claim,
} from "@/lib/api";

// The marketplace /api/v1/campaigns endpoint actually returns the
// `premium` flag (and we render it as a gold sweep on the card). The base
// `Campaign` type in @/lib/api doesn't declare it — that field is only
// on `ClipperOpenCampaign` (used by the dashboard). This local extension
// is the honest representation of what the backend ships.
type OpenCampaign = Campaign & { premium?: boolean };

// ─── Filter definitions ───────────────────────────────────────────────────
// "High CPM" is a hard $10 threshold (the chip label says $10+).
// Vertical chips match by case-insensitive substring — the backend
// stores vertical as free text (e.g. "Podcasts · Tech", "D2C · Health").
type FilterKey =
  | "all"
  | "high_cpm"
  | "tech"
  | "health"
  | "business"
  | "closing_soon";

const FILTERS: { key: FilterKey; label: string; icon?: any }[] = [
  { key: "all", label: "All" },
  { key: "high_cpm", label: "High CPM ($10+)", icon: TrendingUp },
  { key: "tech", label: "Tech" },
  { key: "health", label: "Health" },
  { key: "business", label: "Business" },
  { key: "closing_soon", label: "Closing soon", icon: Clock },
];

// ─── Display helpers ──────────────────────────────────────────────────────
function formatCents(cents: number): string {
  if (!cents || cents <= 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatSlots(c: Campaign): string {
  const rem = Math.max(0, c.slots_remaining ?? Math.max(0, c.slots_total - c.slots_filled));
  return `${rem} of ${c.slots_total} open`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "Rolling";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Rolling";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function verticalMatches(vertical: string | null, needle: string): boolean {
  if (!vertical) return false;
  return vertical.toLowerCase().includes(needle);
}

// ─── Skeleton block (cream glass placeholder while loading) ───────────────
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[color:var(--color-surface)]/60 animate-pulse border border-[color:var(--color-border)] ${className}`}
    />
  );
}

// ─── Section marker (matches the rest of the app: 01 · LABEL) ─────────────
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

// ─── Single campaign card ─────────────────────────────────────────────────
function CampaignCard({
  campaign,
  claim,
  onClaim,
  claiming,
}: {
  campaign: OpenCampaign;
  claim: Claim | null;
  onClaim: (id: string) => void;
  claiming: boolean;
}) {
  const cpmDollars = campaign.cpm_cents / 100;
  const slotsLeft = Math.max(
    0,
    campaign.slots_remaining ?? Math.max(0, campaign.slots_total - campaign.slots_filled)
  );
  const pct =
    campaign.slots_total > 0
      ? (campaign.slots_filled / campaign.slots_total) * 100
      : 0;
  const dLeft = daysUntil(campaign.ends_at);
  const isClosing = dLeft !== null && dLeft <= 7 && dLeft >= 0;
  const isFull = slotsLeft === 0;
  const alreadyClaimed = !!claim;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="glass-card hover-glow rounded-[var(--radius-lg)] p-5 flex flex-col relative overflow-hidden"
    >
      {/* Premium top edge — gold sweep on premium campaigns */}
      {campaign.premium && (
        <div
          className="absolute -top-px left-0 right-0 h-1"
          style={{
            background: "linear-gradient(135deg, #FBBF24 0%, #FB923C 100%)",
          }}
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {(campaign.vertical || "General").toUpperCase()}
            </span>
            {campaign.premium && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{
                  background: "rgba(251, 191, 36, 0.10)",
                  color: "#B45309",
                  border: "1px solid rgba(251, 191, 36, 0.25)",
                }}
              >
                <Sparkles className="h-2.5 w-2.5" /> Premium
              </span>
            )}
            {isClosing && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "var(--color-error)",
                  border: "1px solid rgba(239, 68, 68, 0.22)",
                }}
              >
                <Zap className="h-2.5 w-2.5" /> Closing
              </span>
            )}
          </div>
          <h3
            className="font-display font-semibold text-base leading-snug"
            style={{ color: "var(--color-text-primary)" }}
          >
            {campaign.name}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div
            className="font-display font-semibold text-xl tabular-nums leading-none"
            style={{ color: "#8B5CF6" }}
          >
            {formatCents(campaign.cpm_cents)}
          </div>
          <div
            className="text-[10px] font-mono mt-1"
            style={{ color: "var(--color-text-faint)" }}
          >
            PER 1K VIEWS
          </div>
        </div>
      </div>

      <p
        className="text-xs leading-relaxed line-clamp-3 mb-4"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {campaign.brief}
      </p>

      {/* Slot progress */}
      <div className="mb-4">
        <div
          className="flex items-center justify-between text-[10px] font-mono mb-1.5 tabular-nums"
          style={{ color: "var(--color-text-faint)" }}
        >
          <span>{formatSlots(campaign)}</span>
          <span>
            {campaign.ends_at ? `Closes ${formatDeadline(campaign.ends_at)}` : "Rolling intake"}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(60, 50, 30, 0.08)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, pct)}%`,
              background: "linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%)",
              boxShadow: "0 0 8px rgba(139, 92, 246, 0.45)",
              transition: "width 0.6s ease-out",
            }}
          />
        </div>
      </div>

      {/* CTA row */}
      <div className="mt-auto flex items-center gap-2">
        {alreadyClaimed ? (
          <>
            <button
              disabled
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-full border cursor-not-allowed"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                borderColor: "rgba(16, 185, 129, 0.30)",
                color: "var(--color-success)",
              }}
            >
              ✓ Already claimed
            </button>
            <Link
              href={`/clippers/clips/new?claim_id=${claim!.id}`}
              className="btn-shine inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.30)",
              }}
            >
              Submit clip <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        ) : isFull ? (
          <button
            disabled
            className="w-full px-4 py-2.5 text-sm font-semibold rounded-full border cursor-not-allowed"
            style={{
              background: "rgba(60, 50, 30, 0.04)",
              borderColor: "rgba(60, 50, 30, 0.12)",
              color: "var(--color-text-muted)",
            }}
          >
            All slots filled
          </button>
        ) : (
          <button
            onClick={() => onClaim(campaign.id)}
            disabled={claiming}
            className="btn-shine flex-1 px-4 py-2.5 text-sm font-semibold rounded-full text-text-primary transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0"
            style={{
              background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.30)",
            }}
          >
            {claiming ? "Claiming…" : `Claim slot · ${formatCents(campaign.cpm_cents)} CPM`}
          </button>
        )}
      </div>
    </motion.article>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────
function FilterChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: any;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all"
      style={{
        background: active ? "rgba(139, 92, 246, 0.10)" : "rgba(255, 252, 242, 0.55)",
        borderColor: active ? "rgba(139, 92, 246, 0.40)" : "rgba(60, 50, 30, 0.10)",
        color: active ? "#8B5CF6" : "var(--color-text-secondary)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: active ? "0 2px 8px rgba(139, 92, 246, 0.15)" : undefined,
      }}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
function ClipperCampaignsPageInner() {
  const { user, loading: authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<OpenCampaign[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      // Fetch live campaigns and the clipper's own claims in parallel so
      // we can mark cards as "Already claimed" without a second round-trip.
      const [cRes, clRes] = await Promise.all([
        listCampaigns({ status: "live" }),
        myClaims().catch(() => ({ items: [], total: 0 })),
      ]);
      setCampaigns((cRes.items || []) as OpenCampaign[]);
      setClaims(clRes.items || []);
    } catch (e: any) {
      setDataError(e?.message || "Failed to load campaigns");
      setCampaigns([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (user.role !== "clipper") return; // role-mismatch handled below
    load();
  }, [authLoading, user, load]);

  // ─── Build a claim → campaign lookup once ──────────────────────────────
  const claimByCampaignId = useMemo(() => {
    const map = new Map<string, Claim>();
    for (const c of claims) {
      // Only "open" claims block re-claiming; submitted/approved claims
      // also satisfy the "already claimed" UI so the clipper sees the
      // submit-clip CTA.
      map.set(c.campaign_id, c);
    }
    return map;
  }, [claims]);

  // ─── Apply the active filter ───────────────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    if (filter === "all") return campaigns;
    if (filter === "high_cpm") return campaigns.filter((c) => c.cpm_cents >= 1000);
    if (filter === "tech") return campaigns.filter((c) => verticalMatches(c.vertical, "tech"));
    if (filter === "health") return campaigns.filter((c) => verticalMatches(c.vertical, "health"));
    if (filter === "business")
      return campaigns.filter((c) => verticalMatches(c.vertical, "business"));
    if (filter === "closing_soon")
      return campaigns.filter((c) => {
        const d = daysUntil(c.ends_at);
        return d !== null && d <= 7 && d >= 0;
      });
    return campaigns;
  }, [campaigns, filter]);

  // ─── Auth: still resolving ─────────────────────────────────────────────
  if (authLoading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32">
        <div className="text-center">
          <div
            className="inline-block h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
          />
        </div>
      </section>
    );
  }

  // ─── Auth: not signed in ───────────────────────────────────────────────
  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32 pb-16">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "#8B5CF6" }} />
          <h1 className="font-display font-bold text-2xl mb-2">Sign in to continue</h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            The campaign board is for Pro/Elite clippers. Sign in or apply below.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/login?next=/clippers/campaigns"
              className="btn-primary btn-shine"
            >
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
            This is the clipper campaign board — your account is a{" "}
            <span className="font-mono text-[12px]">{user.role}</span>. Apply
            to join the clipper network and earn per 1K views.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/clippers/apply"
              className="btn-primary btn-shine"
            >
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

  // ─── Claim handler ─────────────────────────────────────────────────────
  const handleClaim = async (campaignId: string) => {
    setClaimError(null);
    setClaimingId(campaignId);
    try {
      const claim = await claimSlot(campaignId);
      // Optimistically add the new claim so the card flips immediately.
      setClaims((prev) => {
        if (prev.some((c) => c.id === claim.id)) return prev;
        return [...prev, claim];
      });
      // Refresh campaign slot counts in the background (fire and forget)
      listCampaigns({ status: "live" })
        .then((r) => setCampaigns(r.items || []))
        .catch(() => {});
    } catch (e: any) {
      setClaimError(e?.message || "Could not claim this slot");
    } finally {
      setClaimingId(null);
    }
  };

  // (moved useMemos above the early returns — Rules of Hooks compliance)

  // ─── Live-state flags ──────────────────────────────────────────────────
  const isFirstLoad = dataLoading && !campaigns.length && !dataError;
  const isError = !dataLoading && !!dataError && !campaigns.length;
  const isEmpty = !dataLoading && !dataError && !!campaigns.length === false;
  // (campaigns.length === 0 with no error means the marketplace has no live drops)

  return (
    <section className="relative pt-28 md:pt-32 pb-20 px-4 md:px-6">
      {/* Ambient glows — match the rest of the cream-glass pages */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.20) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-40 right-1/4 h-[350px] w-[350px] rounded-full blur-3xl opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <SectionMarker
            num="01"
            label="Open campaigns"
            subtitle={
              !isFirstLoad
                ? `${filteredCampaigns.length} live · ${claims.length} claimed by you`
                : undefined
            }
          />
          <p
            className="text-sm md:text-base max-w-2xl mt-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span className="font-serif italic" style={{ color: "var(--color-text-primary)" }}>
              Pick a brief,
            </span>{" "}
            claim a slot, post your clip, get paid per 1K verified views. Payouts
            every Monday.
          </p>
        </div>

        {/* Inline claim-error toast (e.g. "slot already taken") */}
        <AnimatePresence>
          {claimError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 flex items-start gap-3 p-4 rounded-2xl border"
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
                  Couldn&apos;t claim that slot
                </p>
                <p style={{ color: "var(--color-text-secondary)" }}>{claimError}</p>
              </div>
              <button
                onClick={() => setClaimError(null)}
                className="text-xs font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter chips */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--color-text-muted)" }}
            >
              Filter
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
                label={f.label}
                icon={f.icon}
              />
            ))}
          </div>
        </div>

        {/* ─── LOADING ───────────────────────────────────────────────── */}
        {isFirstLoad && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} className="h-64" />
            ))}
          </div>
        )}

        {/* ─── ERROR ─────────────────────────────────────────────────── */}
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
                Couldn&apos;t load the campaign board
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

        {/* ─── EMPTY (no live campaigns at all) ────────────────────── */}
        {!isFirstLoad && !isError && campaigns.length === 0 && (
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
              No open campaigns right now
            </h3>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "var(--color-text-muted)" }}
            >
              New drops land every week. Check back soon — or get notified the
              moment something matches your verticals.
            </p>
          </div>
        )}

        {/* ─── EMPTY (filter produced no results) ──────────────────── */}
        {!isFirstLoad &&
          !isError &&
          campaigns.length > 0 &&
          filteredCampaigns.length === 0 && (
            <div
              className="rounded-2xl border border-dashed p-8 text-center"
              style={{
                background: "rgba(255, 252, 242, 0.4)",
                borderColor: "rgba(60, 50, 30, 0.15)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No campaigns match{" "}
                <span className="font-mono">
                  &ldquo;{FILTERS.find((f) => f.key === filter)?.label}&rdquo;
                </span>
                . Try a different filter.
              </p>
              <button
                onClick={() => setFilter("all")}
                className="mt-3 text-xs font-mono"
                style={{ color: "#8B5CF6" }}
              >
                Show all campaigns →
              </button>
            </div>
          )}

        {/* ─── LOADED ──────────────────────────────────────────────── */}
        {!isFirstLoad && !isError && filteredCampaigns.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  claim={claimByCampaignId.get(c.id) || null}
                  onClaim={handleClaim}
                  claiming={claimingId === c.id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Footer helper line */}
        {!isFirstLoad && !isError && filteredCampaigns.length > 0 && (
          <p
            className="text-center text-[11px] font-mono mt-10"
            style={{ color: "var(--color-text-faint)" }}
          >
            Showing {filteredCampaigns.length} of {campaigns.length} live · refreshes
            every 60s
          </p>
        )}
      </div>
    </section>
  );
}

// Next.js 16 requires `useSearchParams` consumers to be wrapped in <Suspense>
export default function ClipperCampaignsPage() {
  return (
    <Suspense fallback={
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-32">
        <div className="text-center">
          <div className="inline-block h-6 w-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }} />
        </div>
      </section>
    }>
      <ClipperCampaignsPageInner />
    </Suspense>
  );
}
