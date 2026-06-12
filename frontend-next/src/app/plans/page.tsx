"use client";

/**
 * /plans — unified pricing for all 3 sides of the marketplace.
 *
 * - Clippers (3 tiers: Starter, Pro, Elite) — what to pay RelatiV
 * - Brands (3 tiers: Pilot, Run a Campaign, Scale) — what to pay RelatiV
 * - Creators (free, no tier) — earn from brands posting campaigns on their content
 *
 * The "Run a Campaign" tier is the new product the founder asked for:
 * a self-serve brand tier for scaling across multiple verticals.
 *
 * The user explicitly said "add Run a Campaign tier for brands looking to
 * scale to a variety of audiences" — that means multi-vertical, multi-show,
 * self-serve. That's this tier.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Side = "clippers" | "brands";

interface Tier {
  name: string;
  price: string;
  unit?: string;
  cta: string;
  href: string;
  highlight?: boolean;
  bestFor: string;
  features: string[];
  cpmHint?: string;
}

const CLIPPER_TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$0",
    unit: "/month",
    cta: "Apply free",
    href: "/clippers/apply",
    bestFor: "New clippers, < 5 clips/week",
    features: [
      "Apply to any campaign",
      "Standard $4 CPM rate",
      "Weekly UPI/USD payouts",
      "Discord access",
      "Basic analytics",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    unit: "/month",
    cta: "Apply + subscribe",
    href: "/clippers/apply",
    highlight: true,
    bestFor: "Active clippers, 5-15 clips/week",
    cpmHint: "60% of revenue share",
    features: [
      "Priority campaign matching",
      "Up to $7 CPM (brand-set)",
      "AI clip suggestions from RelatiV",
      "70% revenue share",
      "Advanced analytics + view curves",
      "Direct line to campaign managers",
    ],
  },
  {
    name: "Elite",
    price: "$99",
    unit: "/month",
    cta: "Apply + subscribe",
    href: "/clippers/apply",
    bestFor: "Top 1%, 20+ clips/week",
    cpmHint: "70% revenue share",
    features: [
      "Reserved brand partnerships",
      "Up to $12 CPM (premium brands)",
      "Brand-direct intros",
      "75% revenue share",
      "Custom hooks playbook",
      "Monthly strategy call with founders",
    ],
  },
];

const BRAND_TIERS: Tier[] = [
  {
    name: "Pilot",
    price: "$1,000",
    unit: "/campaign",
    cta: "Launch pilot",
    href: "/brands#run",
    bestFor: "First-time brands, single campaign test",
    cpmHint: "$7 base CPM · 50K views",
    features: [
      "1 active campaign",
      "Single vertical",
      "Manual brief + approval",
      "Weekly reporting",
      "Standard turnaround (48h)",
    ],
  },
  {
    name: "Run a Campaign",
    price: "$5,000",
    unit: "/month",
    cta: "Start running",
    href: "/brands#run",
    highlight: true,
    bestFor: "Brands scaling across audiences",
    cpmHint: "Negotiated CPM · 250K+ views",
    features: [
      "Up to 5 simultaneous campaigns",
      "Multi-vertical reach (tech, health, D2C, etc.)",
      "Self-serve brief + brand guidelines",
      "Real-time clips queue (approve/reject)",
      "Cross-platform analytics dashboard",
      "Dedicated campaign manager",
      "Net-15 invoicing",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    unit: "",
    cta: "Talk to us",
    href: "/contact",
    bestFor: "Always-on, multi-show brands",
    cpmHint: "Volume pricing · 1M+ views",
    features: [
      "Unlimited campaigns",
      "Reserved clipper slots (top 1%)",
      "Custom AI model trained on your brand",
      "API + raw data export",
      "SOC2 / contract review support",
      "SLA + named CSM",
    ],
  },
];

export default function PlansPage() {
  const [side, setSide] = useState<Side>("brands");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const tiers = side === "clippers" ? CLIPPER_TIERS : BRAND_TIERS;

  const FAQ = [
    {
      q: "How does the 70/30 split work?",
      a: "When a brand pays us $7 CPM, we keep $2.10 (30%) to cover platform, AI inference, and the clipper network. The other $4.90 goes to the clipper whose work drove those views. We never deduct fees invisibly — every payout receipt shows the math.",
    },
    {
      q: "Can I switch between tiers?",
      a: "Yes. Clippers can upgrade/downgrade their subscription monthly. Brands can move between tiers at any time — Pilot → Run a Campaign upgrades the moment you have 2+ campaigns running.",
    },
    {
      q: "What counts as a 'verified view'?",
      a: "Platform-reported view counts pulled directly from each platform's analytics API. We don't estimate, and we don't count autoplays, looped plays, or repeats shorter than 3 seconds. Disputes are reviewed by a human within 48 hours.",
    },
    {
      q: "Is there a free trial?",
      a: "Clippers always start free. Brands get a $500 Pilot credit on their first campaign — if it doesn't deliver 50K+ verified views, we don't invoice you for the difference.",
    },
    {
      q: "How are FTC disclosures handled?",
      a: "We require `#ad` or `#sponsored` on every paid clip submitted through the network. Clippers who don't disclose are removed. We also generate a disclosure kit for each campaign with platform-specific templates.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. No annual contracts on any tier. Cancel from the dashboard; we prorate to the day. Active payouts settle on the next Monday.",
    },
  ];

  return (
    <div className="relative min-h-screen pt-20 pb-16 px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--color-glow-primary)] opacity-30 blur-[120px]" />
        <div className="absolute top-1/2 right-1/3 h-[300px] w-[300px] rounded-full bg-[color:var(--color-glow-violet)] opacity-25 blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
            <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent)]" />
            PRICING
          </span>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-text-primary tracking-tight max-w-3xl mx-auto">
            Pay for outcomes.{" "}
            <span className="text-text-muted">Not retainers.</span>
          </h1>
          <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
            Whether you&apos;re a brand running campaigns, a clipper earning
            from them, or a creator hosting them — there&apos;s a tier for you.
          </p>
        </motion.div>

        {/* Side toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {(["brands", "clippers"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`relative px-5 py-2 text-sm font-semibold rounded-full transition-colors ${
                  side === s
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {side === s && (
                  <motion.span
                    layoutId="side-pill"
                    className={`absolute inset-0 rounded-full ${
                      s === "brands"
                        ? "bg-[color:var(--color-accent)]/15 border border-[color:var(--color-accent)]/30"
                        : "bg-[color:var(--color-accent-tertiary)]/15 border border-[color:var(--color-accent-tertiary)]/30"
                    }`}
                  />
                )}
                <span className="relative capitalize">
                  For {s}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tiers */}
        <AnimatePresence mode="wait">
          <motion.div
            key={side}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
          >
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-[var(--radius-lg)] border p-6 flex flex-col ${
                  tier.highlight
                    ? side === "brands"
                      ? "border-[color:var(--color-accent)]/50 bg-gradient-to-b from-[color:var(--color-accent)]/8 to-[color:var(--color-surface)]"
                      : "border-[color:var(--color-accent-tertiary)]/50 bg-gradient-to-b from-[color:var(--color-accent-tertiary)]/8 to-[color:var(--color-surface)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                }`}
                style={
                  tier.highlight
                    ? {
                        boxShadow:
                          side === "brands"
                            ? "0 0 40px var(--color-glow-primary)"
                            : "0 0 40px var(--color-glow-violet)",
                      }
                    : undefined
                }
              >
                {tier.highlight && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-mono tracking-widest rounded-full ${
                      side === "brands"
                        ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)]"
                        : "bg-[color:var(--color-accent-tertiary)] text-[color:var(--color-bg-base)]"
                    }`}
                  >
                    {side === "brands" ? "BEST FOR SCALING" : "MOST POPULAR"}
                  </div>
                )}

                <div className="mb-5">
                  <div className="text-[10px] font-mono tracking-widest text-text-faint mb-1">
                    {tier.name.toUpperCase()}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="font-display font-bold text-4xl text-text-primary">
                      {tier.price}
                    </div>
                    {tier.unit && (
                      <div className="text-sm text-text-muted font-sans">{tier.unit}</div>
                    )}
                  </div>
                  {tier.cpmHint && (
                    <div className="mt-2 text-xs font-mono text-text-muted">
                      {tier.cpmHint}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-text-secondary">
                    Best for: <span className="text-text-primary font-medium">{tier.bestFor}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className={`shrink-0 mt-0.5 ${
                          tier.highlight
                            ? side === "brands"
                              ? "text-[color:var(--color-accent)]"
                              : "text-[color:var(--color-accent-tertiary)]"
                            : "text-text-muted"
                        }`}
                      >
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.href}
                  className={`block w-full text-center py-3 text-sm font-semibold rounded-full transition-transform hover:scale-[1.02] ${
                    tier.highlight
                      ? side === "brands"
                        ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg-base)] shadow-[0_0_24px_var(--color-glow-primary)]"
                        : "bg-[color:var(--color-accent-tertiary)] text-[color:var(--color-bg-base)] shadow-[0_0_24px_var(--color-glow-violet)]"
                      : "bg-[color:var(--color-surface-2)] text-text-primary border border-[color:var(--color-border-strong)] hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  {tier.cta} →
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Special offer strip — Pilot credit for new brands */}
        {side === "brands" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-16 rounded-[var(--radius-lg)] border border-[color:var(--color-accent)]/30 bg-gradient-to-r from-[color:var(--color-accent)]/8 via-transparent to-[color:var(--color-accent)]/8 p-6 text-center"
          >
            <div className="text-[10px] font-mono tracking-widest text-[color:var(--color-accent)] mb-2">
              FIRST-CAMPAIGN GUARANTEE
            </div>
            <h3 className="font-display font-bold text-xl text-text-primary mb-2">
              $500 Pilot credit. Pay only for what works.
            </h3>
            <p className="text-sm text-text-secondary max-w-xl mx-auto">
              Run your first campaign. If we don&apos;t deliver 50K verified
              views, we don&apos;t invoice you for the difference. No risk.
            </p>
          </motion.div>
        )}

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] text-[10px] font-mono tracking-widest text-text-muted">
              FAQ
            </span>
            <h2 className="font-display font-bold text-3xl text-text-primary">
              Things people ask first.
            </h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[color:var(--color-surface-2)] transition-colors"
                  >
                    <span className="font-display font-semibold text-text-primary text-base">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: open ? 45 : 0 }}
                      className="shrink-0 text-[color:var(--color-accent)] text-xl"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Final CTA strip */}
        <div className="mt-16 text-center">
          <p className="text-text-muted text-sm mb-4">
            Not sure which tier? Talk to us.
          </p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 text-sm font-semibold border border-[color:var(--color-border-strong)] rounded-full text-text-primary hover:border-[color:var(--color-accent)] transition-colors"
          >
            Book a 20-min call →
          </Link>
        </div>
      </div>
    </div>
  );
}
