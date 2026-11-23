"use client";

/**
 * /plans — RelatiV Clips Creator Pricing
 *
 * Streamlined creator-only pricing architecture:
 * - 3 Creator Plans powered by Polar: Go, Pro Studio, and Max
 * - Zero audience selector / tabs: Clean, immediate display of creator plans
 * - Enterprise scale callout for 150+ clips / team accounts
 * - Creator-focused FAQ accordion
 * - Final 20-minute consultation CTA
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ChevronDown,
  ArrowRight,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { getAppDashboardUrl } from "@/lib/domain";
import InteractiveTierCards from "@/components/pricing/InteractiveTierCards";

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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="relative w-full bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-[#F4F6FA] selection:bg-amber-400 selection:text-black overflow-hidden transition-colors">
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

        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 02: 3 INTERACTIVE CREATOR PRICING CARDS
            ══════════════════════════════════════════════════════════ */}
        <section className="mb-14">
          <InteractiveTierCards />
        </section>

          {/* ══════════════════════════════════════════════════════════
              SECTION 03: ENTERPRISE CALLOUT FOR HIGH-VOLUME CREATORS
              ══════════════════════════════════════════════════════════ */}
          <div className="mt-8 sm:mt-10 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0B0D12] p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-sm dark:shadow-lg">
            <div className="space-y-1">
              <h3 className="font-display font-semibold text-lg text-zinc-900 dark:text-white">
                Need more with API endpoint or custom volume?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-sans max-w-2xl">
                High-volume processing pipelines, dedicated GPU compute instances, webhook callbacks, and developer REST API access.
              </p>
            </div>
            <Link
              href="/contact?intent=api"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-black/[0.04] hover:bg-black/[0.08] text-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white/15 dark:text-white border border-black/10 dark:border-white/10 transition-all shrink-0"
            >
              <span>Contact us</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

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
