"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, Zap, Shield, Crown, ArrowRight } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (planId: string) => void;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  onSelectPlan,
}: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        {/* Backdrop click to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl bg-[#0E0F14] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden z-10"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-32 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-3">
              <Crown size={13} className="text-amber-400" />
              Creator Growth Plans
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Upgrade your plan
            </h2>
            <p className="text-sm text-zinc-400">
              Get watermark-free 4K exports, auto-reframe, and automated cross-platform posting.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-full mt-5">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  billingCycle === "monthly"
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition ${
                  billingCycle === "yearly"
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Yearly
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* 3 Tier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Starter Tier */}
            <div className="bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl p-5 flex flex-col justify-between transition group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-white">Starter</h3>
                  <span className="text-[11px] font-medium text-zinc-400 bg-white/5 px-2 py-0.5 rounded">
                    40 clips/mo
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">
                      ${billingCycle === "yearly" ? "4.79" : "5.99"}
                    </span>
                    <span className="text-xs text-zinc-400">/ month</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {billingCycle === "yearly" ? "Billed $57.48 annually" : "Billed monthly"}
                  </p>
                </div>

                <button
                  onClick={() => onSelectPlan?.("starter")}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 mb-5"
                >
                  Get Starter
                  <ArrowRight size={13} />
                </button>

                <div className="space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span><b>40 viral clips</b> / month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>AI virality scoring & hook detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>9:16 vertical dynamic face framing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>Karaoke word-by-word subtitles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>No RelatiV watermark</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Check size={14} className="text-zinc-400 shrink-0" />
                    <span>Up to 30 min source video length</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Pro Tier (Highlighted) */}
            <div className="relative bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-2 border-cyan-400/60 rounded-xl p-5 flex flex-col justify-between shadow-lg shadow-cyan-500/10 transition group">
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md shadow">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-white">Pro Studio</h3>
                  <span className="text-[11px] font-medium text-zinc-300 bg-white/10 px-2 py-0.5 rounded border border-white/10">
                    90 clips/mo
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">
                      ${billingCycle === "yearly" ? "9.59" : "11.99"}
                    </span>
                    <span className="text-xs text-zinc-400">/ month</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {billingCycle === "yearly" ? "Billed $115 annually" : "Billed monthly"}
                  </p>
                </div>

                <button
                  onClick={() => onSelectPlan?.("pro")}
                  className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition flex items-center justify-center gap-1.5 shadow mb-5 cursor-pointer"
                >
                  Get Pro Studio
                  <Zap size={14} className="fill-black" />
                </button>

                <div className="space-y-2.5 text-xs text-zinc-200">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span><b>90 viral clips</b> / month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span><b>All 4 Content Archetypes</b> (Streamer, Gaming, Podcast, Edu)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>1-Click Multi-Platform Auto Publisher (TikTok, Shorts, Reels)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>Auto B-roll insertion & AI Emojis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>Fast priority GPU processing queue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-cyan-400 shrink-0" />
                    <span>Up to 90 min source video length</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Business Tier */}
            <div className="bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl p-5 flex flex-col justify-between transition group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-white">Agency & Brand</h3>
                  <span className="text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    Unlimited
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">Custom</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Tailored for media houses & creator teams
                  </p>
                </div>

                <a
                  href="mailto:contact@relativclips.com?subject=Agency%20Plan%20Inquiry"
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 mb-5"
                >
                  Contact Founder
                  <ArrowRight size={13} />
                </a>

                <div className="space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-purple-400 shrink-0" />
                    <span>Unlimited clips & source hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-purple-400 shrink-0" />
                    <span>Team seats & shared brand templates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-purple-400 shrink-0" />
                    <span>Dedicated GPU compute instance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-purple-400 shrink-0" />
                    <span>Custom subtitle typography & branding</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-purple-400 shrink-0" />
                    <span>API & Webhook integrations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Guarantee */}
          <div className="mt-8 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-emerald-400" />
              <span>Cancel anytime in 1 click. Instant activation.</span>
            </div>
            <span>Need custom quotas? Contact support@relativclips.com</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
