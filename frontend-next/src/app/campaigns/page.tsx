"use client";

/**
 * /campaigns — Public campaign board.
 *
 * Clippers land here to see what's open. Brands can also link to it.
 * Not behind a wall — anyone can browse, but Apply requires login.
 *
 * Sections:
 *  1. Hero
 *  2. Filter bar (vertical, platform, CPM range)
 *  3. Active campaigns (cards, 6-9 items)
 *  4. How payments work (3 steps, trust-building)
 *  5. CTA for brands (recruit the other side)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

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
    id: "c1",
    brand: "All-In Summit",
    vertical: "Podcasts · Business",
    brief: "Best 90-second moments from the All-In Summit. Tech, geopolitics, deals. Clean hooks + neutral framing.",
    cpm: 9,
    slots: 8,
    filled: 5,
    deadline: "Jun 18",
    platforms: ["TikTok", "Reels", "Shorts"],
    premium: true,
  },
  {
    id: "c2",
    brand: "Huberman Lab",
    vertical: "Podcasts · Health",
    brief: "Sleep series highlights. 30-60s clips with strong actionable hooks. Not motivation — mechanism.",
    cpm: 6,
    slots: 12,
    filled: 4,
    deadline: "Jun 22",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
  {
    id: "c3",
    brand: "Acme Co. · Founder Mode",
    vertical: "Podcasts · Tech",
    brief: "Founder interviews. Tactical content (cold email, pricing, hiring). Bonus for founder-emotional stories.",
    cpm: 7,
    slots: 6,
    filled: 2,
    deadline: "Jun 25",
    platforms: ["TikTok", "Reels", "Shorts", "LinkedIn"],
    urgent: true,
  },
  {
    id: "c4",
    brand: "Athletic Greens",
    vertical: "D2C · Wellness",
    brief: "Founder + customer story snippets. 15-30s, hook-first, mention product 1x max. FTC-compliant.",
    cpm: 5,
    slots: 20,
    filled: 14,
    deadline: "Jul 2",
    platforms: ["TikTok", "Reels"],
  },
  {
    id: "c5",
    brand: "Defender Media",
    vertical: "Podcasts · News",
    brief: "Daily news roundup highlights. Must be balanced, sourced, and slow-pace. No sensationalism.",
    cpm: 8,
    slots: 10,
    filled: 3,
    deadline: "Jun 20",
    platforms: ["TikTok", "Reels", "Shorts", "X"],
  },
  {
    id: "c6",
    brand: "Keto-Mojo",
    vertical: "D2C · Health",
    brief: "User testimonials + educational content. Visual: food shots, before/after, lab results.",
    cpm: 4,
    slots: 15,
    filled: 9,
    deadline: "Jul 5",
    platforms: ["Reels", "Shorts"],
  },
  {
    id: "c7",
    brand: "Sora 2 · OpenAI",
    vertical: "Education · AI",
    brief: "AI-generated video tool highlights. Tutorial-style, clean, no hype. 60-90s.",
    cpm: 12,
    slots: 5,
    filled: 4,
    deadline: "Jun 16",
    platforms: ["TikTok", "Reels", "Shorts", "LinkedIn", "X"],
    premium: true,
    urgent: true,
  },
  {
    id: "c8",
    brand: "Indie Hackers",
    vertical: "Podcasts · Tech",
    brief: "Revenue stories from indie founders. Authentic, not broetry. Numbers-first.",
    cpm: 6,
    slots: 8,
    filled: 6,
    deadline: "Jun 28",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
  {
    id: "c9",
    brand: "Celsius",
    vertical: "D2C · Beverage",
    brief: "Fitness + lifestyle. 15-30s, gym/workout context. Product placement 1x.",
    cpm: 5,
    slots: 25,
    filled: 18,
    deadline: "Jul 10",
    platforms: ["TikTok", "Reels", "Shorts"],
  },
];

const VERTICALS = ["All", "Podcasts · Tech", "Podcasts · Business", "Podcasts · Health", "D2C · Wellness", "Education · AI", "Podcasts · News"];
const PLATFORMS = ["TikTok", "Reels", "Shorts", "LinkedIn", "X"];
const CPM_RANGES = [
  { label: "Any", min: 0, max: 99 },
  { label: "$0-5", min: 0, max: 5 },
  { label: "$5-8", min: 5, max: 8 },
  { label: "$8+", min: 8, max: 99 },
];

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
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-primary)] opacity-30 blur-[120px]" />
          <div className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-violet)] opacity-30 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 text-center">
          <span
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted"
          >
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent)]" />
            OPEN CAMPAIGNS · 9 LIVE
          </span>

          <h1
            className="font-display font-bold tracking-tight text-[clamp(2.5rem,6vw,5rem)] leading-[1.0] max-w-4xl mx-auto"
          >
            <span className="block text-text-primary">Paid clipping </span>
            <span className="block bg-gradient-to-r from-[color:var(--color-accent)] via-[color:var(--color-gradient-magenta)] to-[color:var(--color-accent-tertiary)] bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
              campaigns.
            </span>
            <span className="block text-text-primary/90">Apply once. Get matched.</span>
          </h1>

          <p
            className="mt-8 text-lg text-text-secondary max-w-2xl mx-auto"
          >
            {filtered.length} active campaigns. Pick your vertical, pick your CPM,
            and start clipping. Payouts every Monday.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="relative w-full px-6 -mt-4 mb-8">
        <div className="max-w-6xl mx-auto rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-text-faint mb-2">VERTICAL</div>
              <div className="flex flex-wrap gap-1.5">
                {VERTICALS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVertical(v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      vertical === v
                        ? "bg-[color:var(--color-accent)]/15 border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                        : "bg-[color:var(--color-bg-base)] border-[color:var(--color-border)] text-text-secondary hover:border-[color:var(--color-border-strong)]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:ml-auto">
              <div className="text-[10px] font-mono tracking-widest text-text-faint mb-2">CPM</div>
              <div className="flex gap-1.5">
                {CPM_RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => setCpmRange(i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      cpmRange === i
                        ? "bg-[color:var(--color-accent-tertiary)]/15 border-[color:var(--color-accent-tertiary)] text-[color:var(--color-accent-tertiary)]"
                        : "bg-[color:var(--color-bg-base)] border-[color:var(--color-border)] text-text-secondary hover:border-[color:var(--color-border-strong)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign grid */}
      <section className="relative w-full px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const pct = (c.filled / c.slots) * 100;
            return (
              <div
                key={c.id}
                className={`rounded-[var(--radius-lg)] border ${
                  c.premium
                    ? "border-[color:var(--color-accent-secondary)]/40 bg-gradient-to-b from-[color:var(--color-accent-secondary)]/5 to-[color:var(--color-surface)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                } p-5 flex flex-col`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-[10px] font-mono tracking-widest text-text-faint">
                    {c.vertical.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1">
                    {c.premium && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[color:var(--color-accent-secondary)]/15 text-[color:var(--color-accent-secondary)] border border-[color:var(--color-accent-secondary)]/30">
                        PREMIUM
                      </span>
                    )}
                    {c.urgent && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[color:var(--color-error)]/15 text-[color:var(--color-error)] border border-[color:var(--color-error)]/30">
                        URGENT
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-display font-bold text-lg text-text-primary mb-2">
                  {c.brand}
                </h3>
                <p className="text-sm text-text-secondary mb-4 line-clamp-3 flex-1">
                  {c.brief}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.platforms.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--color-bg-base)] text-text-muted border border-[color:var(--color-border)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] font-mono text-text-faint">CPM</div>
                    <div className="font-display font-bold text-2xl text-[color:var(--color-accent)]">
                      ${c.cpm}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-text-faint">APPLY BY</div>
                    <div className="font-mono text-sm text-text-primary">{c.deadline}</div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-faint mb-1">
                    <span>{c.filled}/{c.slots} filled</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[color:var(--color-bg-deep)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: c.urgent
                          ? "var(--color-error)"
                          : "linear-gradient(90deg, var(--color-accent), var(--color-gradient-magenta))",
                      }}
                    />
                  </div>
                </div>
                <Link
                  href="/clippers/apply"
                  className="block w-full text-center py-2 text-sm font-semibold rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] hover:scale-[1.02] transition-transform"
                >
                  Apply for this campaign
                </Link>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            No campaigns match these filters. Try a broader vertical or CPM range.
          </div>
        )}
      </section>

      {/* How payments work */}
      <section className="relative w-full py-16 px-6 bg-[color:var(--color-bg-deep)] border-y border-[color:var(--color-border)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-text-primary mb-3">
            How payouts work
          </h2>
          <p className="text-text-secondary mb-10 max-w-xl mx-auto">
            Verified views roll up weekly. Payouts hit your account every Monday morning. No invoices, no chasing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "01", title: "Post your clip", body: "Use any platform — TikTok, Reels, Shorts, LinkedIn, X. We track it." },
              { step: "02", title: "Views roll up", body: "We pull platform-verified view counts every Sunday at midnight UTC. No estimate, no guess." },
              { step: "03", title: "You get paid", body: "70/30 split. UPI for India, USD for international, USDC optional. Every Monday 9 AM IST." },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-left"
              >
                <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent-tertiary)] mb-2">
                  STEP {s.step}
                </div>
                <h3 className="font-display font-semibold text-text-primary mb-2">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for brands */}
      <section className="relative w-full py-16 px-6">
        <div className="max-w-3xl mx-auto rounded-[var(--radius-lg)] border border-[color:var(--color-accent)]/30 bg-gradient-to-br from-[color:var(--color-accent)]/10 via-transparent to-transparent p-8 text-center">
          <h2 className="font-display font-bold text-3xl text-text-primary mb-2">
            Are you a brand?
          </h2>
          <p className="text-text-secondary mb-6 max-w-xl mx-auto">
            Launch a campaign. Set your CPM, brief, and budget. The clipper network competes for your slots.
          </p>
          <Link
            href="/brands"
            className="inline-block px-7 py-3 bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] font-semibold rounded-full shadow-[0_0_24px_var(--color-glow-primary)] hover:scale-[1.02] transition-transform"
          >
            Launch a campaign →
          </Link>
        </div>
      </section>
    </>
  );
}
