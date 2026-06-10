"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoCard from "@/components/BentoCard";
import PhysicsIcon from "@/components/PhysicsIcon";

const FAQS = [
  { q: "How does the AI select viral moments?", a: "Our pipeline combines spectral audio analysis (Librosa), semantic LLM evaluation (Claude 3.5 Sonnet), and visual engagement signals (YOLOv10 face tracking) to identify high-signal segments with surgical precision." },
  { q: "Is my data private?", a: "Yes. All processing happens locally on your GPU. Zero video data, audio, or frames ever leave your machine. No cloud dependencies, no uploads, no privacy compromise." },
  { q: "What hardware do I need?", a: "An NVIDIA GPU with at least 8GB VRAM (tested on RTX 5050). The pipeline uses CUDA-accelerated Whisper for transcription and YOLOv10 for face detection." },
  { q: "Can I process local files?", a: "Yes. The local pipeline supports MP4, AVI, MOV, and WebM files. There is no file size limit — processing is bounded only by your available disk space and VRAM." },
  { q: "What output formats are supported?", a: "Clips are rendered as 608x1080 vertical MP4s (9:16 aspect ratio) with embedded subtitles, optimized for TikTok, YouTube Shorts, and Instagram Reels." },
];

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    symbol: "\u03B5",
    features: [
      "3 clips per video",
      "720p output",
      "YouTube URL support",
      "Basic transcription",
    ],
    cta: "Current Plan",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    symbol: "\u03A6",
    features: [
      "Unlimited clips",
      "1080p output",
      "YouTube + local files",
      "Face tracking",
      "AI virality scoring",
      "Batch processing",
    ],
    cta: "Upgrade",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$49",
    symbol: "\u03A3",
    features: [
      "Everything in Pro",
      "4K output",
      "API access",
      "Custom pipeline config",
      "Priority support",
      "Team collaboration",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PlansPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [ctaFeedback, setCtaFeedback] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-sm font-mono text-accent">
            [\u03A6-Pricing]
          </span>
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-3">
          Pricing <span className="text-accent">Plans</span>
        </h1>
        <p className="text-base text-text-muted font-sans">
          Scale your clipping pipeline with the right plan.
        </p>
      </motion.div>

      <div className="bento-grid max-w-5xl mx-auto">
        {PLANS.map((plan, i) => (
          <BentoCard
            key={i}
            colSpan={4}
            glow={plan.popular ? "accent" : "none"}
            className={
              plan.popular
                ? "relative border-accent/50"
                : ""
            }
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-[10px] font-mono text-white rounded-[2px]">
                [\u03A6] Optimal
              </div>
            )}
            <div className="space-y-6 pt-2">
              <div className="text-center">
                <PhysicsIcon symbol={plan.symbol} label={plan.name} />
                <div className="mt-4">
                  <span className="text-3xl font-display font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-sm text-text-muted font-sans">
                    /month
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {plan.features.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-sm text-text-muted font-sans"
                  >
                    <span className="text-accent-secondary text-xs">\u2713</span>
                    {f}
                  </div>
                ))}
              </div>

              <motion.button
                onClick={() => {
                  if (plan.name === "Enterprise") {
                    window.location.href = "/contact";
                  } else {
                    setCtaFeedback(plan.name === "Starter" ? "You're on the Starter plan." : "Pro plan sign-up coming soon.");
                    setTimeout(() => setCtaFeedback(null), 3000);
                  }
                }}
                className={`w-full py-3 text-sm font-semibold rounded-[4px] font-sans ${
                  plan.popular
                    ? "bg-accent text-white"
                    : "bg-border text-text-muted hover:text-white"
                }`}
                whileHover={
                  plan.popular
                    ? { scale: 1.02, boxShadow: "0 0 20px rgba(77,77,255,0.3)" }
                    : { scale: 1.02 }
                }
                whileTap={{ scale: 0.98 }}
              >
                {plan.cta}
              </motion.button>
            </div>
          </BentoCard>
        ))}

        {/* CTA feedback toast */}
        <AnimatePresence>
          {ctaFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 p-3 bg-accent/10 border border-accent/20 rounded-[2px] text-center"
            >
              <span className="text-sm text-accent font-sans">{ctaFeedback}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        className="mt-20 max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="text-sm font-mono text-accent">[ \u03A6-FAQ ]</span>
          <div className="h-px flex-1 max-w-[200px] bg-gradient-to-r from-accent/30 to-transparent" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white text-center mb-2">Frequently Asked Questions</h2>
        <p className="text-sm text-text-muted text-center mb-8">Everything you need to know about the RelatiV pipeline.</p>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="border border-border rounded-[2px] overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 bg-surface hover:bg-white/5 transition-colors text-left"
                aria-expanded={openFaq === i}
              >
                <span className="text-sm font-sans text-white">{faq.q}</span>
                <motion.span
                  className="font-mono text-xs text-accent shrink-0 ml-4"
                  animate={{ rotate: openFaq === i ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 pt-2">
                      <p className="text-sm text-text-muted font-sans leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
