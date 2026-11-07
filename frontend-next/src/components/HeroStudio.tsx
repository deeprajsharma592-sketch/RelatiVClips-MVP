"use client";

/**
 * HeroStudio — Grounded, precision media studio hero
 * Clean cinematic dark canvas, zero-slop layout, direct video intake.
 */

import { motion } from "framer-motion";
import { Sparkles, Video, Play, Zap, Shield, ArrowRight } from "lucide-react";
import VideoIntake from "./VideoIntake";
import Link from "next/link";

const SAMPLES = [
  { label: "🎙️ Huberman Lab (Neuroscience)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "🥊 Joe Rogan (UFC Interview)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "💻 MKBHD (Tech Review)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
];

export default function HeroStudio() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center items-center overflow-hidden pt-28 pb-16 px-4 sm:px-6 bg-[#07080C] text-white">
      {/* Subtle Studio Ambient Grid & Center Glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono border border-white/10 bg-white/5 backdrop-blur-md"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">RelatiV Engine v2.0</span>
          <span className="text-slate-500">·</span>
          <span className="text-amber-400 font-semibold">9:16 Video + Subtitles</span>
        </motion.div>

        {/* Confident Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl tracking-tight text-white max-w-3xl mx-auto leading-[1.1]"
        >
          Turn long videos into viral{" "}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-amber-300 bg-clip-text text-transparent">
            9:16 vertical shorts.
          </span>
        </motion.h1>

        {/* Concise Functional Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-4 text-sm sm:text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed"
        >
          Automatically scores energy peaks, centers the speaker, and burns
          word-level dynamic karaoke subtitles. Ready to post to TikTok, Reels, and Shorts.
        </motion.p>

        {/* Primary Video Intake Box (Upload First + YouTube Link Toggle) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="mt-8 mb-6"
        >
          <VideoIntake />
        </motion.div>

        {/* Studio Specs Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-mono text-slate-400 pt-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>Zero-latency direct MP4 upload</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>1080×1920 HD vertical framing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>Word-level animated captions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">✓</span>
            <span>No account required to test</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
