"use client";

/**
 * /brands/campaigns — Brand-side campaign management table.
 *
 * The list of every campaign the signed-in brand has created, with status
 * filter tabs (All / Live / Paused / Completed / Cancelled), KPI summary,
 * a "Create Campaign" CTA, and a row of stat-pills per campaign.
 *
 * v1: Wired to the marketplace backend at /api/v1/campaigns?mine=true
 * (lib/api.listCampaigns). Each row links through to /brands/campaigns/[id]
 * which is implemented in /app/brands/campaigns/[id]/page.tsx.
 *
 * Sections:
 *  01 · Header         — page title, subtitle, primary "Create" CTA
 *  02 · KPI strip      — 4 totals pulled from the same dataset
 *  03 · Filter tabs    — All / Live / Paused / Completed / Cancelled
 *  04 · Campaigns table — sortable cards with all key fields
 *
 * Visual language matches /brands/dashboard (cream glass, fuchsia-violet
 * gradients, monospace section numbers, Instrument Serif italic accents).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowRight,
  Eye,
  RefreshCcw,
  AlertCircle,
  LogIn,
  Briefcase,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  listCampaigns,
  type Campaign,
  type CampaignStatus,
} from "@/lib/api";

// ─── Status palette ──────────────────────────────────────────────────────
// Same colour tokens used in /brands/dashboard. Kept local so a tweak in
// this file doesn't ripple through other surfaces; values still resolve to
// the cream-glass token set.

const STATUS_STYLES: Record<
  CampaignStatus,
  { bg: string; text: string; ring: string; label: string }
> = {
  draft: {
    bg: "rgba(184, 178, 160, 0.10)",
    text: "var(--color-text-faint)",
    ring: "rgba(60, 50, 30, 0.08)",
    label: "DRAFT",
  },
  live: {
    bg: "rgba(16, 185, 129, 0.15)",
    text: "var(--color-success)",
    ring: "rgba(16, 185, 129, 0.35)",
    label: "LIVE",
  },
  paused: {
    bg: "rgba(184, 178, 160, 0.15)",
    text: "var(--color-text-faint)",
    ring: "rgba(60, 50, 30, 0.10)",
    label: "PAUSED",
  },
  completed: {
    bg: "rgba(139, 132, 114, 0.15)",
    text: "var(--color-text-muted)",
    ring: "rgba(60, 50, 30, 0.12)",
    label: "DONE",
  },
  cancelled: {
    bg: "rgba(239, 68, 68, 0.10)",
    text: "var(--color-error)",
    ring: "rgba(239, 68, 68, 0.25)",
    label: "CANCELLED",
  },
};

function normalizeStatus(s: string | null | undefined): CampaignStatus {
  if (s === "live" || s === "paused" || s === "completed" || s === "cancelled" || s === "draft") {
    return s;
  }
  return "paused";
}

// ─── Formatters (shared with /brands/dashboard) ──────────────────────────

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 10_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

function formatCpm(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Filter tabs ─────────────────────────────────────────────────────────

type FilterKey = "all" | CampaignStatus;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

// ─── Section marker — monospace "01 · LABEL" ─────────────────────────────

function SectionMarker({
  num,
  label,
  hint,
}: {
  num: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span
        className="text-[10px] font-mono tracking-widest tabular-nums"
        style={{ color: "var(--color-text-faint)" }}
      >
        {num}
      </span>
      <span
        className="h-px w-10"
        style={{ background: "var(--color-border-strong)" }}
      />
      <h2
        className="font-display font-semibold text-lg"
        style={{ color: "var(--color-text-primary)" }}
      >
        {label}
      </h2>
      {hint && (
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--color-text-faint)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export default function BrandsCampaignsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const reload = () => {
    if (!user || user.role !== "brand") return;
    setLoading(true);
    setError(null);
    listCampaigns({ mine: true })
      .then((res) => setItems(res.items ?? []))
      .catch((e) => setError(e?.message || "Failed to load campaigns"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading || !user || user.role !== "brand") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCampaigns({ mine: true })
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load campaigns");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // Derive counts per status for the filter pills
  const counts = useMemo(() => {
    const out: Record<FilterKey, number> = {
      all: items.length,
      live: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
      draft: 0,
    };
    for (const c of items) {
      const s = normalizeStatus(c.status);
      if (s in out) out[s as FilterKey] += 1;
    }
    return out;
  }, [items]);

  // Apply the active filter + free-text search
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== "all" && normalizeStatus(c.status) !== filter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, search]);

  // KPI numbers
  const kpis = useMemo(() => {
    const totalSpent = items.reduce((s, c) => s + (c.spent_cents ?? 0), 0);
    const totalSlotsFilled = items.reduce((s, c) => s + (c.slots_filled ?? 0), 0);
    const active = counts.live;
    const completed = counts.completed;
    return { totalSpent, totalSlotsFilled, active, completed };
  }, [items, counts]);

  // ─── Auth states ─────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-accent)", borderTopColor: "transparent" }}
        />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-24">
        <div className="text-center max-w-sm">
          <LogIn className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <h1 className="font-display font-semibold text-2xl mb-2">Sign in to continue</h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            You need a RelatiV account to manage your brand campaigns.
          </p>
          <Link
            href={`/signup?next=${encodeURIComponent("/brands/campaigns")}`}
            className="btn-primary btn-shine inline-flex"
          >
            Create account
          </Link>
        </div>
      </section>
    );
  }

  if (user.role !== "brand") {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-4 pt-24">
        <div
          className="glass-card p-10 text-center max-w-md"
          style={{ borderStyle: "dashed" }}
        >
          <AlertCircle
            className="h-8 w-8 mx-auto mb-3"
            style={{ color: "var(--color-accent-coral, #FB7185)" }}
          />
          <h1 className="font-display font-semibold text-2xl mb-2">
            Brand accounts only
          </h1>
          <p
            className="text-sm max-w-sm mx-auto mb-5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            The campaigns page is only available for brand accounts. Your
            current role is{" "}
            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(60,50,30,0.06)" }}>
              {user.role}
            </span>
            .
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href={
                user.role === "creator"
                  ? "/creators/dashboard"
                  : user.role === "clipper"
                  ? "/clippers/dashboard"
                  : "/account"
              }
              className="btn-glass inline-flex"
            >
              Go to my dashboard
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent("/brands/campaigns")}&role=brand`}
              className="btn-primary btn-shine inline-flex"
            >
              Create brand account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Loaded view ─────────────────────────────────────────────────────

  return (
    <section
      className="relative min-h-screen pt-28 pb-20 px-4 md:px-6 animate-page-enter"
    >
      {/* Background orbs — match the dashboard's gradient treatment */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 -right-20 h-[600px] w-[600px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -left-20 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* ─── 01 · HEADER ─── */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: "var(--color-accent)" }}
            />
            <span
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "var(--color-accent)" }}
            >
              Brand workspace
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1
                className="font-display font-semibold text-3xl md:text-5xl tracking-tight leading-[1.05]"
                style={{ color: "var(--color-text-primary)" }}
              >
                Your{" "}
                <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.05em" }}>
                  campaigns
                </span>
                .
              </h1>
              <p
                className="mt-2 text-[15px] max-w-xl"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Brief, monitor, and pay for clips. Pause or resume any campaign,
                review the queue, and ship more content.
              </p>
            </div>
            <button
              onClick={() => router.push("/brands/campaigns/new")}
              className="btn-primary btn-shine inline-flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <Plus className="h-4 w-4" />
              Create campaign
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ─── 02 · KPI STRIP ─── */}
        <SectionMarker num="02" label="At a glance" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          <KpiTile
            label="Active"
            value={String(kpis.active)}
            sub="live right now"
            tone="success"
          />
          <KpiTile
            label="Total spent"
            value={formatDollars(kpis.totalSpent)}
            sub="across all campaigns"
            tone="accent"
          />
          <KpiTile
            label="Slots filled"
            value={kpis.totalSlotsFilled.toLocaleString()}
            sub="verified claims"
            tone="violet"
          />
          <KpiTile
            label="Completed"
            value={String(kpis.completed)}
            sub="lifetime"
            tone="default"
          />
        </div>

        {/* ─── 03 · FILTER BAR ─── */}
        <SectionMarker num="03" label="Filter" hint={`${visible.length} shown`} />
        <div
          className="glass-card p-4 mb-6 flex flex-col lg:flex-row lg:items-center gap-4"
        >
          <div className="flex flex-wrap gap-1.5 flex-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count = counts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all inline-flex items-center gap-2"
                  style={{
                    background: active
                      ? "rgba(217, 70, 239, 0.10)"
                      : "rgba(40, 30, 15, 0.02)",
                    borderColor: active
                      ? "rgba(217, 70, 239, 0.35)"
                      : "rgba(60, 50, 30, 0.08)",
                    color: active
                      ? "var(--color-accent)"
                      : "var(--color-text-secondary)",
                  }}
                >
                  {f.label}
                  <span
                    className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
                    style={{
                      background: active
                        ? "rgba(217, 70, 239, 0.18)"
                        : "rgba(60, 50, 30, 0.06)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full lg:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: "var(--color-text-faint)" }}
            />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-glass"
              style={{ paddingLeft: "36px", fontSize: "13px" }}
            />
          </div>
        </div>

        {/* ─── 04 · TABLE ─── */}
        <SectionMarker num="04" label="Campaigns" />
        {loading && items.length === 0 ? (
          <TableSkeleton />
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            filtered={items.length > 0}
            onCreate={() => router.push("/brands/campaigns/new")}
            onClearFilter={() => {
              setFilter("all");
              setSearch("");
            }}
          />
        ) : (
          <CampaignsTable campaigns={visible} />
        )}
      </div>
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

type Tone = "default" | "accent" | "violet" | "success";

const TONE_COLOR: Record<Tone, string> = {
  default: "var(--color-text-primary)",
  accent: "var(--color-accent)",
  violet: "#8B5CF6",
  success: "var(--color-success)",
};

const TONE_RING: Record<Tone, string> = {
  default: "rgba(60, 50, 30, 0.10)",
  accent: "rgba(217, 70, 239, 0.30)",
  violet: "rgba(139, 92, 246, 0.30)",
  success: "rgba(16, 185, 129, 0.30)",
};

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] p-4 transition-all duration-300"
      style={{
        background: "rgba(255, 252, 242, 0.65)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${TONE_RING[tone]}`,
        boxShadow: "0 8px 24px rgba(140, 110, 60, 0.06)",
      }}
    >
      <div
        className="text-[10px] font-mono tracking-widest uppercase mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      <div
        className="font-display font-semibold text-2xl md:text-3xl tabular-nums"
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </div>
      <div
        className="text-[10px] font-mono mt-1"
        style={{ color: "var(--color-text-faint)" }}
      >
        {sub}
      </div>
    </div>
  );
}

function CampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div
      className="glass-card overflow-hidden"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      {/* Header row */}
      <div
        className="hidden md:grid grid-cols-[1.6fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_0.5fr] gap-3 px-5 py-3 text-[10px] font-mono tracking-widest"
        style={{
          borderBottom: "1px solid rgba(60, 50, 30, 0.08)",
          color: "var(--color-text-faint)",
        }}
      >
        <div>NAME</div>
        <div>STATUS</div>
        <div>SLOTS</div>
        <div>CPM</div>
        <div>BUDGET</div>
        <div>CREATED</div>
        <div className="text-right">VIEW</div>
      </div>

      <AnimatePresence initial={false}>
        {campaigns.map((c, idx) => (
          <CampaignRow key={c.id} campaign={c} index={idx} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function CampaignRow({ campaign, index }: { campaign: Campaign; index: number }) {
  const status = STATUS_STYLES[normalizeStatus(campaign.status)];
  const slotsPct =
    campaign.slots_total > 0
      ? Math.min(100, (campaign.slots_filled / campaign.slots_total) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, delay: index * 0.025 }}
      className="grid grid-cols-1 md:grid-cols-[1.6fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_0.5fr] gap-3 px-5 py-4 items-center transition-colors"
      style={{
        borderBottom: "1px solid rgba(60, 50, 30, 0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 252, 242, 0.6)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Name + vertical */}
      <div className="min-w-0">
        <div
          className="text-[10px] font-mono tracking-widest mb-0.5 truncate"
          style={{ color: "var(--color-text-faint)" }}
        >
          {(campaign.vertical || "—").toUpperCase()}
        </div>
        <Link
          href={`/brands/campaigns/${campaign.id}`}
          className="font-display font-semibold text-[15px] truncate block hover:underline"
          style={{ color: "var(--color-text-primary)" }}
        >
          {campaign.name}
        </Link>
      </div>

      {/* Status badge */}
      <div>
        <span
          className="inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{
            background: status.bg,
            color: status.text,
            borderColor: status.ring,
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Slots filled / total with progress */}
      <div>
        <div
          className="text-sm font-mono tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          {campaign.slots_filled}
          <span style={{ color: "var(--color-text-faint)" }}>
            {" "}/ {campaign.slots_total}
          </span>
        </div>
        <div
          className="mt-1 h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(60, 50, 30, 0.08)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${slotsPct}%` }}
            transition={{ duration: 0.5, delay: index * 0.025 }}
            className="h-full rounded-full"
            style={{
              background: "var(--gradient-sunset)",
            }}
          />
        </div>
      </div>

      {/* CPM */}
      <div
        className="text-sm font-mono tabular-nums"
        style={{ color: "var(--color-accent)" }}
      >
        {formatCpm(campaign.cpm_cents)}
      </div>

      {/* Budget */}
      <div
        className="text-sm font-mono tabular-nums"
        style={{ color: "var(--color-text-primary)" }}
      >
        {formatDollars(campaign.budget_cents)}
      </div>

      {/* Created date */}
      <div
        className="text-[11px] font-mono tabular-nums"
        style={{ color: "var(--color-text-muted)" }}
      >
        {formatShortDate(campaign.created_at)}
      </div>

      {/* View link */}
      <div className="md:text-right">
        <Link
          href={`/brands/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors"
          style={{
            background: "rgba(255, 252, 242, 0.65)",
            borderColor: "rgba(60, 50, 30, 0.10)",
            color: "var(--color-text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-accent)";
            e.currentTarget.style.borderColor = "rgba(217, 70, 239, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-text-secondary)";
            e.currentTarget.style.borderColor = "rgba(60, 50, 30, 0.10)";
          }}
        >
          <Eye className="h-3 w-3" />
          View
        </Link>
      </div>
    </motion.div>
  );
}

function TableSkeleton() {
  return (
    <div
      className="glass-card overflow-hidden"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1.6fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_0.5fr] gap-3 items-center"
          style={{ borderBottom: "1px solid rgba(60, 50, 30, 0.06)" }}
        >
          <div
            className="h-5 w-3/4 rounded animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div
            className="h-5 w-16 rounded-full animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div
            className="h-5 w-20 rounded animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div
            className="h-5 w-12 rounded animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div
            className="h-5 w-16 rounded animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div
            className="h-5 w-20 rounded animate-pulse"
            style={{ background: "rgba(60, 50, 30, 0.08)" }}
          />
          <div className="md:text-right">
            <div
              className="h-7 w-16 ml-auto rounded-full animate-pulse"
              style={{ background: "rgba(60, 50, 30, 0.08)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass-card p-10 text-center" style={{ borderStyle: "dashed" }}>
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
        Couldn&apos;t load your campaigns
      </h3>
      <p
        className="text-sm max-w-md mx-auto mb-5"
        style={{ color: "var(--color-text-muted)" }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        className="btn-shine btn-primary inline-flex items-center gap-2 text-xs font-mono"
        style={{ padding: "10px 20px", fontSize: "12px" }}
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  );
}

function EmptyState({
  filtered,
  onCreate,
  onClearFilter,
}: {
  filtered: boolean;
  onCreate: () => void;
  onClearFilter: () => void;
}) {
  return (
    <div
      className="glass-card p-12 text-center"
      style={{ borderStyle: "dashed" }}
    >
      <Briefcase
        className="h-10 w-10 mx-auto mb-4 opacity-50"
        style={{ color: "var(--color-text-faint)" }}
      />
      <h3
        className="font-display font-semibold text-xl mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        {filtered ? "No campaigns match that filter" : "Create your first campaign"}
      </h3>
      <p
        className="text-sm max-w-md mx-auto mb-6"
        style={{ color: "var(--color-text-muted)" }}
      >
        {filtered
          ? "Try a different status, or clear the search to see everything."
          : "Drop a brief, set your CPM and budget, and our clipper network will start delivering platform-ready clips within 48 hours."}
      </p>
      {filtered ? (
        <button onClick={onClearFilter} className="btn-glass inline-flex">
          Clear filters
        </button>
      ) : (
        <button
          onClick={onCreate}
          className="btn-primary btn-shine inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create your first campaign
        </button>
      )}
    </div>
  );
}
