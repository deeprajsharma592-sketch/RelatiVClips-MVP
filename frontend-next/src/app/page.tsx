"use client";

import { motion } from "framer-motion";
import { Zap, Download, Link2 } from "lucide-react";

import HeroStudio from "@/components/HeroStudio";
import OwnYourTaste from "@/components/OwnYourTaste";
import TasteTimeline from "@/components/TasteTimeline";
import CreatorProof from "@/components/CreatorProof";
import MovingClipsGrid from "@/components/MovingClipsGrid";
import StickyInputBar from "@/components/StickyInputBar";
import SolutionsSection from "@/components/SolutionsSection";

const STEPS = [
  {
    num: "01",
    icon: Link2,
    title: "Paste a URL",
    body: "Drop a YouTube, Zoom, or Drive link. No video editing timeline, no software download, works on any public footage.",
    accent: "#38BDF8",
  },
  {
    num: "02",
    icon: Zap,
    title: "Engine runs",
    body: "Audio intelligence transcribes and scores energy peaks to isolate high-retention moments using RelatiVSauce AI.",
    accent: "#F59E0B",
  },
  {
    num: "03",
    icon: Download,
    title: "Ship viral clips",
    body: "Auto-reframe 9:16 vertical crop. Word-by-word dynamic karaoke captions. Viral hook titles. Download or post directly.",
    accent: "#10B981",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-clip [--homepage-hero-surface:#050507] bg-[#F7F8FA] dark:bg-[#050507] text-[#111318] dark:text-white selection:bg-amber-400 selection:text-black">
      {/* ── Unobtrusive Floating Bottom Conversion Dock ── */}
      <StickyInputBar />

      {/* ── HERO: Kinetic Long-Form In -> Short-Form Out (Client Spec) ── */}
      <HeroStudio />

      {/* ── MANIFESTO TRANSITION: Glass word collision ── */}
      <OwnYourTaste />

      <TasteTimeline />

      {/* ── SOCIAL PROOF & CREATOR METRICS (Opus Style Authority) ── */}
      <CreatorProof />

      {/* ── SECTION 02: THE OUTPUT SHOWCASE (6 Vertical 9:16 Clips) ── */}
      <MovingClipsGrid />

      {/* ── SECTION: SOLUTIONS FOR EVERY CREATOR & TEAM ── */}
      <SolutionsSection />

      {/* ── SECTION 03: HOW IT WORKS (3 Simple Steps) ── */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6 bg-[#F0F2F6] dark:bg-[#07080C] border-t border-black/[0.06] dark:border-white/5">
        <div className="w-full max-w-[1600px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center mb-12 sm:mb-14"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Three steps. <span className="text-amber-500 dark:text-amber-400">Ten viral clips.</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-lg">
              No complex timelines. No keyframing. Faster than a coffee break.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.12 }}
                className="relative rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-zinc-950/80 p-6 flex flex-col justify-between shadow-sm dark:shadow-none hover:border-black/20 dark:hover:border-white/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className="text-2xl font-mono font-extrabold"
                      style={{ color: step.accent }}
                    >
                      {step.num}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center">
                      <step.icon className="w-5 h-5 text-zinc-900 dark:text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {step.body}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-black/[0.06] dark:border-white/5 flex items-center text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                  <span>Fully automated pipeline</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
