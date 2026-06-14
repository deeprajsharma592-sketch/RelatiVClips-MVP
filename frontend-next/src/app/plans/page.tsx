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

type Side = "clippers" | "brands" | "creators" | "agencies";

interface AgencyVolume {
  clipsPerMonth: number;
  perClip: number;            // ₹ per clip
  marginPct: number;          // our net margin at this volume
  bestFor: string;
  features: string[];
  highlight?: boolean;        // most popular sweet-spot
  cta: string;
}

const AGENCY_VOLUMES: AgencyVolume[] = [
  {
    clipsPerMonth: 100,
    perClip: 20,
    marginPct: 85,
    bestFor: "Solo agency, 1-2 clients",
    features: [
      "All Premium features unlocked",
      "Bulk upload (10 videos at once)",
      "Email support, 24h response",
    ],
    cta: "Start at 100/mo",
  },
  {
    clipsPerMonth: 250,
    perClip: 16,
    marginPct: 81,
    bestFor: "Boutique agency, 3-5 clients",
    features: [
      "Everything in 100/mo, plus:",
      "Multi-seat dashboard (3 seats)",
      "White-label clip delivery",
      "Priority render queue",
    ],
    cta: "Start at 250/mo",
  },
  {
    clipsPerMonth: 500,
    perClip: 13,
    marginPct: 77,
    bestFor: "Mid-size agency, 5-15 clients",
    features: [
      "Everything in 250/mo, plus:",
      "Multi-seat dashboard (10 seats)",
      "Dedicated Slack channel",
      "Quarterly AI taste-tuning session",
    ],
    cta: "Start at 500/mo",
    highlight: true,
  },
  {
    clipsPerMonth: 1000,
    perClip: 10,
    marginPct: 70,
    bestFor: "Large agency, 15-30 clients",
    features: [
      "Everything in 500/mo, plus:",
      "Multi-seat dashboard (25 seats)",
      "Custom AI hooks (your brand voice)",
      "Quarterly business review",
    ],
    cta: "Start at 1,000/mo",
  },
  {
    clipsPerMonth: 2500,
    perClip: 7.5,
    marginPct: 60,
    bestFor: "Enterprise agency, multi-team",
    features: [
      "Everything in 1,000/mo, plus:",
      "Unlimited seats",
      "Reserved GPU lane (no queue)",
      "Net-30 invoicing",
    ],
    cta: "Start at 2,500/mo",
  },
  {
    clipsPerMonth: 5000,
    perClip: 6,
    marginPct: 50,
    bestFor: "Holding-co / white-label reseller",
    features: [
      "Everything in 2,500/mo, plus:",
      "Annual commit (10% extra discount)",
      "Co-branded onboarding",
      "Named CSM + 4h SLA",
    ],
    cta: "Start at 5,000/mo",
  },
  {
    clipsPerMonth: 10000,
    perClip: 0, // custom
    marginPct: 55,
    bestFor: "10K+ clips/mo — let's talk",
    features: [
      "Custom per-clip rate (volume-based)",
      "Custom SLA + data residency",
      "On-prem option available",
      "Direct line to founders",
    ],
    cta: "Talk to us",
  },
];

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
  stripePlan?: "clipper_pro" | "clipper_elite" | "creator_go" | "creator_pro" | "creator_premium" | "creator_enterprise";
  // Per-clip quota or pay-as-you-go marker (creator tiers)
  clipsIncluded?: number;
  perClipPrice?: string;
  // Margin / cost transparency shown under the price
  unitCost?: string;
}

const CREATOR_TIERS: Tier[] = [
  {
    name: "Go",
    price: "₹499",
    unit: "/month",
    cta: "Start Go",
    href: "/signup?plan=creator_go",
    bestFor: "Solo creators, dipping your toes in",
    clipsIncluded: 20,
    features: [
      "20 AI-generated clips per month",
      "Vertical 9:16 rendering, hardcoded captions",
      "Hook detection from energy + transcript",
      "3 YouTube channels connected",
      "Standard rendering queue (no priority)",
      "UPI / card billing",
    ],
    stripePlan: "creator_go",
  },
  {
    name: "Pro",
    price: "₹899",
    unit: "/month",
    cta: "Go Pro",
    href: "/signup?plan=creator_pro",
    highlight: true,
    bestFor: "Active creators, 2-3 videos / week",
    clipsIncluded: 50,
    cpmHint: "Best value · 67% margin",
    features: [
      "50 AI-generated clips per month",
      "AI taste-select (DeepSeek V3) on every video",
      "Auto-caption + viral-title generation",
      "10 YouTube channels + upload-from-device",
      "Priority render queue (3× faster)",
      "A/B hook variants (3 per clip)",
      "Email + Discord support",
    ],
    stripePlan: "creator_pro",
  },
  {
    name: "Premium",
    price: "₹1,999",
    unit: "/month",
    cta: "Go Premium",
    href: "/signup?plan=creator_premium",
    bestFor: "Agencies, podcast networks, power creators",
    clipsIncluded: 150,
    cpmHint: "Lowest per-clip · 70% margin",
    features: [
      "150 AI-generated clips per month",
      "Everything in Pro, plus:",
      "Custom branding (logo, color, font on captions)",
      "Reserved GPU lane (10× faster transcription)",
      "Team seats (up to 5)",
      "Priority support — 4h response SLA",
      "Quarterly strategy call with founders",
    ],
    stripePlan: "creator_premium",
  },
  {
    name: "Enterprise",
    price: "₹25",
    unit: "/clip",
    cta: "Start pay-as-you-go",
    href: "/contact?intent=enterprise",
    bestFor: "Brands, one-offs, no commitment",
    perClipPrice: "₹25 per clip · billed monthly",
    cpmHint: "88% margin · 8× cost recovery",
    features: [
      "Pay only for what you generate",
      "Volume discount past 100 clips / month",
      "Every feature, pay-as-you-go",
      "Dedicated account manager (10K+ clips / mo)",
      "SOC2 / contract review on request",
      "Custom SLA + data residency",
    ],
    stripePlan: "creator_enterprise",
  },
];

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
  { q: "Why are creator plans priced at ₹499/₹899/₹1999?", a: "We reverse-engineered our unit economics in public. Per-clip variable cost (YouTube fetch + LLM + render) is ~₹3, fixed monthly infra is ~₹7,238. At 50 customers we break even; at 100 we net ~₹80K/month. The pricing puts us at 59–88% net margin per tier, depending on usage. We post the full breakdown above." },
  { q: "What happens when you switch to DeepSeek V3?", a: "Two things: (1) Existing subscribers get a 6-month price lock at the rate they signed up for — if you join at ₹899 Pro, you stay at ₹899 Pro through that window even if public pricing drops. (2) New Pro subscribers will get ₹799 once we cross 100 paying users, since the underlying LLM cost drops 10×." },
  { q: "Can I use my own LLM key?", a: "API access is reserved for agency and enterprise contracts — not advertised as a tier feature on the standard plans. If you need programmatic access for compliance or integration reasons, talk to us about a custom arrangement." },
  { q: "How does agency billing work?", a: "We don't do flat subscriptions for agencies — instead, you pick a monthly clip volume (100 to 10,000+) and we quote a per-clip rate. The bigger the commit, the lower the per-clip. All tiers include every Premium feature unlocked (white-label, multi-seat, dedicated support). The 500/mo tier is the sweet spot at ₹13/clip and 77% margin on our side." },
  { q: "Can I change my agency volume month-to-month?", a: "Yes — upgrade or downgrade at the start of any month. If you exceed your committed volume, we bill the overage at the same per-clip rate (no penalty). If you underuse, the unused clips don't roll over (we keep the math simple). Annual commits unlock an extra 10% discount — talk to us for that." },
  { q: "What about white-labeling for my agency clients?", a: "Standard on all agency tiers: your logo + brand color on clip delivery pages, custom domain (clips.youragency.com) on the 1,000+ tier. Full white-label (no RelatiV branding anywhere) starts at 2,500 clips/mo. We're happy to sign reseller agreements if you're selling clips as a service." },
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
  const [side, setSide] = useState<Side>("creators");
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

  const isAgency = side === "agencies";
  const tiers = side === "clippers" ? CLIPPER_TIERS : side === "brands" ? BRAND_TIERS : [];
  const heroAccent =
    side === "clippers" ? "rgba(252, 211, 77, 0.18)" :
    side === "brands" ? "rgba(217, 70, 239, 0.18)" :
    side === "creators" ? "rgba(16, 185, 129, 0.18)" :
    "rgba(249, 115, 22, 0.18)"; // orange for agencies
  const heroAccent2 =
    side === "clippers" ? "rgba(6, 182, 212, 0.14)" :
    side === "brands" ? "rgba(139, 92, 246, 0.14)" :
    side === "creators" ? "rgba(20, 184, 166, 0.14)" :
    "rgba(234, 88, 12, 0.14)"; // deep-orange for agencies

  return (
    <div className="relative">
      {/* ════════════ 01 · HERO ════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${heroAccent} 0%, transparent 70%)` }}
          />
          <div
            className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${heroAccent2} 0%, transparent 70%)` }}
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
              {(["creators", "clippers", "brands", "agencies"] as const).map((s) => (
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
                        background:
                          s === "clippers" ? "rgba(252, 211, 77, 0.10)" :
                          s === "brands" ? "rgba(139, 92, 246, 0.10)" :
                          s === "creators" ? "rgba(16, 185, 129, 0.10)" :
                          "rgba(249, 115, 22, 0.10)",
                        border:
                          s === "clippers" ? "1px solid rgba(252, 211, 77, 0.40)" :
                          s === "brands" ? "1px solid rgba(139, 92, 246, 0.30)" :
                          s === "creators" ? "1px solid rgba(16, 185, 129, 0.40)" :
                          "1px solid rgba(249, 115, 22, 0.40)",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative">
                    {s === "clippers" ? "For clippers" : s === "brands" ? "For brands" : s === "creators" ? "For creators" : "For agencies"}
                  </span>
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
              {/* Stripe status banner (clippers only — creators have their own premium flow) */}
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
                const gradient =
                  side === "brands" ? "var(--gradient-sunset)" :
                  side === "clippers" ? "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)" :
                  "linear-gradient(135deg, #10B981 0%, #14B8A6 100%)"; // emerald-teal for creators
                return (
                  <motion.div
                    key={tier.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className={`relative rounded-[var(--radius-xl)] p-7 flex flex-col overflow-hidden hover-lift ${
                      isHighlight ? "glass-panel" : "glass-card hover-glow"
                    }`}
                    style={isHighlight ? { border: "2px solid rgba(16, 185, 129, 0.30)" } : undefined}
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
                            boxShadow: side === "brands" ? "0 2px 8px rgba(217, 70, 239, 0.30)" : "0 2px 8px rgba(16, 185, 129, 0.30)",
                          }}
                        >
                          {side === "brands" ? "Best for scaling" : side === "clippers" ? "Most popular" : "Best value"}
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
                      {tier.clipsIncluded && (
                        <p className="mt-2.5 text-[12px] font-mono" style={{ color: "var(--color-text-secondary)" }}>
                          <span style={{ color: "var(--color-text-muted)" }}>Includes </span>
                          <span className="font-semibold" style={{ color: "#10B981" }}>{tier.clipsIncluded} clips</span>
                          <span style={{ color: "var(--color-text-muted)" }}> / month</span>
                        </p>
                      )}
                      {tier.perClipPrice && (
                        <p className="mt-2.5 text-[12px] font-mono" style={{ color: "var(--color-text-secondary)" }}>
                          {tier.perClipPrice}
                        </p>
                      )}
                      {tier.unitCost && (
                        <p className="mt-1.5 text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                          {tier.unitCost}
                        </p>
                      )}
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
                            style={{ color: isHighlight ? (side === "brands" ? "var(--color-accent)" : side === "clippers" ? "#8B5CF6" : "#10B981") : "var(--color-success)" }}
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

          {/* ════════════ CREATOR PREMIUM DESIGN (creators only) ════════════ */}
          {side === "creators" && (
            <motion.div
              key="creators-premium"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Subheading */}
              <div className="text-center mb-12">
                <h2
                  className="font-display font-semibold tracking-tight"
                  style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", lineHeight: 1.0 }}
                >
                  <span style={{ color: "var(--color-text-primary)" }}>Pay per clip, not </span>
                  <em
                    style={{
                      color: "#FF77E9",
                      fontStyle: "italic",
                      fontFamily: "Georgia, 'Times New Roman', ui-serif, serif",
                    }}
                  >
                    per seat
                  </em>
                  <span style={{ color: "var(--color-text-primary)" }}>.</span>
                </h2>
                <p className="mt-5 text-[15px] max-w-xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                  Start free. Upgrade when you ship. Cancel anytime — your clips stay yours.
                </p>
              </div>

              {/* 3 subscription cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {([
                  {
                    name: "Go",
                    price: "₹499",
                    unit: "/month",
                    tagline: "20 clips · 3 channels",
                    accent: "slate",
                    features: [
                      "20 AI-generated clips per month",
                      "Vertical 9:16 rendering, hardcoded captions",
                      "Hook detection from energy + transcript",
                      "3 YouTube channels connected",
                      "Standard rendering queue (no priority)",
                      "UPI / card billing",
                    ],
                    cta: "Start Go",
                    href: "/signup?plan=creator_go",
                  },
                  {
                    name: "Pro",
                    price: "₹899",
                    unit: "/month",
                    tagline: "50 clips · 10 channels · AI taste-select",
                    accent: "gold",
                    highlight: true,
                    features: [
                      "50 AI-generated clips per month",
                      "AI taste-select (DeepSeek V3) on every video",
                      "Auto-caption + viral-title generation",
                      "10 YouTube channels + upload-from-device",
                      "Priority render queue (3× faster)",
                      "A/B hook variants (3 per clip)",
                      "Email + Discord support",
                    ],
                    cta: "Try Pro free for 7 days",
                    href: "/signup?plan=creator_pro",
                  },
                  {
                    name: "Premium",
                    price: "₹1,999",
                    unit: "/month",
                    tagline: "150 clips · 5 seats · reserved GPU",
                    accent: "violet",
                    features: [
                      "150 AI-generated clips per month",
                      "Everything in Pro, plus:",
                      "Custom branding (logo, color, font on captions)",
                      "Reserved GPU lane (10× faster transcription)",
                      "Team seats (up to 5)",
                      "Priority support — 4h response SLA",
                      "Quarterly strategy call with founders",
                    ],
                    cta: "Go Premium",
                    href: "/signup?plan=creator_premium",
                  },
                ] as const).map((tier, i) => {
                  const accentMap = {
                    slate: { dot: "#94A3B8", border: "rgba(148, 163, 184, 0.35)", check: "#94A3B8" },
                    gold: { dot: "#FCD34D", border: "rgba(252, 211, 77, 0.55)", check: "#FCD34D" },
                    violet: { dot: "#A78BFA", border: "rgba(167, 139, 250, 0.35)", check: "#A78BFA" },
                  } as const;
                  const a = accentMap[tier.accent];
                  const isHi = "highlight" in tier && tier.highlight;
                  return (
                    <motion.div
                      key={tier.name}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="relative rounded-2xl p-7 flex flex-col"
                      style={{
                        background: isHi
                          ? "linear-gradient(180deg, rgba(252, 211, 77, 0.12) 0%, rgba(252, 211, 77, 0.04) 100%)"
                          : "var(--color-surface)",
                        border: `1px solid ${isHi ? a.border : "var(--color-border)"}`,
                        boxShadow: isHi ? "0 1px 0 rgba(252, 211, 77, 0.08) inset" : undefined,
                      }}
                    >
                      {isHi && (
                        <div className="absolute top-4 right-4">
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider"
                            style={{ background: "#FCD34D", color: "#0A0A0B" }}
                          >
                            Most popular
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: a.dot }}
                        />
                        <p
                          className="text-[11px] font-mono uppercase tracking-wider font-semibold"
                          style={{ color: a.dot }}
                        >
                          {tier.name}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span
                          className="font-display font-semibold tracking-tight"
                          style={{ fontSize: "3.5rem", lineHeight: 1, color: "var(--color-text-primary)" }}
                        >
                          {tier.price}
                        </span>
                        {tier.unit && (
                          <span className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
                            {tier.unit}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-mono mb-6" style={{ color: "var(--color-text-muted)" }}>
                        {tier.tagline}
                      </p>

                      <Link
                        href={tier.href}
                        className={
                          isHi
                            ? "btn-primary btn-shine w-full justify-center inline-flex mb-6"
                            : "btn-glass w-full justify-center inline-flex mb-6"
                        }
                      >
                        {tier.cta}
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>

                      <ul className="space-y-2.5">
                        {tier.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2.5 text-[13px]"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            <Check
                              className="h-4 w-4 mt-0.5 shrink-0"
                              style={{ color: a.check }}
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                })}
              </div>

              {/* Enterprise link */}
              <div className="mt-8 text-center">
                <p className="text-[14px]" style={{ color: "var(--color-text-muted)" }}>
                  Need 150+ clips/mo, an enterprise deal, or white-label?{" "}
                  <Link
                    href="/contact?intent=enterprise"
                    className="font-semibold underline"
                    style={{ color: "#FF77E9" }}
                  >
                    See full plans →
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════ AGENCY VOLUME TABLE ════════════ */}
          {isAgency && (
            <motion.div
              key="agencies-volume"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-2"
            >
              <div className="text-center mb-8">
                <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#F97316" }}>
                  Pick your volume. See the per-clip rate.
                </p>
                <p className="text-[13px] max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                  All tiers include every Premium feature. The discount comes from how predictable your volume is — agencies commit monthly, we drop the per-clip rate. Margin stays at 50%+.
                </p>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(249, 115, 22, 0.20)" }}>
                      <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Volume</th>
                      <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Per-clip</th>
                      <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Monthly</th>
                      <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Best for</th>
                      <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-wider text-right" style={{ color: "var(--color-text-muted)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {AGENCY_VOLUMES.map((vol, i) => {
                      const monthly = vol.perClip > 0 ? vol.clipsPerMonth * vol.perClip : null;
                      const isHi = vol.highlight;
                      return (
                        <tr
                          key={vol.clipsPerMonth}
                          style={{
                            borderBottom: i < AGENCY_VOLUMES.length - 1 ? "1px solid rgba(100, 116, 139, 0.10)" : "none",
                            background: isHi ? "rgba(249, 115, 22, 0.04)" : "transparent",
                          }}
                          className="transition-colors hover:bg-[rgba(249,115,22,0.06)]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-display font-semibold text-[15px]" style={{ color: "var(--color-text-primary)" }}>
                                {vol.clipsPerMonth >= 10000 ? "10,000+" : vol.clipsPerMonth.toLocaleString("en-IN")}
                              </span>
                              <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>clips / mo</span>
                              {isHi && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider"
                                  style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", color: "white" }}
                                >
                                  Sweet spot
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-[15px] font-semibold" style={{ color: vol.perClip > 0 ? "#F97316" : "var(--color-text-muted)" }}>
                              {vol.perClip > 0 ? `₹${vol.perClip}` : "Custom"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                              {monthly ? `₹${monthly.toLocaleString("en-IN")}` : "Let's talk"}
                            </span>
                          </td>
                          <td className="px-5 py-4 max-w-[200px]">
                            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                              {vol.bestFor}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={vol.perClip > 0 ? `/contact?intent=agency&volume=${vol.clipsPerMonth}` : "/contact?intent=agency&volume=10000+"}
                              className={isHi ? "btn-primary btn-shine text-[12px] py-1.5 px-3 inline-flex items-center gap-1" : "btn-glass text-[12px] py-1.5 px-3 inline-flex items-center gap-1"}
                            >
                              {vol.cta}
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {AGENCY_VOLUMES.map((vol) => {
                  const monthly = vol.perClip > 0 ? vol.clipsPerMonth * vol.perClip : null;
                  return (
                    <div
                      key={vol.clipsPerMonth}
                      className={`p-5 rounded-2xl ${vol.highlight ? "glass-panel" : "glass-card"}`}
                      style={vol.highlight ? { border: "1px solid rgba(249, 115, 22, 0.30)" } : undefined}
                    >
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="font-display font-semibold text-[20px]" style={{ color: "var(--color-text-primary)" }}>
                          {vol.clipsPerMonth >= 10000 ? "10,000+" : vol.clipsPerMonth.toLocaleString("en-IN")} clips/mo
                        </span>
                        <span className="font-mono text-[18px] font-semibold" style={{ color: "#F97316" }}>
                          {vol.perClip > 0 ? `₹${vol.perClip}` : "Custom"}
                        </span>
                      </div>
                      <p className="text-[12px] mb-6" style={{ color: "var(--color-text-secondary)" }}>
                        {vol.bestFor}
                      </p>
                      <Link
                        href={vol.perClip > 0 ? `/contact?intent=agency&volume=${vol.clipsPerMonth}` : "/contact?intent=agency&volume=10000+"}
                        className="btn-glass w-full justify-center text-[12px] py-2"
                      >
                        {vol.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Custom-volume CTA */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-6 glass-card p-5 relative overflow-hidden text-center"
                style={{ border: "1px solid rgba(249, 115, 22, 0.20)" }}
              >
                <p className="text-[12px] font-mono uppercase tracking-wider mb-1" style={{ color: "#F97316" }}>
                  Custom volume?
                </p>
                <h4 className="font-display font-semibold text-[16px] mb-1" style={{ color: "var(--color-text-primary)" }}>
                  Need 7,500 clips/mo? Or 25,000? Or weird seasonal patterns?
                </h4>
                <p className="text-[12px] mb-3" style={{ color: "var(--color-text-secondary)" }}>
                  We do custom contracts — annual commits, seasonal ramps, multi-tenant white-label.
                </p>
                <Link href="/contact?intent=agency&volume=custom" className="btn-primary btn-shine inline-flex items-center gap-2 text-[12px] py-2">
                  Talk to a founder
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </motion.div>
          )}

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

          {/* ════════════ TRANSPARENCY PANEL (creators only) ════════════ */}
          {side === "creators" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mt-16 relative overflow-hidden"
            >
              <div className="text-center mb-8">
                <SectionMarker num="03" label="Unit economics" centered />
                <h3
                  className="font-display font-semibold tracking-tight mb-2"
                  style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", lineHeight: 1.1, color: "var(--color-text-primary)" }}
                >
                  How we price. <span className="hero-text" style={{ color: "#10B981" }}>50% margin, math included.</span>
                </h3>
                <p className="text-[14px] max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
                  Most SaaS hides the unit economics. We don&apos;t. Here&apos;s exactly what it costs us to generate a clip — and what&apos;s left as profit.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Per-clip cost breakdown */}
                <div className="glass-panel p-6 relative overflow-hidden">
                  <div
                    className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full blur-3xl pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, transparent 70%)" }}
                  />
                  <div className="relative">
                    <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#10B981" }}>
                      Cost per clip
                    </p>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="font-display font-semibold" style={{ fontSize: "2.25rem", lineHeight: 1, color: "var(--color-text-primary)" }}>
                        ₹3.02
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>avg</span>
                    </div>
                    <ul className="space-y-2 text-[12px] font-mono">
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>YouTube fetch (residential proxy)</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹2.74</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Claude hook select</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹0.08</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Render (ffmpeg CPU)</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹0.20</span>
                      </li>
                    </ul>
                    <div className="mt-4 pt-3" style={{ borderTop: "1px dashed rgba(16, 185, 129, 0.20)" }}>
                      <p className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                        Post-campaign: drops to <span style={{ color: "#10B981" }}>₹2.96</span> via DeepSeek V3
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixed cost table */}
                <div className="glass-panel p-6 relative overflow-hidden">
                  <div
                    className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full blur-3xl pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.10) 0%, transparent 70%)" }}
                  />
                  <div className="relative">
                    <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#8B5CF6" }}>
                      Fixed infra · monthly
                    </p>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="font-display font-semibold" style={{ fontSize: "2.25rem", lineHeight: 1, color: "var(--color-text-primary)" }}>
                        ₹7,238
                      </span>
                    </div>
                    <ul className="space-y-2 text-[12px] font-mono">
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Claude API</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹2,800</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Hetzner VPS</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹1,492</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Hermes M3 agent</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹1,452</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>RunPod transcription</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹830</span>
                      </li>
                      <li className="flex justify-between">
                        <span style={{ color: "var(--color-text-muted)" }}>Residential proxy</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>₹664</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Margin by tier */}
                <div className="glass-panel p-6 relative overflow-hidden">
                  <div
                    className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full blur-3xl pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(252, 211, 77, 0.10) 0%, transparent 70%)" }}
                  />
                  <div className="relative">
                    <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#FCD34D" }}>
                      Net margin per tier
                    </p>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="font-display font-semibold" style={{ fontSize: "2.25rem", lineHeight: 1, color: "var(--color-text-primary)" }}>
                        59–88<span style={{ fontSize: "1.25rem", color: "var(--color-text-muted)" }}>%</span>
                      </span>
                    </div>
                    <ul className="space-y-2 text-[12px] font-mono">
                      <li className="flex justify-between items-center">
                        <span style={{ color: "var(--color-text-muted)" }}>Go</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(16, 185, 129, 0.10)", color: "#10B981" }}>59%</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span style={{ color: "var(--color-text-muted)" }}>Pro</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>67%</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span style={{ color: "var(--color-text-muted)" }}>Premium</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(16, 185, 129, 0.20)", color: "#10B981" }}>70%</span>
                      </li>
                      <li className="flex justify-between items-center">
                        <span style={{ color: "var(--color-text-muted)" }}>Enterprise (per-clip)</span>
                        <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(252, 211, 77, 0.15)", color: "#FCD34D" }}>88%</span>
                      </li>
                    </ul>
                    <div className="mt-4 pt-3" style={{ borderTop: "1px dashed rgba(252, 211, 77, 0.20)" }}>
                      <p className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                        Break-even: <span style={{ color: "#FCD34D" }}>12 paying customers</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DeepSeek migration banner */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-6 glass-card p-5 relative overflow-hidden"
                style={{ border: "1px solid rgba(16, 185, 129, 0.25)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #10B981 0%, #14B8A6 100%)" }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-mono uppercase tracking-wider mb-1" style={{ color: "#10B981" }}>
                      Roadmap · post-campaign
                    </p>
                    <h4 className="font-display font-semibold text-[17px] mb-1" style={{ color: "var(--color-text-primary)" }}>
                      We&apos;re swapping Claude for DeepSeek V3. You keep the savings.
                    </h4>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      Post-launch, we&apos;ll switch hook selection from Claude Haiku to DeepSeek V3 — 10× cheaper per call,
                      same quality for taste-select. <span style={{ color: "#10B981", fontWeight: 600 }}>Existing customers get a price lock at current rates for 6 months</span>,
                      and new Pro subscribers start at ₹799 (down from ₹899) once we cross 100 paying users.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ════════════ 03 · FAQ ════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <SectionMarker num="04" label="FAQ" centered />
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
          <SectionMarker num="05" label="Not sure?" centered />
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
