"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Crown, ArrowRight, Code2 } from "lucide-react";
import InteractiveTierCards from "@/components/pricing/InteractiveTierCards";

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
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        {/* Backdrop click to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative w-full max-w-5xl bg-[#0A0B0E] border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl overflow-y-auto max-h-[94vh] z-10"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-32 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition z-20 cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 font-display">
              Upgrade your plan
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-sans">
              Get watermark-free 4K exports, auto-reframe, and automated cross-platform posting.
            </p>
          </div>

          {/* ── 3 INTERACTIVE TIER FLIP CARDS ── */}
          <InteractiveTierCards onSelectPlan={onSelectPlan} />

          {/* API Endpoint & Custom Volume Callout */}
          <div className="mt-8 p-4 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Code2 size={15} className="text-cyan-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Need more with API endpoint?
                </div>
                <div className="text-[11px] text-zinc-400">
                  Custom high-volume pipelines, dedicated instances, and automated webhook integrations.
                </div>
              </div>
            </div>
            <Link
              href="/contact?intent=api"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              <span>Contact us</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Footer Guarantee */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 font-mono">
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
