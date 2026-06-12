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
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardShell, { type SidebarKey } from "@/components/dashboard/Sidebar";
import StatCard from "@/components/dashboard/StatCard";

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

const TIPS = [
  {
    title: "Hook in 0.5s",
    body: "Open with a contradiction, a number, or a POV — not a 'hey guys'. Top 10% of clippers all do this.",
    color: "var(--color-accent-tertiary)",
  },
  {
    title: "Track view velocity",
    body: "If a clip gets < 5K views in 24h, take it down. Dead clips hurt your profile score.",
    color: "var(--color-accent-secondary)",
  },
  {
    title: "Posting cadence wins",
    body: "Clippers posting 5+ clips/week earn 3.4x more than 1/week. The algorithm rewards consistency.",
    color: "var(--color-accent-quaternary)",
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
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="text-[10px] font-mono text-text-muted">${v}</div>
            <div className="w-full h-20 flex items-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${h}%`,
                  minHeight: "2px",
                  background:
                    i === data.length - 1
                      ? "linear-gradient(180deg, var(--color-accent), var(--color-gradient-magenta))"
                      : "var(--color-surface-2)",
                  boxShadow:
                    i === data.length - 1 ? "0 0 12px var(--color-glow-violet)" : undefined,
                  transition: `height 0.5s ease-out ${i * 0.05}s`,
                }}
              />
            </div>
            <div className="text-[10px] font-mono text-text-faint">{days[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClipperDashboard() {
  const [active, setActive] = useState<SidebarKey>("overview");

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
      user={{ name: "Maya Chen", handle: "@hookqueen · TikTok", initials: "M" }}
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
            <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-text-faint">
                    LAST 7 DAYS
                  </div>
                  <div className="font-display font-bold text-2xl text-text-primary mt-1">
                    $612
                  </div>
                </div>
                <div className="text-xs text-[color:var(--color-success)] font-mono">
                  ▲ 22% vs last week
                </div>
              </div>
              <EarningsBars data={[42, 67, 89, 124, 78, 156, 56]} />
            </div>

            <div className="lg:col-span-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg text-text-primary">
                  Open campaigns · 3 new
                </h2>
                <button className="text-xs font-mono text-[color:var(--color-accent-tertiary)] hover:text-[color:var(--color-accent)] transition-colors">
                  View all 8 →
                </button>
              </div>
              <div className="space-y-2">
                {OPEN_CAMPAIGNS.map((c) => {
                  const pct = (c.filled / c.slots) * 100;
                  return (
                    <div
                      key={c.id}
                      className={`rounded-[var(--radius-md)] border ${
                        c.premium
                          ? "border-[color:var(--color-accent-secondary)]/40 bg-[color:var(--color-accent-secondary)]/5"
                          : "border-[color:var(--color-border)] bg-[color:var(--color-bg-base)]"
                      } p-4 hover:border-[color:var(--color-accent-tertiary)] transition-colors`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-text-faint">
                              {c.vertical.toUpperCase()}
                            </span>
                            {c.premium && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[color:var(--color-accent-secondary)]/15 text-[color:var(--color-accent-secondary)] border border-[color:var(--color-accent-secondary)]/30">
                                PREMIUM
                              </span>
                            )}
                          </div>
                          <div className="font-display font-semibold text-text-primary text-sm">
                            {c.brand}
                          </div>
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">{c.brief}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display font-bold text-lg text-[color:var(--color-accent-tertiary)]">
                            ${c.cpm}
                          </div>
                          <div className="text-[10px] font-mono text-text-faint">PER 1K VIEWS</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center justify-between text-[10px] font-mono text-text-faint mb-1">
                            <span>
                              {c.filled}/{c.slots} slots filled
                            </span>
                            <span>Apply by {c.deadline}</span>
                          </div>
                          <div className="h-1 rounded-full bg-[color:var(--color-bg-deep)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[color:var(--color-accent-tertiary)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <button className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[color:var(--color-accent-tertiary)] text-[color:var(--color-bg-base)] hover:scale-105 transition-transform">
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
            <h2 className="font-display font-semibold text-lg text-text-primary mb-4">
              Your recent clips
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {RECENT_CLIPS.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
                >
                  <div className="text-[10px] font-mono tracking-widest text-text-faint mb-1">
                    {c.platform.toUpperCase()} · {c.campaign.toUpperCase()}
                  </div>
                  <div className="font-medium text-sm text-text-primary leading-snug line-clamp-2 mb-3">
                    {c.title}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] font-mono text-text-faint">VIEWS</div>
                      <div className="font-display font-bold text-base text-text-primary">
                        {(c.views / 1000).toFixed(0)}K
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-text-faint">EARNED</div>
                      <div className="font-display font-bold text-base text-[color:var(--color-accent-tertiary)]">
                        ${c.earned}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-text-faint">{c.postedAt}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips from the top */}
          <section>
            <h2 className="font-display font-semibold text-lg text-text-primary mb-4">
              Tips from the top 1%
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIPS.map((t, i) => (
                <div
                  key={t.title}
                  className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
                >
                  <div
                    className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full mb-2"
                    style={{ color: t.color, background: `${t.color}22`, border: `1px solid ${t.color}55` }}
                  >
                    TIP {i + 1}
                  </div>
                  <div className="font-display font-semibold text-text-primary text-sm mb-1">
                    {t.title}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{t.body}</p>
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
              Built to spec, awaiting real data. Once you submit your first
              clips, this view lights up with real earnings, real payouts, and
              real campaign momentum.
            </p>
            <button
              onClick={() => setActive("overview")}
              className="mt-6 px-4 py-2 text-xs font-mono border border-[color:var(--color-border-strong)] rounded-full text-text-secondary hover:text-text-primary hover:border-[color:var(--color-accent-tertiary)] transition-colors"
            >
              ← Back to Overview
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardShell>
  );
}
