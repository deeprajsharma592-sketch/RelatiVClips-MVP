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
 * This page is mock data only — no backend wiring in v1. When real
 * billing/queue lands, the data hook is a single function in /lib/brands.ts.
 *
 * Sections:
 *  1. KPI strip (4 stat cards)
 *  2. Active campaigns (3 cards with progress)
 *  3. Clips pending your review (4 cards, approve/reject)
 *  4. Top performing clips this week (leaderboard)
 *  5. Recent activity feed
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";

type CampaignStatus = "live" | "review" | "completed" | "paused";

interface Campaign {
  id: string;
  name: string;
  vertical: string;
  cpm: number;
  budget: number;
  spent: number;
  views: number;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  clips: { total: number; approved: number; pending: number };
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "cmp_001",
    name: "Founder Mode · Q2 Launch",
    vertical: "Podcasts · Tech",
    cpm: 7,
    budget: 8000,
    spent: 5440,
    views: 777142,
    status: "live",
    startDate: "Jun 1",
    endDate: "Jun 30",
    clips: { total: 24, approved: 18, pending: 4 },
  },
  {
    id: "cmp_002",
    name: "All-In Summit · Highlights",
    vertical: "Podcasts · Business",
    cpm: 9,
    budget: 12000,
    spent: 9180,
    views: 1020000,
    status: "live",
    startDate: "May 15",
    endDate: "Jul 15",
    clips: { total: 36, approved: 31, pending: 5 },
  },
  {
    id: "cmp_003",
    name: "Huberman Lab · Sleep Series",
    vertical: "Podcasts · Health",
    cpm: 6,
    budget: 4000,
    spent: 1260,
    views: 210000,
    status: "review",
    startDate: "Jun 8",
    endDate: "Jul 8",
    clips: { total: 12, approved: 6, pending: 3 },
  },
  {
    id: "cmp_004",
    name: "AI Tooling · Weekly Drops",
    vertical: "Education · AI",
    cpm: 11,
    budget: 2500,
    spent: 0,
    views: 0,
    status: "paused",
    startDate: "—",
    endDate: "—",
    clips: { total: 0, approved: 0, pending: 0 },
  },
];

interface PendingClip {
  id: string;
  campaign: string;
  clipper: string;
  duration: number;
  hook: string;
  views: number;
  thumb: string; // emoji or symbol since we have no real thumbnails
  submittedAt: string;
}

const PENDING_CLIPS: PendingClip[] = [
  {
    id: "clp_8421",
    campaign: "Founder Mode · Q2 Launch",
    clipper: "@hookqueen",
    duration: 23,
    hook: "The brutal truth about pricing your SaaS",
    views: 0,
    thumb: "▶",
    submittedAt: "12 min ago",
  },
  {
    id: "clp_8419",
    campaign: "All-In Summit · Highlights",
    clipper: "@audiocuts",
    duration: 31,
    hook: "Why this YC partner said no to 99% of decks",
    views: 0,
    thumb: "▶",
    submittedAt: "34 min ago",
  },
  {
    id: "clp_8417",
    campaign: "Huberman Lab · Sleep Series",
    clipper: "@deepfocus",
    duration: 47,
    hook: "The 90-minute sleep cycle trick nobody talks about",
    views: 0,
    thumb: "▶",
    submittedAt: "1 hr ago",
  },
  {
    id: "clp_8412",
    campaign: "Founder Mode · Q2 Launch",
    clipper: "@editwizard",
    duration: 19,
    hook: "From $0 to $50K MRR in 90 days — here is exactly how",
    views: 0,
    thumb: "▶",
    submittedAt: "2 hrs ago",
  },
];

const STATUS_STYLES: Record<CampaignStatus, { bg: string; text: string; ring: string; label: string }> = {
  live: {
    bg: "bg-[color:var(--color-success)]/15",
    text: "text-[color:var(--color-success)]",
    ring: "border-[color:var(--color-success)]/30",
    label: "LIVE",
  },
  review: {
    bg: "bg-[color:var(--color-accent-secondary)]/15",
    text: "text-[color:var(--color-accent-secondary)]",
    ring: "border-[color:var(--color-accent-secondary)]/30",
    label: "IN REVIEW",
  },
  completed: {
    bg: "bg-[color:var(--color-text-muted)]/15",
    text: "text-text-muted",
    ring: "border-[color:var(--color-border)]",
    label: "DONE",
  },
  paused: {
    bg: "bg-[color:var(--color-text-muted)]/10",
    text: "text-text-faint",
    ring: "border-[color:var(--color-border)]",
    label: "PAUSED",
  },
};

export default function BrandDashboard() {
  const [active, setActive] = useState<SidebarKey>("overview");
  const [approving, setApproving] = useState<string | null>(null);

  // Page title swaps with sidebar selection
  const TITLE: Record<SidebarKey, { t: string; s?: string }> = {
    overview: { t: "Overview", s: "Your campaigns at a glance." },
    campaigns: { t: "Campaigns", s: "4 active, 1 paused." },
    queue: { t: "Clips Queue", s: "12 clips waiting for your review." },
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

  return (
    <DashboardShell
      role="brand"
      user={{ name: "Acme Co.", handle: "@acme-brand", initials: "A" }}
      active={active}
      onSelect={setActive}
      pageTitle={TITLE[active].t}
      pageSubtitle={TITLE[active].s}
    >
      {active === "overview" && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Spent this month"
              value="$15.9K"
              delta={{ value: "+23%", positive: true, label: "vs last month" }}
              variant="accent"
              icon="$"
              sparkline={[3, 5, 4, 7, 6, 9, 8, 11, 10, 14]}
            />
            <StatCard
              label="Active campaigns"
              value="3"
              delta={{ value: "+1", positive: true, label: "this week" }}
              variant="success"
              icon="▤"
            />
            <StatCard
              label="Total views (30d)"
              value="2.01M"
              delta={{ value: "+44%", positive: true, label: "vs last 30d" }}
              variant="default"
              sparkline={[8, 12, 14, 13, 18, 22, 24, 27, 30, 35]}
            />
            <StatCard
              label="Avg effective CPM"
              value="$7.92"
              delta={{ value: "-$0.30", positive: true, label: "cheaper than target" }}
              variant="violet"
              icon="↘"
              caption="Target: $8.00"
            />
          </div>

          {/* Active campaigns */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-text-primary">
                Active campaigns
              </h2>
              <button className="text-xs font-mono text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)] transition-colors">
                + New campaign
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CAMPAIGNS.filter((c) => c.status === "live" || c.status === "review").map((c) => {
                const pct = (c.spent / c.budget) * 100;
                const status = STATUS_STYLES[c.status];
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-[var(--radius-lg)] border ${status.ring} bg-[color:var(--color-surface)] p-5`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono tracking-widest text-text-faint mb-1">
                          {c.vertical.toUpperCase()}
                        </div>
                        <div className="font-display font-semibold text-text-primary truncate">
                          {c.name}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border ${status.bg} ${status.text} ${status.ring}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 my-4">
                      <div>
                        <div className="text-[10px] font-mono text-text-faint mb-0.5">BUDGET</div>
                        <div className="font-display font-bold text-lg text-text-primary">
                          ${c.budget.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-text-faint mb-0.5">VIEWS</div>
                        <div className="font-display font-bold text-lg text-text-primary">
                          {(c.views / 1000).toFixed(0)}K
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-text-faint mb-0.5">CPM</div>
                        <div className="font-display font-bold text-lg text-[color:var(--color-accent)]">
                          ${c.cpm}
                        </div>
                      </div>
                    </div>

                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-text-muted">
                        ${c.spent.toLocaleString()} spent · {c.clips.approved}/{c.clips.total} clips approved
                      </span>
                      <span className="font-mono text-text-secondary">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--color-bg-base)] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background:
                            c.status === "live"
                              ? "linear-gradient(90deg, var(--color-accent), var(--color-gradient-magenta))"
                              : "var(--color-accent-secondary)",
                          boxShadow: "0 0 8px var(--color-glow-primary)",
                        }}
                      />
                    </div>
                    <div className="mt-3 text-[10px] font-mono text-text-faint">
                      {c.startDate} → {c.endDate}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Pending review */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-text-primary">
                Clips pending your review
              </h2>
              <span className="text-xs font-mono text-[color:var(--color-accent)]">
                {PENDING_CLIPS.length} new
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {PENDING_CLIPS.map((clip) => (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden"
                >
                  {/* Thumb placeholder */}
                  <div className="relative aspect-[9/16] max-h-44 bg-gradient-to-br from-[color:var(--color-bg-deep)] to-[color:var(--color-surface-2)] flex items-center justify-center">
                    <div className="absolute inset-0 opacity-30" style={{
                      background: "radial-gradient(circle at center, var(--color-accent) 0%, transparent 60%)",
                    }} />
                    <div className="relative text-4xl text-text-faint">{clip.thumb}</div>
                    <div className="absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white">
                      0:{clip.duration.toString().padStart(2, "0")}
                    </div>
                    <div className="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white">
                      {clip.clipper}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-text-primary font-medium leading-snug line-clamp-2 mb-1">
                      {clip.hook}
                    </div>
                    <div className="text-[10px] font-mono text-text-faint mb-3">
                      {clip.campaign} · {clip.submittedAt}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(clip.id)}
                        disabled={approving === clip.id}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] border border-[color:var(--color-success)]/30 hover:bg-[color:var(--color-success)]/25 transition-colors disabled:opacity-50"
                      >
                        {approving === clip.id ? "✓ Approved" : "Approve"}
                      </button>
                      <button className="px-3 py-1.5 text-xs rounded-md bg-[color:var(--color-error)]/10 text-[color:var(--color-error)] border border-[color:var(--color-error)]/20 hover:bg-[color:var(--color-error)]/20 transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Top clips leaderboard */}
          <section>
            <h2 className="font-display font-semibold text-lg text-text-primary mb-4">
              Top performing clips · this week
            </h2>
            <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-faint">
                <div className="col-span-1">#</div>
                <div className="col-span-5">HOOK</div>
                <div className="col-span-2">CLIPPER</div>
                <div className="col-span-2 text-right">VIEWS</div>
                <div className="col-span-2 text-right">EARNED</div>
              </div>
              {[
                { rank: 1, hook: "The 10-10-10 rule for any pricing decision", clipper: "@hookqueen", views: "412K", earned: "$2,884" },
                { rank: 2, hook: "Why most YC applications fail at minute 2", clipper: "@audiocuts", views: "298K", earned: "$2,086" },
                { rank: 3, hook: "The sleep window that doubled my focus", clipper: "@deepfocus", views: "241K", earned: "$1,446" },
                { rank: 4, hook: "From PM to founder in 18 months", clipper: "@editwizard", views: "188K", earned: "$1,316" },
                { rank: 5, hook: "Why I deleted my LinkedIn (and what came back)", clipper: "@hookqueen", views: "147K", earned: "$1,029" },
              ].map((row) => (
                <div
                  key={row.rank}
                  className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-2)]/40 transition-colors items-center"
                >
                  <div className="col-span-1 font-mono text-sm text-text-muted">
                    {String(row.rank).padStart(2, "0")}
                  </div>
                  <div className="col-span-5 text-sm text-text-primary font-medium truncate">
                    {row.hook}
                  </div>
                  <div className="col-span-2 text-xs text-text-secondary font-mono">{row.clipper}</div>
                  <div className="col-span-2 text-right text-sm font-mono text-text-primary">
                    {row.views}
                  </div>
                  <div className="col-span-2 text-right text-sm font-mono text-[color:var(--color-accent)]">
                    {row.earned}
                  </div>
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
            className="rounded-[var(--radius-lg)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-12 text-center"
          >
            <div className="text-4xl mb-3 opacity-50">◇</div>
            <h3 className="font-display font-semibold text-lg text-text-primary mb-2">
              {active.charAt(0).toUpperCase() + active.slice(1)} view — preview
            </h3>
            <p className="text-sm text-text-muted max-w-md mx-auto">
              This panel is wired in our backend roadmap. The structure, sidebar,
              and design tokens are in place — we'll fill in real data once the
              first 3 design-partner campaigns land.
            </p>
            <button
              onClick={() => setActive("overview")}
              className="mt-6 px-4 py-2 text-xs font-mono border border-[color:var(--color-border-strong)] rounded-full text-text-secondary hover:text-text-primary hover:border-[color:var(--color-accent)] transition-colors"
            >
              ← Back to Overview
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardShell>
  );
}
