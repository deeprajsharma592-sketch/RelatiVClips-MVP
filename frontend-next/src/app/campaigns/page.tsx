"use client";

/**
 * /campaigns — Public campaign board.
 *
 * Clippers land here to see what's open. Brands can also link to it.
 * Re-skinned in v5.1 to match the cream-glass aesthetic.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Filter, Sparkles, Zap } from "lucide-react";

interface Campaign {
  id: string;
  brand: string;
  vertical: string;
  brief: string;
  cpm: number;
  slots: number;
  filled: number;
  deadline: string;
  platforms: string[];
  premium?: boolean;
  urgent?: boolean;
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "c1", brand: "All-In Summit", vertical: "Podcasts · Business",
    brief: "Best 90-second moments from the All-In Summit. Tech, geopolitics, deals. Clean hooks + neutral framing.",
    cpm: 9, slots: 8, filled: 5, deadline: "Jun 18",
    platforms: ["TikTok", "Reels", "Shorts"], premium: true,
  },
  {
    id: "c2", brand: "Huberman Lab", vertical: "Podcasts · Health",
    brief: "Sleep series highlights. 30-60s clips with strong actionable hooks. Not motivation — mechanism.",
    cpm: 6, slots: 12, filled: 4, deadline: "Jun 22",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
  {
    id: "c3", brand: "Acme Co. · Founder Mode", vertical: "Podcasts · Tech",
    brief: "Founder interviews. Tactical content (cold email, pricing, hiring). Bonus for founder-emotional stories.",
    cpm: 7, slots: 6, filled: 2, deadline: "Jun 25",
    platforms: ["TikTok", "Reels", "Shorts", "LinkedIn"], urgent: true,
  },
  {
    id: "c4", brand: "Athletic Greens", vertical: "D2C · Wellness",
    brief: "Founder + customer story snippets. 15-30s, hook-first, mention product 1x max. FTC-compliant.",
    cpm: 5, slots: 20, filled: 14, deadline: "Jul 2",
    platforms: ["TikTok", "Reels"],
  },
  {
    id: "c5", brand: "Defender Media", vertical: "Podcasts · News",
    brief: "Daily news roundup highlights. Must be balanced, sourced, and slow-pace. No sensationalism.",
    cpm: 8, slots: 10, filled: 3, deadline: "Jun 20",
    platforms: ["TikTok", "Reels", "Shorts", "X"],
  },
  {
    id: "c6", brand: "Keto-Mojo", vertical: "D2C · Health",
    brief: "User testimonials + educational content. Visual: food shots, before/after, lab results.",
    cpm: 4, slots: 15, filled: 9, deadline: "Jul 5",
    platforms: ["Reels", "Shorts"],
  },
  {
    id: "c7", brand: "Sora 2 · OpenAI", vertical: "Education · AI",
    brief: "AI-generated video tool highlights. Tutorial-style, clean, no hype. 60-90s.",
    cpm: 12, slots: 5, filled: 4, deadline: "Jun 16",
    platforms: ["TikTok", "Reels", "Shorts", "LinkedIn", "X"], premium: true, urgent: true,
  },
  {
    id: "c8", brand: "Indie Hackers", vertical: "Podcasts · Tech",
    brief: "Revenue stories from indie founders. Authentic, not broetry. Numbers-first.",
    cpm: 6, slots: 8, filled: 6, deadline: "Jun 28",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
  {
    id: "c9", brand: "Celsius", vertical: "D2C · Beverage",
    brief: "Fitness + lifestyle. 15-30s, gym/workout context. Product placement 1x.",
    cpm: 5, slots: 25, filled: 18, deadline: "Jul 10",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
];

const VERTICALS = ["All", "Podcasts · Tech", "Podcasts · Business", "Podcasts · Health", "D2C · Wellness", "Education · AI", "Podcasts · News"];
const PLATFORMS = ["TikTok", "Reels", "Shorts", "LinkedIn", "X"];
const CPM_RANGES = [
  { label: "Any", min: 0, max: 99 },
  { label: "$0–5", min: 0, max: 5 },
  { label: "$5–8", min: 5, max: 8 },
  { label: "$8+", min: 8, max: 99 },
];

const PAYOUT_STEPS = [
  { num: "01", title: "Post your clip", body: "Use any platform — TikTok, Reels, Shorts, LinkedIn, X. We track it." },
  { num: "02", title: "Views roll up", body: "We pull platform-verified view counts every Sunday at midnight UTC. No estimate, no guess." },
  { num: "03", title: "You get paid", body: "70/30 split. UPI for India, USD for international, USDC optional. Every Monday 9 AM IST." },
];

function SectionMarker({ num, label, centered = false }: { num: string; label: string; centered?: boolean }) {
  return (
    <div className={`flex items-center gap-3 mb-6 ${centered ? "justify-center" : ""}`}>
      <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>{num}</span>
      <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
      <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</span>
    </div>
  );
}

export default function CampaignsPage() {
  const [vertical, setVertical] = useState("All");
  const [cpmRange, setCpmRange] = useState(0);
  const range = CPM_RANGES[cpmRange];

  const filtered = CAMPAIGNS.filter((c) => {
    if (vertical !== "All" && c.vertical !== vertical) return false;
    if (c.cpm < range.min || c.cpm > range.max) return false;
    return true;
  });

  return (
    <>
      {/* ════════════ 01 · HERO ════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.20) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          <SectionMarker num="01" label="Open campaigns" centered />

          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(255, 252, 242, 0.7)",
              backdropFilter: "blur(12px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#10B981" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#10B981" }} />
            </span>
            <span className="font-mono tabular-nums">{filtered.length}</span> live · payouts every Monday
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="font-display font-semibold tracking-tight max-w-5xl mx-auto"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Paid clipping </span>
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>campaigns.</span>
            <br />
            <span style={{ color: "var(--color-text-primary)" }}>Apply once. Get matched.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Pick your vertical, pick your CPM, and start clipping. The clipper network competes for slots. Payouts every Monday.
          </motion.p>
        </div>
      </section>

      {/* ════════════ 02 · FILTER BAR ════════════ */}
      <section className="relative px-6 -mt-4 mb-12">
        <div className="max-w-7xl mx-auto glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Filter</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-faint)" }}>Vertical</div>
              <div className="flex flex-wrap gap-1.5">
                {VERTICALS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVertical(v)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all"
                    style={{
                      background: vertical === v ? "rgba(217, 70, 239, 0.10)" : "rgba(40, 30, 15, 0.02)",
                      borderColor: vertical === v ? "rgba(217, 70, 239, 0.35)" : "rgba(60, 50, 30, 0.08)",
                      color: vertical === v ? "var(--color-accent)" : "var(--color-text-secondary)",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-faint)" }}>CPM</div>
              <div className="flex gap-1.5">
                {CPM_RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => setCpmRange(i)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all"
                    style={{
                      background: cpmRange === i ? "rgba(139, 92, 246, 0.10)" : "rgba(40, 30, 15, 0.02)",
                      borderColor: cpmRange === i ? "rgba(139, 92, 246, 0.35)" : "rgba(60, 50, 30, 0.08)",
                      color: cpmRange === i ? "#8B5CF6" : "var(--color-text-secondary)",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ 03 · CAMPAIGN GRID ════════════ */}
      <section className="relative px-6 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((c, i) => {
                const pct = (c.filled / c.slots) * 100;
                const isPremium = c.premium;
                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={`hover-lift rounded-[var(--radius-xl)] p-6 flex flex-col relative overflow-hidden ${
                      isPremium ? "glass-panel" : "glass-card hover-glow"
                    }`}
                    style={isPremium ? { border: "1px solid rgba(251, 191, 36, 0.30)" } : undefined}
                  >
                    {isPremium && (
                      <div
                        className="absolute -top-px left-0 right-0 h-1"
                        style={{ background: "linear-gradient(135deg, #FBBF24 0%, #FB923C 100%)" }}
                      />
                    )}

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p
                        className="text-[10px] font-mono uppercase tracking-wider"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {c.vertical}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.premium && (
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{
                              background: "rgba(251, 191, 36, 0.10)",
                              color: "#B45309",
                              border: "1px solid rgba(251, 191, 36, 0.25)",
                            }}
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            Premium
                          </span>
                        )}
                        {c.urgent && (
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{
                              background: "rgba(239, 68, 68, 0.10)",
                              color: "var(--color-error)",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                            }}
                          >
                            <Zap className="h-2.5 w-2.5" />
                            Urgent
                          </span>
                        )}
                      </div>
                    </div>

                    <h3
                      className="font-display font-semibold text-lg mb-2"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {c.brand}
                    </h3>
                    <p className="text-[13px] leading-relaxed mb-4 flex-1" style={{ color: "var(--color-text-secondary)" }}>
                      {c.brief}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {c.platforms.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(40, 30, 15, 0.04)",
                            color: "var(--color-text-muted)",
                            border: "1px solid rgba(60, 50, 30, 0.08)",
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>CPM</div>
                        <div className="font-display font-semibold text-2xl tabular-nums text-gradient-sunset">
                          ${c.cpm}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Apply by</div>
                        <div className="font-mono text-[13px] tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                          {c.deadline}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1.5" style={{ color: "var(--color-text-faint)" }}>
                        <span className="tabular-nums">{c.filled}/{c.slots} filled</span>
                        <span className="tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(60, 50, 30, 0.08)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: c.urgent
                              ? "linear-gradient(90deg, #EF4444, #FB7185)"
                              : "var(--gradient-sunset)",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.04 }}
                        />
                      </div>
                    </div>

                    <Link
                      href="/clippers/apply"
                      className="btn-primary btn-shine w-full justify-center inline-flex text-sm"
                    >
                      Apply for this campaign
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <div className="text-center py-16 glass-card">
              <p className="text-[14px]" style={{ color: "var(--color-text-muted)" }}>
                No campaigns match these filters. Try a broader vertical or CPM range.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ════════════ 04 · HOW PAYOUTS WORK ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <SectionMarker num="04" label="How payouts work" centered />
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Verified views. </span>
              <span className="hero-text text-gradient-ocean">Monday payouts.</span>
            </h2>
            <p className="mt-5 text-lg max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
              Views roll up weekly. Payouts hit your account every Monday morning. No invoices, no chasing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PAYOUT_STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card hover-glow p-7 relative overflow-hidden"
              >
                <span
                  className="absolute -top-4 -right-2 font-display font-semibold select-none pointer-events-none"
                  style={{
                    fontSize: "8rem",
                    lineHeight: 1,
                    color: "transparent",
                    background: "linear-gradient(180deg, rgba(60, 50, 30, 0.08) 0%, rgba(60, 50, 30, 0.02) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                  }}
                >
                  {s.num}
                </span>
                <div className="relative">
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
                    Step {s.num}
                  </p>
                  <h3
                    className="font-display font-semibold text-lg mb-2"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {s.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ 05 · CTA FOR BRANDS ════════════ */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-4xl mx-auto px-6">
          <div
            className="glass-panel p-12 md:p-16 text-center relative overflow-hidden"
            style={{ borderRadius: "var(--radius-2xl)" }}
          >
            <div
              className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
            />
            <div
              className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <SectionMarker num="05" label="For brands" centered />
              <h2
                className="font-display font-semibold tracking-tight"
                style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)", lineHeight: 1.05 }}
              >
                <span style={{ color: "var(--color-text-primary)" }}>Are you a brand? </span>
                <span className="hero-text text-gradient-sunset">Launch a campaign.</span>
              </h2>
              <p className="mt-5 text-lg max-w-xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                Set your CPM, brief, and budget. The clipper network competes for your slots.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/brands" className="btn-primary btn-shine inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Launch a campaign
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/contact" className="btn-ghost inline-flex items-center gap-2">
                  Talk to the team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
