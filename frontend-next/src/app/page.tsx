"use client";

import { motion } from "framer-motion";
import { Zap, Download, Link2 } from "lucide-react";

import HeroStudio from "@/components/HeroStudio";
import OwnYourTaste from "@/components/OwnYourTaste";
import TasteTimeline from "@/components/TasteTimeline";
import StickyInputBar from "@/components/StickyInputBar";
import SolutionsSection from "@/components/SolutionsSection";
import StudioTower from "@/components/StudioTower";
import styles from "./homepage.module.css";

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
    <div className={`${styles.page} relative min-h-screen w-full overflow-x-clip text-white selection:bg-amber-400 selection:text-black`}>
      <div className={styles.backdrop} aria-hidden="true" />

      {/* ── Unobtrusive Floating Bottom Conversion Dock ── */}
      <StickyInputBar />

      {/* ── HERO: Kinetic Long-Form In -> Short-Form Out (Client Spec) ── */}
      <HeroStudio />

      {/* ── MANIFESTO TRANSITION: Glass word collision ── */}
      <OwnYourTaste />

      <TasteTimeline />

      <StudioTower />

      {/* ── SECTION: SOLUTIONS FOR EVERY CREATOR & TEAM ── */}
      <SolutionsSection />

      {/* ── SECTION 03: HOW IT WORKS (3 Simple Steps) ── */}
      <section className="relative py-16 px-4 sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-[1600px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 flex flex-col items-center text-center sm:mb-14"
          >
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Three steps. <span className="text-amber-400">Ten viral clips.</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm text-zinc-400 sm:text-base">
              No complex timelines. No keyframing. Faster than a coffee break.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 sm:gap-6">
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.12 }}
                className="relative flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-950/90 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-lg"
              >
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <span className="font-mono text-2xl font-extrabold" style={{ color: step.accent }}>{step.num}</span>
                    <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <step.icon className="size-[18px]" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">{step.body}</p>
                </div>
                <div className="mt-8 flex items-center border-t border-white/10 pt-4 font-mono text-[10px] text-zinc-400">
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
