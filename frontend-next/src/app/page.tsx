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

      {/* ── HOW IT WORKS ── */}
      <section className="relative isolate overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[34rem] max-w-6xl bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.11),transparent_68%)]" />
        <div className="mx-auto w-full max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 flex flex-col items-center text-center sm:mb-16"
          >
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              How RelatiV works
            </span>
            <h2 className="max-w-4xl text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl md:text-5xl lg:text-6xl">
              Three simple steps. <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 bg-clip-text text-transparent">Ten viral clips.</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Drop in your video. RelatiV finds the moments, shapes them for every feed, and gets them ready to share.
            </p>
          </motion.div>

          <div className={`relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 ${styles.roadmap}`}>
            <div aria-hidden="true" className={styles.roadmapTrack} />
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.12 }}
                className={styles.stepMotion}
              >
                <div className={`group relative flex min-h-[390px] flex-col overflow-hidden rounded-[26px] border border-white/[0.11] bg-[#0b0b0e]/75 p-5 backdrop-blur-sm transition duration-300 hover:border-white/20 hover:bg-[#101014]/90 sm:min-h-[420px] sm:p-7 ${styles.stepCard}`}>
                  <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-[0.08] blur-3xl transition-opacity duration-300 group-hover:opacity-[0.16]" style={{ backgroundColor: step.accent }} />
                  <div className={`relative flex items-center justify-between ${styles.stepDepthHead}`}>
                    <div className="flex items-center gap-3">
                      <span className={`grid size-11 place-items-center rounded-2xl border bg-white/[0.035] font-mono text-sm font-bold ${styles.stepNumber}`} style={{ color: step.accent, borderColor: `${step.accent}40` }}>
                        {step.num}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        {idx === 0 ? "Input" : idx === 1 ? "Intelligence" : "Output"}
                      </span>
                    </div>
                    <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100 transition group-hover:border-white/20 group-hover:bg-white/[0.07]">
                      <step.icon className="size-[18px]" />
                    </div>
                  </div>

                  <div className={`relative my-7 flex h-36 items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4 sm:my-8 sm:h-40 ${styles.stepDemo}`}>
                    {idx === 0 && (
                      <div className="w-full">
                        <div className="mb-3 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-500">Drop your source</div>
                        <div className="flex h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 px-3.5">
                          <Link2 className="size-4 shrink-0 text-sky-300" />
                          <span className="truncate text-xs text-zinc-300">youtube.com/watch?v=...</span>
                          <span className="ml-auto size-1.5 shrink-0 rounded-full bg-emerald-400" />
                        </div>
                        <div className="mt-3 flex gap-2">
                          {["YouTube", "Zoom", "Drive"].map((source) => <span key={source} className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[9px] text-zinc-500">{source}</span>)}
                        </div>
                      </div>
                    )}
                    {idx === 1 && (
                      <div className="w-full">
                        <div className="mb-4 flex items-center justify-between text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                          <span>Finding the moments</span><span className="text-amber-300">AI scan · 84%</span>
                        </div>
                        <div className="flex h-12 items-center justify-center gap-[3px]">
                          {[18, 32, 22, 42, 27, 50, 34, 23, 40, 28, 48, 33, 20, 38, 52, 29, 43, 24, 35, 18, 44, 27, 36, 21].map((height, bar) => (
                            <span key={bar} className="w-1.5 rounded-full opacity-80" style={{ height: `${height}px`, background: bar > 13 && bar < 19 ? "#fbbf24" : "linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.16))" }} />
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500"><span className="size-1.5 rounded-full bg-amber-300" />Transcript, pacing, and hook signals</div>
                      </div>
                    )}
                    {idx === 2 && (
                      <div className="flex w-full items-center justify-center gap-2 sm:gap-3">
                        {[0, 1, 2].map((clip) => (
                          <div key={clip} className="relative h-[84px] w-[46px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-emerald-200/20 via-violet-300/10 to-black/70 shadow-lg sm:h-[94px] sm:w-[58px]" style={{ transform: `translateY(${clip === 1 ? -7 : 5}px)` }}>
                            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-br from-white/10 to-transparent" />
                            <span className="absolute left-2 top-2 rounded bg-black/40 px-1 py-0.5 font-mono text-[8px] text-white">9:16</span>
                            <div className="absolute inset-x-1.5 bottom-3 space-y-1"><span className="block h-1 rounded bg-white/80" /><span className="mx-auto block h-1 w-3/4 rounded bg-amber-300" /></div>
                          </div>
                        ))}
                        <div className="ml-1 min-w-0"><span className="block text-xs font-semibold text-white sm:text-sm">Ready to share</span><span className="mt-1 block text-[9px] leading-tight text-zinc-500 sm:text-[10px]">Vertical clips + captions</span></div>
                      </div>
                    )}
                  </div>

                  <div className={`relative flex flex-1 flex-col ${styles.stepCopy}`}>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
                    <div className="mt-auto flex items-center gap-2 border-t border-white/[0.09] pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: step.accent }} />
                      {idx === 0 ? "Add a source" : idx === 1 ? "Fully automated" : "Export anywhere"}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
