"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Clock,
  Lock,
  Cpu,
  Video,
  Eye,
  CheckCircle2,
} from "lucide-react";
import ProcessingShowcase from "@/components/ProcessingShowcase";
import { getAppDashboardUrl } from "@/lib/domain";

export default function AboutPage() {
  const dashboardUrl = getAppDashboardUrl();

  return (
    <div className="relative w-full bg-[#F7F8FA] dark:bg-[#05060A] text-[#111318] dark:text-white selection:bg-amber-400 selection:text-black overflow-hidden transition-colors">
      {/* ── Subtle Atmospheric Grid & Ambient Lighting ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none blur-[140px] opacity-25"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(56, 189, 248, 0.3) 0%, rgba(139, 92, 246, 0.25) 45%, transparent 70%)",
        }}
      />

      <div className="relative max-w-[1140px] mx-auto px-5 sm:px-8 py-16 sm:py-24 space-y-28 sm:space-y-36">
        {/* ══════════════════════════════════════════════════════════
            SECTION 1 — CINEMATIC ABOUT HERO
            ══════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-4xl mx-auto space-y-6 pt-4 sm:pt-8"
        >
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-md text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
            <span>[Φ-MANIFESTO] · EDITORIAL ESSAY</span>
          </div>

          {/* Large Editorial Headline */}
          <h1 className="font-display font-bold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-zinc-900 dark:text-white leading-[1.08]">
            Great moments deserve <br className="hidden sm:inline" />
            to be <span className="text-zinc-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_35px_rgba(255,255,255,0.4)]">seen.</span>
          </h1>

          {/* Supporting Paragraph */}
          <p className="text-base sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto font-sans leading-relaxed">
            RelatiV turns long-form footage into short-form stories, helping creators spend less time searching and more time creating.
          </p>

          {/* Restrained Process Connection Tags */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-zinc-500">
            <span className="px-3 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-cyan-700 dark:text-cyan-300">
              16:9 Long-Form
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">→</span>
            <span className="px-3 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-violet-700 dark:text-violet-300">
              AI Hook & Narrative Analysis
            </span>
            <span className="text-zinc-400 dark:text-zinc-600">→</span>
            <span className="px-3 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-amber-700 dark:text-amber-300">
              9:16 Viral Shorts
            </span>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2 — THE RELATIV PROCESSING EXPERIENCE
            ══════════════════════════════════════════════════════════ */}
        <section className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-xs font-mono text-cyan-600 dark:text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>INTERACTIVE SHOWCASE</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-zinc-900 dark:text-white tracking-tight">
              From hours of footage to moments worth sharing.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-sans">
              See how RelatiV transforms raw video into high-retention short clips through automated segmentation, reframing, and animated subtitles.
            </p>
          </div>

          {/* Elevated Interactive Stage Component */}
          <ProcessingShowcase />
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 3 — BEHIND THE INTELLIGENCE
            ══════════════════════════════════════════════════════════ */}
        <section className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/10 text-xs font-mono text-violet-600 dark:text-violet-300">
              <Cpu className="w-3.5 h-3.5" />
              <span>PIPELINE ARCHITECTURE</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight">
              A smarter way to find the moments that matter.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
              Engineered from the ground up around actual audio, visual, and narrative signals.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Block 1: Audio & Speech Analysis */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/90 p-7 sm:p-8 space-y-4 shadow-sm dark:shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-black/20 dark:hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold block">
                  STAGE 01 · INTAKE & PARSING
                </span>
                <h3 className="font-display font-bold text-xl text-zinc-900 dark:text-white">
                  Understand the Footage
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Our audio pipeline computes spectral volume variance, silence boundaries, and pitch inflection points, paired with Whisper speech transcription to establish word-level timestamp anchors.
              </p>
              <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>SPECTRUM ENERGY ANALYSIS</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">VERIFIED</span>
              </div>
            </div>

            {/* Block 2: Moment Detection & Virality Scoring */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/90 p-7 sm:p-8 space-y-4 shadow-sm dark:shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-black/20 dark:hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-violet-600 dark:text-violet-400 font-semibold block">
                  STAGE 02 · SEMANTIC HOOKS
                </span>
                <h3 className="font-display font-bold text-xl text-zinc-900 dark:text-white">
                  Find the Moments
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Semantic evaluation algorithms identify high-retention conversation hooks, provocative statements, emotional peaks, and natural conclusions — scoring each candidate clip for algorithmic lift.
              </p>
              <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>NARRATIVE ARC SCORING</span>
                <span className="text-violet-600 dark:text-violet-400 font-semibold">VERIFIED</span>
              </div>
            </div>

            {/* Block 3: Reframing & Rendering */}
            <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/90 p-7 sm:p-8 space-y-4 shadow-sm dark:shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-black/20 dark:hover:border-white/20 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-300">
                <Video className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-amber-600 dark:text-amber-300 font-semibold block">
                  STAGE 03 · OUTPUT GENERATION
                </span>
                <h3 className="font-display font-bold text-xl text-zinc-900 dark:text-white">
                  Prepare the Output
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Active speaker face tracking keeps participants centered in vertical 9:16 crops, while the caption engine burns synchronized, high-contrast karaoke subtitles into crisp 1080p MP4 exports.
              </p>
              <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>1080P FFmpeg RENDERER</span>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">VERIFIED</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 4 — OUR MISSION
            ══════════════════════════════════════════════════════════ */}
        <section className="relative rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/70 p-8 sm:p-14 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl">
          <div
            className="absolute -top-32 -right-32 w-80 h-80 rounded-full pointer-events-none blur-[100px] opacity-25"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
            }}
          />

          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-xs font-mono text-amber-600 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>THE MISSION</span>
            </div>

            <h2 className="font-display font-bold text-3xl sm:text-5xl text-zinc-900 dark:text-white tracking-tight leading-tight">
              Less time editing. <br />
              More time creating.
            </h2>

            <p className="text-base sm:text-lg text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed">
              Long-form video creators often spend up to 80% of their post-production energy scrubbing through endless timelines just to isolate a few dozen seconds of engaging content.
            </p>

            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
              RelatiV was engineered to eliminate that mechanical grind. By automating hook detection, speaker framing, and word-by-word subtitles, we give creators the freedom to focus on what truly moves audiences: storytelling and idea generation.
            </p>

            <div className="pt-4 flex items-center gap-4 text-xs font-mono text-zinc-500">
              <span>EST. BENGALURU, INDIA</span>
              <span>·</span>
              <span>BUILT FOR STORYTELLERS GLOBALLY</span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 5 — TECHNOLOGY AND PRIVACY
            ══════════════════════════════════════════════════════════ */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs font-mono text-emerald-600 dark:text-emerald-300">
              <Shield className="w-3.5 h-3.5" />
              <span>TRUST & DATA ARCHITECTURE</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight">
              Built for creators who value their content.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
              Transparent processing, ephemeral storage, and zero compromise on creator ownership.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/80 p-6 space-y-3 backdrop-blur-md shadow-sm dark:shadow-none">
              <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                Ephemeral 4-Day Vault
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Uploaded source videos and rendered clips exist solely in a temporary 4-day storage vault for quick download, after which they are automatically and permanently purged.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/80 p-6 space-y-3 backdrop-blur-md shadow-sm dark:shadow-none">
              <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                Zero Public AI Training
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                Your footage, podcasts, and personal intellectual property are never ingested to train public foundation models or shared with third-party advertising brokers.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#090b11]/80 p-6 space-y-3 backdrop-blur-md shadow-sm dark:shadow-none">
              <div className="w-10 h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                Isolated Edge Pipelines
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                All data transfers are encrypted in transit via HTTPS and routed through authenticated edge proxies with strict session verification and automated rate-limiting.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 6 — FINAL PRODUCT CTA
            ══════════════════════════════════════════════════════════ */}
        <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-gradient-to-b dark:from-[#090b11] dark:to-black p-10 sm:p-16 text-center space-y-6 shadow-lg dark:shadow-2xl relative overflow-hidden">
          <div
            className="absolute inset-x-0 -top-px h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.4) 30%, rgba(245, 158, 11, 0.4) 70%, transparent 100%)",
            }}
          />

          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-zinc-900 dark:text-white tracking-tight">
              Your next great clip starts with one video.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
              Bring your raw footage or paste a link to see RelatiV's AI virality engine in action.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={dashboardUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#111318] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-100 font-semibold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              <span>Start creating</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#processing-showcase"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-zinc-800 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-300 dark:hover:text-white font-medium text-sm border border-black/10 dark:border-white/10 transition-all"
            >
              <Eye className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <span>Watch demonstration</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
