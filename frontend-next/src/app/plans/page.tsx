"use client";

/**
 * /plans — unified pricing for all 3 sides of the marketplace.
 *
 * Re-skinned in v5.1 to match the cream-glass aesthetic.
 *
 * - Clippers (3 tiers: Starter, Pro, Elite) — what to pay RelatiV
 * - Brands (3 tiers: Pilot, Run a Campaign, Scale) — what to pay RelatiV
 * - Creators (free, no tier) — earn from brands posting campaigns on their content
 *
 * Stripe wiring (v7 — tier 1.3):
 *   When a clipper/creator user is signed in AND Stripe is configured on
 *   the backend, the "Pro" and "Elite" tier CTAs trigger real Stripe
 *   Checkout instead of linking to the apply page. The Stripe status
 *   banner at the top of the clipper section explains when this is live.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Check, ChevronDown, ArrowRight, Sparkles, Loader2, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { createCheckout, getBillingConfig, type BillingConfig } from "@/lib/api";

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
  // When set, the CTA button triggers Stripe Checkout for this plan
  // instead of navigating to the href. Only applies to signed-in
  // clipper/creator accounts.
  stripePlan?: "clipper_pro" | "clipper_elite";
}

const CLIPPER_TIERS: Tier[] = [
  {
    name: "Starter", price: "$0", unit: "/month", cta: "Apply free",
    href: "/clippers/apply", bestFor: "New clippers, < 5 clips/week",
    features: [
      "Apply to any campaign", "Standard $4 CPM rate",
      "Weekly UPI/USD payouts", "Discord access", "Basic analytics",
    ],
  },
  {
    name: "Pro", price: "$29", unit: "/month", cta: "Subscribe",
    href: "/clippers/apply", highlight: true, bestFor: "Active clippers, 5–15 clips/week",
    cpmHint: "70% revenue share",
    stripePlan: "clipper_pro",
    features: [
      "Priority campaign matching", "Up to $7 CPM (brand-set)",
      "AI clip suggestions from RelatiV", "70% revenue share",
      "Advanced analytics + view curves", "Direct line to campaign managers",
    ],
  },
  {
    name: "Elite", price: "$99", unit: "/month", cta: "Subscribe",
    href: "/clippers/apply", bestFor: "Top 1%, 20+ clips/week",
    cpmHint: "80% revenue share",
    stripePlan: "clipper_elite",
    features: [
      "Reserved brand partnerships", "Up to $12 CPM (premium brands)",
      "Brand-direct intros", "75% revenue share",
      "Custom hooks playbook", "Monthly strategy call with founders",
    ],
  },
];

const BRAND_TIERS: Tier[] = [
  {
    name: "Pilot", price: "$1,000", unit: "/campaign", cta: "Launch pilot",
    href: "/brands#run", bestFor: "First-time brands, single campaign test",
    cpmHint: "$7 base CPM · 50K views",
    features: [
      "1 active campaign", "Single vertical", "Manual brief + approval",
      "Weekly reporting", "Standard turnaround (48h)",
    ],
  },
  {
    name: "Run a Campaign", price: "$5,000", unit: "/month", cta: "Start running",
    href: "/brands#run", highlight: true, bestFor: "Brands scaling across audiences",
    cpmHint: "Negotiated CPM · 250K+ views",
    features: [
      "Up to 5 simultaneous campaigns", "Multi-vertical reach (tech, health, D2C)",
      "Self-serve brief + brand guidelines", "Real-time clips queue (approve/reject)",
      "Cross-platform analytics dashboard", "Dedicated campaign manager", "Net-15 invoicing",
    ],
  },
  {
    name: "Scale", price: "Custom", unit: "", cta: "Talk to us",
    href: "/contact", bestFor: "Always-on, multi-show brands",
    cpmHint: "Volume pricing · 1M+ views",
    features: [
      "Unlimited campaigns", "Reserved clipper slots (top 1%)",
      "Custom AI model trained on your brand", "API + raw data export",
      "SOC2 / contract review support", "SLA + named CSM",
    ],
  },
];

const FAQ = [
  { q: "How does the 70/30 split work?", a: "When a brand pays us $7 CPM, we keep $2.10 (30%) to cover platform, AI inference, and the clipper network. The other $4.90 goes to the clipper whose work drove those views. We never deduct fees invisibly — every payout receipt shows the math." },
  { q: "Can I switch between tiers?", a: "Yes. Clippers can upgrade/downgrade their subscription monthly. Brands can move between tiers at any time — Pilot → Run a Campaign upgrades the moment you have 2+ campaigns running." },
  { q: "What counts as a 'verified view'?", a: "Platform-reported view counts pulled directly from each platform's analytics API. We don't estimate, and we don't count autoplays, looped plays, or repeats shorter than 3 seconds. Disputes are reviewed by a human within 48 hours." },
  { q: "Is there a free trial?", a: "Clippers always start free. Brands get a $500 Pilot credit on their first campaign — if it doesn't deliver 50K+ verified views, we don't invoice you for the difference." },
  { q: "How are FTC disclosures handled?", a: "We require `#ad` or `#sponsored` on every paid clip submitted through the network. Clippers who don't disclose are removed. We also generate a disclosure kit for each campaign with platform-specific templates." },
  { q: "Can I cancel anytime?", a: "Yes. No annual contracts on any tier. Cancel from the dashboard; we prorate to the day. Active payouts settle on the next Monday." },
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

export default function PlansPage() {
  const { user } = useAuth();
  const [side, setSide] = useState<Side>("clippers");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Stripe config (fetched once on mount; public endpoint, no auth needed)
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  useEffect(() => {
    getBillingConfig().then(setBilling).catch(() => setBilling(null));
  }, []);

  // Per-plan loading state
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSubscribe = async (tier: Tier) => {
    if (!tier.stripePlan) return;
    setCheckoutError(null);

    // Not signed in → send to /signup first
    if (!user) {
      window.location.href = `/signup?next=${encodeURIComponent("/plans")}`;
      return;
    }
    // Only clippers + creators can subscribe
    if (user.role !== "clipper" && user.role !== "creator") {
      setCheckoutError("Subscriptions are for clipper and creator accounts. Brand invoicing is coming soon.");
      return;
    }

    setLoadingPlan(tier.stripePlan);
    try {
      const { checkout_url } = await createCheckout(tier.stripePlan);
      window.location.href = checkout_url;
    } catch (e: any) {
      setCheckoutError(e?.message || "Checkout failed. Try again in a moment.");
    } finally {
      setLoadingPlan(null);
    }
  };

  // Should the CTA for this tier trigger Stripe checkout?
  // Conditions: tier has stripePlan + user is clipper/creator + Stripe is
  // configured + the plan is marked available in /config.
  const canSubscribeViaStripe = (tier: Tier) => {
    if (!tier.stripePlan) return false;
    if (!user) return false;
    if (user.role !== "clipper" && user.role !== "creator") return false;
    if (!billing?.stripe_enabled) return false;
    const plan = billing.plans.find((p) => p.key === tier.stripePlan);
    return plan?.available === true;
  };

  const tiers = side === "clippers" ? CLIPPER_TIERS : BRAND_TIERS;

  return (
    <div className="relative">
      {/* ════════════ 01 · HERO ════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
          <SectionMarker num="01" label="Pricing" centered />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Pay for outcomes. </span>
            <span className="hero-text text-gradient-sunset" style={{ fontSize: "1.1em" }}>Not retainers.</span>
          </motion.h1>
          <p className="mt-8 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Whether you&apos;re a brand running campaigns, a clipper earning from them, or a creator hosting them — there&apos;s a tier for you.
          </p>
        </div>
      </section>

      {/* ════════════ 02 · SIDE TOGGLE + TIERS ════════════ */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Side toggle */}
          <div className="flex justify-center mb-12">
            <div
              className="inline-flex items-center gap-1 p-1 rounded-full glass-card"
              role="tablist"
              aria-label="Pricing audience"
            >
              {(["clippers", "brands"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  role="tab"
                  aria-selected={side === s}
                  className="relative px-5 py-2 text-sm font-semibold rounded-full transition-colors"
                  style={{
                    color: side === s ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    background: side === s ? "var(--color-surface)" : "transparent",
                    boxShadow: side === s ? "0 1px 3px rgba(0, 0, 0, 0.10)" : "none",
                  }}
                >
                  {side === s && (
                    <motion.span
                      layoutId="side-pill"
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: s === "clippers" ? "rgba(252, 211, 77, 0.10)" : "rgba(139, 92, 246, 0.10)",
                        border: s === "clippers" ? "1px solid rgba(252, 211, 77, 0.40)" : "1px solid rgba(139, 92, 246, 0.30)",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative">{s === "clippers" ? "For clippers" : "For brands"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tier cards */}
          <AnimatePresence mode="wait">
            <motion.div
              key={side}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 1, y: -8 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              {/* Stripe status banner (clipper side only, when in the clippers view) */}
              {side === "clippers" && (
                <div className="md:col-span-3">
                  {billing === null ? (
                    <div className="px-4 py-2.5 rounded-2xl text-[12px] flex items-center gap-2"
                      style={{
                        background: "rgba(100, 116, 139, 0.06)",
                        border: "1px solid rgba(100, 116, 139, 0.15)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking subscription status…
                    </div>
                  ) : !billing.stripe_enabled ? (
                    <div className="px-4 py-2.5 rounded-2xl text-[12px] flex items-center gap-2"
                      style={{
                        background: "rgba(251, 113, 133, 0.06)",
                        border: "1px solid rgba(251, 113, 133, 0.20)",
                        color: "#FB7185",
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Subscriptions are coming soon.{" "}
                      <span style={{ color: "var(--color-text-muted)" }}>
                        Apply to the waitlist below to be notified when Stripe Checkout goes live.
                      </span>
                    </div>
                  ) : user && (user.role === "clipper" || user.role === "creator") ? (
                    <div className="px-4 py-2.5 rounded-2xl text-[12px] flex items-center gap-2"
                      style={{
                        background: "rgba(16, 185, 129, 0.06)",
                        border: "1px solid rgba(16, 185, 129, 0.20)",
                        color: "var(--color-success)",
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Subscriptions are live.{" "}
                      <span style={{ color: "var(--color-text-muted)" }}>
                        Click Subscribe to be redirected to Stripe Checkout. Cancel anytime.
                      </span>
                    </div>
                  ) : user ? (
                    <div className="px-4 py-2.5 rounded-2xl text-[12px] flex items-center gap-2"
                      style={{
                        background: "rgba(100, 116, 139, 0.06)",
                        border: "1px solid rgba(100, 116, 139, 0.15)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Subscriptions are for clipper and creator accounts.
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-2xl text-[12px] flex items-center gap-2"
                      style={{
                        background: "rgba(100, 116, 139, 0.06)",
                        border: "1px solid rgba(100, 116, 139, 0.15)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <Link href="/signup?next=/plans" className="font-semibold underline">
                        Sign up
                      </Link>{" "}
                      as a clipper or creator to subscribe.
                    </div>
                  )}
                  {checkoutError && (
                    <div className="mt-2 px-4 py-2.5 rounded-2xl text-[12px]"
                      style={{
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        color: "var(--color-error)",
                      }}
                    >
                      {checkoutError}
                    </div>
                  )}
                </div>
              )}
              {tiers.map((tier, i) => {
                const isHighlight = tier.highlight;
                const gradient = side === "brands"
                  ? "var(--gradient-sunset)"
                  : "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)";
                return (
                  <motion.div
                    key={tier.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className={`relative rounded-[var(--radius-xl)] p-7 flex flex-col overflow-hidden hover-lift ${
                      isHighlight ? "glass-panel" : "glass-card hover-glow"
                    }`}
                    style={isHighlight ? { border: "2px solid rgba(217, 70, 239, 0.30)" } : undefined}
                  >
                    {isHighlight && (
                      <div
                        className="absolute -top-px left-0 right-0 h-1"
                        style={{ background: gradient }}
                      />
                    )}
                    {isHighlight && (
                      <div className="absolute top-4 right-4">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: gradient,
                            color: "white",
                            boxShadow: side === "brands" ? "0 2px 8px rgba(217, 70, 239, 0.30)" : "0 2px 8px rgba(139, 92, 246, 0.30)",
                          }}
                        >
                          {side === "brands" ? "Best for scaling" : "Most popular"}
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                        {tier.name}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className="font-display font-semibold tracking-tight"
                          style={{ fontSize: "2.75rem", lineHeight: 1, color: "var(--color-text-primary)" }}
                        >
                          {tier.price}
                        </span>
                        {tier.unit && (
                          <span className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                            {tier.unit}
                          </span>
                        )}
                      </div>
                      {tier.cpmHint && (
                        <code
                          className="mt-2.5 inline-block text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(6, 182, 212, 0.08)",
                            color: "#0891B2",
                            border: "1px solid rgba(6, 182, 212, 0.15)",
                          }}
                        >
                          {tier.cpmHint}
                        </code>
                      )}
                      <p className="mt-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        <span style={{ color: "var(--color-text-muted)" }}>Best for </span>
                        <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{tier.bestFor}</span>
                      </p>
                    </div>

                    <ul className="space-y-2.5 mb-6 flex-1">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                          <Check
                            className="h-4 w-4 mt-0.5 shrink-0"
                            style={{ color: isHighlight ? (side === "brands" ? "var(--color-accent)" : "#8B5CF6") : "var(--color-success)" }}
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {canSubscribeViaStripe(tier) ? (
                      <button
                        type="button"
                        onClick={() => handleSubscribe(tier)}
                        disabled={loadingPlan === tier.stripePlan}
                        className={isHighlight ? "btn-primary btn-shine w-full justify-center inline-flex" : "btn-glass w-full justify-center inline-flex"}
                      >
                        {loadingPlan === tier.stripePlan ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Opening Stripe…
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5" />
                            {tier.cta}
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={tier.href}
                        className={isHighlight ? "btn-primary btn-shine w-full justify-center inline-flex" : "btn-glass w-full justify-center inline-flex"}
                      >
                        {tier.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* First-campaign guarantee (brands only) */}
          {side === "brands" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 glass-panel p-6 text-center relative overflow-hidden"
            >
              <div
                className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full blur-3xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.15) 0%, transparent 70%)" }}
              />
              <div className="relative">
                <p
                  className="text-[11px] font-mono uppercase tracking-wider mb-2 inline-flex items-center gap-2"
                  style={{ color: "var(--color-accent)" }}
                >
                  <Sparkles className="h-3 w-3" />
                  First-campaign guarantee
                </p>
                <h3
                  className="font-display font-semibold text-2xl mt-1 mb-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  $500 Pilot credit. Pay only for what works.
                </h3>
                <p className="text-[14px] max-w-xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                  Run your first campaign. If we don&apos;t deliver 50K verified views, we don&apos;t invoice you for the difference. No risk.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ════════════ 03 · FAQ ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <SectionMarker num="03" label="FAQ" centered />
            <h2
              className="font-display font-semibold tracking-tight"
              style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)", lineHeight: 1.05 }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>Things people </span>
              <span className="hero-text text-gradient-sunset">ask first.</span>
            </h2>
          </div>

          <div className="space-y-2">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card overflow-hidden"
                  style={{ borderRadius: "var(--radius-lg)" }}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors"
                    aria-expanded={open}
                  >
                    <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {item.q}
                    </span>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="shrink-0">
                      <ChevronDown className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
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
      </section>

      {/* ════════════ 04 · FINAL CTA ════════════ */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <SectionMarker num="04" label="Not sure?" centered />
          <h2
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 4vw, 3.25rem)", lineHeight: 1.05 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Talk to us. </span>
            <span className="hero-text text-gradient-ocean">20 minutes.</span>
          </h2>
          <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Not sure which tier fits? We&apos;ll figure it out together on a 20-min call. No sales pitch.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/contact" className="btn-primary btn-shine inline-flex items-center gap-2">
              Book a 20-min call
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/signup" className="btn-ghost inline-flex items-center gap-2">
              Try free first
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
