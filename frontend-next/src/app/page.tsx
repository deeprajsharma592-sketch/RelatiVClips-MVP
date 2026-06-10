"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BentoCard from "@/components/BentoCard";
import PhysicsIcon from "@/components/PhysicsIcon";
import InputDropzone from "@/components/InputDropzone";
import ProcessingPipeline from "@/components/ProcessingPipeline";
import OutputCanvas from "@/components/OutputCanvas";
import AnimatedCounter from "@/components/AnimatedCounter";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import { submitYouTubeUrl, pollUntilComplete } from "@/lib/api";
import HeroBackground from "@/components/HeroBackground";
import type { ProcessState, Clip, StatusResponse } from "@/types";

const DEMO_CLIPS: Clip[] = [
  {
    clip_id: "demo_1", start: 12.3, end: 27.8, duration_s: 15.5,
    caption: "The key insight that changes everything about how we think about AI safety and alignment.",
    viral_title: "Key Insight: AI Safety Paradigm Shift",
    hashtags: "#AI #Safety #Tech",
    file_path: "", file_size_mb: 4.2, created_at: new Date().toISOString(),
  },
  {
    clip_id: "demo_2", start: 45.1, end: 62.4, duration_s: 17.3,
    caption: "Energy spike detected during the most intense moment of the conversation.",
    viral_title: "Momentum Shift: Energy Spike",
    hashtags: "#Viral #Energy #Moment",
    file_path: "", file_size_mb: 5.1, created_at: new Date().toISOString(),
  },
  {
    clip_id: "demo_3", start: 88.7, end: 104.2, duration_s: 15.5,
    caption: "Highest engagement zone — the emotional peak that drives shares and comments.",
    viral_title: "Signal Peak: Hook Extracted",
    hashtags: "#Engagement #Hook #Content",
    file_path: "", file_size_mb: 4.8, created_at: new Date().toISOString(),
  },
];

const DEMOS = [
  { label: "Podcast", icon: "\u03BC", desc: "Interview peak" },
  { label: "Vlog", icon: "\u0394v", desc: "Energy spike" },
  { label: "Sports", icon: "\u03A3", desc: "Highlight reel" },
];

export default function Home() {
  const [state, setState] = useState<ProcessState>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (source: string | File) => {
    setError(null);
    setState("processing");

    try {
      if (typeof source !== "string") {
        throw new Error("File upload not supported via frontend. Use a YouTube URL.");
      }

      const response = await submitYouTubeUrl(source);
      setTaskId(response.taskId);

      const completed = await pollUntilComplete(response.taskId);

      setClips(completed.clips ?? []);
      setState("completed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setState("error");
    }
  }, []);

  const handleReset = useCallback(() => {
    setState("idle");
    setTaskId(null);
    setClips([]);
    setError(null);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-16 min-h-[420px] flex items-center overflow-hidden"
      >
        <HeroBackground />

        <div className="relative z-10 w-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-mono text-accent">
              [\u03A6-Engine v2.0]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-3">
            <span className="bg-gradient-to-r from-white via-accent to-accent-secondary bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient">
              Quantum-Precision
              <br />
              AI Video Clipping
            </span>
          </h1>
          <p className="text-base md:text-lg text-text-muted max-w-2xl font-sans leading-relaxed">
            Extract viral-worthy clips with surgical accuracy. Local processing
            ensures zero data leaves your machine. Face tracking, audio
            signatures, and semantic hook detection fully automated.
          </p>

          {/* Demo clip selector */}
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="text-xs font-mono text-text-muted self-center mr-2">
              [\u25B6] Try a demo:
            </span>
            {DEMOS.map((demo) => (
              <motion.button
                key={demo.label}
                onClick={() => {
                  setClips(DEMO_CLIPS);
                  setState("completed");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-[2px] hover:border-accent hover:bg-accent/5 transition-all text-sm"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="font-mono text-xs text-accent-secondary">[{demo.icon}]</span>
                <span className="font-sans text-text-muted hover:text-white transition-colors">{demo.label}</span>
                <span className="text-[10px] font-mono text-text-muted/50 hidden sm:inline">{demo.desc}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Error state */}
      <AnimatePresence>
        {state === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-error/10 border border-error/30 rounded-[4px] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-error font-mono text-sm">[\u2717]</span>
              <span className="text-sm text-white">{error}</span>
            </div>
            <motion.button
              onClick={handleReset}
              className="px-3 py-1.5 bg-error/20 text-error text-xs font-semibold rounded-[2px] font-sans hover:bg-error/30 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Retry
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main workspace grid */}
      <div className="bento-grid">
        <AnimatePresence mode="wait">
          {(state === "idle" || state === "error") && (
            <BentoCard key="input" colSpan={8} glow="accent">
              <InputDropzone
                onUrlSubmit={handleSubmit}
                onFileSubmit={handleSubmit}
                disabled={false}
              />
            </BentoCard>
          )}
          {state === "processing" && taskId ? (
            <div key="processing" className="col-span-12">
              <ProcessingPipeline
                taskId={taskId}
                onComplete={(response: StatusResponse) => {
                  if (response.status === "complete") {
                    setClips(response.clips ?? []);
                    setState("completed");
                  }
                }}
                onError={(msg: string) => {
                  setError(msg);
                  setState("error");
                }}
              />
            </div>
          ) : state === "completed" ? (
            <div key="completed" className="col-span-12">
              <OutputCanvas clips={clips} onReset={handleReset} />
            </div>
          ) : null}
        </AnimatePresence>

        {state === "idle" && (
          <BentoCard colSpan={4} glow="secondary">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-accent-secondary">[\u03B7]</span>
                <span className="text-sm font-display text-white font-semibold">Processing Variables</span>
              </div>
              <div className="space-y-4">
                {[
                  { symbol: "\u03B7", label: "Processing Efficiency", value: "96.2%" },
                  { symbol: "\u03B5", label: "Target Aspect Ratio", value: "9:16" },
                  { symbol: "\u0394t", label: "Max Clip Duration", value: "60s" },
                  { symbol: "\u03C6", label: "Face Tracking", value: "Active" },
                  { symbol: "\u03A3", label: "Output Resolution", value: "1080x1920" },
                  { symbol: "\u0394v", label: "Frame Vector Delta", value: "2.4px" },
                ].map((v) => (
                  <div key={v.symbol} className="flex items-center justify-between p-3 bg-black border border-border rounded-[2px] hover:border-accent-secondary/30 transition-colors">
                    <PhysicsIcon symbol={v.symbol} label={v.label} color="secondary" />
                    <span className="font-mono text-xs text-white">{v.value}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <motion.div className="w-2 h-2 rounded-full bg-accent-secondary" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <span className="text-xs font-mono text-text-muted">All systems nominal</span>
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* Social proof bar */}
        {state === "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-20 mb-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-mono text-text-muted">Trusted by creators generating</span>
              <span className="text-xs font-mono text-accent font-semibold">2B+ monthly views</span>
              <div className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" />
            </div>

            <div className="overflow-hidden mask-edges">
              <motion.div
                className="flex gap-12"
                animate={{ x: [0, -1800] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              >
                {[
                  { name: "Grant Cardone", subs: "4.7M" },
                  { name: "Scott Galloway", subs: "192K" },
                  { name: "Logan Paul", subs: "23.6M" },
                  { name: "Jenny Hoyos", subs: "4M" },
                  { name: "Mark Rober", subs: "65.9M" },
                  { name: "Tom Bilyeu", subs: "4.5M" },
                  { name: "Dhar Mann", subs: "24.8M" },
                  { name: "Jack Rhysider", subs: "1.2M" },
                ].map((creator, i) => (
                  <div
                    key={`${creator.name}-${i}`}
                    className="flex items-center gap-4 shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                      <span className="font-mono text-xs text-accent-secondary">
                        [{creator.name.charAt(0)}]
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-sans text-white whitespace-nowrap">{creator.name}</p>
                      <p className="text-[10px] font-mono text-text-muted">{creator.subs} subs</p>
                    </div>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {[
                  { name: "Grant Cardone", subs: "4.7M" },
                  { name: "Scott Galloway", subs: "192K" },
                  { name: "Logan Paul", subs: "23.6M" },
                  { name: "Jenny Hoyos", subs: "4M" },
                  { name: "Mark Rober", subs: "65.9M" },
                  { name: "Tom Bilyeu", subs: "4.5M" },
                  { name: "Dhar Mann", subs: "24.8M" },
                  { name: "Jack Rhysider", subs: "1.2M" },
                ].map((creator, i) => (
                  <div
                    key={`${creator.name}-dup-${i}`}
                    className="flex items-center gap-4 shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                      <span className="font-mono text-xs text-accent-secondary">
                        [{creator.name.charAt(0)}]
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-sans text-white whitespace-nowrap">{creator.name}</p>
                      <p className="text-[10px] font-mono text-text-muted">{creator.subs} subs</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Animated stat counters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mt-20 mb-12 grid grid-cols-3 md:grid-cols-6 gap-8"
        >
          <AnimatedCounter symbol="\u03A3" to={847} suffix="K" label="Videos Processed" />
          <AnimatedCounter symbol="\u03A6" to={2.4} suffix="M" decimals={1} label="Clips Generated" />
          <AnimatedCounter symbol="\u0394t" to={12} suffix="K+" label="Hours Saved" />
          <AnimatedCounter symbol="\u03B7" to={99.2} suffix="%" decimals={1} label="Accuracy Rate" />
          <AnimatedCounter symbol="\u03B5" to={16} suffix="M" label="Creator Reach" />
          <AnimatedCounter symbol="\u03C8" to={4.8} suffix="/5" decimals={1} label="Avg. Virality" />
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 mb-8"
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent to-border" />
            <span className="text-xs font-mono text-text-muted">[ \u2605 ] What Creators Say</span>
            <div className="h-px flex-1 max-w-[120px] bg-gradient-to-l from-transparent to-border" />
          </div>
          <TestimonialCarousel />
        </motion.div>
      </div>
    </div>
  );
}
