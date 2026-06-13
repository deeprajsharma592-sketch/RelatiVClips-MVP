"use client";

/**
 * /creators/dashboard — Creator-facing dashboard.
 *
 * Creators are the long-form publishers (YouTube, podcast hosts, etc.)
 * whose content RelatiV auto-clips + matches with brands.
 *
 * Sections:
 *  1. KPI strip — monthly earnings, auto-clips shipped, channels, brand deals
 *  2. Channel metrics — sparkline of monthly views + earnings
 *  3. Source library — recent uploads + auto-clips generated
 *  4. Brand deals — campaigns matched to your content, approve/reject
 *  5. Payout history
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, DollarSign, TrendingUp, Check, X, Video, Mic, Sparkles } from "lucide-react";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";

const EARNINGS_DATA = [
  { month: "Jan", value: 0 },
  { month: "Feb", value: 240 },
  { month: "Mar", value: 1200 },
  { month: "Apr", value: 3800 },
  { month: "May", value: 6200 },
  { month: "Jun", value: 8400 },
];

interface Source {
  id: string;
  title: string;
  platform: "YouTube" | "Podcast";
  publishedAt: string;
  duration: string;
  views: number;
  autoClips: number;
  pendingReview: number;
}

const SOURCES: Source[] = [
  {
    id: "src_001",
    title: "Building a 7-figure SaaS in 2026 — Founder Mode #47",
    platform: "YouTube",
    publishedAt: "3 days ago",
    duration: "1:42:18",
    views: 184_320,
    autoClips: 14,
    pendingReview: 4,
  },
  {
    id: "src_002",
    title: "The truth about AI agents — Huberman Lab crossover",
    platform: "YouTube",
    publishedAt: "1 week ago",
    duration: "2:08:45",
    views: 612_004,
    autoClips: 22,
    pendingReview: 7,
  },
  {
    id: "src_003",
    title: "Episode 128 — The science of focus",
    platform: "Podcast",
    publishedAt: "2 weeks ago",
    duration: "58:12",
    views: 92_140,
    autoClips: 8,
    pendingReview: 0,
  },
];

interface Deal {
  id: string;
  brand: string;
  vertical: string;
  matchedSource: string;
  payout: number;
  cpm: number;
  status: "matched" | "approved" | "rejected";
  expires: string;
}

const DEALS: Deal[] = [
  {
    id: "deal_001",
    brand: "Notion",
    vertical: "SaaS · Productivity",
    matchedSource: "Founder Mode #47",
    payout: 1800,
    cpm: 9,
    status: "matched",
    expires: "Jun 19",
  },
  {
    id: "deal_002",
    brand: "Athletic Greens",
    vertical: "D2C · Wellness",
    matchedSource: "Huberman Lab crossover",
    payout: 2400,
    cpm: 6,
    status: "matched",
    expires: "Jun 22",
  },
  {
    id: "deal_003",
    brand: "Acme Co.",
    vertical: "B2B SaaS",
    matchedSource: "Founder Mode #47",
    payout: 1200,
    cpm: 7,
    status: "approved",
    expires: "Jun 25",
  },
];

const PAYOUTS = [
  { date: "Jun 9", amount: 4218, method: "UPI", source: "Huberman Lab crossover" },
  { date: "Jun 2", amount: 1980, method: "USDC", source: "Notion Q2 brief" },
  { date: "May 26", amount: 3640, method: "UPI", source: "Acme B2B brief" },
  { date: "May 19", amount: 1120, method: "USD", source: "Multiple clips" },
];

export default function CreatorsDashboard() {
  const [active, setActive] = useState<SidebarKey>("overview");
  const [deals, setDeals] = useState<Deal[]>(DEALS);

  const handleApprove = (id: string) => {
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, status: "approved" as const } : x)));
  };
  const handleReject = (id: string) => {
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, status: "rejected" as const } : x)));
  };

  const totalEarnings = EARNINGS_DATA.reduce((s, m) => s + m.value, 0);
  const thisMonth = EARNINGS_DATA[EARNINGS_DATA.length - 1].value;
  const lastMonth = EARNINGS_DATA[EARNINGS_DATA.length - 2].value;
  const momGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  return (
    <DashboardShell
      role="brand"
      user={{ name: "Deepraj Sharma", handle: "@deepraj · creator", initials: "D" }}
      active={active}
      onSelect={setActive}
      pageTitle="Creator workspace"
      pageSubtitle="Auto-clips generated from your long-form. Brand deals matched to your audience. Earnings paid every Monday."
    >
      {active === "overview" ? (
        <>
          {/* 01 · KPI strip */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>01</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>This month</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Earnings (Jun)"
                value={`$${thisMonth.toLocaleString()}`}
                unit="USD"
                delta={{ value: `${momGrowth >= 0 ? "+" : ""}${momGrowth.toFixed(0)}% MoM`, positive: momGrowth > 0 }}
                variant="accent"
                sparkline={EARNINGS_DATA.map((d) => d.value)}
              />
              <StatCard
                label="Auto-clips shipped"
                value="44"
                unit="clips"
                delta={{ value: "+12 this week", positive: true }}
                variant="success"
                sparkline={[12, 18, 24, 32, 38, 44]}
              />
              <StatCard
                label="Channels"
                value="3"
                unit="active"
                caption="YouTube · Podcast · Shorts"
                variant="default"
                icon="📡"
              />
              <StatCard
                label="Open brand deals"
                value="2"
                unit="pending"
                delta={{ value: "$4,200 in payouts", positive: true }}
                variant="warning"
                icon="🤝"
              />
            </div>
          </section>

          {/* 02 · Earnings chart */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Earnings · 6 mo</span>
              <span className="ml-auto text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                Total ${totalEarnings.toLocaleString()}
              </span>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-end gap-3 h-44">
                {EARNINGS_DATA.map((m, i) => {
                  const max = Math.max(...EARNINGS_DATA.map((x) => x.value));
                  const h = max > 0 ? (m.value / max) * 100 : 0;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        ${m.value.toLocaleString()}
                      </span>
                      <motion.div
                        className="w-full rounded-t-lg"
                        style={{ background: "var(--gradient-sunset)", boxShadow: "0 0 12px rgba(217, 70, 239, 0.30)" }}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08 }}
                      />
                      <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {m.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 03 · Source library */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Source library</span>
            </div>
            <div className="space-y-3">
              {SOURCES.map((src) => {
                const PlatformIcon = src.platform === "YouTube" ? Video : Mic;
                return (
                  <div key={src.id} className="glass-card hover-glow p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: src.platform === "YouTube" ? "rgba(239, 68, 68, 0.10)" : "rgba(139, 92, 246, 0.10)",
                          border: src.platform === "YouTube" ? "1px solid rgba(239, 68, 68, 0.30)" : "1px solid rgba(139, 92, 246, 0.30)",
                        }}
                      >
                        <PlatformIcon
                          className="h-5 w-5"
                          style={{ color: src.platform === "YouTube" ? "#EF4444" : "#8B5CF6" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--color-text-primary)" }}>
                          {src.title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono flex-wrap" style={{ color: "var(--color-text-muted)" }}>
                          <span>{src.platform}</span>
                          <span>·</span>
                          <span className="tabular-nums">{src.duration}</span>
                          <span>·</span>
                          <span>{src.publishedAt}</span>
                          <span>·</span>
                          <span className="tabular-nums">{src.views.toLocaleString()} views</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <div
                          className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(217, 70, 239, 0.10)", color: "var(--color-accent)" }}
                        >
                          {src.autoClips} clips
                        </div>
                        {src.pendingReview > 0 && (
                          <div
                            className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(251, 191, 36, 0.12)", color: "#B45309" }}
                          >
                            {src.pendingReview} pending
                          </div>
                        )}
                      </div>
                    </div>
                    {/* clip count bar */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(60, 50, 30, 0.08)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "var(--gradient-sunset)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (src.autoClips / 25) * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {src.autoClips}/25
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 04 · Brand deals */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>04</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Brand deals</span>
              <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                {deals.filter((d) => d.status === "matched").length} pending approval
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {deals.map((deal) => {
                  const isMatched = deal.status === "matched";
                  const isApproved = deal.status === "approved";
                  return (
                    <motion.div
                      key={deal.id}
                      layout
                      className="glass-card p-5"
                      style={{
                        opacity: deal.status === "rejected" ? 0.5 : 1,
                        borderColor: isApproved ? "rgba(16, 185, 129, 0.30)" : isMatched ? "rgba(217, 70, 239, 0.30)" : "rgba(60, 50, 30, 0.10)",
                      }}
                    >
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                              {deal.brand}
                            </p>
                            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                              {deal.vertical}
                            </span>
                          </div>
                          <p className="text-[12px] font-mono mb-2" style={{ color: "var(--color-text-muted)" }}>
                            matched: <span style={{ color: "var(--color-text-secondary)" }}>{deal.matchedSource}</span>
                          </p>
                          <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                            <span className="tabular-nums">${deal.payout.toLocaleString()}</span>
                            <span>·</span>
                            <span className="tabular-nums">${deal.cpm} CPM</span>
                            <span>·</span>
                            <span>expires {deal.expires}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isMatched ? (
                            <>
                              <button
                                onClick={() => handleReject(deal.id)}
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
                                onClick={() => handleApprove(deal.id)}
                                className="btn-primary btn-shine inline-flex items-center gap-1.5 text-[12px]"
                                style={{ padding: "8px 16px" }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </button>
                            </>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono uppercase tracking-wider rounded-full"
                              style={{
                                background: isApproved ? "rgba(16, 185, 129, 0.10)" : "rgba(60, 50, 30, 0.06)",
                                color: isApproved ? "var(--color-success)" : "var(--color-text-muted)",
                              }}
                            >
                              {isApproved ? "✓ Approved" : "✗ Passed"}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

          {/* 05 · Payouts */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>05</span>
              <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
              <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Payout history</span>
            </div>
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(60, 50, 30, 0.08)" }}>
                    <th className="text-left text-[10px] font-mono uppercase tracking-wider px-5 py-3" style={{ color: "var(--color-text-muted)" }}>Date</th>
                    <th className="text-left text-[10px] font-mono uppercase tracking-wider px-5 py-3" style={{ color: "var(--color-text-muted)" }}>Source</th>
                    <th className="text-left text-[10px] font-mono uppercase tracking-wider px-5 py-3" style={{ color: "var(--color-text-muted)" }}>Method</th>
                    <th className="text-right text-[10px] font-mono uppercase tracking-wider px-5 py-3" style={{ color: "var(--color-text-muted)" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYOUTS.map((p, i) => (
                    <motion.tr
                      key={p.date}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ borderBottom: i < PAYOUTS.length - 1 ? "1px solid rgba(60, 50, 30, 0.06)" : "none" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 252, 242, 0.6)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td className="text-[12px] font-mono tabular-nums px-5 py-3" style={{ color: "var(--color-text-secondary)" }}>{p.date}</td>
                      <td className="text-[12px] px-5 py-3" style={{ color: "var(--color-text-primary)" }}>{p.source}</td>
                      <td className="text-[11px] font-mono uppercase tracking-wider px-5 py-3" style={{ color: "var(--color-text-muted)" }}>{p.method}</td>
                      <td className="text-[13px] font-display font-semibold tabular-nums text-right px-5 py-3" style={{ color: "var(--color-success)" }}>+${p.amount.toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>06</span>
                  <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
                  <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Upload a new episode</span>
                </div>
                <h2 className="font-display font-semibold tracking-tight mb-3" style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", lineHeight: 1.1 }}>
                  <span style={{ color: "var(--color-text-primary)" }}>Drop a YouTube link. </span>
                  <span className="hero-text text-gradient-sunset">Get 10 clips.</span>
                </h2>
                <p className="text-[14px] max-w-md mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                  Paste a URL from your channel. The engine transcribes, scores, and renders clips matched to active brand deals.
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
      ) : (
        <div
          className="glass-card p-16 text-center"
          style={{ borderStyle: "dashed", borderColor: "rgba(217, 70, 239, 0.30)" }}
        >
          <Sparkles className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
          <p className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>Coming soon</p>
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
      )}
    </DashboardShell>
  );
}
