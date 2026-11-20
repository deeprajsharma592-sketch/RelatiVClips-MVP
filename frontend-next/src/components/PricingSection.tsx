"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, ArrowRight, Sparkles, Zap } from "lucide-react";

export default function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-16 sm:py-20 px-4 sm:px-6 bg-[#07080C] text-white">
      <div className="max-w-5xl mx-auto">
        {/* Header & Annual Toggle */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-mono text-zinc-400 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>TRANSPARENT PRICING</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Simple plans.{" "}
            <span className="text-amber-400">Cancel anytime.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400">
            Start for free during the public beta. Upgrade when you need more minutes and 1080p 60fps export.
          </p>

          {/* Monthly / Annual Pill Toggle */}
          <div className="mt-6 inline-flex items-center p-1 rounded-full border border-white/10 bg-zinc-900/90 text-xs font-medium">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full transition-all ${
                !annual ? "bg-white text-black shadow-sm font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                annual ? "bg-white text-black shadow-sm font-semibold" : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500 text-white">
                Save 30%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Free Tier */}
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <p className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                Starter
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-xs text-zinc-500 font-mono">/ forever</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Ideal for testing the clipping engine on individual videos.
              </p>

              <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>60 processing minutes / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>AI Virality Hook Scoring</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>720p HD export</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Subtle RelatiV watermark</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/signup"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all text-center"
              >
                Start for free
              </Link>
            </div>
          </div>

          {/* Pro Clipper Tier (Featured / Popular) */}
          <div className="relative rounded-2xl border border-amber-500/50 bg-gradient-to-b from-amber-950/30 via-zinc-950 to-zinc-950 p-6 flex flex-col justify-between shadow-[0_0_40px_rgba(245,158,11,0.15)] scale-[1.02] z-10">
            {/* Popular Pill */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-black shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-black" />
              <span>Most Popular</span>
            </div>

            <div>
              <p className="text-sm font-mono font-semibold text-amber-400 uppercase tracking-wider">
                Pro Clipper
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  ${annual ? "14" : "19"}
                </span>
                <span className="text-xs text-zinc-500 font-mono">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                For serious creators and clippers publishing daily short-form content.
              </p>

              <ul className="mt-6 space-y-3 text-xs text-zinc-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>300 processing minutes / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>No watermark · 100% white-label</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>1080p 60fps Ultra HD rendering</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Word-by-word animated karaoke captions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>AI Face Tracking & Auto-Reframe</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Priority render queue (3x faster)</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/signup?plan=pro"
                className="w-full inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-all text-center shadow-lg"
              >
                <span>Get Pro Clipper</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Agency / Studio Tier */}
          <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <p className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                Studio & Agency
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  ${annual ? "39" : "49"}
                </span>
                <span className="text-xs text-zinc-500 font-mono">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                For editing agencies managing multiple creator channels and brand campaigns.
              </p>

              <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1,000 processing minutes / month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Everything in Pro Clipper</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Bulk batch intake (10 videos at once)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multi-seat team workspace (3 seats)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom brand fonts & color templates</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated Discord / Slack support</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/signup?plan=agency"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all text-center"
              >
                Get Agency Plan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
