"use client";

/**
 * /plans — RelatiV Clips Creator Pricing
 *
 * Streamlined creator-only pricing architecture:
 * - 3 Creator Plans: Go (₹499/mo), Pro (₹899/mo — Featured), Premium (₹1,999/mo)
 * - Zero audience selector / tabs: Clean, immediate display of creator plans
 * - Enterprise scale callout for 150+ clips / team accounts
 * - Creator-focused FAQ accordion
 * - Final 20-minute consultation CTA
 */

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ArrowRight,
  Loader2,
  CreditCard,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getAppDashboardUrl } from "@/lib/domain";
import {
  createRazorpayOrder,
  openRazorpayCheckout,
  verifyRazorpayPayment,
  type RazorpayPayment,
} from "@/lib/razorpay";

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
  planKey?:
    | "creator_go"
    | "creator_pro"
    | "creator_premium"
    | "creator_enterprise";
  clipsIncluded?: number;
}

const CREATOR_TIERS: Tier[] = [
  {
    name: "Go",
    price: "$5.99",
    unit: "/month",
    cta: "Get Go",
    href: "/signup?plan=creator_starter",
    bestFor: "Solo creators dipping toes in",
    clipsIncluded: 100,
    features: [
      "20,000 credits · up to 100 clips / month",
      "AI virality scoring & hook detection",
      "9:16 vertical dynamic face framing",
      "Karaoke word-by-word subtitles",
      "No RelatiV watermark",
      "Up to 30 min source video length",
      "1 active processing task at a time",
      "Exports available for 7 days",
      "Global card billing (Visa, Mastercard, Amex)",
    ],
    planKey: "creator_go",
  },
  {
    name: "Pro Studio",
    price: "$11.99",
    unit: "/month",
    cta: "Get Pro Studio",
    href: "/signup?plan=creator_pro",
    highlight: true,
    bestFor: "Active creators shipping 2-3 videos/week",
    clipsIncluded: 90,
    cpmHint: "Best value · 90 clips/mo",
    features: [
      "90 viral clips / month",
      "All 4 Content Archetypes (Streamer, Gaming, Podcast, Edu)",
      "1-Click Multi-Platform Auto Publisher (TikTok, Shorts, Reels)",
      "Auto B-roll insertion & AI Emojis",
      "Fast priority GPU processing queue",
      "Up to 90 min source video length",
      "Priority Discord & Email support",
    ],
    planKey: "creator_pro",
  },
  {
    name: "Agency & Brand",
    price: "Custom",
    unit: "",
    cta: "Contact us",
    href: "/contact?intent=enterprise",
    bestFor: "Media houses, podcast networks, power creators",
    clipsIncluded: 999,
    cpmHint: "Unlimited capacity",
    features: [
      "Unlimited clips & source hours",
      "Team seats & shared brand templates",
      "Dedicated GPU compute instance",
      "Custom subtitle typography & branding",
      "API & Webhook integrations",
      "Dedicated account manager & SLA",
    ],
    planKey: "creator_premium",
  },
];

const CREATOR_FAQS = [
  {
    q: "Can I switch between plans?",
    a: "Yes. You can upgrade or downgrade your creator plan at any time from your dashboard. Upgrades take effect immediately with prorated billing, and downgrades apply at the next billing cycle.",
  },
  {
    q: "Is there a free trial before subscribing?",
    a: "You can try RelatiV directly in the studio for free with no credit card required to test hook detection and caption quality before subscribing to a paid creator plan.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes. There are no annual lock-in contracts. You can cancel your subscription anytime directly from your account settings with a single click.",
  },
  {
    q: "How does the pricing per clip work?",
    a: "We sized the tiers so the cost per clip drops as you scale: ~$0.15/clip on Starter and ~$0.13/clip on Pro Studio. Each tier includes full AI hook detection, automated karaoke captions, and 9:16 vertical framing.",
  },
  {
    q: "Can I connect multiple YouTube channels?",
    a: "Yes. Starter connects up to 3 channels, Pro Studio connects up to 10 channels plus direct local file uploads, and Agency supports unlimited team accounts.",
  },
  {
    q: "What payment methods are supported worldwide?",
    a: "We accept all major international payment methods including Visa, Mastercard, American Express, Apple Pay, and Google Pay with secure 1-click checkout.",
  },
];

export default function PlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [razorpayReady, setRazorpayReady] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSubscribe = async (tier: Tier) => {
    if (!tier.planKey) return;
    setCheckoutError(null);

    if (!user) {
      router.push(`/signup?next=${encodeURIComponent("/plans")}`);
      return;
    }

    setLoadingPlan(tier.planKey);
    try {
      const order = await createRazorpayOrder({ plan: tier.planKey });
      openRazorpayCheckout(order, {
        onSuccess: async (payment: RazorpayPayment) => {
          try {
            const result = await verifyRazorpayPayment(payment);
            if (!result.success) {
              setCheckoutError(result.message || "Payment is awaiting confirmation. Do not pay again.");
              return;
            }
            router.push(`/account?billing=success&plan=${encodeURIComponent(tier.planKey!)}`);
          } catch (error) {
            setCheckoutError(`${error instanceof Error ? error.message : "Payment verification failed."} Do not pay again; contact support with your payment ID.`);
          } finally {
            setLoadingPlan(null);
          }
        },
        onDismiss: () => setLoadingPlan(null),
        onFailure: (message) => {
          setCheckoutError(message);
          setLoadingPlan(null);
        },
      });
    } catch (error: unknown) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed. Try again in a moment.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative w-full bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-[#F4F6FA] selection:bg-amber-400 selection:text-black overflow-hidden transition-colors">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setRazorpayReady(true)}
        onError={() => setCheckoutError("Razorpay Checkout could not load. Check your connection and reload the page.")}
      />
      {/* ── Subtle Background Grid & Atmospheric Illumination ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#D1D5DB_1px,transparent_1px)] dark:bg-[radial-gradient(#1A1F2C_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-indigo-500/10 via-purple-500/05 to-transparent blur-[140px]" />

      {/* ── Main Content Grid (1160px Max Width) ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14 sm:py-20">
        {/* ══════════════════════════════════════════════════════════
            SECTION 01: PRICING INTRODUCTION (Center-aligned Hero)
            ══════════════════════════════════════════════════════════ */}
        <section className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-14">
          {/* Understated Monospace Telemetry Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/[0.08] text-xs font-mono text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
            <span>[Φ-PRICING] · CREATOR PLANS</span>
          </div>

          {/* Editorial Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-[64px] font-bold font-display tracking-tight text-zinc-900 dark:text-white leading-[1.08]">
            Pay for outcomes. <br />
            <span className="text-zinc-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_35px_rgba(255,255,255,0.35)]">
              Not retainers.
            </span>
          </h1>

          {/* Supporting Copy — Creator-Focused */}
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto font-sans leading-relaxed pt-1">
            Simple, transparent plans for creators. Choose the tools and monthly capacity that fit your workflow.
          </p>

          {checkoutError && (
            <div className="mt-3 px-4 py-2 rounded-xl text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center font-sans max-w-md mx-auto">
              {checkoutError}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 02: 3 CREATOR PRICING CARDS (Go, Pro, Premium)
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {CREATOR_TIERS.map((tier) => {
              const isHighlight = tier.highlight;
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 backdrop-blur-xl group ${
                    isHighlight
                      ? "bg-[#FAFCFF] dark:bg-[#0E1118] border border-amber-500/70 dark:border-amber-400/80 shadow-md hover:shadow-2xl dark:shadow-[0_0_40px_rgba(251,191,36,0.18)] z-10"
                      : "bg-white dark:bg-[#0B0D12] border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 shadow-sm hover:shadow-xl dark:shadow-xl"
                  }`}
                >
                  {/* Top Ambient Highlight on Featured Pro Card */}
                  {isHighlight && (
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent pointer-events-none rounded-t-3xl" />
                  )}

                  {/* Top Content Block */}
                  <div>
                    {/* 1. Plan Name & Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-display text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {tier.name}
                      </span>
                      {isHighlight && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400 text-black shadow-md shadow-amber-400/20">
                          Most popular
                        </span>
                      )}
                    </div>

                    {/* 2. Short Description */}
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans mb-4 min-h-[32px]">
                      Best for {tier.bestFor}
                    </p>

                    {/* 3 & 4. Price & Billing Period */}
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="font-display font-bold text-4xl sm:text-5xl text-zinc-900 dark:text-white tracking-tight">
                        {tier.price}
                      </span>
                      {tier.unit && (
                        <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-sans">
                          {tier.unit}
                        </span>
                      )}
                    </div>

                    {/* 5. Supporting Plan Information */}
                    <div className="min-h-[24px] mb-6">
                      {tier.clipsIncluded ? (
                        <p className="text-xs font-sans text-cyan-600 dark:text-cyan-400 font-medium">
                          Includes {tier.clipsIncluded} AI clips / month
                        </p>
                      ) : tier.cpmHint ? (
                        <p className="text-xs font-sans text-zinc-600 dark:text-zinc-400">
                          {tier.cpmHint}
                        </p>
                      ) : null}
                    </div>

                    {/* 6. Primary Plan CTA */}
                    <div className="mb-6">
                      {user && tier.planKey ? (
                        <button
                          type="button"
                          onClick={() => handleSubscribe(tier)}
                          disabled={!razorpayReady || loadingPlan === tier.planKey}
                          className={`w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] inline-flex items-center justify-center gap-2 cursor-pointer ${
                            isHighlight
                              ? "bg-[#111318] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 shadow-md"
                              : "bg-black/[0.04] hover:bg-black/[0.08] text-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white/15 dark:text-white border border-black/10 dark:border-white/10"
                          }`}
                        >
                          {loadingPlan === tier.planKey ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Opening Checkout…</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4" />
                              <span>{tier.cta}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href={tier.href}
                          className={`w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-[0.98] inline-flex items-center justify-center gap-2 ${
                            isHighlight
                              ? "bg-[#111318] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 shadow-md"
                              : "bg-black/[0.04] hover:bg-black/[0.08] text-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white/15 dark:text-white border border-black/10 dark:border-white/10"
                          }`}
                        >
                          <span>{tier.cta}</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>

                    {/* 7. Feature Divider */}
                    <div className="border-t border-black/[0.08] dark:border-white/[0.08] pt-6 mb-3">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 block">
                        What&apos;s included
                      </span>
                    </div>

                    {/* 8. Feature List */}
                    <ul className="space-y-3">
                      {tier.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed"
                        >
                          <Check
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              isHighlight
                                ? "text-amber-500 dark:text-amber-400"
                                : "text-cyan-600 dark:text-cyan-400"
                            }`}
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECTION 03: ENTERPRISE CALLOUT FOR HIGH-VOLUME CREATORS
              ══════════════════════════════════════════════════════════ */}
          <div className="mt-8 sm:mt-10 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0B0D12] p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-sm dark:shadow-lg">
            <div className="space-y-1">
              <h3 className="font-display font-semibold text-lg text-zinc-900 dark:text-white">
                Need custom volume, team accounts, or dedicated GPU lanes?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-sans max-w-2xl">
                Our Agency & Enterprise tier starts with volume discounts, no watermark, dedicated compute, and custom API integrations.
              </p>
            </div>
            <Link
              href="/contact?intent=enterprise"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-black/[0.04] hover:bg-black/[0.08] text-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white/15 dark:text-white border border-black/10 dark:border-white/10 transition-all shrink-0"
            >
              <span>Contact Enterprise</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 04: FREQUENTLY ASKED QUESTIONS (Creator-Focused)
            ══════════════════════════════════════════════════════════ */}
        <section className="mt-20 sm:mt-24 pt-12 border-t border-black/[0.08] dark:border-white/[0.08]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left Column (35%) — Sticky Header & Context */}
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-28 self-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/[0.08] text-xs font-mono text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                <span>FREQUENTLY ASKED</span>
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight leading-tight">
                Things creators ask first.
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                Everything you need to know about creator plans, clip limits, billing, and cancellations.
              </p>
              <div className="pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                >
                  <span>Have a specific question? Ask our team</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Column (65%) — Clean Accordion Rows */}
            <div className="lg:col-span-8 space-y-3">
              {CREATOR_FAQS.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={item.q}
                    className="rounded-2xl border border-black/10 dark:border-white/[0.08] bg-white dark:bg-[#0B0D12] overflow-hidden hover:border-black/20 dark:hover:border-white/20 shadow-sm dark:shadow-none transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 sm:p-5 text-left cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="font-sans font-medium text-sm sm:text-base text-zinc-900 dark:text-white">
                        {item.q}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 text-zinc-400"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans border-t border-black/[0.04] dark:border-white/[0.04] pt-3">
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 05: FINAL CONSULTATION CTA (Unified Width Banner)
            ══════════════════════════════════════════════════════════ */}
        <section className="mt-20 sm:mt-24 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-gradient-to-b dark:from-[#0B0D12] dark:to-black p-10 sm:p-14 text-center space-y-6 shadow-lg dark:shadow-2xl relative overflow-hidden">
          {/* Subtle top illuminated gradient edge */}
          <div
            className="absolute inset-x-0 -top-px h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.4) 30%, rgba(245, 158, 11, 0.4) 70%, transparent 100%)",
            }}
          />

          <div className="max-w-xl mx-auto space-y-3">
            <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              NOT SURE WHICH PLAN FITS?
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-zinc-900 dark:text-white tracking-tight">
              Talk to us. 20 minutes.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
              We&apos;ll look at your channel or creator workflow together, review volume estimates, and find the right setup. No aggressive sales pitch.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#111318] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              <MessageSquare className="w-4 h-4 text-white dark:text-black" />
              <span>Book a 20-min call</span>
            </Link>

            <Link
              href={getAppDashboardUrl()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-zinc-800 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-300 dark:hover:text-white font-medium text-sm border border-black/10 dark:border-white/10 transition-all"
            >
              <span>Try studio free first</span>
              <ArrowRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
