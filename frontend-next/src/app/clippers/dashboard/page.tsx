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
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, LogIn } from "lucide-react";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";
import { useAuth } from "@/lib/AuthContext";

interface OpenCampaign {
  id: string;
  brand: string;
  vertical: string;
  cpm: number;
  slots: number;
  filled: number;
  deadline: string;
  premium?: boolean;
  brief: string;
}

const OPEN_CAMPAIGNS: OpenCampaign[] = [
  {
    id: "cmp_open_1",
    brand: "All-In Summit",
    vertical: "Podcasts · Business",
    cpm: 9,
    slots: 8,
    filled: 5,
    deadline: "Jun 18",
    premium: true,
    brief: "Best 90-second moments from the All-In Summit. Tech, geopolitics, deals. We want clean hooks + political-neutral framing.",
  },
  {
    id: "cmp_open_2",
    brand: "Huberman Lab",
    vertical: "Podcasts · Health",
    cpm: 6,
    slots: 12,
    filled: 4,
    deadline: "Jun 22",
    brief: "Sleep series highlights. 30-60s clips with a strong actionable hook. We're not interested in motivation-only content.",
  },
  {
    id: "cmp_open_3",
    brand: "Acme Co. — Founder Mode",
    vertical: "Podcasts · Tech",
    cpm: 7,
    slots: 6,
    filled: 2,
    deadline: "Jun 25",
    brief: "Founder interviews. We're doubling down on tactical content (not motivational). Bonus for clips mentioning cold email or pricing.",
  },
];

const RECENT_CLIPS = [
  {
    id: "clp_my_1",
    title: "The 10-10-10 rule for any pricing decision",
    campaign: "Founder Mode · Q2",
    platform: "TikTok",
    handle: "@hookqueen",
    postedAt: "3 days ago",
    views: 412000,
    earned: 2884,
    cpm: 7,
  },
  {
    id: "clp_my_2",
    title: "Why I deleted my LinkedIn (and what came back)",
    campaign: "Founder Mode · Q2",
    platform: "Instagram Reels",
    handle: "@hookqueen",
    postedAt: "5 days ago",
    views: 147000,
    earned: 1029,
    cpm: 7,
  },
  {
    id: "clp_my_3",
    title: "The 1-line cold email that got me a $50K deal",
    campaign: "All-In Summit",
    platform: "YouTube Shorts",
    handle: "@hookqueen",
    postedAt: "1 week ago",
    views: 86000,
    earned: 602,
    cpm: 7,
  },
];

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

// Simple inline bar chart for the last 7 days
function EarningsBars({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((v, i) => {
        const h = (v / max) * 100;
        const isLatest = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
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
              {days[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClipperDashboard() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<SidebarKey>("overview");

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

  const TITLE: Record<SidebarKey, { t: string; s?: string }> = {
    overview: { t: "Welcome back, Maya", s: "You earned $1.2K this week. 3 active campaigns, 2 new payouts ready." },
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
      {active === "overview" && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Earned this month"
              value="$1,247"
              delta={{ value: "+38%", positive: true, label: "vs last month" }}
              variant="violet"
              icon="$"
              sparkline={[2, 3, 4, 5, 7, 8, 12, 10, 15, 18, 22, 25]}
            />
            <StatCard
              label="Clips live"
              value="23"
              delta={{ value: "+5", positive: true, label: "this week" }}
              variant="accent"
              icon="▶"
            />
            <StatCard
              label="Pending payout"
              value="$612"
              caption="Settles Monday, 9 AM IST"
              variant="success"
              icon="↑"
            />
            <StatCard
              label="Your avg CPM"
              value="$0.42"
              delta={{ value: "+$0.04", positive: true, label: "vs network avg" }}
              variant="warning"
              icon="↗"
            />
          </div>

          {/* Earnings chart + open campaigns */}
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
                    $612
                  </div>
                </div>
                <div
                  className="text-xs font-mono"
                  style={{ color: "var(--color-success)" }}
                >
                  ▲ 22% vs last week
                </div>
              </div>
              <EarningsBars data={[42, 67, 89, 124, 78, 156, 56]} />
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
                    Open campaigns · 3 new
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
                  View all 8 →
                </button>
              </div>
              <div className="space-y-2">
                {OPEN_CAMPAIGNS.map((c) => {
                  const pct = (c.filled / c.slots) * 100;
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
                              {c.vertical.toUpperCase()}
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
                            {c.brand}
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
                            ${c.cpm}
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
                              {c.filled}/{c.slots} slots filled
                            </span>
                            <span>Apply by {c.deadline}</span>
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
                        <button
                          className="btn-shine px-4 py-1.5 text-xs font-semibold rounded-full text-white transition-all hover:-translate-y-0.5"
                          style={{
                            background: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
                            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.30)",
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent clips */}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {RECENT_CLIPS.map((c) => (
                <div
                  key={c.id}
                  className="glass-card hover-glow p-4"
                >
                  <div
                    className="text-[10px] font-mono tracking-widest mb-1"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {c.platform.toUpperCase()} · {c.campaign.toUpperCase()}
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
                        {(c.views / 1000).toFixed(0)}K
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
                        ${c.earned}
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-mono"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {c.postedAt}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips from the top */}
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
