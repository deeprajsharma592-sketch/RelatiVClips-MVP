"use client";

/**
 * /brands/campaigns/[id] — Brand campaign detail.
 *
 * Tabs: Overview · Claimants · Clips · Pending review
 * Each section pulls its own data via @/lib/api helpers.
 */

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Pause,
  Play,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import {
  approveClip,
  cancelCampaign,
  getCampaign,
  listCampaignClaims,
  listCampaignClips,
  listPendingReview,
  pauseCampaign,
  rejectClip,
  resumeCampaign,
  type Campaign,
  type Claim,
  type Clip,
} from "@/lib/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const STATUS_BADGE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  draft: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", label: "Draft" },
  live: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300", label: "Live" },
  paused: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300", label: "Paused" },
  completed: { bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-300", label: "Completed" },
  cancelled: { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-300", label: "Cancelled" },
};

const CLIP_STATUS_BADGE: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  submitted: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-300", label: "Pending review" },
  approved: { bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-300", label: "Approved" },
  live: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300", label: "Live" },
  verified: { bg: "bg-violet-100", text: "text-violet-800", ring: "ring-violet-300", label: "Verified" },
  paid: { bg: "bg-fuchsia-100", text: "text-fuchsia-800", ring: "ring-fuchsia-300", label: "Paid" },
  rejected: { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-300", label: "Rejected" },
};

// ─── Page ──────────────────────────────────────────────────────────────────

function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [pending, setPending] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "claimants" | "clips" | "pending">("overview");
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [c, cl, cp] = await Promise.all([
        getCampaign(id),
        listCampaignClaims(id).catch(() => ({ items: [], total: 0 })),
        listCampaignClips(id).catch(() => ({ items: [], total: 0 })),
      ]);
      setCampaign(c);
      setClaims(cl.items);
      setClips(cp.items);
      // Pending review is global; filter to this campaign
      const allPending = await listPendingReview().catch(() => ({ items: [], total: 0 }));
      setPending(allPending.items.filter((p) => p.campaign_id === id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0]">
        <div className="text-mute text-sm font-mono animate-pulse">Authenticating…</div>
      </div>
    );
  }
  if (!user) {
    return <SignInGate />;
  }
  if (user.role !== "brand") {
    return <BrandOnlyGate />;
  }

  const onPause = async () => {
    if (!campaign) return;
    setActing(true);
    try {
      const updated = await pauseCampaign(campaign.id);
      setCampaign(updated);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setActing(false); }
  };
  const onResume = async () => {
    if (!campaign) return;
    setActing(true);
    try {
      const updated = await resumeCampaign(campaign.id);
      setCampaign(updated);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setActing(false); }
  };
  const onCancel = async () => {
    if (!campaign) return;
    if (!confirm("Cancel this campaign? This is a soft-delete and the budget will be unfrozen.")) return;
    setActing(true);
    try {
      const updated = await cancelCampaign(campaign.id);
      setCampaign(updated);
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setActing(false); }
  };
  const onApprove = async (clipId: string) => {
    setActing(true);
    try {
      await approveClip(clipId);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Approve failed"); }
    finally { setActing(false); }
  };
  const onReject = async (clipId: string) => {
    if (!rejectReason.trim()) return;
    setActing(true);
    try {
      await rejectClip(clipId, rejectReason);
      setRejecting(null);
      setRejectReason("");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Reject failed"); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0]">
        <div className="text-mute text-sm font-mono animate-pulse">Loading campaign…</div>
      </div>
    );
  }
  if (error && !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
          <div className="text-ink text-lg font-medium mb-2">Failed to load campaign</div>
          <div className="text-mute text-sm mb-4">{error}</div>
          <Link href="/brands/campaigns" className="text-fuchsia-600 hover:underline text-sm">
            ← Back to campaigns
          </Link>
        </div>
      </div>
    );
  }
  if (!campaign) return null;

  const status = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft;

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-ink">
      {/* Background flair */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-fuchsia-200/30 via-coral-200/20 to-violet-200/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-tr from-violet-200/20 via-sky-200/20 to-emerald-200/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Back link */}
        <Link
          href="/brands/campaigns"
          className="inline-flex items-center gap-1.5 text-mute hover:text-ink text-sm font-mono mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 00 · BACK TO CAMPAIGNS
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-mute">01 · CAMPAIGN</span>
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full ring-1 ${status.bg} ${status.text} ${status.ring}`}
                >
                  {status.label.toUpperCase()}
                </span>
              </div>
              <h1 className="font-serif italic text-4xl md:text-5xl text-ink leading-tight mb-2">
                {campaign.name}
              </h1>
              <p className="text-mute text-sm max-w-2xl">{campaign.brief}</p>
            </div>

            {/* Lifecycle controls */}
            <div className="flex items-center gap-2">
              {campaign.status === "live" && (
                <button
                  onClick={onPause}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/70 ring-1 ring-ink/10 text-ink text-sm font-medium hover:bg-white transition disabled:opacity-50"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}
              {campaign.status === "paused" && (
                <button
                  onClick={onResume}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 text-text-primary text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              )}
              {(campaign.status === "live" || campaign.status === "paused") && (
                <button
                  onClick={onCancel}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500 text-text-primary text-sm font-medium hover:bg-rose-600 transition disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="CPM" value={fmtCents(campaign.cpm_cents)} icon={<DollarSign className="w-3.5 h-3.5" />} />
          <StatCard label="BUDGET" value={fmtCents(campaign.budget_cents)} sub={`${fmtCents(campaign.spent_cents)} spent`} />
          <StatCard
            label="SLOTS"
            value={`${campaign.slots_filled} / ${campaign.slots_total}`}
            sub={`${campaign.slots_remaining} open`}
            icon={<Users className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="CLIPS"
            value={fmtNum(campaign.clip_count)}
            sub={campaign.starts_at ? `Started ${fmtDate(campaign.starts_at)}` : "Draft"}
            icon={<Video className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-6 p-3 rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-sm flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>{error}</div>
              <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-6 border-b border-ink/8">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            count={0}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeTab === "claimants"}
            onClick={() => setActiveTab("claimants")}
            count={claims.length}
          >
            Claimants
          </TabButton>
          <TabButton
            active={activeTab === "clips"}
            onClick={() => setActiveTab("clips")}
            count={clips.length}
          >
            Clips
          </TabButton>
          <TabButton
            active={activeTab === "pending"}
            onClick={() => setActiveTab("pending")}
            count={pending.length}
            accent
          >
            Pending review
          </TabButton>
        </div>

        {/* Tab content */}
        {activeTab === "overview" && <OverviewTab campaign={campaign} />}
        {activeTab === "claimants" && <ClaimantsTab claims={claims} />}
        {activeTab === "clips" && <ClipsTab clips={clips} />}
        {activeTab === "pending" && (
          <PendingTab
            clips={pending}
            acting={acting}
            rejecting={rejecting}
            rejectReason={rejectReason}
            setRejecting={setRejecting}
            setRejectReason={setRejectReason}
            onApprove={onApprove}
            onReject={onReject}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab buttons ───────────────────────────────────────────────────────────

function TabButton({
  active, onClick, count, children, accent,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition relative ${
        active
          ? "text-ink"
          : "text-mute hover:text-ink/80"
      }`}
    >
      <span className="flex items-center gap-2">
        {children}
        {count > 0 && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              accent
                ? "bg-amber-100 text-amber-800"
                : "bg-ink/5 text-mute"
            }`}
          >
            {count}
          </span>
        )}
      </span>
      {active && (
        <motion.div
          layoutId="tab-underline"
          className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-fuchsia-500 via-coral-500 to-violet-500"
        />
      )}
    </button>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/60 ring-1 ring-ink/8 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-mute mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-medium text-ink font-mono">{value}</div>
      {sub && <div className="text-xs text-mute mt-1">{sub}</div>}
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-6">
      <Card title="Brief" number="02">
        <p className="text-ink/90 leading-relaxed">{campaign.brief}</p>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Details" number="03">
          <DetailRow label="Vertical" value={campaign.vertical || "—"} />
          <DetailRow label="Source handle" value={campaign.source_handle || "—"} />
          <DetailRow label="CPM" value={fmtCents(campaign.cpm_cents)} />
          <DetailRow label="Budget" value={`${fmtCents(campaign.budget_cents)} (${fmtCents(campaign.spent_cents)} spent)`} />
        </Card>
        <Card title="Schedule" number="04">
          <DetailRow label="Starts" value={fmtDate(campaign.starts_at)} />
          <DetailRow label="Ends" value={fmtDate(campaign.ends_at)} />
          <DetailRow label="Status" value={campaign.status} />
          <DetailRow label="Created" value={fmtDate(campaign.created_at)} />
        </Card>
      </div>
    </div>
  );
}

function ClaimantsTab({ claims }: { claims: Claim[] }) {
  if (claims.length === 0) {
    return <EmptyState label="No claimants yet" sub="Clippers can claim slots from /clippers/campaigns" />;
  }
  return (
    <div className="space-y-2">
      {claims.map((c) => (
        <div
          key={c.id}
          className="p-4 rounded-xl bg-white/60 ring-1 ring-ink/8 backdrop-blur-sm flex items-center gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="text-ink font-medium text-sm">
              {c.clipper?.name || "Unknown clipper"}
            </div>
            <div className="text-mute text-xs font-mono">{c.clipper?.email}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-ink">{c.status}</div>
            <div className="text-mute text-xs font-mono">
              {c.claimed_at ? fmtDate(c.claimed_at) : "—"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClipsTab({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return <EmptyState label="No clips yet" sub="Approved clips will appear here" />;
  }
  return (
    <div className="space-y-2">
      {clips.map((c) => {
        const badge = CLIP_STATUS_BADGE[c.status] ?? CLIP_STATUS_BADGE.submitted;
        return (
          <div
            key={c.id}
            className="p-4 rounded-xl bg-white/60 ring-1 ring-ink/8 backdrop-blur-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-[9px] font-mono rounded-full ring-1 ${badge.bg} ${badge.text} ${badge.ring}`}>
                    {badge.label.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-mute">{c.platform || "—"}</span>
                </div>
                <div className="text-ink font-medium text-sm truncate">{c.title}</div>
                <div className="text-mute text-xs mt-0.5 line-clamp-1">{c.hook}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-ink font-mono text-sm">{fmtNum(c.views)} views</div>
                <div className="text-mute font-mono text-xs">{fmtCents(c.earnings_cents)} earned</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PendingTab({
  clips, acting, rejecting, rejectReason, setRejecting, setRejectReason, onApprove, onReject,
}: {
  clips: Clip[];
  acting: boolean;
  rejecting: string | null;
  rejectReason: string;
  setRejecting: (id: string | null) => void;
  setRejectReason: (s: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (clips.length === 0) {
    return <EmptyState label="No clips pending review" sub="New submissions will appear here" />;
  }
  return (
    <div className="space-y-3">
      {clips.map((c) => (
        <div
          key={c.id}
          className="p-5 rounded-xl bg-white/70 ring-1 ring-ink/8 backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-mute">FROM</span>
                <span className="text-sm text-ink font-medium">{c.clipper?.name || "Clipper"}</span>
                <span className="text-[10px] font-mono text-mute">·</span>
                <span className="text-[10px] font-mono text-mute">{c.platform}</span>
              </div>
              <div className="text-ink font-medium text-base mb-1">{c.title}</div>
              <div className="text-fuchsia-600 italic font-serif text-sm mb-2">"{c.hook}"</div>
              <p className="text-mute text-sm leading-relaxed line-clamp-2">{c.caption}</p>
              {c.posted_url && (
                <a
                  href={c.posted_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:underline mt-2 inline-block"
                >
                  View on {c.platform} →
                </a>
              )}
            </div>
            <div className="text-right text-xs font-mono text-mute flex-shrink-0">
              <Clock className="w-3 h-3 inline mr-1" />
              {fmtDate(c.submitted_at)}
            </div>
          </div>

          {/* Actions */}
          {rejecting === c.id ? (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink/8">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why are you rejecting? (e.g. caption too generic)"
                className="flex-1 px-3 py-2 text-sm bg-cream ring-1 ring-ink/10 rounded-lg focus:outline-none focus:ring-rose-400"
                autoFocus
              />
              <button
                onClick={() => onReject(c.id)}
                disabled={acting || !rejectReason.trim()}
                className="px-3.5 py-2 rounded-lg bg-rose-500 text-text-primary text-sm font-medium hover:bg-rose-600 transition disabled:opacity-50"
              >
                Confirm reject
              </button>
              <button
                onClick={() => {
                  setRejecting(null);
                  setRejectReason("");
                }}
                className="px-3.5 py-2 rounded-lg bg-white ring-1 ring-ink/10 text-ink text-sm hover:bg-cream transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink/8">
              <button
                onClick={() => onApprove(c.id)}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-text-primary text-sm font-medium hover:shadow-md transition disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => setRejecting(c.id)}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white ring-1 ring-ink/10 text-ink text-sm font-medium hover:bg-cream transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────────

function Card({ title, number, children }: { title: string; number: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-white/60 ring-1 ring-ink/8 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] tracking-wider text-mute">{number}</span>
        <span className="font-mono text-[10px] tracking-wider text-mute">·</span>
        <span className="font-mono text-[10px] tracking-wider text-ink">{title.toUpperCase()}</span>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-ink/5 last:border-0">
      <span className="text-mute text-xs font-mono">{label.toUpperCase()}</span>
      <span className="text-ink text-sm font-mono">{value}</span>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="py-16 text-center">
      <div className="text-ink text-base font-medium mb-1">{label}</div>
      <div className="text-mute text-sm">{sub}</div>
    </div>
  );
}

function SignInGate() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] p-6">
      <div className="max-w-md text-center">
        <h2 className="font-serif italic text-3xl text-ink mb-3">Sign in to continue</h2>
        <p className="text-mute text-sm mb-6">
          You need a brand account to manage campaigns.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 via-coral-500 to-violet-500 text-text-primary text-sm font-medium hover:shadow-md transition"
        >
          Sign in <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function BrandOnlyGate() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] p-6">
      <div className="max-w-md text-center">
        <h2 className="font-serif italic text-3xl text-ink mb-3">Brand accounts only</h2>
        <p className="text-mute text-sm mb-6">
          This page is for D2C brands running campaigns. Looking for clippers?
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/clippers/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white ring-1 ring-ink/10 text-ink text-sm font-medium hover:bg-cream transition"
          >
            Clipper dashboard
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 via-coral-500 to-violet-500 text-text-primary text-sm font-medium hover:shadow-md transition"
          >
            Create brand account <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0]">
        <div className="text-mute text-sm font-mono animate-pulse">Loading…</div>
      </div>
    }>
      <CampaignDetailPage params={params} />
    </Suspense>
  );
}
